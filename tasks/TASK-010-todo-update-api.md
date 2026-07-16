# TASK-010 Todo Update API

## Metadata

- Task ID: TASK-010
- Task Name: Todo update API
- Status: COMPLETED
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: Todo create `f2fe55e`; Todo detail `deb240b`; TASK-009 terminal closure `f8614b3`

## Decision

Implement only `PATCH /api/v1/todos/{id}` as the next closeable Todo slice. Support partial ordinary-field updates with explicit null semantics, ownership isolation, idempotency, version increment, and atomic `todo.updated` sync write-through. Lifecycle actions remain separate tasks.

## In Scope

- PATCH for `title`, `note`, `category_id`, `priority`, `planned_date`, and `due_at`.
- Todo/category ownership and soft-delete behavior.
- Empty/invalid/forbidden payload validation.
- Idempotent atomic mutation, version increment, sync snapshot, and response.
- Focused tests and full backend regression verification.

## Out Of Scope

- Complete, reopen, delete, list, Today, sync pull, or SSE.
- Model or migration changes.
- Client-supplied lifecycle, ownership, version, or timestamp fields.
- Timezone-aware `due_at` hardening.
- Reminder, recurring Todo, Android, frontend, or PostgreSQL service work.

## Contract

- Omitted allowed fields stay unchanged.
- `note`, `category_id`, `planned_date`, and `due_at` accept null to clear.
- `title` and `priority` reject null; title rejects blank; priority allows only high/medium/low.
- Empty object and undeclared fields return `400 validation_error` with no side effect.
- Missing/cross-user Todo or category returns `404 not_found`; current-user deleted Todo or category returns `410 deleted_resource`.
- Accepted update increments version once, updates server timestamp, writes `todo.updated`, and returns `200` with Todo DTO and sync cursor.
- Replay returns the original response without another mutation or sync row; conflicting key reuse follows existing behavior.
- Status and lifecycle fields never change through PATCH.

## Allowed Files

- `backend/app/api/v1/todos.py`
- `backend/app/schemas/todo.py`
- Focused Todo update tests under `backend/tests/`
- Directly required small Todo helpers
- `docs/phase1a-progress.md`
- Active TASK-010 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- Todo models and migrations
- Product contract documents
- Lifecycle/list/Today/sync/SSE endpoints
- Category API behavior
- Frontend and Android files
- Completed TASK-005 through TASK-009 archives

## Acceptance Criteria

- [x] Allowed partial updates return updated DTO, version, and sync cursor.
- [x] Omitted fields stay unchanged and nullable fields can be cleared.
- [x] Empty, invalid, null-for-required, and forbidden payloads fail without mutation.
- [x] Todo and category ownership/deletion errors follow the defined `404`/`410` rules.
- [x] Pending, completed, and canceled active Todos retain status while ordinary fields are edited.
- [x] Version/timestamp mutation, `todo.updated` snapshot, and idempotency response are atomic and consistent.
- [x] Missing, replayed, and conflicting idempotency keys are covered without duplicate side effects.
- [x] Auth, UUID, DTO field exclusion, and rollback behavior are covered.
- [x] Focused and full tests pass; no migration or out-of-scope endpoint is added.

## Verification Plan

- Focused Todo update tests for all acceptance paths.
- Full `python -m pytest` from `backend/`.
- Route and endpoint-scope inspection.
- `git diff --check` and exact changed-file review.

## Risks

- Omitted/null field confusion.
- Cross-user existence leakage.
- Duplicate replay mutation.
- Version/snapshot/transaction inconsistency.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-14 21:13 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: f8614b319420f0762b080e9343c814c5fab7f9c8
- Snapshot Commit Created: Yes
- Snapshot Commit: f5fb71d6d3585482ac0b305ab6c7fca498dfe4e6
- Reason: approved TASK-010 readiness documents required a durable pre-Coding baseline.

## Coding Result

### Modified Files

- `backend/app/api/v1/todos.py`
- `backend/app/schemas/todo.py`
- `backend/tests/test_todos_update.py`
- `handoff/current-task.md`
- `tasks/TASK-010-todo-update-api.md`

Pre-existing TASK-010 state file preserved:

- `handoff/git-snapshot.md`

### Update And Null Behavior

- Added `PATCH /api/v1/todos/{id}` under the existing Todo router.
- Requires bearer authentication and `Idempotency-Key`.
- Accepts only `title`, `note`, `category_id`, `priority`, `planned_date`, and `due_at`.
- Rejects an empty update object with `400 validation_error`.
- Trims `title`; rejects null, empty, and whitespace-only title.
- Rejects null priority and values outside `high`, `medium`, `low`.
- Allows explicit null for `note`, `category_id`, `planned_date`, and `due_at` to clear those fields.
- Omitted fields remain unchanged.
- Rejects undeclared/internal fields through schema validation.

