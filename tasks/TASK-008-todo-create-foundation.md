# TASK-008 Todo Model Migration And Create API

## Metadata

- Task ID: TASK-008
- Task Name: Todo model, migration, and create API
- Status: REVIEWING
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: Category CRUD `83ac3eb`; default categories `d1c0dbf`; workflow closure `4c5c315`

## Decision

Create the Todo persistence foundation and `POST /api/v1/todos` vertical slice with user/category isolation, default Inbox resolution, idempotency, sync write-through, and tests. Other Todo endpoints remain out of scope.

## Key Contract

- Request fields: optional `id`, required nonblank `title`, optional `note`, optional `category_id`, optional `priority`, `planned_date`, and `due_at`.
- Server fields: `status=pending`, `priority=medium` by default, `version=1`.
- Omitted category uses the user's active Inbox.
- Supplied category must be active and owned by the user.
- Writes require `Idempotency-Key` and atomically create `todo.created` sync state.
- Response: `201` Todo DTO plus `sync.cursor`.
- `recurring_template_id` is nullable and has no foreign key until the recurring-template table exists.

## Acceptance Criteria

- [x] Todo model and migration match the Phase 1 data model and indexes.
- [x] Create happy paths work with default Inbox and supplied owned category.
- [x] Authentication, ownership, deleted-category, validation, UUID, and idempotency paths are covered.
- [x] Todo, sync change, and idempotency record are atomic.
- [x] Two-user isolation is covered.
- [x] Focused and full backend tests pass.
- [x] Alembic chain and PostgreSQL verification status are recorded.
- [x] No other Todo endpoint or excluded feature is implemented.

## Task Review

- REVIEW RESULT: PASS
- Reviewed by: Task Review window
- Reviewed at: 2026-07-13 21:32 +08:00
- Result: task is ready for Git Snapshot.
- Blocking Issues: None.

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: 4c5c31565f3cab79472dfde47c8ce8cba40885d1
- Snapshot Commit Created: Yes
- Snapshot Commit: 20efdb916efdc4df7ec3752a69ee87b29e24c85a
- Reason: approved TASK-008 readiness documents required a durable pre-Coding baseline.

## Coding Result

### Modified Files

- `backend/app/models/todo.py`
- `backend/app/schemas/todo.py`
- `backend/app/api/v1/todos.py`
- `backend/alembic/versions/20260713_0004_add_todos.py`
- `backend/app/models/__init__.py`
- `backend/app/api/v1/router.py`
- `backend/alembic/env.py`
- `backend/tests/test_todos_create.py`
- `handoff/current-task.md`
- `tasks/TASK-008-todo-create-foundation.md`

Pre-existing TASK-008 state file preserved:

- `handoff/git-snapshot.md`

### Migration Details

- Added `todos` table with Phase 1 fields: owner/category, nullable `recurring_template_id` without foreign key, title/note, status, priority, planned/due/completion/cancel/generated dates, offline client placeholders, version, timestamps, and soft delete.
- Added status and priority check constraints.
- Added recommended indexes for `(user_id, status, planned_date)`, `(user_id, due_at)`, `(user_id, category_id)`, `(user_id, updated_at)`, and `(recurring_template_id, generated_for_date)`.
- Alembic chain head is `20260713_0004`.

### API Behavior

- Added `POST /api/v1/todos` only.
- Requires bearer auth and `Idempotency-Key`.
- Accepts only `id`, `title`, `note`, `category_id`, `priority`, `planned_date`, and `due_at`.
- Trims title and rejects blank titles.
- Defaults priority to `medium`; allows only `high`, `medium`, `low`.
- Creates only `status=pending`, `version=1`, with null completion/cancellation/deletion/internal client fields.
- Omits `category_id` by resolving exactly one active owned Inbox.
- Supplied category must be active and owned by the current user.
- Writes Todo, `todo.created` sync change, and idempotency response in one transaction.
- Response is `201` with Todo DTO and `sync.cursor`.

### Acceptance Results

