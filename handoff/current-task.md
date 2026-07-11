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

Phase 1A backend next slice: finish Todo Category update/delete endpoints.

## Task Goal

- Implement `PATCH /api/v1/todo-categories/{id}`.
- Implement `DELETE /api/v1/todo-categories/{id}`.
- Keep bearer-token user isolation; clients must not send `user_id`.
- Require `Idempotency-Key` for both write endpoints.
- Reuse canonical request hashing and stored idempotency response replay.
- On update, allow only `name`, `color`, `icon`, and `sort_order`.
- Reject attempts to modify `is_inbox`, `user_id`, timestamps, or other system fields.
- Allow Inbox display fields to be updated, but never allow Inbox deletion or conversion.
- Prevent non-Inbox categories from becoming Inbox.
- Soft-delete non-Inbox categories by setting `deleted_at`; do not hard delete.
- Existing Todos should keep `category_id` later; no Todo implementation is required in this slice.
- Write `category.updated` and `category.deleted` sync changes through `create_sync_change()` in the same transaction.
- Add focused tests for update, delete, Inbox protection, cross-user isolation, idempotent replay, idempotency conflict, deleted category behavior, and duplicate active-name handling.

## Implementation Notes

Decision window assessment on 2026-07-11:

- Current backend has Phase 1A foundation and `GET /api/v1/me`.
- Todo Category list/create API foundation is published in commit `52a701f`.
- PostgreSQL sync cursor verification is published in commit `6eea5e8`.
- Active category name uniqueness is published in commit `eca0af8`.
- Backend tests passed locally in the Decision window: 13 passed.
- `ISSUE-20260711-001` and `ISSUE-20260711-002` are verified.
- Added `docs/phase1a-progress.md` to make Phase 1A sequencing explicit.
- Next progress step is to finish Todo Category CRUD before starting Todo endpoints.

## Verification Notes

Decision window ran backend tests on 2026-07-11:

- Command: `python -m pytest`
- Working directory: `D:\LifeOS\backend`
- Result: 13 passed

## Review Status

Not started for this new task. Review required after coding window completes update/delete endpoints.

## Git Status

Do not commit/push this next slice until Review window updates `handoff/review-gate.md`.

## Next Step

Send this task to the Coding window. After coding, run the Review window and then the Git window only if review allows commit/push.
