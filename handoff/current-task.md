# LifeOS Current Task

Last updated: 2026-07-13

## Metadata

- Task ID: TASK-008
- Task Name: Todo model, migration, and create API
- Status: REVIEWING
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies:
  - Todo Category CRUD published in `83ac3eb`
  - Default category seeding published in `d1c0dbf`
  - Workflow hardening closed in `4c5c315`

## Background

Todo categories and the active Inbox invariant are available. The next Phase 1A vertical slice is durable Todo storage plus `POST /api/v1/todos`, including authentication, category ownership, idempotency, sync write-through, and focused tests.

## Goal

An authenticated user can create a pending Todo exactly once, using an active owned category or the user's active Inbox by default, and receive the stable Todo DTO with a sync cursor.

## Scope

### In Scope

- SQLAlchemy Todo model and Alembic migration.
- Phase 1 Todo columns and recommended indexes needed for future endpoints.
- `POST /api/v1/todos` only.
- Todo create/read schemas needed for the create response.
- User/category ownership and active-category validation.
- Default active Inbox resolution when `category_id` is omitted.
- Existing idempotency service integration.
- `todo.created` sync change in the same transaction.
- Two-user isolation and focused automated tests.

### Out of Scope

- `GET`, `PATCH`, complete, reopen, delete, list, Today, sync pull, or SSE Todo endpoints.
- Reminder and recurring-template APIs or behavior.
- Android offline replay and full login.
- Frontend or Android work.
- Changes to Todo Category API behavior or default-category seeding.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 2-7 and 10.2
- `docs/data-model-phase1.md` sections 3 and 4.3
- `docs/phase1a-progress.md`
- Existing models, migrations, API router, schemas, idempotency, sync, envelope, auth, time, and relevant tests under `backend/`

### Allowed Modify Files

- New Todo model, schema, API route, migration, and focused tests under `backend/`
- Existing model/schema exports and API router registration required for Todo create
- Small reusable backend helpers only when directly required by Todo create
- `docs/phase1a-progress.md`
- Active handoff, gate, Git record, issue-log, and TASK-008 state files

### Forbidden Modify Files

- Frontend or Android files
- Reminder, recurring Todo, sync pull, or SSE implementations
- Existing Todo Category endpoint behavior
- Completed TASK-005, TASK-006, and TASK-007 archives
- Product requirements, architecture, API contract, and data-model documents unless Task Review returns a contract ambiguity to Decision

## Implementation Requirements

- Persist the Phase 1 Todo fields from `docs/data-model-phase1.md`; `recurring_template_id` remains nullable without a foreign key until the recurring-template table exists.
- Create requests accept only `id`, `title`, `note`, `category_id`, `priority`, `planned_date`, and `due_at`; reject client-supplied ownership, status, completion, version, sync, and internal fields.
- Trim `title` and reject an empty or whitespace-only title with `400 validation_error`.
- Default `priority` to `medium`; allow only `high`, `medium`, or `low`.
- Always create `status=pending`, `version=1`, with null completion/cancellation/deletion fields.
- If `category_id` is omitted, resolve exactly one active `is_inbox=true` category owned by the user; missing or invalid Inbox state returns `400 invalid_state_transition` without creating data.
- A supplied category must belong to the current user. Missing or cross-user category returns `404 not_found`; a current-user soft-deleted category returns `410 deleted_resource`.
- A client-provided Todo UUID collision returns `400 validation_error` without leaking another user's data.
- Require `Idempotency-Key`; replay an identical request and reject conflicting reuse using existing semantics.
- Create Todo, `todo.created` sync change, and idempotency response atomically.
- Sync change uses `entity_type=todo`, `entity_version=1`, and a payload snapshot consistent with the Todo DTO.
- Response status is `201` and uses the write envelope with `sync.cursor`.
- Never expose `user_id`, `deleted_at`, recurring/internal client fields, or internal sync fields in the normal Todo DTO.

## Acceptance Criteria

- [ ] Migration creates the Todo table, constraints, and recommended indexes without breaking the current Alembic chain.
- [ ] Authenticated create returns `201`, a pending version-1 Todo DTO, and `sync.cursor`.
- [ ] Omitted category defaults to the current user's active Inbox.
- [ ] Supplied active owned category is accepted.
- [ ] Missing, cross-user, and soft-deleted category cases follow the specified errors and create no Todo.
- [ ] Missing/invalid Idempotency-Key, identical replay, and conflicting reuse are covered.
- [ ] Optional client UUID is preserved; server generates one when omitted; collision is handled safely.
- [ ] Invalid title, priority, UUID, and forbidden/internal request fields are rejected.
- [ ] Todo, sync change, and idempotency record are committed atomically.
- [ ] Two-user isolation is covered.
- [ ] Existing backend tests remain green.

## Verification Plan

- Focused Todo create API and migration/model tests.
- Full `python -m pytest` from `backend/`.
- `python -m alembic heads` and migration-chain inspection.
- Live PostgreSQL upgrade/current and focused insert verification when the configured local database is safely available; otherwise record the missing verification explicitly.
- `git diff --check` and exact modified-file review.

## Risks

- Todo model fields needed by later endpoints may be omitted or typed inconsistently.
- Client UUID collisions and category lookup errors can leak cross-user existence if handled carelessly.
- Idempotency, sync, and Todo writes can diverge if transaction boundaries are split.
- SQLite tests may not expose PostgreSQL migration/index differences.

## Coding Output Requirements

Report modified files, migration details, API behavior, acceptance results, test/migration commands, PostgreSQL verification status, diff check, unresolved issues, and task-outside findings.

## Current Stage

Next role: Code Review

Required next action: review TASK-008 Todo create implementation.
