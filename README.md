# demo-search-ai

Monorepo for semantic video search: upload media, chunk and embed it in the background, then query by natural language. Postgres stores vectors; object storage holds the source files.

## Two phases

Phases share one database schema but deploy independently. They do not call each other.

| Phase | Role | Services | Needs |
| --- | --- | --- | --- |
| **Phase 1 — Indexing** | Upload, chunk, embed, admin UI | `indexer-api`, `indexer-worker`, `admin-ui` | Postgres, Valkey, S3, tusd |
| **Phase 2 — Search** | Read-only vector search API | `search-api` | Postgres, embedding provider |

```
Phase 1 (write)  →  DB + storage
Phase 2 (read)   →  DB only
```

**Local dev** (all services):

```bash
pnpm install
pnpm dev:all
```

**Production-style deploy** (see `deploy/` and `plan.md`):

```bash
docker compose -f deploy/docker-compose.infra.yml --env-file deploy/.env up -d
docker compose -f deploy/docker-compose.infra.yml -f deploy/docker-compose.phase1.yml --env-file deploy/.env up -d
docker compose -f deploy/docker-compose.infra.yml -f deploy/docker-compose.phase2.yml --env-file deploy/.env up -d
```

Phase 2 can run without Phase 1 on the same host. Point `DATABASE_URL` (and `S3_BUCKET` for result pointers) at the dataset Phase 1 wrote. Empty DB → search returns `[]`.

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
