# TASK-011 Todo Complete API

## Metadata

- Task ID: TASK-011
- Task Name: Todo complete API
- Status: COMPLETED
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: Todo create `f2fe55e`; Todo update `09cd984`; TASK-010 terminal closure `a2237de`

## Decision

Implement only `POST /api/v1/todos/{id}/complete` as the next closeable lifecycle slice. Complete an owned pending Todo with server timestamps, version increment, idempotency, and atomic `todo.completed` sync write-through. Reopen and delete remain separate tasks.

## In Scope

- `pending -> completed` action.
- Todo ownership, deletion, and invalid-state behavior.
- Server completion/update timestamp and version increment.
- Idempotent atomic mutation, sync snapshot, and response.
- Existing category DTO behavior during response serialization.
- Focused tests and full backend regression verification.

## Out Of Scope

- Reopen, delete, list, Today, sync pull, or SSE.
- Ordinary-field updates or canceled-state creation.
- Reminder cancellation/model/API behavior.
- Model, schema, or migration changes unless Task Review approves an unavoidable prerequisite.
- Frontend, Android, recurring Todo, offline replay, or PostgreSQL service work.

## Contract

- Endpoint accepts no body and requires bearer auth plus `Idempotency-Key`.
- Missing/cross-user Todo returns `404`; current-user deleted Todo returns `410`.
- Only pending can complete; completed or canceled returns `400 invalid_state_transition` without side effects.
- Success uses one server timestamp for `completed_at` and `updated_at`, increments version once, and returns `200` with DTO and sync cursor.
- `todo.completed` carries updated entity version and response-equivalent snapshot.
- Same-key replay has no duplicate effects; a new key after completion is an invalid transition.
- Missing or deleted category history does not block completion.

## Allowed Files

- `backend/app/api/v1/todos.py`
- Focused Todo complete tests under `backend/tests/`
- Directly required small Todo lifecycle helpers
- `docs/phase1a-progress.md`
- Active TASK-011 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- Models, schemas, or migrations unless explicitly approved by Task Review
- Product contract documents
- Reopen/delete/list/Today/sync/SSE or Reminder behavior
- Category API behavior
- Frontend and Android files
- Completed TASK-005 through TASK-010 archives

## Acceptance Criteria

- [x] Pending Todo completes with correct DTO, timestamps, version, and sync cursor.
- [x] Ordinary fields remain unchanged and completion/update timestamps are consistent.
- [x] Sync entity version and snapshot match persisted state and response.
- [x] Todo ownership/deletion errors follow `404`/`410` rules.
- [x] Completed/canceled invalid transitions have no side effects.
- [x] Missing, replayed, conflicting, and new-after-completion idempotency cases are covered without duplicate effects.
- [x] Auth, UUID, deleted/missing category serialization, DTO exclusion, and rollback behavior are covered.
- [x] Focused and full tests pass; no migration or out-of-scope endpoint is added.

## Verification Plan

- Focused Todo complete tests for all acceptance paths.
- Full `python -m pytest` from `backend/`.
- Route and endpoint-scope inspection.
- `git diff --check` and exact changed-file review.

## Risks

- Replay versus second-attempt confusion.
- Timestamp/version/snapshot inconsistency.
- Cross-user existence leakage.
- Incorrect category-history blocking.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-17 08:59 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: a2237de3e135216fa646cdea6e0d45336e59b836
- Snapshot Commit Created: Yes
- Snapshot Commit: 92d3b4ee1667f8afa4a210658d6058468775d67c
- Reason: approved TASK-011 readiness documents required a durable pre-Coding baseline.

## Coding Result

### Modified Files

- `backend/app/api/v1/todos.py`
- `backend/tests/test_todos_complete.py`
- `handoff/current-task.md`
- `tasks/TASK-011-todo-complete-api.md`

Pre-existing TASK-011 state file preserved:

- `handoff/git-snapshot.md`

### Transition And Error Behavior

- Added `POST /api/v1/todos/{id}/complete` under the existing Todo router.
- Requires bearer authentication and `Idempotency-Key`.
- Rejects non-empty request bodies with `400 validation_error`.
- Queries Todo by ID and current user ID; missing and cross-user Todos both return `404 not_found`.
- Current-user soft-deleted Todo returns `410 deleted_resource`.
- Only `status=pending` can complete; active completed or canceled Todos return `400 invalid_state_transition`.
- Soft-deleted or missing category history does not block completion and uses existing Todo DTO category serialization.

