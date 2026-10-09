# LifeOS Current Task

Last updated: 2026-10-09

## Metadata

- Task ID: TASK-031
- Task Name: PC Project/Goal core
- Status: READY
- Priority: P1
- Parent Task: PC V1 MVP completion
- Dependencies: TASK-030 terminal Closure Commit `da506ae691b822dc022485e1272594534943e1b4`; existing bearer identity, API envelope, and PC shell

## Background

The PC client currently supports Today, Todos, categories, and AI Today planning, but has no Project/Goal records or navigation. The user has directed Decision to complete PC V1 before resuming Android. This first slice creates durable Project/Goal records and a usable PC create/list/detail/edit flow. See `docs/pc-delivery-plan.md` for the remaining sequence.

## Goal

A signed-in user can create a Project/Goal, see their own projects, open one, edit its type/status/manual progress/next step, and pin it for the later focused Dashboard.

## In Scope

- Add the `projects` table and one Alembic migration.
- Add authenticated Project/Goal create, list, detail, and update endpoints under `/api/v1/projects`.
- Add typed request/response models, current-user isolation, validation, and idempotent writes following existing API conventions.
- Add PC navigation and Project/Goal list, create, detail, and edit interactions using the current app design.
- Add focused backend and frontend tests, migration verification, production build, and desktop/narrow browser checks.

## Out Of Scope

- Project deletion or archive, stages, milestones, linked Todos, logs, timeline, AI Sessions, Dashboard, Resume, Notes, Calendar, and Android.
- AI-generated project progress, automatic external chat import, reminders, new login, background jobs, or changes to existing Todo/SSE contracts.
- Changes to stable Phase 1A API/data-model/requirements documents or completed task archives.

## Relevant Files

- `docs/mvp.md`: Phase 2 Project/Goal and Resume scope
- `docs/requirements.md`: sections 6-9, Project/Goal types/status/progress and PC Dashboard
- `docs/architecture.md`: PC responsibility and Project/Goal data notes
- `docs/pc-delivery-plan.md`: approved PC-first sequence
- `backend/app/models/todo.py`, `backend/app/api/v1/todos.py`, `backend/app/services/idempotency.py`: local patterns
- `backend/app/api/v1/router.py`, `backend/app/models/__init__.py`, `backend/alembic/env.py`, latest migration
- `web/src/App.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`, existing tests

## Allowed Files

- New narrowly named Project model, schema, API, service, migration, and tests under `backend/**`
- `backend/app/api/v1/router.py`, `backend/app/models/__init__.py`, `backend/alembic/env.py` only as needed for registration
- `web/src/App.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`, and focused tests under `web/src/**` or `web/e2e/**`
- `docs/pc-delivery-plan.md` only to record verified progress, not to silently change scope
- Active TASK-031 workflow/gate/Git/issue files

## Forbidden Files And Changes

- `android/**`, existing Todo/category/sync/AI behavior, stable product/API/architecture/data-model documents, accepted ADRs, and completed task archives
- Model-selected or browser-supplied `user_id`, project records shared across identities, plaintext credentials, raw tokens, secrets, generated output, machine paths, or real private data in fixtures/logs
- Premature scaffolding for TASK-032 onward, project deletion, autonomous writes, or a replacement frontend framework

## Implementation Requirements