### Version And Transaction Behavior

- Queries Todo by ID and current user ID; missing and cross-user Todos both return `404 not_found`.
- Current-user soft-deleted Todo returns `410 deleted_resource`.
- Non-null category selection requires an active category owned by the current user.
- Accepted updates increment `version` exactly once and set `updated_at` using server time.
- Writes `todo.updated` with `entity_type=todo`, updated `entity_version`, and payload snapshot equal to the response Todo DTO.
- Persists Todo mutation, sync change, and idempotency response in one transaction.
- Idempotent replay returns the original response without another version increment or sync row.
- PATCH does not alter lifecycle status, completion, cancellation, deletion, ownership, or recurring/client fields.

### Acceptance Results

- Allowed partial update: covered.
- Omitted vs explicit null semantics: covered.
- Invalid, empty, null-for-required, and forbidden payload rollback: covered.
- Todo and category ownership/deletion errors: covered.
- Pending/completed/canceled ordinary-field edits with status preserved: covered.
- Version, timestamp, sync snapshot, and idempotency consistency: covered.
- Missing/replayed/conflicting idempotency behavior: covered.
- Auth, invalid path/payload UUID, DTO exclusion, and no duplicate side effects: covered.
- No model, migration, product contract, lifecycle endpoint, list, Today, sync, SSE, frontend, or Android changes were made.

### Verification Commands And Results

- `python -m pytest tests/test_todos_update.py`: PASS, 8 passed.
- `python -m pytest`: PASS, 62 passed.
- `rg -n '@router\\.(get|post|patch|delete)|prefix="/todos"|complete|reopen|today|sync' backend/app/api/v1/todos.py`: PASS, route file contains only create/detail/update Todo endpoints plus sync helper usage. Future static routes such as `/todos/today` must be registered before dynamic `/{todo_id}` routes.

### Git Diff Check

- `git status --short --untracked-files=all`: PASS, only TASK-010 allowed files are modified/untracked.
- `git diff --name-only`: PASS for tracked changes; new focused test file is listed by status as untracked.
- `git diff --stat`: reviewed.
- `git diff --check`: PASS, only Git LF/CRLF conversion warnings.
- `Select-String -Path backend/tests/test_todos_update.py -Pattern '[ \t]+$'`: PASS, no trailing whitespace in the new untracked test file.
- `git diff --cached`: PASS, empty.

### Unresolved Issues

None.

### Task-outside Findings

None.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-07-16 08:43 +08:00
- Branch: main
- HEAD: f5fb71d6d3585482ac0b305ab6c7fca498dfe4e6
- Snapshot Commit: f5fb71d6d3585482ac0b305ab6c7fca498dfe4e6
- Blocking Issues: None.
- Non-blocking Suggestions:
  - Future static Todo routes such as `/todos/today` must be registered before dynamic `/{todo_id}` routes.
- Follow-up Tasks:
  - Continue with Todo complete/reopen/delete slices after Git Commit publishes TASK-010.
- Verification:
  - `git diff --check`: PASS; LF/CRLF conversion warnings only.
  - `git diff --cached`: empty.
  - `git diff --cached --check`: PASS.
  - `python -m pytest tests/test_todos_update.py`: PASS, 8 passed.
  - `python -m pytest`: PASS, 62 passed.
  - `rg -n '@router\.(get|post|patch|delete)|prefix="/todos"|complete|reopen|today|sync' app/api/v1/todos.py`: reviewed; only Todo create/detail/update endpoints are registered. `sync` matches helper usage only.
  - Full API route scan found no out-of-scope Todo lifecycle, list, Today, sync pull, or SSE endpoint.
  - `Select-String -Path backend/tests/test_todos_update.py -Pattern '[ \t]+$'`: PASS.
- Reviewed Scope:
  - `backend/app/api/v1/todos.py`
  - `backend/app/schemas/todo.py`
  - `backend/tests/test_todos_update.py`
  - `handoff/current-task.md`
  - `handoff/git-snapshot.md`
  - `tasks/TASK-010-todo-update-api.md`
- Recommended Commit Message: `feat(todo): add Todo update API`

## Git Commit

- Result: PASS
- Committed by: Git Commit window
- Committed at: 2026-07-16
- Branch: main
- Result Commit: 09cd984163b948420ae4915f75422ed1b60dcaa2
- Commit Message: `feat(todo): add Todo update API`
- Push Target: origin/main
- Code Review Result: PASS

## Closure

Pending.
