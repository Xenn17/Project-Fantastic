#!/usr/bin/env bash
# Convert raw PNG frames in image-sequence/ into lightweight WebP frames for the scroll-scrubbed hero.
# Usage: tools/build-sequence.sh [src_dir] [step] [desktop_height] [mobile_height]
#   e.g. tools/build-sequence.sh image-sequence-intro 1 1280 900
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${1:-image-sequence-intro}"
STEP="${2:-1}"
DH="${3:-1280}"
MH="${4:-900}"
OUT="assets/sequence"
rm -rf "$OUT" && mkdir -p "$OUT/desktop" "$OUT/mobile"

mapfile -t frames < <(find "$SRC" -maxdepth 1 -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.webp" \) | sort -V)
n=0
for ((i = 0; i < ${#frames[@]}; i += STEP)); do
  n=$((n + 1))
  name=$(printf "f_%03d.webp" "$n")
  magick "${frames[$i]}" -resize "x$DH" -quality 72 -define webp:method=6 "$OUT/desktop/$name" &
  magick "${frames[$i]}" -resize "x$MH" -quality 66 -define webp:method=6 "$OUT/mobile/$name" &
  (( n % 8 == 0 )) && wait
done
wait

w=$(magick identify -format "%w" "$OUT/desktop/f_001.webp")
h=$(magick identify -format "%h" "$OUT/desktop/f_001.webp")
printf '{ "count": %d, "width": %d, "height": %d, "pattern": "f_%%03d.webp" }\n' "$n" "$w" "$h" > "$OUT/manifest.json"
echo "Built $n frames"; du -sh "$OUT/desktop" "$OUT/mobile"

# Emblem (crown + F + wolf) cropped from the full logo, used as the Three.js 3D logo texture.
magick assets/logo-transparant.png -crop 800x720+140+170 +repage -trim +repage -resize 1024x1024 \
  -gravity center -background none -extent 1024x1024 -quality 90 assets/logo-emblem.webp
