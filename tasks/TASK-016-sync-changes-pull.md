# TASK-016 Sync Changes Pull API

## Metadata

- Task ID: TASK-016
- Task Name: Sync changes pull API
- Status: READY
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: durable sync writes and cursor allocator; TASK-015 terminal closure `f562773`

## Decision

Implement only `GET /api/v1/sync/changes` as the next Phase 1A slice. Durable pull recovery must be complete before the SSE wake-up endpoint can provide useful reconnect behavior.

## In Scope

- Authenticated current-user sync pull with cursor and limit.
- Captured global high-water boundary, user-specific paging, and gap-safe cursor advancement.
- Stored snapshot/tombstone payload serialization and focused tests.

## Out Of Scope

- SSE, fanout, new write-side events, payload rewrites, client cache application, offline replay, conflicts, and retention.
- Models/migrations unless Task Review proves an unavoidable prerequisite.
- Frontend, Android, Reminder, recurrence, and unrelated APIs.

## Contract

- Route: `GET /api/v1/sync/changes?cursor=0&limit=100`.
- Cursor defaults to 0 and must be non-negative; limit defaults to 100 and supports 1 through 500.
- Capture the global max cursor at request start; reject a cursor beyond it.
- Query current-user rows in `(requested_cursor, captured_high_water]`, ordered by cursor ASC, with limit-plus-one.
- If more current-user rows exist, `next_cursor` is the last returned cursor and `has_more=true`; otherwise `next_cursor` is the captured global high water and `has_more=false`.
- Empty/current-user-empty responses still advance to the global high water; other-user cursor gaps are valid.
- Emit metadata plus stored top-level `snapshot` or tombstone fields; never expose `user_id`, internal row ID, or raw payload.
- The endpoint is read-only and returns top-level items, next cursor, has-more flag, and server time.

## Allowed Files

- `backend/app/api/v1/router.py`
- One focused sync API module under `backend/app/api/v1/`
- `backend/app/services/sync.py` only when directly required
- One focused sync schema only when directly required
- Focused sync pull tests under `backend/tests/`
- `docs/phase1a-progress.md`
- Active TASK-016 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- Models, cursor sequence, and migrations unless Task Review explicitly approves them
- Existing persisted payloads or Todo/category writes
- SSE/fanout, product contract documents, frontend, and Android
- Completed TASK-005 through TASK-015 archives

## Acceptance Criteria

- [ ] Contracted envelope, defaults, validation, and authentication are correct.
- [ ] Current-user isolation, ascending order, and valid global cursor gaps are proven.
- [ ] Empty, intermediate, and terminal pages use the locked high-water/next-cursor semantics.
- [ ] Multi-page traversal has no duplicate or skipped current-user changes.
- [ ] Snapshot and tombstone payloads are exact and internal fields are excluded.
- [ ] Changes after captured high water remain available later.
- [ ] Endpoint causes no writes or cursor allocation.
- [ ] Focused/full tests, Alembic head, route/query review, and whitespace checks pass without migration or SSE changes.

## Verification Plan

- Focused sync pull tests for validation, auth, isolation/gaps, paging/high water, payload variants, nullable metadata, races, and no writes.
- Full backend pytest suite and Alembic-head check.
- Route, SQLAlchemy query, exact changed-file, and whitespace inspection.

## Risks

- Gap handling and moving-high-water races.
- Off-by-one pagination errors.
- Historical payload reconstruction or internal-field leakage.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-21 09:53 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: PENDING
- Branch: pending
- Base Commit: `f562773316251f43d5eb9ba704f361eb6f25dc24`
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
