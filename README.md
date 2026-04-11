# page-rec

Browser behaviour recorder — capture interactions and turn them into Playwright tests.

## Install

```bash
npm install -g page-rec
```

Or run directly from a repo checkout (Node >= 20 required):

```bash
node bin/rec.js <command>
```

## Quick start

```bash
page-rec start -u https://example.com
```

This will:
1. Start a local server on a random port (bound to 127.0.0.1 only)
2. Open Chrome to `https://example.com` with the port embedded in the URL hash
3. Activate the Behaviour Recorder side panel automatically
4. Capture every click, input, scroll, form submit, and SPA navigation

When you are done, click **Stop & Save** in the side panel. The server shuts down and the recording is saved to `recorder-scripts.json` in the current directory.

## Commands

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

**Running the generated test:**

`page-rec` does not bundle Playwright — it only generates the `.spec.js` text. To execute the exported test, install Playwright in your target project:

```bash
npm install -D @playwright/test
npx playwright install chromium
npx playwright test <name>.spec.js
```

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

## Installing the Chrome extension

### For end users (from a release zip)

1. Download the latest `page-rec-extension-v*.zip` from the [GitHub Releases page](https://github.com/wahengchang/page-rec/releases).
2. Unzip it. You will get a folder named `page-rec-extension/`.
3. Open `chrome://extensions` in Google Chrome.
4. Toggle **Developer mode** on (top-right corner).
5. Click **Load unpacked** and select the `page-rec-extension/` folder.

**Requirements:** Google Chrome 114 or later (required for the Side Panel API).

**Notes:**
- The extension only activates on tabs where `page-rec start` has opened the URL — it detects the `__rec=PORT` hash fragment automatically.
- Only one recording session can be active at a time.
- For a repo checkout, load the `extension/` folder directly via **Load unpacked** instead of downloading a zip.

### For maintainers (building the release zip)

From a repo checkout, run:

```bash
npm run build:extension
```

This produces `dist/page-rec-extension-v<version>.zip` using the current version from `extension/manifest.json`. Upload that file to a GitHub Release. The `dist/` folder is git-ignored.

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
