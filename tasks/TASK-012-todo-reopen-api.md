# TASK-012 Todo Reopen API

## Metadata

- Task ID: TASK-012
- Task Name: Todo reopen API
- Status: READY
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: Todo update `09cd984`; Todo complete `2c35f1d`; TASK-011 terminal closure `c2a2fac`

## Decision

Implement only `POST /api/v1/todos/{id}/reopen` as the next closeable lifecycle slice. Reopen an owned completed Todo with server timestamp, version increment, idempotency, and atomic `todo.reopened` sync write-through. Delete remains a separate task.

## In Scope

- `completed -> pending` action and clearing `completed_at`.
- Todo ownership, deletion, and invalid-state behavior.
- Server update timestamp and version increment.
- Idempotent atomic mutation, sync snapshot, and response.
- Existing category DTO behavior during response serialization.
- Focused tests and full backend regression verification.

## Out Of Scope

- Delete, list, Today, sync pull, or SSE.
- Ordinary-field or complete behavior changes.
- Canceled reopen, Reminder behavior, or recurring Todo.
- Model, schema, or migration changes unless Task Review approves an unavoidable prerequisite.
- Frontend, Android, offline replay, or PostgreSQL service work.

## Contract

- No body; bearer auth and `Idempotency-Key` required.
- Missing/cross-user Todo returns `404`; current-user deleted Todo returns `410`.
- Only completed can reopen; pending/canceled returns `400 invalid_state_transition` without side effects.
- Success sets pending, clears `completed_at`, updates server timestamp, increments version once, and returns DTO plus sync cursor.
- `todo.reopened` carries updated entity version and response-equivalent snapshot.
- Same-key replay has no duplicate effect; a new key after reopening is an invalid transition.
- Missing or deleted category history does not block reopening.

## Allowed Files

- `backend/app/api/v1/todos.py`
- Focused Todo reopen tests under `backend/tests/`
- Directly required small Todo lifecycle helpers
- `docs/phase1a-progress.md`
- Active TASK-012 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- Models, schemas, or migrations unless Task Review explicitly approves them
- Product contract documents
- Delete/list/Today/sync/SSE or Reminder behavior
- Category API behavior
- Frontend and Android files
- Completed TASK-005 through TASK-011 archives

## Acceptance Criteria

- [ ] Completed Todo reopens with pending status, null completion time, updated version/time, DTO, and sync cursor.
- [ ] Ordinary fields and cancellation data remain unchanged.
- [ ] Sync version and snapshot match persisted state and response.
- [ ] Ownership/deletion errors follow `404`/`410` rules.
- [ ] Pending/canceled invalid transitions have no side effects.
- [ ] Missing, replayed, conflicting, and new-after-reopen idempotency cases have no duplicate effects.
- [ ] Auth, UUID, category history, DTO exclusion, and rollback behavior are covered.
- [ ] Focused and full tests pass; no migration or out-of-scope endpoint is added.

## Verification Plan

- Focused Todo reopen tests for all acceptance paths.
- Full `python -m pytest` from `backend/`.
- Route and endpoint-scope inspection.
- `git diff --check` and exact changed-file review.

## Risks

- Replay versus second-attempt confusion.
- Status/timestamp/version/snapshot inconsistency.
- Cross-user existence leakage.
- Incorrect category-history blocking.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-17 09:23 +08:00
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
