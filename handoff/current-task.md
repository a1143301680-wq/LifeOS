# LifeOS Current Task

Last updated: 2026-07-21

## Metadata

- Task ID: TASK-017
- Task Name: SSE sync wake-up and in-memory fanout
- Status: READY
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies:
  - Durable sync writes and `GET /api/v1/sync/changes` published through `f6f9091`
  - TASK-016 terminal closure published in `818bade`

## Background

Durable pull recovery is complete, but connected PC and Android clients are not yet notified that new changes are available. Phase 1A requires a lightweight SSE wake-up channel backed by process-local fanout; clients always pull durable snapshots or tombstones after receiving a signal.

## Goal

An authenticated client can maintain an SSE subscription scoped to its identity and receive a lightweight `sync.available` event after a successful Todo or category write commits, without receiving entity data or affecting durable recovery correctness.

## Scope

### In Scope

- `GET /api/v1/sync/events` with bearer authentication and optional `device_id`.
- Process-local, per-user SSE subscription registry and non-blocking wake-up fanout.
- Publication after each existing Todo/category REST write commits successfully.
- Exact event payload, SSE framing/headers, subscriber cleanup, isolation, slow-consumer coalescing, and focused tests.

### Out of Scope

- Redis, PostgreSQL LISTEN/NOTIFY, message queues, cross-process or cross-instance fanout, replayable SSE history, or guaranteed event delivery.
- Entity snapshots/tombstones in SSE, durable cursor replacement, or changes to `GET /api/v1/sync/changes`.
- New write endpoints, changes to existing write/idempotency/sync payload semantics, or background retry queues.
- Frontend, Android, reconnect UI, Reminder, recurrence, and offline operation replay.
- Models, dependencies, settings, or Alembic migrations unless Task Review proves one unavoidable prerequisite.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 2, 3.1, 12-14
- `docs/architecture.md` synchronization model
- `docs/data-model-phase1.md` sections 4.7 and 7
- `docs/mvp.md` Phase 1A backend scope and acceptance
- `docs/phase1a-progress.md`
- `backend/app/api/v1/sync.py`, router, auth, time, envelope, and error patterns
- Existing Todo/category write endpoints and their transaction/idempotency tests

### Allowed Modify Files

- `backend/app/api/v1/sync.py`
- A focused process-local SSE broker/helper under `backend/app/services/`
- `backend/app/api/v1/todos.py` only for post-commit wake-up publication
- `backend/app/api/v1/todo_categories.py` only for post-commit wake-up publication
- `backend/app/main.py` only if lifecycle cleanup is directly required
- New or existing focused SSE/fanout tests under `backend/tests/`
- `docs/phase1a-progress.md`
- Active handoff, gate, Git record, issue-log, and TASK-017 state files

### Forbidden Modify Files

- Models, migrations, persistent sync payloads, cursor allocation, or pull API semantics
- Existing write validation, mutation, idempotency replay/conflict, transaction, or response behavior beyond post-commit wake-up publication
- External broker/dependency or multi-worker delivery infrastructure
- Product requirements, architecture, API contract, or data-model documents unless Task Review returns a genuine contract ambiguity to Decision
- Frontend, Android, Reminder, recurrence, offline replay, and completed TASK-005 through TASK-016 archives

## Implementation Requirements

- Add authenticated `GET /api/v1/sync/events` to the existing `/sync` router and return `text/event-stream` with no-cache and anti-buffering headers appropriate for SSE.
- Accept optional `device_id` as connection metadata with a bounded length consistent with current device identifiers. It must not select identity, be persisted, or appear in events.
- Implement a process-local broker keyed only by authenticated user ID. Each active subscription has an independent bounded queue and is removed reliably when its stream is cancelled or disconnected.
- Emit data events using valid SSE framing and compact JSON containing exactly `type="sync.available"`, integer `latest_cursor`, and `server_time`. Entity snapshots, tombstones, entity IDs, user IDs, and device IDs are forbidden.
- Keepalive comments may be emitted during idle periods but must contain no domain payload and must not be treated as `sync.available` events.
- Publish only after a Todo/category write transaction commits successfully, using the cursor of that write's committed `sync_changes` row. Cover category create/update/delete and Todo create/update/complete/reopen/delete.
- Idempotency replay, validation failure, rollback, and read endpoints must not publish a new wake-up event. Fanout must not change existing HTTP response bodies or sync cursors.
- Publishing must be non-blocking for write requests. A slow subscriber may coalesce pending notifications, but its next domain event must carry the greatest published cursor it has not yet consumed.
- One user's publication must reach all active subscriptions for that user and none for another user. Disconnecting one subscriber must not affect others.
- A missed or coalesced SSE event is acceptable because clients recover through `GET /api/v1/sync/changes`; SSE is never the durable source of truth.
- Keep the Phase 1A runtime explicitly process-local. Do not claim cross-worker delivery; focused tests must not require external network services.

## Acceptance Criteria

- [ ] Missing/invalid authentication is rejected before streaming; valid auth returns an SSE response with correct content type and buffering/cache headers.
- [ ] Optional valid `device_id` is accepted without affecting identity or event payload; invalid length uses existing validation behavior.
- [ ] Each successful category and Todo mutation publishes exactly one post-commit wake-up containing its committed sync cursor.
- [ ] Validation failure, transaction rollback, idempotency replay, and GET endpoints publish no new event.
- [ ] Events contain only `type`, `latest_cursor`, and `server_time`, use valid SSE framing, and never contain snapshots/tombstones/entity or identity data.
- [ ] Same-user multiple subscribers receive wake-ups; cross-user subscribers do not.
- [ ] Slow-consumer coalescing preserves the greatest pending cursor without blocking the write path.
- [ ] Cancellation/disconnect removes the subscription and repeated connect/disconnect cycles leave no registry leak.
- [ ] Clients can use the event cursor with the existing pull endpoint; lost/coalesced notifications do not alter durable sync rows.
- [ ] Focused and full backend tests pass; Alembic remains at one head; no model, migration, external dependency, or out-of-scope endpoint is added.

## Verification Plan

- Add focused async tests for auth/headers/device ID, framing/payload, all write families, commit-before-publish, replay/failure silence, per-user fanout, multiple subscribers, slow-consumer coalescing, disconnect cleanup, and no durable side effects.
- Run focused SSE tests and full `python -m pytest` from `backend/`.
- Run `python -m alembic heads` and inspect route/dependency scope.
- Inspect every current `create_sync_change` write site to prove publication occurs only after successful commit and uses the matching cursor.
- Run `git diff --check`, independently whitespace-check new untracked files, inspect the exact changed-file set, and confirm no model/migration/pull-contract/product-doc change.

## Risks

- Publishing before commit can wake clients for data that later rolls back.
- Unbounded or blocking queues can make slow clients stall writes or consume memory.
- Subscriber cleanup mistakes can leak queues across disconnects or tests.
- Global rather than per-user fanout can leak activity across identities.
- Infinite streaming tests can hang unless cancellation and deterministic broker seams are designed carefully.

## Coding Output Requirements

Report modified files, SSE framing/headers, broker lifecycle and coalescing, every post-commit publication site, isolation and replay/failure behavior, acceptance results, focused/full test results, Alembic/route/dependency/diff checks, process-local limitation, unresolved issues, and task-outside findings.

## Current Stage

Next role: Git Snapshot

Required next action: establish the pre-Coding Git Snapshot for TASK-017 from the approved publication-state files. Coding must not start before Git Snapshot completion.
