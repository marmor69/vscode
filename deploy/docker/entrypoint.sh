#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE.txt in the project root.
set -euo pipefail
umask 077

case "${ICM_AUTH_MODE:-token}" in
	token)
		if [[ ! "${ICM_CONNECTION_TOKEN:-}" =~ ^[a-zA-Z0-9_-]{32,}$ ]]; then
			printf '%s\n' 'Set ICM_CONNECTION_TOKEN to at least 32 characters using letters, numbers, _ or -.' >&2
			exit 1
		fi
		;;
	proxy) ;;
	*) printf '%s\n' 'ICM_AUTH_MODE must be token or proxy.' >&2; exit 1 ;;
esac

public_port_args=()
if [[ -n "${ICM_PUBLIC_PORT:-}" ]]; then
	if [[ ! "$ICM_PUBLIC_PORT" =~ ^[1-9][0-9]{0,4}$ ]] || (( ICM_PUBLIC_PORT > 65535 )); then
		printf '%s\n' 'ICM_PUBLIC_PORT must be a public port between 1 and 65535.' >&2
		exit 1
	fi
	public_port_args=(--public-port "$ICM_PUBLIC_PORT")
fi

state_dir=/home/node/.local/share/simple-workspace
mkdir -p "$state_dir/server" "$state_dir/extensions" /workspaces
# Code - OSS has no redistributable Microsoft extension signature verifier.
# Configure both the install CLI's user settings and the server's machine settings.
# Seed new profiles only; preserve settings on subsequent starts.
for settings_dir in User Machine; do
	mkdir -p "$state_dir/server/data/$settings_dir"
	if [[ ! -e "$state_dir/server/data/$settings_dir/settings.json" ]]; then
		printf '%s\n' '{ "extensions.verifySignature": false, "vscode-office.enableTelemetry": false }' > "$state_dir/server/data/$settings_dir/settings.json"
	fi
done
auth_args=(--without-connection-token)
if [[ "${ICM_AUTH_MODE:-token}" == token ]]; then
	printf '%s' "$ICM_CONNECTION_TOKEN" > "$state_dir/connection-token"
	auth_args=(--connection-token-file "$state_dir/connection-token")
fi
# Keep the web login token out of agent/terminal process environments.
unset ICM_CONNECTION_TOKEN

# Clone into a temporary sibling first: interrupted downloads must not become templates.
if [[ "${ICM_INIT_EXAMPLE:-true}" == true && ! -e /workspaces/Beispiel-Projekt ]]; then
	example_tmp=$(mktemp -d /workspaces/.icm-example.XXXXXX)
	printf '%s\n' 'Preparing Beispiel-Projekt from RinDig/Interpretable-Context-Methodology...'
	if timeout 180 git clone --depth 1 https://github.com/RinDig/Interpretable-Context-Methodology.git "$example_tmp"; then
		mv -T -n "$example_tmp" /workspaces/Beispiel-Projekt
	else
		printf '%s\n' 'Example project could not be downloaded; the next start will retry.' >&2
	fi
	# Only remove the temporary directory created by this invocation.
	if [[ -d "$example_tmp" ]]; then
		rm -r -- "$example_tmp"
	fi
fi

server_node=/opt/simple-workspace/node
server_main=/opt/simple-workspace/out/server-main.js
install_extension() {
	local extension_id=$1
	local version=${2:-}
	local target=$extension_id
	local list_args=()
	if [[ -n "$version" ]]; then
		target="$extension_id@$version"
		list_args=(--show-versions)
	fi
	if ! "$server_node" "$server_main" --extensions-dir "$state_dir/extensions" --server-data-dir "$state_dir/server" --list-extensions "${list_args[@]}" 2>/dev/null | grep -Fxq "$target"; then
		printf 'Installing %s...\n' "$target"
		if ! timeout 180 "$server_node" "$server_main" --extensions-dir "$state_dir/extensions" --server-data-dir "$state_dir/server" --install-extension "$target" --force; then
			printf '%s could not be installed automatically. Install it from Extensions after opening the workspace.\n' "$extension_id" >&2
		fi
	fi
}

install_official_extension() {
	local extension_id=$1
	local version=$2
	if [[ "$version" != latest && ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
		printf 'Invalid version for %s: use latest or an explicit version.\n' "$extension_id" >&2
		exit 1
	fi
	local installed_version
	installed_version=$("$server_node" "$server_main" --extensions-dir "$state_dir/extensions" --server-data-dir "$state_dir/server" --list-extensions --show-versions 2>/dev/null | awk -F@ -v id="$extension_id" '$1 == id { print $2; exit }' || true)
	if [[ "$version" != latest && "$installed_version" == "$version" ]]; then
		return
	fi
	local extension_tmp
	extension_tmp=$(mktemp -d "$state_dir/.official-vsix.XXXXXX")
	if "$server_node" /usr/local/lib/simple-workspace/install-official-extension.mts "$extension_id" "$version" "$extension_tmp/extension.vsix" "$installed_version"; then
		if [[ -f "$extension_tmp/extension.vsix" ]]; then
			if ! timeout 180 "$server_node" "$server_main" --extensions-dir "$state_dir/extensions" --server-data-dir "$state_dir/server" --install-extension "$extension_tmp/extension.vsix" --force; then
				printf '%s installation failed; keeping the server available. The next start will retry.\n' "$extension_id" >&2
			fi
		fi
	else
		printf '%s download failed; keeping the server available. The next start will retry.\n' "$extension_id" >&2
	fi
	rm -r -- "$extension_tmp"
}

if [[ "${ICM_INSTALL_CODEX:-false}" == true ]]; then
	install_official_extension openai.chatgpt "${ICM_CODEX_VERSION:-26.1007.21434}"
fi
if [[ "${ICM_INSTALL_CLAUDE:-true}" == true ]]; then
	install_official_extension anthropic.claude-code "${ICM_CLAUDE_VERSION:-latest}"
fi
if [[ "${ICM_INSTALL_OFFICE:-true}" == true ]]; then
	install_extension cweijan.vscode-office
fi

exec "$server_node" "$server_main" \
	--host 0.0.0.0 \
	--port 8080 \
	--server-data-dir "$state_dir/server" \
	--extensions-dir "$state_dir/extensions" \
	--default-folder /workspaces \
	"${auth_args[@]}" \
	--enable-proposed-api openai.chatgpt \
	--telemetry-level off \
	"${public_port_args[@]}" \
	"$@"
