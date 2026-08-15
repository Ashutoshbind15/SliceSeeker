# Local development

How to run the stack on a machine and how parallel git worktrees stay isolated.
Production layouts are under [`deploy/`](deploy/README.md).

## Primary checkout

```bash
pnpm install
```

Copy each `*.env.example` to `.env` (`server/`, `worker/`, `search/`, `packages/db/`, and the repo-root Compose file). Set `AI_GATEWAY_API_KEY` in `server/.env`, `worker/.env`, and `search/.env`.

```bash
pnpm dev:all
```

That builds shared packages (`db`, `queue`, `search-client`), starts Docker infra (`docker-compose.dev.yml`), and runs the admin UI, indexer API, search API, and worker.

| Process | Default |
| --- | --- |
| Admin UI (Vite) | http://localhost:5173 |
| indexer-api | http://localhost:3000 |
| search-api | http://localhost:3001 |
| tusd | http://localhost:8080/files/ |
| Postgres | `localhost:5432` / `demo_search` |
| Valkey | `localhost:6379` / logical DB 0 |
| RustFS (S3) | http://localhost:9000 |

Docs site (separate process; does not use `:3000`):

```bash
pnpm --filter docs dev
```

Open http://localhost:4000.

Useful scripts:

```bash
pnpm infra          # Docker: db, valkey, rustfs, tusd
pnpm build:packages
pnpm db:push
pnpm db:studio
pnpm worker:dev
```

## Env files

Gitignored `.env` files (copy from the matching `*.env.example`):

| File | What it is for |
| --- | --- |
| `server/.env` | `AI_GATEWAY_API_KEY`, `DATABASE_URL`, `VALKEY_URL`, optional `PORT` / `CORS_ORIGIN` |
| `worker/.env` | Same key + S3 + queue knobs |
| `search/.env` | Same key + `DATABASE_URL`, optional `PORT` / `CORS_ORIGIN` |
| `packages/db/.env` | `DATABASE_URL` for `db:push` / Studio |
| `.env` (repo root) | Local Compose only: tusd port, hook URL, CORS origin |
| `client/.env` | Optional Vite overrides (`client/.env.example`) |

Tracked `client/.env.development` and `client/.env.production` only set `VITE_APP_ENV`.

`TUSD_HOOK_FORWARD_LOCAL` is local-worktree only. Do not set it in production or image env.

Root `.env` `TUSD_CORS_ALLOW_ORIGIN` can allow any localhost UI port so worktrees can share tusd `:8080`. Omit it to allow only `http://localhost:5173`.

## Worktrees (Worktrunk)

[Worktrunk](https://worktrunk.dev) (`wt`) creates a sibling checkout, then the project hooks isolate it. Isolation is CLI-based: start any agent in that directory after `wt` finishes.

| Shared with the primary checkout | Isolated per worktree |
| --- | --- |
| Docker Compose (Postgres, Valkey, RustFS, tusd `:8080`) | App ports via `hash_port` (10000–19999) |
| pnpm content-addressable store | Postgres `dswt_*` (copy of `demo_search`) |
| | Valkey logical DB |

`node_modules` is not copied. `pre-start` runs `pnpm install --frozen-lockfile --prefer-offline` so the worktree only relinks from the store.

### Install (once)

```bash
sudo pacman -S worktrunk && wt config shell install
# or: cargo install worktrunk && wt config shell install
```

First create in this repo asks you to approve hooks:

```bash
wt config approvals add
```

Hooks live in [`.config/wt.toml`](.config/wt.toml). Scripts: [`scripts/worktree/isolate.sh`](scripts/worktree/isolate.sh), [`scripts/worktree/teardown.sh`](scripts/worktree/teardown.sh).

### Create

```bash
wt switch --create feature-name
```

Creates `~/projects/demo-search-ai.feature-name`, copies `.env` files from the primary checkout, rewrites ports / database / Valkey DB, installs from the pnpm store, copies `demo_search` → `dswt_*`, then tethers client / search / server / worker.

Create and start an agent in one shot:

```bash
wt switch --create -x claude feature-name -- 'the task'
wt switch --create -x cursor feature-name
```

Existing branch, no new branch:

```bash
wt switch feature-name
```

Skip hooks (empty checkout only):

```bash
wt switch --create --no-hooks temp
```

Same branch name → same ports on any machine. Do not bind 5173 / 3000 / 3001 in a worktree.

### Look around

```bash
wt list          # URL column = Vite
wt urls          # client / api / search
wt open          # open the admin UI
cat .worktree-env
```

`.worktree-env` has `CLIENT_URL`, `API_URL`, `SEARCH_URL`, `DATABASE_NAME`. Restart the four processes later with `wt dev`.

If isolate failed or you need to rewrite env from the worktree root:

```bash
pnpm worktree:isolate
# or: wt isolate
```

Uploads still go through shared tusd on `:8080`. `VITE_TUSD_HOOK_FORWARD` + `TUSD_HOOK_FORWARD_LOCAL` route hooks to this worktree's indexer-api. Restart the primary indexer on `:3000` if it was already running so it picks up hook forwarding.

### Remove

```bash
wt remove                # current worktree; drops dswt_* ; kills tethered processes
wt remove feature-name
wt remove --force dirty  # uncommitted files in the worktree
```

Does **not** stop shared Docker. Teardown is also `pnpm worktree:teardown` from the worktree (Worktrunk `pre-remove` runs it).
