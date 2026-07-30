#!/usr/bin/env node
/**
 * Merge per-image compliance outputs and create one release source archive plus
 * an external digest-to-source manifest.
 *
 * Usage:
 *   node scripts/package-corresponding-source.mjs \
 *     --input downloaded-artifacts \
 *     --output release-assets \
 *     --version 1.0.0 \
 *     --revision "$GITHUB_SHA" \
 *     --repository owner/repo \
 *     --require-digests
 *
 * Use --manifest-only after registry pushes to add immutable digests to the
 * external manifest without changing an already-published source archive.
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

process.on("uncaughtException", (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

const EXPECTED_COMPONENTS = [
  "admin-ui",
  "db-migrate",
  "indexer-api",
  "indexer-worker",
  "search-api",
];

const args = process.argv.slice(2);
const inputArg = getArg("--input");
const outputArg = getArg("--output");
const input = inputArg ? resolve(inputArg) : "";
const output = outputArg ? resolve(outputArg) : "";
const rawVersion = getArg("--version", "");
const revision = getArg("--revision", "unknown");
const repository = getArg("--repository", "");
const generatedAt = getArg("--generated-at", new Date().toISOString());
const requireDigests = args.includes("--require-digests");
const manifestOnly = args.includes("--manifest-only");

if (!input || !existsSync(input)) fail("Provide an existing --input directory.");
if (!output) fail("Provide --output.");
if (!/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(rawVersion)) {
  fail("Provide a safe --version.");
}
if (repository && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
  fail("--repository must be an owner/name pair.");
}
if (Number.isNaN(Date.parse(generatedAt))) {
  fail("--generated-at must be an ISO 8601 timestamp.");
}

const version = rawVersion.startsWith("v") ? rawVersion : `v${rawVersion}`;
const archiveBase = `sliceseeker-${version}-corresponding-source`;
const archiveName = `${archiveBase}.tar.zst`;
const manifestName = `sliceseeker-${version}-source-manifest.json`;
const temp = mkdtempSync(join(tmpdir(), "sliceseeker-source-release-"));
const archiveRoot = join(temp, archiveBase);

try {
  const componentFiles = findFiles(input, (path) =>
    /\/components\/[^/]+\.json$/.test(path),
  );
  const components = componentFiles.map((path) => ({
    path,
    root: dirname(dirname(path)),
    data: JSON.parse(readFileSync(path, "utf8")),
  }));
  components.sort((a, b) => a.data.component.localeCompare(b.data.component));

  const componentNames = components.map(({ data }) => data.component);
  if (
    componentNames.length !== EXPECTED_COMPONENTS.length ||
    componentNames.some((name, index) => name !== EXPECTED_COMPONENTS[index])
  ) {
    fail(
      `Expected compliance data for ${EXPECTED_COMPONENTS.join(", ")}; got ` +
        `${componentNames.join(", ") || "none"}.`,
    );
  }

  if (requireDigests) {
    for (const { data } of components) {
      if (!/^.+@sha256:[0-9a-f]{64}$/.test(data.image?.digestRef ?? "")) {
        fail(`Missing immutable image digest for ${data.component}.`);
      }
    }
  }

  const packages = components.flatMap(({ data }) =>
    data.correspondingSourcePackages.map((pkg) => ({
      component: data.component,
      imageDigest: data.image.digestRef,
      imageArchitecture: data.image.architecture,
      ...pkg,
    })),
  );
  const uniqueSources = [
    ...new Map(
      packages.map((pkg) => [
        `${pkg.origin}\0${pkg.aportsCommit}`,
        {
          origin: pkg.origin,
          aportsCommit: pkg.aportsCommit,
          paths: pkg.correspondingSource,
        },
      ]),
    ).values(),
  ].sort(
    (a, b) =>
      a.origin.localeCompare(b.origin) ||
      a.aportsCommit.localeCompare(b.aportsCommit),
  );

  const internalManifest = {
    schemaVersion: 1,
    generatedAt,
    project: "SliceSeeker",
    release: version,
    revision,
    purpose:
      "Corresponding source and build recipes for GPL-family software " +
      "conveyed in SliceSeeker container images.",
    images: components.map(({ data }) => {
      // Local build tags and config digests are intentionally excluded. They
      // are runner-specific; the external manifest receives the immutable
      // registry digest after publication.
      const { buildReference, configDigest, ...image } = data.image;
      void buildReference;
      void configDigest;
      return { component: data.component, ...image };
    }),
    packages,
    uniqueSources,
  };

  const archivePath = join(output, archiveName);
  if (!manifestOnly) {
    mkdirSync(archiveRoot, { recursive: true });
    const sourceRoots = new Set(
      components.map((component) =>
        join(component.root, "corresponding-source"),
      ),
    );
    for (const source of sourceRoots) {
      if (!existsSync(source)) {
        fail(`Missing corresponding-source directory: ${source}`);
      }
      mergeTree(source, archiveRoot);
    }

    writeJson(join(archiveRoot, "source-manifest.json"), internalManifest);
    writeFileSync(
      join(archiveRoot, "README.txt"),
      buildReadme(version, repository),
      "utf8",
    );

    const checksums = findFiles(archiveRoot, () => true)
      .filter((path) => !lstatSync(path).isSymbolicLink())
      .sort()
      .map(
        (path) =>
          `${sha256File(path)}  ${relative(archiveRoot, path).replaceAll("\\", "/")}`,
      );
    writeFileSync(
      join(archiveRoot, "SHA256SUMS"),
      `${checksums.join("\n")}\n`,
      "utf8",
    );

    mkdirSync(output, { recursive: true });
    createArchive(temp, archiveBase, archivePath);
  } else if (!existsSync(archivePath)) {
    fail(`--manifest-only requires the existing archive: ${archivePath}`);
  }

  const downloadBase =
    repository &&
    `https://github.com/${repository}/releases/download/${version}`;
  const externalManifest = {
    ...internalManifest,
    sourceArchive: {
      filename: archiveName,
      sha256: sha256File(archivePath),
      size: statSync(archivePath).size,
      downloadUrl: downloadBase ? `${downloadBase}/${archiveName}` : null,
    },
    manifestDownloadUrl: downloadBase
      ? `${downloadBase}/${manifestName}`
      : null,
    retentionPolicy:
      "Keep this source archive available while any mapped image is " +
      "distributed, and conservatively for at least three years after its " +
      "last distribution.",
  };
  writeJson(join(output, manifestName), externalManifest);

  console.log(
    `${manifestOnly ? "Updated the manifest for" : "Created"} ${archiveName} ` +
      `with ${uniqueSources.length} unique Alpine source origin(s) for ` +
      `${packages.length} installed package(s).`,
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}

function mergeTree(source, destination) {
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(to, { recursive: true });
      mergeTree(from, to);
      continue;
    }
    if (!entry.isFile() && !entry.isSymbolicLink()) {
      fail(`Unsupported source artifact type: ${from}`);
    }
    if (existsSync(to)) {
      if (entry.isSymbolicLink() || sha256File(from) !== sha256File(to)) {
        fail(`Conflicting corresponding-source files: ${from} and ${to}`);
      }
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { dereference: false });
  }
}

function createArchive(parent, directory, target) {
  const outputDir = dirname(target);
  const script = [
    "set -eu",
    "apk add --no-cache tar zstd",
    "tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 " +
      "--numeric-owner -cf - \"$ARCHIVE_DIR\" | zstd -19 -T0 > " +
      "\"/output/$ARCHIVE_NAME\"",
    "chmod 0644 \"/output/$ARCHIVE_NAME\"",
  ].join("\n");
  run("docker", [
    "run",
    "--rm",
    "-e",
    `ARCHIVE_DIR=${directory}`,
    "-e",
    `ARCHIVE_NAME=${basename(target)}`,
    "-v",
    `${parent}:/work:ro`,
    "-v",
    `${outputDir}:/output`,
    "-w",
    "/work",
    "alpine:3.24",
    "sh",
    "-ceu",
    script,
  ]);
}

function buildReadme(release, repo) {
  const releaseUrl = repo
    ? `https://github.com/${repo}/releases/tag/${release}`
    : "(see the release location where this archive was published)";
  return `SliceSeeker ${release} corresponding source

This archive accompanies the immutable container image digests listed in
source-manifest.json. It contains the exact Alpine aports recipe directory and
all source files fetched and checksum-verified by that recipe for each
GPL-family package in the final images. It also contains the custom FFmpeg
source and build materials shipped by the indexer-worker image.

Release: ${releaseUrl}

SHA256SUMS covers every file in this archive other than SHA256SUMS itself.
This is direct source distribution, not a written offer to provide source.
SliceSeeker's own application source remains available under the MIT License
in the repository for this release.
`;
}

function findFiles(root, predicate) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...findFiles(path, predicate));
    else if (entry.isFile() && predicate(path.replaceAll("\\", "/"))) {
      files.push(path);
    }
  }
  return files;
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit" });
  if (result.error) fail(`${command} failed: ${result.error.message}`);
  if (result.status !== 0) {
    fail(
      `${command} ${commandArgs.join(" ")} failed with status ${result.status}`,
    );
  }
}

function getArg(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function fail(message) {
  throw new Error(message);
}
