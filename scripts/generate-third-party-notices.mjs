#!/usr/bin/env node
/**
 * Generate a full third-party attribution disclaimer (license texts included)
 * via @quantco/pnpm-licenses. Intended for image builds / CI — do not commit output.
 *
 * Usage:
 *   node scripts/generate-third-party-notices.mjs \
 *     --filter worker... \
 *     --component indexer-worker \
 *     --out /licenses/THIRD_PARTY_NOTICES
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const PNPM_LICENSES_PKG = "@quantco/pnpm-licenses@2.4.2";

/** SPDX ids that warrant a short callout (full texts still appear in the body). */
const NOTABLE_LICENSE =
  /\b(LGPL|AGPL|GPL-([23]|2\.0|3\.0)|MPL|EPL|CDDL|SSPL|OSL|EUPL)\b/i;

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  return args[i + 1] ?? fallback;
};

const filter = getArg("--filter");
const component = getArg("--component", filter ?? "sliceseeker");
const outPath = resolve(getArg("--out", "THIRD_PARTY_NOTICES"));

if (!filter) {
  console.error(
    "Missing required --filter (e.g. server... client... worker... search... db...)",
  );
  process.exit(1);
}

const licensesJson = spawnSync(
  "pnpm",
  ["licenses", "list", "--filter", filter, "--prod", "--json"],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

if (licensesJson.status !== 0) {
  console.error(
    licensesJson.stderr || licensesJson.stdout || "pnpm licenses list failed",
  );
  process.exit(licensesJson.status ?? 1);
}

const tmpJson = join(
  tmpdir(),
  `sliceseeker-licenses-${randomBytes(8).toString("hex")}.json`,
);
const tmpDisclaimer = join(
  tmpdir(),
  `sliceseeker-disclaimer-${randomBytes(8).toString("hex")}.txt`,
);
writeFileSync(tmpJson, licensesJson.stdout, "utf8");

const inventory = summarizeLicenses(JSON.parse(licensesJson.stdout));

// Exclude this monorepo's own packages from third-party attribution.
const excludeOwn = JSON.stringify([
  "sliceseeker",
  "server",
  "client",
  "worker",
  "search",
  "db",
  "queue",
  "search-client",
  "docs",
]);

const disclaimer = runPnpmLicenses([
  "generate-disclaimer",
  "--json-input-file",
  tmpJson,
  "--output-file",
  tmpDisclaimer,
  `--filter=${excludeOwn}`,
]);

if (disclaimer.status !== 0) {
  console.error(
    disclaimer.stderr ||
      disclaimer.stdout ||
      "pnpm-licenses generate-disclaimer failed",
  );
  process.exit(disclaimer.status ?? 1);
}

const body = readFileSync(tmpDisclaimer, "utf8");
const header = buildHeader(component, inventory);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, header + body, "utf8");
console.log(
  `Wrote ${outPath} (${Buffer.byteLength(header + body)} bytes; ${
    inventory.total
  } prod packages)`,
);

/**
 * @param {unknown} data pnpm `licenses list --json` object: { [spdx]: Package[] }
 */
function summarizeLicenses(data) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  /** @type {{ name: string, version: string, license: string }[]} */
  const notable = [];
  let total = 0;

  if (!data || typeof data !== "object") {
    return { total: 0, counts, notable };
  }

  for (const [license, pkgs] of Object.entries(data)) {
    if (!Array.isArray(pkgs)) continue;
    counts.set(license, (counts.get(license) ?? 0) + pkgs.length);
    total += pkgs.length;
    if (!NOTABLE_LICENSE.test(license)) continue;
    for (const pkg of pkgs) {
      const name = pkg?.name;
      if (typeof name !== "string") continue;
      const version = Array.isArray(pkg.versions)
        ? pkg.versions[0]
        : pkg.version;
      notable.push({
        name,
        version: typeof version === "string" ? version : "",
        license,
      });
    }
  }

  notable.sort((a, b) => a.name.localeCompare(b.name));
  return { total, counts, notable };
}

/**
 * @param {string} component
 * @param {{ total: number, counts: Map<string, number>, notable: { name: string, version: string, license: string }[] }} inventory
 */
function buildHeader(component, inventory) {
  const lines = [
    `Third-Party Notices for SliceSeeker (${component})`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "SliceSeeker itself is licensed under the MIT License; see /licenses/LICENSE.",
    "",
    "This file lists production npm dependencies redistributed with this",
    "component and includes their license texts. It is generated with",
    "@quantco/pnpm-licenses (https://github.com/Quantco/pnpm-licenses).",
    "",
    "OS packages and other bundled native components are NOT covered here. They",
    "are listed in /licenses/OS-PACKAGES-NOTICE and in the container SBOM.",
    "Source-location information is shipped under /licenses.",
    "Evidence for individually reviewed package-metadata gaps is retained under",
    "/licenses/evidence.",
    "",
  ];

  if (inventory.total > 0) {
    lines.push(`License summary (${inventory.total} packages by SPDX id):`);
    const sorted = [...inventory.counts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
    for (const [spdx, count] of sorted) {
      lines.push(`  ${count}  ${spdx}`);
    }
    lines.push("");
  }

  if (inventory.notable.length > 0) {
    lines.push(
      "Copyleft or similarly notable SPDX licenses in this inventory",
      "(full texts are included in the notices below):",
    );
    for (const pkg of inventory.notable) {
      const ver = pkg.version ? `@${pkg.version}` : "";
      lines.push(`  - ${pkg.name}${ver}  (${pkg.license})`);
    }
    lines.push("");
  }

  lines.push("".padEnd(72, "="), "", "");
  return lines.join("\n");
}

/**
 * Resolve @quantco/pnpm-licenses CLI: global install, pnpm exec, then npx pin.
 * @param {string[]} cliArgs
 */
function runPnpmLicenses(cliArgs) {
  const attempts = [
    ["pnpm-licenses", cliArgs],
    ["pnpm", ["exec", "pnpm-licenses", ...cliArgs]],
    ["npx", ["--yes", PNPM_LICENSES_PKG, ...cliArgs]],
  ];

  let last = null;
  for (const [cmd, cmdArgs] of attempts) {
    last = spawnSync(cmd, cmdArgs, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (last.status === 0) return last;
    if (last.error?.code === "ENOENT") continue;
    if (
      /not found|Cannot find|ERR_PNPM|npm error/i.test(
        `${last.stderr ?? ""}${last.stdout ?? ""}`,
      )
    ) {
      continue;
    }
    return last;
  }
  return last ?? { status: 1, stderr: "pnpm-licenses CLI not available" };
}
