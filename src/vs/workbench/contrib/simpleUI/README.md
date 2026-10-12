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
  and the translation resource entry in `build/lib/i18n.resources.json`.

The contribution uses existing layout, view, editor, configuration and extension services.
It does not remove developer infrastructure or patch third-party extensions. Codex is
identified by the publisher extension ID `openai.chatgpt`; its registered view container
is moved into the auxiliary sidebar. Missing Codex gets a welcome view, an Open VSX catalog search, and a VSIX install action.

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
- Add Claude Code only after the Codex path is validated.

The starter folder is an explicit example, never automatically written into a user's folder.
