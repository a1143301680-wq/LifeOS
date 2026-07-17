# TASK-013 Todo Delete API

## Metadata

- Task ID: TASK-013
- Task Name: Todo delete API
- Status: READY
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: Todo update `09cd984`; lifecycle actions `2c35f1d`, `c2d167f`; TASK-012 closure `17e54de`

## Decision

Implement only `DELETE /api/v1/todos/{id}` as the next closeable Todo slice. Soft-delete any owned active Todo, preserve lifecycle state, increment version, and atomically publish a `todo.deleted` tombstone with idempotent behavior.

## In Scope

- Soft deletion for pending, completed, and canceled Todos.
- Ownership and already-deleted behavior.
- Server deletion/update timestamp and version increment.
- Response and sync tombstones.
- Idempotent atomic mutation and focused tests.

## Out Of Scope

- Hard delete or status coercion.
- List, Today, sync pull, or SSE.
- Other Todo/category behavior changes.
- Reminder, recurring Todo, frontend, Android, or offline replay.
- Model, schema, or migration changes unless Task Review approves an unavoidable prerequisite.

## Contract

- No body; bearer auth and `Idempotency-Key` required.
- Missing/cross-user Todo returns `404`; current-user deleted Todo returns `410`.
- Any active lifecycle status may be deleted; status and completion/cancellation data remain unchanged.
- Success sets equal server `deleted_at`/`updated_at`, increments version once, and returns `{id, deleted, deleted_at, version}` plus sync cursor.
- `todo.deleted` carries updated entity version and matching `{deleted, deleted_at}` tombstone payload.
- Same-key replay has no duplicate effect; a new key after deletion returns `410`.

## Allowed Files

- `backend/app/api/v1/todos.py`
- Focused Todo delete tests under `backend/tests/`
- Directly required small lifecycle/tombstone helpers
- `docs/phase1a-progress.md`
- Active TASK-013 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- Models, schemas, or migrations unless Task Review explicitly approves them
- Product contract documents
- List/Today/sync/SSE or Reminder behavior
- Category API behavior
- Frontend and Android files
- Completed TASK-005 through TASK-012 archives

## Acceptance Criteria

- [ ] Active Todo delete returns the defined versioned tombstone and sync cursor.
- [ ] All lifecycle statuses can be deleted without changing status/history.
- [ ] Equal deletion/update timestamps are persisted without hard deletion.
- [ ] Sync entity version and tombstone match response/persisted state.
- [ ] Ownership/already-deleted errors follow `404`/`410` rules.
- [ ] Missing, replayed, conflicting, and new-after-delete idempotency cases have no duplicate effects.
- [ ] Auth, UUID, no-body, field exclusion, and rollback behavior are covered.
- [ ] Focused and full tests pass; no migration or out-of-scope endpoint is added.

## Verification Plan

- Focused Todo delete tests for all acceptance paths.
- Full `python -m pytest` from `backend/`.
- Route and endpoint-scope inspection.
- `git diff --check` and exact changed-file review.

## Risks

- Lifecycle history loss.
- Replay versus second-attempt confusion.
- Version/tombstone timestamp inconsistency.
- Cross-user existence leakage.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-17 10:21 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: PENDING

## Coding Result

Pending.

## Code Review

- Result: PENDING

## Git Commit

- Result: PENDING

## Closure

Pending.
