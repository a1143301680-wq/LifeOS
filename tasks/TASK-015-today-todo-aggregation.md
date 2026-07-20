# TASK-015 Today Todo Aggregation API

## Metadata

- Task ID: TASK-015
- Task Name: Today Todo aggregation API
- Status: COMPLETED
- Priority: P1
- Parent Task: Phase 1A backend
- Dependencies: Todo APIs through `dd0d6fa`; TASK-014 terminal closure `0a5760a`

## Decision

Implement only `GET /api/v1/todos/today` as the next Phase 1A vertical slice. The endpoint owns timezone conversion, classification, de-duplication, ordering, and summary semantics so PC and Android clients consume one stable homepage aggregation.

## In Scope

- Required selected-date query in the authenticated user's timezone.
- Four mutually exclusive sections: overdue, due, planned, and inbox recent.
- Stable Todo DTOs, deterministic ordering, summary counts, category batching, isolation, and tests.

## Out Of Scope

- Reminder-derived content, pagination, writes, sync pull, SSE, and fanout.
- Frontend, Android, widgets, recurrence generation, and offline replay.
- Models/migrations unless Task Review proves an unavoidable prerequisite.

## Contract

- Route: `GET /api/v1/todos/today?date=YYYY-MM-DD`, registered before dynamic `/{todo_id}` GET routing.
- Build `[local midnight, next local midnight)` from `current_user.timezone`, including DST-safe calendar boundaries.
- Include only current-user, non-deleted, pending section items.
- Assign once in priority order: overdue, due, planned, inbox recent.
- Inbox recent uses the active owned Inbox, null planned/due fields, and the five newest eligible rows; the selected set is returned using standard section ordering.
- Standard order is priority high/medium/low, due null-last ASC, planned date null-last ASC, created ASC, id ASC.
- `pending_count` counts unique returned section items; `completed_count` counts non-deleted Todos completed inside the selected local day; `overdue_count` equals the overdue section length. Canceled rows do not count.
- Response always includes date, timezone, four section arrays, summary, and server time, with no pagination or Reminder section.
- Read has no idempotency, sync, event, or mutation side effects.

## Allowed Files

- `backend/app/api/v1/todos.py`
- `backend/app/schemas/todo.py` only when directly required
- One focused Today helper under `backend/app/services/`
- Focused Today tests under `backend/tests/`
- `docs/phase1a-progress.md`
- Active TASK-015 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- Models/migrations unless Task Review explicitly approves them
- Product contract documents
- Existing Todo/category behavior or collection-list semantics
- Sync, SSE, fanout, Reminder, recurrence, frontend, or Android behavior
- Completed TASK-005 through TASK-014 archives

## Acceptance Criteria

- [x] Envelope, authentication, required date validation, and static route precedence are correct.
- [x] Timezone/DST boundaries correctly classify due and completed timestamps.
- [x] Four sections follow membership rules, strict single assignment, and stable ordering without duplicate IDs.
- [x] Inbox recent uses the active owned Inbox, selects the newest five eligible rows, and then applies presentation ordering.
- [x] Summary counts match the locked semantics for pending/completed/overdue and exclude canceled/deleted/cross-user rows.
- [x] Todo DTO/category serialization is stable and category loading is batched.
- [x] No write side effect, Reminder section, pagination, migration, or out-of-scope endpoint is added.
- [x] Focused/full tests, Alembic head, route/query review, and whitespace checks pass.

## Verification Plan

- Focused Today tests covering validation, timezone/DST edges, classification, de-duplication, ordering, Inbox cap, summaries, DTO/category behavior, isolation, and no writes.
- Full backend pytest suite and Alembic-head check.
- Route-order, query/batch behavior, exact changed-file, and whitespace inspection.

## Risks

- Timezone boundary drift, especially on DST dates.
- Duplicate assignment across overlapping sections.
- Incorrect Inbox top-five selection versus presentation order.
- Static `/today` route shadowing and category N+1 queries.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-20 08:40 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: `0a5760adaee3907532e8ec028938d3658c494997`
- Snapshot Commit: `82eecbfb82c0d96543ca8a0dc50b5a81706b9344`
- Reason: approved TASK-015 readiness documents required a durable pre-Coding baseline

