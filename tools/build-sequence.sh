#!/usr/bin/env bash
# Convert raw PNG frames in image-sequence/ into lightweight WebP frames for the scroll-scrubbed hero.
# Usage: tools/build-sequence.sh [src_dir] [desktop_step] [desktop_height] [mobile_height] [mobile_step]
#   e.g. tools/build-sequence.sh image-sequence-intro 1 1280 720 2
# Mobile uses fewer, smaller frames: every decoded frame stays in memory while scrubbing, and phones freeze
# under that pressure (213 x 506x900 RGBA ~ 390 MB vs 107 x 405x720 ~ 125 MB).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${1:-image-sequence-intro}"
STEP="${2:-1}"
DH="${3:-1280}"
MH="${4:-720}"
MSTEP="${5:-2}"
OUT="assets/sequence"
rm -rf "$OUT" && mkdir -p "$OUT/desktop" "$OUT/mobile"

mapfile -t frames < <(find "$SRC" -maxdepth 1 -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.webp" \) | sort -V)

build() { # variant step height quality
  local variant=$1 step=$2 height=$3 quality=$4 n=0 i name
  for ((i = 0; i < ${#frames[@]}; i += step)); do
    n=$((n + 1))
    name=$(printf "f_%03d.webp" "$n")
    magick "${frames[$i]}" -resize "x$height" -quality "$quality" -define webp:method=6 "$OUT/$variant/$name" &
    (( n % 8 == 0 )) && wait
  done
  wait
  echo "$n"
}
dn=$(build desktop "$STEP" "$DH" 72)
mn=$(build mobile "$MSTEP" "$MH" 68)

w=$(magick identify -format "%w" "$OUT/desktop/f_001.webp")
h=$(magick identify -format "%h" "$OUT/desktop/f_001.webp")
# "version" busts cached frames whenever the set is rebuilt (frame N may be a different image afterwards).
printf '{ "version": "%s", "count": %d, "width": %d, "height": %d, "pattern": "f_%%03d.webp", "desktop": { "count": %d }, "mobile": { "count": %d } }\n' \
  "$(date +%Y%m%d%H%M%S)" "$dn" "$w" "$h" "$dn" "$mn" > "$OUT/manifest.json"
echo "Built desktop $dn / mobile $mn frames"; du -sh "$OUT/desktop" "$OUT/mobile"

# Emblem (crown + F + wolf) cropped from the full logo, used as the Three.js 3D logo texture.
magick assets/logo-transparant.png -crop 800x720+140+170 +repage -trim +repage -resize 1024x1024 \
  -gravity center -background none -extent 1024x1024 -quality 90 assets/logo-emblem.webp
