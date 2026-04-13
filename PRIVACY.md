# Page Rec — Privacy Policy

**Last updated:** 2026-04-13

Page Rec is a Chrome extension that records user interactions on web pages the user explicitly chooses and exports them as Playwright test scripts. This policy describes what data Page Rec handles and how.

## Summary

- Page Rec **does not collect, transmit, or sell personal data**.
- Page Rec **has no backend server and makes no network requests**. All data stays on your device.
- Page Rec only activates on a tab after you click **Start recording** in the Side Panel.

## What Page Rec records (locally, only when you start a recording)

While a recording is active on a tab you chose, Page Rec captures the following, purely on-device:

- Click targets (CSS selectors, element roles, visible text).
- Typed input values — **except for `<input type="password">` fields, which are always masked as `<password>`**. The exported test leaves a `// TODO: fill in real password` placeholder in their place; raw password values are never captured.
- Scroll positions, form submissions, and full-page navigations for the active tab.

## Where the data is stored

- **In-flight session state:** `chrome.storage.session` (cleared when the tab closes or the recording ends).
- **Saved recordings:** `chrome.storage.local` (stays on your device; only you can read it via the Page Rec Side Panel).
- **Exports:** Files you explicitly save via **Copy Code** or **Download .spec.js** — these go to your clipboard or Downloads folder. Nothing is uploaded.

## What Page Rec does NOT do

- No analytics, telemetry, or crash reporting.
- No advertising identifiers, no cookies, no tracking pixels.
- No cloud sync, no accounts, no remote servers of any kind.
- No data sharing with Google, Anthropic, or any third party.
- No reading of tabs other than the one you explicitly started recording on.

## Permissions, briefly

| Permission | Why it's needed |
|---|---|
| `sidePanel` | The Side Panel is Page Rec's UI surface. |
| `storage` | Save in-flight and completed recordings locally. |
| `scripting` | Inject the recorder into the active tab after you click Start, and re-inject it after full-page navigations so multi-page recording keeps working. |
| `tabs` + `activeTab` | Read the active tab's URL to name the session and observe navigation for re-injection. |
| `downloads` | Save the generated `.spec.js` file when you click Download. |
| `host_permissions: http://*/*`, `https://*/*` | Let you record on any site you choose. The content script only runs after you click Start. |

## Your control

- You can stop a recording at any time via the **Stop Recording** button.
- You can discard an in-flight recording by clicking **▶ New Record**.
- You can clear all saved recordings by removing the extension via `chrome://extensions`, or via your browser's site-data tools.

## Changes to this policy

If this policy materially changes, the updated version will be committed to the [Page Rec GitHub repository](https://github.com/wahengchang/page-rec) and the "Last updated" date above will be bumped.

## Contact

Questions about Page Rec's privacy practices: **support@jctec.me**
