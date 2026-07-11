# LifeOS Current Task

Last updated: 2026-07-11

## Task Status

Status: ready_for_git

Allowed values:

- `not_started`
- `in_progress`
- `ready_for_review`
- `review_failed`
- `ready_for_git`
- `published`
- `blocked`

## Task Summary

Phase 1A backend next slice: fix database-level active category name uniqueness.

## Task Goal

- Resolve `ISSUE-20260711-002`.
- Add a database-level uniqueness guard for active category names per user.
- Prefer a PostgreSQL partial unique index on `(user_id, name)` where `deleted_at IS NULL`.
- Keep soft-deleted categories reusable by name.
- Keep existing application-level validation for friendly errors.
- Add or update tests that prove duplicate active names are rejected and soft-deleted names can be reused.
- If SQLite test coverage cannot express the PostgreSQL partial-index behavior exactly, document the gap and add PostgreSQL verification if available.

## Implementation Notes

Decision window assessment on 2026-07-11:

- Current backend has Phase 1A foundation and `GET /api/v1/me`.
- Todo Category list/create API foundation is published in commit `52a701f`.
- PostgreSQL sync cursor verification is published in commit `6eea5e8`.
- Backend tests passed locally in the Decision window: 10 passed.
- `ISSUE-20260711-002` remains open as P2 and should be fixed before expanding category CRUD.
- Added `docs/phase1a-progress.md` to make Phase 1A sequencing explicit.

## Verification Notes

Decision window ran backend tests on 2026-07-11:

- Command: `python -m pytest`
- Working directory: `D:\LifeOS\backend`
- Result: 10 passed

Coding window ran verification on 2026-07-11:

- Command: `python -m pytest`
- Working directory: `D:\LifeOS\backend`
- Result: 13 passed
- Command: `python -m alembic upgrade head`
- Working directory: `D:\LifeOS\backend`
- Result: upgraded PostgreSQL from `20260711_0002` to `20260711_0003`
- PostgreSQL check: `uq_todo_categories_user_active_name` exists as a unique partial index on `(user_id, name) WHERE deleted_at IS NULL`; active duplicate insert raised `UniqueViolation`; soft-deleted name reuse succeeded.

## Review Status

Review completed. `handoff/review-gate.md` allows Git commit/push.

## Git Status

Ready for Git window commit/push.

## Next Step

Git window should commit and push this reviewed slice. After publishing, continue Todo Category update/delete endpoints or the next Phase 1A backend slice.
