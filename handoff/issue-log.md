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

### ISSUE-20260713-001: TASK-007 standard flow must not skip Git Commit

- Status: verified
- Severity: P1
- Found by: Code Review window
- Found at: 2026-07-13 08:37 +08:00
- Related task: TASK-007 Workflow health and closure hardening
- Files:
  - `D:\LifeOS\docs\workflow.md:94`
  - `D:\LifeOS\docs\workflow.md:321`
- Description: The standard state transition diagram says `REVIEWING -> Code Review PASS -> COMPLETED`, while the detailed Code Review rule says Code Review PASS does not change task status to `COMPLETED`; Git Commit does that after publishing.
- Impact: Future windows may incorrectly mark a task completed immediately after Code Review, bypassing Git Commit publication.
- Expected: `COMPLETED` should be caused only by Git Commit success. Code Review PASS should authorize Git Commit, not complete the task.
- Actual: Fixed by Coding window. The standard state transition diagram now routes `REVIEWING -> Code Review PASS -> REVIEWING -> Git Commit publishes reviewed result -> COMPLETED`, and the Code Review section clarifies that `Target Status: COMPLETED` is the intended Git Commit outcome, not an immediate task-status update.
- Fix owner/window: Coding window.
- Fix notes: Rewrite the Standard Flow state diagram or transition labels so the route to `COMPLETED` is explicitly Git Commit success.
- Verification: Verified by Code Review window on 2026-07-13. `docs/workflow.md` now keeps task status at `REVIEWING` after Code Review PASS and moves to `COMPLETED` only after Git Commit publishes the reviewed result. `rg` checks for Code Review PASS and Git Commit success passed.

### ISSUE-20260713-002: TASK-007 Git Commit prompt needs a separate Closure Commit gate

- Status: verified
- Severity: P1
- Found by: Code Review window
- Found at: 2026-07-13 08:37 +08:00
- Related task: TASK-007 Workflow health and closure hardening
- Files:
  - `D:\LifeOS\handoff\git-commit-window-prompt.md:30`
  - `D:\LifeOS\handoff\git-commit-window-prompt.md:33`
  - `D:\LifeOS\handoff\git-commit-window-prompt.md:66`
- Description: The Git Commit prompt has a single gate requiring both task-status files to be `Status: REVIEWING`, but terminal Closure Commit is supposed to run after Decision Closure Check PASS, where both task-status files are already `COMPLETED`.
- Impact: Git Commit could be blocked from executing the terminal Closure Commit, making the closure flow non-executable despite being documented.
- Expected: Git Commit prompt should define separate gates for result commit mode and terminal Closure Commit mode.
- Actual: Fixed by Coding window. `handoff/git-commit-window-prompt.md` now has separate Result Commit and Terminal Closure Commit gates. Terminal Closure Commit mode requires Decision Closure Check PASS and both task-status files already at `COMPLETED`, and explicitly does not require `Status: REVIEWING`.
- Fix owner/window: Coding window.
- Fix notes: Split `handoff/git-commit-window-prompt.md` into Result Commit Gate and Terminal Closure Commit Gate. Terminal Closure Commit Gate should require Decision Closure Check PASS and exact approved doc scope, not `Status: REVIEWING`.
- Verification: Verified by Code Review window on 2026-07-13. `handoff/git-commit-window-prompt.md` now has separate Result Commit and Terminal Closure Commit gates. Terminal Closure Commit mode requires Decision Closure Check PASS and `Status: COMPLETED`, and explicitly does not require `Status: REVIEWING`.

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

### ISSUE-20260909-001: TASK-025 sync page accepts stale item cursors

- Status: verified
- Severity: P1
- Found by: Code Review window
- Found at: 2026-09-09 09:09 +08:00
- Related task: TASK-025 PC Web sync recovery and authenticated SSE refresh
- Files:
  - `D:\LifeOS\web\src\sync-engine.ts:121`
  - `D:\LifeOS\web\src\sync-engine.ts:128`
  - `D:\LifeOS\web\src\sync-engine.test.ts:113`
