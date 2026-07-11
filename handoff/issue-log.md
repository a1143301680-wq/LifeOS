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

### ISSUE-20260711-001: Verify sync cursor sequence on PostgreSQL

- Status: open
- Severity: P3
- Found by: Review window
- Found at: 2026-07-11 01:57 +08:00
- Related task: Phase 1A backend foundation sync cursor allocation fix
- Files:
  - `D:\LifeOS\backend\app\services\sync.py:13`
  - `D:\LifeOS\backend\alembic\versions\20260710_0001_phase1a_backend_foundation.py:21`
- Description: The sync cursor allocation fix adds PostgreSQL sequence-backed allocation through `sync_changes_cursor_seq`, with SQLite fallback test coverage.
- Expected: A live PostgreSQL migration and insert path should confirm that `nextval('sync_changes_cursor_seq')` allocates global monotonic cursors and that `sync_changes.cursor` remains unique.
- Actual: Review verified the code, migration, Alembic head, and SQLite fallback test, but did not run against a configured PostgreSQL database.
- Fix owner/window: Coding window or Git/verification window when PostgreSQL is available.
- Fix notes: Run `python -m alembic upgrade head` against PostgreSQL, create two sync changes through `create_sync_change()`, and verify cursor values increase monotonically.
- Verification: Pending PostgreSQL-backed verification.

### ISSUE-20260711-002: Add database-level active category name uniqueness

- Status: open
- Severity: P2
- Found by: Review window
- Found at: 2026-07-11 09:13 +08:00
- Related task: Phase 1A Todo Category list/create foundation
- Files:
  - `D:\LifeOS\backend\app\api\v1\todo_categories.py:41`
  - `D:\LifeOS\backend\alembic\versions\20260711_0002_add_todo_categories.py:21`
- Description: Category create checks active duplicate names in application code, but the `todo_categories` migration does not enforce uniqueness at the database level.
- Expected: Active category names should remain unique per user even under concurrent requests.
- Actual: Concurrent requests can both pass `ensure_unique_active_name()` before either insert commits, allowing duplicate active names.
- Fix owner/window: Coding window.
- Fix notes: Add a PostgreSQL partial unique index on `(user_id, name)` where `deleted_at IS NULL`, or explicitly defer and document best-effort uniqueness for this phase.
- Verification: Pending.

### ISSUE-20260711-003: Keep current task handoff status in sync

- Status: open
- Severity: P3
- Found by: Review window
- Found at: 2026-07-11 09:13 +08:00
- Related task: Phase 1A Todo Category list/create foundation
- Files:
  - `D:\LifeOS\handoff\current-task.md:7`
- Description: The coding window reported the category slice as complete and ready for review, but `current-task.md` still says `Status: not_started`.
- Expected: Shared handoff state should reflect the actual workflow state, such as `ready_for_review` before review or `ready_for_git` after a passing review.
- Actual: The task file has stale status.
- Fix owner/window: Coding window or Git window after publishing.
- Fix notes: Update `handoff/current-task.md` as part of the next workflow state transition.
- Verification: Pending.

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
