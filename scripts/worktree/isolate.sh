#!/usr/bin/env bash
# Isolate a git worktree so it can run the app stack without colliding with
# the primary checkout (or other worktrees).
#
# Called from Worktrunk `pre-start` (`.config/wt.toml`), or by hand from the
# worktree root. Worktrunk passes hash_port / sanitize_db via the environment.
#
# Isolation model:
#   Isolated: app ports, Postgres database (copy of demo_search), Valkey logical DB
#   Shared:   docker compose project (db / valkey / rustfs / tusd on :8080)
set -euo pipefail

log() { printf '[worktree-setup] %s\n' "$*"; }

# Worktrunk hooks send template JSON on stdin. Drain it so pnpm/docker do not
# inherit a pipe they might try to read.
if [[ ! -t 0 ]]; then
  cat >/dev/null
fi

if ! command -v python3 >/dev/null 2>&1; then
  log "ERROR: python3 is required to rewrite env files"
  exit 1
fi

primary_worktree() {
  git worktree list --porcelain 2>/dev/null | awk '/^worktree / { print $2; exit }'
}

HERE="$(pwd -P)"
if [[ -n "${ROOT_WORKTREE_PATH:-}" ]]; then
  ROOT="$(cd "$ROOT_WORKTREE_PATH" && pwd -P)"
else
  ROOT="$(cd "$(primary_worktree)" && pwd -P)"
fi

if [[ "$HERE" == "$ROOT" ]]; then
  log "refusing to isolate the primary checkout; nothing to do"
  exit 0
fi

BRANCH="${WORKTREE_BRANCH:-$(git branch --show-current 2>/dev/null || true)}"

# Derive ports / db name from the branch when Worktrunk did not pass them.
# Same 10000-19999 range as hash_port so we stay off 5173/3000/3001.
eval "$(python3 - "$HERE" "$BRANCH" "${CLIENT_PORT:-}" "${SERVER_PORT:-}" "${SEARCH_PORT:-}" "${DB_NAME:-}" <<'PY'
import hashlib, re, sys

here, branch, client, server, search, db_name = sys.argv[1:7]


def sha(s: str) -> bytes:
    return hashlib.sha256(s.encode()).digest()


def hash_port(s: str) -> int:
    return 10000 + (int.from_bytes(sha(s)[:8], "big") % 10000)


def sanitize_db(s: str) -> str:
    n = int.from_bytes(sha(s)[:8], "big")
    alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
    suffix = ""
    for _ in range(3):
        suffix = alphabet[n % 36] + suffix
        n //= 36
    slug = re.sub(r"[^a-z0-9_]", "_", s.lower())
    slug = re.sub(r"_+", "_", slug).strip("_")
    if not slug:
        slug = "branch"
    if slug[0].isdigit():
        slug = "b_" + slug
    return f"{slug[:44]}_{suffix}"[:48]


seed = branch or here
if not client:
    client = str(hash_port(seed))
if not server:
    server = str(hash_port(f"api-{seed}"))
if not search:
    search = str(hash_port(f"search-{seed}"))

ports = [int(client), int(server), int(search)]
used = set()
fixed = []
for p in ports:
    while p in used:
        p = 10000 + ((p - 9999) % 10000)
    used.add(p)
    fixed.append(p)
client, server, search = (str(p) for p in fixed)

if not db_name:
    db_name = "dswt_" + sanitize_db(seed)

# shell-escape via %q-equivalent: these are all [A-Za-z0-9_-]
print(f"CLIENT_PORT={client}")
print(f"SERVER_PORT={server}")
print(f"SEARCH_PORT={search}")
print(f"DB_NAME={db_name}")
PY
)"

if [[ ! "$DB_NAME" =~ ^[a-z][a-z0-9_]{0,62}$ ]]; then
  log "ERROR: refusing unsafe database name: $DB_NAME"
  exit 1
fi

REDIS_DB=$((CLIENT_PORT % 15 + 1))
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/${DB_NAME}"
VALKEY_URL="redis://127.0.0.1:6379/${REDIS_DB}"
CORS_ORIGIN="http://localhost:${CLIENT_PORT},http://127.0.0.1:${CLIENT_PORT}"
TUSD_ENDPOINT="http://localhost:8080/files/"
COMPOSE_PROJECT_NAME="$(basename "$ROOT" | tr '[:upper:]' '[:lower:]')"
export COMPOSE_PROJECT_NAME

log "worktree=$HERE"
log "primary checkout=$ROOT"
log "branch=${BRANCH:-detached}"
log "compose project=$COMPOSE_PROJECT_NAME (shared with primary)"
log "client=$CLIENT_PORT server=$SERVER_PORT search=$SEARCH_PORT redis_db=$REDIS_DB db=$DB_NAME"

copy_env() {
  local rel="$1"
  local src="$ROOT/$rel"
  local dest="$rel"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    log "copied $rel"
  else
    log "skip $rel (not in primary checkout)"
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
# primary) so the worktree Vite origin can upload. Enable hook forwarding on the
# primary indexer too — that is the process tusd actually calls.
TUSD_CORS_ALLOW_ORIGIN='^http://(localhost|127[.]0[.]0[.]1):[0-9]+$'
set_env .env TUSD_CORS_ALLOW_ORIGIN "$TUSD_CORS_ALLOW_ORIGIN"
set_env "$ROOT/.env" TUSD_CORS_ALLOW_ORIGIN "$TUSD_CORS_ALLOW_ORIGIN"
set_env "$ROOT/server/.env" TUSD_HOOK_FORWARD_LOCAL "true"

write_state() {
  cat > .worktree-env <<EOF
WORKTREE_BRANCH=${BRANCH}
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
log "wrote .worktree-env"

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
log "restart the primary indexer on :3000 if it was already running so it picks up TUSD_HOOK_FORWARD_LOCAL."
log "before deleting this worktree, run scripts/worktree/teardown.sh (Worktrunk pre-remove does this)."
