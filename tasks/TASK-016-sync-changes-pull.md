# TASK-016 Sync Changes Pull API

## Metadata

- Task ID: TASK-016
- Task Name: Sync changes pull API
- Status: COMPLETED
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: durable sync writes and cursor allocator; TASK-015 terminal closure `f562773`

## Decision

Implement only `GET /api/v1/sync/changes` as the next Phase 1A slice. Durable pull recovery must be complete before the SSE wake-up endpoint can provide useful reconnect behavior.

## In Scope

- Authenticated current-user sync pull with cursor and limit.
- Captured global high-water boundary, user-specific paging, and gap-safe cursor advancement.
- Stored snapshot/tombstone payload serialization and focused tests.

## Out Of Scope

- SSE, fanout, new write-side events, payload rewrites, client cache application, offline replay, conflicts, and retention.
- Models/migrations unless Task Review proves an unavoidable prerequisite.
- Frontend, Android, Reminder, recurrence, and unrelated APIs.

## Contract

- Route: `GET /api/v1/sync/changes?cursor=0&limit=100`.
- Cursor defaults to 0 and must be non-negative; limit defaults to 100 and supports 1 through 500.
- Capture the global max cursor at request start; reject a cursor beyond it.
- Query current-user rows in `(requested_cursor, captured_high_water]`, ordered by cursor ASC, with limit-plus-one.
- If more current-user rows exist, `next_cursor` is the last returned cursor and `has_more=true`; otherwise `next_cursor` is the captured global high water and `has_more=false`.
- Empty/current-user-empty responses still advance to the global high water; other-user cursor gaps are valid.
- Emit metadata plus stored top-level `snapshot` or tombstone fields; never expose `user_id`, internal row ID, or raw payload.
- The endpoint is read-only and returns top-level items, next cursor, has-more flag, and server time.

## Allowed Files

- `backend/app/api/v1/router.py`
- One focused sync API module under `backend/app/api/v1/`
- `backend/app/services/sync.py` only when directly required
- One focused sync schema only when directly required
- Focused sync pull tests under `backend/tests/`
- `docs/phase1a-progress.md`
- Active TASK-016 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- Models, cursor sequence, and migrations unless Task Review explicitly approves them
- Existing persisted payloads or Todo/category writes
- SSE/fanout, product contract documents, frontend, and Android
- Completed TASK-005 through TASK-015 archives

## Acceptance Criteria

- [x] Contracted envelope, defaults, validation, and authentication are correct.
- [x] Current-user isolation, ascending order, and valid global cursor gaps are proven.
- [x] Empty, intermediate, and terminal pages use the locked high-water/next-cursor semantics.
- [x] Multi-page traversal has no duplicate or skipped current-user changes.
- [x] Snapshot and tombstone payloads are exact and internal fields are excluded.
- [x] Changes after captured high water remain available later.
- [x] Endpoint causes no writes or cursor allocation.
- [x] Focused/full tests, Alembic head, route/query review, and whitespace checks pass without migration or SSE changes.

## Verification Plan

- Focused sync pull tests for validation, auth, isolation/gaps, paging/high water, payload variants, nullable metadata, races, and no writes.
- Full backend pytest suite and Alembic-head check.
- Route, SQLAlchemy query, exact changed-file, and whitespace inspection.

## Risks

- Gap handling and moving-high-water races.
- Off-by-one pagination errors.
- Historical payload reconstruction or internal-field leakage.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-21 09:53 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: `f562773316251f43d5eb9ba704f361eb6f25dc24`
- Snapshot Commit: `fdd615855d3f00b7ce085eee0624c1e27e37d53a`
- Reason: approved TASK-016 readiness documents required a durable pre-Coding baseline

## Coding Result

Result: PASS

Modified Files:

- `backend/app/api/v1/router.py`
- `backend/app/api/v1/sync.py`
- `backend/app/services/sync.py`
- `backend/tests/test_sync_changes_pull.py`
- `handoff/current-task.md`
- `tasks/TASK-016-sync-changes-pull.md`

Implementation Summary:

- Added authenticated `GET /api/v1/sync/changes` under `/api/v1`.
- Added query validation through FastAPI constraints: `cursor` defaults to 0 and must be non-negative; `limit` defaults to 100 and must be 1 through 500.
- Added reusable sync pull helpers that capture global high water, reject future cursors, query only current-user rows with `cursor > requested` and `cursor <= high_water`, order by cursor ASC, and fetch `limit + 1`.
- Implemented cursor advancement semantics: intermediate pages return the last returned current-user cursor with `has_more=true`; terminal and empty pages advance to captured global high water with `has_more=false`.
- Serialized sync rows as response items with metadata plus stored top-level payload fields, excluding internal row id, user id, created timestamp, and raw payload.
- Kept the endpoint read-only: no idempotency requirement, cursor allocation, sync write, row mutation, or SSE/fanout behavior.

Acceptance Criteria Results:

