# TASK-011 Todo Complete API

## Metadata

- Task ID: TASK-011
- Task Name: Todo complete API
- Status: READY
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: Todo create `f2fe55e`; Todo update `09cd984`; TASK-010 terminal closure `a2237de`

## Decision

Implement only `POST /api/v1/todos/{id}/complete` as the next closeable lifecycle slice. Complete an owned pending Todo with server timestamps, version increment, idempotency, and atomic `todo.completed` sync write-through. Reopen and delete remain separate tasks.

## In Scope

- `pending -> completed` action.
- Todo ownership, deletion, and invalid-state behavior.
- Server completion/update timestamp and version increment.
- Idempotent atomic mutation, sync snapshot, and response.
- Existing category DTO behavior during response serialization.
- Focused tests and full backend regression verification.

## Out Of Scope

- Reopen, delete, list, Today, sync pull, or SSE.
- Ordinary-field updates or canceled-state creation.
- Reminder cancellation/model/API behavior.
- Model, schema, or migration changes unless Task Review approves an unavoidable prerequisite.
- Frontend, Android, recurring Todo, offline replay, or PostgreSQL service work.

## Contract

- Endpoint accepts no body and requires bearer auth plus `Idempotency-Key`.
- Missing/cross-user Todo returns `404`; current-user deleted Todo returns `410`.
- Only pending can complete; completed or canceled returns `400 invalid_state_transition` without side effects.
- Success uses one server timestamp for `completed_at` and `updated_at`, increments version once, and returns `200` with DTO and sync cursor.
- `todo.completed` carries updated entity version and response-equivalent snapshot.
- Same-key replay has no duplicate effects; a new key after completion is an invalid transition.
- Missing or deleted category history does not block completion.

## Allowed Files

- `backend/app/api/v1/todos.py`
- Focused Todo complete tests under `backend/tests/`
- Directly required small Todo lifecycle helpers
- `docs/phase1a-progress.md`
- Active TASK-011 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- Models, schemas, or migrations unless explicitly approved by Task Review
- Product contract documents
- Reopen/delete/list/Today/sync/SSE or Reminder behavior
- Category API behavior
- Frontend and Android files
- Completed TASK-005 through TASK-010 archives

## Acceptance Criteria

- [ ] Pending Todo completes with correct DTO, timestamps, version, and sync cursor.
- [ ] Ordinary fields remain unchanged and completion/update timestamps are consistent.
- [ ] Sync entity version and snapshot match persisted state and response.
- [ ] Todo ownership/deletion errors follow `404`/`410` rules.
- [ ] Completed/canceled invalid transitions have no side effects.
- [ ] Missing, replayed, conflicting, and new-after-completion idempotency cases are covered without duplicate effects.
- [ ] Auth, UUID, deleted/missing category serialization, DTO exclusion, and rollback behavior are covered.
- [ ] Focused and full tests pass; no migration or out-of-scope endpoint is added.

## Verification Plan

- Focused Todo complete tests for all acceptance paths.
- Full `python -m pytest` from `backend/`.
- Route and endpoint-scope inspection.
- `git diff --check` and exact changed-file review.

## Risks

- Replay versus second-attempt confusion.
- Timestamp/version/snapshot inconsistency.
- Cross-user existence leakage.
- Incorrect category-history blocking.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-17 08:59 +08:00
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
