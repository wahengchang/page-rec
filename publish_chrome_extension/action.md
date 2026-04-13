# Page Rec — Chrome Web Store Publishing Playbook

Ready-to-work checklist for submitting Page Rec (current `extension/manifest.json` version **1.0.0**) to the Chrome Web Store as a **Free**, **Public**, **All regions** listing. This is NOT a tutorial — each item below is a concrete action. Work top-to-bottom; items are wired to the real repo state (manifest, permissions, icons, build script).

## Overview

- Chrome Web Store Developer account required — one-time **$5 USD** registration fee, billed to a Google account.
- Publisher contact email must be verified before the first public listing can go live; optional domain verification unlocks the trusted-publisher badge.
- A submission = a versioned `.zip` produced from `extension/` + a store listing (text, icons, screenshots, category, language, privacy form).
- Privacy disclosures are mandatory: single-purpose statement, per-permission justification for every entry in `permissions` + `host_permissions`, data-usage form, public privacy policy URL.
- Review SLA is typically hours to a few days for small MV3 extensions; rejections arrive via email with a reviewer note — must be answered within 30 days.
- Target listing: **Free**, **Public**, **All regions**, category **Developer Tools**, language **English**.
- Post-publish: every resubmit requires bumping `extension/manifest.json` `version` first; `scripts/build-extension.sh` picks the new version up automatically into `dist/page-rec-extension-v<version>.zip`.

## One-time setup

- [ ] Register Chrome Web Store developer account at https://chrome.google.com/webstore/devconsole and pay the one-time **$5** registration fee.
- [ ] Verify publisher contact email (required before first public listing is allowed).
- [ ] (Recommended) Verify a publisher domain to earn the trusted-publisher badge on the store listing.
- [ ] Decide listing ownership: personal publisher vs. group publisher — record which Google account will own the `Page Rec` listing.
- [ ] Set distribution defaults in the dashboard: visibility = **Public**, regions = **All regions**, pricing = **Free**.
- [ ] Confirm primary category = **Developer Tools**, listing language = **English**.

## Listing assets to create

- [ ] Store icon 128x128 PNG — reuse `extension/icons/icon-128.png` (confirm ≤ 128KB, square, transparent or solid background; re-export from `extension/icons/icon.svg` if needed).
- [ ] (Future work — NOT this task) Add a 32x32 icon at `extension/icons/icon-32.png` and register it in `icons` + `action.default_icon` alongside a manifest version bump. Tracked under STATE.md Stage 2 polish.
- [ ] At least 1 (max 5) screenshots at 1280x800 OR 640x400 PNG/JPG. Produce three at 1280x800:
  - [ ] Screenshot A (1280x800): Side panel in `idle` state — terminal empty prompt `> Waiting for recording to start..._` with blinking cursor, anchored over a neutral site (e.g. example.com).
  - [ ] Screenshot B (1280x800): Side panel in `recording` state — dashed flow track visible, 3+ color-coded nodes on the track (indigo click, amber input, emerald navigate).
  - [ ] Screenshot C (1280x800): Side panel in `stopped` state — flow line solidified, Step editor tab active, footer showing `Copy Code` + `⬇ .spec.js`.
- [ ] Small promo tile 440x280 PNG — required to appear in Web Store homepage and category carousels. Use the Page Rec wordmark + linked-node logo on a design-token background.
- [ ] (Optional) Marquee promo tile 1400x560 PNG — only needed if opting into featured placement.
- [ ] Short description (≤ 132 chars). Draft: `One-click recording of real browser clicks, typing, and navigation — exported as runnable Playwright .spec.js tests.`
- [ ] Detailed description (plain text, no HTML, ≤ 16,000 chars). Seed from the "Use" section of `README.md`; append a short "What it does / What it doesn't do" block.
- [ ] Category: **Developer Tools**.
- [ ] Language: **English**.

## Manifest & build sanity-check

