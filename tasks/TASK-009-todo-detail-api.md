# TASK-009 Todo Detail API

## Metadata

- Task ID: TASK-009
- Task Name: Todo detail API
- Status: READY
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: Todo create foundation `f2fe55e`; TASK-008 terminal closure `2efce90`

## Decision

Implement only `GET /api/v1/todos/{id}` as the next closeable Todo API slice. Preserve current-user isolation, distinguish a deleted Todo from a deleted category, reuse the stable Todo DTO, and prove the read endpoint has no write side effects.

## In Scope

- Authenticated Todo detail endpoint.
- Owned active Todo response through the existing DTO helper.
- Active, soft-deleted, and missing category representation.
- Missing, cross-user, soft-deleted Todo, authentication, and invalid UUID behavior.
- Focused tests and full backend regression verification.

## Out Of Scope

- Todo PATCH, complete, reopen, delete, list, Today, sync pull, or SSE.
- Model or migration changes.
- Idempotency or sync writes for GET.
- Timezone-aware `due_at` input hardening.
- Reminder, recurring Todo, Android, frontend, or local PostgreSQL service work.

## Contract

- Missing or cross-user Todo: `404 not_found`.
- Current-user soft-deleted Todo: `410 deleted_resource`.
- Active Todo with a soft-deleted category remains readable and returns category `is_deleted=true`.
- Missing category relation returns `category=null`.
- Success: `200`, normal data envelope, stable Todo DTO, no write `sync` metadata.
- No internal ownership, deletion, recurring/client, or sync fields are exposed.

## Allowed Files

- `backend/app/api/v1/todos.py`
- `backend/app/schemas/todo.py` only when directly required
- Focused Todo detail tests under `backend/tests/`
- `docs/phase1a-progress.md`
- Active TASK-009 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- Todo models and migrations
- Product contract documents
- Other Todo endpoints or category behavior
- Frontend and Android files
- Completed TASK-005 through TASK-008 archives

## Acceptance Criteria

- [ ] Owned active Todo detail returns `200` and the stable DTO.
- [ ] Active category summary uses `is_deleted=false`.
- [ ] Soft-deleted category summary uses `is_deleted=true` without hiding the Todo.
- [ ] Missing category relation is serialized as null without failure.
- [ ] Missing and cross-user Todo return indistinguishable `404 not_found` responses.
- [ ] Current-user soft-deleted Todo returns `410 deleted_resource`.
- [ ] Auth and invalid UUID behavior follow existing conventions.
- [ ] Internal fields and write `sync` metadata are absent.
- [ ] The endpoint creates no Todo, idempotency record, or sync change.
- [ ] Focused and full backend tests pass; no out-of-scope endpoint or migration is added.

## Verification Plan

- Focused Todo detail tests for all acceptance paths.
- Full `python -m pytest` from `backend/`.
- Route ordering inspection for future `/todos/today` compatibility.
- `git diff --check` and exact changed-file review.

## Risks

- Cross-user existence leakage.
- Incorrect `404` for an owned soft-deleted Todo.
- Incorrectly treating a deleted category as a deleted Todo.
- Dynamic route ordering conflict with future static routes.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-14 20:36 +08:00
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
