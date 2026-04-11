<!-- GSD:project-start source:PROJECT.md -->
## Project

**page-rec — Behaviour Recorder**

A Node CLI + Chrome extension that records user interactions on any web page and saves them as structured JSON. You run `page-rec start -u <url>`, the CLI opens the page with a Chrome Side Panel showing a live action log, and every click/input/scroll gets captured. When done, the recording exports to a Playwright test script.

**Core Value:** Capture real browser interactions on any site and turn them into repeatable Playwright tests — zero manual test writing.

### Constraints

- **Security**: Server binds 127.0.0.1 only, passwords always masked, server auto-shuts down after save
- **Browser**: Chrome only (Manifest V3, Side Panel API)
- **Runtime**: Node.js, Express for the local server, Commander for CLI
- **Storage**: Single `recorder-scripts.json` file, append/overwrite by name
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 20 LTS | CLI runtime | LTS until April 2026, required by Commander 14. Node 18 is end-of-life in April 2025. |
| Chrome Manifest V3 | — | Extension platform | MV2 fully deprecated from Chrome 139 (June 2025). MV3 is the only option. |
| Express.js | 5.2.1 | Local HTTP server (CLI side) | v5 is now stable and default on npm (March 2025). Async error handling improved. Two endpoints (`GET /extension-config`, `POST /api/actions`) don't need Fastify's performance overhead. |
| Commander.js | 14.0.x | CLI argument parsing | Most popular Node CLI framework (24K+ GitHub stars), zero dependencies, clean subcommand model (`page-rec start`, `page-rec list`, `page-rec export`, `page-rec delete`). Requires Node ≥20. |
### Extension Platform
| Component | API / Spec | Purpose | Notes |
|-----------|-----------|---------|-------|
| Content Script | MV3 content script | DOM event capture (click, input, scroll) | Injected into target page. Shares DOM but has isolated JS context. |
| Service Worker | MV3 `background.service_worker` | Relays fetch calls to CLI server | Content scripts cannot directly fetch localhost due to CORS restrictions — must proxy through service worker. |
| Side Panel | `chrome.sidePanel` (Chrome 114+) | Live action log UI + Stop & Save button | Full Chrome API access from panel page. Cannot open programmatically — requires user gesture to first enable. |
| `chrome.runtime` messaging | Built-in | Content script → service worker → side panel | Message passing is the required pattern for cross-context comms in MV3. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `open` | 11.0.x | Launch Chrome from CLI cross-platform | `page-rec start` opens the target URL in the default browser. ESM-only — project must use `"type": "module"` or dynamic `import()`. |
| `picocolors` | 1.1.1 | Terminal color output in CLI | Status messages and errors. 14x smaller than chalk, zero dependencies. Sufficient for this use case. |
| `@playwright/test` | 1.59.x | Playwright test generation (export target) | Only needed at `page-rec export` time to understand test file format. Not a runtime dependency of the recorder itself. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint | Linting | Use flat config (`eslint.config.js`). Legacy `.eslintrc` deprecated in ESLint 9. |
| `web-ext` (optional) | Extension dev reload | Mozilla's tool works with Chrome too for live-reload during extension development. Alternative: manual `chrome://extensions` reload. |
| `nodemon` | CLI dev auto-restart | Only needed during CLI development; not shipped. |
## Installation
# CLI core
# For Playwright export generation
# Dev dependencies
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Express 5 | Fastify | If you need JSON schema validation, typed routes, or >1000 req/s. Overkill for two local endpoints. |
| Express 5 | Node `http` built-in | If you want zero dependencies. Acceptable but requires manual routing/body parsing boilerplate. |
| Commander 14 | Yargs | If CLI needs complex argument coercion, validation middleware, or deeply nested interdependent flags. |
| Commander 14 | Meow | If you want strong ESM + TypeScript type inference and a simpler API surface. Viable; just less community tooling. |
| `open` 11 | `child_process.exec` with `open`/`xdg-open`/`start` | If you want zero dependencies and can handle the platform branching yourself. Not worth it. |
| `picocolors` | Chalk 5 | If you need truecolor (16M colors), chaining syntax, or template literal tags. Unnecessary here. |
| Side Panel UI (vanilla JS) | React/Preact | If the panel needs complex state, routing, or component reuse. Current panel is a list + one button — vanilla is fine. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Manifest V2 | Fully deprecated from Chrome 139 (June 2025). Chrome will refuse to load MV2 extensions. | Manifest V3 |
| `background.persistent: true` | Not supported in MV3. Background pages are replaced by service workers which terminate when idle. | Service worker + `chrome.storage` for state persistence |
| Content script `fetch()` to localhost | CORS-blocked by Chrome. Content scripts inherit the host page's origin, not the extension's origin. | Route the fetch through the service worker via `chrome.runtime.sendMessage` |
| Webpack for extension bundling | Heavy config, not needed for a small extension with no framework. | Keep scripts unbundled or use esbuild for the CLI only if needed |
| `iframes` for extension UI injection | Blocked by X-Frame-Options/CSP on most production sites. This is explicitly called out in the project spec. | Chrome Side Panel API |
| Express 4 | Superseded; v5.2.1 is now the npm default (March 2025 LTS release). | Express 5 |
| `chalk` | 44kB, heavier than needed for simple CLI output. Not ESM-compatible with older Node. | `picocolors` |
## Stack Patterns by Variant
- Commander 14 has first-class TypeScript support — types are bundled.
- Express 5 ships types via `@types/express`.
- The extension side panel and content scripts would need `tsconfig` with `lib: ["dom"]` and a separate config for the Node CLI.
- Use esbuild (not Webpack or Vite) — fastest, zero config for this use case.
- Keep the CLI as plain Node ESM; only bundle extension scripts if needed.
- Use `open` with `{ app: { name: 'google chrome' } }` option.
- Requires knowing Chrome's binary name per platform (`google chrome` on macOS, `google-chrome` on Linux, `chrome` on Windows).
## Critical Architecture Constraint: Content Script Cannot Fetch Localhost
## Version Compatibility
| Package | Requires | Notes |
|---------|----------|-------|
| `commander@14` | Node ≥20 | Commander 15 (ESM-only, May 2026) will break CJS consumers. Stay on 14 for now. |
| `express@5` | Node ≥18 | Works on Node 20. v5 is now the `latest` tag on npm. |
| `open@11` | Node ≥18, ESM | Project must have `"type": "module"` in package.json or use dynamic `import()`. |
| Chrome Side Panel | Chrome 114+ | Available in all current Chrome versions. Not available in Chrome 113 or older. |
| MV3 service worker | Chrome 88+ | Fully stable; all modern Chrome versions support it. |
## Sources
- [Chrome Side Panel API — chrome.sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) — Chrome 114+, verified via official docs (MEDIUM confidence)
- [MV3 Transition Timeline](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) — MV2 deprecated Chrome 139 June 2025 (HIGH confidence)
- [Express v5.1.0 LTS announcement](https://expressjs.com/2025/03/31/v5-1-latest-release.html) — v5 is now npm default (HIGH confidence)
- [Commander.js npm](https://www.npmjs.com/package/commander) — v14.0.x, requires Node 20 (HIGH confidence)
- [Playwright npm](https://www.npmjs.com/package/playwright) — v1.59.x (HIGH confidence)
- [open npm — sindresorhus/open](https://github.com/sindresorhus/open) — v11.0.x, ESM-only (HIGH confidence)
- [picocolors npm](https://www.npmjs.com/package/picocolors) — v1.1.1, zero deps (HIGH confidence)
- [Cross-origin requests in content scripts](https://www.chromium.org/Home/chromium-security/extension-content-script-fetches/) — Content scripts cannot fetch cross-origin; relay through service worker (HIGH confidence, official Chromium docs)
- [Chrome extension messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) — `chrome.runtime.sendMessage` pattern for content script → service worker (HIGH confidence)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
