# TASK-010 Todo Update API

## Metadata

- Task ID: TASK-010
- Task Name: Todo update API
- Status: READY
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: Todo create `f2fe55e`; Todo detail `deb240b`; TASK-009 terminal closure `f8614b3`

## Decision

Implement only `PATCH /api/v1/todos/{id}` as the next closeable Todo slice. Support partial ordinary-field updates with explicit null semantics, ownership isolation, idempotency, version increment, and atomic `todo.updated` sync write-through. Lifecycle actions remain separate tasks.

## In Scope

- PATCH for `title`, `note`, `category_id`, `priority`, `planned_date`, and `due_at`.
- Todo/category ownership and soft-delete behavior.
- Empty/invalid/forbidden payload validation.
- Idempotent atomic mutation, version increment, sync snapshot, and response.
- Focused tests and full backend regression verification.

## Out Of Scope

- Complete, reopen, delete, list, Today, sync pull, or SSE.
- Model or migration changes.
- Client-supplied lifecycle, ownership, version, or timestamp fields.
- Timezone-aware `due_at` hardening.
- Reminder, recurring Todo, Android, frontend, or PostgreSQL service work.

## Contract

- Omitted allowed fields stay unchanged.
- `note`, `category_id`, `planned_date`, and `due_at` accept null to clear.
- `title` and `priority` reject null; title rejects blank; priority allows only high/medium/low.
- Empty object and undeclared fields return `400 validation_error` with no side effect.
- Missing/cross-user Todo or category returns `404 not_found`; current-user deleted Todo or category returns `410 deleted_resource`.
- Accepted update increments version once, updates server timestamp, writes `todo.updated`, and returns `200` with Todo DTO and sync cursor.
- Replay returns the original response without another mutation or sync row; conflicting key reuse follows existing behavior.
- Status and lifecycle fields never change through PATCH.

## Allowed Files

- `backend/app/api/v1/todos.py`
- `backend/app/schemas/todo.py`
- Focused Todo update tests under `backend/tests/`
- Directly required small Todo helpers
- `docs/phase1a-progress.md`
- Active TASK-010 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- Todo models and migrations
- Product contract documents
- Lifecycle/list/Today/sync/SSE endpoints
- Category API behavior
- Frontend and Android files
- Completed TASK-005 through TASK-009 archives

## Acceptance Criteria

- [ ] Allowed partial updates return updated DTO, version, and sync cursor.
- [ ] Omitted fields stay unchanged and nullable fields can be cleared.
- [ ] Empty, invalid, null-for-required, and forbidden payloads fail without mutation.
- [ ] Todo and category ownership/deletion errors follow the defined `404`/`410` rules.
- [ ] Pending, completed, and canceled active Todos retain status while ordinary fields are edited.
- [ ] Version/timestamp mutation, `todo.updated` snapshot, and idempotency response are atomic and consistent.
- [ ] Missing, replayed, and conflicting idempotency keys are covered without duplicate side effects.
- [ ] Auth, UUID, DTO field exclusion, and rollback behavior are covered.
- [ ] Focused and full tests pass; no migration or out-of-scope endpoint is added.

## Verification Plan

- Focused Todo update tests for all acceptance paths.
- Full `python -m pytest` from `backend/`.
- Route and endpoint-scope inspection.
- `git diff --check` and exact changed-file review.

## Risks

- Omitted/null field confusion.
- Cross-user existence leakage.
- Duplicate replay mutation.
- Version/snapshot/transaction inconsistency.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-14 21:13 +08:00
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
