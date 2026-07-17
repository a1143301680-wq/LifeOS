# LifeOS Current Task

Last updated: 2026-07-17

## Metadata

- Task ID: TASK-012
- Task Name: Todo reopen API
- Status: REVIEWING
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies:
  - Todo update API published in `09cd984`
  - Todo complete API published in `2c35f1d`
  - TASK-011 terminal closure published in `c2a2fac`

## Background

Todo completion is available. The next Phase 1A lifecycle slice reopens an owned completed Todo while preserving explicit state boundaries, server mutation metadata, idempotency, and sync write-through.

## Goal

An authenticated user can reopen an owned active completed Todo exactly once and receive the pending stable Todo DTO with a sync cursor, while invalid states and cross-user resources remain protected.

## Scope

### In Scope

- `POST /api/v1/todos/{id}/reopen` only.
- `completed -> pending` lifecycle transition.
- Clearing `completed_at`, setting server `updated_at`, and incrementing version.
- Todo ownership and soft-delete checks.
- Existing idempotency service integration.
- Atomic Todo mutation, `todo.reopened` sync change, and idempotency response.
- Stable Todo DTO response and focused automated tests.

### Out of Scope

- Delete, list, Today, sync pull, or SSE endpoints.
- Ordinary-field update or complete behavior changes.
- Canceled-state reopen or cancel API.
- Reminder rescheduling, Reminder model/API, or recurring Todo work.
- Todo model, schema, or Alembic migration changes unless Task Review proves one unavoidable.
- Frontend, Android, offline replay, full login, or PostgreSQL service work.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 3, 5, 7.3, 9.4, and 10.6
- `docs/data-model-phase1.md` Todo, version, sync, and idempotency rules
- `docs/phase1a-progress.md`
- `backend/app/api/v1/todos.py`
- Existing Todo complete tests and idempotency/sync helpers needed to follow repository patterns

### Allowed Modify Files

- `backend/app/api/v1/todos.py`
- New or existing focused Todo reopen tests under `backend/tests/`
- Small reusable Todo lifecycle helpers only when directly required
- `docs/phase1a-progress.md`
- Active handoff, gate, Git record, issue-log, and TASK-012 state files

### Forbidden Modify Files

- Todo models, schemas, or Alembic migrations unless Task Review explicitly approves an unavoidable prerequisite
- Todo create/detail/update/complete behavior except narrowly necessary shared helper corrections covered by tests
- Delete, list, Today, sync pull, or SSE endpoints
- Todo Category API behavior or default-category seeding
- Reminder or recurring Todo implementation
- Frontend or Android files
- Product requirements, architecture, API contract, and data-model documents unless Task Review returns a contract ambiguity to Decision
- Completed TASK-005 through TASK-011 archives

## Implementation Requirements

- Add `POST /api/v1/todos/{id}/reopen` under the existing Todo router and require bearer authentication plus `Idempotency-Key`.
- The action accepts no request body and no client-controlled lifecycle fields.
- Query Todo by ID and current user ownership. Missing or cross-user Todo returns `404 not_found`; a current-user soft-deleted Todo returns `410 deleted_resource`.
- Permit only `status=completed`. An active Todo already `pending` or `canceled` returns `400 invalid_state_transition` without mutation, sync change, or stored successful action result.
- On success, use server time to set `status=pending` and `updated_at`, clear `completed_at`, and leave ordinary fields plus `canceled_at` unchanged.
- Increment `version` exactly once.
- Resolve the existing category only for response serialization; a soft-deleted or absent category must not block reopening.
- Create `todo.reopened` with `entity_type=todo`, the updated `entity_version`, and a payload snapshot equal to the response Todo DTO.
- Persist Todo changes, sync change, and idempotency response atomically. Any failure must roll back all three.
- Return `200` using the write envelope with reopened Todo DTO and `sync.cursor`.
- Identical Idempotency-Key replay returns the original response without another timestamp, version increment, or sync row.
- Reusing the same key for a conflicting fingerprint follows existing `idempotency_key_conflict` behavior.
- A new key submitted after the Todo is already pending is not a replay and must return `400 invalid_state_transition`.
- Never expose internal ownership, deletion, cancellation, recurring/client, or sync fields in the Todo DTO.

## Acceptance Criteria

- [ ] Reopening an owned completed Todo returns `200`, `status=pending`, null `completed_at`, incremented version, updated server timestamp, and `sync.cursor`.
- [ ] Ordinary fields and `canceled_at` remain unchanged.
- [ ] The `todo.reopened` sync row uses the updated entity version and a snapshot equal to the response DTO.
- [ ] Missing or cross-user Todo returns `404 not_found`; current-user soft-deleted Todo returns `410 deleted_resource`.
- [ ] Pending and canceled active Todos return `400 invalid_state_transition` with no side effects.
- [ ] Missing key, identical replay, conflicting reuse, and a new key after reopening follow defined behavior without duplicate effects.
- [ ] Missing/invalid authentication and invalid path UUID follow existing conventions.
- [ ] A soft-deleted or absent category does not block reopening and follows existing DTO serialization.
- [ ] Todo mutation, version/timestamp, sync snapshot, and idempotency response are atomic and consistent under failure.
- [ ] Internal fields remain absent from response and sync snapshot.
- [ ] Focused and full backend tests pass; no migration or out-of-scope endpoint is added.

## Verification Plan

- Add and run focused Todo reopen tests covering success, invalid states, replay/conflict, ownership, category history, and rollback/no-side-effect behavior.
- Run full `python -m pytest` from `backend/`.
- Inspect route and endpoint scope to confirm delete/list/Today/sync/SSE were not added.
- Run `git diff --check`, inspect exact modified and untracked files, and confirm no model/migration/product-contract changes.

## Risks

- Same-key replay can be confused with a new-key second reopen attempt.
- Status, cleared completion timestamp, version, and sync snapshot can diverge.
- Ownership lookup order can leak cross-user existence.
- Deleted category history can incorrectly block reopening.

## Coding Output Requirements

Report modified files, transition/error/idempotency behavior, timestamp/version/transaction evidence, acceptance results, focused/full test results, endpoint-scope verification, diff checks, unresolved issues, and task-outside findings.

## Current Stage

Next role: Code Review

Required next action: review TASK-012 Todo reopen API implementation.
