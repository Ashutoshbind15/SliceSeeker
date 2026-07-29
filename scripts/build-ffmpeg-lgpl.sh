#!/bin/sh
# Build the narrow, redistributable FFmpeg used by the indexer worker.
#
# Native FFmpeg demuxers and decoders cover the supported MP4/MOV, WebM, and
# AVI inputs. We deliberately omit GPL, nonfree, network, DVD, x264, and x265
# components. LAME is LGPL and is retained for compact Whisper uploads.

set -eu

: "${FFMPEG_VERSION:?FFMPEG_VERSION is required}"
: "${FFMPEG_SHA256:?FFMPEG_SHA256 is required}"

PREFIX="${FFMPEG_PREFIX:-/opt/ffmpeg}"
SOURCE_OUT="${FFMPEG_SOURCE_OUT:-/opt/ffmpeg-source}"
WORK_DIR="${FFMPEG_BUILD_DIR:-/tmp/ffmpeg-build}"
ARCHIVE="ffmpeg-${FFMPEG_VERSION}.tar.xz"
SOURCE_URL="https://ffmpeg.org/releases/${ARCHIVE}"

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR" "$PREFIX" "$SOURCE_OUT"

curl -fsSLo "${WORK_DIR}/${ARCHIVE}" "$SOURCE_URL"
echo "${FFMPEG_SHA256}  ${WORK_DIR}/${ARCHIVE}" | sha256sum -c -
cp "${WORK_DIR}/${ARCHIVE}" "${SOURCE_OUT}/${ARCHIVE}"

tar -xJf "${WORK_DIR}/${ARCHIVE}" -C "$WORK_DIR"
cd "${WORK_DIR}/ffmpeg-${FFMPEG_VERSION}"

set -- \
  "--prefix=${PREFIX}" \
  "--disable-autodetect" \
  "--disable-debug" \
  "--disable-doc" \
  "--disable-ffplay" \
  "--disable-network" \
  "--disable-static" \
  "--enable-shared" \
  "--enable-pic" \
  "--enable-libmp3lame" \
  "--enable-zlib" \
  "--disable-gpl" \
  "--disable-nonfree" \
  "--disable-version3"

{
  echo "FFmpeg ${FFMPEG_VERSION}"
  echo "Source: ${SOURCE_URL}"
  echo "SHA-256: ${FFMPEG_SHA256}"
  echo
  echo "Configure arguments:"
  printf '  %s\n' "$@"
} >"${SOURCE_OUT}/BUILD-CONFIGURATION.txt"

./configure "$@"
make -j"$(getconf _NPROCESSORS_ONLN)"
make install

export LD_LIBRARY_PATH="${PREFIX}/lib${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"

"${PREFIX}/bin/ffmpeg" -hide_banner -version
"${PREFIX}/bin/ffmpeg" -hide_banner -encoders 2>/dev/null | grep -q 'libmp3lame'

build_configuration="$("${PREFIX}/bin/ffmpeg" -hide_banner -buildconf 2>&1)"
printf '%s\n' "$build_configuration" | grep -q -- '--disable-gpl'
printf '%s\n' "$build_configuration" | grep -q -- '--disable-nonfree'
printf '%s\n' "$build_configuration" | grep -q -- '--disable-version3'
if printf '%s\n' "$build_configuration" | grep -Eq -- '--enable-(gpl|nonfree|version3)'; then
  echo "FFmpeg build unexpectedly enabled a restricted license mode" >&2
  exit 1
fi
