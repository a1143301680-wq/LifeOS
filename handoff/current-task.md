# LifeOS Current Task

Last updated: 2026-07-21

## Metadata

- Task ID: TASK-016
- Task Name: Sync changes pull API
- Status: READY
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies:
  - Durable `sync_changes` model, global cursor allocator, and existing Todo/category write payloads
  - TASK-015 terminal closure published in `f562773`

## Background

Phase 1A Todo and category writes already append user-owned durable sync changes, but clients cannot yet pull them after reconnecting or missing live notifications. The next slice exposes the contracted cursor-based recovery endpoint before SSE wake-up delivery is added.

## Goal

An authenticated client can pull only its user's durable changes in global cursor order, advance safely across other-user cursor gaps, apply snapshots or tombstones, and continue paging without duplicate or skipped current-user changes.

## Scope

### In Scope

- `GET /api/v1/sync/changes` only.
- Global bigint cursor and validated limit query parameters.
- Current-user filtering, deterministic cursor ordering, limit-plus-one paging, and global high-water advancement.
- Snapshot/tombstone serialization using existing `sync_changes.payload` records.
- Authentication, two-user isolation, boundary validation, empty/gapped streams, and focused tests.

### Out of Scope

- `GET /api/v1/sync/events`, SSE connections, fanout, pub/sub, or wake-up delivery.
- New write-side sync events or changes to existing Todo/category write payloads.
- Client-side cache application, offline operation replay, conflict resolution, cursor retention/compaction, or event sourcing.
- Todo/category API behavior, frontend, Android, Reminder, or recurrence work.
- Sync model, sequence, or Alembic migration changes unless Task Review proves one unavoidable.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 2, 3.1, 7, 12, and 14
- `docs/architecture.md` synchronization model and recovery rules
- `docs/data-model-phase1.md` section 4.7 and sync endpoint notes
- `docs/phase1a-progress.md`
- `backend/app/models/sync.py`
- `backend/app/services/sync.py`
- Existing API router, auth, error, envelope, Todo/category sync payload, and test patterns

### Allowed Modify Files

- `backend/app/api/v1/router.py`
- A focused sync API module under `backend/app/api/v1/`
- `backend/app/services/sync.py` only for directly reusable pull/high-water helpers
- A focused sync response schema under `backend/app/schemas/` only if directly needed
- New or existing focused sync pull tests under `backend/tests/`
- `docs/phase1a-progress.md`
- Active handoff, gate, Git record, issue-log, and TASK-016 state files

### Forbidden Modify Files

- Sync/Todo/category/user models, cursor sequence, or Alembic migrations unless Task Review explicitly approves an unavoidable prerequisite
- Existing Todo/category write behavior or persisted sync payload shape
- SSE, event fanout, client cache, conflict resolution, frontend, or Android behavior
- Product requirements, architecture, API contract, or data-model documents unless Task Review returns a genuine contract ambiguity to Decision
- Completed TASK-005 through TASK-015 archives

## Implementation Requirements

- Add authenticated `GET /api/v1/sync/changes` and include its router under `/api/v1` without changing existing route behavior.
- Support integer `cursor`, default 0 and minimum 0, and integer `limit`, default 100, minimum 1, maximum 500. Invalid values use the existing validation-error envelope.
- At request start, read the current global maximum sync cursor as a page high-water mark; use 0 when the table is empty. Reject a requested cursor greater than that high-water mark with `400 validation_error`.
- Query only rows owned by `current_user`, with `cursor > requested_cursor` and `cursor <= captured_high_water`, ordered by `cursor ASC`. Global gaps caused by other users are valid.
- Fetch `limit + 1` current-user rows. Return at most `limit` items and set `has_more=true` only when the extra current-user row exists within the captured high-water range.
- When `has_more=true`, set `next_cursor` to the last returned item's cursor. When `has_more=false`, set `next_cursor` to the captured global high-water mark, including when no current-user rows exist, so clients safely advance across other-user gaps.
- Serialize each item with `cursor`, `change_type`, `entity_type`, `entity_id`, and `entity_version`, then expose the existing payload fields at item top level: create/update/complete/reopen records include `snapshot`; delete records include `deleted` and `deleted_at`. Do not expose `user_id`, internal row `id`, raw `payload`, or unrelated database fields.
- Return the contracted top-level list envelope with `items`, integer `next_cursor`, boolean `has_more`, and `server_time`.
- Preserve payload snapshots/tombstones exactly as stored; this read endpoint must not refetch live entities to rebuild historical changes.
- Keep the endpoint read-only: no Idempotency-Key requirement, cursor allocation, row mutation, sync change, idempotency record, or event emission.

## Acceptance Criteria

- [ ] Default authenticated request returns the contracted top-level envelope and changes after cursor 0 in ascending cursor order.
- [ ] Only current-user changes are returned; another user's rows create valid gaps and never leak payload or metadata.
- [ ] Empty database and no-current-user-result cases return empty items, `has_more=false`, and the captured global high-water cursor.
- [ ] Limit-plus-one paging returns every current-user change exactly once across pages; intermediate pages use the last returned cursor and terminal pages advance to the global high water.
- [ ] Default, minimum, maximum, and changed-per-page limits work; negative cursor, zero/oversized limit, malformed values, and future cursor return `400 validation_error`.
- [ ] Snapshot and Todo/category tombstone payloads are emitted at item top level exactly as stored, with nullable entity metadata handled and internal fields excluded.
- [ ] Rows created after the request's captured high water are not mixed into that page and remain discoverable on a later request.
- [ ] Authentication failures use existing behavior and the endpoint performs no writes or cursor allocation.
- [ ] Focused and full backend tests pass; Alembic remains at one head; no migration, SSE route, or out-of-scope behavior is added.

## Verification Plan

- Add focused tests for auth, defaults, validation, empty streams, two-user gaps, exact ordering, multi-page traversal, high-water advancement, future cursor, concurrent-after-high-water visibility, snapshots/tombstones, nullable metadata, field exclusion, and no-write behavior.
- Run focused sync pull tests and full `python -m pytest` from `backend/`.
- Run `python -m alembic heads` and inspect API route scope.
- Inspect SQL/query behavior for current-user filtering, captured high-water bound, ascending order, and limit-plus-one semantics on SQLite/PostgreSQL-compatible SQLAlchemy.
- Run `git diff --check`, independently whitespace-check new untracked files, inspect the exact changed-file set, and confirm no model/migration/SSE/product-contract change.

## Risks

- Using only the last current-user row as the terminal cursor can cause clients to repeatedly scan other-user gaps.
- Advancing to a moving global maximum without a captured high water can make page behavior race-dependent.
- Incorrect `has_more` logic can skip or duplicate changes across pages.
- Rebuilding snapshots from live entities would corrupt historical recovery semantics.
- Flattening raw payloads without an explicit response boundary can leak internal fields.

## Coding Output Requirements

Report modified files, high-water capture and cursor advancement, query/paging logic, snapshot/tombstone serialization, validation and isolation behavior, acceptance results, focused/full test results, Alembic/route/query/diff checks, unresolved issues, and task-outside findings.

## Current Stage

Next role: Git Snapshot

Required next action: establish the pre-Coding Git Snapshot for TASK-016 from the approved publication-state files. Coding must not start before Git Snapshot completion.
