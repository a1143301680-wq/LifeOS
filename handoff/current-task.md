# LifeOS Current Task

Last updated: 2026-07-11

## Metadata

- Task ID: TASK-006
- Task Name: Default Todo category seeding and Inbox invariant
- Status: PLANNED
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies:
  - Todo Category CRUD published in `83ac3eb`
  - Active category name uniqueness published in `eca0af8`

## Background

`POST /api/v1/todos` will default to the user's Inbox when `category_id` is omitted. The current bootstrap path creates users but does not guarantee default Todo categories or the Inbox invariant.

## Goal

Each seeded user has the required default Todo categories, including exactly one active Inbox, before Todo creation work begins.

## Scope

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

## Related Files

### Expected Read Files

- `docs/workflow.md`
- `docs/phase1a-progress.md`
- `docs/api-phase1a.md`
- `docs/data-model-phase1.md`
- `backend/app/scripts/bootstrap_users.py`
- `backend/app/models/todo_category.py`
- `backend/tests/`

### Allowed Modify Files

- `backend/app/scripts/bootstrap_users.py`
- New backend service/helper files if needed for category defaults.
- Backend tests related to bootstrap/category seeding.
- Handoff/progress files for task status updates.

### Forbidden Modify Files

- Frontend or Android files.
- Todo endpoint implementation files, unless only importing existing models is required for tests.
- Reminder/recurring/offline replay files.

## Implementation Requirements

- Bootstrap rerun must not duplicate users or categories.
- Existing users without categories receive missing default categories.
- Existing users with an active Inbox do not receive a second active Inbox.
- Category-name uniqueness and soft-delete semantics remain intact.
- Do not implement Todo endpoints.

## Acceptance Criteria

- [ ] New user bootstrap creates both users and all default categories for each user.
- [ ] Rerunning bootstrap does not duplicate users or categories.
- [ ] Existing users missing default categories are backfilled.
- [ ] Each user has exactly one active Inbox after bootstrap.
- [ ] Existing active Inbox is preserved and not duplicated.
- [ ] Backend tests cover the above behavior.

## Verification Plan

- Automated tests: `python -m pytest`
- Static check: not required unless implementation changes packaging or typing-sensitive APIs.
- Build check: not required.
- Manual verification: optional script run against local database if safe.

## Risks

- Duplicate active categories if seeding checks are incomplete.
- Soft-deleted categories may interact with name reuse; expected behavior must be explicit in tests.
- Bootstrap output must not reveal existing raw tokens.

## Coding Output Requirements

Coding must report:

- modified files
- implementation summary
- acceptance criteria results
- test commands and results
- unresolved issues
- task-outside findings

## Current Stage

Next role: Task Review

Required next action: review this task for readiness. Coding must not start until Task Review passes and Git Snapshot completes.
