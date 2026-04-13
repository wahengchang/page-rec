# Page Rec

Record user interactions on any web page in Chrome, edit the captured steps, and export as Playwright test code — all inside the browser. Zero network, zero CLI, zero build step for users.

## Install

### Chrome Web Store *(coming soon)*

The extension will be published on the Chrome Web Store. Until then, use the unpacked install below.

### Unpacked (from latest release)

1. Download `page-rec-extension-v*.zip` from the [latest release](https://github.com/wahengchang/page-rec/releases/latest).
2. Unzip — you get a folder named `page-rec-extension/`.
3. Open `chrome://extensions` in Google Chrome.
4. Toggle **Developer mode** (top-right).
5. Click **Load unpacked** and pick the `page-rec-extension/` folder.

Requires Google Chrome 114 or later (Side Panel API).

> **Dev shortcut:** If you cloned this repo, point Load unpacked at `extension/` directly — no unzip needed.

## Use

1. Click the **Page Rec** icon in the Chrome toolbar. The Side Panel opens.
2. Navigate to any `https://` page you want to capture.
3. Click **Start recording**. The status dot turns green and pulses.
4. Interact with the page normally — click, type, scroll, navigate. Each event shows up in the **Timeline** live.
5. Click **Stop Recording** when done.
6. Use the **Step editor** tab to polish: drag to reorder, click to edit text, delete unwanted steps, or add free-form notes between steps.
7. Click **Copy Code** to put the Playwright `.spec.js` on your clipboard, or **⬇ .spec.js** to download it as a file.

### Running the exported test

Page Rec does not bundle Playwright — it only generates the `.spec.js` text. To run it in your target project:

```bash
npm install -D @playwright/test
npx playwright install chromium
npx playwright test my-recording.spec.js
```

## Project docs

| Audience | File |
|---|---|
| End user | This file |
| Contributors / AI assistants | [CLAUDE.md](CLAUDE.md) |
| Extension internals deep-dive | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| UI/UX design system | [DESIGN.md](DESIGN.md) |

## Building the release zip (maintainers)

```bash
# 1. Bump version in extension/manifest.json
# 2. Build
npm run build:extension            # → dist/page-rec-extension-v<version>.zip
# 3. Publish
gh release create vX.Y.Z dist/page-rec-extension-vX.Y.Z.zip
```

The `dist/` folder is git-ignored.

## Legacy CLI (dormant)

The `bin/` and `src/` folders contain a pre-standalone Node CLI that drove recording via a localhost Express server. That flow is **no longer active** — the extension is now fully standalone. The CLI will be rebuilt as an AI-agent-facing tool (programmatic launch + read exported recordings) in a future milestone. Do not use it with the current extension.
