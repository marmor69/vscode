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

if [[ "${ICM_INSTALL_CODEX:-false}" == true ]]; then
	codex_version=${ICM_CODEX_VERSION:-26.1007.21434}
	if [[ ! "$codex_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
		printf '%s\n' 'ICM_CODEX_VERSION must be an explicit version such as 26.1007.21434.' >&2
		exit 1
	fi
	if ! "$server_node" "$server_main" --extensions-dir "$state_dir/extensions" --server-data-dir "$state_dir/server" --list-extensions --show-versions 2>/dev/null | grep -Fxq "openai.chatgpt@$codex_version"; then
		codex_tmp=$(mktemp -d "$state_dir/.codex-vsix.XXXXXX")
		printf 'Installing official Codex %s...\n' "$codex_version"
		if "$server_node" --input-type=module - "$codex_version" "$codex_tmp/codex.vsix" <<'NODE'
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [version, destination] = process.argv.slice(2);
const platform = `linux-${process.arch}`;
try {
	const response = await fetch('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Accept': 'application/json;api-version=7.2-preview.1' },
		body: JSON.stringify({ filters: [{ criteria: [{ filterType: 7, value: 'openai.chatgpt' }], pageNumber: 1, pageSize: 1 }], flags: 147 }),
		signal: AbortSignal.timeout(30000),
	});
	if (!response.ok) { throw new Error(`Extension metadata returned HTTP ${response.status}`); }
	const data = await response.json();
	const extension = data.results?.[0]?.extensions?.find(item => item.publisher?.publisherName === 'openai' && item.extensionName === 'chatgpt');
	const release = extension?.versions?.find(item => item.version === version && item.targetPlatform === platform);
	const checksum = release?.properties?.find(item => item.key === 'Microsoft.VisualStudio.Services.VsixSha256')?.value;
	const url = release?.files?.find(item => item.assetType === 'Microsoft.VisualStudio.Services.VSIXPackage')?.source;
	if (!url?.startsWith('https://') || !/^[a-f0-9]{64}$/i.test(checksum ?? '')) { throw new Error(`No verified Codex package found for ${version} / ${platform}`); }
	const download = await fetch(url, { signal: AbortSignal.timeout(120000) });
	if (!download.ok) { throw new Error(`Extension download returned HTTP ${download.status}`); }
	const bytes = Buffer.from(await download.arrayBuffer());
	if (createHash('sha256').update(bytes).digest('hex') !== checksum.toLowerCase()) { throw new Error('Codex VSIX SHA-256 mismatch'); }
	writeFileSync(destination, bytes);
	console.log(`Codex VSIX SHA-256 verified (${version}, ${platform}).`);
} catch (error) {
	console.error(`Codex download failed: ${error.message}`);
	process.exitCode = 1;
}
NODE
		then
			if ! timeout 180 "$server_node" "$server_main" --extensions-dir "$state_dir/extensions" --server-data-dir "$state_dir/server" --install-extension "$codex_tmp/codex.vsix" --force; then
				printf '%s\n' 'Codex installation failed; keeping the server available. The next start will retry.' >&2
			fi
		else
			printf '%s\n' 'Codex download failed; keeping the server available. The next start will retry.' >&2
		fi
		rm -r -- "$codex_tmp"
	fi
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
