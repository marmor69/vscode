/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2];
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command: string, args: string[], directory = root) {
	const result = spawnSync(command, args, { cwd: directory, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

function configureWebGallery() {
	const overridePath = join(root, 'product.overrides.json');
	const overrides = existsSync(overridePath) ? JSON.parse(readFileSync(overridePath, 'utf8')) : {};
	if (!overrides.extensionsGallery) {
		const product = JSON.parse(readFileSync(join(root, 'product.json'), 'utf8'));
		overrides.extensionsGallery = product.extensionsGallery;
		writeFileSync(overridePath, `${JSON.stringify(overrides, null, '\t')}\n`);
	}
}

if (mode === '--setup') {
	if (Number(process.versions.node.split('.')[0]) !== 24) {
		throw new Error('Use Node.js 24 (at least the version in .nvmrc).');
	}
	// This deliberately prepares the browser demo only, without Electron/native modules.
	const extensions = ['configuration-editing', 'typescript-language-features', 'git-base', 'merge-conflict', 'json-language-features', 'markdown-language-features', 'markdown-math', 'mermaid-markdown-features', 'emmet', 'extension-editing', 'github-authentication'];
	for (const directory of ['', 'build', 'extensions', ...extensions.map(name => `extensions/${name}`), 'extensions/json-language-features/server']) {
		if (existsSync(join(root, directory, 'package-lock.json'))) {
			run(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], join(root, directory));
		}
	}
	run(process.execPath, ['build/npm/electronTypes.ts']);
	run(npm, ['run', 'build-fast', '--', '--client-only']);
	for (const name of extensions) {
		run(process.execPath, [`extensions/${name}/esbuild.browser.mts`]);
	}
	for (const script of ['build-webview', 'build-markdown-editor']) {
		run(npm, ['run', script], join(root, 'extensions/markdown-language-features'));
	}
	console.log('Ready. Run: node scripts/simple-workspace.mts --web');
} else if (mode === '--web') {
	if (!existsSync(join(root, 'out/vs/workbench/workbench.web.main.js'))) {
		throw new Error('Run node scripts/simple-workspace.mts --setup first.');
	}
	configureWebGallery();
	run(process.execPath, ['scripts/code-web.js', 'examples/icm-starter', '--host', 'localhost', '--port', '8080', '--browserType', 'none']);
} else {
	console.log('Usage: node scripts/simple-workspace.mts --setup | --web');
	process.exitCode = 1;
}
