#!/bin/sh
# Preserve license files for software inherited from the official Node image or
# installed by Corepack. These files are outside Alpine's apk database and the
# application's pnpm dependency inventory.

set -eu

OUT="${1:-/licenses/runtime}"
mkdir -p "$OUT"

copy_first_license() {
  label="$1"
  source_dir="$2"
  destination="$3"

  for filename in LICENSE LICENSE.md LICENSE.txt LICENCE LICENCE.md; do
    if [ -f "${source_dir}/${filename}" ]; then
      mkdir -p "$(dirname "${destination}")"
      cp "${source_dir}/${filename}" "${destination}"
      return 0
    fi
  done

  echo "Missing bundled license for ${label} under ${source_dir}" >&2
  return 1
}

NODE_VERSION="$(node --version)"
copy_first_license "Node.js" /usr/local "${OUT}/nodejs/LICENSE"

NPM_VERSION="$(npm --version)"
copy_first_license \
  "npm" \
  /usr/local/lib/node_modules/npm \
  "${OUT}/npm/LICENSE"

YARN_VERSION="not installed"
for yarn_dir in /opt/yarn-v*; do
  if [ -d "$yarn_dir" ]; then
    # Call the classic Yarn binary directly. PATH may resolve to a Corepack
    # shim that refuses to run when package.json pins packageManager=pnpm.
    if [ -x "${yarn_dir}/bin/yarn" ]; then
      YARN_VERSION="$("${yarn_dir}/bin/yarn" --version)"
    else
      YARN_VERSION="$(basename "$yarn_dir" | sed 's/^yarn-v//')"
    fi
    copy_first_license "Yarn" "$yarn_dir" "${OUT}/yarn/LICENSE"
    break
  fi
done

COREPACK_VERSION="not installed"
if command -v corepack >/dev/null 2>&1; then
  COREPACK_VERSION="$(corepack --version)"
  copy_first_license \
    "Corepack" \
    /usr/local/lib/node_modules/corepack \
    "${OUT}/corepack/LICENSE"
fi

PNPM_VERSION="not installed"
pnpm_license_found=false
for pnpm_dir in /root/.cache/node/corepack/v1/pnpm/*; do
  if [ -d "$pnpm_dir" ]; then
    PNPM_VERSION="$(basename "$pnpm_dir")"
    copy_first_license "pnpm" "$pnpm_dir" "${OUT}/pnpm/LICENSE"
    pnpm_license_found=true
    break
  fi
done
if command -v pnpm >/dev/null 2>&1 && [ "$pnpm_license_found" != true ]; then
  echo "Could not locate the Corepack pnpm license cache." >&2
  exit 1
fi

cat >"${OUT}/NOTICE" <<EOF
Bundled runtimes and package-management tools outside Alpine apk:

  Node.js ${NODE_VERSION}
    License: /licenses/runtime/nodejs/LICENSE
    Source and releases: https://github.com/nodejs/node

  npm ${NPM_VERSION}
    License: /licenses/runtime/npm/LICENSE
    Source: https://github.com/npm/cli

  Yarn ${YARN_VERSION}
    License: /licenses/runtime/yarn/LICENSE (when installed)
    Source: https://github.com/yarnpkg/yarn

  Corepack ${COREPACK_VERSION}
    License: /licenses/runtime/corepack/LICENSE (when installed)
    Source: https://github.com/nodejs/corepack

  pnpm ${PNPM_VERSION}
    License: /licenses/runtime/pnpm/LICENSE (when installed)
    Source: https://github.com/pnpm/pnpm

The Node.js LICENSE also contains notices for libraries bundled into the Node.js
binary. These components are not represented by /lib/apk/db/installed.
EOF

echo "Wrote Node runtime notices to ${OUT}"
