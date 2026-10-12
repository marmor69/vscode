#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE.txt in the project root.
set -euo pipefail
umask 077

if [[ ! "${ICM_CONNECTION_TOKEN:-}" =~ ^[a-zA-Z0-9_-]{32,}$ ]]; then
	printf '%s\n' 'Set ICM_CONNECTION_TOKEN to at least 32 characters using letters, numbers, _ or -.' >&2
	exit 1
fi

state_dir=/home/node/.local/share/simple-workspace
mkdir -p "$state_dir/server" "$state_dir/extensions" /workspaces
# Code - OSS has no redistributable Microsoft extension signature verifier.
# Configure both the install CLI's user settings and the server's machine settings.
# Seed new profiles only; preserve settings on subsequent starts.
for settings_dir in User Machine; do
	mkdir -p "$state_dir/server/data/$settings_dir"
	if [[ ! -e "$state_dir/server/data/$settings_dir/settings.json" ]]; then
		printf '%s\n' '{ "extensions.verifySignature": false }' > "$state_dir/server/data/$settings_dir/settings.json"
	fi
done
printf '%s' "$ICM_CONNECTION_TOKEN" > "$state_dir/connection-token"
# Keep the web login token out of agent/terminal process environments.
unset ICM_CONNECTION_TOKEN

server_node=/opt/simple-workspace/node
server_main=/opt/simple-workspace/out/server-main.js
if [[ "${ICM_INSTALL_CODEX:-false}" == true ]]; then
	if ! "$server_node" "$server_main" --extensions-dir "$state_dir/extensions" --server-data-dir "$state_dir/server" --list-extensions 2>/dev/null | grep -qx 'openai.chatgpt'; then
		printf '%s\n' 'Installing the official Codex extension (first start)...'
		if ! timeout 180 "$server_node" "$server_main" --extensions-dir "$state_dir/extensions" --server-data-dir "$state_dir/server" --install-extension openai.chatgpt; then
			printf '%s\n' 'Codex could not be installed automatically. Install it from Extensions after opening the workspace.' >&2
		fi
	fi
fi

exec "$server_node" "$server_main" \
	--host 0.0.0.0 \
	--port 8080 \
	--server-data-dir "$state_dir/server" \
	--extensions-dir "$state_dir/extensions" \
	--default-folder /workspaces \
	--connection-token-file "$state_dir/connection-token" \
	--enable-proposed-api openai.chatgpt \
	--telemetry-level off \
	"$@"
