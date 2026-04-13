# CLAUDE.md

## Project

**Page Rec** — a standalone Chrome extension (MV3, Side Panel) that records user interactions on any web page and exports them as Playwright test scripts. Users click the extension icon, record on any https page, edit the steps, then Copy Code or Download `.spec.js`. Zero backend, zero localhost, zero network dependencies.

**Core value:** One-click capture of real browser interactions → runnable Playwright tests.

See @README.md for user install + usage.
See @docs/ARCHITECTURE.md for extension internals (message protocol, storage, content script lifecycle).
See @DESIGN.md for the v2.0 UI/UX SSOT (tokens, components, light/dark mode).

## Active vs dormant code

- **`extension/`** — production Chrome extension. ALL active work happens here.
- **`scripts/build-extension.sh`** — builds the Chrome Web Store zip into `dist/`.
- **`src/`, `bin/`** — DORMANT legacy CLI from the pre-standalone era. Not wired to anything. Guarded by `.claude/rules/legacy.md` — do not edit. Will be rebuilt as an AI-agent tool in a later milestone.

## Build & sanity-check

```bash
# Build Chrome Web Store zip (uses extension/manifest.json version)
npm run build:extension            # → dist/page-rec-extension-v<version>.zip

# Syntax-check all extension JS
export PATH="$HOME/.nvm/versions/node/v24.13.1/bin:$PATH"
for f in extension/*.js; do node --check "$f" || exit 1; done

# Validate manifest
python3 -c "import json; json.load(open('extension/manifest.json'))"
```

No unit tests for extension code yet. Legacy tests at `src/*.test.js` have 2 known pre-existing failures (out of scope — see `.claude/rules/legacy.md`).

## Dev loop

1. Edit in `extension/`
2. `chrome://extensions` → reload icon on the Page Rec card
3. Close & reopen the side panel (or hard-refresh any page using it)
4. Smoke test: icon → Start → interact → Stop → Copy Code

## Environment

- **Node**: 20+ (build scripts only — extension runtime has no Node dependency)
- **Chrome**: 114+ (Side Panel API)
- **nvm users (macOS)**: prefix Node/npm commands with `export PATH="$HOME/.nvm/versions/node/v24.13.1/bin:$PATH"`

## Gotchas (load-bearing, non-obvious)

- **MV3 service worker restarts are normal.** The side panel's keepalive port auto-reconnects silently. A keepalive disconnect is NOT a "stop recording" signal.
- **Content script re-injection is load-bearing.** `background.js` re-runs `executeScript` on every full-page navigation (`changeInfo.status === 'complete'` + `activeTabId` match). Removing this listener silently breaks multi-page recording. The re-injection branch must **not** overwrite `chrome.storage.session.config` — `startedAt` is the elapsed-time baseline.
- **No auto-download on Stop.** User explicitly exports via Copy Code / Download .spec.js. Stop only persists to `chrome.storage.local`.
- **`extension/content.js` has dead `__rec=` code.** Unreachable since the standalone refactor. Do not clean up mid-feature — it's on the do-not-touch list for a dedicated sweep later.
- **`src/export.js` and `extension/export.js` have diverged.** `extension/export.js` is authoritative. Do not sync them.

## UI/UX changes

Scoped rules live in @.claude/rules/extension.md — read that before editing `extension/*.css|html|js`. Hard rules: design tokens via CSS variables only, max 4px button radius, 2-line clamp on list items, no new npm deps.

## GSD workflow

Before file changes, route through a GSD command:
- `/gsd:quick` — small fixes, doc updates, ad-hoc tasks
- `/gsd:debug` — investigation, bug fixing
- `/gsd:execute-phase` — planned multi-step work

Do not bypass unless the user explicitly says "just do it" or "direct edit".

## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate.
