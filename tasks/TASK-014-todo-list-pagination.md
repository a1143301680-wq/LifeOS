# TASK-014 Todo List Cursor Pagination And Filters

## Metadata

- Task ID: TASK-014
- Task Name: Todo list cursor pagination and filters
- Status: COMPLETED
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: Todo APIs through `3a97402`; TASK-013 terminal closure `b80ca37`

## Decision

Implement only `GET /api/v1/todos` as one collection-read slice. Filtering, deterministic ordering, and keyset cursor behavior ship together because each determines the correctness of the others.

## In Scope

- Authenticated, current-user, non-deleted Todo list.
- Status/category/planned-date/due-range filters and validated limit.
- Contracted mixed-direction, null-aware ordering.
- Base64url JSON v1 keyset cursor tied to normalized filters.
- Batch category summaries and focused regression tests.

## Out Of Scope

- Today, writes, sync pull, SSE, fanout, totals, search, alternate sorts, or offset pagination.
- Concurrent-mutation snapshot guarantees.
- Model/migration changes unless Task Review approves an unavoidable prerequisite.
- Frontend, Android, Reminder, recurrence, or offline replay.

## Contract

- Default: current user's non-deleted pending Todos, limit 50.
- Status supports pending/completed/all; all includes canceled.
- Category filter is direct and non-revealing; planned date is exact; due bounds are inclusive and timezone-aware.
- Order: planned date null-last ASC, due null-last ASC, priority high/medium/low, updated time DESC, UUID ASC.
- Cursor contains v1 anchor plus normalized filters; changing filters fails, changing limit is allowed.
- Response always includes `next_cursor`; final page uses null.
- Categories are batch-loaded and serialized as active/deleted/missing through the existing DTO.
- Read has no idempotency or sync side effects.

## Allowed Files

- `backend/app/api/v1/todos.py`
- `backend/app/schemas/todo.py` when directly required
- One focused Todo list cursor/query helper under `backend/app/`
- Focused Todo list tests under `backend/tests/`
- `docs/phase1a-progress.md`
- Active TASK-014 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- Models/migrations unless Task Review explicitly approves them
- Product contract documents
- Existing Todo/category behavior, Today, sync, SSE, or fanout
- Frontend and Android files
- Completed TASK-005 through TASK-013 archives

## Acceptance Criteria

- [x] Default and status lists enforce ownership, active-only visibility, and correct status semantics.
- [x] All filters and validation behavior match the task contract.
- [x] Exact mixed-direction/null-aware ordering is proven.
- [x] Multi-page traversal has no duplicates/skips on unchanged data.
- [x] Cursor schema/version/filter identity, malformed cases, and limit-change behavior are covered.
- [x] `next_cursor` behavior is correct at page boundaries.
- [x] Category summaries are correct and batch-loaded.
- [x] No write side effects or internal fields occur.
- [x] Focused/full tests and SQL/route checks pass without migration or out-of-scope endpoint changes.

## Verification Plan

- Focused list/filter/order/cursor/isolation/no-write tests.
- Full `python -m pytest` from `backend/`.
- SQLAlchemy null-order/keyset portability and category query-count inspection.
- Route-scope, `git diff --check`, and exact changed-file review.

## Risks

- Nullable mixed-order keyset errors.
- Incomplete cursor filter identity.
- SQLite/PostgreSQL ordering drift.
- N+1 category lookups.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-17 18:33 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: b80ca37e9e7f6ee8b441e7f8bc9cc8440ced1bee
- Snapshot Commit: dfd46b5954a3de529db9a8b7e96fe1107ba84e43
- Reason: approved TASK-014 readiness documents required a durable pre-Coding baseline

## Coding Result

### Modified Files

- `backend/app/api/v1/todos.py`
- `backend/app/services/todo_list.py`
- `backend/tests/test_todos_list.py`
- `handoff/current-task.md`
- `tasks/TASK-014-todo-list-pagination.md`

Pre-existing TASK-014 state file preserved:

- `handoff/git-snapshot.md`

