# Simple workspace contribution

A reversible presentation layer for a document-first Code – OSS fork. Enable it with
`workbench.simpleUI.enabled` or `workbench.simpleUI.toggle`. It defaults to on for a new profile. A user setting of false still wins.

## Integration boundary

- `common/simpleUI.ts`: temporary configuration overrides. Uses the memory target,
  preserving user/workspace settings and newer overrides owned by other features.
- `browser/simpleUILabels.ts`: localizable labels and explanations. Labels can be
  overridden through `workbench.simpleUI.labels`; tooltips are centralized in this file.
- `browser/simpleUI.contribution.ts`: settings, welcome views, actions and layout restoration.
- `test/common/simpleUI.test.ts`: restoration, changes during simple mode and repeated cycles.
- One import in `workbench.common.main.ts`, one small title hook in `explorerViewlet.ts`,
  the translation resource entry in `build/lib/i18n.resources.json`, and small visibility
  conditions for Run and Debug and the integrated Chat view.

The contribution uses existing layout, view, editor, configuration and extension services.
It does not remove developer infrastructure or patch third-party extensions.
Codex (`openai.chatgpt`) and Claude Code (`anthropic.claude-code`) are presets whose
active conversation containers are opened in the auxiliary sidebar. Claude's primary
and secondary sidebar views are distinguished from its session-list container.
GitHub Copilot is an explicit preset that opens the built-in Chat container; the Chat
views are inactive in simple mode while another assistant is selected.
Missing extensions get a welcome view, a catalog search and a VSIX install action.

Layout state is stored under the contribution's own workspace key
`workbench.simpleUI.layout.v1` and survives window reloads. On leaving the mode, original
container locations, visible containers, panels and hidden Explorer views are restored.
Editor preferences use a temporary memory layer. The setting itself is application scoped.

Markdown preview and the visual editor reuse the built-in Markdown extension. The visual
editor works with saved Markdown files. The standard interface remains available from Files, the title bar, the Activity Bar settings menu, and the command palette. Welcome buttons use native hover behavior;
the action picker also exposes explanations to keyboard users.

## Verification

After installing the browser dependencies with the root README's helper:

```sh
npm run build-fast -- --client-only
node test/unit/node/index.js --run out/vs/workbench/contrib/simpleUI/test/common/simpleUI.test.js
node node_modules/eslint/bin/eslint.js --no-cache --max-warnings 0 src/vs/workbench/contrib/simpleUI src/vs/workbench/contrib/files/browser/explorerViewlet.ts
```

For changes to service interactions, also run `npm run typecheck-client`.

Manual acceptance: fresh profile; enable; open folder; create/edit/save Markdown; preview;
hover explanations; reload while enabled; restore standard mode; re-enable; verify
existing settings survive. Test desktop Codex installation, sign-in and a real task separately.
Browser smoke checks cannot establish desktop extension compatibility. The fork configures Open VSX in `product.json`; the browser demo copies that gallery setting into ignored `product.overrides.json`. Microsoft Visual Studio Marketplace is not bundled.

## Remaining product work

- Validate official Codex compatibility and distribution/update route on target platforms.
- Verify the workflow templates against the supplied ICM guide.
- Package desktop builds and test keyboard navigation, screen readers, high contrast and narrow windows.
- Further simplify upstream Explorer menus, empty-editor startup content and extension-owned UI.
- Verify Claude Code account sign-in and a real agent task on the target deployment.

The browser demo uses an explicit starter example. The Docker deployment can seed
an external template into a new `Beispiel-Projekt` directory without replacing
existing user files; see the deployment README.

## Mobile prototype

`workbench.simpleUI.mobileLayout` defaults to `auto` (enter below 768 CSS pixels,
leave at 800); `on` forces one screen and `off` retains desktop presentation.
The preference is machine-scoped. `browser/mobile/simpleMobileLayout.ts` owns the
navigation and screen selection, using the existing view/editor services. Its own
workspace key `workbench.simpleUI.mobileScreen.v1` remembers the last screen.
Explicit editor-opening events switch to Document after user interaction; startup
restoration and events marked non-explicit do not override the chosen screen.

The optional `IWorkbenchLayoutService.setSinglePartLayout` capability is the core
integration boundary, implemented in `workbench/browser/layout.ts`. It temporarily
changes grid visibility and reserves navigation/keyboard space. It suppresses the
desktop editor/panel visibility invariant during that presentation, retains a snapshot,
and preserves desktop sizes when saving state. The mobile controller supplies the last
wide-window pane sizes because the grid can shrink before a window resize is delivered.
Leaving mobile mode restores the snapshot before Simple UI restores standard mode.
Other workbench hosts without this capability do not activate this contribution.

After an upstream merge, specifically review grid visibility notifications, the
editor auto-reveal listener, layout sizing and persistence, and sidebar maximization.
Do not add dependencies from Workbench to the separate Sessions mobile workbench.

For the repeatable English browser-demo smoke (requires Playwright Chromium installed):

```sh
npm run build-fast -- --client-only
node scripts/code-web.js examples/icm-starter --host localhost --port 32190 --browserType none
# In another terminal:
node scripts/test-simple-mobile.mts
```

The smoke uses a fresh browser profile and does not save changes to the sample files.
It checks navigation, text retention, widths, desktop pane-size restoration, standard
mode, reload, file opening, Markdown preview, Search and Settings. Normal asynchronous
workbench storage is allowed to flush before the reload assertion.

Actual iOS/Android keyboards, accessibility, authenticated Codex/Claude tasks, webview
draft retention, network interruption and multiple editor groups remain unverified.
The mobile prototype does not resize virtualized Explorer rows using CSS and does not
patch third-party webviews. See the root mobile plan for the remaining milestones.
