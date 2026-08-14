#!/usr/bin/env bash
# Cursor worktree setup for SliceSeeker.
# Runs from the new worktree with ROOT_WORKTREE_PATH pointing at the main checkout.
#
# Isolation model:
#   Isolated: app ports, Postgres database (copy of demo_search), Valkey logical DB
#   Shared:   docker compose project (db / valkey / rustfs / tusd on :8080)
set -euo pipefail

log() { printf '[worktree-setup] %s\n' "$*"; }

if [[ -z "${ROOT_WORKTREE_PATH:-}" ]]; then
  log "ERROR: ROOT_WORKTREE_PATH is unset. Cursor should export this to the main checkout."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  log "ERROR: python3 is required to rewrite env files"
  exit 1
fi

ROOT="$(cd "$ROOT_WORKTREE_PATH" && pwd -P)"
HERE="$(pwd -P)"

if [[ "$HERE" == "$ROOT" ]]; then
  log "refusing to isolate the main checkout; nothing to do"
  exit 0
fi

copy_env() {
  local rel="$1"
  local src="$ROOT/$rel"
  local dest="$rel"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    log "copied $rel"
  else
    log "skip $rel (not in main checkout)"
  fi
}

# KEY=value upsert. Values must not contain newlines.
set_env() {
  local file="$1" key="$2" value="$3"
  python3 - "$file" "$key" "$value" <<'PY'
import pathlib, sys
path, key, value = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
path.parent.mkdir(parents=True, exist_ok=True)
lines = path.read_text().splitlines() if path.exists() else []
out, found = [], False
for line in lines:
    if line.startswith(key + "="):
        out.append(f"{key}={value}")
        found = True
    else:
        out.append(line)
if not found:
    out.append(f"{key}={value}")
path.write_text("\n".join(out) + "\n")
PY
}

worktree_hash() {
  if command -v md5sum >/dev/null 2>&1; then
    printf '%s' "$HERE" | md5sum | awk '{print $1}'
  else
    printf '%s' "$HERE" | md5 -q
  fi
}