- Description: `validatePage()` checks that returned page items are strictly ordered relative to each other, but it does not reject returned changes whose `cursor` is less than or equal to the current local cursor used for the pull. It can then accept `next_cursor` and advance durable sync state.
- Expected: A `/sync/changes?cursor=<local_cursor>` page must contain only changes with `cursor > local_cursor`; malformed stale-item pages must throw before persistence, cache mutation, or cursor advancement.
- Actual: A page with stale items can be accepted if `next_cursor` is not backwards. Existing tests cover duplicate item cursors and backwards `next_cursor`, but not stale item cursors relative to `current.cursor`.
- Fix owner/window: Coding window.
- Fix notes: Add a page-level validation rule rejecting any item cursor `<= currentCursor`, plus regression coverage proving no persistence/advance/mutation. Preserve valid global gaps and empty high-water pages.
- Verification: Verified by Code Review on 2026-09-09. `validatePage()` rejects every returned item with `cursor <= currentCursor` before candidate state construction. Engine and coordinator regressions confirm no mutation, persistence, projection refresh, or cursor advancement. Focused tests passed 10/10; the full Web suite passed 107/107; build and 2 Playwright tests passed.

### ISSUE-20260909-002: Coding rework admission has no transition owner

- Status: verified
- Severity: P1
- Found by: Decision window
- Found at: 2026-09-09 10:12 +08:00
- Related task: TASK-026 Workflow Code Review rework admission ownership
- Files:
  - `D:\LifeOS\docs\workflow.md:104`
  - `D:\LifeOS\docs\workflow.md:324`
  - `D:\LifeOS\handoff\coding-window-prompt.md:34`
  - `D:\LifeOS\handoff\coding-window-prompt.md:66`
- Description: The workflow assigns `CHANGES_REQUESTED -> IN_PROGRESS` to Coding, but the Coding gate forbids modifying task files unless both records are already `IN_PROGRESS`. No role can legally perform the transition.
- Expected: Coding has an explicit, narrowly gated rework-admission path from synchronized `CHANGES_REQUESTED`, validates the matching review/baseline evidence, synchronizes both records to `IN_PROGRESS`, and then fixes only blocking findings.
- Actual: Coding must wait for an unspecified role to pre-move both records, creating a closed-loop deadlock.
- Fix owner/window: TASK-026 Coding window after Task Review PASS and Git Snapshot.
- Fix notes: Preserve the initial Coding gate; add a distinct rework gate, dual-file transition ownership, mismatch/partial-failure handling, retained review evidence, and no second Snapshot.
- Verification: Verified by Code Review on 2026-09-10. Workflow, Coding prompt, and Code Review prompt consistently assign guarded rework admission to Coding. An independent 16-case transition matrix passed; stale-rule, exact-scope, boundary-prompt, staged-state, and whitespace checks also passed.

### ISSUE-20260926-001: TASK-029 cursor-load cancellation is misclassified

- Status: verified
- Severity: P2
- Found by: Code Review window
- Found at: 2026-09-26 23:08 +08:00
- Related task: TASK-029 Android identity-scoped Room cache and durable sync pull foundation
- Files:
  - `D:\LifeOS\android\app\src\main\java\com\bpn0416\lifeos\SyncCoordinator.kt:75`
  - `D:\LifeOS\android\app\src\test\java\com\bpn0416\lifeos\SyncClientCoordinatorTest.kt:102`
- Description: `SyncCoordinator.sync()` catches every `Exception` thrown by `store.cursor(ownerId)` and returns `InvalidLocalState(0)`. JVM `CancellationException` extends `IllegalStateException`, so cancellation during initial cursor loading is consumed before the outer cancellation handler can return the typed cancellation outcome. Existing cancellation coverage starts in `SyncClient.fetch()` and does not exercise this path.
- Impact: Normal lifecycle or parent-task cancellation can be reported as corrupt local sync state. The future integration layer could choose invalid-cursor recovery instead of ordinary cancellation handling, and TASK-029's deterministic cancellation acceptance criterion is not met.
- Expected: Cancellation from the initial durable cursor read returns `SyncRunResult.Cancelled(0)` consistently with fetch/apply cancellation, and the per-owner lock is released for a later run.
- Actual: Fixed by Coding. Cursor-load `CancellationException` is rethrown before the general exception handler, reaches the outer typed cancellation boundary, returns `SyncRunResult.Cancelled(0)`, and the owner lock is released in `finally`.
- Fix owner/window: Coding window through guarded Code Review rework admission.
- Fix notes: Catch and rethrow `CancellationException` before the general cursor-read `Exception` handler, allowing the existing outer cancellation handler to produce `Cancelled(0)`. Add a focused regression test using a store whose `cursor()` throws `CancellationException`; also verify a subsequent same-owner run can proceed so lock release remains proven.
- Verification: Verified by Code Review on 2026-09-26. The focused cursor-load cancellation/lock-release regression passed independently. The full JVM suite passed 28/28, API 36 instrumentation passed 11/11, lint reported 0 errors, debug/release builds passed, and install/cold-launch/crash-buffer checks passed.

### CR-TASK-030-001: First DeepSeek Responses request uses an invalid input shape

