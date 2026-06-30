# Deployment

Two deployment layouts are supported. Both use the same application images and phase model (indexing vs search); they differ only in where Postgres, Valkey, and object storage run.

| Layout | Directory | Use when |
| --- | --- | --- |
| **Bundled** | [`bundled/`](bundled/) | You want every dependency as a container on one host (evaluation, single-node production). |
| **External** | [`external/`](external/) | You already have Postgres, Redis/Valkey, and S3-compatible storage and want to supply connection URLs. |

Application services (`indexer-api`, `indexer-worker`, `admin-ui`, `search-api`, and optionally `tusd`) always run as containers in both layouts.

## Quick start

**Bundled** (all infrastructure included):

```bash
cp deploy/bundled/.env.example deploy/bundled/.env
docker compose -f deploy/bundled/docker-compose.infra.yml --env-file deploy/bundled/.env up -d
docker compose -f deploy/bundled/docker-compose.infra.yml -f deploy/bundled/docker-compose.phase1.yml --env-file deploy/bundled/.env up -d
docker compose -f deploy/bundled/docker-compose.infra.yml -f deploy/bundled/docker-compose.phase2.yml --env-file deploy/bundled/.env up -d
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
