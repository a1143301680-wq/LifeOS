# TASK-014 Todo List Cursor Pagination And Filters

## Metadata

- Task ID: TASK-014
- Task Name: Todo list cursor pagination and filters
- Status: READY
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

- [ ] Default and status lists enforce ownership, active-only visibility, and correct status semantics.
- [ ] All filters and validation behavior match the task contract.
- [ ] Exact mixed-direction/null-aware ordering is proven.
- [ ] Multi-page traversal has no duplicates/skips on unchanged data.
- [ ] Cursor schema/version/filter identity, malformed cases, and limit-change behavior are covered.
- [ ] `next_cursor` behavior is correct at page boundaries.
- [ ] Category summaries are correct and batch-loaded.
- [ ] No write side effects or internal fields occur.
- [ ] Focused/full tests and SQL/route checks pass without migration or out-of-scope endpoint changes.

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

- Status: PENDING

## Coding Result

Pending.

## Code Review

- Result: PENDING

## Git Commit

- Result: PENDING

## Closure

Pending.
