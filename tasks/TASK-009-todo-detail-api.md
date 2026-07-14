# TASK-009 Todo Detail API

## Metadata

- Task ID: TASK-009
- Task Name: Todo detail API
- Status: REVIEWING
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: Todo create foundation `f2fe55e`; TASK-008 terminal closure `2efce90`

## Decision

Implement only `GET /api/v1/todos/{id}` as the next closeable Todo API slice. Preserve current-user isolation, distinguish a deleted Todo from a deleted category, reuse the stable Todo DTO, and prove the read endpoint has no write side effects.

## In Scope

- Authenticated Todo detail endpoint.
- Owned active Todo response through the existing DTO helper.
- Active, soft-deleted, and missing category representation.
- Missing, cross-user, soft-deleted Todo, authentication, and invalid UUID behavior.
- Focused tests and full backend regression verification.

## Out Of Scope

- Todo PATCH, complete, reopen, delete, list, Today, sync pull, or SSE.
- Model or migration changes.
- Idempotency or sync writes for GET.
- Timezone-aware `due_at` input hardening.
- Reminder, recurring Todo, Android, frontend, or local PostgreSQL service work.

## Contract

- Missing or cross-user Todo: `404 not_found`.
- Current-user soft-deleted Todo: `410 deleted_resource`.
- Active Todo with a soft-deleted category remains readable and returns category `is_deleted=true`.
- Missing category relation returns `category=null`.
- Success: `200`, normal data envelope, stable Todo DTO, no write `sync` metadata.
- No internal ownership, deletion, recurring/client, or sync fields are exposed.

## Allowed Files

- `backend/app/api/v1/todos.py`
- `backend/app/schemas/todo.py` only when directly required
- Focused Todo detail tests under `backend/tests/`
- `docs/phase1a-progress.md`
- Active TASK-009 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- Todo models and migrations
- Product contract documents
- Other Todo endpoints or category behavior
- Frontend and Android files
- Completed TASK-005 through TASK-008 archives

## Acceptance Criteria

- [x] Owned active Todo detail returns `200` and the stable DTO.
- [x] Active category summary uses `is_deleted=false`.
- [x] Soft-deleted category summary uses `is_deleted=true` without hiding the Todo.
- [x] Missing category relation is serialized as null without failure.
- [x] Missing and cross-user Todo return indistinguishable `404 not_found` responses.
- [x] Current-user soft-deleted Todo returns `410 deleted_resource`.
- [x] Auth and invalid UUID behavior follow existing conventions.
- [x] Internal fields and write `sync` metadata are absent.
- [x] The endpoint creates no Todo, idempotency record, or sync change.
- [x] Focused and full backend tests pass; no out-of-scope endpoint or migration is added.

## Verification Plan

- Focused Todo detail tests for all acceptance paths.
- Full `python -m pytest` from `backend/`.
- Route ordering inspection for future `/todos/today` compatibility.
- `git diff --check` and exact changed-file review.

## Risks

- Cross-user existence leakage.
- Incorrect `404` for an owned soft-deleted Todo.
- Incorrectly treating a deleted category as a deleted Todo.
- Dynamic route ordering conflict with future static routes.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-14 20:36 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: 2efce90a31dbb4191e06c2ee8c6eec20e389389a
- Snapshot Commit Created: Yes
- Snapshot Commit: 78eb5e363ac529471b1ce411746cf809a78b6aa1
- Reason: approved TASK-009 readiness documents required a durable pre-Coding baseline.

## Coding Result

### Modified Files

- `backend/app/api/v1/todos.py`
- `backend/tests/test_todos_detail.py`
- `handoff/current-task.md`
- `tasks/TASK-009-todo-detail-api.md`

Pre-existing TASK-009 state file preserved:

- `handoff/git-snapshot.md`

### Endpoint Behavior

- Added `GET /api/v1/todos/{id}` under the existing Todo router.
- Requires bearer authentication through the existing auth dependency.
- Queries by both Todo ID and current user ID so missing and cross-user Todos both return `404 not_found`.
- Returns current-user soft-deleted Todos as `410 deleted_resource`.
- Reuses `todo_to_dict` for the normal Todo DTO.
- Returns active category summary with `is_deleted=false`.
- Returns soft-deleted category summary with `is_deleted=true` while keeping the Todo readable.
- Returns `category=null` when `category_id` is null or no same-user category row can be resolved.
- Does not include write `sync` metadata and does not require or persist `Idempotency-Key`.

### Acceptance Results

- Owned active detail response: covered.
- Active category summary: covered.
- Soft-deleted category summary: covered.
- Missing/null category relation: covered.
- Missing and cross-user Todo indistinguishable `404`: covered.
- Current-user soft-deleted Todo `410`: covered.
- Missing/invalid auth and invalid UUID behavior: covered.
- Internal fields and sync metadata absence: covered.
- No Todo, idempotency, or sync side effects: covered.
- No model, migration, other endpoint, category API, frontend, or Android changes were made.

### Verification Commands And Results

- `python -m pytest tests/test_todos_detail.py`: PASS, 7 passed.
- `python -m pytest`: PASS, 54 passed.
- `rg -n '@router\\.(get|post)|prefix="/todos"' backend/app/api/v1/todos.py`: PASS, current route order is `POST /todos` then `GET /todos/{id}`. Future static routes such as `/todos/today` must be registered before the dynamic `/{todo_id}` route.

### Git Diff Check

- `git status --short --untracked-files=all`: PASS, only TASK-009 allowed files are modified/untracked.
- `git diff --name-only`: PASS for tracked changes; new focused test file is listed by status as untracked.
- `git diff --stat`: reviewed.
- `git diff --check`: PASS, only Git LF/CRLF conversion warnings.
- `git diff --cached`: PASS, empty.

### Unresolved Issues

None.

### Task-outside Findings

None.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-07-14 20:51 +08:00
- Branch: main
- HEAD: 78eb5e363ac529471b1ce411746cf809a78b6aa1
- Snapshot Commit: 78eb5e363ac529471b1ce411746cf809a78b6aa1
- Blocking Issues: None.
- Non-blocking Suggestions:
  - Future static Todo routes such as `/todos/today` must be registered before the dynamic `/{todo_id}` route.
- Follow-up Tasks:
  - Continue with Todo update/lifecycle slices after Git Commit publishes TASK-009.
- Verification:
  - `git diff --check`: PASS; LF/CRLF conversion warnings only.
  - `git diff --cached`: empty.
  - `git diff --cached --check`: PASS.
  - `python -m pytest tests/test_todos_detail.py`: PASS, 7 passed.
  - `python -m pytest`: PASS, 54 passed.
  - `rg -n '@router\.(get|post)|prefix="/todos"' app/api/v1/todos.py`: PASS; current order is `POST /todos` then `GET /todos/{todo_id}`.
  - Full API route scan found no out-of-scope Todo lifecycle, list, Today, sync pull, or SSE endpoint.
- Reviewed Scope:
  - `backend/app/api/v1/todos.py`
  - `backend/tests/test_todos_detail.py`
  - `handoff/current-task.md`
  - `handoff/git-snapshot.md`
  - `tasks/TASK-009-todo-detail-api.md`
- Recommended Commit Message: `feat(todo): add Todo detail API`

## Git Commit

- Result: PENDING

## Closure

Pending.
