/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfigurationTarget, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';

export const SIMPLE_UI_ENABLED = 'workbench.simpleUI.enabled';
export const SIMPLE_UI_LABELS = 'workbench.simpleUI.labels';
export const SIMPLE_UI_AGENT = 'workbench.simpleUI.agent';

type SettingValue = string | number | boolean;

const settings: Readonly<Record<string, SettingValue>> = {
	'workbench.activityBar.location': 'default',
	'workbench.statusBar.visible': false,
	'workbench.sideBar.location': 'left',
	'workbench.layoutControl.enabled': false,
	'window.commandCenter': false,
	'window.menuBarVisibility': 'compact',
	'editor.minimap.enabled': false,
	'editor.lineNumbers': 'off',
	'editor.glyphMargin': false,
	'editor.folding': false,
	'editor.renderLineHighlight': 'none',
	'editor.wordWrap': 'on',
	'editor.fontSize': 16,
	'editor.quickSuggestions': false,
	'editor.suggestOnTriggerCharacters': false,
	'editor.parameterHints.enabled': false,
	'editor.lightbulb.enabled': 'off',
	'editor.codeLens': false,
	'breadcrumbs.enabled': false,
	'explorer.decorations.badges': false,
	'explorer.decorations.colors': false,
	'explorer.openEditors.visible': 0,
};

/** A temporary layer: user and workspace settings remain editable and survive mode changes. */
export class SimpleUISettings {
	private readonly previous = new Map<string, SettingValue | undefined>();

	constructor(private readonly configurationService: IConfigurationService) { }

	async enable(): Promise<void> {
		for (const [key, value] of Object.entries(settings)) {
			if (!this.previous.has(key)) {
				this.previous.set(key, this.configurationService.inspect<SettingValue>(key).memoryValue);
			}
			await this.configurationService.updateValue(key, value, ConfigurationTarget.MEMORY);
		}
	}

	async disable(): Promise<void> {
		for (const [key, value] of this.previous) {
			// Do not overwrite a newer temporary override owned by another feature.
			if (this.configurationService.inspect<SettingValue>(key).memoryValue === settings[key]) {
				await this.configurationService.updateValue(key, value, ConfigurationTarget.MEMORY);
			}
		}
		this.previous.clear();
	}
}