HASH="$(worktree_hash)"
OFFSET=$((16#${HASH:0:8} % 100))
CLIENT_PORT=$((5200 + OFFSET))
SERVER_PORT=$((4300 + OFFSET))
SEARCH_PORT=$((4400 + OFFSET))
REDIS_DB=$((OFFSET % 15 + 1))
DB_NAME="demo_search_wt_${OFFSET}"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/${DB_NAME}"
VALKEY_URL="redis://127.0.0.1:6379/${REDIS_DB}"
CORS_ORIGIN="http://localhost:${CLIENT_PORT},http://127.0.0.1:${CLIENT_PORT}"
TUSD_ENDPOINT="http://localhost:8080/files/"
COMPOSE_PROJECT_NAME="$(basename "$ROOT" | tr '[:upper:]' '[:lower:]')"
export COMPOSE_PROJECT_NAME

log "worktree=$HERE"
log "main checkout=$ROOT"
log "compose project=$COMPOSE_PROJECT_NAME (shared with main)"
log "offset=$OFFSET client=$CLIENT_PORT server=$SERVER_PORT search=$SEARCH_PORT redis_db=$REDIS_DB db=$DB_NAME"

# Gitignored secrets / local config. Tracked client/.env.* are already in the worktree.
copy_env .env
copy_env server/.env
copy_env worker/.env
copy_env search/.env
copy_env packages/db/.env
copy_env deploy/.env
copy_env client/.env

set_env server/.env PORT "$SERVER_PORT"
set_env server/.env DATABASE_URL "$DATABASE_URL"
set_env server/.env VALKEY_URL "$VALKEY_URL"
set_env server/.env CORS_ORIGIN "$CORS_ORIGIN"

set_env search/.env PORT "$SEARCH_PORT"
set_env search/.env DATABASE_URL "$DATABASE_URL"
set_env search/.env CORS_ORIGIN "$CORS_ORIGIN"

set_env worker/.env DATABASE_URL "$DATABASE_URL"
set_env worker/.env VALKEY_URL "$VALKEY_URL"

set_env packages/db/.env DATABASE_URL "$DATABASE_URL"

set_env client/.env VITE_DEV_PORT "$CLIENT_PORT"
set_env client/.env VITE_API_URL "http://localhost:${SERVER_PORT}"
set_env client/.env VITE_TUSD_ENDPOINT "$TUSD_ENDPOINT"
set_env client/.env VITE_TUSD_HOOK_FORWARD "true"
set_env server/.env TUSD_HOOK_FORWARD_LOCAL "true"

# Shared tusd on :8080. Widen local CORS on the compose .env (this checkout and
# main) so the worktree Vite origin can upload. Enable hook forwarding on the
# main indexer too — that is the process tusd actually calls.
TUSD_CORS_ALLOW_ORIGIN='^http://(localhost|127[.]0[.]0[.]1):[0-9]+$'
set_env .env TUSD_CORS_ALLOW_ORIGIN "$TUSD_CORS_ALLOW_ORIGIN"
set_env "$ROOT/.env" TUSD_CORS_ALLOW_ORIGIN "$TUSD_CORS_ALLOW_ORIGIN"
set_env "$ROOT/server/.env" TUSD_HOOK_FORWARD_LOCAL "true"

write_state() {
  mkdir -p .cursor
  cat > .cursor/worktree-env <<EOF
WORKTREE_OFFSET=${OFFSET}
CLIENT_PORT=${CLIENT_PORT}
SERVER_PORT=${SERVER_PORT}
SEARCH_PORT=${SEARCH_PORT}
TUSD_URL=${TUSD_ENDPOINT}
DATABASE_NAME=${DB_NAME}
DATABASE_URL=${DATABASE_URL}
VALKEY_URL=${VALKEY_URL}
CORS_ORIGIN=${CORS_ORIGIN}
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}
CLIENT_URL=http://localhost:${CLIENT_PORT}
API_URL=http://localhost:${SERVER_PORT}
SEARCH_URL=http://localhost:${SEARCH_PORT}
EOF
}

write_state
log "wrote .cursor/worktree-env"

if [[ ! -f pnpm-lock.yaml ]]; then
  log "ERROR: pnpm-lock.yaml missing; cannot install"
  exit 1
fi

log "pnpm install --frozen-lockfile --prefer-offline"
pnpm install --frozen-lockfile --prefer-offline

log "build workspace packages (db, queue, search-client)"
pnpm build:packages

ensure_infra() {
  if ! docker info >/dev/null 2>&1; then
    log "docker not available; skip infra and database isolation"
    return 1
  fi
  log "ensure docker infra under $COMPOSE_PROJECT_NAME"
  pnpm infra
  local i
  for i in $(seq 1 30); do
    if docker compose -f docker-compose.dev.yml exec -T db \
      pg_isready -U postgres -d postgres >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  log "WARNING: postgres did not become ready"
  return 1
}

psql_db_exists() {
  docker compose -f docker-compose.dev.yml exec -T db \
    psql -U postgres -d postgres -Atqc \
    "SELECT 1 FROM pg_database WHERE datname='$1'"
}

ensure_database() {
  local exists source_exists
  exists="$(psql_db_exists "$DB_NAME")"
  if [[ "$exists" == "1" ]]; then
    log "reusing postgres database $DB_NAME"
    return 0
  fi

  source_exists="$(psql_db_exists demo_search)"
  if [[ "$source_exists" == "1" ]]; then
    log "creating $DB_NAME as a copy of demo_search"
    if docker compose -f docker-compose.dev.yml exec -T db \
      psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c "CREATE DATABASE ${DB_NAME} TEMPLATE demo_search"; then
      return 0
    fi
    # TEMPLATE needs exclusive access; dump works while main is connected.
    log "demo_search is in use; copying with pg_dump instead"
    docker compose -f docker-compose.dev.yml exec -T db \
      psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c "CREATE DATABASE ${DB_NAME}"
    docker compose -f docker-compose.dev.yml exec -T db \
      sh -c "pg_dump -U postgres --no-owner --no-acl demo_search | psql -U postgres -d ${DB_NAME} -v ON_ERROR_STOP=1"
    return 0
  fi

  log "demo_search not found; creating empty $DB_NAME"
  docker compose -f docker-compose.dev.yml exec -T db \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE ${DB_NAME}"
}

if ensure_infra; then
  ensure_database
  log "db:push into $DB_NAME"
  pnpm db:push
else
  log "WARNING: left DATABASE_URL pointing at $DB_NAME but did not create/push it"
fi

write_state
log "done. pnpm dev:all is safe here — ports are ${CLIENT_PORT}/${SERVER_PORT}/${SEARCH_PORT}."
log "uploads use shared tusd on :8080; VITE_TUSD_HOOK_FORWARD + TUSD_HOOK_FORWARD_LOCAL route hooks to :${SERVER_PORT}."
log "restart the main indexer on :3000 if it was already running so it picks up TUSD_HOOK_FORWARD_LOCAL."
log "before deleting this worktree, run .cursor/teardown-worktree-unix.sh"
