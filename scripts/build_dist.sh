#!/usr/bin/env bash
# Build the upload-ready site into dist/politigig-site/ and dist/politigig-site.zip.
# Run this after any change to the app, then commit dist/.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=dist/politigig-site
rm -rf dist && mkdir -p "$OUT"
cp -r index.html styles.css sw.js manifest.webmanifest js data icons vendor "$OUT"/
cp scripts/dist-files/.htaccess scripts/dist-files/INSTALL.txt "$OUT"/
(cd dist && zip -qr -X politigig-site.zip politigig-site)
echo "Built $OUT ($(du -sh "$OUT" | cut -f1)) and dist/politigig-site.zip ($(du -h dist/politigig-site.zip | cut -f1))"
