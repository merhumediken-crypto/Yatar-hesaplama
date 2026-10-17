#!/usr/bin/env sh
# Chrome Web Mağazası / elle yükleme için extension klasörünü zipler.
set -e
KOK="$(cd "$(dirname "$0")/.." && pwd)"
SURUM="$(node -p "require('$KOK/extension/manifest.json').version")"
HEDEF="$KOK/dist/infaz-tekerrur-hesabi-$SURUM.zip"
mkdir -p "$KOK/dist"
rm -f "$HEDEF"
cd "$KOK/extension" && zip -qr "$HEDEF" . -x '.*'
echo "$HEDEF"
