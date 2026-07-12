# LifeOS Issue Log

Last updated: 2026-07-11

Use this file for review findings, bugs, missing tests, follow-ups, and small process issues that should not be lost between AI windows.

## Status Values

- `open`
- `in_progress`
- `fixed_pending_review`
- `verified`
- `deferred`
- `wont_fix`

## Severity Values

- `P0`: blocks correctness, data safety, security, or release.
- `P1`: serious functional or contract issue.
- `P2`: important but not immediately blocking.
- `P3`: cleanup, clarity, or low-risk follow-up.

## Issues

### ISSUE-20260711-005: TASK-006 bootstrap must handle multiple active Inbox rows

- Status: verified
- Severity: P1
- Found by: Code Review window
- Found at: 2026-07-11 17:40 +08:00
- Related task: TASK-006 Default Todo category seeding and Inbox invariant
- Files:
  - `D:\LifeOS\backend\app\services\default_categories.py:32`
  - `D:\LifeOS\backend\app\services\default_categories.py:39`
  - `D:\LifeOS\backend\app\services\default_categories.py:54`
- Description: `get_active_inbox()` uses `scalar_one_or_none()` for active `is_inbox = true` rows. If historical data already contains two active Inbox-flagged categories for the same user, bootstrap raises `MultipleResultsFound`.
- Impact: TASK-006 is supposed to ensure each seeded user has exactly one active Inbox before Todo creation begins. In this abnormal but relevant historical data state, bootstrap neither repairs the invariant nor fails with a controlled domain-specific result.
- Expected: Bootstrap should deterministically handle multiple active Inbox rows according to an approved rule, or explicitly return to Decision if changing user category semantics is not safe.
- Actual: Fixed by Coding window. Bootstrap now loads active Inbox rows deterministically, keeps the first row by `sort_order ASC, created_at ASC, id ASC`, demotes remaining active Inbox rows to normal active categories, and continues seeding.
- Fix owner/window: Coding window, unless repair semantics need Decision approval.
- Fix notes: Replace the cardinality assumption with logic that loads all active Inbox rows, define deterministic handling, and add focused regression coverage. Re-run `python -m pytest tests/test_default_category_seeding.py` and `python -m pytest`.
- Verification: Verified by Code Review window on 2026-07-11. Reviewed `normalize_active_inboxes()`, regression test `test_multiple_active_inboxes_are_normalized_to_one_deterministic_inbox`, and ran an independent probe with two active Inbox rows. `python -m pytest tests/test_default_category_seeding.py` passed with 9 tests; `python -m pytest` passed with 38 tests.

### ISSUE-20260711-004: Reject null PATCH fields for Todo Category update

- Status: verified
- Severity: P1
- Found by: Review window
- Found at: 2026-07-11 13:34 +08:00
- Related task: Phase 1A Todo Category update/delete endpoints
- Files:
  - `D:\LifeOS\backend\app\schemas\todo_category.py:16`
  - `D:\LifeOS\backend\app\api\v1\todo_categories.py:180`
  - `D:\LifeOS\backend\app\api\v1\todo_categories.py:190`
- Description: `TodoCategoryUpdate` accepts explicit `null` values for `name` and `sort_order`, but the endpoint treats them as update values. `{"name": null}` calls `.strip()` on `None`; `{"sort_order": null}` assigns `None` to a non-null database column.
- Expected: Invalid explicit null update fields should return `400 validation_error`.
- Actual: Fixed by coding window. Explicit `{"name": null}` and `{"sort_order": null}` now return `400 validation_error`; `{"color": null, "icon": null}` remains valid and clears optional display fields.
- Fix owner/window: Coding window.
- Fix notes: Make nullable update semantics explicit. For this API, reject `null` for `name` and `sort_order` when present, and add regression tests for both cases. Keep `color` and `icon` nullable only if clearing those display fields is intended.
- Verification: Verified by Review window on 2026-07-11. Reviewed `TodoCategoryUpdate` null-field validator, `jsonable_encoder(exc.errors())` validation error handling, and regression tests. `python -m pytest` passed with 29 tests; `python -m alembic current` and `python -m alembic heads` both reported `20260711_0003 (head)`.

### ISSUE-20260711-001: Verify sync cursor sequence on PostgreSQL

