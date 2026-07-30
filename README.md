# SliceSeeker

Self-hostable **internal** tool for semantic video search: upload media, index it in the background, then query by natural language. Other backends call Phase 2 (`search-api` / `search-client`) to seek slices; operators use the admin UI. Postgres stores vectors; object storage holds the source files.

License: [MIT](LICENSE) — but the published container images are not MIT-only, see [Licensing](#licensing). No built-in auth — network isolation is the security model. See [docs/deploy](docs/content/docs/deploy/index.mdx).

> **Media leaves your network.** Indexing sends video segments, audio, frames,
> transcript text, and search queries through a third-party AI gateway. The
> private-network deployment model protects the admin UI and APIs, not the
> material you process. See [Data flow](#data-flow).

## Two phases

Phases share one database schema but deploy independently. They do not call each other.

| Phase | Role | Services | Needs |
| --- | --- | --- | --- |
| **Phase 1: Indexing** | Upload, chunk, embed, admin UI | `indexer-api`, `indexer-worker`, `admin-ui` | Postgres, Valkey, S3, tusd |
| **Phase 2: Search** | Read-only vector search API | `search-api` | Postgres, embedding provider |

```
Phase 1 (write)  →  DB + storage
Phase 2 (read)   →  DB only
```

**Local dev** (all services):

```bash
pnpm install
pnpm dev:all
```

**Production deploy** (see [`deploy/README.md`](deploy/README.md)):

- **Self-contained**: all dependencies as containers ([`deploy/self-contained/`](deploy/self-contained/))
- **External**: your Postgres, Valkey, and S3 URLs ([`deploy/external/`](deploy/external/))

Phase 2 can run without Phase 1 on the same host. Point `DATABASE_URL` at the dataset Phase 1 wrote. Empty DB → search returns `[]`.

Supported uploads are **MP4, MOV, WebM, and AVI**. The API enforces the same
allowlist as the admin UI before tusd stores a file.

---

## Search SDK (`packages/search-client`)

Type-safe client for the Phase 2 **search-api** (`POST /search`, `GET /health`, `GET /ready`).

### Install

In this monorepo:

```bash
pnpm build:packages
```

Add to your app:

```json
"dependencies": {
  "search-client": "workspace:*"
}
```

### Usage

```typescript
import { SearchClient, SearchApiError } from "search-client";

const client = new SearchClient({
  baseUrl: "http://localhost:3001", // search-api URL
  timeoutMs: 30_000,                // optional
  headers: { Authorization: "..." }, // optional
});

// Wait until schema is ready (503 if not)
const { ready } = await client.ready();
if (!ready) throw new Error("search-api not ready");

const hits = await client.search({
  query: "sunset over water",
  collectionId: "col_abc",     // optional: single collection
  collectionIds: ["col_a", "col_b"], // optional: multiple
  uploadId: "upload_xyz",        // optional: scope to one file
  limit: 10,                     // optional, max 50
});

for (const hit of hits) {
  console.log(hit.score, hit.filename, hit.startSec, hit.endSec);
  // Resolve media: hit.sourceObject.bucket + hit.sourceObject.key
}

try {
  await client.search({ query: "" });
} catch (err) {
  if (err instanceof SearchApiError) {
    console.error(err.status, err.message);
  }
}
```

### `SearchHit` fields

| Field | Description |
| --- | --- |
| `segmentId` | Chunk row id |
| `fileId` / `uploadId` | Upload identifiers |
| `filename` | Original file name |
| `chunkIndex`, `startSec`, `endSec`, `durationSec` | Segment timing |
| `score` | Similarity score (higher = closer match) |
| `sourceObject` | `{ bucket, key }` for fetching the source file |

### Build the package

```bash
pnpm --filter search-client run build
```

Output: `packages/search-client/dist/`.

---

## Licensing

SliceSeeker's source code is [MIT](LICENSE). Published images also contain their
base OS and other third-party software, so each image includes notices under
`/licenses` and has CycloneDX and SPDX SBOMs. Each tagged GitHub Release also
publishes one checksum-verified corresponding-source archive and a manifest
mapping immutable image digests to exact Alpine package source and build
recipes.

The worker ships a pinned **LGPL-2.1-or-later** FFmpeg build for MP4, MOV, WebM,
and AVI processing. It is built without GPL, nonfree, version3, network, DVD,
x264, or x265 components. The exact FFmpeg source archive and build
configuration are included at `/licenses/ffmpeg`.

Production npm trees are gated against a license allowlist. Strong copyleft
(GPL/AGPL/SSPL) is not accepted for application dependencies.

```bash
pnpm licenses:check                      # all five images
pnpm licenses:check --filter worker...   # one image
```

See the [licensing documentation](docs/content/docs/licensing.mdx) if you
redistribute the images.

## Data flow

Indexing sends media and text through a third-party AI gateway using your own
API key. If you cannot send that material to a third-party processor,
SliceSeeker in its current form is not suitable for it. See
[Data handling](docs/content/docs/data-handling.mdx) for the exact flow.