- Status: withdrawn
- Severity: P1
- Found by: Code Review window from live-provider evidence
- Found at: 2026-09-27 09:53 +08:00
- Related task: TASK-030 PC AI Today planning agent with DeepSeek
- Files:
  - `D:\LifeOS\backend\app\services\ai_today_provider.py:152`
  - `D:\LifeOS\backend\tests\test_ai_today_plan.py:292`
- Description: Withdrawn initial diagnosis. Later evidence established that the first Responses request and context tool call succeed; the failure occurs during the second structured-response request and is tracked as `CR-TASK-030-002`.
- Impact: None from the alleged first-request shape. The earlier Code Review PASS remains withdrawn because later live findings `CR-TASK-030-002` and `CR-TASK-030-003` require rework and independent re-review.
- Expected: preserve the currently working first request and tool call.
- Actual: first request succeeds against DeepSeek.
- Fix owner/window: None; no Coding change is authorized by this withdrawn issue.
- Fix notes: do not change the first request to `input=[message]` on the basis of this finding.
- Verification: Withdrawn on 2026-09-27 10:02 +08:00 after corrected live evidence showed that the first request and context tool call succeeded. No `input=[message]` change is authorized by this finding.
- Later Decision (2026-10-09): after the object-shaped request returned HTTP 422 in a controlled check, the user explicitly authorized array input for TASK-030. This new decision does not retroactively reopen the withdrawn CR-001 diagnosis.

### CR-TASK-030-002: DeepSeek rejects UUID and date JSON Schema format constraints

- Status: verified
- Severity: P1
- Found by: Coding live-provider diagnosis, accepted into scope by Code Review
- Found at: 2026-09-27 10:02 +08:00
- Related task: TASK-030 PC AI Today planning agent with DeepSeek
- Files:
  - `D:\LifeOS\backend\app\services\ai_today_provider.py:37`
  - `D:\LifeOS\backend\app\services\ai_today_provider.py:52`
  - `D:\LifeOS\backend\app\services\ai_today_provider.py:69`
  - `D:\LifeOS\backend\app\services\ai_today_provider.py:72`
  - `D:\LifeOS\backend\tests\test_ai_today_plan.py`
- Description: the first DeepSeek context-tool round succeeds. The second structured-response request sends `PLAN_JSON_SCHEMA` containing `format: "uuid"` and `format: "date"`; DeepSeek currently rejects these unsupported constraints with HTTP 400. The backend correctly sanitizes the raw provider failure to `ai_provider_unavailable`, and the PC client displays its stable fallback message.
- Impact: the real AI Today flow cannot produce a final plan even though the tool boundary, sanitized error path, and deterministic fake-provider tests pass.
- Expected: the provider-facing schema omits these unsupported `format` keywords, while Pydantic `UUID`/`date` parsing and authenticated Todo/category reference validation continue to reject malformed or invented output.
- Actual: Coding removed the four unsupported `format` fields. Both DeepSeek rounds now complete; Pydantic malformed UUID/date rejection tests remain in place.
- Fix owner/window: Coding within the existing TASK-030 guarded rework.
- Fix notes: remove only the unsupported provider schema keywords. Do not weaken `AIProviderPlan`, duplicate/reference/category checks, sanitized errors, tool bounds, or explicit Todo confirmation. Add regression coverage for schema compatibility and malformed UUID/date rejection.
- Verification: Verified independently by Code Review on 2026-10-09. The outbound schema contains no `format`; malformed UUID/date outputs remain rejected; focused AI tests passed 22/22 and the full backend suite passed 123/123.

### CR-TASK-030-003: Provider instructions omit cross-list Todo-reference uniqueness

- Status: verified
- Severity: P1
- Found by: Coding live-page diagnosis, accepted into scope by Code Review
- Found at: 2026-09-28 11:15 +08:00
- Related task: TASK-030 PC AI Today planning agent with DeepSeek
- Files:
  - `D:\LifeOS\backend\app\services\ai_today_provider.py:89-91`
  - `D:\LifeOS\backend\tests\test_ai_today_plan.py`