### Implementation Summary

- Added authenticated `GET /api/v1/todos` using the normal list envelope with always-present `next_cursor`.
- Filters current-user active Todos by `deleted_at IS NULL`.
- Supports `status=pending|completed|all`, optional `category_id`, exact `planned_date`, inclusive timezone-aware `due_from`/`due_to`, `limit`, and opaque `cursor`.
- Rejects invalid status, UUID/date/timestamp, naive due timestamps, inverted due ranges, invalid limits, malformed cursors, unsupported cursor versions, schema/type errors, and cursor filter mismatches with `400 validation_error`.
- Added `backend/app/services/todo_list.py` for normalized filter identity, deterministic base64url JSON v1 cursor encoding, strict cursor decoding, explicit null-last ordering expressions, priority rank, and strict keyset resume.
- Applies fixed ordering: planned-date null-last ASC, due null-last ASC, priority high/medium/low, updated DESC, id ASC.
- Uses limit-plus-one fetching and derives `next_cursor` from the last returned row only when more rows exist.
- Batch-loads categories for the returned page and reuses existing Todo DTO serialization for active, soft-deleted, and absent categories.
- Keeps the endpoint read-only: no Idempotency-Key requirement, no sync change, no idempotency record, and no Todo mutation.

### Cursor Schema

- Cursor is unpadded base64url JSON with keys `v`, `filters`, and `anchor`.
- `filters` contains normalized `status`, `category_id`, `planned_date`, `due_from`, `due_to`, and fixed `sort=todo-list-v1`; `limit` is intentionally excluded.
- `anchor` contains explicit null flags and values for `planned_date` and `due_at`, plus `priority_rank`, `updated_at`, and `id`.

### Acceptance Criteria Results

- Default/status ownership and active-only visibility: covered.
- Category, planned-date, due-range, and combined filters: covered.
- Invalid query and cursor validation: covered.
- Mixed-direction/null-aware ordering: covered.
- Multi-page traversal without duplicates/skips and final `next_cursor=null`: covered.
- Cursor schema, malformed/version/schema/type cases, filter mismatch, and limit-change behavior: covered.
- Active/deleted/missing category summaries and one batch category query: covered.
- No write side effects or internal response fields: covered.
- No model, migration, product contract, Today, sync, SSE, frontend, Android, Reminder, recurrence, or offline replay changes were made.

### Verification Commands And Results

- `python -m pytest tests/test_todos_list.py`: PASS, 5 passed.
- `python -m pytest`: PASS, 83 passed.
- `rg -n '@router\.(get|post|patch|delete)|prefix="/todos"|today|sync|events|changes' backend/app/api/v1/todos.py`: PASS, only existing Todo create/detail/update/complete/reopen/delete plus new list route are present.
- `rg -n 'planned_null_expr|due_null_expr|todo_after_anchor_filter|order_by|base64|filters|SORT_VERSION|CURSOR_VERSION' backend/app/services/todo_list.py`: PASS, explicit null ordering, cursor versioning, filter identity, and keyset helper are present.
- `Select-String -Path D:\LifeOS\backend\tests\test_todos_list.py,D:\LifeOS\backend\app\services\todo_list.py -Pattern '[ \t]+$'`: PASS, no trailing whitespace in new untracked files.

### Git Diff Check

- `git status --short --untracked-files=all`: PASS, only TASK-014 implementation/state files plus pre-existing `handoff/git-snapshot.md` state diff are present.
- `git diff --stat`: PASS, reviewed focused route and state diffs; untracked helper/test files reviewed separately.
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
- Reviewed at: 2026-07-17 18:50 +08:00
- Branch: main
- HEAD: dfd46b5954a3de529db9a8b7e96fe1107ba84e43
- Snapshot Commit: dfd46b5954a3de529db9a8b7e96fe1107ba84e43

### Reviewed Scope

