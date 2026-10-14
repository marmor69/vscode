/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Run against the English browser demo mounting examples/icm-starter, not a user's workspace.
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));

async function command(label: string): Promise<void> {
	await page.keyboard.press('F1');
	await page.locator('.quick-input-widget input').fill(`>${label}`);
	await expect(page.locator('.quick-input-list .monaco-list-row.focused')).toContainText(label);
	await page.keyboard.press('Enter');
	await expect(page.locator('.quick-input-widget')).toBeHidden();
}

async function visibleParts(): Promise<string[]> {
	return page.locator('.part').evaluateAll(nodes => nodes.filter(node => {
		const bounds = node.getBoundingClientRect();
		return node.id.startsWith('workbench.parts.') && bounds.width > 0 && bounds.height > 0 && getComputedStyle(node).visibility !== 'hidden';
	}).map(node => node.id));
}

async function screen(name: string, part: string): Promise<void> {
	await page.getByRole('button', { name, exact: true }).click();
	await expect.poll(visibleParts).toEqual([`workbench.parts.${part}`]);
}

async function more(label: string): Promise<void> {
	await page.getByRole('button', { name: 'More', exact: true }).click();
	await page.locator('.quick-input-widget input').fill(label);
	await expect(page.locator('.quick-input-list .monaco-list-row.focused')).toContainText(label);
	await page.keyboard.press('Enter');
	await expect(page.locator('.quick-input-widget')).toBeHidden();
}

try {
	await page.goto(process.argv[2] ?? 'http://localhost:32190');
	await expect(page.locator('.simple-mobile-navigation')).toBeAttached({ timeout: 60_000 });
	await expect.poll(visibleParts, { timeout: 60_000 }).toEqual(expect.arrayContaining(['workbench.parts.sidebar', 'workbench.parts.auxiliarybar']));
	const paneWidths = () => page.locator('[id="workbench.parts.sidebar"], [id="workbench.parts.auxiliarybar"]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
	const desktopWidths = await paneWidths();
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(page.locator('.simple-mobile-navigation')).toBeVisible();
	await screen('Files', 'sidebar');
	await screen('Assistant · Codex', 'auxiliarybar');
	await screen('Document', 'editor');
	await command('New Markdown Document');
	await page.locator('.monaco-editor .native-edit-context, .monaco-editor textarea.inputarea').filter({ visible: true }).first().focus();
	await page.keyboard.type('Mobile text survives screen changes');
	await expect(page.locator('.view-lines')).toContainText('Mobile text survives screen changes');
	await screen('Files', 'sidebar');
	await screen('Document', 'editor');
	await expect(page.locator('.view-lines')).toContainText('Mobile text survives screen changes');

	for (const width of [320, 360, 430, 767, 790]) {
		await page.setViewportSize({ width, height: 844 });
		await expect.poll(visibleParts).toEqual(['workbench.parts.editor']);
		await expect.poll(async () => (await page.locator('[id="workbench.parts.editor"]').boundingBox())!.width).toBeLessThanOrEqual(width + 1);
	}
	await page.setViewportSize({ width: 1440, height: 900 });
	await expect(page.locator('.simple-mobile-navigation')).toBeHidden();
	await expect.poll(visibleParts).toEqual(expect.arrayContaining(['workbench.parts.editor', 'workbench.parts.sidebar', 'workbench.parts.auxiliarybar', 'workbench.parts.activitybar']));
	await expect.poll(paneWidths).toEqual(desktopWidths);
	await page.setViewportSize({ width: 390, height: 844 });
	await expect.poll(visibleParts).toEqual(['workbench.parts.editor']);
	await command('Standard Interface');
	await expect(page.locator('.simple-mobile-navigation')).toBeHidden();
	await command('Simple Workspace');
	await expect(page.locator('.simple-mobile-navigation')).toBeVisible();
	await screen('Files', 'sidebar');
	// Workbench storage flushes asynchronously. Allow the normal write before reloading.
	await page.waitForTimeout(1500);
	await page.reload();
	await expect(page.locator('.simple-mobile-navigation')).toBeVisible({ timeout: 60_000 });
	await expect.poll(visibleParts).toEqual(['workbench.parts.sidebar']);
	await page.getByText('START.md', { exact: true }).dblclick();
	await expect.poll(visibleParts).toEqual(['workbench.parts.editor']);
	await command('Open Markdown Live Preview');
	await expect(page.getByRole('tab', { name: /Preview START.md/ })).toBeVisible();
	await expect.poll(visibleParts).toEqual(['workbench.parts.editor']);
	await more('Search');
	await expect.poll(visibleParts).toEqual(['workbench.parts.sidebar']);
	await expect(page.getByRole('textbox', { name: /^Search: Type Search Term/ })).toBeVisible();
	await page.setViewportSize({ width: 430, height: 844 });
	await expect(page.getByRole('textbox', { name: /^Search: Type Search Term/ })).toBeVisible();
	await more('Settings');
	await expect.poll(visibleParts).toEqual(['workbench.parts.editor']);
	assert.deepStrictEqual(errors, [], 'No uncaught browser errors');
	console.log('Mobile smoke passed: navigation, text retention, viewport sizes, desktop restoration, standard mode, reload, file opening, preview, search and settings.');
} finally {
	await browser.close();
}
