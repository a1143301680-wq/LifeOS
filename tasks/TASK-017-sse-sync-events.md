# TASK-017 SSE Sync Wake-Up And In-Memory Fanout

## Metadata

- Task ID: TASK-017
- Task Name: SSE sync wake-up and in-memory fanout
- Status: REVIEWING
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

- [x] Auth, headers, optional device ID, framing, and exact payload are correct.
- [x] Every current category/Todo mutation publishes exactly once after commit.
- [x] Replay, validation failure, rollback, and reads do not publish.
- [x] Multiple same-user subscribers receive events with no cross-user leakage.
- [x] Slow consumers coalesce to the greatest cursor without blocking writes.
- [x] Disconnect/cancellation cleanup prevents registry leaks.
- [x] No entity/identity data, durable-side-effect change, model/migration, or external dependency is introduced.
- [x] Focused/full tests, Alembic head, route/write-site review, and whitespace checks pass.

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

- Status: COMPLETE
- Branch: main
- Base Commit: `818badeffa575a7358560030046ecac34ae3314f`
- Snapshot Commit: `ca2895c5b3faca6fdfe259fe2d497ac39a1a0420`
- Reason: approved TASK-017 readiness documents required a durable pre-Coding baseline

## Coding Result

Result: PASS

Modified Files:

- `backend/app/api/v1/sync.py`
- `backend/app/api/v1/todo_categories.py`
- `backend/app/api/v1/todos.py`
- `backend/app/services/sync_events.py`
- `backend/tests/test_sync_events_sse.py`
- `handoff/current-task.md`
- `tasks/TASK-017-sse-sync-events.md`

Implementation Summary:

- Added authenticated `GET /api/v1/sync/events` to the existing sync router.
- Returned `text/event-stream` responses with `Cache-Control: no-cache`, `Connection: keep-alive`, and `X-Accel-Buffering: no`.
- Accepted optional `device_id` with max length 128; it is not persisted, not used for identity, and not emitted.
- Added a process-local `SyncEventBroker` keyed by authenticated `user_id`.
- Added independent bounded subscription queues with non-blocking publish and max-cursor coalescing for slow consumers.
- Added SSE domain events formatted as `event: sync.available` with compact JSON containing exactly `type`, `latest_cursor`, and `server_time`; keepalives are comments only.
- Published `sync.available` after successful commit for category create/update/delete and Todo create/update/complete/reopen/delete, using the committed `sync_changes.cursor`.
- Kept idempotency replay, validation failure, rollback paths, and read endpoints silent.
- Preserved durable recovery in `GET /api/v1/sync/changes`; no model, migration, cursor allocation, pull semantics, dependency, external broker, or product-contract changes.

Acceptance Criteria Results:

- PASS: missing/invalid auth is rejected before streaming; valid route construction has SSE media type and no-cache/anti-buffering headers.
- PASS: optional valid `device_id` is accepted without affecting identity or payload; invalid length returns `400 validation_error`.
- PASS: all current category/Todo mutations publish exactly one post-commit wake-up with the matching cursor.
- PASS: idempotency replay, validation failure, and GET endpoints publish no new wake-up.
- PASS: domain events contain only `type`, `latest_cursor`, and `server_time`; framing is valid SSE and excludes entity, identity, snapshot, tombstone, and device data.
- PASS: multiple same-user subscriptions receive wake-ups; cross-user publication is isolated.
- PASS: slow-consumer coalescing preserves the greatest pending cursor without blocking write requests.
- PASS: stream cancellation/close removes the subscription; repeated broker cleanup is covered by fixture isolation.
- PASS: SSE remains process-local wake-up only and does not alter durable sync rows or pull recovery semantics.

Verification Commands and Results:

- `cd D:\LifeOS\backend; python -m pytest tests/test_sync_events_sse.py -q` -> PASS, 7 passed.
- `cd D:\LifeOS\backend; python -m pytest` -> PASS, 101 passed.
- `cd D:\LifeOS\backend; python -m alembic heads` -> PASS, one head: `20260713_0004 (head)`.
- `rg -n "events|StreamingResponse|text/event-stream|device_id|sync_event_broker|publish_sync_available|sync.available" D:\LifeOS\backend\app\api\v1\sync.py D:\LifeOS\backend\app\services\sync_events.py` -> PASS, route and broker scope inspected.
- `rg -n "publish_sync_available|db\.commit\(|create_sync_change|replay is not None|@router\.(post|patch|delete)" D:\LifeOS\backend\app\api\v1\todos.py D:\LifeOS\backend\app\api\v1\todo_categories.py` -> PASS, every approved write site publishes after `db.commit()` and replay paths return before publication.
- `Select-String -Path D:\LifeOS\backend\app\services\sync_events.py,D:\LifeOS\backend\tests\test_sync_events_sse.py -Pattern '[ \t]+$'` -> PASS, no trailing whitespace in new files.

Git Diff Check:

- `git diff --check` -> PASS with Git LF-to-CRLF working-copy warnings only.
- `git diff --cached` -> PASS, no staged changes.
- Changed files are limited to TASK-017 allowed backend files and active workflow state files.
- No model, migration, persistent payload, cursor allocation, pull API, external dependency, frontend, Android, generated artifact, secret, local database, or debug-code change.

Unresolved Issues:

- None.

Task-Outside Findings:

- None.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-07-22 09:47 +08:00
- Branch: main
- HEAD: `ca2895c5b3faca6fdfe259fe2d497ac39a1a0420`
- Snapshot Commit: `ca2895c5b3faca6fdfe259fe2d497ac39a1a0420`
- Reviewed Scope:
  - `backend/app/api/v1/sync.py`
  - `backend/app/api/v1/todo_categories.py`
  - `backend/app/api/v1/todos.py`
  - `backend/app/services/sync_events.py`
  - `backend/tests/test_sync_events_sse.py`
  - `handoff/current-task.md`
  - `handoff/git-snapshot.md`
  - `tasks/TASK-017-sse-sync-events.md`
- Verification:
  - `cd D:\LifeOS\backend; python -m pytest tests/test_sync_events_sse.py -q` -> PASS, 7 passed.
  - `cd D:\LifeOS\backend; python -m pytest` -> PASS, 101 passed.
  - `cd D:\LifeOS\backend; python -m alembic heads` -> PASS, one head: `20260713_0004 (head)`.
  - `git diff --check` -> PASS; LF-to-CRLF warnings only.
  - `git diff --cached --check` -> PASS.
  - Independent untracked-file trailing-whitespace check -> PASS.
- Blocking Issues: None.
- Non-blocking Suggestions:
  - Future production hardening should document process-local SSE limitations for multi-worker deployment before any multi-process runtime is introduced.
- Follow-up Tasks:
  - Run the planned Phase 1A completion audit after TASK-017 terminal closure.
- Recommended Commit Message: `feat(sync): add SSE wake-up fanout`

## Git Commit

- Result: PENDING
- Result Commit: pending
- Push Result: pending

## Closure

Closure Check: PENDING
