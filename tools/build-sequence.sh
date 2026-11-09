#!/usr/bin/env bash
# Convert raw PNG frames in image-sequence/ into lightweight WebP frames for the scroll-scrubbed hero.
# Usage: tools/build-sequence.sh [src_dir] [step]
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${1:-image-sequence}"
STEP="${2:-2}"
OUT="assets/sequence"
rm -rf "$OUT" && mkdir -p "$OUT/desktop" "$OUT/mobile"

mapfile -t frames < <(ls "$SRC"/frame_*.png | sort)
n=0
for ((i = 0; i < ${#frames[@]}; i += STEP)); do
  n=$((n + 1))
  name=$(printf "f_%03d.webp" "$n")
  magick "${frames[$i]}" -resize x720 -quality 68 -define webp:method=6 "$OUT/desktop/$name" &
  magick "${frames[$i]}" -resize x480 -quality 62 -define webp:method=6 "$OUT/mobile/$name" &
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
