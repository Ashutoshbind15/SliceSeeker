# Bundled deployment

Runs the full stack on one host: application services plus Postgres (pgvector), Valkey, and S3-compatible object storage (RustFS). Suitable for evaluation, development-like staging, or single-node production.

## Layout

| Compose file | Contents |
| --- | --- |
| `docker-compose.infra.yml` | `db`, `valkey`, `rustfs`, bucket init, schema push |
| `docker-compose.phase1.yml` | `indexer-api`, `indexer-worker`, `admin-ui`, `tusd` |
| `docker-compose.phase2.yml` | `search-api` |

Phases share the bundled Postgres instance. Phase 2 can be deployed without Phase 1 app services on the same host once data exists in the database.

## Setup

```bash
cp .env.example .env
docker compose -f docker-compose.infra.yml --env-file .env up -d
docker compose -f docker-compose.infra.yml -f docker-compose.phase1.yml --env-file .env up -d
# After indexing data exists:
docker compose -f docker-compose.infra.yml -f docker-compose.phase2.yml --env-file .env up -d
```

## Defaults

Connection strings in `.env.example` use Docker Compose service names (`db`, `valkey`, `rustfs`). Do not change these unless you know the containers cannot reach each other on the compose network.

## Scaling

- **search-api** and **indexer-api**: increase replicas behind a load balancer (stateless).
- **indexer-worker**: scale replicas; all workers share the same `VALKEY_URL` queue.
- **tusd**: use sticky sessions or distributed locking when running more than one instance ([tus scaling FAQ](https://tus.io/faq)).
- **db**, **valkey**, **rustfs**: stateful; scale via your own HA setup or migrate to the [external](../external/) layout.
