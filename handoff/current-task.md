# LifeOS Current Task

Last updated: 2026-07-17

## Metadata

- Task ID: TASK-014
- Task Name: Todo list cursor pagination and filters
- Status: REVIEWING
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies:
  - Todo CRUD and lifecycle APIs published through `3a97402`
  - TASK-013 terminal closure published in `b80ca37`

## Background

Todo persistence and all single-item CRUD/lifecycle mutations are available. The next Phase 1A slice is the main Todo collection read with deterministic filtering, ordering, and opaque keyset pagination for PC and Android clients.

## Goal

An authenticated user can list only owned, non-deleted Todos using the contracted filters and stable keyset cursor, with deterministic ordering and no duplicate or skipped rows on an unchanged dataset.

## Scope

### In Scope

- `GET /api/v1/todos` only.
- Status, category, planned-date, due-range, limit, and cursor query parameters.
- Contracted null-aware ordering and priority rank.
- Versioned base64url JSON keyset cursor tied to normalized filters and fixed sort.
- Stable Todo DTOs including active, deleted, or absent category summaries.
- Two-user isolation, validation, pagination boundaries, and focused tests.

### Out of Scope

- `GET /api/v1/todos/today`.
- Todo writes, sync pull, SSE, or fanout.
- Full-text search, alternate sorts, offset pagination, totals/counts, or cursor signing/encryption.
- Snapshot isolation across concurrent mutations; guarantees apply to an unchanged dataset.
- Todo model or Alembic migration changes unless Task Review proves one unavoidable.
- Frontend, Android, Reminder, recurring Todo, offline replay, or full login work.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 2, 5-7, 9.4, and 10.1
- `docs/data-model-phase1.md` Todo fields/indexes and ownership rules
- `docs/phase1a-progress.md`
- `backend/app/api/v1/todos.py`
- Existing Todo DTO, auth/error/envelope patterns, models, and tests

### Allowed Modify Files

- `backend/app/api/v1/todos.py`
- `backend/app/schemas/todo.py` only if directly needed for list query/cursor validation
- A focused Todo list cursor/query helper under `backend/app/` when it materially reduces complexity
- New or existing focused Todo list tests under `backend/tests/`
- `docs/phase1a-progress.md`
- Active handoff, gate, Git record, issue-log, and TASK-014 state files

### Forbidden Modify Files

- Todo models or Alembic migrations unless Task Review explicitly approves an unavoidable prerequisite
- Existing Todo/category write or detail behavior
- Today, sync pull, SSE, or fanout endpoints
- Product requirements, architecture, API contract, and data-model documents unless Task Review returns a contract ambiguity to Decision
- Frontend or Android files
- Completed TASK-005 through TASK-013 archives

## Implementation Requirements

- Add authenticated `GET /api/v1/todos` using the normal list envelope with `items`, always-present `next_cursor` (string or null), and `server_time`.
- Always filter by current user and `deleted_at IS NULL`.
- Support `status=pending|completed|all`, default `pending`. `all` includes pending, completed, and canceled active Todos.
- Support optional `category_id` UUID by direct Todo field filtering. Do not separately reveal whether the category exists or belongs to another user; unmatched filters return an empty list.
- Support optional exact `planned_date` and inclusive `due_from`/`due_to`. A due filter excludes null `due_at` rows. Reject `due_from > due_to`.
- Timestamp query values must be valid ISO 8601 timestamps with timezone, consistent with the API time contract.
- Support integer `limit`, default 50, minimum 1, maximum 100.
- Apply fixed ordering: `planned_date ASC NULLS LAST`, `due_at ASC NULLS LAST`, priority rank high=1/medium=2/low=3, `updated_at DESC`, then `id ASC`.
- Express null ordering and keyset comparisons explicitly so SQLite tests and PostgreSQL behavior agree.
- Use limit-plus-one fetching. Return at most `limit` items and derive `next_cursor` from the last returned item only when another row exists.
- Encode a deterministic base64url JSON v1 cursor without required padding. It must contain the final ordering anchor and normalized filter identity for status, category, planned date, due bounds, and fixed sort version.
- `limit` is not part of filter identity and may change between pages. Any other filter mismatch returns `400 validation_error`.
- Reject malformed base64/JSON, unsupported version, missing/extra or invalid anchor fields, invalid UUID/date/timestamp/priority rank, and filter mismatch with `400 validation_error`.
- Cursor values for nullable ordering fields must represent null explicitly and resume strictly after the anchor.
- Serialize every item through the existing stable Todo DTO. Batch-load categories referenced by the page rather than issuing one category query per Todo.
- Active categories use `is_deleted=false`; soft-deleted categories use `is_deleted=true`; absent relations return `category=null`.
- The endpoint is read-only: no Idempotency-Key requirement, state mutation, sync change, or idempotency record.
- Registering the list route must not add or shadow `/todos/today`; future static routes still need registration before dynamic `/{todo_id}` routes.

## Acceptance Criteria

- [ ] Default list returns only current-user active pending Todos with the stable DTO and `next_cursor` present.
- [ ] Status pending/completed/all semantics include the correct rows; deleted and cross-user Todos never appear.
- [ ] Category, planned-date, and inclusive due-range filters work alone and in combination without leaking category ownership/existence.
- [ ] Invalid status, UUID, date/timestamp, naive timestamp, due range, limit, and cursor return `400 validation_error`.
- [ ] Ordering exactly follows contracted null placement, priority rank, descending update time, and UUID tie-breaker.
- [ ] Multi-page traversal on an unchanged dataset has no duplicate or skipped rows, including equal and null sort values.
- [ ] `next_cursor` is null on the final page and is generated from the last returned row when more data exists.
- [ ] Cursor filter mismatch fails, while changing only limit remains valid.
- [ ] Cursor malformed/version/schema/type cases are covered and cursor output is deterministic base64url JSON v1.
- [ ] Category summaries correctly cover active, soft-deleted, and missing categories without N+1 lookups.
- [ ] The endpoint creates no Todo, sync change, or idempotency record and exposes no internal fields.
- [ ] Focused and full backend tests pass; no migration or out-of-scope endpoint is added.

## Verification Plan

- Add focused Todo list tests for auth/isolation, every filter, validation, exact ordering, cursor schema, multi-page boundaries, category summaries, and no-write behavior.
- Run full `python -m pytest` from `backend/`.
- Inspect generated/query logic for explicit null ordering and PostgreSQL-compatible SQLAlchemy expressions.
- Inspect route scope and query count for category batch loading.
- Run `git diff --check`, inspect exact modified and untracked files, and confirm no model/migration/product-contract changes.

## Risks

- Mixed ASC/DESC and nullable keyset comparisons can create duplicates or skips.
- Cursor/filter mismatch can silently return incorrect pages if identity is incomplete.
- SQLite and PostgreSQL may differ when null ordering is implicit.
- Per-item category lookup can create an N+1 query path.
- Dynamic route ordering can shadow a future `/todos/today` route.

## Coding Output Requirements

Report modified files, filter/ordering/cursor design, cursor schema, category loading behavior, acceptance results, focused/full test results, SQL/route/query verification, diff checks, unresolved issues, and task-outside findings.

## Current Stage

Next role: Git Commit

Required next action: publish the Code Review-approved TASK-014 result. Git Commit must verify the reviewed file set against `handoff/code-review-gate.md` before committing.
