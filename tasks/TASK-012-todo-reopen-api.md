# TASK-012 Todo Reopen API

## Metadata

- Task ID: TASK-012
- Task Name: Todo reopen API
- Status: COMPLETED
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: Todo update `09cd984`; Todo complete `2c35f1d`; TASK-011 terminal closure `c2a2fac`

## Decision

Implement only `POST /api/v1/todos/{id}/reopen` as the next closeable lifecycle slice. Reopen an owned completed Todo with server timestamp, version increment, idempotency, and atomic `todo.reopened` sync write-through. Delete remains a separate task.

## In Scope

- `completed -> pending` action and clearing `completed_at`.
- Todo ownership, deletion, and invalid-state behavior.
- Server update timestamp and version increment.
- Idempotent atomic mutation, sync snapshot, and response.
- Existing category DTO behavior during response serialization.
- Focused tests and full backend regression verification.

## Out Of Scope

- Delete, list, Today, sync pull, or SSE.
- Ordinary-field or complete behavior changes.
- Canceled reopen, Reminder behavior, or recurring Todo.
- Model, schema, or migration changes unless Task Review approves an unavoidable prerequisite.
- Frontend, Android, offline replay, or PostgreSQL service work.

## Contract

- No body; bearer auth and `Idempotency-Key` required.
- Missing/cross-user Todo returns `404`; current-user deleted Todo returns `410`.
- Only completed can reopen; pending/canceled returns `400 invalid_state_transition` without side effects.
- Success sets pending, clears `completed_at`, updates server timestamp, increments version once, and returns DTO plus sync cursor.
- `todo.reopened` carries updated entity version and response-equivalent snapshot.
- Same-key replay has no duplicate effect; a new key after reopening is an invalid transition.
- Missing or deleted category history does not block reopening.

## Allowed Files

- `backend/app/api/v1/todos.py`
- Focused Todo reopen tests under `backend/tests/`
- Directly required small Todo lifecycle helpers
- `docs/phase1a-progress.md`
- Active TASK-012 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- Models, schemas, or migrations unless Task Review explicitly approves them
- Product contract documents
- Delete/list/Today/sync/SSE or Reminder behavior
- Category API behavior
- Frontend and Android files
- Completed TASK-005 through TASK-011 archives

## Acceptance Criteria

- [x] Completed Todo reopens with pending status, null completion time, updated version/time, DTO, and sync cursor.
- [x] Ordinary fields and cancellation data remain unchanged.
- [x] Sync version and snapshot match persisted state and response.
- [x] Ownership/deletion errors follow `404`/`410` rules.
- [x] Pending/canceled invalid transitions have no side effects.
- [x] Missing, replayed, conflicting, and new-after-reopen idempotency cases have no duplicate effects.
- [x] Auth, UUID, category history, DTO exclusion, and rollback behavior are covered.
- [x] Focused and full tests pass; no migration or out-of-scope endpoint is added.

## Verification Plan

- Focused Todo reopen tests for all acceptance paths.
- Full `python -m pytest` from `backend/`.
- Route and endpoint-scope inspection.
- `git diff --check` and exact changed-file review.

## Risks

- Replay versus second-attempt confusion.
- Status/timestamp/version/snapshot inconsistency.
- Cross-user existence leakage.
- Incorrect category-history blocking.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-17 09:23 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: c2a2facdd0a4da5426f41bd797747b67628319dc
- Snapshot Commit: 13a7de1051ad90e0ff774efcd0c1ddd4107f11cf
- Reason: approved TASK-012 readiness documents required a durable pre-Coding baseline

## Coding Result

### Modified Files

- `backend/app/api/v1/todos.py`
- `backend/tests/test_todos_reopen.py`
- `handoff/current-task.md`
- `tasks/TASK-012-todo-reopen-api.md`

Pre-existing TASK-012 state file preserved:

- `handoff/git-snapshot.md`

### Transition And Error Behavior

- Added `POST /api/v1/todos/{id}/reopen` under the existing Todo router.
- Requires bearer authentication and `Idempotency-Key`.
- Rejects non-empty request bodies with `400 validation_error`.
- Queries Todo by ID and current user ID; missing and cross-user Todos both return `404 not_found`.
- Current-user soft-deleted Todo returns `410 deleted_resource`.
- Only `status=completed` can reopen; active pending or canceled Todos return `400 invalid_state_transition`.
- Soft-deleted or missing category history does not block reopening and uses existing Todo DTO serialization.

### Timestamp, Version, And Transaction Behavior

- Uses server time for `updated_at`.
- Sets `status=pending`, clears `completed_at`, increments `version` exactly once, and leaves ordinary fields plus `canceled_at` unchanged.
- Writes `todo.reopened` with `entity_type=todo`, updated `entity_version`, and payload snapshot equal to the response Todo DTO.
- Persists Todo mutation, sync change, and idempotency response in one transaction.
- Same-key replay returns the original response without another timestamp, version increment, or sync row.
- Same-key different query fingerprint returns `409 idempotency_key_conflict`.
- A new key after reopening returns `400 invalid_state_transition` with no duplicate side effects.

### Acceptance Results

