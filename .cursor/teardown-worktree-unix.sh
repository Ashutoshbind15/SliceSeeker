#!/usr/bin/env bash
# Drop the per-worktree Postgres database. Cursor has no delete-worktree hook,
# so run this from the worktree (or pass its path) before /delete-worktree.
set -euo pipefail

log() { printf '[worktree-teardown] %s\n' "$*"; }

WORKTREE="${1:-$PWD}"
WORKTREE="$(cd "$WORKTREE" && pwd -P)"
STATE="$WORKTREE/.cursor/worktree-env"

if [[ ! -f "$STATE" ]]; then
  log "no $STATE — this checkout was not isolated by setup-worktree-unix.sh"
  exit 0
fi

# shellcheck disable=SC1090
set -a
# Strip CRLF so a Windows-edited state file still sources.
. <(sed 's/\r$//' "$STATE")
set +a

if [[ -z "${DATABASE_NAME:-}" || -z "${COMPOSE_PROJECT_NAME:-}" ]]; then
  log "ERROR: $STATE is missing DATABASE_NAME or COMPOSE_PROJECT_NAME"
  exit 1
fi

if [[ ! "$DATABASE_NAME" =~ ^demo_search_wt_[0-9]+$ ]]; then
  log "refusing to drop unexpected database name: $DATABASE_NAME"
  exit 1
fi

export COMPOSE_PROJECT_NAME

if ! docker info >/dev/null 2>&1; then
  log "docker not available; cannot drop $DATABASE_NAME"
  exit 0
fi

ROOT_COMPOSE="$WORKTREE/docker-compose.dev.yml"
if [[ ! -f "$ROOT_COMPOSE" ]]; then
  log "ERROR: missing $ROOT_COMPOSE"
  exit 1
fi

log "dropping postgres database $DATABASE_NAME (compose project $COMPOSE_PROJECT_NAME)"
docker compose -f "$ROOT_COMPOSE" exec -T db \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS ${DATABASE_NAME} WITH (FORCE)"

log "left valkey logical DB ${VALKEY_URL:-unknown} in place (harmless empty keys)"
log "docker infra is shared — not stopping it"
log "done"
