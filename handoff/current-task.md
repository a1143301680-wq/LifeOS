# LifeOS Current Task

Last updated: 2026-07-14

## Metadata

- Task ID: TASK-010
- Task Name: Todo update API
- Status: READY
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies:
  - Todo create foundation published in `f2fe55e`
  - Todo detail API published in `deb240b`
  - TASK-009 terminal closure published in `f8614b3`

## Background

Todo create and detail retrieval are available. The next Phase 1A vertical slice is updating ordinary Todo fields while preserving ownership, status-action boundaries, idempotency, mutation versioning, and sync write-through.

## Goal

An authenticated user can partially update ordinary fields on an owned active Todo exactly once and receive the updated stable Todo DTO with a sync cursor, without changing lifecycle status or leaking another user's data.

## Scope

### In Scope

- `PATCH /api/v1/todos/{id}` only.
- Partial updates for `title`, `note`, `category_id`, `priority`, `planned_date`, and `due_at`.
- Ownership and soft-delete checks for Todo and selected category.
- Existing idempotency service integration.
- Atomic Todo mutation, version increment, `todo.updated` sync change, and idempotency response.
- Stable Todo DTO response and focused automated tests.

### Out of Scope

- Complete, reopen, delete, list, Today, sync pull, or SSE endpoints.
- Any direct status, completion, deletion, ownership, version, or timestamp mutation supplied by clients.
- Todo model or Alembic migration changes.
- Timezone-aware `due_at` input validation deferred from TASK-008.
- Reminder, recurring Todo, Android offline replay, full login, frontend, or Android work.
- Live PostgreSQL service recovery or migration verification.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 3, 5, 7.3, 9.4, and 10.4
- `docs/data-model-phase1.md` sections 2 and 4.3
- `docs/phase1a-progress.md`
- `backend/app/api/v1/todos.py`
- `backend/app/schemas/todo.py`
- Existing Todo create/detail and Todo Category update tests and helpers needed to follow repository patterns

### Allowed Modify Files

- `backend/app/api/v1/todos.py`
- `backend/app/schemas/todo.py`
- New or existing focused Todo update tests under `backend/tests/`
- Small reusable Todo lookup/update helpers only when directly required
- `docs/phase1a-progress.md`
- Active handoff, gate, Git record, issue-log, and TASK-010 state files

### Forbidden Modify Files

- Todo models or Alembic migrations
- Todo create/detail behavior except narrowly necessary shared helper corrections covered by tests
- Complete, reopen, delete, list, Today, sync pull, or SSE endpoints
- Todo Category API behavior or default-category seeding
- Frontend or Android files
- Product requirements, architecture, API contract, and data-model documents unless Task Review returns a contract ambiguity to Decision
- Completed TASK-005 through TASK-009 archives

## Implementation Requirements

- Add `PATCH /api/v1/todos/{id}` under the existing Todo router and require bearer authentication plus `Idempotency-Key`.
- Accept only fields explicitly present in the request from: `title`, `note`, `category_id`, `priority`, `planned_date`, and `due_at`.
- Reject an empty update object with `400 validation_error` so no no-op mutation, sync change, or idempotency result is committed.
- Trim `title`; reject null, empty, or whitespace-only title. Allow only `high`, `medium`, or `low` priority and reject null priority.
- Permit null `note`, `category_id`, `planned_date`, and `due_at` to clear those optional fields. Omitted fields remain unchanged.
- A non-null `category_id` must identify an active category owned by the current user. Missing or cross-user category returns `404 not_found`; current-user soft-deleted category returns `410 deleted_resource`.
- Query Todo by ID and current user ownership. Missing or cross-user Todo returns `404 not_found`; a current-user soft-deleted Todo returns `410 deleted_resource`.
- Reject `status`, `completed_at`, `deleted_at`, `user_id`, `version`, `created_at`, `updated_at`, and every other undeclared field with `400 validation_error`.
- Do not alter `status`, `completed_at`, or other lifecycle fields; completed and canceled active Todos may still have ordinary fields edited.
- For each accepted non-empty update, apply requested fields, increment `version` exactly once, and set `updated_at` using server time.
- Create `todo.updated` with `entity_type=todo`, the updated `entity_version`, and a payload snapshot equal to the response Todo DTO.
- Persist Todo changes, sync change, and idempotency response atomically. Failures must roll back all three.
- Return `200` using the write envelope with updated Todo DTO and `sync.cursor`.
- Preserve existing identical replay and conflicting-key behavior. A replay must not increment version or create another sync change.
- Never expose internal ownership, deletion, recurring/client, or sync fields in the Todo DTO.

## Acceptance Criteria

- [ ] A partial update of one or several allowed fields returns `200`, the updated DTO, incremented version, and `sync.cursor`.
- [ ] Omitted fields remain unchanged; nullable fields can be cleared explicitly with null.
- [ ] Null/blank title, null/invalid priority, empty object, invalid values, and forbidden/internal fields return `400 validation_error` without mutation.
- [ ] Missing or cross-user Todo returns `404 not_found`; current-user soft-deleted Todo returns `410 deleted_resource`.
- [ ] Active owned category selection succeeds; missing/cross-user category returns `404`, and current-user soft-deleted category returns `410`.
- [ ] Ordinary fields can be edited without changing pending, completed, or canceled lifecycle state.
- [ ] Todo, version, updated timestamp, `todo.updated` sync snapshot, and idempotency response are atomic and consistent.
- [ ] Missing Idempotency-Key, identical replay, and conflicting key reuse follow existing semantics; replay has no duplicate side effects.
- [ ] Authentication and invalid path/payload UUID behavior follow existing API conventions.
- [ ] Internal fields remain absent from response and sync snapshot.
- [ ] Focused and full backend tests pass; no migration or out-of-scope endpoint is added.

## Verification Plan

- Add and run focused Todo update tests covering all acceptance paths and rollback/no-side-effect assertions.
- Run full `python -m pytest` from `backend/`.
- Inspect route registration for future static `/todos/today` compatibility and ensure no lifecycle endpoint was added.
- Run `git diff --check`, inspect exact modified and untracked files, and confirm no model/migration/product-contract changes.

## Risks

- Partial-update schemas can confuse omitted values with explicit null clearing.
- Todo or category lookup order can leak cross-user existence.
- Replay can accidentally apply a second mutation or create a duplicate sync change.
- Version, DTO snapshot, and persisted state can diverge if transaction ordering is wrong.
- Dynamic Todo route placement can conflict with future static routes.

## Coding Output Requirements

Report modified files, update/null/error behavior, version and transaction behavior, acceptance results, focused/full test results, route-order verification, diff checks, unresolved issues, and task-outside findings.

## Current Stage

Next role: Git Snapshot

Required next action: establish the pre-Coding Git Snapshot. Coding must not start until Git Snapshot completes.