### Version, Timestamp, And Transaction Behavior

- Uses one server timestamp for both `completed_at` and `updated_at`.
- Sets `status=completed`, increments `version` exactly once, and leaves ordinary fields plus `canceled_at` unchanged.
- Writes `todo.completed` with `entity_type=todo`, updated `entity_version`, and payload snapshot equal to the response Todo DTO.
- Persists Todo mutation, sync change, and idempotency response in one transaction.
- Same-key replay returns the original response without another timestamp, version increment, or sync row.
- Same-key different query fingerprint returns `409 idempotency_key_conflict`.
- A new key after completion returns `400 invalid_state_transition` with no duplicate side effects.

### Acceptance Results

- Pending completion success: covered.
- Ordinary-field preservation and matching completion/update timestamp: covered.
- Sync entity version and response-equivalent snapshot: covered.
- Missing/cross-user/deleted Todo errors: covered.
- Completed/canceled invalid transitions with no side effects: covered.
- Missing/replayed/conflicting/new-after-completion idempotency: covered.
- Auth, invalid UUID, no-body validation, deleted/missing category serialization, DTO exclusion, and rollback behavior: covered.
- No model, schema, migration, product contract, reopen, delete, list, Today, sync, SSE, Reminder, frontend, or Android changes were made.

### Verification Commands And Results

- `python -m pytest tests/test_todos_complete.py`: PASS, 5 passed.
- `python -m pytest`: PASS, 67 passed.
- `rg -n '@router\\.(get|post|patch|delete)|prefix="/todos"|complete|reopen|today|sync' backend/app/api/v1/todos.py`: PASS, only create/detail/update/complete Todo routes plus sync helper usage are present.

### Git Diff Check

- `git status --short --untracked-files=all`: PASS, only TASK-011 allowed files are modified/untracked.
- `git diff --name-only`: PASS for tracked changes; new focused test file is listed by status as untracked.
- `git diff --stat`: reviewed.
- `git diff --check`: PASS, only Git LF/CRLF conversion warnings.
- `Select-String -Path backend/tests/test_todos_complete.py -Pattern '[ \t]+$'`: PASS, no trailing whitespace in the new untracked test file.
- `git diff --cached`: PASS, empty.

### Unresolved Issues

None.

### Task-outside Findings

None.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-07-17 09:09 +08:00
- Branch: main
- HEAD: 92d3b4ee1667f8afa4a210658d6058468775d67c
- Snapshot Commit: 92d3b4ee1667f8afa4a210658d6058468775d67c
- Blocking Issues: None.
- Non-blocking Suggestions:
  - Future static Todo routes such as `/todos/today` must be registered before dynamic `/{todo_id}` routes.
- Follow-up Tasks:
  - Continue with Todo reopen/delete slices after Git Commit publishes TASK-011.
- Verification:
  - `git diff --check`: PASS; LF/CRLF conversion warnings only.
  - `git diff --cached`: empty.
  - `git diff --cached --check`: PASS.
  - `python -m pytest tests/test_todos_complete.py`: PASS, 5 passed.
  - `python -m pytest`: PASS, 67 passed.
  - `python -m alembic heads`: PASS, `20260713_0004 (head)`.
  - `rg -n '@router\.(get|post|patch|delete)|prefix="/todos"|complete|reopen|today|sync' app/api/v1/todos.py`: reviewed; only Todo create/detail/update/complete endpoints are registered. `sync` matches helper usage only.
  - Full API route scan found no out-of-scope Todo reopen, delete, list, Today, sync pull, or SSE endpoint.
  - `Select-String -Path backend/tests/test_todos_complete.py -Pattern '[ \t]+$'`: PASS.
- Reviewed Scope:
  - `backend/app/api/v1/todos.py`
  - `backend/tests/test_todos_complete.py`
  - `handoff/current-task.md`
  - `handoff/git-snapshot.md`
  - `tasks/TASK-011-todo-complete-api.md`
- Recommended Commit Message: `feat(todo): add Todo complete API`

## Git Commit

- Result: PASS
- Committed by: Git Commit window
- Committed at: 2026-07-17
- Branch: main
- Result Commit: 2c35f1dc2ab94e6908bfcfb0bd67287b4114fb66
- Commit Message: `feat(todo): add Todo complete API`
- Push Target: origin/main
- Code Review Result: PASS

## Closure

Pending.
