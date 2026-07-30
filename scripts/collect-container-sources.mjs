#!/usr/bin/env node
/**
 * Collect exact corresponding source for GPL-family Alpine packages in one
 * final container image.
 *
 * The output is intentionally an intermediate, mergeable directory. CI runs
 * this before pushing an image, then package-corresponding-source.mjs combines
 * the five component directories into one release archive.
 *
 * Usage:
 *   node scripts/collect-container-sources.mjs \
 *     --component indexer-api \
 *     --image sliceseeker-indexer-api:build \
 *     --output compliance \
 *     --merge
 *
 * After pushing, add the immutable registry digest without downloading source
 * again:
 *   node scripts/collect-container-sources.mjs \
 *     --component indexer-api \
 *     --output compliance-indexer-api \
 *     --finalize-digest ghcr.io/owner/image@sha256:...
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

process.on("uncaughtException", (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

const APPORTS_URL = "https://github.com/alpinelinux/aports.git";
const COMPONENT_RE = /^[a-z0-9][a-z0-9-]*$/;
const PACKAGE_RE = /^[A-Za-z0-9+_.-]+$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;
const DIGEST_REF_RE = /^.+@sha256:[0-9a-f]{64}$/;
const GPL_FAMILY_RE = /\b(?:A?GPL|LGPL)(?:[-+.0-9]|$)/i;

const args = process.argv.slice(2);
if (args.includes("--self-test")) {
  const commit = "0123456789abcdef0123456789abcdef01234567";
  const parsed = parseInstalledDatabase(
    [
      "P:busybox",
      "V:1.37.0-r0",
      "A:x86_64",
      "L:GPL-2.0-only",
      "o:busybox",
      `c:${commit}`,
      "",
      "P:musl",
      "V:1.2.5-r0",
      "A:x86_64",
      "L:MIT",
      "o:musl",
      `c:${commit}`,
      "",
    ].join("\n"),
  );
  if (
    parsed.length !== 2 ||
    parsed[0].origin !== "busybox" ||
    parsed[0].commit !== commit ||
    !GPL_FAMILY_RE.test(parsed[0].license) ||
    GPL_FAMILY_RE.test(parsed[1].license) ||
    groupBySource(parsed.slice(0, 1)).size !== 1
  ) {
    fail("Collector parser self-test failed.");
  }
  console.log("Collector parser self-test passed.");
  process.exit(0);
}

const component = getArg("--component");
const image = getArg("--image");
const outputArg = getArg("--output");
const output = outputArg ? resolve(outputArg) : "";
const finalizeDigest = getArg("--finalize-digest");
const merge = args.includes("--merge");

if (!component || !COMPONENT_RE.test(component)) {
  fail("Provide --component using lowercase letters, numbers, and hyphens.");
}
if (!output) fail("Provide --output.");

const componentFile = join(output, "components", `${component}.json`);

if (finalizeDigest) {
  if (!DIGEST_REF_RE.test(finalizeDigest)) {
    fail("--finalize-digest must be an image@sha256:... reference.");
  }
  if (!existsSync(componentFile)) {
    fail(`Cannot finalize missing component metadata: ${componentFile}`);
  }
  const metadata = JSON.parse(readFileSync(componentFile, "utf8"));
  metadata.image.digestRef = finalizeDigest;
  writeJson(componentFile, metadata);
  console.log(`Recorded immutable digest for ${component}: ${finalizeDigest}`);
  process.exit(0);
}

if (!image) fail("Provide --image unless --finalize-digest is used.");
if (existsSync(output) && !merge) {
  fail(`Output already exists; refusing to mix compliance data: ${output}`);
}
if (existsSync(componentFile)) {
  fail(`Component compliance data already exists: ${componentFile}`);
}

const temp = mkdtempSync(join(tmpdir(), `sliceseeker-${component}-`));
const extracted = join(temp, "image");
const installedFile = join(extracted, "installed");
const alpineReleaseFile = join(extracted, "alpine-release");
const noticesDir = join(output, "notices", component);
const sourceRoot = join(output, "corresponding-source");
const aportsRepo = join(temp, "aports");
let containerId = "";

try {
  mkdirSync(extracted, { recursive: true });
  mkdirSync(noticesDir, { recursive: true });
  mkdirSync(sourceRoot, { recursive: true });

  const imageInspect = JSON.parse(
    run("docker", ["image", "inspect", image], { capture: true }),
  )[0];
  if (!imageInspect) fail(`Docker image not found: ${image}`);

  containerId = run("docker", ["create", image], { capture: true }).trim();
  run("docker", [
    "cp",
    `${containerId}:/lib/apk/db/installed`,
    installedFile,
  ]);
  run("docker", [
    "cp",
    `${containerId}:/etc/alpine-release`,
    alpineReleaseFile,
  ]);
  run("docker", ["cp", `${containerId}:/licenses/.`, noticesDir]);
  run("docker", ["rm", containerId]);
  containerId = "";

  const packages = parseInstalledDatabase(
    readFileSync(installedFile, "utf8"),
  );
  const alpineVersion = readFileSync(alpineReleaseFile, "utf8").trim();
  if (!/^\d+\.\d+\.\d+$/.test(alpineVersion)) {
    fail(`Invalid Alpine release in ${image}: ${alpineVersion}`);
  }
  const collectorImage = `alpine:${alpineVersion.split(".").slice(0, 2).join(".")}`;
  const coveredPackages = packages.filter((pkg) =>
    GPL_FAMILY_RE.test(pkg.license),
  );

  for (const pkg of coveredPackages) {
    if (!PACKAGE_RE.test(pkg.origin)) {
      fail(`Unsafe or missing Alpine origin for ${pkg.name}: ${pkg.origin}`);
    }
    if (!COMMIT_RE.test(pkg.commit)) {
      fail(
        `${pkg.name}@${pkg.version} is ${pkg.license}, but its installed ` +
          `metadata has no valid aports commit.`,
      );
    }
  }

  const sourceGroups = groupBySource(coveredPackages);
  const missingSourceGroups = [...sourceGroups].filter(
    ([, groupedPackages]) => {
      const { origin, commit } = groupedPackages[0];
      return !existsSync(
        join(sourceRoot, "alpine", origin, commit, ".verified"),
      );
    },
  );
  if (missingSourceGroups.length > 0) {
    run("git", ["init", "--quiet", aportsRepo]);
    run("git", [
      "-C",
      aportsRepo,
      "remote",
      "add",
      "origin",
      APPORTS_URL,
    ]);
  }

  /** @type {string[]} */
  const fetchList = [];
  const pathsByKey = new Map();
  const fetchedCommits = new Set();
  const verificationMarkers = [];

  for (const [key, groupedPackages] of sourceGroups) {
    const { origin, commit } = groupedPackages[0];
    const groupRoot = join(sourceRoot, "alpine", origin, commit);
    const marker = join(groupRoot, ".verified");
    if (existsSync(marker)) {
      pathsByKey.set(key, JSON.parse(readFileSync(marker, "utf8")));
      continue;
    }

    if (!fetchedCommits.has(commit)) {
      fetchCommit(aportsRepo, commit);
      fetchedCommits.add(commit);
    }
    const aportPath = locateAport(aportsRepo, commit, origin);
    const recipeRoot = join(groupRoot, "aports");
    const distfilesRoot = join(groupRoot, "distfiles");
    const archive = join(temp, `${origin}-${commit}.tar`);

    mkdirSync(recipeRoot, { recursive: true });
    mkdirSync(distfilesRoot, { recursive: true });
    run("git", [
      "-C",
      aportsRepo,
      "archive",
      "--format=tar",
      `--output=${archive}`,
      commit,
      aportPath,
    ]);
    run("tar", ["-xf", archive, "-C", recipeRoot]);

    const recipeRelative = relative(sourceRoot, join(recipeRoot, aportPath));
    const distfilesRelative = relative(sourceRoot, distfilesRoot);
    fetchList.push(`${recipeRelative}\t${distfilesRelative}`);
    const sourcePaths = {
      recipe: `alpine/${origin}/${commit}/aports/${aportPath}`,
      distfiles: `alpine/${origin}/${commit}/distfiles`,
    };
    pathsByKey.set(key, sourcePaths);
    verificationMarkers.push({ marker, sourcePaths });
  }

  if (fetchList.length > 0) {
    writeFileSync(
      join(sourceRoot, ".fetch-list"),
      `${fetchList.join("\n")}\n`,
      "utf8",
    );
    fetchAndVerifySources(sourceRoot, collectorImage);
    rmSync(join(sourceRoot, ".fetch-list"), { force: true });
    for (const verified of verificationMarkers) {
      writeFileSync(
        verified.marker,
        `${JSON.stringify(verified.sourcePaths)}\n`,
        "utf8",
      );
    }
  }

  const ffmpegSource = join(noticesDir, "ffmpeg");
  if (existsSync(ffmpegSource)) {
    cpSync(ffmpegSource, join(sourceRoot, "custom", "ffmpeg"), {
      recursive: true,
    });
  }

  const architecture =
    imageInspect.Architecture ?? packages[0]?.architecture ?? "unknown";
  const labels = imageInspect.Config?.Labels ?? {};
  const metadata = {
    schemaVersion: 1,
    component,
    image: {
      buildReference: image,
      configDigest: imageInspect.Id ?? null,
      digestRef: null,
      architecture,
      version: labels["org.opencontainers.image.version"] ?? null,
      revision: labels["org.opencontainers.image.revision"] ?? null,
      baseName: labels["org.opencontainers.image.base.name"] ?? null,
      alpineVersion,
    },
    installedPackageCount: packages.length,
    correspondingSourcePackages: coveredPackages.map((pkg) => ({
      name: pkg.name,
      version: pkg.version,
      architecture: pkg.architecture || architecture,
      origin: pkg.origin,
      declaredLicense: pkg.license,
      aportsCommit: pkg.commit,
      correspondingSource: pathsByKey.get(sourceKey(pkg)),
    })),
  };

  writeJson(componentFile, metadata);
  console.log(
    `Collected ${sourceGroups.size} Alpine source origin(s) for ` +
      `${coveredPackages.length} GPL-family package(s) in ${component}.`,
  );
} finally {
  if (containerId) {
    spawnSync("docker", ["rm", "-f", containerId], { stdio: "ignore" });
  }
  rmSync(temp, { recursive: true, force: true });
}

