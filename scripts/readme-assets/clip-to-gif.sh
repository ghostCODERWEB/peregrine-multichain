#!/usr/bin/env bash
# One README GIF from a capture.mjs recording, starting where the page had finished loading.
#   scripts/readme-assets/clip-to-gif.sh <clip> <width> <fps> <colors>
#   e.g. scripts/readme-assets/clip-to-gif.sh overview-tour 760 8 80   (phone clips: 320 10 80)
set -euo pipefail
n=$1; w=$2; fps=$3; col=$4
IN=${IN:-docs/readme/.capture/clips}; OUT=${OUT:-docs/readme/gifs}
v=$(ls -S "$IN/$n"/*.webm | head -1); st=$(cat "$IN/$n/start.txt")
mkdir -p "$OUT"
ffmpeg -nostdin -loglevel error -y -ss "$st" -i "$v" -filter_complex \
  "fps=${fps},scale=${w}:-1:flags=lanczos,split[x][y];[x]palettegen=max_colors=${col}:stats_mode=diff[p];[y][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
  "$OUT/$n.gif"
echo "$n $(du -h "$OUT/$n.gif" | cut -f1)"
