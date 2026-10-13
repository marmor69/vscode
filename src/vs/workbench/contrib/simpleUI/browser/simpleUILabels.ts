/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { SIMPLE_UI_LABELS } from '../common/simpleUI.js';

/** All labels owned by the simple workspace, with optional user-level overrides. */
const defaultLabels = {
	files: localize('simpleUI.files', "Files"),
	assistant: localize('simpleUI.assistant', "Assistant"),
	newDocument: localize('simpleUI.newDocument', "New Document"),
	openFolder: localize('simpleUI.openFolder', "Open Folder"),
	save: localize('simpleUI.save', "Save"),
	preview: localize('simpleUI.preview', "Live Preview"),
	visualEditor: localize('simpleUI.visualEditor', "Visual Markdown Editor"),
	textEditor: localize('simpleUI.textEditor', "Text Editor"),
	installExtension: localize('simpleUI.installExtension', "Install Extension File…"),
	chooseAgent: localize('simpleUI.chooseAgent', "Choose Assistant"),
	extensions: localize('simpleUI.extensions', "Extensions"),
	settings: localize('simpleUI.settings', "Settings"),
	standardUI: localize('simpleUI.standardUI', "Standard Interface"),
	more: localize('simpleUI.more', "More Actions"),
	assistantHelp: localize('simpleUI.assistantHelp', "Work with your selected assistant in this panel. Open a workflow folder on the left, then tell Codex which instructions and context files to use. Install the official extension and sign in to get started."),
};

export type SimpleUILabel = keyof typeof defaultLabels;

export function simpleUILabel(configurationService: IConfigurationService, key: SimpleUILabel): string {
	const override = configurationService.getValue<Partial<Record<SimpleUILabel, string>>>(SIMPLE_UI_LABELS)?.[key];
	return typeof override === 'string' && override.trim() ? override.trim() : defaultLabels[key];
}

export const simpleUILabelKeys = Object.keys(defaultLabels) as SimpleUILabel[];

/** Explanations shared by hover buttons and keyboard-accessible action details. */
const hints: Partial<Record<SimpleUILabel, string>> = {
	newDocument: localize('simpleUI.hint.newDocument', "Start a text document. Save it with .md at the end of its name to use Markdown formatting."),
	openFolder: localize('simpleUI.hint.openFolder', "Open the folder for one task. Keep its instructions, relevant context, and results together."),
	more: localize('simpleUI.hint.more', "Save your document, preview Markdown, or adjust your workspace."),
	standardUI: localize('simpleUI.hint.standardUI', "Return to the full VS Code interface and restore the previous layout."),
	save: localize('simpleUI.hint.save', "Save changes to the current document."),
	preview: localize('simpleUI.hint.preview', "See formatted Markdown beside your text. The preview updates while you write."),
	visualEditor: localize('simpleUI.hint.visualEditor', "Edit a saved Markdown document with formatting controls."),
	textEditor: localize('simpleUI.hint.textEditor', "Edit the document as plain text, including its Markdown formatting marks."),
	chooseAgent: localize('simpleUI.hint.chooseAgent', "Choose Codex, Claude Code, or GitHub Copilot and open it in the right panel. Sign in inside the selected extension. For Codex on a remote server, choose Use device code to sign in without a localhost callback."),
	installExtension: localize('simpleUI.hint.installExtension', "Select an official extension file (.vsix) downloaded from its publisher."),
	extensions: localize('simpleUI.hint.extensions', "Browse and install extensions from Open VSX, or manage installed extensions."),
	settings: localize('simpleUI.hint.settings', "Change appearance, labels, and other workspace preferences."),
};

export function simpleUIHint(key: SimpleUILabel): string | undefined {
	return hints[key];
}
