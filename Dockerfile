# syntax=docker/dockerfile:1
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE.txt in the project root.

# Match remote/.npmrc: native server modules must use the server's Node ABI.
ARG NODE_VERSION=24.21.0
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /build/vscode
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		build-essential python3 pkg-config git ca-certificates \
		libkrb5-dev libsecret-1-dev libx11-dev libxkbfile-dev \
	&& rm -rf /var/lib/apt/lists/*
# Gulp loads shared tooling even for a server-only build. Keep the complete source
# tree, but changes to deployment docs/startup should not invalidate compilation.
COPY --exclude=README.md --exclude=docs --exclude=Dockerfile --exclude=compose.yml \
	--exclude=deploy/docker/README.md --exclude=deploy/docker/entrypoint.sh . .
ARG SOURCE_COMMIT
ENV NODE_OPTIONS=--max-old-space-size=4096 GOMAXPROCS=4
# Optional CA for environments with an HTTPS proxy; not needed on a normal VPS.
RUN --mount=type=secret,id=proxy_ca \
	--mount=type=cache,target=/root/.npm \
	if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
	NODE_USE_ENV_PROXY=1 SOURCE_COMMIT="$SOURCE_COMMIT" node deploy/docker/build-server.mts

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		bash bubblewrap ca-certificates curl git openssh-client ripgrep \
		libatomic1 libgssapi-krb5-2 libsecret-1-0 \
	&& rm -rf /var/lib/apt/lists/*
# Copy and set permissions in one layer, avoiding large intermediate image layers.
RUN --mount=type=bind,from=build,source=/build,target=/build-artifacts \
	--mount=type=bind,source=deploy/docker/entrypoint.sh,target=/tmp/entrypoint.sh \
	mkdir -p /opt/simple-workspace /workspaces /home/node/.local/share/simple-workspace \
	&& cp -a /build-artifacts/server/. /opt/simple-workspace/ \
	&& cp /build-artifacts/vscode/LICENSE.txt /build-artifacts/vscode/ThirdPartyNotices.txt /opt/simple-workspace/ \
	&& mkdir -p /opt/simple-workspace/examples \
	&& cp -a /build-artifacts/vscode/examples/icm-starter /opt/simple-workspace/examples/ \
	&& cp /tmp/entrypoint.sh /usr/local/bin/simple-workspace-entrypoint \
	&& chmod 755 /usr/local/bin/simple-workspace-entrypoint \
	&& chmod -R a+rX /opt/simple-workspace \
	&& chown -R node:node /workspaces /home/node
ENV NODE_ENV=production \
	SHELL=/bin/bash \
	npm_config_prefix=/home/node/.local \
	PATH=/home/node/.local/bin:/opt/simple-workspace/bin/remote-cli:${PATH}
USER node
WORKDIR /workspaces
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=5m --retries=5 \
	CMD node -e "fetch('http://127.0.0.1:8080/version').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/local/bin/simple-workspace-entrypoint"]
CMD []
