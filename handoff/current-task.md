# LifeOS Current Task

Last updated: 2026-07-14

## Metadata

- Task ID: TASK-009
- Task Name: Todo detail API
- Status: COMPLETED
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies:
  - Todo create foundation published in `f2fe55e`
  - TASK-008 terminal closure published in `2efce90`

## Background

Todo persistence and create behavior are available. The next smallest Phase 1A vertical slice is authenticated retrieval of one Todo, including ownership isolation and the distinct soft-delete semantics already fixed by the API contract.

## Goal

An authenticated user can retrieve one owned active Todo through `GET /api/v1/todos/{id}` using the stable Todo DTO, without leaking another user's Todo or treating a soft-deleted category as a deleted Todo.

## Scope

### In Scope

- `GET /api/v1/todos/{id}` only.
- Current-user ownership isolation.
- Active Todo serialization through the existing Todo DTO helper.
- Historical category summary behavior for active and soft-deleted categories.
- Missing, cross-user, and current-user soft-deleted Todo errors.
- Authentication, UUID path validation, boundary behavior, and focused automated tests.
- Verification that the read endpoint creates no sync change or idempotency state.

### Out of Scope

- Todo update, complete, reopen, delete, list, Today, sync pull, or SSE endpoints.
- Todo model or Alembic migration changes.
- Idempotency-Key requirements for this read endpoint.
- Reminder, recurring Todo, Android offline replay, full login, frontend, or Android work.
- Timezone-aware `due_at` input validation deferred from TASK-008.
- Live PostgreSQL service recovery or migration verification.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 5, 7.3, 9.4, and 10.3
- `docs/phase1a-progress.md`
- `backend/app/api/v1/todos.py`
- `backend/app/schemas/todo.py`
- `backend/app/models/todo.py`
- `backend/app/models/todo_category.py`
- Existing auth, envelope, error, category, and Todo create tests needed to follow repository patterns

### Allowed Modify Files

- `backend/app/api/v1/todos.py`
- `backend/app/schemas/todo.py` only if a focused response-schema change is directly required
- New or existing focused Todo detail tests under `backend/tests/`
- `docs/phase1a-progress.md`
- Active handoff, gate, Git record, issue-log, and TASK-009 state files

### Forbidden Modify Files

- Todo models or Alembic migrations
- Todo create behavior except a narrowly necessary shared serialization correction covered by tests
- Any other Todo endpoint
- Todo Category API behavior or default-category seeding
- Frontend or Android files
- Product requirements, architecture, API contract, and data-model documents unless Task Review returns a contract ambiguity to Decision
- Completed TASK-005 through TASK-008 archives

## Implementation Requirements

- Add `GET /api/v1/todos/{id}` under the existing Todo router and require bearer authentication.
- Query by Todo ID and current user ownership so a missing Todo and a Todo owned by another user both return `404 not_found` without existence leakage.
- If the matched current-user Todo has `deleted_at`, return `410 deleted_resource` using the standard error envelope.
- Return an active matched Todo with the normal data envelope and stable Todo DTO; do not include `sync` metadata on this read response.
- Reuse `todo_to_dict` rather than creating a divergent detail representation.
- For an active category, return its current `id` and `name` with `is_deleted=false`.
- For a soft-deleted category still referenced by the Todo, retain its historical `id` and current stored `name` with `is_deleted=true`.
- If `category_id` or the related category row is absent, return `category=null` without crashing.
- Do not expose `user_id`, `deleted_at`, recurring/internal client fields, or internal sync fields.
- Do not require, consume, or persist an `Idempotency-Key`; do not create `sync_changes` for this read.
- Keep response and error behavior consistent with existing envelope and auth conventions.

## Acceptance Criteria

- [x] Authenticated retrieval of an owned active Todo returns `200` and the expected Todo DTO.
- [x] An active category is summarized with `is_deleted=false`.
- [x] A soft-deleted category referenced by an active Todo is summarized with `is_deleted=true`; the Todo itself remains readable.
- [x] A Todo with no resolvable category returns `category=null` without failure.
- [x] Missing and cross-user Todo IDs both return `404 not_found` with no ownership leak.
- [x] A current-user soft-deleted Todo returns `410 deleted_resource` using the standard error envelope.
- [x] Missing or invalid authentication and an invalid path UUID follow existing API conventions.
- [x] The response excludes internal fields and does not contain write `sync` metadata.
- [x] The GET request creates no Todo, idempotency record, or sync change.
- [x] Existing backend tests remain green and no out-of-scope endpoint is added.

## Verification Plan

- Add and run focused Todo detail API tests covering the acceptance criteria.
- Run full `python -m pytest` from `backend/`.
- Inspect route ordering so `/todos/{id}` does not preclude future static routes such as `/todos/today`.
- Run `git diff --check`, inspect exact modified and untracked files, and confirm no migration/model/product-contract changes.

## Risks

- Querying by ID before ownership can leak cross-user existence through error differences.
- Filtering out soft-deleted Todos too early can incorrectly turn the required `410` into `404`.
- Confusing a deleted category with a deleted Todo can incorrectly make historical Todos unreadable.
- A dynamic `/{id}` route can conflict with future static Todo routes if route ordering is handled carelessly.

## Coding Output Requirements

Report modified files, endpoint behavior, acceptance results, focused/full test results, route-order verification, diff checks, unresolved issues, and task-outside findings.

## Current Stage

Next role: Git Commit (Terminal Closure Commit)

Closure Check: PASS

Checked at: 2026-07-14 21:00 +08:00

Result Commit: `deb240b1a3cbe46890853499a55daf60c2a49b81`

Completion Commit: `9d6cbcaae6af2c092c3618ea364da6b4e4334e73`

Remote Verification: local `main`, `origin/main`, and remote `refs/heads/main` all matched `9d6cbcaae6af2c092c3618ea364da6b4e4334e73` before Closure documentation edits.

Required next action: commit and push only the Decision-approved TASK-009 Closure documents with message `docs(task): close TASK-009`. After remote parity is verified, return to Decision; do not run another Closure Check.
