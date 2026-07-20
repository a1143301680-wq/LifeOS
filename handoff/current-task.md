# LifeOS Current Task

Last updated: 2026-07-20

## Metadata

- Task ID: TASK-015
- Task Name: Today Todo aggregation API
- Status: COMPLETED
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies:
  - Todo CRUD, lifecycle, and collection list APIs published through `dd0d6fa`
  - TASK-014 terminal closure published in `0a5760a`

## Background

The Phase 1A Todo persistence and read/write APIs are complete. PC and Android now need the contracted Today homepage aggregation so a selected local calendar date can be rendered without duplicating classification logic on each client.

## Goal

An authenticated user can request one date in their configured timezone and receive owned, non-deleted Todos in four deterministic, mutually exclusive sections with a concise summary and no write side effects.

## Scope

### In Scope

- `GET /api/v1/todos/today?date=YYYY-MM-DD` only.
- User-timezone date boundaries for due and completion timestamps.
- `overdue`, `due`, `planned`, and `inbox_recent` sections.
- Single-assignment priority and deterministic section ordering.
- Today summary counts, stable Todo DTOs, category batch loading, isolation, validation, and focused tests.

### Out of Scope

- Reminder sections or Reminder-derived items.
- Pagination, cursors, configurable limits, search, or alternate grouping/sorting.
- Todo/category writes, sync pull, SSE, or fanout.
- Frontend, Android, widgets, recurring Todo generation, or offline replay.
- Todo/user/category model or Alembic migration changes unless Task Review proves one unavoidable.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 2, 5-7, 9.4, 10, and 11
- `docs/data-model-phase1.md` Todo/category/user fields and ownership rules
- `docs/phase1a-progress.md`
- `backend/app/api/v1/todos.py`
- `backend/app/services/todo_list.py`
- Existing Todo DTO, authentication, error, envelope, timezone, model, and test patterns

### Allowed Modify Files

- `backend/app/api/v1/todos.py`
- `backend/app/schemas/todo.py` only if directly required for the Today response
- A focused Today aggregation helper under `backend/app/services/`
- New or existing focused Today Todo tests under `backend/tests/`
- `docs/phase1a-progress.md`
- Active handoff, gate, Git record, issue-log, and TASK-015 state files

### Forbidden Modify Files

- Models or Alembic migrations unless Task Review explicitly approves an unavoidable prerequisite
- Existing Todo/category write, detail, lifecycle, or collection-list behavior
- Sync pull, SSE, fanout, Reminder, recurrence, frontend, or Android behavior
- Product requirements, architecture, API contract, or data-model documents unless Task Review returns a genuine contract ambiguity to Decision
- Completed TASK-005 through TASK-014 archives

## Implementation Requirements

- Add authenticated `GET /api/v1/todos/today` with required `date=YYYY-MM-DD`; malformed or missing dates use the existing validation-error envelope.
- Register `/today` before dynamic `GET /{todo_id}` so the static route cannot be captured as a UUID.
- Use `current_user.timezone`, not server-local time, to construct the selected local day as `[local midnight, next local midnight)`, then compare timestamp columns against timezone-aware boundaries. Build the next local midnight from the next calendar date so DST days remain correct.
- Always filter Todo rows by current user and `deleted_at IS NULL`.
- Section candidates are pending Todos only. Assign each Todo once in this strict order: `overdue`, `due`, `planned`, then `inbox_recent`.
- `overdue`: `due_at` before selected-day start. `due`: `due_at` inside the selected local day. `planned`: `planned_date` equals the selected date after excluding earlier assignments.
- `inbox_recent`: remaining pending Todos in the current user's active Inbox category with both `planned_date` and `due_at` null. Select at most the five newest by `created_at DESC`, then apply the standard section order to the selected set.
- Apply the API contract's standard section ordering: priority high, medium, low; `due_at ASC` null last; `planned_date ASC` null last; `created_at ASC`; final `id ASC` tie-breaker.
- Return the existing stable Todo DTO for each item. Batch-load referenced categories; preserve the existing active, soft-deleted, and missing category summary behavior without per-item queries.
- Return `data.date`, `data.timezone`, all four always-present arrays, `summary`, and `server_time`; do not return pagination fields or a Reminder section.
- Lock summary semantics for this slice: `pending_count` is the number of unique Todos returned across the four sections; `completed_count` is the number of current-user, non-deleted Todos whose `completed_at` falls inside the selected local day; `overdue_count` is the number of Todos in `overdue`. Canceled Todos are excluded from all three counts.
- Keep the endpoint read-only: no Idempotency-Key requirement, mutation, sync change, idempotency record, or event fanout.

