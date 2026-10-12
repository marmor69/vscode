/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Sequencer } from '../../../../base/common/async.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { ConfigurationTarget, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ConfigurationScope, Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IViewContainersRegistry, IViewDescriptorService, IViewsRegistry, Extensions as ViewExtensions, ViewContainerLocation } from '../../../common/views.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { VIEW_CONTAINER } from '../../files/browser/explorerViewlet.js';
import { SIMPLE_UI_AGENT, SIMPLE_UI_ENABLED, SIMPLE_UI_LABELS, SimpleUISettings } from '../common/simpleUI.js';
import { simpleUIHint, simpleUILabel, simpleUILabelKeys, SimpleUILabel } from './simpleUILabels.js';
import { mainWindow } from '../../../../base/browser/window.js';

const enabled = ContextKeyExpr.equals(`config.${SIMPLE_UI_ENABLED}`, true);
const filesViewId = 'workbench.simpleUI.files';
const assistantId = 'workbench.simpleUI.assistant';
const snapshotKey = 'workbench.simpleUI.layout.v1';

const agents = [
	{ id: 'openai.chatgpt', label: 'Codex' },
] as const;

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'simpleUI',
	title: localize('simpleUI.configuration', "Simple Workspace"),
	order: 7,
	type: 'object',
	properties: {
		[SIMPLE_UI_ENABLED]: {
			type: 'boolean', default: true, scope: ConfigurationScope.APPLICATION,
			description: localize('simpleUI.enabled.description', "Use a simplified workspace for documents, files, and an AI assistant. Turn off to restore your previous interface."),
		},
		[SIMPLE_UI_AGENT]: {
			type: 'string', enum: agents.map(agent => agent.id), enumItemLabels: agents.map(agent => agent.label),
			default: agents[0].id, scope: ConfigurationScope.APPLICATION,
			description: localize('simpleUI.agent.description', "The official assistant extension to open in the right sidebar. Install and sign in to the extension separately."),
		},
		[SIMPLE_UI_LABELS]: {
			type: 'object', default: {}, scope: ConfigurationScope.APPLICATION,
			additionalProperties: false,
			properties: Object.fromEntries(simpleUILabelKeys.map(key => [key, { type: 'string', minLength: 1 }])),
			description: localize('simpleUI.labels.description', "Override simple workspace labels by name. Omitted labels use the current language. This does not change text inside extensions."),
		},
	},
});

class SimpleWelcomeView extends ViewPane {
	override shouldShowWelcome(): boolean { return true; }
	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		if (this.id === filesViewId) {
			// Keep document actions compact so the folder tree has the remaining space.
			this.maximumBodySize = 240;
		}
		const updateTitle = () => this.updateTitle(simpleUILabel(this.configurationService, this.id === filesViewId ? 'files' : 'assistant'));
		updateTitle();
		this._register(this.configurationService.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(SIMPLE_UI_LABELS)) {
				updateTitle();
			}
		}));
	}
}

const assistantContainer = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).registerViewContainer({
	id: assistantId,
	title: localize2('simpleUI.assistantTitle', "Assistant"),
	icon: Codicon.commentDiscussion,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [assistantId, { mergeViewWithContainerWhenSingleView: true }]),
	hideIfEmpty: true,
}, ViewContainerLocation.AuxiliaryBar);

const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: filesViewId,
	name: localize2('simpleUI.filesTitle', "Files"),
	ctorDescriptor: new SyncDescriptor(SimpleWelcomeView),
	when: enabled, order: -100, canToggleVisibility: false, canMoveView: false,
	weight: 1,
}], VIEW_CONTAINER);
viewsRegistry.registerViews([{
	id: assistantId,
	name: localize2('simpleUI.assistantTitle', "Assistant"),
	ctorDescriptor: new SyncDescriptor(SimpleWelcomeView),
	when: enabled, canToggleVisibility: false, canMoveView: false,
}], assistantContainer);

interface LayoutSnapshot {
	readonly parts: { part: Parts; visible: boolean }[];
	readonly containers: { id: string; location: ViewContainerLocation; index: number }[];
	readonly visibleContainers: string[];
	readonly hiddenViews: string[];
}

