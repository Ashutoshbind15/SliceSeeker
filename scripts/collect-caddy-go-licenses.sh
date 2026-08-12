#!/bin/sh
# Collect license texts for the Go modules linked into the stock Caddy binary
# used by the admin-ui image (caddy:2.11.4-alpine).
#
# Usage:
#   sh scripts/collect-caddy-go-licenses.sh \
#     --version v2.11.4 \
#     --out /licenses/caddy
#
# Self-test (no network):
#   sh scripts/collect-caddy-go-licenses.sh --self-test

set -eu

CADDY_VERSION="${CADDY_VERSION:-v2.11.4}"
OUT=""
GO_LICENSES_VERSION="${GO_LICENSES_VERSION:-v1.6.0}"
WORKDIR="${TMPDIR:-/tmp}/sliceseeker-caddy-licenses-$$"
SELF_TEST=0

# SPDX ids observed for Caddy v2.11.4 via go-licenses, plus common permissive
# ids we accept if the tree drifts slightly. Strong copyleft fails the build.
# Use [.] so the pattern is safe both for grep -E and awk.
ALLOWED_LICENSE_REGEX='^(Apache-2[.]0|MIT|BSD-2-Clause|BSD-3-Clause|BSD-3-Clause-Clear|ISC|0BSD|CC0-1[.]0|Unlicense|Zlib|BSL-1[.]0|MPL-2[.]0)$'

usage() {
  echo "Usage: $0 --version vX.Y.Z --out DIR" >&2
  echo "       $0 --self-test" >&2
  exit 2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version)
      CADDY_VERSION="${2:-}"
      shift 2
      ;;
    --out)
      OUT="${2:-}"
      shift 2
      ;;
    --go-licenses-version)
      GO_LICENSES_VERSION="${2:-}"
      shift 2
      ;;
    --self-test)
      SELF_TEST=1
      shift
      ;;
    -h | --help)
      usage
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      ;;
  esac
done

if [ "$SELF_TEST" -eq 1 ]; then
  printf '%s\n' "$CADDY_VERSION" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$' \
    || {
      echo "Self-test failed: bad default Caddy version ${CADDY_VERSION}" >&2
      exit 1
    }
  printf '%s\n' "$GO_LICENSES_VERSION" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$' \
    || {
      echo "Self-test failed: bad go-licenses pin ${GO_LICENSES_VERSION}" >&2
      exit 1
    }
  for sample in Apache-2.0 MIT BSD-3-Clause MPL-2.0 CC0-1.0; do
    printf '%s\n' "$sample" | grep -Eq "$ALLOWED_LICENSE_REGEX" \
      || {
        echo "Self-test failed: expected allow for ${sample}" >&2
        exit 1
      }
  done
  for bad in GPL-3.0 LGPL-2.1 AGPL-3.0 Unknown None SSPL; do
    if printf '%s\n' "$bad" | grep -Eq "$ALLOWED_LICENSE_REGEX"; then
      echo "Self-test failed: must reject ${bad}" >&2
      exit 1
    fi
  done
  echo "caddy Go license collector self-test passed (${CADDY_VERSION})."
  exit 0
fi

if [ -z "$OUT" ]; then
  echo "--out is required" >&2
  usage
fi
if ! printf '%s\n' "$CADDY_VERSION" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Invalid Caddy version: ${CADDY_VERSION}" >&2
  exit 1
fi
if ! command -v go >/dev/null 2>&1; then
  echo "go is required to collect Caddy module licenses" >&2
  exit 1
fi
if ! command -v git >/dev/null 2>&1; then
  echo "git is required to collect Caddy module licenses" >&2
  exit 1
fi

cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$WORKDIR" "$OUT/modules"
GOBIN="$WORKDIR/bin"
mkdir -p "$GOBIN"
export PATH="${GOBIN}:${PATH}"
export GOMODCACHE="${GOMODCACHE:-$WORKDIR/gomod}"
export GOCACHE="${GOCACHE:-$WORKDIR/gocache}"