function fetchCommit(repo, commit) {
  const result = spawnSync(
    "git",
    [
      "-C",
      repo,
      "fetch",
      "--quiet",
      "--depth=1",
      "--filter=blob:none",
      "origin",
      commit,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    fail(
      `Could not fetch aports commit ${commit}. The exact source cannot be ` +
        `published.\n${result.stderr || result.stdout}`,
    );
  }
}

function locateAport(repo, commit, origin) {
  const listing = run(
    "git",
    ["-C", repo, "ls-tree", "-r", "--name-only", commit],
    { capture: true },
  );
  const suffix = `/${origin}/APKBUILD`;
  const matches = listing
    .split("\n")
    .filter((path) => path.endsWith(suffix))
    .map((path) => dirname(path));

  if (matches.length !== 1) {
    fail(
      `Expected exactly one aports recipe for ${origin} at ${commit}; found ` +
        `${matches.length}${matches.length ? `: ${matches.join(", ")}` : ""}.`,
    );
  }
  return matches[0];
}

function fetchAndVerifySources(root, collectorImage) {
  // abuild tries DISTFILES_MIRROR/<basename> before each upstream URL. Prefer
  // Alpine's own distfiles cache for the image branch — same bytes Alpine
  // builders use, checksummed by APKBUILD. Avoid one-off third-party mirrors
  // that might lag behind Alpine pkgver bumps and 404.
  const alpineSeries = collectorImage.replace(/^alpine:/, "");
  if (!/^\d+\.\d+$/.test(alpineSeries)) {
    fail(`Unexpected collector image for source fetch: ${collectorImage}`);
  }
  const distfilesMirror =
    `https://distfiles.alpinelinux.org/distfiles/v${alpineSeries}`;

  const script = [
    "set -eu",
    "apk add --no-cache alpine-sdk",
    // abuild uses BusyBox wget (no GNU --tries/--retry-connrefused). Wrap
    // with a shell retry loop; -T is the BusyBox read-timeout flag. CI runners
    // often hit transient resets/timeouts on upstream distfiles. Do not retry
    // HTTP 4xx — those are permanent and burn the outer abuild retry budget.
    "mkdir -p /usr/local/bin",
    "printf '%s\\n' " +
      "'#!/bin/sh' " +
      "'n=0' " +
      "'while [ \"$n\" -lt 3 ]; do' " +
      "'  n=\$((n + 1))' " +
      "'  err=\$(mktemp)' " +
      "'  if /usr/bin/wget -T 60 \"$@\" 2>\"$err\"; then' " +
      "'    cat \"$err\" >&2' " +
      "'    rm -f \"$err\"' " +
      "'    exit 0' " +
      "'  fi' " +
      "'  cat \"$err\" >&2' " +
      "'  if grep -q \"HTTP/[0-9.]* 4[0-9][0-9]\" \"$err\"; then' " +
      "'    rm -f \"$err\"' " +
      "'    exit 1' " +
      "'  fi' " +
      "'  rm -f \"$err\"' " +
      "'  [ \"$n\" -lt 3 ] || break' " +
      "'  echo \"wget failed (attempt $n); retrying...\" >&2' " +
      "'  sleep \$((n * 2))' " +
      "'done' " +
      "'exit 1' " +
      ">/usr/local/bin/wget",
    "chmod +x /usr/local/bin/wget",
    "export PATH=\"/usr/local/bin:$PATH\"",
    `export DISTFILES_MIRROR="${distfilesMirror}"`,
    "tab=\"$(printf '\\t')\"",
    "while IFS=\"$tab\" read -r recipe distfiles; do",
    '  [ -n "$recipe" ] || continue',
    '  mkdir -p "/source/$distfiles"',
    // Outer retry: covers verify failures after the wget wrapper's tries.
    "  ok=0",
    "  for attempt in 1 2; do",
    '    if (cd "/source/$recipe" && SRCDEST="/source/$distfiles" abuild -F verify); then',
    "      ok=1",
    "      break",
    "    fi",
    '    [ "$attempt" -lt 2 ] || break',
    '    echo "abuild verify failed for $recipe (attempt $attempt); retrying..." >&2',
    "    sleep $((attempt * 15))",
    "  done",
    '  [ "$ok" -eq 1 ]',
    '  rm -rf "/source/$recipe/src"',
    "done </source/.fetch-list",
    "chmod -R a+rX /source",
  ].join("\n");

  run("docker", [
    "run",
    "--rm",
    "-v",
    `${root}:/source`,
    collectorImage,
    "sh",
    "-ceu",
    script,
  ]);
}

function parseInstalledDatabase(contents) {
  return contents
    .split(/\n\n+/)
    .map((record) => {
      const fields = new Map();
      for (const line of record.split("\n")) {
        if (line.length >= 2 && line[1] === ":") {
          fields.set(line[0], line.slice(2));
        }
      }
      const name = fields.get("P") ?? "";
      return {
        name,
        version: fields.get("V") ?? "",
        architecture: fields.get("A") ?? "",
        license: fields.get("L") ?? "",
        origin: fields.get("o") || name,
        commit: fields.get("c") ?? "",
      };
    })
    .filter((pkg) => pkg.name);
}

function groupBySource(packages) {
  const groups = new Map();
  for (const pkg of packages) {
    const key = sourceKey(pkg);
    const group = groups.get(key) ?? [];
    group.push(pkg);
    groups.set(key, group);
  }
  return groups;
}

function sourceKey(pkg) {
  return `${pkg.origin}\0${pkg.commit}`;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) fail(`${command} failed: ${result.error.message}`);
  if (result.status !== 0) {
    fail(
      `${command} ${commandArgs.join(" ")} failed with status ` +
        `${result.status}${options.capture ? `:\n${result.stderr}` : ""}`,
    );
  }
  return result.stdout ?? "";
}

function getArg(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function fail(message) {
  throw new Error(message);
}
