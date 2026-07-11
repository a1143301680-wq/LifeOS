# LifeOS Current Task

Last updated: 2026-07-11

## Task Status

Status: not_started

Allowed values:

- `not_started`
- `in_progress`
- `ready_for_review`
- `review_failed`
- `ready_for_git`
- `published`
- `blocked`

## Task Summary

Phase 1A backend next slice: add default Todo category seeding and Inbox invariant.

## Task Goal

- Update bootstrap/initialization so each user gets the default Todo categories.
- Required default categories: Inbox, Work, Study, Life, Partner, Pet, Health, Interest, AI, Project.
- Ensure exactly one active Inbox category per user.
- Make bootstrap idempotent: rerunning should not duplicate users or categories.
- Existing users without categories should receive missing default categories.
- Existing users with an active Inbox should not receive a second Inbox.
- Keep category-name uniqueness and soft-delete semantics intact.
- Add focused tests for new user bootstrap, rerun idempotency, missing-category backfill, and Inbox invariant.
- Do not implement Todo endpoints in this slice.

## Implementation Notes

Decision window assessment on 2026-07-11:

- Current backend has Phase 1A foundation and `GET /api/v1/me`.
- Todo Category list/create API foundation is published in commit `52a701f`.
- PostgreSQL sync cursor verification is published in commit `6eea5e8`.
- Active category name uniqueness is published in commit `eca0af8`.
- Todo Category update/delete endpoints are published in commit `83ac3eb`.
- Backend tests passed locally in the Decision window: 29 passed.
- `ISSUE-20260711-001` and `ISSUE-20260711-002` are verified.
- Added `docs/phase1a-progress.md` to make Phase 1A sequencing explicit.
- Category CRUD is complete enough to proceed.
- Next prerequisite before Todo create is default category seeding, because Todo create defaults to the user's Inbox when `category_id` is omitted.

## Verification Notes

Decision window ran backend tests on 2026-07-11:

- Command: `python -m pytest`
- Working directory: `D:\LifeOS\backend`
- Result: 29 passed

## Review Status

Not started for this new task. Review required after coding window completes default category seeding.

## Git Status

Do not commit/push this next slice until Review window updates `handoff/review-gate.md`.

## Next Step

Send this task to the Coding window. After coding, run the Review window and then the Git window only if review allows commit/push.