- Default Inbox create: covered.
- Supplied owned active category create: covered.
- Missing/cross-user category returns `404 not_found`: covered.
- Current-user soft-deleted category returns `410 deleted_resource`: covered.
- Missing, replayed, and conflicting idempotency key behavior: covered.
- Client UUID preservation, server UUID generation, invalid UUID, and UUID collision: covered.
- Forbidden/internal request fields rejected by schema validation: covered.
- Sync payload snapshot matches response Todo DTO: covered.
- Two-user isolation: covered.
- Out-of-scope Todo endpoints were not implemented.

### Verification Commands And Results

- `python -m pytest tests/test_todos_create.py`: PASS, 9 passed.
- `python -m pytest`: PASS, 47 passed.
- `python -m alembic heads`: PASS, `20260713_0004 (head)`.
- `python -m alembic upgrade head --sql | Select-String -Pattern 'CREATE TABLE todos|ck_todos_status|ix_todos_user_status_planned_date|20260713_0004'`: PASS, offline PostgreSQL SQL includes the Todo table, constraint, index, and version update.
- `python -m alembic current` against default PostgreSQL: NOT COMPLETED, connection timed out.
- `Get-Service` / `Test-NetConnection`: PostgreSQL service `postgresql-x64-18` exists but is stopped; TCP 5432 failed.
- `Start-Service -Name postgresql-x64-18`: NOT COMPLETED, current shell could not open/start the service.

### Git Diff Check

- `git status --short --untracked-files=all`: PASS, only TASK-008 allowed backend implementation files and active workflow state files are modified/untracked.
- `git diff --name-only`: PASS for tracked files; untracked new Todo files are listed by status.
- `git diff --stat`: reviewed.
- `git diff --check`: PASS, only Git LF/CRLF conversion warnings.
- `git diff --cached`: PASS, empty.

### Unresolved Issues

- Live PostgreSQL migration/current verification could not run because the local PostgreSQL service is stopped and this shell cannot start it.

### Task-outside Findings

None.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-07-14 08:34 +08:00
- Branch: main
- HEAD: 20efdb916efdc4df7ec3752a69ee87b29e24c85a
- Snapshot Commit: 20efdb916efdc4df7ec3752a69ee87b29e24c85a
- Blocking Issues: None.
- Non-blocking Suggestions:
  - Enforce timezone-aware `due_at` input validation in a future Todo validation hardening slice so request handling fully matches the documented timestamp format.
- Follow-up Tasks:
  - Run live PostgreSQL `alembic upgrade head` / `alembic current` verification when the local PostgreSQL service is available.
  - Continue with the planned Todo detail/update/complete/reopen/delete slice after Git Commit publishes TASK-008.
- Verification:
  - `git diff --check`: PASS; LF/CRLF conversion warnings only.
  - `git diff --cached`: empty.
  - `git diff --cached --check`: PASS.
  - `python -m pytest tests/test_todos_create.py`: PASS, 9 passed.
  - `python -m pytest`: PASS, 47 passed.
  - `python -m alembic heads`: PASS, `20260713_0004 (head)`.
  - `python -m alembic upgrade head --sql | Select-String -Pattern 'CREATE TABLE todos|ck_todos_status|ix_todos_user_status_planned_date|20260713_0004'`: PASS.
  - `python -m alembic current`: NOT COMPLETED; configured PostgreSQL connection timed out.
- Reviewed Scope:
  - `backend/alembic/env.py`
  - `backend/alembic/versions/20260713_0004_add_todos.py`
  - `backend/app/api/v1/router.py`
  - `backend/app/api/v1/todos.py`
  - `backend/app/models/__init__.py`
  - `backend/app/models/todo.py`
  - `backend/app/schemas/todo.py`
  - `backend/tests/test_todos_create.py`
  - `handoff/current-task.md`
  - `handoff/git-snapshot.md`
  - `tasks/TASK-008-todo-create-foundation.md`
- Recommended Commit Message: `feat(todo): add Todo create foundation`

## Git Commit

Pending.

## Closure

Pending.

## Follow-up Tasks

- Todo detail/update/complete/reopen/delete slice.
- Todo list cursor/filter slice.