- Status: verified
- Severity: P3
- Found by: Review window
- Found at: 2026-07-11 01:57 +08:00
- Related task: Phase 1A backend foundation sync cursor allocation fix
- Files:
  - `D:\LifeOS\backend\app\services\sync.py:13`
  - `D:\LifeOS\backend\alembic\versions\20260710_0001_phase1a_backend_foundation.py:21`
- Description: The sync cursor allocation fix adds PostgreSQL sequence-backed allocation through `sync_changes_cursor_seq`, with SQLite fallback test coverage.
- Expected: A live PostgreSQL migration and insert path should confirm that `nextval('sync_changes_cursor_seq')` allocates global monotonic cursors and that `sync_changes.cursor` remains unique.
- Actual: Verified against local PostgreSQL on 2026-07-11. Connection to `lifeos/lifeos@localhost:5432/lifeos` succeeded. `python -m alembic upgrade head` reached `20260711_0002`; `sync_changes_cursor_seq` exists; `sync_changes.cursor` defaults to `nextval('sync_changes_cursor_seq'::regclass)`; two real `create_sync_change()` writes allocated monotonic cursors `3` and `4`.
- Fix owner/window: Coding window or Git/verification window when PostgreSQL is available.
- Fix notes: Run `python -m alembic upgrade head` against PostgreSQL, create two sync changes through `create_sync_change()`, and verify cursor values increase monotonically.
- Verification: Verified by coding window and review window. Review independently ran `python -m pytest` with 10 passed, `python -m alembic current` showing `20260711_0002 (head)` with `PostgresqlImpl`, and direct SQL checks confirming sequence/default state plus cleanup of `verify.%` sync rows and `issue-%` users.

### ISSUE-20260711-002: Add database-level active category name uniqueness

- Status: verified
- Severity: P2
- Found by: Review window
- Found at: 2026-07-11 09:13 +08:00
- Related task: Phase 1A Todo Category list/create foundation
- Files:
  - `D:\LifeOS\backend\app\api\v1\todo_categories.py:41`
  - `D:\LifeOS\backend\alembic\versions\20260711_0002_add_todo_categories.py:21`
- Description: Category create checks active duplicate names in application code, but the `todo_categories` migration does not enforce uniqueness at the database level.
- Expected: Active category names should remain unique per user even under concurrent requests.
- Actual: Fixed in coding window by adding migration `20260711_0003_add_active_category_name_unique_index.py` and model metadata for `uq_todo_categories_user_active_name`, a unique partial index on `(user_id, name)` where `deleted_at IS NULL`.
- Fix owner/window: Coding window.
- Fix notes: Add a PostgreSQL partial unique index on `(user_id, name)` where `deleted_at IS NULL`, or explicitly defer and document best-effort uniqueness for this phase.
- Verification: Verified by Review window on 2026-07-11. `python -m pytest` passed with 13 tests. PostgreSQL is at `20260711_0003 (head)`. Direct PostgreSQL checks confirmed index definition as `CREATE UNIQUE INDEX uq_todo_categories_user_active_name ON public.todo_categories USING btree (user_id, name) WHERE (deleted_at IS NULL)`, active duplicate insert raises an integrity violation, and soft-deleted name reuse succeeds.

### ISSUE-20260711-003: Keep current task handoff status in sync

- Status: verified
- Severity: P3
- Found by: Review window
- Found at: 2026-07-11 09:13 +08:00
- Related task: Phase 1A Todo Category list/create foundation
- Files:
  - `D:\LifeOS\handoff\current-task.md:7`
- Description: The coding window reported the category slice as complete and ready for review, but `current-task.md` still says `Status: not_started`.
- Expected: Shared handoff state should reflect the actual workflow state, such as `ready_for_review` before review or `ready_for_git` after a passing review.
- Actual: The task file now shows `Status: published`, with commit `52a701f`, remote `origin`, branch `main`, and push target recorded.
- Fix owner/window: Coding window or Git window after publishing.
- Fix notes: Update `handoff/current-task.md` as part of the next workflow state transition.
- Verification: Verified by review window on 2026-07-11.

## Entry Template

```text
### ISSUE-YYYYMMDD-001: Short title

- Status: open
- Severity: P2
- Found by: Review window
- Found at: YYYY-MM-DD HH:mm timezone
- Related task: link or short task name
- Files: path:line if available
- Description:
- Expected:
- Actual:
- Fix owner/window:
- Fix notes:
- Verification:
```
