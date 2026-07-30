#!/bin/sh
# Record the Alpine packages baked into this image and point readers to the
# upstream source indexes without making a separate source-supply commitment.
#
# Runs inside the runtime stage of each image, after every `apk add`, so the
# inventory matches the layer that actually ships. Reads /lib/apk/db/installed
# rather than shelling out to `apk info`, because that db carries the `L:`
# (license) field for every installed package.
#
# Usage: write-os-package-notice.sh [output-path]

set -eu

OUT="${1:-/licenses/OS-PACKAGES-NOTICE}"
COMPONENT="${SLICESEEKER_COMPONENT:-unknown}"
SOURCE_ARCHIVE_URL="${SLICESEEKER_SOURCE_ARCHIVE_URL:-}"
SOURCE_MANIFEST_URL="${SLICESEEKER_SOURCE_MANIFEST_URL:-}"
# Software baked into the base image outside apk (e.g. the Caddy binary), which
# therefore never appears in the apk database below. Rendered with printf %b so
# callers can pass \n from a single-line Dockerfile ENV.
EXTRA_NOTICE="${SLICESEEKER_EXTRA_NOTICE:-}"
APK_DB=/lib/apk/db/installed

mkdir -p "$(dirname "$OUT")"

ALPINE_VERSION="unknown"
if [ -f /etc/alpine-release ]; then
  ALPINE_VERSION="$(cat /etc/alpine-release)"
fi

PRETTY_NAME="Alpine Linux"
if [ -f /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  PRETTY_NAME="${PRETTY_NAME:-Alpine Linux}"
fi

{
  echo "OS Package Notices for SliceSeeker (${COMPONENT})"
  echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "Base OS: ${PRETTY_NAME} (alpine-release ${ALPINE_VERSION})"
  echo
  echo "SliceSeeker's own code is MIT licensed (see /licenses/LICENSE), and its"
  echo "npm dependencies are attributed in /licenses/THIRD_PARTY_NOTICES."
  echo
  echo "This image is NOT MIT-only. It also contains operating-system packages"
  echo "from the Alpine base image, some of which are licensed under the GNU"
  echo "General Public License. Those packages are listed below with the license"
  echo "declared by their Alpine package metadata."
  echo
  echo "License texts: /licenses/GPL-2.0.txt, /licenses/GPL-3.0.txt,"
  echo "               /licenses/LGPL-2.1.txt, /licenses/LGPL-3.0.txt"
  echo
  if [ -n "$EXTRA_NOTICE" ]; then
    echo "Additional bundled components (not installed via apk):"
    echo
    printf '%b\n' "$EXTRA_NOTICE"
    echo
  fi
  if [ -f /licenses/runtime/NOTICE ]; then
    echo "Bundled runtime notices (not installed via apk):"
    echo
    cat /licenses/runtime/NOTICE
    echo
  fi
  printf '%s\n\n' "========================================================================"
} >"$OUT"

if [ ! -f "$APK_DB" ]; then
  {
    echo "WARNING: ${APK_DB} not found; OS package inventory unavailable."
    echo "Consult the container SBOM published alongside this image instead."
  } >>"$OUT"
  echo "Wrote $OUT (no apk database found)"
  exit 0
fi

# Records are blank-line separated. In addition to the familiar package fields,
# o: is the source-package origin and c: is the exact aports build commit.
awk '
  BEGIN { RS = ""; FS = "\n" }
  {
    name = ""; version = ""; arch = ""; origin = ""; license = ""; commit = ""
    for (i = 1; i <= NF; i++) {
      if (substr($i, 1, 2) == "P:") name = substr($i, 3)
      else if (substr($i, 1, 2) == "V:") version = substr($i, 3)
      else if (substr($i, 1, 2) == "A:") arch = substr($i, 3)
      else if (substr($i, 1, 2) == "L:") license = substr($i, 3)
      else if (substr($i, 1, 2) == "o:") origin = substr($i, 3)
      else if (substr($i, 1, 2) == "c:") commit = substr($i, 3)
    }
    if (name == "") next
    if (arch == "") arch = "(unknown)"
    if (origin == "") origin = name
    if (license == "") license = "(not declared in apk metadata)"
    if (commit == "") commit = "(not recorded)"
    printf "%s\t%s\t%s\t%s\t%s\t%s\n", name, version, arch, origin, license, commit
  }
' "$APK_DB" | sort >/tmp/os-packages.tsv

TOTAL="$(wc -l </tmp/os-packages.tsv | tr -d ' ')"

{
  echo "Installed OS packages (${TOTAL}):"
  echo
  echo "  name | version | architecture | source origin | declared license | aports commit"
  awk -F '\t' '{ printf "  %s | %s | %s | %s | %s | %s\n", $1, $2, $3, $4, $5, $6 }' /tmp/os-packages.tsv
  echo
} >>"$OUT"

awk -F '\t' 'toupper($5) ~ /(AGPL|GPL|LGPL)/' /tmp/os-packages.tsv \
  >/tmp/os-copyleft.tsv
COPYLEFT="$(wc -l </tmp/os-copyleft.tsv | tr -d ' ')"

{
  printf '%s\n\n' "========================================================================"
  echo "UPSTREAM SOURCE INFORMATION (GPL / LGPL)"
  echo

  if [ "$COPYLEFT" -gt 0 ]; then
    echo "The following ${COPYLEFT} package(s) in this image are covered by the GPL"
    echo "and/or LGPL:"
    echo
    echo "  package | version | source origin | declared license | aports commit"
    awk -F '\t' '{ printf "  %s | %s | %s | %s | %s\n", $1, $2, $4, $5, $6 }' /tmp/os-copyleft.tsv
    echo
  else
    echo "No GPL/LGPL packages were detected in this image's apk database."
    echo
  fi

  if [ -n "$SOURCE_ARCHIVE_URL" ] && [ -n "$SOURCE_MANIFEST_URL" ]; then
    cat <<EOF
DIRECT CORRESPONDING SOURCE

The exact source and Alpine build recipes corresponding to this released image
are available at no charge:

  ${SOURCE_ARCHIVE_URL}
  ${SOURCE_MANIFEST_URL}

The manifest maps immutable image digests and installed package versions to
paths in the source archive. This is direct source distribution, not a written
offer to provide source later.

EOF
  fi

  cat <<EOF
UPSTREAM REFERENCE INFORMATION

The inventory above records the exact Alpine package names and versions in this
image. Upstream source and build recipes are indexed by the Alpine Linux
project:

  https://pkgs.alpinelinux.org/packages?branch=v${ALPINE_VERSION%.*}
  https://gitlab.alpinelinux.org/alpine/aports

The upstream indexes are useful references but do not replace the direct
corresponding-source archive for an official SliceSeeker release. For custom
images that do not identify a direct archive above, the image distributor is
responsible for satisfying the licenses of the software it conveys. This
section is not a written source offer by the SliceSeeker maintainers.
EOF
} >>"$OUT"

rm -f /tmp/os-packages.tsv /tmp/os-copyleft.tsv

echo "Wrote $OUT (${TOTAL} OS packages, ${COPYLEFT} GPL/LGPL)"
