# External services deployment

Runs application containers only. Postgres, Valkey (Redis-compatible queue), and S3-compatible object storage are **not** included—you provide reachable URLs and credentials in `.env`.

Use this layout when you operate managed databases, managed Redis-compatible queues, or cloud object storage and want to point the app at existing endpoints.

## Layout

| Compose file | Contents |
| --- | --- |
| `docker-compose.init.yml` | One-shot pgvector bootstrap + schema push against your `DATABASE_URL` |
| `docker-compose.phase1.yml` | `indexer-api`, `indexer-worker`, `admin-ui`, `tusd` |
| `docker-compose.phase2.yml` | `search-api` |

## Setup

1. Create a Postgres database that supports the `vector` extension. The init step installs it automatically; some providers require enabling pgvector in the dashboard first.
2. Ensure your S3 bucket exists and credentials can read/write objects.
3. Configure `.env`:

```bash
cp .env.example .env
```

4. Apply schema once:

```bash
docker compose -f docker-compose.init.yml --env-file .env up
```

5. Start phases:

```bash
docker compose -f docker-compose.phase1.yml --env-file .env up -d
docker compose -f docker-compose.phase2.yml --env-file .env up -d
```

## Required environment

| Variable | Phase | Description |
| --- | --- | --- |
| `DATABASE_URL` | 1, 2 | Postgres connection URL (must include pgvector) |
| `DB_POOL_MAX` | 1, 2 | Max connections per API/worker/search process (default `10`). Keep `replicas × DB_POOL_MAX` under Postgres `max_connections`. |
| `VALKEY_URL` | 1 | Redis-compatible URL for the job queue (`redis://` or `rediss://` with optional user/password). **`maxmemory-policy` must be `noeviction`** — LRU eviction can silently drop job keys. Self-hosted: `valkey-server --maxmemory-policy noeviction`. Managed: set the equivalent in your provider's Redis/Valkey settings. |
| `VALKEY_SKIP_EVICTION_CHECK` | 1 | Set `true` when your provider blocks `CONFIG GET` but you confirmed `noeviction` in the dashboard. `/ready` still fails if policy is readable and wrong. |
| `S3_ENDPOINT` | 1 | S3 API endpoint reachable from containers |
| `S3_PUBLIC_ENDPOINT` | 1 | Browser-reachable endpoint for presigned playback URLs |
| `S3_BUCKET` | 1 | Bucket name (created and managed by you) |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | 1 | Object storage credentials |
| `EMBEDDING_MODEL`, `AI_GATEWAY_API_KEY` | 1, 2 | Embedding provider |
| `PREP_WORKER_CONCURRENCY`, `API_WORKER_CONCURRENCY` | 1 | Separate BullMQ workers for ffmpeg/S3 prep vs embed/ASR (defaults `4` / `2`) |
| `PREP_JOB_*`, `API_JOB_*` | 1 | Retry attempts, exponential backoff base ms, and max job age ms. |
| `API_UPSTREAM` | 1 | `host:port` for admin UI → indexer API proxy |
| `TUSD_UPSTREAM` | 1 | `host:port` for admin UI → upload server proxy |
| `TUSD_HOOKS_URL` | 1 | Full URL tusd calls after uploads (must reach indexer-api) |

## Operator notes

- **Valkey / Redis**: The job queue stores state in Redis. Use `maxmemory-policy noeviction` on whatever instance backs `VALKEY_URL`. Phase 1 `/ready` runs `CONFIG GET maxmemory-policy` when allowed; if your provider blocks it, set `VALKEY_SKIP_EVICTION_CHECK=true` after confirming `noeviction` in the provider console.
- **Network**: containers must reach your external hosts. Use hostnames resolvable inside the container network (not `localhost` for services on the Docker host unless using `host.docker.internal` or equivalent).
- **Schema**: run `docker-compose.init.yml` after upgrades or on empty databases. Application `/ready` endpoints verify schema but do not migrate.
- **Bucket**: the bundled layout auto-creates a bucket; here you must create it beforehand.
- **Phase 2 only**: set `DATABASE_URL` and embedding vars; omit Valkey and S3 credentials unless you add optional features later.

## Scaling

Same as bundled: scale stateless app containers horizontally. External Postgres, Valkey, and object storage scaling is your responsibility.
