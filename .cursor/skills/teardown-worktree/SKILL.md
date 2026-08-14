---
name: teardown-worktree
description: Drop the per-worktree Postgres database before deleting a Cursor worktree. Use when the user invokes /teardown-worktree or is about to /delete-worktree.
disable-model-invocation: true
---

# Teardown worktree isolation

Cursor does not run a delete hook. Before `/delete-worktree`, drop the extra Postgres database this checkout created.

1. Confirm you are in a worktree: `.cursor/worktree-env` must exist. If it is missing, stop — this is the main checkout or an unisolated tree.
2. Run `.cursor/teardown-worktree-unix.sh` from the worktree root (or pass the worktree path as `$1`).
3. Report what was dropped (`DATABASE_NAME`). Do not stop Docker — infra (including tusd on :8080) is shared with main.
4. Do not delete the git worktree yourself unless the user asked; `/delete-worktree` is their next step.
