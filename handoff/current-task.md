# LifeOS Current Task

Last updated: 2026-07-17

## Metadata

- Task ID: TASK-013
- Task Name: Todo delete API
- Status: REVIEWING
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies:
  - Todo update API published in `09cd984`
  - Todo lifecycle actions published in `2c35f1d` and `c2d167f`
  - TASK-012 terminal closure published in `17e54de`

## Background

Todo create, edit, complete, and reopen are available. The final Todo lifecycle mutation slice is soft deletion with a durable versioned tombstone for sync recovery, while preserving the Todo's lifecycle status.

## Goal

An authenticated user can soft-delete an owned active Todo exactly once and receive a stable tombstone plus sync cursor, without hard deletion, status coercion, duplicate effects, or cross-user leakage.

## Scope

### In Scope

- `DELETE /api/v1/todos/{id}` only.
- Soft deletion of active pending, completed, or canceled Todos.
- Server-controlled `deleted_at`, `updated_at`, and version increment.
- Todo ownership and already-deleted checks.
- Existing idempotency service integration.
- Atomic Todo mutation, `todo.deleted` tombstone sync change, and idempotency response.
- Focused automated tests.

### Out of Scope

- Hard deletion or status change to canceled.
- List, Today, sync pull, or SSE endpoints.
- Changes to create/detail/update/complete/reopen behavior.
- Category deletion or Todo category mutation.
- Reminder, recurring Todo, frontend, Android, offline replay, or full login work.
- Todo model, schema, or Alembic migration changes unless Task Review proves one unavoidable.
- Live PostgreSQL service recovery or migration verification.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 3, 5, 7.3, 10.7, and 12 tombstone rules
- `docs/data-model-phase1.md` soft delete, Todo version, sync, and idempotency rules
- `docs/phase1a-progress.md`
- `backend/app/api/v1/todos.py`
- Existing Todo lifecycle and category delete tests/helpers needed to follow repository patterns

### Allowed Modify Files

- `backend/app/api/v1/todos.py`
- New or existing focused Todo delete tests under `backend/tests/`
- Small reusable Todo lifecycle/tombstone helpers only when directly required
- `docs/phase1a-progress.md`
- Active handoff, gate, Git record, issue-log, and TASK-013 state files

### Forbidden Modify Files

- Todo models, schemas, or Alembic migrations unless Task Review explicitly approves an unavoidable prerequisite
- Existing Todo or category endpoint behavior except narrowly necessary shared helper corrections covered by tests
- List, Today, sync pull, or SSE endpoints
- Reminder or recurring Todo implementation
- Frontend or Android files
- Product requirements, architecture, API contract, and data-model documents unless Task Review returns a contract ambiguity to Decision
- Completed TASK-005 through TASK-012 archives

## Implementation Requirements

- Add `DELETE /api/v1/todos/{id}` under the existing Todo router and require bearer authentication plus `Idempotency-Key`.
- The action accepts no request body or client-controlled deletion/lifecycle fields; reject a non-empty body with `400 validation_error`.
- Query Todo by ID and current user ownership. Missing or cross-user Todo returns `404 not_found`; a current-user already soft-deleted Todo returns `410 deleted_resource`.
- Permit deletion for any active `pending`, `completed`, or `canceled` Todo.
- On success, use one server timestamp for `deleted_at` and `updated_at`, increment `version` exactly once, and leave `status`, `completed_at`, `canceled_at`, and ordinary fields unchanged.
- Do not hard-delete the Todo or alter its category relationship.
- Return `200` with data tombstone `{id, deleted: true, deleted_at, version}` plus `sync.cursor`.
- Create `todo.deleted` with `entity_type=todo`, updated `entity_version`, and payload tombstone containing `deleted=true` and the same serialized `deleted_at` as the response.
- Persist Todo mutation, sync change, and idempotency response atomically. Any failure must roll back all three.
- Identical Idempotency-Key replay returns the original response without another timestamp, version increment, or sync row.
- Reusing the same key for a conflicting fingerprint follows existing `idempotency_key_conflict` behavior.
- A new key submitted after deletion is not a replay and returns `410 deleted_resource` without duplicate effects.
- Do not expose `user_id`, status, category, ordinary Todo data, or other internal fields in the deletion tombstone response.

## Acceptance Criteria

- [ ] Deleting an owned active Todo returns `200`, the defined tombstone, incremented version, and `sync.cursor`.
- [ ] Pending, completed, and canceled Todos can be deleted while their status/completion/cancellation data remains unchanged in storage.
- [ ] `deleted_at` and `updated_at` use the same server timestamp; no hard delete occurs.
- [ ] `todo.deleted` uses the updated entity version and tombstone timestamp equal to the response.
- [ ] Missing or cross-user Todo returns `404 not_found`; current-user already-deleted Todo returns `410 deleted_resource`.
- [ ] Missing key, identical replay, conflicting reuse, and a new key after deletion follow defined behavior without duplicate effects.
- [ ] Missing/invalid authentication, invalid UUID, and non-empty body follow existing validation/error conventions.
- [ ] Todo mutation, version/timestamps, sync tombstone, and idempotency response are atomic and consistent under failure.
- [ ] Response and sync tombstone expose only approved deletion fields.
- [ ] Focused and full backend tests pass; no migration or out-of-scope endpoint is added.

## Verification Plan

- Add and run focused Todo delete tests covering all statuses, errors, tombstone equality, replay/conflict, ownership, and rollback/no-side-effect behavior.
- Run full `python -m pytest` from `backend/`.
- Inspect route and endpoint scope to confirm list/Today/sync/SSE were not added.
- Run `git diff --check`, inspect exact modified and untracked files, and confirm no model/migration/product-contract changes.

## Risks

- Soft delete can accidentally coerce status or erase completion history.
- Same-key replay can be confused with a new-key delete of an existing tombstone.
- Version and response/sync tombstone timestamps can diverge.
- Ownership lookup order can leak cross-user existence.

## Coding Output Requirements

Report modified files, tombstone/status/error/idempotency behavior, timestamp/version/transaction evidence, acceptance results, focused/full test results, endpoint-scope verification, diff checks, unresolved issues, and task-outside findings.

## Current Stage

Next role: Git Commit

Required next action: publish the Code Review-approved TASK-013 result. Git Commit must verify the reviewed file set against `handoff/code-review-gate.md` before committing.
