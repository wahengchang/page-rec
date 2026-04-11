# page-rec

Browser behaviour recorder — capture interactions and turn them into Playwright tests.

## Getting started

### 1. Install the CLI

```bash
npm install -g page-rec
```

Requires Node.js 20 or later.

### 2. Install the Chrome extension

1. Go to the [latest release](https://github.com/wahengchang/page-rec/releases/latest) and download `page-rec-extension-v*.zip`.
2. Unzip it — you'll get a folder named `page-rec-extension/`.
3. Open `chrome://extensions` in Google Chrome.
4. Toggle **Developer mode** (top-right).
5. Click **Load unpacked** and select the `page-rec-extension/` folder.

Requires Google Chrome 114 or later (Side Panel API).

> **Developer shortcut:** if you cloned the repo, skip the download — point **Load unpacked** at the `extension/` folder in your checkout directly.

### 3. Record a session

```bash
page-rec start -u https://example.com
```

Chrome opens with the Behaviour Recorder side panel, and every click, input, scroll, form submit, and SPA navigation gets captured. When you're done, click **Stop & Save** in the side panel — the recording is written to `recorder-scripts.json` in the current directory.

### 4. Export to a Playwright test

```bash
page-rec export my-recording
```

Writes `my-recording.spec.js` in the current directory. To run it:

```bash
npm install -D @playwright/test
npx playwright install chromium
npx playwright test my-recording.spec.js
```

## Command reference

### Start a recording

```bash
page-rec start -u <url> [--port <port>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `-u, --url <url>` | Yes | Target URL to record |
| `-p, --port <port>` | No | Bind to a specific port (default: OS-assigned random port) |

### List recordings

```bash
page-rec list
```

Prints a table of all recordings saved in `recorder-scripts.json`: name, action count, and timestamp.

### Export a recording as a Playwright test

```bash
page-rec export <name>
```

Writes `<name>.spec.js` in the current working directory. The file is a standalone Playwright test with one `test.describe` block and one `test` case containing all recorded actions.

**Notes:**
- Password field values are masked as `***` during recording and exported as `// TODO: fill in real password` placeholders.
- If the first recorded action is not a navigation, a synthetic `page.goto()` is prepended automatically.

### Describe a recording in plain text

```bash
page-rec describe <name> [--output <file>]
```

Prints a human-readable step-by-step description of the recording to stdout. Use `--output <file>` to write to a file instead.

### Delete a recording

```bash
page-rec delete <name>
```

Removes the named recording from `recorder-scripts.json`. Exits with code 1 if the name is not found.

## How it works

```
page-rec start            Chrome extension
     │                         │
     │── opens URL+hash ──────>│ background.js detects __rec=PORT
     │<── GET /extension-config─│ fetches session config
     │                         │── injects content.js into page
     │                         │── opens Side Panel
     │                         │
     │         user interacts with page
     │                         │
     │                         │ content.js captures events
     │                         │── messages background.js
     │                         │── side panel shows live log
     │                         │
     │<── POST /api/actions ───│ Stop & Save button pressed
     │── saves to JSON         │
     │── shuts down            │
```

The content script relays all actions to the service worker via `chrome.runtime.sendMessage` — it never fetches localhost directly (CORS restriction).

## Storage

Recordings are stored in `recorder-scripts.json` in the directory where you ran `page-rec start`. Saving a recording with the same name overwrites the previous entry.

## Server lifecycle

- **Stop & Save** in the side panel — saves and shuts down
- **Ctrl+C** — exits without saving (data is lost)
- **30-minute timeout** — auto-shuts down if no save is received
- **Port conflict** — clear error if the explicit port is already in use

## Building the release zip (maintainers)

Bump `version` in `extension/manifest.json`, then run `npm run build:extension` to produce `dist/page-rec-extension-v<version>.zip`.

Upload that file to a new GitHub Release (e.g. via `gh release create vX.Y.Z dist/page-rec-extension-vX.Y.Z.zip`).

The `dist/` folder is git-ignored.
