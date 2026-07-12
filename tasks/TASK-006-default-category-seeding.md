# TASK-006 Default Todo Category Seeding

## Metadata

- Task ID: TASK-006
- Task Name: Default Todo category seeding and Inbox invariant
- Status: COMPLETED
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
- Only active categories (`deleted_at IS NULL`) count as present during default seeding.
- A soft-deleted default category, including a historical Inbox row, counts as missing and receives a new active row.
- Soft-deleted historical rows must be preserved as tombstones; bootstrap must not restore, rename, or otherwise modify them.
- Category-name uniqueness and soft-delete semantics remain intact.
- Do not implement Todo endpoints.

### Acceptance Criteria

- [ ] New user bootstrap creates both users and all default categories for each user.
- [ ] Rerunning bootstrap does not duplicate users or categories.
- [ ] Existing users missing default categories are backfilled.
- [ ] Each user has exactly one active Inbox after bootstrap.
- [ ] Existing active Inbox is preserved and not duplicated.
- [ ] A soft-deleted non-Inbox default category produces a new active category with the default name while the deleted row remains unchanged.
- [ ] A historical soft-deleted Inbox does not satisfy the Inbox invariant; a new active Inbox is created and the deleted row remains unchanged.
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

- REVIEW RESULT: PASS
- Reviewed by: Task Review window
- Reviewed at: 2026-07-11 17:08 +08:00
- Result: task is ready for Git Snapshot.
- Blocking Issues: None.

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: ecae463403ac98a19ad30b2d85e5c58c63d144b0
- Snapshot Commit Created: Yes
- Snapshot Commit: a395f37235c7c28155f69da8866e0ebe4d1763d2
- Reason: approved TASK-006 readiness documents required a durable pre-Coding baseline.

## Coding Result

### Modified Files

- `backend/app/scripts/bootstrap_users.py`
- `backend/app/services/default_categories.py`
- `backend/tests/test_default_category_seeding.py`
- `handoff/current-task.md`
- `tasks/TASK-006-default-category-seeding.md`

### Implementation Summary

- Added default Todo category seeding helper with the Phase 1A default categories: Inbox, Work, Study, Life, Partner, Pet, Health, Interest, AI, Project.
- Updated bootstrap to create missing users, flush them, seed/backfill default categories for all users, and commit in one transaction.
- Kept existing user tokens private: reruns return/print only `already exists; token was not rotated`.
- Inbox seeding uses active `is_inbox = true` as the invariant, so an existing active Inbox is preserved and no second Inbox is created.
- If multiple historical active Inbox rows exist, bootstrap keeps the deterministic first row by `sort_order ASC, created_at ASC, id ASC` and demotes the remaining active Inbox rows to normal active categories.
- If an active category named `Inbox` exists but is not marked as Inbox, bootstrap promotes that active row to `is_inbox = true` instead of creating a duplicate name.
- Only active categories count as present. Soft-deleted default rows are preserved and a new active default row is created.
- No Todo endpoints were implemented.

### Acceptance Criteria Results

- [x] New user bootstrap creates both users and all default categories for each user.
- [x] Rerunning bootstrap does not duplicate users or categories.
- [x] Existing users missing default categories are backfilled.
- [x] Each user has exactly one active Inbox after bootstrap.
- [x] Existing active Inbox is preserved and not duplicated.
- [x] Multiple historical active Inbox rows are normalized to one deterministic active Inbox.
- [x] A soft-deleted non-Inbox default category produces a new active category with the default name while the deleted row remains unchanged.
- [x] A historical soft-deleted Inbox does not satisfy the Inbox invariant; a new active Inbox is created and the deleted row remains unchanged.
- [x] Backend tests cover the above behavior.

### Verification Commands and Results

- Command: `python -m pytest tests/test_default_category_seeding.py`
  - Working directory: `D:\LifeOS\backend`
  - Result: 9 passed
  - Warnings: none
- Command: `python -m pytest`
  - Working directory: `D:\LifeOS\backend`
  - Result: 38 passed
  - Warnings: none

### Git Diff Check

- Command: `git status --short --untracked-files=all`
- Command: `git diff --stat`
- Command: `git diff`
- Command: `git diff --check`
- Command: `git diff --cached`
- Result: PASS. Diff is limited to TASK-006 implementation files plus approved workflow state files. No staged changes. `git diff --check` passed with only CRLF conversion warnings from Git. No generated artifacts, secrets, `.env`, local databases, cache files, or debug code found.

### Unresolved Issues

None.

### Task-Outside Findings

None.

### Changes Requested Fixes

- `CR-TASK-006-001`: Fixed. Bootstrap now handles multiple historical active Inbox rows deterministically by keeping the first row ordered by `sort_order ASC, created_at ASC, id ASC` and demoting the remaining active Inbox rows to normal active categories.
- Added regression coverage: `test_multiple_active_inboxes_are_normalized_to_one_deterministic_inbox`.
- Re-ran `python -m pytest tests/test_default_category_seeding.py`: 9 passed.
- Re-ran `python -m pytest`: 38 passed.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-07-11 18:34 +08:00
- Branch: main
- HEAD: `a395f37235c7c28155f69da8866e0ebe4d1763d2`
- Snapshot Commit: `a395f37235c7c28155f69da8866e0ebe4d1763d2`
- Reviewed Scope:
  - `backend/app/scripts/bootstrap_users.py`
  - `backend/app/services/default_categories.py`
  - `backend/tests/test_default_category_seeding.py`
  - `handoff/current-task.md`
  - `handoff/git-snapshot.md`
  - `handoff/project-state.md`
  - `tasks/TASK-006-default-category-seeding.md`
  - `handoff/code-review-gate.md`
  - `handoff/issue-log.md`
- Test Results:
  - `python -m pytest tests/test_default_category_seeding.py` in `D:\LifeOS\backend`: 9 passed.
  - `python -m pytest` in `D:\LifeOS\backend`: 38 passed.
- Git Diff Check:
  - `git diff --check`: passed with only Git CRLF conversion warnings.
  - `git diff --cached`: empty.
  - `git diff --cached --check`: passed.
- Blocking Issues: None.
- Verified Fix:
  - `CR-TASK-006-001` fixed. Review independently confirmed two active Inbox rows are normalized to exactly one active Inbox without crashing.

## Git Commit

- Result: PASS
- Result Commit: d1c0dbf66d3988aa246e30530cbaa6e934b5af9c
- Commit Message: feat(category): seed default Todo categories
- Push Target: origin/main

## Closure

Pending Decision closure check.

## Follow-up Tasks

None yet.
