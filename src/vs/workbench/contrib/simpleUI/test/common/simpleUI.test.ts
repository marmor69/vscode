/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConfigurationTarget, IConfigurationOverrides, IConfigurationService, IConfigurationUpdateOverrides, IConfigurationValue } from '../../../../../platform/configuration/common/configuration.js';
import { SimpleUISettings } from '../../common/simpleUI.js';

type SettingValue = string | number | boolean | undefined;

class ConfigurationService extends mock<IConfigurationService>() {
	readonly memory = new Map<string, SettingValue>();
	readonly user = new Map<string, SettingValue>([['editor.fontSize', 13], ['editor.wordWrap', 'off']]);

	override inspect<T>(key: string): IConfigurationValue<T> {
		return { memoryValue: this.memory.get(key) as T, userValue: this.user.get(key) as T };
	}

	override async updateValue(key: string, value: SettingValue, target?: ConfigurationTarget | IConfigurationOverrides | IConfigurationUpdateOverrides): Promise<void> {
		assert.strictEqual(target, ConfigurationTarget.MEMORY, 'The simple mode must never write user settings');
		if (value === undefined) {
			this.memory.delete(key);
		} else {
			this.memory.set(key, value);
		}
	}
}

suite('Simple UI settings', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('restores temporary settings without losing user edits made while enabled', async () => {
		const configuration = new ConfigurationService();
		configuration.memory.set('editor.fontSize', 18);
		const settings = new SimpleUISettings(configuration);
		await settings.enable();
		assert.strictEqual(configuration.memory.get('editor.wordWrap'), 'on');
		configuration.user.set('editor.wordWrap', 'bounded');
		await settings.disable();
		assert.deepStrictEqual({ memory: [...configuration.memory], user: [...configuration.user] }, {
			memory: [['editor.fontSize', 18]], user: [['editor.fontSize', 13], ['editor.wordWrap', 'bounded']],
		});
	});

	test('repeated enabling preserves the original settings', async () => {
		const configuration = new ConfigurationService();
		const settings = new SimpleUISettings(configuration);
		await settings.enable();
		await settings.enable();
		await settings.disable();
		assert.strictEqual(configuration.memory.size, 0);
	});

	test('does not replace a newer temporary setting owned by another feature', async () => {
		const configuration = new ConfigurationService();
		const settings = new SimpleUISettings(configuration);
		await settings.enable();
		configuration.memory.set('editor.fontSize', 20);
		await settings.disable();
		assert.deepStrictEqual([...configuration.memory], [['editor.fontSize', 20]]);
	});

	test('a second mode cycle captures the current baseline', async () => {
		const configuration = new ConfigurationService();
		const settings = new SimpleUISettings(configuration);
		await settings.enable();
		await settings.disable();
		configuration.memory.set('editor.lineNumbers', 'relative');
		await settings.enable();
		await settings.disable();
		assert.deepStrictEqual([...configuration.memory], [['editor.lineNumbers', 'relative']]);
	});
});