class SimpleUIContribution extends Disposable {
	static readonly ID = 'workbench.contrib.simpleUI';
	private readonly sequencer = new Sequencer();
	private readonly welcome = this._register(new DisposableStore());
	private readonly settings: SimpleUISettings;
	private snapshot: LayoutSnapshot | undefined;
	private active = false;
	private disposed = false;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IViewDescriptorService private readonly viewDescriptorService: IViewDescriptorService,
		@IViewsService private readonly viewsService: IViewsService,
		@IStorageService private readonly storageService: IStorageService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();
		this.settings = new SimpleUISettings(configurationService);
		this.snapshot = storageService.getObject<LayoutSnapshot>(snapshotKey, StorageScope.WORKSPACE);
		this.updateWelcome();
		this._register(configurationService.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(SIMPLE_UI_LABELS)) {
				this.updateWelcome();
			}
			if (event.affectsConfiguration(SIMPLE_UI_ENABLED) || event.affectsConfiguration(SIMPLE_UI_AGENT)) {
				this.update();
			}
		}));
		this._register(extensionService.onDidChangeExtensions(() => this.update()));
		this._register(CommandsRegistry.registerCommand('workbench.simpleUI.openAgent', () => this.sequencer.queue(async () => {
			if (this.active && !this.disposed) {
				await this.openAgent();
			}
		})));
		this.update();
	}

	private updateWelcome(): void {
		this.welcome.clear();
		// Welcome content uses the linked-text parser, not a full Markdown renderer.
		const text = (value: string) => value.replace(/[\r\n]+/g, ' ').replace(/\[/g, '\uFF3B').replace(/\]/g, '\uFF3D');
		const link = (label: SimpleUILabel, command: string) => {
			const caption = text(simpleUILabel(this.configurationService, label));
			// The welcome button also uses its tooltip as its accessible name.
			const explanation = localize('simpleUI.buttonExplanation', "{0}: {1}", caption, simpleUIHint(label) ?? '');
			return `[${caption}](command:${command} "${explanation.replace(/"/g, '\u0027')}")`;
		};
		this.welcome.add(viewsRegistry.registerViewWelcomeContent(filesViewId, {
			content: [
				link('newDocument', 'workbench.simpleUI.newDocument'),
				link('openFolder', 'workbench.action.files.openFolder'),
				link('more', 'workbench.simpleUI.more'),
				link('standardUI', 'workbench.simpleUI.standard'),
			].join('\n'),
			renderSecondaryButtons: true,
		}));
		this.welcome.add(viewsRegistry.registerViewWelcomeContent(assistantId, {
			content: `${text(simpleUILabel(this.configurationService, 'assistantHelp'))}\n${link('chooseAgent', 'workbench.simpleUI.chooseAgent')}\n${link('installExtension', 'workbench.extensions.action.installVSIX')}`,
		}));
	}

	private update(): void {
		void this.sequencer.queue(async () => {
			await this.extensionService.whenInstalledExtensionsRegistered();
			if (this.disposed) {
				return;
			}
			if (this.configurationService.getValue<boolean>(SIMPLE_UI_ENABLED)) {
				await this.enable();
			} else {
				await this.disable();
			}
		}).catch(error => this.notificationService.error(error));
	}

	private saveSnapshot(): void {
		if (this.snapshot) {
			this.storageService.store(snapshotKey, this.snapshot, StorageScope.WORKSPACE, StorageTarget.MACHINE);
		}
	}

	private async enable(): Promise<void> {
		if (!this.active) {
			this.snapshot ??= {
				parts: [Parts.SIDEBAR_PART, Parts.AUXILIARYBAR_PART, Parts.PANEL_PART].map(part => ({ part, visible: this.layoutService.isVisible(part, mainWindow) })),
				containers: [],
				visibleContainers: [ViewContainerLocation.Sidebar, ViewContainerLocation.AuxiliaryBar, ViewContainerLocation.Panel]
					.map(location => this.viewsService.getVisibleViewContainer(location)?.id).filter((id): id is string => !!id),
				hiddenViews: [],
			};
			this.saveSnapshot();
			await this.settings.enable();
			this.active = true;
			this.moveContainer(VIEW_CONTAINER.id, ViewContainerLocation.Sidebar);
			const model = this.viewDescriptorService.getViewContainerModel(VIEW_CONTAINER);
			for (const id of ['outline', 'timeline']) {
				if (model.allViewDescriptors.some(view => view.id === id) && model.isVisible(id)) {
					if (!this.snapshot.hiddenViews.includes(id)) {
						this.snapshot.hiddenViews.push(id);
						this.saveSnapshot();
					}
					model.setVisible(id, false);
				}
			}
			this.layoutService.setPartHidden(true, Parts.PANEL_PART);
			await this.viewsService.openViewContainer(VIEW_CONTAINER.id, false);
		}
		await this.openAgent();
	}

	private moveContainer(id: string, location: ViewContainerLocation): void {
		const container = this.viewDescriptorService.getViewContainerById(id);
		if (!container || !this.snapshot) {
			return;
		}
		const previous = this.viewDescriptorService.getViewContainerLocation(container);
		if (previous !== location && previous !== null) {
			if (!this.snapshot.containers.some(entry => entry.id === id)) {
				this.snapshot.containers.push({ id, location: previous, index: this.viewDescriptorService.getViewContainersByLocation(previous).indexOf(container) });
				this.saveSnapshot();
			}
			this.viewDescriptorService.moveViewContainerToLocation(container, location, undefined, 'simpleUI');
		}
	}

	private async openAgent(): Promise<void> {
		const agentId = this.configurationService.getValue<string>(SIMPLE_UI_AGENT);
		const container = this.viewDescriptorService.viewContainers.find(container => container.extensionId?.value.toLowerCase() === agentId);
		if (container) {
			this.moveContainer(container.id, ViewContainerLocation.AuxiliaryBar);
			await this.viewsService.openViewContainer(container.id, false);
		} else {
			await this.viewsService.openViewContainer(assistantId, false);
		}
	}

	private async disable(): Promise<void> {
		await this.settings.disable();
		this.active = false;
		if (!this.snapshot) {
			return;
		}
		for (const { id, location, index } of this.snapshot.containers) {
			const container = this.viewDescriptorService.getViewContainerById(id);
			if (container) {
				this.viewDescriptorService.moveViewContainerToLocation(container, location, index, 'simpleUI.restore');
			}
		}
		for (const id of this.snapshot.hiddenViews) {
			const container = this.viewDescriptorService.getViewContainerByViewId(id);
			if (container) {
				this.viewDescriptorService.getViewContainerModel(container).setVisible(id, true);
			}
		}
		for (const id of this.snapshot.visibleContainers) {
			if (this.viewDescriptorService.getViewContainerById(id)) {
				await this.viewsService.openViewContainer(id, false);
			}
		}
		for (const { part, visible } of this.snapshot.parts) {
			this.layoutService.setPartHidden(!visible, part);
		}
		this.snapshot = undefined;
		this.storageService.remove(snapshotKey, StorageScope.WORKSPACE);
	}

	override dispose(): void {
		this.disposed = true;
		super.dispose();
	}
}

