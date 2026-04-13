---
paths:
  - "src/**/*"
  - "bin/**/*"
---

# Legacy CLI (dormant — do not edit)

`src/` and `bin/` contain a pre-standalone Node CLI from an earlier architecture. The extension no longer talks to a localhost server, so this code is **not wired to anything** in the current flow. It is kept in the repo for reference and will be rebuilt from scratch as an AI-agent tool in a future milestone.

## Hard rules

- **Do not edit files in `src/` or `bin/`** unless the user explicitly asks to rebuild the CLI.
- **`src/export.js` is a stale copy** of `extension/export.js`. They were byte-compatible at port time but have since diverged. `extension/export.js` is authoritative. Do not try to "sync" them — that's wasted work because `src/` will be deleted when the CLI is rebuilt.
- **`src/export.test.js` has 2 pre-existing test failures** (`T1: navigate → page.goto`, `T3: synthetic goto must be present`). These are pre-standalone regressions from commit `0504901`. Do **not** try to fix them as a side-effect of other work — they are explicitly out of scope.
- **`src/server.js` is the old Express localhost server.** It still starts if invoked but has no consumer. Do not try to make it work with the new extension.
- **`bin/rec.js` opens a URL with `#__rec=PORT`** to signal the extension. The extension no longer listens for that hash. Invoking `page-rec start -u <url>` does nothing useful.

## If the user asks to rebuild the CLI as an AI-agent tool

Start a fresh implementation under a new subdirectory (e.g. `cli/`). Do not patch the dormant code. See @docs/ARCHITECTURE.md § "Future: AI-agent CLI rebuild".
