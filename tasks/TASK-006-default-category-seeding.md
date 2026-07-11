# TASK-006 Default Todo Category Seeding

## Metadata

- Task ID: TASK-006
- Task Name: Default Todo category seeding and Inbox invariant
- Status: PLANNED
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies:
  - Todo Category CRUD published in `83ac3eb`
  - Active category name uniqueness published in `eca0af8`

## Decision

### Background

`POST /api/v1/todos` will default to the user's Inbox when `category_id` is omitted. The current bootstrap path creates users but does not guarantee default Todo categories or the Inbox invariant.

### Goal

Each seeded user has the required default Todo categories, including exactly one active Inbox, before Todo creation work begins.

### In Scope

- Bootstrap/initialization logic for default Todo categories.
- Default categories: Inbox, Work, Study, Life, Partner, Pet, Health, Interest, AI, Project.
- Idempotent rerun behavior.
- Backfill missing default categories for existing users.
- Tests for seeding and Inbox invariant.

### Out of Scope

- Todo API endpoints.
- Reminder, recurring Todo, strong reminder, Android offline replay, or full login.
- UI work.
- Changing published Category CRUD API behavior beyond what seeding requires.

### Relevant Files

- `backend/app/scripts/bootstrap_users.py`
- `backend/app/models/todo_category.py`
- `backend/tests/`
- `docs/phase1a-progress.md`
- `handoff/current-task.md`

### Allowed Files

- `backend/app/scripts/bootstrap_users.py`
- New backend service/helper files if needed for category defaults.
- Backend tests related to bootstrap/category seeding.
- Handoff/progress files for task status updates.

### Forbidden Files

- Frontend or Android files.
- Todo endpoint implementation files, unless only importing existing models is required for tests.
- Reminder/recurring/offline replay files.

### Implementation Requirements

- Bootstrap rerun must not duplicate users or categories.
- Existing users without categories receive missing default categories.
- Existing users with an active Inbox do not receive a second active Inbox.
- Category-name uniqueness and soft-delete semantics remain intact.
- Do not implement Todo endpoints.

### Acceptance Criteria

- [ ] New user bootstrap creates both users and all default categories for each user.
- [ ] Rerunning bootstrap does not duplicate users or categories.
- [ ] Existing users missing default categories are backfilled.
- [ ] Each user has exactly one active Inbox after bootstrap.
- [ ] Existing active Inbox is preserved and not duplicated.
- [ ] Backend tests cover the above behavior.

### Verification Plan

- Automated tests: `python -m pytest`
- Static/build check: not required unless implementation changes packaging.
- Manual verification: optional script run against local database if safe.

### Risks

- Accidentally creating duplicate active categories.
- Soft-deleted categories may interact with name reuse. Expected behavior must be explicit in tests.
- Bootstrap output should not leak existing raw tokens.

### Coding Output Requirements

Coding must report:

- modified files
- implementation summary
- acceptance criteria results
- test commands and results
- unresolved issues
- task-outside findings

## Task Review

Pending.

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

None yet.
