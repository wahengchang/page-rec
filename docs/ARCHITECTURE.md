# Architecture

## Extension code map

| File | Role |
|---|---|
| `extension/manifest.json` | MV3 manifest — permissions, host_permissions, side_panel, icons |
| `extension/background.js` | Service worker. Message relay, `start-recording` / `save` / `discard` handlers, content script injection + re-injection on navigation |
| `extension/content.js` | Event capture. Click/input/scroll/submit listeners + SPA `history.pushState` monkey-patch. Relays to background via `chrome.runtime.sendMessage` |
| `extension/sidepanel.html` | Side Panel UI structure |
| `extension/sidepanel.js` | Side Panel runtime — state machine (idle / recording / paused / stopped), Timeline + Step editor, export wiring |
| `extension/sidepanel.css` | Design tokens (CSS variables, light + dark), component styles |
| `extension/export.js` | Playwright `.spec.js` generator (pure string construction). **Authoritative** — `src/export.js` is a stale fossil |
| `extension/icons/` | 16/48/128 PNGs + source SVG |

## Message protocol

All cross-context messages use `{ type, data }` via `chrome.runtime.sendMessage`.

| Message | From → To | Purpose |
|---|---|---|
| `start-recording` | sidepanel → background | Begin a session. Payload: `{ tabId, sessionName, url }` |
| `action` | content → background | Report a captured event |
| `action-log` | background → sidepanel | Relay event to UI for live display |
| `save` | sidepanel → background | Persist to `chrome.storage.local` (no auto-download — user downloads explicitly) |
| `save-complete` | background → sidepanel | Signal save result (error or success) |
| `discard` | sidepanel → background | Clear session without saving (used by **↺ New Record**) |

## Storage model

- **In-flight**: `chrome.storage.session` with keys `activeTabId`, `actions`, `sessionName`, `config.startedAt`. Cleared on save or tab close.
- **Persistent history**: `chrome.storage.local.recordings` (array of `{ name, timestamp, actions }`). Appended on save.
- **No localhost, no remote servers.** Extension is 100% self-contained.

## Activation model

1. User clicks extension icon → `openPanelOnActionClick: true` opens Side Panel.
2. Panel starts in **idle**. User clicks Start → panel queries active tab via `chrome.tabs.query`, derives `sessionName` client-side (`<hostname-slug>-<unix-ts>`), sends `start-recording` to background.
3. Background seeds `chrome.storage.session` with an initial `navigate` action (so Timeline opens with the starting URL), then injects `content.js` via `chrome.scripting.executeScript`.
4. Content script listens on the page and relays events.

There is **no URL-hash activation**. The `__rec=PORT` string still appears in `content.js` from the pre-standalone era — that code path is dead and unreachable.

## Content script lifecycle (load-bearing)

`chrome.scripting.executeScript` runs once per document. A full-page navigation destroys the content script. To keep recording across navigation:

- `background.js` has a **narrowed** `chrome.tabs.onUpdated` listener.
- On `changeInfo.status === 'complete'`, if the tab matches `activeTabId`, background re-runs `executeScript({ files: ['content.js'] })`.
- Re-injection must **not** overwrite `chrome.storage.session.config` — `startedAt` is the elapsed-time baseline and must persist across navigations.

SPA navigation (`history.pushState`) is handled inside `content.js` via monkey-patching. No re-injection needed for those.

## State machine (Side Panel)

```
         ┌─── Start ───▶ recording ◀── Pause/Resume ──▶ paused
         │                 │
         │                 Stop
         │                 ▼
   idle ─┤            stopped ──▶ (tabs + footer visible, user exports)
         │                 │
         └── ◀── New Record ┘
```

- **idle**: Start button visible, empty state text; no tabs, no footer.
- **recording**: Stop + Pause + New Record in header, live Timeline, no footer.
- **paused**: Resume + Stop + New Record; `action-log` messages ignored until resume.
- **stopped**: Step editor populated, Copy Code + ⬇ .spec.js in footer, New Record in header.

## Permissions (manifest.json)

| Permission | Why |
|---|---|
| `sidePanel` | Core UI surface |
| `storage` | Session + local persistence |
| `scripting` | Programmatic content script injection (not declarative — we inject only after user gesture) |
| `tabs` + `activeTab` | Read active tab URL for session naming; observe navigation for re-injection |
| `downloads` | Export `.spec.js` and raw JSON |
| `host_permissions: ["http://*/*", "https://*/*"]` | Record on any site the user chooses |

## Export generator

`extension/export.js` turns a recording into a Playwright `.spec.js` via pure string construction — zero npm dependencies.

```js
window.generateTest({ name, timestamp, actions }) → string
```

Maps action types to Playwright calls (`page.click`, `page.fill`, `page.goto`, `window.scrollTo`), with password masking (`***` → `// TODO: fill in real password`) and single-quote escaping.

`src/export.js` is a historical copy from the pre-standalone era. They were byte-compatible at port time but have since diverged. Do not sync — `src/` will be deleted when the legacy CLI is rebuilt.

## Future: AI-agent CLI rebuild

The dormant `bin/` + `src/` will be rebuilt as a thin CLI that lets AI coding agents:
- **Launch** a recording session (programmatically open a URL and signal the extension to start)
- **Read** the edited recordings from `chrome.storage.local` (via Native Messaging or an extension-exposed export endpoint)

No timeline yet. Current priority is Chrome Web Store publishing.