- Description: after CR-002, both DeepSeek request rounds succeed. The model repeatedly returns the same Todo ID in `focus_items` and `risks` because `INSTRUCTIONS` does not state the task's cross-list uniqueness invariant. `AIProviderPlan.reject_duplicate_references()` correctly rejects the complete result.
- Impact: real planning remains operationally unusable even though provider transport and structured output now succeed; the PC page consistently displays its safe generic error.
- Expected: outbound instructions state that each Todo ID may appear at most once across both lists. If a risk concerns a Todo already used as a focus item, that risk must set `todo_id` to `null`.
- Actual: Coding added the cross-list uniqueness guidance and null-risk fallback to outbound provider instructions. The strict duplicate-reference rejection remains in place, with no silent repair, filtering, omission, rewrite, or autonomous retry.
- Fix owner/window: Coding within the existing TASK-030 guarded rework.
- Fix notes: clarify provider instructions and add an outbound-instructions regression. Keep duplicate-reference rejection and whole-response failure unchanged; do not add silent repair, filtering, omission, rewrite, or autonomous retry.
- Verification: Verified independently by Code Review on 2026-10-09. Both outbound calls contain the required instructions, strict duplicate rejection remains unchanged, focused checks passed 4/4, the AI file passed 22/22, and the full backend suite passed 123/123. Coding's bounded live PC-page evidence is retained without sensitive payloads.

### CR-TASK-030-004: Withdrawn first-request shape change remains in TASK-030

- Status: verified
- Severity: P1
- Found by: Code Review window
- Found at: 2026-10-09 19:20 +08:00
- Related task: TASK-030 PC AI Today planning agent with DeepSeek
- Files: `D:\LifeOS\backend\app\services\ai_today_provider.py:154`, `D:\LifeOS\backend\tests\test_ai_today_plan.py:418`
- Description: CR-001 is withdrawn and explicitly records that `input=[message]` is not authorized, but the implementation and a new regression test retain exactly that request shape.
- Impact: the worktree contradicts its approved rework boundary and durable provider diagnosis, so the final contract cannot be independently determined from repository evidence.
- Expected: restore the approved first-request shape, or obtain an explicit evidence-backed workflow decision authorizing the array shape before retaining it.
- Actual: Coding restored `input=self._request_message(selected_date)` and changed the SDK outbound regression to require a single message object. That object shape receives HTTP 422 from the current DeepSeek endpoint; the controlled PC-page call returned 503. A prior array-shaped live PC-page check passed, but that shape still requires a new durable authorization.
- Fix owner/window: Coding after guarded rework admission; route to Decision first if the request shape itself requires a new product/provider decision.
- Fix notes: preserve the verified CR-002/003 schema, instructions, strict validation, and no-retry behavior. Do not guess between conflicting live diagnoses.
- Verification: SDK object-shape regression, AI backend 22/22, full backend 123/123, Web 112/112, production build, and existing Playwright 2/2 passed. Controlled page call with object input returned 503; isolated object-shaped first request returned HTTP 422. Synthetic local data was removed. Decision must resolve the request shape before live PASS can be claimed.
- Decision Resolution (2026-10-09): the user explicitly authorized the array-shaped first request based on the new controlled HTTP 422 evidence. This is a new authorization and does not rewrite the historical withdrawal of CR-001. Coding may now restore array input, update its SDK regression, and repeat bounded live PC-page verification.
- Final Verification: verified independently by Code Review on 2026-10-09. The new Decision authorization, single-message array implementation, and real-SDK serialized request regression agree. AI backend passed 22/22, the full backend passed 123/123, Web passed 112/112, build and Playwright passed, and Coding's sanitized live PC-page PASS is retained.

### CR-TASK-030-005: TASK-030 progress evidence is stale and contradictory

- Status: verified
- Severity: P2
- Found by: Code Review window
- Found at: 2026-10-09 19:20 +08:00
- Related task: TASK-030 PC AI Today planning agent with DeepSeek
- Files: `D:\LifeOS\docs\phase1a-progress.md:71`, `D:\LifeOS\docs\phase1a-completion-audit.md:48`, `D:\LifeOS\tasks\TASK-030-pc-ai-today-planning-agent.md:84`
- Description: modified status documents still claim the live smoke was credential-limited and the backend suite had 118 tests, while the active task records a configured-key bounded live PASS and independent review now confirms 123 passing backend tests.
- Impact: publication would leave Decision and future review windows with mutually contradictory audit evidence.
- Expected: synchronize the three records with the final sanitized result and current test counts without recording credentials or provider-sensitive content.
- Actual: both modified Phase 1A documents and the task acceptance record now state the final authorized array shape, the controlled object-shape HTTP 422, the bounded live PC-page PASS, and the verified 123 backend / 112 Web test counts.
- Verification: verified independently by Code Review on 2026-10-09 against the final Decision record, current documents, full test output, and `git diff --check`.
- Fix owner/window: Coding through guarded rework admission.
- Fix notes: update evidence only; do not change product scope or claim additional verification.
- Final Verification: records are synchronized and contain no credential, model output, raw provider body, response ID, raw token, or real Todo content.

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
