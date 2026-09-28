#!/usr/bin/env bash
# README GIFs from real app captures (60 fps JPEG frames recorded by the film's deterministic Playwright capture).
#   SHOTS=../film/video/public/shots FFMPEG=ffmpeg scripts/readme-assets/gifs.sh
set -euo pipefail
SHOTS=${SHOTS:?path to public/shots of the capture run}
FFMPEG=${FFMPEG:-ffmpeg}
OUT=docs/readme/gifs
mkdir -p "$OUT"
# name  shot  width  fps  start-frame  end-frame
while read -r name shot w fps a b; do
  [ -z "$name" ] && continue
  src="$SHOTS/$shot/%04d.jpg"
  sel="select='between(n\,$a\,$b)',setpts=N/(60*TB)"
  "$FFMPEG" -nostdin -loglevel error -y -framerate 60 -i "$src" -filter_complex \
    "[0]$sel,fps=$fps,scale=$w:-1:flags=lanczos,split[x][y];[x]palettegen=max_colors=160:stats_mode=diff[p];[y][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle" \
    "$OUT/$name.gif"
  echo "$name $(du -h "$OUT/$name.gif" | cut -f1)"
done <<'LIST'
ask-phone      v8-m-ask      360 15 0 448
ask-anything   v8-d-pick     960 15 0 363
alpha          v8-d-alpha    960 15 0 383
copy-lab       v8-d-copy     960 15 0 231
cascades       v8-d-cascade  960 15 0 259
perps          v8-d-btc      960 15 0 306
token-checker  v8-r-token    960 15 0 307
LIST
