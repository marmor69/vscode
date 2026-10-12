/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirs } from '../../build/npm/dirs.ts';
import { getVersion } from '../../build/lib/git.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const npm = 'npm';

function run(command: string, args: string[], directory = root) {
	console.log(`[server-build] ${command} ${args.join(' ')} (${directory})`);
	const result = spawnSync(command, args, { cwd: directory, stdio: 'inherit', env: process.env });
	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

function sourceRevision(): string {
	const revision = process.env['SOURCE_COMMIT'] || getVersion(root);
	if (revision) {
		if (!/^[a-f\d]{40}$/i.test(revision)) {
			throw new Error('SOURCE_COMMIT must be a full 40-character Git revision.');
		}
		return revision;
	}
	// ZIP/gitless contexts still need a matching version for the UI and extension host.
	const hash = createHash('sha1');
	for (const name of ['src', 'extensions']) {
		for (const file of readdirSync(join(root, name), { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).sort((a, b) => join(a.parentPath, a.name).localeCompare(join(b.parentPath, b.name)))) {
			const path = join(file.parentPath, file.name);
			hash.update(path.slice(root.length));
			hash.update(readFileSync(path));
		}
	}
	for (const name of ['product.json', 'package.json', 'package-lock.json']) {
		hash.update(readFileSync(join(root, name)));
	}
	return hash.digest('hex');
}

if (process.platform !== 'linux' || !['x64', 'arm64'].includes(process.arch)) {
	throw new Error('The container build supports Linux amd64 and arm64.');
}
const remoteNpmrc = readFileSync(join(root, 'remote/.npmrc'), 'utf8');
const expectedNode = /^target="([\d.]+)"$/m.exec(remoteNpmrc)?.[1];
if (process.versions.node !== expectedNode) {
	throw new Error(`Use Node ${expectedNode} to match remote/.npmrc (running ${process.versions.node}).`);
}
process.env['BUILD_SOURCEVERSION'] = sourceRevision();
// The upstream built-in Copilot packager requires the release channel when a
// source revision is provided. This does not publish the build anywhere.
process.env['VSCODE_QUALITY'] = 'stable';

// The browser/server build needs no Electron native modules. Only remote/ gets its
// lifecycle scripts, compiling the PTY, file watcher, SQLite, and other server modules.
const installDirs = dirs.filter(directory => directory === '' || directory === 'build' || directory === 'remote' || directory === 'remote/web' || directory === 'extensions' || (directory.startsWith('extensions/') && !directory.startsWith('extensions/vscode-')));
for (const directory of installDirs) {
	if (existsSync(join(root, directory, 'package-lock.json'))) {
		run(npm, ['ci', '--no-audit', '--no-fund', ...(directory === 'remote' ? [] : ['--ignore-scripts'])], join(root, directory));
	}
}
run(process.execPath, ['build/npm/electronTypes.ts']);
run(npm, ['run', 'gulp', `vscode-reh-web-linux-${process.arch}`]);
cpSync(resolve(root, `../vscode-reh-web-linux-${process.arch}`), resolve(root, '../server'), { recursive: true });
