# TASK-008 Todo Model Migration And Create API

## Metadata

- Task ID: TASK-008
- Task Name: Todo model, migration, and create API
- Status: READY
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: Category CRUD `83ac3eb`; default categories `d1c0dbf`; workflow closure `4c5c315`

## Decision

Create the Todo persistence foundation and `POST /api/v1/todos` vertical slice with user/category isolation, default Inbox resolution, idempotency, sync write-through, and tests. Other Todo endpoints remain out of scope.

## Key Contract

- Request fields: optional `id`, required nonblank `title`, optional `note`, optional `category_id`, optional `priority`, `planned_date`, and `due_at`.
- Server fields: `status=pending`, `priority=medium` by default, `version=1`.
- Omitted category uses the user's active Inbox.
- Supplied category must be active and owned by the user.
- Writes require `Idempotency-Key` and atomically create `todo.created` sync state.
- Response: `201` Todo DTO plus `sync.cursor`.
- `recurring_template_id` is nullable and has no foreign key until the recurring-template table exists.

## Acceptance Criteria

- [ ] Todo model and migration match the Phase 1 data model and indexes.
- [ ] Create happy paths work with default Inbox and supplied owned category.
- [ ] Authentication, ownership, deleted-category, validation, UUID, and idempotency paths are covered.
- [ ] Todo, sync change, and idempotency record are atomic.
- [ ] Two-user isolation is covered.
- [ ] Focused and full backend tests pass.
- [ ] Alembic chain and PostgreSQL verification status are recorded.
- [ ] No other Todo endpoint or excluded feature is implemented.

## Task Review

- REVIEW RESULT: PASS
- Reviewed by: Task Review window
- Reviewed at: 2026-07-13 21:32 +08:00
- Result: task is ready for Git Snapshot.
- Blocking Issues: None.

## Git Snapshot

Pending.

## Coding Result

Pending.

## Code Review

Pending.

## Git Commit

Pending.

## Closure

Pending.

## Follow-up Tasks

- Todo detail/update/complete/reopen/delete slice.
- Todo list cursor/filter slice.