echo "Installing go-licenses ${GO_LICENSES_VERSION}..."
go install "github.com/google/go-licenses@${GO_LICENSES_VERSION}"

SRC="$WORKDIR/caddy"
echo "Cloning caddyserver/caddy ${CADDY_VERSION}..."
git clone --depth 1 --branch "$CADDY_VERSION" \
  https://github.com/caddyserver/caddy.git "$SRC"
cd "$SRC"

echo "Downloading Go modules..."
go mod download

echo "Writing MODULES.csv..."
if ! go-licenses report ./cmd/caddy >"$OUT/MODULES.csv" 2>"$WORKDIR/go-licenses-report.log"; then
  echo "go-licenses report failed:" >&2
  cat "$WORKDIR/go-licenses-report.log" >&2
  exit 1
fi

echo "Validating module license types..."
FORBIDDEN="$(
  awk -F, -v re="$ALLOWED_LICENSE_REGEX" '
    NF < 3 { next }
    {
      lic = $3
      gsub(/\r/, "", lic)
      if (lic !~ re) print
    }
  ' "$OUT/MODULES.csv"
)"
if [ -n "$FORBIDDEN" ]; then
  echo "Caddy Go modules include licenses outside the reviewed allowlist:" >&2
  printf '%s\n' "$FORBIDDEN" >&2
  exit 1
fi

MODULE_COUNT="$(wc -l <"$OUT/MODULES.csv" | tr -d ' ')"
if [ "$MODULE_COUNT" -lt 50 ]; then
  echo "Expected dozens of Caddy Go modules, found ${MODULE_COUNT}" >&2
  exit 1
fi

echo "Saving license texts under modules/..."
if ! go-licenses save ./cmd/caddy --save_path="$OUT/modules" --force \
  2>"$WORKDIR/go-licenses-save.log"; then
  echo "go-licenses save failed:" >&2
  cat "$WORKDIR/go-licenses-save.log" >&2
  exit 1
fi

LICENSE_FILES="$(find "$OUT/modules" -type f | wc -l | tr -d ' ')"
if [ "$LICENSE_FILES" -lt 50 ]; then
  echo "Expected dozens of saved license files, found ${LICENSE_FILES}" >&2
  exit 1
fi

if [ ! -f "$OUT/LICENSE" ]; then
  if [ -f "$SRC/LICENSE" ]; then
    cp "$SRC/LICENSE" "$OUT/LICENSE"
  else
    echo "Missing Caddy LICENSE in upstream checkout" >&2
    exit 1
  fi
fi

