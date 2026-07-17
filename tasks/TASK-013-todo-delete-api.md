# TASK-013 Todo Delete API

## Metadata

- Task ID: TASK-013
- Task Name: Todo delete API
- Status: REVIEWING
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

- [x] Active Todo delete returns the defined versioned tombstone and sync cursor.
- [x] All lifecycle statuses can be deleted without changing status/history.
- [x] Equal deletion/update timestamps are persisted without hard deletion.
- [x] Sync entity version and tombstone match response/persisted state.
- [x] Ownership/already-deleted errors follow `404`/`410` rules.
- [x] Missing, replayed, conflicting, and new-after-delete idempotency cases have no duplicate effects.
- [x] Auth, UUID, no-body, field exclusion, and rollback behavior are covered.
- [x] Focused and full tests pass; no migration or out-of-scope endpoint is added.

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

- Status: COMPLETE
- Branch: main
- Base Commit: 17e54dea4644725fd8ac96682ec74f7856719937
- Snapshot Commit: 446c897c3383cb2952e1a4eba4a5a5f902aa3626
- Reason: approved TASK-013 readiness documents required a durable pre-Coding baseline

## Coding Result

### Modified Files

- `backend/app/api/v1/todos.py`
- `backend/tests/test_todos_delete.py`
- `handoff/current-task.md`
- `tasks/TASK-013-todo-delete-api.md`

Pre-existing TASK-013 state file preserved:

- `handoff/git-snapshot.md`

### Implementation Summary

- Added `DELETE /api/v1/todos/{id}` under the existing Todo router.
- Requires bearer authentication and `Idempotency-Key`.
- Rejects non-empty request bodies with `400 validation_error`.
- Queries Todo by ID and current user ID; missing and cross-user Todos both return `404 not_found`.
- Current-user already soft-deleted Todo returns `410 deleted_resource`.
- Soft-deletes active pending, completed, and canceled Todos without changing lifecycle status, completion history, cancellation history, ordinary fields, or category relationship.
- Sets one server timestamp on both `deleted_at` and `updated_at`, increments `version` exactly once, and does not hard-delete the row.
- Returns only tombstone data `{id, deleted, deleted_at, version}` plus `sync.cursor`.
- Writes `todo.deleted` with `entity_type=todo`, updated `entity_version`, and a payload tombstone equal to the response `data`.
- Persists Todo mutation, sync change, and idempotency response in one transaction.

### Acceptance Criteria Results

- Active Todo delete tombstone and sync cursor: covered.
- Pending, completed, and canceled delete while preserving status/history: covered.
- Equal `deleted_at` and `updated_at`, no hard delete: covered.
- Sync entity version and tombstone payload equality: covered.
- Missing/cross-user/already-deleted errors: covered.
- Missing key, replay, conflict, and new key after delete: covered.
- Missing/invalid auth, invalid UUID, non-empty body, approved field-only tombstone, and rollback behavior: covered.
- No model, schema, migration, product contract, list, Today, sync pull, SSE, Reminder, frontend, or Android changes were made.

### Verification Commands And Results

- `python -m pytest tests/test_todos_delete.py`: PASS, 6 passed.
- `python -m pytest`: PASS, 78 passed.
- `rg -n '@router\.(get|post|patch|delete)|prefix="/todos"|complete|reopen|delete|today|sync|events|changes' backend/app/api/v1/todos.py`: PASS, only existing Todo create/detail/update/complete/reopen plus the new delete route are present; no list, Today, sync, or SSE route was added.
- `Select-String -Path D:\LifeOS\backend\tests\test_todos_delete.py -Pattern '[ \t]+$'`: PASS, no trailing whitespace in the new untracked test file.

### Git Diff Check

- `git status --short --untracked-files=all`: PASS, only TASK-013 implementation/state files plus pre-existing `handoff/git-snapshot.md` state diff are present.
- `git diff --stat`: PASS, reviewed focused route, task-state, and snapshot-state diffs; untracked focused test file reviewed separately.
- `git diff --check`: PASS, no whitespace errors; Git reported expected LF-to-CRLF working-copy warnings.
- `git diff --cached`: PASS, empty.

### Unresolved Issues

None.

### Task-Outside Findings

None.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-07-17 18:03 +08:00
- Branch: main
- HEAD: 446c897c3383cb2952e1a4eba4a5a5f902aa3626
- Snapshot Commit: 446c897c3383cb2952e1a4eba4a5a5f902aa3626

### Reviewed Scope

- `backend/app/api/v1/todos.py`
- `backend/tests/test_todos_delete.py`
- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-013-todo-delete-api.md`

### Review Findings

- Blocking Issues: None.
- Non-blocking Suggestions: Future static Todo routes such as `/api/v1/todos/today` must be registered before dynamic `/{todo_id}` routes to avoid route shadowing.
- Follow-up Tasks: After Git Commit publishes TASK-013, update Phase 1A progress so `DELETE /api/v1/todos/{id}` is marked done and the next task advances to Todo list cursor pagination.

### Review Evidence

- Current task and TASK archive both identify `TASK-013` and remain `Status: REVIEWING`.
- Task Review gate is `Result: PASS`.
- Git Snapshot is `Status: COMPLETE` with snapshot commit `446c897c3383cb2952e1a4eba4a5a5f902aa3626`.
- Code Review gate was `PENDING` before review and is now `PASS`.
- Implementation matches the approved `DELETE /api/v1/todos/{id}` scope.
- Missing/cross-user Todo returns `404 not_found`; current-user deleted Todo returns `410 deleted_resource`.
- Successful delete soft-deletes only, preserves lifecycle status/history, increments version once, and writes a matching `todo.deleted` sync tombstone.
- Same-key replay returns the stored response; conflicting key reuse returns `409 idempotency_key_conflict`; a new key after deletion returns `410 deleted_resource`.
- No Todo model, schema, migration, list, Today, sync pull, SSE, Reminder, frontend, or Android change was added.

### Verification

- `python -m pytest tests/test_todos_delete.py` from `D:\LifeOS\backend`: PASS, 6 passed.
- `python -m pytest` from `D:\LifeOS\backend`: PASS, 78 passed.
- `git diff --check`: PASS, no whitespace errors; Git reported expected LF-to-CRLF working-copy warnings.
- `git diff --cached --check`: PASS, no staged changes.
- New untracked test file trailing-whitespace scan: PASS.

### Recommended Commit Message

`feat(todo): add soft delete API`

## Git Commit

- Result: PENDING

## Closure

Pending.