1. Model one user-owned `projects` table with UUID `id`, UUID `user_id`, `name`, `description`, `type`, `status`, `manual_progress`, `next_step`, `is_pinned`, `version`, `created_at`, and `updated_at`. Add indexes needed for owner-scoped listing. No nullable owner and no destructive migration.
2. Types: `development`, `learning`, `life`, `health`, `pet`, `other`. Statuses: `planning`, `in_progress`, `paused`, `completed`, `abandoned`. `manual_progress` is an integer 0-100. Name trims to 1-200 characters; description at most 2000; next step at most 1000; blank optional text normalizes to null. Defaults: type `other`, status `planning`, progress 0, pinned false, version 1.
3. `POST /api/v1/projects` creates a project for the bearer user. `GET /api/v1/projects` lists that user's projects, pinned first then `updated_at DESC, id ASC`. `GET /api/v1/projects/{id}` reads one. `PATCH /api/v1/projects/{id}` updates only supplied mutable fields, increments version and updated_at on an effective change, and does not permit id/user/version/timestamps in the payload.
4. Missing or other-user IDs return `404 not_found`; malformed payloads follow the existing validation envelope. Create/PATCH require a UUID `Idempotency-Key`, reuse the existing request-hash/replay/conflict boundary, and cannot create duplicate records or double-increment version on replay. An empty PATCH returns `400 validation_error`. A nonempty PATCH whose normalized values equal the stored values returns the unchanged record with the same version and `updated_at`; its idempotent replay returns that same response.
5. List/detail responses use the existing data/list envelopes and expose only the current user's project fields. This slice does not write `sync_changes`; Android project sync is outside the approved Phase 1A contract.
6. PC UI adds a Projects/Goals view with clear create and edit actions, a scannable list and usable detail state. Show name, type, status, progress, next step, and pinned state. The user can navigate from list to detail and back without losing current Todo/Today behavior.
7. Form validation and failures are visible and recoverable. Keep existing identity switching behavior and prevent stale requests for one identity from rendering another identity's projects. Narrow viewport must remain usable without overlap or horizontal overflow.
8. Use existing icon and styling conventions; do not add project Dashboard, stages, milestones, AI Session fields, or placeholder controls for future tasks.

## Acceptance Criteria

- [ ] Migration and model support owner-scoped projects with defaults, constraints, version, and deterministic list order.
- [ ] Create/list/detail/update behavior follows the stated API contract and response envelopes.
- [ ] Two identities cannot read or change each other's projects; malformed or absent bearer credentials fail closed.
- [ ] Idempotency replay/conflict and no-op update semantics are deterministic and tested.
- [ ] PC user can create, list, open, edit, pin, and reopen a real Project/Goal through the backend.
- [ ] Identity switch, error/retry, loading/empty state, and desktop/narrow layout work without leaking stale data.
- [ ] Full backend tests, full Web tests, Web production build, migration check, focused browser checks, and exact Git/security scans pass or record an exact environmental limitation.
- [ ] No Android, stages, milestones, AI Sessions, Dashboard, Notes, Calendar, existing API regression, secret, or generated artifact is included.

## Verification Plan

- Backend tests: validation, default fields, owner isolation, list order, detail 404, update/no-op/version behavior, idempotency replay/conflict, and no sync write.
- Verify Alembic migration applies to a disposable database or explicitly document why live PostgreSQL migration could not run; inspect schema/indexes and downgrade safety without modifying user data.
- Frontend tests: list/detail/create/edit/pin, empty/loading/error/retry, identity switch, and current Today/Todo regression.
- Run full backend pytest, full Web test suite, Web production build, and focused desktop/narrow browser flow.
- Inspect `git diff --check`, staged changes, exact scope, migrations, env files, credentials, private data, and generated artifacts.

## Risks

- This is a new user-owned entity and migration; owner predicates and idempotent writes are required to avoid cross-user leakage or duplicate projects.
- The current PC app is one large component. Keep additions coherent with its existing navigation and state boundaries without a broad unrelated refactor.
- Project/Goal CRUD is completed across later slices; this task deliberately stops before deletion, stages, links, and timeline.

## Coding Output Requirements

Report modified files, migration/schema, API behavior, idempotency/no-op rule, identity isolation, PC navigation and forms, test/build/browser/migration results, exact scope/security scans, issues, and next role.

## Current Stage

Next role: Git Snapshot

Required next action: establish the pre-Coding Git Snapshot for the exact ten-file TASK-031 publication/readiness scope approved in `handoff/task-review-gate.md`. Do not start Coding until Git Snapshot completes.