# MPL-2.0 section 3.2 requires Executable Form recipients to be told how to
# obtain Source Code Form. Ship the exact resolved module directories.
MPL_PACKAGES="$(
  awk -F, '$3 == "MPL-2.0" { print $1 }' "$OUT/MODULES.csv" | sort -u
)"
MPL_SOURCE_NOTES=""
MPL_SOURCE_COUNT=0
if [ -n "$MPL_PACKAGES" ]; then
  mkdir -p "$OUT/mpl-source"
  printf 'module\tversion\tarchive\tsha256\tupstream\n' >"$OUT/mpl-source/MANIFEST.tsv"
  printf '%s\n' "$MPL_PACKAGES" >"$WORKDIR/mpl-packages.txt"

  while IFS= read -r pkg; do
    [ -n "$pkg" ] || continue
    mod_line="$(go list -f '{{.Module.Path}} {{.Module.Version}} {{.Module.Dir}}' "$pkg")"
    mod_path="$(printf '%s\n' "$mod_line" | awk '{ print $1 }')"
    mod_version="$(printf '%s\n' "$mod_line" | awk '{ print $2 }')"
    mod_dir="$(printf '%s\n' "$mod_line" | awk '{ print $3 }')"
    if [ -z "$mod_path" ] || [ -z "$mod_version" ] || [ ! -d "$mod_dir" ]; then
      echo "Could not resolve module dir for MPL package ${pkg}" >&2
      exit 1
    fi
    archive_name="$(printf '%s' "${mod_path}@${mod_version}" | tr '/' '_').tar.gz"
    archive_path="$OUT/mpl-source/${archive_name}"
    tar -czf "$archive_path" -C "$mod_dir" .
    sha="$(sha256sum "$archive_path" | awk '{ print $1 }')"
    upstream="https://proxy.golang.org/${mod_path}/@v/${mod_version}.zip"
    if printf '%s' "$mod_path" | grep -q '^github.com/'; then
      gh_path="${mod_path#github.com/}"
      upstream="https://github.com/${gh_path}/tree/${mod_version}"
    fi
    printf '%s\t%s\t%s\t%s\t%s\n' \
      "$mod_path" "$mod_version" "$archive_name" "$sha" "$upstream" \
      >>"$OUT/mpl-source/MANIFEST.tsv"
    echo "Packaged MPL source ${mod_path}@${mod_version} -> ${archive_name}"
  done <"$WORKDIR/mpl-packages.txt"

  MPL_SOURCE_COUNT="$(
    awk 'NR > 1 { count++ } END { print count + 0 }' "$OUT/mpl-source/MANIFEST.tsv"
  )"
  if [ "$MPL_SOURCE_COUNT" -lt 1 ]; then
    echo "MPL-2.0 modules were listed but no source archives were written" >&2
    exit 1
  fi

  MPL_SOURCE_NOTES="$(
    awk -F '\t' 'NR > 1 {
      printf "  %s@%s\n    Archive: /licenses/caddy/mpl-source/%s\n    SHA-256: %s\n    Upstream: %s\n", $1, $2, $3, $4, $5
    }' "$OUT/mpl-source/MANIFEST.tsv"
  )"
fi

LICENSE_HISTOGRAM="$(
  awk -F, '{ print $3 }' "$OUT/MODULES.csv" | sort | uniq -c | sort -rn \
    | sed 's/^/  /'
)"

{
  echo "Caddy Go module notices"
  echo
  echo "Caddy version: ${CADDY_VERSION}"
  echo "Binary package inspected: github.com/caddyserver/caddy/v2/cmd/caddy"
  echo "Collector: github.com/google/go-licenses@${GO_LICENSES_VERSION}"
  echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "The admin-ui image embeds the stock Caddy ${CADDY_VERSION#v} binary from"
  echo "docker.io/library/caddy:${CADDY_VERSION#v}-alpine. Module licenses below"
  echo "come from the matching caddyserver/caddy ${CADDY_VERSION} go.mod graph."
  echo "Caddy itself is Apache-2.0 (see /licenses/caddy/LICENSE and"
  echo "/licenses/Apache-2.0.txt)."
  echo
  echo "This directory preserves license texts for the Go modules linked into that"
  echo "binary (${MODULE_COUNT} packages in MODULES.csv; ${LICENSE_FILES} files under"
  echo "modules/). Inventory:"
  echo
  echo "  /licenses/caddy/LICENSE      — Caddy project license"
  echo "  /licenses/caddy/MODULES.csv  — package, license URL, SPDX id"
  echo "  /licenses/caddy/modules/     — copied upstream LICENSE/NOTICE files"
  echo "  /licenses/caddy/mpl-source/  — Source Code Form for MPL-2.0 modules"
  echo
  echo "Declared SPDX license counts:"
  echo "$LICENSE_HISTOGRAM"
  echo
  if [ "$MPL_SOURCE_COUNT" -gt 0 ]; then
    echo "MPL-2.0 Covered Software (unmodified; Source Code Form shipped here):"
    echo
    printf '%s\n' "$MPL_SOURCE_NOTES"
    echo "See /licenses/caddy/mpl-source/MANIFEST.tsv."
    echo
  fi
  echo "All listed SPDX ids were checked against SliceSeeker's reviewed allowlist."
  echo "Strong copyleft (GPL/LGPL/AGPL) fails the image build."
} >"$OUT/NOTICE"

echo "Wrote Caddy Go module notices to ${OUT} (${MODULE_COUNT} modules, ${LICENSE_FILES} files, ${MPL_SOURCE_COUNT} MPL source archive(s))"
