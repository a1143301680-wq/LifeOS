# LifeOS Current Task

Last updated: 2026-07-17

## Metadata

- Task ID: TASK-011
- Task Name: Todo complete API
- Status: COMPLETED
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies:
  - Todo create foundation published in `f2fe55e`
  - Todo update API published in `09cd984`
  - TASK-010 terminal closure published in `a2237de`

## Background

Todo create, detail, and ordinary-field update are available. The next Phase 1A vertical slice is the first explicit Todo lifecycle action: completing an owned pending Todo with server-controlled state, timestamp, version, idempotency, and sync output.

## Goal

An authenticated user can complete an owned active pending Todo exactly once and receive the completed stable Todo DTO with a sync cursor, while invalid states and cross-user resources remain protected.

## Scope

### In Scope

- `POST /api/v1/todos/{id}/complete` only.
- `pending -> completed` lifecycle transition.
- Server-controlled `completed_at`, `updated_at`, and version increment.
- Todo ownership and soft-delete checks.
- Existing idempotency service integration.
- Atomic Todo mutation, `todo.completed` sync change, and idempotency response.
- Stable Todo DTO response and focused automated tests.

### Out of Scope

- Reopen, delete, list, Today, sync pull, or SSE endpoints.
- Ordinary-field update behavior.
- Canceled-state creation or cancel API.
- Reminder cancellation or Reminder model/API work; reminders are outside Phase 1A and no Reminder table currently exists.
- Todo model, schema, or Alembic migration changes unless Task Review proves one unavoidable.
- Frontend, Android, recurring Todo, offline replay, or full login work.
- Live PostgreSQL service recovery or migration verification.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 3, 5, 7.3, 9.4, and 10.5
- `docs/data-model-phase1.md` Todo, version, sync, and idempotency rules
- `docs/phase1a-progress.md`
- `backend/app/api/v1/todos.py`
- Existing Todo create/update tests and idempotency/sync helpers needed to follow repository patterns

### Allowed Modify Files

- `backend/app/api/v1/todos.py`
- New or existing focused Todo complete tests under `backend/tests/`
- Small reusable Todo lifecycle helpers only when directly required
- `docs/phase1a-progress.md`
- Active handoff, gate, Git record, issue-log, and TASK-011 state files

### Forbidden Modify Files

- Todo models, schemas, or Alembic migrations unless Task Review explicitly approves an unavoidable prerequisite
- Todo create/detail/update behavior except narrowly necessary shared helper corrections covered by tests
- Reopen, delete, list, Today, sync pull, or SSE endpoints
- Todo Category API behavior or default-category seeding
- Reminder or recurring Todo implementation
- Frontend or Android files
- Product requirements, architecture, API contract, and data-model documents unless Task Review returns a contract ambiguity to Decision
- Completed TASK-005 through TASK-010 archives

## Implementation Requirements

- Add `POST /api/v1/todos/{id}/complete` under the existing Todo router and require bearer authentication plus `Idempotency-Key`.
- The action accepts no request body and no client-controlled lifecycle fields.
- Query Todo by ID and current user ownership. Missing or cross-user Todo returns `404 not_found`; a current-user soft-deleted Todo returns `410 deleted_resource`.
- Permit only `status=pending`. An active Todo already `completed` or `canceled` returns `400 invalid_state_transition` without mutation, sync change, or stored successful action result.
- On success, use one server timestamp to set `status=completed`, `completed_at`, and `updated_at`; leave ordinary fields and `canceled_at` unchanged.
- Increment `version` exactly once.
- Resolve the existing category only for response serialization; a soft-deleted or absent category must not block completion.
- Create `todo.completed` with `entity_type=todo`, the updated `entity_version`, and a payload snapshot equal to the response Todo DTO.
- Persist Todo changes, sync change, and idempotency response atomically. Any failure must roll back all three.
- Return `200` using the write envelope with completed Todo DTO and `sync.cursor`.
- Identical Idempotency-Key replay returns the original response without another state change, timestamp, version increment, or sync row.
- Reusing the same key for a conflicting method/path/body fingerprint follows the existing `idempotency_key_conflict` behavior.
- A new key submitted after the Todo is already completed is not a replay and must return `400 invalid_state_transition`.
- Never expose internal ownership, deletion, cancellation, recurring/client, or sync fields in the Todo DTO.

## Acceptance Criteria

- [x] Completing an owned pending Todo returns `200`, `status=completed`, server `completed_at`, incremented version, and `sync.cursor`.
- [x] `updated_at` and `completed_at` use the same server transition timestamp; ordinary fields remain unchanged.
- [x] The `todo.completed` sync row uses the updated entity version and a snapshot equal to the response DTO.
- [x] Missing or cross-user Todo returns `404 not_found`; current-user soft-deleted Todo returns `410 deleted_resource`.
- [x] Already completed and canceled active Todos return `400 invalid_state_transition` with no side effects.
- [x] Missing Idempotency-Key, identical replay, conflicting key reuse, and a new key after completion follow the defined behavior without duplicate effects.
- [x] Missing/invalid authentication and invalid path UUID follow existing conventions.
- [x] A soft-deleted or absent category does not block completion and is serialized through existing DTO rules.
- [x] Todo mutation, version/timestamps, sync snapshot, and idempotency response are atomic and consistent under failure.
- [x] Internal fields remain absent from response and sync snapshot.
- [x] Focused and full backend tests pass; no migration or out-of-scope endpoint is added.

## Verification Plan

- Add and run focused Todo complete tests covering all acceptance paths, replay, invalid states, ownership, category history, and rollback/no-side-effect assertions.
- Run full `python -m pytest` from `backend/`.
- Inspect route and endpoint scope to confirm reopen/delete/list/Today/sync/SSE were not added.
- Run `git diff --check`, inspect exact modified and untracked files, and confirm no model/migration/product-contract changes.

## Risks

- Idempotency replay can be confused with a second completion attempt using a new key.
- State, completion timestamp, version, and sync snapshot can diverge if mutation ordering is wrong.
- Ownership lookup order can leak cross-user existence.
- Soft-deleted category history can incorrectly block an otherwise valid Todo action.

## Coding Output Requirements

Report modified files, transition/error/idempotency behavior, version/timestamp/transaction evidence, acceptance results, focused/full test results, endpoint-scope verification, diff checks, unresolved issues, and task-outside findings.

## Current Stage

Next role: Git Commit (Terminal Closure Commit)

Closure Check: PASS

Checked at: 2026-07-17 09:16 +08:00

Result Commit: `2c35f1dc2ab94e6908bfcfb0bd67287b4114fb66`

Completion Commit: `5320bf1467accf626a925cee941fa9e94938a2a7`

Remote Verification: local `main`, `origin/main`, and remote `refs/heads/main` all matched `5320bf1467accf626a925cee941fa9e94938a2a7` before Closure documentation edits.

Required next action: commit and push only the Decision-approved TASK-011 Closure documents with message `docs(task): close TASK-011`. After remote parity is verified, return to Decision; do not run another Closure Check.