- Completed reopen success: covered.
- Ordinary-field preservation and cleared completion timestamp: covered.
- Sync entity version and response-equivalent snapshot: covered.
- Missing/cross-user/deleted Todo errors: covered.
- Pending/canceled invalid transitions with no side effects: covered.
- Missing/replayed/conflicting/new-after-reopen idempotency: covered.
- Auth, invalid UUID, no-body validation, deleted/missing category serialization, DTO exclusion, and rollback behavior: covered.
- No model, schema, migration, product contract, delete, list, Today, sync, SSE, Reminder, frontend, or Android changes were made.

### Verification Commands And Results

- `python -m pytest tests/test_todos_reopen.py`: PASS, 5 passed.
- `python -m pytest`: PASS, 72 passed.
- `rg -n '@router\\.(get|post|patch|delete)|prefix="/todos"|complete|reopen|today|sync' backend/app/api/v1/todos.py`: PASS, only create/detail/update/complete/reopen Todo routes plus sync helper usage are present.

### Git Diff Check

- `git status --short --untracked-files=all`: PASS, only TASK-012 implementation/state files plus pre-existing `handoff/git-snapshot.md` state diff are present.
- `git diff --stat`: PASS, reviewed focused route, task-state, and snapshot-state diffs; untracked focused test file reviewed separately.
- `git diff --check`: PASS, no whitespace errors; Git reported expected LF-to-CRLF working-copy warnings.
- `Select-String -Path D:\LifeOS\backend\tests\test_todos_reopen.py -Pattern '[ \t]+$'`: PASS, no trailing whitespace in the new untracked test file.
- `git diff --cached`: PASS, empty.

### Unresolved Issues

None.

### Task-outside Findings

None.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-07-17 09:48 +08:00
- Branch: main
- HEAD: 13a7de1051ad90e0ff774efcd0c1ddd4107f11cf
- Snapshot Commit: 13a7de1051ad90e0ff774efcd0c1ddd4107f11cf
- Blocking Issues: None.
- Non-blocking Suggestions:
  - Future static Todo routes such as `/todos/today` must be registered before dynamic `/{todo_id}` routes.
- Follow-up Tasks:
  - Continue with Todo delete as the next lifecycle slice after Git Commit publishes TASK-012.
- Verification:
  - `git diff --check`: PASS; LF/CRLF conversion warnings only.
  - `git diff --cached`: empty.
  - `git diff --cached --check`: PASS.
  - `python -m pytest tests/test_todos_reopen.py`: PASS, 5 passed.
  - `python -m pytest`: PASS, 72 passed.
  - `python -m alembic heads`: PASS, `20260713_0004 (head)`.
  - `rg -n '@router\.(get|post|patch|delete)|prefix="/todos"|complete|reopen|today|sync' app/api/v1/todos.py`: reviewed; only Todo create/detail/update/complete/reopen endpoints are registered. `sync` matches helper usage only.
  - Full API route scan found no out-of-scope Todo delete, list, Today, sync pull, or SSE endpoint.
  - `Select-String -Path backend/tests/test_todos_reopen.py -Pattern '[ \t]+$'`: PASS.
- Reviewed Scope:
  - `backend/app/api/v1/todos.py`
  - `backend/tests/test_todos_reopen.py`
  - `handoff/current-task.md`
  - `handoff/git-snapshot.md`
  - `tasks/TASK-012-todo-reopen-api.md`
- Recommended Commit Message: `feat(todo): add Todo reopen API`

## Git Commit

- Result: PASS
- Committed by: Git Commit window
- Committed at: 2026-07-17
- Branch: main
- Result Commit: c2d167fdd063d362ef20e9ec0b1de17a08b62191
- Commit Message: `feat(todo): add Todo reopen API`
- Push Target: origin/main
- Code Review Result: PASS
- Completion Record: this Git Commit completion metadata commit

## Closure

Closure Check: PASS

- Checked At: 2026-07-17 09:55 +08:00
- Result Commit: `c2d167fdd063d362ef20e9ec0b1de17a08b62191`
- Completion Commit: `f438a64cb84d7292f6f62bdc399048146311d45a`
- Remote Verification: local `main`, `origin/main`, and remote `refs/heads/main` all matched `f438a64cb84d7292f6f62bdc399048146311d45a`.
- Working Tree Before Closure Docs: clean.
- Review Evidence: Code Review `PASS`; no blocking issue remained.
- Test Evidence: focused Todo reopen tests `5 passed`; full backend suite `72 passed`; Alembic head and endpoint-scope scans passed.
- Acceptance Criteria Result: all TASK-012 acceptance criteria confirmed.
- Issue Disposition: no TASK-012 issue-log entry, unresolved issue, or task-outside finding remained.
- Remaining Follow-ups:
  - Register future static Todo routes such as `/todos/today` before dynamic `/{todo_id}` routes.
  - Continue with a separately reviewable Todo delete slice.

Terminal Closure Commit approval:

- Approved files:
  - `handoff/current-task.md`
  - `handoff/project-state.md`
  - `tasks/TASK-012-todo-reopen-api.md`
- Commit message: `docs(task): close TASK-012`
- This commit is terminal and must not trigger another Closure Check or create new state files.
