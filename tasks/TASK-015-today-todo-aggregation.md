# TASK-015 Today Todo Aggregation API

## Metadata

- Task ID: TASK-015
- Task Name: Today Todo aggregation API
- Status: READY
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: Todo APIs through `dd0d6fa`; TASK-014 terminal closure `0a5760a`

## Decision

Implement only `GET /api/v1/todos/today` as the next Phase 1A vertical slice. The endpoint owns timezone conversion, classification, de-duplication, ordering, and summary semantics so PC and Android clients consume one stable homepage aggregation.

## In Scope

- Required selected-date query in the authenticated user's timezone.
- Four mutually exclusive sections: overdue, due, planned, and inbox recent.
- Stable Todo DTOs, deterministic ordering, summary counts, category batching, isolation, and tests.

## Out Of Scope

- Reminder-derived content, pagination, writes, sync pull, SSE, and fanout.
- Frontend, Android, widgets, recurrence generation, and offline replay.
- Models/migrations unless Task Review proves an unavoidable prerequisite.

## Contract

- Route: `GET /api/v1/todos/today?date=YYYY-MM-DD`, registered before dynamic `/{todo_id}` GET routing.
- Build `[local midnight, next local midnight)` from `current_user.timezone`, including DST-safe calendar boundaries.
- Include only current-user, non-deleted, pending section items.
- Assign once in priority order: overdue, due, planned, inbox recent.
- Inbox recent uses the active owned Inbox, null planned/due fields, and the five newest eligible rows; the selected set is returned using standard section ordering.
- Standard order is priority high/medium/low, due null-last ASC, planned date null-last ASC, created ASC, id ASC.
- `pending_count` counts unique returned section items; `completed_count` counts non-deleted Todos completed inside the selected local day; `overdue_count` equals the overdue section length. Canceled rows do not count.
- Response always includes date, timezone, four section arrays, summary, and server time, with no pagination or Reminder section.
- Read has no idempotency, sync, event, or mutation side effects.

## Allowed Files

- `backend/app/api/v1/todos.py`
- `backend/app/schemas/todo.py` only when directly required
- One focused Today helper under `backend/app/services/`
- Focused Today tests under `backend/tests/`
- `docs/phase1a-progress.md`
- Active TASK-015 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- Models/migrations unless Task Review explicitly approves them
- Product contract documents
- Existing Todo/category behavior or collection-list semantics
- Sync, SSE, fanout, Reminder, recurrence, frontend, or Android behavior
- Completed TASK-005 through TASK-014 archives

## Acceptance Criteria

- [ ] Envelope, authentication, required date validation, and static route precedence are correct.
- [ ] Timezone/DST boundaries correctly classify due and completed timestamps.
- [ ] Four sections follow membership rules, strict single assignment, and stable ordering without duplicate IDs.
- [ ] Inbox recent uses the active owned Inbox, selects the newest five eligible rows, and then applies presentation ordering.
- [ ] Summary counts match the locked semantics for pending/completed/overdue and exclude canceled/deleted/cross-user rows.
- [ ] Todo DTO/category serialization is stable and category loading is batched.
- [ ] No write side effect, Reminder section, pagination, migration, or out-of-scope endpoint is added.
- [ ] Focused/full tests, Alembic head, route/query review, and whitespace checks pass.

## Verification Plan

- Focused Today tests covering validation, timezone/DST edges, classification, de-duplication, ordering, Inbox cap, summaries, DTO/category behavior, isolation, and no writes.
- Full backend pytest suite and Alembic-head check.
- Route-order, query/batch behavior, exact changed-file, and whitespace inspection.

## Risks

- Timezone boundary drift, especially on DST dates.
- Duplicate assignment across overlapping sections.
- Incorrect Inbox top-five selection versus presentation order.
- Static `/today` route shadowing and category N+1 queries.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-20 08:40 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: PENDING
- Branch: pending
- Base Commit: `0a5760adaee3907532e8ec028938d3658c494997`
- Snapshot Commit: pending

## Coding Result

Pending.

## Code Review

- Result: PENDING
- Target Status: REVIEWING
- Reviewed by: pending
- Reviewed at: pending

## Git Commit

- Result: PENDING
- Result Commit: pending
- Push Result: pending

## Closure

Closure Check: PENDING