registerWorkbenchContribution2(SimpleUIContribution.ID, SimpleUIContribution, WorkbenchPhase.AfterRestored);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.simpleUI.showFiles', title: localize2('simpleUI.showFiles', "Show Files"), f1: true,
			icon: Codicon.files, precondition: enabled,
			menu: [
				{ id: MenuId.TitleBar, when: enabled, group: 'navigation', order: 1 },
				{ id: MenuId.EditorTitle, when: enabled, group: 'navigation', order: 1 },
			],
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IViewsService).openViewContainer(VIEW_CONTAINER.id, true);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.simpleUI.simple', title: localize2('simpleUI.simple.action', "Simple Workspace"),
			f1: true, icon: Codicon.layout, precondition: enabled.negate(),
			menu: [
				{ id: MenuId.TitleBar, when: enabled.negate(), group: 'navigation', order: 0 },
				{ id: MenuId.GlobalActivity, when: enabled.negate(), group: '2_configuration', order: 0 },
			],
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IConfigurationService).updateValue(SIMPLE_UI_ENABLED, true, ConfigurationTarget.USER);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.simpleUI.toggle', title: localize2('simpleUI.toggle', "Toggle Simple Workspace"),
			f1: true, icon: Codicon.layout, toggled: enabled,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const configuration = accessor.get(IConfigurationService);
		await configuration.updateValue(SIMPLE_UI_ENABLED, !configuration.getValue<boolean>(SIMPLE_UI_ENABLED), ConfigurationTarget.USER);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.simpleUI.standard', title: localize2('simpleUI.standard.action', "Standard Interface"),
			f1: true, icon: Codicon.layout, precondition: enabled,
			menu: [
				{ id: MenuId.TitleBar, when: enabled, group: 'navigation', order: 0 },
				{ id: MenuId.GlobalActivity, when: enabled, group: '2_configuration', order: 0 },
			],
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IConfigurationService).updateValue(SIMPLE_UI_ENABLED, false, ConfigurationTarget.USER);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: 'workbench.simpleUI.newDocument', title: localize2('simpleUI.newDocument.action', "New Markdown Document"), f1: true, precondition: enabled });
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IEditorService).openEditor({ resource: undefined, contents: '', languageId: 'markdown', options: { pinned: true } });
	}
});