## Coding Result

### Modified Files

- `backend/app/api/v1/todos.py`
- `backend/app/services/todo_today.py`
- `backend/tests/test_todos_today.py`
- `handoff/current-task.md`
- `tasks/TASK-015-today-todo-aggregation.md`

Pre-existing TASK-015 state file preserved:

- `handoff/git-snapshot.md`

### Implementation Summary

- Added authenticated `GET /api/v1/todos/today` before dynamic `GET /api/v1/todos/{todo_id}`.
- Added `backend/app/services/todo_today.py` for user-timezone day bounds, section classification, section ordering, Inbox recent selection, and completed-count calculation.
- Uses `current_user.timezone` with `ZoneInfo` and constructs `[local midnight, next local midnight)` from calendar dates.
- Filters current-user, non-deleted Todos and classifies pending candidates once in strict order: `overdue`, `due`, `planned`, `inbox_recent`.
- `inbox_recent` uses the owned active Inbox, null `planned_date`, null `due_at`, newest five by `created_at DESC`, then presentation ordering.
- Applies section ordering by priority rank, due null-last ASC, planned-date null-last ASC, `created_at ASC`, and `id ASC`.
- Returns `data.date`, `data.timezone`, all four section arrays, `summary`, and `server_time`; no pagination or Reminder section.
- Batch-loads categories for returned section items and preserves existing active/deleted/missing category DTO behavior.
- Keeps the endpoint read-only: no Idempotency-Key requirement, mutation, sync change, idempotency record, or event fanout.

### Acceptance Criteria Results

- Envelope, authentication, required date validation, and static route precedence: covered.
- Asia/Shanghai and America/New_York DST local-day boundaries for due/completed timestamps: covered.
- Four-section membership, strict single assignment, de-duplication, and ordering: covered.
- Inbox recent active-Inbox ownership, top-five selection, and presentation ordering: covered.
- Summary counts for pending/completed/overdue with canceled/deleted/cross-user exclusions: covered.
- Stable Todo DTO/category behavior and batch category loading: covered.
- No write side effects, Reminder section, pagination, migration, or out-of-scope endpoint: covered.

### Verification Commands And Results

- `python -m pytest tests/test_todos_today.py`: PASS, 5 passed.
- `python -m pytest`: PASS, 88 passed.
- `python -m alembic heads`: PASS, single head `20260713_0004 (head)`.
- `rg -n '@router\.(get|post|patch|delete)|prefix="/todos"|today|sync|events|changes' backend/app/api/v1/todos.py`: PASS, `/today` is registered before `/{todo_id}` and no sync/SSE endpoint was added.
- `rg -n 'local_day_bounds|ZoneInfo|classify_today_todos|select_inbox_recent|completed_count_for_day|section_sort_key|status !=' backend/app/services/todo_today.py`: PASS, timezone boundary, section, Inbox, summary, and ordering helpers are present.
- `Select-String -Path D:\LifeOS\backend\tests\test_todos_today.py,D:\LifeOS\backend\app\services\todo_today.py -Pattern '[ \t]+$'`: PASS, no trailing whitespace in new untracked files.

### Git Diff Check

- `git status --short --untracked-files=all`: PASS, only TASK-015 implementation/state files plus pre-existing `handoff/git-snapshot.md` state diff are present.
- `git diff --stat`: PASS, reviewed focused route and state diffs; untracked helper/test files reviewed separately.
- `git diff --check`: PASS, no whitespace errors; Git reported expected LF-to-CRLF working-copy warnings.
- `git diff --cached`: PASS, empty.

### Unresolved Issues

None.

### Task-Outside Findings

None.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-07-20 08:53 +08:00
- Branch: main
- HEAD: `82eecbfb82c0d96543ca8a0dc50b5a81706b9344`
- Snapshot Commit: `82eecbfb82c0d96543ca8a0dc50b5a81706b9344`

### Reviewed Scope

