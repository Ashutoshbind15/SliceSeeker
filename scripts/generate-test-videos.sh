#!/usr/bin/env bash
# Generate minimal H.264 test videos at fixed sizes (noise frames, not real content).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/test-videos}"

# name -> size in bytes
declare -A SIZES=(
  [noise-20mb.mp4]=$((20 * 1024 * 1024))
  [noise-50mb.mp4]=$((50 * 1024 * 1024))
  [noise-200mb.mp4]=$((200 * 1024 * 1024))
  [noise-1gb.mp4]=$((1024 * 1024 * 1024))
)

mkdir -p "$OUT_DIR"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required but not installed" >&2
  exit 1
fi

human_size() {
  numfmt --to=iec-i --suffix=B "$1" 2>/dev/null || echo "${1}B"
}

# Tiny frames encode slowly; bump resolution so -fs can be reached in reasonable time.
encode_settings() {
  local bytes="$1"
  if (( bytes >= 512 * 1024 * 1024 )); then
    echo "1920x1080:30:3600"
  else
    echo "64x64:1:86400"
  fi
}

generate() {
  local file="$1"
  local bytes="$2"
  local path="$OUT_DIR/$file"
  local settings size fps duration

  IFS=: read -r size fps duration <<<"$(encode_settings "$bytes")"

  echo "→ $file (target $(human_size "$bytes"), ${size}@${fps}fps)"

  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "color=c=black:s=${size}:r=${fps}" \
    -vf "noise=alls=20:allf=t+u" \
    -t "$duration" \
    -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p \
    -fs "$bytes" \
    "$path"

  local actual
  actual=$(stat -c%s "$path")
  echo "  wrote $(human_size "$actual") → $path"
}

for file in noise-20mb.mp4 noise-50mb.mp4 noise-200mb.mp4 noise-1gb.mp4; do
  generate "$file" "${SIZES[$file]}"
done

echo
echo "Done. Files in $OUT_DIR"
