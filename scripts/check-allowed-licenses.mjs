#!/usr/bin/env node
/**
 * Hard-fail if any production dependency uses a license outside the allowlist.
 *
 * Usage:
 *   node scripts/check-allowed-licenses.mjs
 *   node scripts/check-allowed-licenses.mjs --filter worker...
 *
 * With no --filter, checks every pnpm filter that ends up inside a shipped image.
 *
 * This only covers npm dependency trees. OS packages from the container base
 * are handled by licenses/OS-PACKAGES-NOTICE and the per-image SBOM. The
 * worker's custom LGPL FFmpeg is handled separately in its image. Keeping those
 * categories out of this allowlist ensures a stray GPL npm package still fails.
 */
import { spawnSync } from "node:child_process";

/**
 * SPDX license ids / expressions permitted in shipped prod dependency trees.
 * Keep tight: add here deliberately when a new dep needs a new id.
 */
const ALLOWED_LICENSES = new Set([
  "MIT",
  "MIT-0",
  "Apache-2.0",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "BlueOak-1.0.0",
  "Python-2.0",
  "CC0-1.0",
  "CC-BY-4.0",
  "OFL-1.1",
  "Unlicense",
  // Weak / file-level copyleft. Strong copyleft (GPL/AGPL/SSPL/…) is not listed.
  // MPL-2.0: lightningcss (vite / tailwind). LGPL kept for native prebuilds.
  "LGPL-3.0-or-later",
  "LGPL-3.0",
  "LGPL-2.1-or-later",
  "LGPL-2.1",
  "MPL-2.0",
]);

/**
 * Packages whose upstream package.json omits SPDX (`Unknown` from `pnpm licenses`).
 * Do not add `Unknown` to ALLOWED_LICENSES — that would hide every future gap.
 * Notices still attribute whatever license text pnpm-licenses finds on disk.
 */
const ALLOWED_UNKNOWN_PACKAGES = new Set([
  // MIT stated in Readme.md; package.json has no "license" field.
  // Reached via client -> @uppy/tus -> tus-js-client.
  "combine-errors",
]);

/** Workspace packages are not third-party; skip if they appear in the inventory. */
const OWN_PACKAGE =
  /^(sliceseeker|server|client|worker|search|db|queue|search-client|docs)$/;

const DEFAULT_FILTERS = [
  "server...",
  "client...",
  "worker...",
  "search...",
  "db...",
];

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  return args[i + 1] ?? fallback;
};

const filterArg = getArg("--filter");
const filters = filterArg ? [filterArg] : DEFAULT_FILTERS;

let failed = false;

for (const filter of filters) {
  const result = checkFilter(filter);
  if (!result.ok) failed = true;
}

process.exit(failed ? 1 : 0);

/**
 * @param {string} filter
 */
function checkFilter(filter) {
  const licensesJson = spawnSync(
    "pnpm",
    ["licenses", "list", "--filter", filter, "--prod", "--json"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );

  if (licensesJson.status !== 0) {
    console.error(
      `[${filter}] pnpm licenses list failed:\n${
        licensesJson.stderr || licensesJson.stdout || "(no output)"
      }`,
    );
    return { ok: false };
  }

  let data;
  try {
    data = JSON.parse(licensesJson.stdout);
  } catch (err) {
    console.error(`[${filter}] invalid JSON from pnpm licenses list:`, err);
    return { ok: false };
  }

  /** @type {{ name: string, version: string, license: string }[]} */
  const violations = [];
  /** @type {{ name: string, version: string }[]} */
  const unknownWaivers = [];
  let total = 0;

  for (const [license, pkgs] of Object.entries(data ?? {})) {
    if (!Array.isArray(pkgs)) continue;
    for (const pkg of pkgs) {
      const name = pkg?.name;
      if (typeof name !== "string" || OWN_PACKAGE.test(name)) continue;
      total += 1;
      if (isAllowed(license)) continue;
      const version = Array.isArray(pkg.versions)
        ? pkg.versions[0]
        : pkg.version;
      const ver = typeof version === "string" ? version : "";
      if (license === "Unknown" && ALLOWED_UNKNOWN_PACKAGES.has(name)) {
        unknownWaivers.push({ name, version: ver });
        continue;
      }
      violations.push({ name, version: ver, license });
    }
  }

  violations.sort(
    (a, b) =>
      a.license.localeCompare(b.license) || a.name.localeCompare(b.name),
  );
  unknownWaivers.sort((a, b) => a.name.localeCompare(b.name));

  if (violations.length === 0) {
    console.log(
      `[${filter}] OK — ${total} prod packages; all licenses allowlisted.`,
    );
    for (const w of unknownWaivers) {
      const ver = w.version ? `@${w.version}` : "";
      console.log(
        `[${filter}] note — ${w.name}${ver} has SPDX Unknown (waived in ALLOWED_UNKNOWN_PACKAGES)`,
      );
    }
    return { ok: true };
  }

  console.error(
    `[${filter}] FAILED — ${violations.length} package(s) use licenses outside the allowlist:`,
  );
  for (const v of violations) {
    const ver = v.version ? `@${v.version}` : "";
    console.error(`  - ${v.name}${ver}  (${v.license})`);
  }
  console.error(
    `\nAllowed SPDX ids:\n${[...ALLOWED_LICENSES]
      .sort()
      .map((l) => `  ${l}`)
      .join("\n")}`,
  );
  console.error(
    "\nIf this license is intentionally acceptable, add it to ALLOWED_LICENSES in scripts/check-allowed-licenses.mjs.",
  );
  return { ok: false };
}

/**
 * Dual-license "A OR B": allowed if any alternative is allowed.
 * Conjunction "A AND B": allowed only if every part is allowed.
 * @param {string} expression
 */
function isAllowed(expression) {
  const trimmed = expression.trim();
  if (!trimmed || trimmed === "Unknown") return false;
  if (ALLOWED_LICENSES.has(trimmed)) return true;

  const unwrapped = unwrapParens(trimmed);
  if (unwrapped !== trimmed) return isAllowed(unwrapped);

  if (/\s+OR\s+/i.test(unwrapped)) {
    return splitTopLevel(unwrapped, "OR").some((part) => isAllowed(part));
  }
  if (/\s+AND\s+/i.test(unwrapped)) {
    return splitTopLevel(unwrapped, "AND").every((part) => isAllowed(part));
  }

  return false;
}

/** @param {string} s */
function unwrapParens(s) {
  let out = s.trim();
  while (out.startsWith("(") && out.endsWith(")") && balanced(out)) {
    out = out.slice(1, -1).trim();
  }
  return out;
}

/** @param {string} s */
function balanced(s) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") {
      depth--;
      if (depth === 0 && i !== s.length - 1) return false;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

/**
 * @param {string} expression
 * @param {"OR" | "AND"} op
 */
function splitTopLevel(expression, op) {
  const parts = [];
  let depth = 0;
  let start = 0;
  const re = op === "OR" ? /\s+OR\s+/gi : /\s+AND\s+/gi;
  let match;
  const copy = expression;
  re.lastIndex = 0;
  while ((match = re.exec(copy)) !== null) {
    const idx = match.index;
    depth = 0;
    for (let i = 0; i < idx; i++) {
      if (copy[i] === "(") depth++;
      else if (copy[i] === ")") depth--;
    }
    if (depth !== 0) continue;
    parts.push(copy.slice(start, idx).trim());
    start = idx + match[0].length;
  }
  parts.push(copy.slice(start).trim());
  return parts.filter(Boolean);
}
