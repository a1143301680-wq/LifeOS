# LifeOS Project State

Last updated: 2026-07-11

## Current Phase

Phase 1A: Todo CRUD + Todo category CRUD + two-user isolation + PC/Android sync loop foundation.

## Source Of Truth

Read these before implementation, review, or Git publishing:

- `docs/requirements.md`
- `docs/architecture.md`
- `docs/mvp.md`
- `docs/data-model-phase1.md`
- `docs/api-phase1a.md`
- `docs/workflow.md`
- `handoff/current-task.md`
- `handoff/review-gate.md`
- `handoff/issue-log.md`

## Current Status

- Phase 1A API implementation decisions are closed in `docs/api-phase1a.md`.
- Multi-window workflow templates were added on 2026-07-11.
- Coding, Review, and Git windows should coordinate through files under `handoff/`.
- Initial project baseline was committed and pushed to `origin/main` on 2026-07-11.

## Recently Completed

- Published initial baseline commit `6a85b4a`:
  - Phase 1A backend skeleton.
  - Stable product/API/docs baseline.
  - Multi-window workflow and handoff files.
- Confirmed Phase 1A API decisions:
  - Soft-deleted current-user Todo detail returns `410 deleted_resource`.
  - Missing or cross-user Todo detail returns `404 not_found`.
  - Bootstrap token hashes use Argon2id PHC strings.
  - Idempotency request hashes use SHA-256 canonical request fingerprints.
  - Todo list cursors use base64url JSON v1 with final `id ASC` tie-breaker.
  - PC Web stores the token in `localStorage` key `lifeos.identityToken`.
- Created the multi-window workflow and shared state templates.

## Current Blockers

- PostgreSQL-backed verification for `sync_changes_cursor_seq` remains open in `handoff/issue-log.md`.
- Future Git commits still require `handoff/review-gate.md` approval or explicit user override.

## Next Recommended Step

Use the Coding window for the next Phase 1A backend slice:

- Implement Todo Category list/create API foundation.
- Add `todo_categories` model and migration.
- Implement `GET /api/v1/todo-categories`.
- Implement `POST /api/v1/todo-categories` with required `Idempotency-Key`.
- Store/replay idempotency responses for category create.
- Write `sync_changes` through `create_sync_change()` in the same transaction as category creation.
- Add focused tests.

If a local PostgreSQL database is available, also verify `ISSUE-20260711-001`. If not, keep it open as P3 and continue.

After coding, run the Review window and have it update `handoff/review-gate.md`. Then run the Git window only if review allows commit/push.

## Notes For Windows

- Do not rely on another chat window's memory.
- If a result matters to another window, write it into one of the shared state files.
- Keep updates concise and append meaningful history rather than rewriting away useful context.