- `backend/app/api/v1/todos.py`
- `backend/app/services/todo_list.py`
- `backend/tests/test_todos_list.py`
- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-014-todo-list-pagination.md`

### Review Findings

- Blocking Issues: None.
- Non-blocking Suggestions: Cursor anchor timestamp timezone validation is not explicitly enforced during cursor decoding; current production path should emit timezone-aware timestamps through PostgreSQL/timestamptz, but a future hardening test can lock this down.
- Follow-up Tasks: After Git Commit publishes TASK-014, update Phase 1A progress so `GET /api/v1/todos` is marked done and the next task advances to Today Todo aggregation.

### Review Evidence

- Current task and TASK archive both identify `TASK-014` and remain `Status: REVIEWING`.
- Task Review gate is `Result: PASS`.
- Git Snapshot is `Status: COMPLETE` with snapshot commit `dfd46b5954a3de529db9a8b7e96fe1107ba84e43`.
- Code Review gate was `PENDING` before review and is now `PASS`.
- Implementation matches the approved `GET /api/v1/todos` scope.
- List endpoint filters by current user and `deleted_at IS NULL`, supports contracted status/category/planned-date/due-range/limit/cursor parameters, and remains read-only.
- Ordering is explicit for null placement, priority rank, descending `updated_at`, and `id ASC` tie-breaking.
- Cursor contains version, normalized filters, and final ordering anchor; filter mismatch rejects while limit changes remain valid.
- Category summaries are batch-loaded and cover active, soft-deleted, and missing category cases.
- No Todo model, schema, migration, Today, sync pull, SSE, fanout, Reminder, frontend, Android, recurrence, or offline replay change was added.

### Verification

- `python -m pytest tests/test_todos_list.py` from `D:\LifeOS\backend`: PASS, 5 passed.
- `python -m pytest` from `D:\LifeOS\backend`: PASS, 83 passed.
- `python -m alembic heads` from `D:\LifeOS\backend`: PASS, `20260713_0004 (head)`.
- `git diff --check`: PASS, no whitespace errors; Git reported expected LF-to-CRLF working-copy warnings.
- `git diff --cached --check`: PASS, no staged changes.
- New untracked helper/test trailing-whitespace scan: PASS.

### Recommended Commit Message

`feat(todo): add cursor-paginated list API`

## Git Commit

- Result: PASS
- Committed by: Git Commit window
- Committed at: 2026-07-19
- Branch: main
- Result Commit: dd0d6fa9724b38c004c1737203d2d6280596ee2b
- Commit Message: `feat(todo): add cursor-paginated list API`
- Push Target: origin/main
- Code Review Result: PASS
- Completion Record: this Git Commit completion metadata commit

## Closure

Closure Check: PASS

- Checked At: 2026-07-19 09:58 +08:00
- Result Commit: `dd0d6fa9724b38c004c1737203d2d6280596ee2b`
- Completion Commit: `ee6f17d38292a6c4f21979c6ef35fb51d50f46b1`
- Remote Verification: local `main`, `origin/main`, and remote `refs/heads/main` all matched `ee6f17d38292a6c4f21979c6ef35fb51d50f46b1`.
- Working Tree Before Closure Docs: clean.
- Review Evidence: Code Review `PASS`; no blocking issue remained.
- Test Evidence: focused Todo list tests `5 passed`; full backend suite `83 passed`; Alembic head, route, cursor/null-order, and whitespace checks passed.
- Acceptance Criteria Result: all TASK-014 acceptance criteria confirmed.
- Issue Disposition: no TASK-014 issue-log entry, unresolved blocking issue, or task-outside finding remained. Cursor-anchor timezone validation is retained as a non-blocking hardening follow-up.
- Remaining Follow-ups:
  - Add explicit timezone-awareness validation for decoded cursor anchor timestamps in a future hardening slice.
  - Continue with Today Todo aggregation.

Terminal Closure Commit approval:

- Approved files:
  - `handoff/current-task.md`
  - `handoff/project-state.md`
  - `tasks/TASK-014-todo-list-pagination.md`
- Commit message: `docs(task): close TASK-014`
- This commit is terminal and must not trigger another Closure Check or create new state files.
