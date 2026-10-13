/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

interface GalleryRelease {
	version: string;
	targetPlatform?: string;
	properties?: { key: string; value: string }[];
	files?: { assetType: string; source: string }[];
}

interface GalleryResponse {
	results?: { extensions?: { publisher?: { publisherName: string }; extensionName: string; versions?: GalleryRelease[] }[] }[];
}

const [id, requestedVersion, destination, installedVersion] = process.argv.slice(2);
const platform = `linux-${process.arch}`;

try {
	if (!/^[a-z0-9-]+\.[a-z0-9-]+$/i.test(id ?? '') || (requestedVersion !== 'latest' && !/^\d+\.\d+\.\d+$/.test(requestedVersion ?? ''))) {
		throw new Error('Specify an extension ID and latest or an explicit version.');
	}
	const [publisher, name] = id.split('.');
	const response = await fetch('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Accept': 'application/json;api-version=7.2-preview.1' },
		body: JSON.stringify({ filters: [{ criteria: [{ filterType: 7, value: id }], pageNumber: 1, pageSize: 1 }], flags: 147 }),
		signal: AbortSignal.timeout(30000),
	});
	if (!response.ok) {
		throw new Error(`Extension metadata returned HTTP ${response.status}`);
	}
	const data = await response.json() as GalleryResponse;
	const extension = data.results?.[0]?.extensions?.find(item => item.publisher?.publisherName.toLowerCase() === publisher.toLowerCase() && item.extensionName === name);
	const releases = (extension?.versions ?? []).filter(item =>
		(item.targetPlatform === platform || !item.targetPlatform || item.targetPlatform === 'universal')
		&& !item.properties?.some(property => property.key === 'Microsoft.VisualStudio.Code.PreRelease' && property.value === 'true')
		&& /^\d+\.\d+\.\d+$/.test(item.version)
		&& (requestedVersion === 'latest' || item.version === requestedVersion)
	);
	releases.sort((left, right) => {
		const leftParts = left.version.split('.').map(Number);
		const rightParts = right.version.split('.').map(Number);
		for (let index = 0; index < 3; index++) {
			if (leftParts[index] !== rightParts[index]) {
				return rightParts[index] - leftParts[index];
			}
		}
		return Number(right.targetPlatform === platform) - Number(left.targetPlatform === platform);
	});
	const release = releases[0];
	if (!release) {
		throw new Error(`No stable package found for ${id}@${requestedVersion} / ${platform}`);
	}
	if (release.version === installedVersion) {
		console.log(`${id}@${release.version} is already installed.`);
	} else {
		const checksum = release.properties?.find(item => item.key === 'Microsoft.VisualStudio.Services.VsixSha256')?.value;
		const url = release.files?.find(item => item.assetType === 'Microsoft.VisualStudio.Services.VSIXPackage')?.source;
		if (!url?.startsWith('https://') || !/^[a-f0-9]{64}$/i.test(checksum ?? '')) {
			throw new Error(`No verified package found for ${id}@${release.version} / ${platform}`);
		}
		const download = await fetch(url, { signal: AbortSignal.timeout(120000) });
		if (!download.ok) {
			throw new Error(`Extension download returned HTTP ${download.status}`);
		}
		const bytes = Buffer.from(await download.arrayBuffer());
		if (createHash('sha256').update(bytes).digest('hex') !== checksum!.toLowerCase()) {
			throw new Error(`${id} VSIX SHA-256 mismatch`);
		}
		writeFileSync(destination, bytes);
		console.log(`${id} VSIX SHA-256 verified (${release.version}, ${release.targetPlatform ?? 'universal'}).`);
	}
} catch (error) {
	console.error(`Official extension download failed: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
}