- [ ] Confirm `manifest_version: 3` in `extension/manifest.json`.
- [ ] Confirm `name: "Page Rec"` matches the Web Store listing title exactly.
- [ ] Confirm `version: 1.0.0` — or bump it before submitting (Chrome Web Store rejects resubmits that reuse a version).
- [ ] Confirm `description` is ≤ 132 chars and matches the Web Store short description.
- [ ] Confirm `icons` declares 16 / 48 / 128 PNG files and each exists under `extension/icons/`.
- [ ] Consider adding manifest fields before submit: `author`, `homepage_url`, `minimum_chrome_version: "114"` (Side Panel API floor). Tracked under STATE.md Stage 2 — flag as pre-submit polish, not in this task.
- [ ] Run `npm run build:extension` and confirm `dist/page-rec-extension-v1.0.0.zip` is produced.
- [ ] Unzip `dist/page-rec-extension-v1.0.0.zip`, then `chrome://extensions → Load unpacked` the unzipped folder; smoke test: Start → record 3 actions → Stop → Copy Code.
- [ ] Fix stale INSTALL.md inside the `scripts/build-extension.sh` heredoc — it still reads "activates only on tabs opened by the `page-rec start` CLI" (obsolete since the standalone refactor). File as a separate quick task, NOT in this one.
- [ ] Confirm only the expected runtime files ship in the zip (manifest.json, background.js, content.js, sidepanel.html, sidepanel.css, sidepanel.js, export.js, icons/, plus generated INSTALL.md); nothing from `bin/`, `src/`, `.planning/`, or `docs/` should leak in.

## Privacy & permissions justifications

Per-permission one-liners the reviewer will ask for. Cover every entry in `permissions` and both `host_permissions`:

- [ ] `sidePanel` — "Side Panel is the extension's core UI surface for displaying recorded actions and export controls."
- [ ] `storage` — "Persists in-flight recording state in `chrome.storage.session` and saved recordings in `chrome.storage.local`. No remote storage."
- [ ] `downloads` — "Used to save the generated Playwright `.spec.js` file to the user's machine when they click Download."
- [ ] `scripting` — "Programmatically injects `content.js` into the user's active tab only after the user clicks Start, and re-injects it after full-page navigations so multi-page recording keeps working."
- [ ] `tabs` — "Reads active tab URL to derive a session name (e.g. `example-com-<unix-ts>`) and observes navigation events to trigger re-injection of the content script."
- [ ] `activeTab` — "Scoped, user-gesture-bound access to the tab where the user initiated recording."
- [ ] `host_permissions: https://*/*` — "Required so users can record interactions on any HTTPS site of their choosing. Injection only happens after explicit Start click."
- [ ] `host_permissions: http://*/*` — "Required so users can also record interactions on non-HTTPS staging/dev environments they choose. Injection only happens after explicit Start click."
- [ ] Single-purpose description (store field): "Records a single user's interactions in a single tab and exports them as a Playwright test script."
- [ ] Data-usage disclosure (store form). Tick: "Does NOT collect PII. Does NOT transmit user data to any remote server. All data stays in the user's browser (`chrome.storage.local`) or in files the user explicitly downloads."
- [ ] Password handling note: "Password inputs are masked as `<password>` and replaced with a `// TODO: fill in real password` placeholder in the exported spec. Raw password values are never captured."
- [ ] Create `PRIVACY.md` at the repo root (or a hosted page) containing the above + a contact email; the store listing requires a public privacy policy URL.

## Submit & review

- [ ] Log into the Chrome Web Store Developer Dashboard → **New item** → upload `dist/page-rec-extension-v1.0.0.zip`.
- [ ] Fill the **Store listing** tab: short description, detailed description, 128x128 icon, 3 screenshots, 440x280 promo tile, category = Developer Tools, language = English.
- [ ] Fill the **Privacy** tab: single-purpose, per-permission justifications, data-usage form, privacy policy URL.
- [ ] Set **Distribution**: visibility = Public, regions = All, pricing = Free.
- [ ] Run the pre-submit checklist surfaced by the dashboard and resolve every warning.
- [ ] Click **Submit for review**.
- [ ] Expect initial review within hours to a few days; respond to any reviewer email from Google within 30 days or the submission is dropped.

## Post-launch

- [ ] Publish the Chrome Web Store public URL into `README.md` (replace the "Chrome Web Store coming soon" line with the real install link) — tracked as a follow-up quick task.
- [ ] Tag a GitHub release `v1.0.0` and attach `dist/page-rec-extension-v1.0.0.zip` (already how `README.md` documents installs).
- [ ] Monitor Developer Dashboard for crash reports and bad reviews for the first 7 days post-launch.
- [ ] For every subsequent submission: bump `extension/manifest.json` `version`, rerun `npm run build:extension`, upload the new zip; the store typically reuses prior answers for re-review.
