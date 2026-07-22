# TASK-017 SSE Sync Wake-Up And In-Memory Fanout

## Metadata

- Task ID: TASK-017
- Task Name: SSE sync wake-up and in-memory fanout
- Status: READY
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: durable sync pull published in `f6f9091`; TASK-016 terminal closure `818bade`

## Decision

Implement `GET /api/v1/sync/events`, process-local per-user fanout, and post-commit publication together. The endpoint alone is not an operational or testable vertical slice without successful writes producing wake-ups.

## In Scope

- Authenticated SSE subscription with optional device ID.
- Per-user in-memory broker, bounded subscriber queues, latest-cursor coalescing, and cleanup.
- Post-commit wake-up publication from every existing Todo/category mutation.
- Event contract, isolation, failure/replay silence, and focused tests.

## Out Of Scope

- External brokers, cross-process delivery, durable SSE replay, guaranteed events, and entity data in SSE.
- Pull API or persisted sync payload changes, new writes, frontend/Android, Reminder, recurrence, and offline replay.
- Models, dependencies, settings, and migrations unless Task Review proves an unavoidable prerequisite.

## Contract

- Route: `GET /api/v1/sync/events`, bearer authenticated, optional bounded `device_id`.
- Response is `text/event-stream` with appropriate no-cache/anti-buffering headers.
- Domain event JSON contains only `type=sync.available`, committed `latest_cursor`, and `server_time`.
- Broker is process-local and user-scoped; all same-user subscribers receive wake-ups, other users receive none.
- Publish after commit for category create/update/delete and Todo create/update/complete/reopen/delete.
- Replay, validation failure, rollback, and reads publish nothing.
- Bounded queues may coalesce to the greatest pending cursor and must not block writes.
- Keepalives contain no domain data; disconnects clean registry state; durable recovery remains `/sync/changes`.

## Allowed Files

- `backend/app/api/v1/sync.py`
- One focused SSE broker/helper under `backend/app/services/`
- `backend/app/api/v1/todos.py` and `todo_categories.py` only for post-commit publication
- `backend/app/main.py` only for directly required lifecycle cleanup
- Focused SSE/fanout tests under `backend/tests/`
- `docs/phase1a-progress.md`
- Active TASK-017 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- Models, migrations, cursor allocation, persisted payloads, and pull semantics
- Existing write behavior beyond post-commit wake-up publication
- External broker/dependency and multi-worker infrastructure
- Product contract docs, frontend, Android, and completed task archives

## Acceptance Criteria

- [ ] Auth, headers, optional device ID, framing, and exact payload are correct.
- [ ] Every current category/Todo mutation publishes exactly once after commit.
- [ ] Replay, validation failure, rollback, and reads do not publish.
- [ ] Multiple same-user subscribers receive events with no cross-user leakage.
- [ ] Slow consumers coalesce to the greatest cursor without blocking writes.
- [ ] Disconnect/cancellation cleanup prevents registry leaks.
- [ ] No entity/identity data, durable-side-effect change, model/migration, or external dependency is introduced.
- [ ] Focused/full tests, Alembic head, route/write-site review, and whitespace checks pass.

## Verification Plan

- Focused async SSE/broker/write integration tests covering all acceptance paths.
- Full backend pytest suite and Alembic-head check.
- Route, all sync-write sites, exact changed-file, dependency, and whitespace inspection.

## Risks

- Pre-commit publication, blocked writes, leaked subscribers, cross-user fanout, and hanging stream tests.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-21 11:26 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: PENDING
- Branch: pending
- Base Commit: `818badeffa575a7358560030046ecac34ae3314f`
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
