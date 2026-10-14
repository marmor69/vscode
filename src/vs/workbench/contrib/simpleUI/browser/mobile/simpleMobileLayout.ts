/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener, EventType } from '../../../../../base/browser/dom.js';
import { IViewSize } from '../../../../../base/browser/ui/grid/grid.js';
import { mainWindow } from '../../../../../base/browser/window.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IViewDescriptorService, ViewContainerLocation } from '../../../../common/views.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IWorkbenchLayoutService, Parts } from '../../../../services/layout/browser/layoutService.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { SIMPLE_UI_AGENT, SIMPLE_UI_ENABLED } from '../../common/simpleUI.js';
import { isSimpleMobileLayout, SIMPLE_UI_MOBILE_LAYOUT } from '../../common/simpleMobileLayout.js';
import './simpleMobileLayout.css';

type Screen = 'files' | 'document' | 'assistant';
const screenKey = 'workbench.simpleUI.mobileScreen.v1';

/** Owns navigation, not editor or extension lifetime. Desktop state belongs to the layout service. */
export class SimpleMobileLayout extends Disposable {
	private readonly navigation: HTMLElement;
	private readonly buttons = new Map<Screen, HTMLButtonElement>();
	private screen: Screen;
	private active = false;
	private updating = false;
	private transientPart: Parts | undefined;
	private userInteracted = false;
	private readonly desktopSizes = new Map<Parts, IViewSize>();
	// The viewport belongs to the host HTML, not to this contribution's DOM.
	// eslint-disable-next-line no-restricted-syntax
	private readonly viewportMeta = mainWindow.document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
	private readonly originalViewport = this.viewportMeta?.content;

	constructor(
		private readonly openAgent: () => Promise<void>,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IViewsService private readonly viewsService: IViewsService,
		@IViewDescriptorService private readonly viewDescriptorService: IViewDescriptorService,
		@IEditorService editorService: IEditorService,
		@ICommandService private readonly commandService: ICommandService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@IStorageService private readonly storageService: IStorageService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();
		const stored = storageService.get(screenKey, StorageScope.WORKSPACE);
		this.screen = stored === 'files' || stored === 'document' || stored === 'assistant' ? stored : editorService.activeEditor?.resource && editorService.activeEditor.resource.scheme !== 'walkThrough' ? 'document' : 'files';
		this.navigation = mainWindow.document.createElement('nav');
		this.navigation.className = 'simple-mobile-navigation';
		this.navigation.setAttribute('aria-label', localize('mobile.navigation', "Workspace Navigation"));
		this.navigation.hidden = true;
		for (const [screen, label] of [
			['files', localize('mobile.files', "Files")],
			['document', localize('mobile.document', "Document")],
			['assistant', localize('mobile.assistant', "Assistant")],
		] as const) {
			const button = this.addButton(label, () => this.select(screen));
			this.buttons.set(screen, button);
		}
		this.addButton(localize('mobile.more', "More"), () => this.more());
		layoutService.mainContainer.append(this.navigation);
		this._register(layoutService.onDidLayoutMainContainer(() => {
			// A narrow desktop grid may already have compressed before resize is
			// dispatched. Retain the last sizes from outside the mobile breakpoint.
			if (!this.active && !this.updating && mainWindow.innerWidth >= 800) {
				this.captureDesktopSizes();
			}
		}));
		// Restored editors may report an explicit activation during startup. Do not
		// let that overwrite the last screen before the user has interacted.
		this._register(addDisposableListener(mainWindow.document, 'pointerdown', () => this.userInteracted = true, true));
		this._register(addDisposableListener(mainWindow.document, EventType.KEY_DOWN, () => this.userInteracted = true, true));
		// Capture before the desktop grid compresses its columns for the new width.
		this._register(addDisposableListener(mainWindow, EventType.RESIZE, () => this.update(), true));
		if (mainWindow.visualViewport) {
			this._register(addDisposableListener(mainWindow.visualViewport, 'resize', () => this.update()));
			this._register(addDisposableListener(mainWindow.visualViewport, 'scroll', () => this.update()));
		}
		this._register(editorService.onDidVisibleEditorsChange(event => {
			if (this.active && this.userInteracted && event.isExplicit && editorService.activeEditor?.resource?.scheme !== 'walkThrough') {
				this.show('document');
			}
		}));
	}

	private addButton(label: string, run: () => Promise<void>): HTMLButtonElement {
		const button = mainWindow.document.createElement('button');
		button.type = 'button';
		button.textContent = label;
		this.navigation.append(button);
		this._register(addDisposableListener(button, EventType.CLICK, () => {
			void run().catch(error => this.notificationService.error(error));
		}));
		return button;
	}

	private captureDesktopSizes(): void {
		for (const part of [Parts.SIDEBAR_PART, Parts.AUXILIARYBAR_PART, Parts.PANEL_PART]) {
			if (this.layoutService.isVisible(part, mainWindow)) {
				this.desktopSizes.set(part, this.layoutService.getSize(part));
			}
		}
	}

	get isActive(): boolean { return this.active; }