## Acceptance Criteria

- [x] Valid authentication and date return the aggregation envelope with the requested date, user timezone, four arrays, summary, and server time.
- [x] Missing/invalid authentication and malformed/missing date use existing error behavior; `/todos/today` reaches the static handler rather than UUID validation.
- [x] Local-day boundaries correctly classify due and completed timestamps before, at, inside, and at the end-exclusive boundary, including a non-UTC timezone and a DST transition date.
- [x] Overdue, due, planned, and inbox-recent membership follows the contracted rules and strict single-assignment priority with no duplicate Todo IDs.
- [x] Inbox recent uses only the owned active Inbox, requires null planning/due fields, selects no more than the five newest eligible Todos, and excludes other users/categories.
- [x] Every section has deterministic contracted ordering with an ID tie-breaker.
- [x] Pending, completed, overdue, canceled, deleted, and cross-user rows produce the locked summary counts.
- [x] Stable Todo DTO/category behavior is preserved and categories are batch-loaded without an N+1 query path.
- [x] The endpoint creates no Todo, sync change, idempotency record, or other write side effect.
- [x] Focused and full backend tests pass; Alembic remains at one head; no migration or out-of-scope endpoint is added.

## Verification Plan

- Add focused Today tests for auth/date validation, route ordering, timezone boundaries, all section rules, de-duplication, ordering, Inbox cap, summaries, DTO/category behavior, two-user isolation, and no writes.
- Run `python -m pytest tests/test_todos_today.py` and full `python -m pytest` from `backend/`.
- Run `python -m alembic heads` and inspect route registration order.
- Inspect query behavior for explicit timezone boundaries, deterministic ordering, and batch category loading.
- Run `git diff --check`, independently whitespace-check new untracked files, inspect the exact changed-file set, and confirm no model/migration/product-contract change.

## Risks

- Converting a local calendar date to absolute timestamp bounds can be wrong around UTC offsets or DST changes.
- Overlapping due/planned/Inbox conditions can duplicate rows unless assignment priority is explicit.
- Selecting the newest five Inbox candidates and then applying presentation ordering can be implemented in the wrong order.
- Dynamic UUID routing can shadow `/today` if route registration moves below `/{todo_id}`.
- Separate item/category lookups can introduce N+1 queries.

## Coding Output Requirements

Report modified files, date-boundary conversion, section classification/de-duplication, Inbox selection and presentation ordering, summary queries, category loading, route order, acceptance results, focused/full test results, Alembic/query/diff checks, unresolved issues, and task-outside findings.

## Current Stage

Next role: Git Commit (Terminal Closure Commit)

Closure Check: PASS

Checked at: 2026-07-20 09:19 +08:00

Result Commit: `2a698f37028e1f8ebb0c8ededcfb5305c4c9a085`

Completion Commit: `876ba753a3ce91cee9b6a9f9fd90ea9da556764c`

Remote Verification: local `main`, `origin/main`, and remote `refs/heads/main` all matched `876ba753a3ce91cee9b6a9f9fd90ea9da556764c` before Closure documentation edits.

Required next action: commit and push only the Decision-approved TASK-015 Closure documents with message `docs(task): close TASK-015`. After remote parity is verified, return to Decision; do not run another Closure Check.