- `backend/app/api/v1/todos.py`
- `backend/app/services/todo_today.py`
- `backend/tests/test_todos_today.py`
- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-015-today-todo-aggregation.md`

### Review Findings

- Blocking Issues: None.
- Non-blocking Suggestions: If user timezones become editable outside controlled seed/admin paths, add validation for invalid `users.timezone` values to avoid a 500 from `ZoneInfo`.
- Follow-up Tasks: After Git Commit publishes TASK-015, update Phase 1A progress so `GET /api/v1/todos/today` is marked done and the next task advances to `GET /api/v1/sync/changes`.

### Review Evidence

- Current task and TASK archive both identify `TASK-015` and remain `Status: REVIEWING`.
- Task Review gate is `Result: PASS`.
- Git Snapshot is `Status: COMPLETE` with snapshot commit `82eecbfb82c0d96543ca8a0dc50b5a81706b9344`.
- Code Review gate was `PENDING` before review and is now `PASS`.
- Implementation matches the approved `GET /api/v1/todos/today` scope.
- `/today` is registered before dynamic `/{todo_id}` routing.
- Today aggregation uses `current_user.timezone`, calendar-date local day bounds, current-user active Todo filtering, pending-only section candidates, strict section assignment, and deterministic ordering.
- Inbox recent uses the owned active Inbox, null planned/due fields, newest-five selection, and presentation ordering.
- Summary counts match the locked TASK-015 semantics for pending, completed, and overdue.
- Category summaries are batch-loaded and preserve active, soft-deleted, and missing category behavior.
- No Todo/category write, detail, lifecycle, collection-list, sync pull, SSE, fanout, Reminder, recurrence, frontend, Android, model, or migration change was added.

### Verification

- `python -m pytest tests/test_todos_today.py` from `D:\LifeOS\backend`: PASS, 5 passed.
- `python -m pytest` from `D:\LifeOS\backend`: PASS, 88 passed.
- `python -m alembic heads` from `D:\LifeOS\backend`: PASS, `20260713_0004 (head)`.
- `git diff --check`: PASS, no whitespace errors; Git reported expected LF-to-CRLF working-copy warnings.
- `git diff --cached --check`: PASS, no staged changes.
- New untracked helper/test trailing-whitespace scan: PASS.

### Recommended Commit Message

`feat(todo): add today aggregation API`

## Git Commit

- Result: PASS
- Committed by: Git Commit window
- Committed at: 2026-07-20
- Branch: main
- Result Commit: 2a698f37028e1f8ebb0c8ededcfb5305c4c9a085
- Commit Message: `feat(todo): add today aggregation API`
- Push Target: origin/main
- Code Review Result: PASS
- Completion Record: this Git Commit completion metadata commit

## Closure

Closure Check: PASS

- Checked At: 2026-07-20 09:19 +08:00
- Result Commit: `2a698f37028e1f8ebb0c8ededcfb5305c4c9a085`
- Completion Commit: `876ba753a3ce91cee9b6a9f9fd90ea9da556764c`
- Remote Verification: local `main`, `origin/main`, and remote `refs/heads/main` all matched `876ba753a3ce91cee9b6a9f9fd90ea9da556764c`.
- Working Tree Before Closure Docs: clean.
- Review Evidence: Code Review `PASS`; no blocking issue remained.
- Test Evidence: Decision reran focused Today tests (`5 passed`), the full backend suite (`88 passed`), and Alembic heads (`20260713_0004 (head)`) on the published completion state.
- Acceptance Criteria Result: all TASK-015 acceptance criteria confirmed.
- Issue Disposition: no TASK-015 issue-log entry or unresolved blocking issue exists. Invalid stored user-timezone validation remains a non-blocking future hardening item if timezone editing is introduced.
- Phase/Progress Result: `GET /api/v1/todos/today` is recorded as done; the next Phase 1A business direction is `GET /api/v1/sync/changes`.
- Remaining Follow-ups:
  - Validate stored timezone identifiers if user timezones become editable outside controlled seed/admin paths.
  - Continue with `GET /api/v1/sync/changes` after the terminal Closure Commit.

Terminal Closure Commit approval:

- Approved files:
  - `handoff/current-task.md`
  - `handoff/project-state.md`
  - `tasks/TASK-015-today-todo-aggregation.md`
- Commit message: `docs(task): close TASK-015`
- This commit is terminal and must not trigger another Closure Check or create new state files.