for (const [id, title, command, editorId] of [
	['preview', localize2('simpleUI.preview.action', "Open Markdown Live Preview"), 'markdown.showPreviewToSide', undefined],
	['visualEditor', localize2('simpleUI.visualEditor.action', "Open Visual Markdown Editor"), 'reopenActiveEditorWith', 'vscode.markdown.editor'],
	['textEditor', localize2('simpleUI.textEditor.action', "Open Text Editor"), 'reopenActiveEditorWith', 'default'],
] as const) {
	registerAction2(class extends Action2 {
		constructor() {
			super({ id: `workbench.simpleUI.${id}`, title, f1: true, precondition: enabled });
		}
		async run(accessor: ServicesAccessor): Promise<void> {
			const commands = accessor.get(ICommandService);
			const editor = accessor.get(IEditorService).activeEditor;
			if (!editor) {
				accessor.get(INotificationService).info(localize('simpleUI.openDocumentFirst', "Open a document first."));
				return;
			}
			await commands.executeCommand(command, ...(editorId ? [editorId] : []));
		}
	});
}

registerAction2(class extends Action2 {
	constructor() {
		super({ id: 'workbench.simpleUI.chooseAgent', title: localize2('simpleUI.chooseAgent.action', "Choose Assistant"), f1: true, precondition: enabled });
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const extensions = accessor.get(IExtensionService);
		const quickInput = accessor.get(IQuickInputService);
		const configuration = accessor.get(IConfigurationService);
		const commands = accessor.get(ICommandService);
		const notifications = accessor.get(INotificationService);
		await extensions.whenInstalledExtensionsRegistered();
		const selected = await quickInput.pick(agents.map(agent => ({
			...agent,
			installed: extensions.extensions.some(extension => extension.identifier.value.toLowerCase() === agent.id),
			description: extensions.extensions.some(extension => extension.identifier.value.toLowerCase() === agent.id)
				? localize('simpleUI.installed', "Installed") : localize('simpleUI.installRequired', "Installation Required"),
		})), { placeHolder: localize('simpleUI.agentPlaceholder', "Choose your assistant") });
		if (!selected) {
			return;
		}
		await configuration.updateValue(SIMPLE_UI_AGENT, selected.id, ConfigurationTarget.USER);
		if (!selected.installed) {
			notifications.info(localize('simpleUI.installAgent', "Install the official {0} extension from Extensions, then choose it here. You can also install a publisher-provided VSIX file.", selected.label));
			await commands.executeCommand('workbench.extensions.search', selected.label);
		} else {
			await commands.executeCommand('workbench.simpleUI.openAgent');
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({ id: 'workbench.simpleUI.more', title: localize2('simpleUI.more.action', "Document and Workspace Actions"), f1: true, precondition: enabled });
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const configuration = accessor.get(IConfigurationService);
		const commands = accessor.get(ICommandService);
		const actions: [SimpleUILabel, string][] = [
			['save', 'workbench.action.files.save'],
			['preview', 'workbench.simpleUI.preview'],
			['visualEditor', 'workbench.simpleUI.visualEditor'],
			['textEditor', 'workbench.simpleUI.textEditor'],
			['chooseAgent', 'workbench.simpleUI.chooseAgent'],
			['installExtension', 'workbench.extensions.action.installVSIX'],
			['extensions', 'workbench.view.extensions'],
			['settings', 'workbench.action.openSettings'],
			['standardUI', 'workbench.simpleUI.standard'],
		];
		const selected = await accessor.get(IQuickInputService).pick(actions.map(([label, command]) => ({ label: simpleUILabel(configuration, label), detail: simpleUIHint(label), command })), {
			placeHolder: simpleUILabel(configuration, 'more'),
		});
		if (selected) {
			await commands.executeCommand(selected.command);
		}
	}
});