	update(): void {
		if (this.updating) {
			return;
		}
		this.updating = true;
		try {
			if (!this.active && mainWindow.innerWidth >= 800) {
				this.captureDesktopSizes();
			}
			const active = !!this.layoutService.setSinglePartLayout
				&& this.configurationService.getValue<boolean>(SIMPLE_UI_ENABLED)
				&& isSimpleMobileLayout(this.configurationService.getValue<string>(SIMPLE_UI_MOBILE_LAYOUT), mainWindow.innerWidth, this.active);
			this.active = active;
			this.navigation.hidden = !active;
			if (this.viewportMeta) {
				const content = active ? 'width=device-width, initial-scale=1.0, viewport-fit=cover' : this.originalViewport ?? '';
				if (this.viewportMeta.content !== content) {
					this.viewportMeta.content = content;
				}
			}
			this.layoutService.mainContainer.classList.toggle('simple-mobile-layout', active);
			if (active) {
				this.render();
			} else {
				this.layoutService.setSinglePartLayout?.(undefined);
			}
		} finally {
			this.updating = false;
		}
	}

	private render(): void {
		const viewport = mainWindow.visualViewport;
		// Pinch zoom changes visualViewport too; do not mistake it for a keyboard.
		const height = viewport && viewport.scale === 1 ? viewport.height : mainWindow.innerHeight;
		this.navigation.style.bottom = `${Math.max(0, mainWindow.innerHeight - height - (viewport?.offsetTop ?? 0))}px`;
		this.layoutService.setSinglePartLayout?.(this.transientPart ?? (this.screen === 'files' ? Parts.SIDEBAR_PART : this.screen === 'document' ? Parts.EDITOR_PART : Parts.AUXILIARYBAR_PART), this.navigation.offsetHeight, height, this.desktopSizes);
		for (const [screen, button] of this.buttons) {
			button.setAttribute('aria-pressed', String(!this.transientPart && screen === this.screen));
		}
		const assistant = this.buttons.get('assistant')!;
		const id = this.configurationService.getValue<string>(SIMPLE_UI_AGENT);
		assistant.textContent = id === 'anthropic.claude-code' ? localize('mobile.claude', "Assistant · Claude")
			: id === 'github.copilot-chat' ? localize('mobile.copilot', "Assistant · Copilot") : localize('mobile.codex', "Assistant · Codex");
	}

	private show(screen: Screen): void {
		this.transientPart = undefined;
		this.screen = screen;
		this.storageService.store(screenKey, screen, StorageScope.WORKSPACE, StorageTarget.MACHINE);
		this.render();
	}

	async select(screen: Screen): Promise<void> {
		if (!this.active) {
			return;
		}
		this.show(screen);
		if (screen === 'files') {
			await this.viewsService.openViewContainer('workbench.view.explorer', false);
		} else if (screen === 'assistant') {
			await this.openAgent();
		}
		// Do not focus a text input just because the user switched screens.
	}

	private async more(): Promise<void> {
		const actions: { label: string; command?: string; container?: string; location?: ViewContainerLocation }[] = [
			{ label: localize('mobile.new', "New Markdown Document"), command: 'workbench.simpleUI.newDocument' },
			{ label: localize('mobile.save', "Save Document"), command: 'workbench.action.files.save' },
			{ label: localize('mobile.documents', "Open Documents"), command: 'workbench.action.showAllEditors' },
			{ label: localize('mobile.preview', "Markdown Live Preview"), command: 'workbench.simpleUI.preview' },
			{ label: localize('mobile.assistants', "Choose Assistant"), command: 'workbench.simpleUI.chooseAgent' },
			{ label: localize('mobile.settings', "Settings"), command: 'workbench.action.openSettings' },
			{ label: localize('mobile.commands', "All Commands"), command: 'workbench.action.showCommands' },
			{ label: localize('mobile.standard', "Standard Interface"), command: 'workbench.simpleUI.standard' },
		];
		for (const container of this.viewDescriptorService.viewContainers) {
			const location = this.viewDescriptorService.getViewContainerLocation(container);
			if (location === null || container.id === 'workbench.view.debug' || !this.viewDescriptorService.getViewContainerModel(container).activeViewDescriptors.length) {
				continue;
			}
			actions.push({ label: typeof container.title === 'string' ? container.title : container.title.value, container: container.id, location });
		}
		const selected = await this.quickInputService.pick(actions, { placeHolder: localize('mobile.actions', "Document and Workspace Actions") });
		if (!selected || !this.active) {
			return;
		}
		if (selected.container) {
			const part = selected.location === ViewContainerLocation.Sidebar ? Parts.SIDEBAR_PART
				: selected.location === ViewContainerLocation.Panel ? Parts.PANEL_PART : Parts.AUXILIARYBAR_PART;
			this.transientPart = part;
			this.render();
			await this.viewsService.openViewContainer(selected.container, false);
		} else if (selected.command) {
			await this.commandService.executeCommand(selected.command);
		}
	}

	override dispose(): void {
		this.layoutService.setSinglePartLayout?.(undefined);
		this.layoutService.mainContainer.classList.remove('simple-mobile-layout');
		this.navigation.remove();
		if (this.viewportMeta) {
			this.viewportMeta.content = this.originalViewport ?? '';
		}
		super.dispose();
	}
}