- PASS: default authenticated request returns the contracted top-level envelope and ascending current-user changes after cursor 0.
- PASS: another user's rows create valid global gaps and do not leak into the current user's response.
- PASS: empty database and no-current-user-result cases return empty items, `has_more=false`, and captured high-water cursor.
- PASS: limit-plus-one paging covers all current-user changes exactly once across pages, including changed page sizes.
- PASS: invalid query values, malformed values, and future cursor return `400 validation_error`; missing or bad auth returns existing unauthorized envelope.
- PASS: snapshot and tombstone payloads are emitted at item top level exactly as stored, with nullable entity metadata supported and internal fields excluded.
- PASS: rows beyond captured high water are excluded from that page and remain discoverable on a later request.
- PASS: endpoint causes no writes or cursor allocation.

Verification Commands and Results:

- `cd D:\LifeOS\backend; python -m pytest tests/test_sync_changes_pull.py` -> PASS, 6 passed.
- `cd D:\LifeOS\backend; python -m pytest` -> PASS, 94 passed.
- `cd D:\LifeOS\backend; python -m alembic heads` -> PASS, one head: `20260713_0004 (head)`.
- `rg -n "include_router|sync_router|/changes|APIRouter|pull_sync_changes|SSE|events" D:\LifeOS\backend\app\api\v1\router.py D:\LifeOS\backend\app\api\v1\sync.py` -> PASS, only sync router and `/changes` route found; no SSE/events route added.
- `rg -n "get_latest_cursor|pull_sync_changes|sync_change_to_dict|cursor <= high_water|limit \+ 1|order_by|payload" D:\LifeOS\backend\app\services\sync.py` -> PASS, query boundary and serialization points inspected.
- `Select-String -Path D:\LifeOS\backend\tests\test_sync_changes_pull.py,D:\LifeOS\backend\app\api\v1\sync.py -Pattern '[ \t]+$'` -> PASS, no trailing whitespace in new files.

Git Diff Check:

- `git diff --check` -> PASS with Git LF-to-CRLF working-copy warnings only.
- `git diff --cached` -> PASS, no staged changes.
- Changed files are limited to TASK-016 allowed backend files and active workflow state files.
- No model, migration, SSE, frontend, Android, product-contract, secret, local database, cache, generated artifact, or debug-code changes.
- Pre-existing workflow state changes in `handoff/current-task.md`, `handoff/git-snapshot.md`, and `tasks/TASK-016-sync-changes-pull.md` were preserved and extended only for TASK-016 status/result publication.

Unresolved Issues:

- None.

Task-Outside Findings:

- None.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-07-21 10:27 +08:00
- Branch: main
- HEAD: `fdd615855d3f00b7ce085eee0624c1e27e37d53a`
- Snapshot Commit: `fdd615855d3f00b7ce085eee0624c1e27e37d53a`

### Reviewed Scope

- `backend/app/api/v1/router.py`
- `backend/app/api/v1/sync.py`
- `backend/app/services/sync.py`
- `backend/tests/test_sync_changes_pull.py`
- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-016-sync-changes-pull.md`

### Review Findings

- Blocking Issues: None.
- Non-blocking Suggestions: Consider adding a future hardening test that stored payload keys cannot override response metadata keys such as `cursor` or `entity_type` if future writers introduce new payload shapes.
- Follow-up Tasks: After Git Commit publishes TASK-016, update Phase 1A progress so `GET /api/v1/sync/changes` is marked done and the next task advances to `GET /api/v1/sync/events`.

### Review Evidence

- Current task and TASK archive both identify `TASK-016` and remain `Status: REVIEWING`.
- Task Review gate is `Result: PASS`.
- Git Snapshot is `Status: COMPLETE` with snapshot commit `fdd615855d3f00b7ce085eee0624c1e27e37d53a`.
- Code Review gate was `PENDING` before review and is now `PASS`.
- Implementation matches the approved `GET /api/v1/sync/changes` scope.
- Pull logic captures the global high water, rejects future cursors, filters current-user rows in `(cursor, high_water]`, orders by `cursor ASC`, and uses `limit + 1`.
- Intermediate pages set `has_more=true` and `next_cursor` to the last returned current-user cursor; terminal and empty pages set `has_more=false` and advance to captured global high water.
- Serialization emits metadata plus stored payload fields without refetching live Todo/category entities.
- The endpoint has no Idempotency-Key requirement and performs no cursor allocation, sync write, row mutation, idempotency write, SSE route, event fanout, model change, or migration.

### Verification

- `python -m pytest tests/test_sync_changes_pull.py` from `D:\LifeOS\backend`: PASS, 6 passed.
- `python -m pytest` from `D:\LifeOS\backend`: PASS, 94 passed.
- `python -m alembic heads` from `D:\LifeOS\backend`: PASS, `20260713_0004 (head)`.
- `git diff --check`: PASS, no whitespace errors; Git reported expected LF-to-CRLF working-copy warnings.
- `git diff --cached --check`: PASS, no staged changes.
- New untracked API/test trailing-whitespace scan: PASS.
- Route scan confirmed no `/sync/events`, SSE, or `sync.available` endpoint was added.

### Recommended Commit Message

`feat(sync): add changes pull API`

## Git Commit

- Result: PASS
- Committed by: Git Commit window
- Committed at: 2026-07-21
- Branch: main
- Result Commit: f6f90912c7ebead4a27d4a6571cc473317f7895f
- Commit Message: `feat(sync): add changes pull API`
- Push Target: origin/main
- Code Review Result: PASS
- Completion Record: this Git Commit completion metadata commit

## Closure

Closure Check: PENDING
