# Deployment

Two deployment layouts are supported. Both use the same application images and phase model (indexing vs search); they differ only in where Postgres, Valkey, and object storage run. Network trust (no app login, private access only) is documented under [docs/deploy](../docs/content/docs/deploy/index.mdx).

| Layout | Directory | Use when |
| --- | --- | --- |
| **Self-contained** | [`self-contained/`](self-contained/) | You want every dependency as a container on one host (evaluation, single-node production). |
| **External** | [`external/`](external/) | You already have Postgres, Redis/Valkey, and S3-compatible storage and want to supply connection URLs. |

Application services (`indexer-api`, `indexer-worker`, `admin-ui`, `search-api`, and optionally `tusd`) always run as containers in both layouts.

**Images:** build the five SliceSeeker images from the repo Dockerfiles, or pull a tagged release from GHCR. See [Container images](../docs/content/docs/deploy/images.mdx).

## Quick start

**Self-contained** (infra runs in Compose):

```bash
cp deploy/self-contained/.env.example deploy/self-contained/.env
docker compose -f deploy/self-contained/docker-compose.infra.yml --env-file deploy/self-contained/.env up -d
docker compose -f deploy/self-contained/docker-compose.infra.yml -f deploy/self-contained/docker-compose.phase1.yml --env-file deploy/self-contained/.env up -d
docker compose -f deploy/self-contained/docker-compose.infra.yml -f deploy/self-contained/docker-compose.phase2.yml --env-file deploy/self-contained/.env up -d
```

**External** (bring your own database, queue, and object storage):

```bash
cp deploy/external/.env.example deploy/external/.env
# Edit .env: set DATABASE_URL, VALKEY_URL, S3_* to your existing services
docker compose -f deploy/external/docker-compose.init.yml --env-file deploy/external/.env up
docker compose -f deploy/external/docker-compose.phase1.yml --env-file deploy/external/.env up -d
docker compose -f deploy/external/docker-compose.phase2.yml --env-file deploy/external/.env up -d
```

See each directory's README for phase details, environment variables, and scaling notes.
