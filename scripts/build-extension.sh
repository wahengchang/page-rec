#!/usr/bin/env bash
#
# build-extension.sh — Package the Chrome extension into a versioned zip.
#
# Zero-dependency bash packager. Reads the version from extension/manifest.json
# via node (no jq), copies the 6 extension source files plus a generated
# INSTALL.md into a staging folder, zips it to dist/page-rec-extension-v<VER>.zip,
# then removes the staging folder so only the .zip remains in dist/.
#
# Usage:
#   bash scripts/build-extension.sh
#   # or after chmod +x:
#   ./scripts/build-extension.sh
#
# Output:
#   dist/page-rec-extension-v<VERSION>.zip
#
# Idempotent: wipes and recreates dist/ on every run.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

VERSION=$(node -e "console.log(require('./extension/manifest.json').version)")

DIST_DIR="dist"
STAGE_DIR="${DIST_DIR}/page-rec-extension"
ZIP_NAME="page-rec-extension-v${VERSION}.zip"

rm -rf "$DIST_DIR"
mkdir -p "$STAGE_DIR"

cp extension/manifest.json   "$STAGE_DIR/"
cp extension/background.js   "$STAGE_DIR/"
cp extension/content.js      "$STAGE_DIR/"
cp extension/sidepanel.html  "$STAGE_DIR/"
cp extension/sidepanel.css   "$STAGE_DIR/"
cp extension/sidepanel.js    "$STAGE_DIR/"

cat > "$STAGE_DIR/INSTALL.md" <<'EOF'
# Installing the Behaviour Recorder Chrome Extension

1. Unzip this archive. You should see a folder named `page-rec-extension/`.
2. Open `chrome://extensions` in Google Chrome.
3. Toggle **Developer mode** on (top-right corner).
4. Click **Load unpacked**.
5. Select the `page-rec-extension/` folder you just unzipped.

The extension is now installed. It activates only on tabs opened by the `page-rec start` CLI.

**Requirements:** Google Chrome 114 or later (required for the Side Panel API).
EOF

(cd "$DIST_DIR" && zip -rq "$ZIP_NAME" page-rec-extension)

rm -rf "$STAGE_DIR"

SIZE_BYTES=$(wc -c < "$DIST_DIR/$ZIP_NAME" | tr -d ' ')
SIZE_KB=$(awk "BEGIN { printf \"%.1f\", ${SIZE_BYTES}/1024 }")
echo "Built: $DIST_DIR/$ZIP_NAME (${SIZE_KB} KB)"
