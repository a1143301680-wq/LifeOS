# TASK-038: PC Project lifecycle

Last updated: 2026-11-20

## Metadata

- Task ID: TASK-038
- Task Name: PC Project lifecycle
- Status: COMPLETED
- Priority: P1
- Parent Task: PC V1 MVP completion / Project depth
- Dependencies: TASK-037 terminal Closure Commit `647f369741b6a1472f5ab6f6e465e3b1d01070ff`; Project and existing nested source APIs; migration 20261015_0010
- Contract: `docs/api-project-lifecycle.md` (approved by Task Review)

## Background

TASK-037 is terminally closed. Before this publication, main HEAD, origin/main and remote main matched its terminal commit and the worktree was clean. The terminal commit contains the exact five authorized documents. Project lifecycle is the next planned PC foundation before Notes, Calendar and acceptance.

## Goal

A PC user can archive a Project, find and restore it from Archived, or explicitly delete it after archiving. Project data is preserved according to the contract; linked Todos remain independent.

## In Scope

- Migration, lifecycle fields, active/archive list scopes, and shared deleted-parent boundary.
- Keyed archive/restore/soft-delete APIs, parent versions and transactional locking with existing child writes.
- PC list switching and detail commands, delete confirmation, canonical refresh, and Dashboard exclusion.
- Backend, disposable PostgreSQL, Web, desktop/narrow browser and existing feature regression evidence.
- Synchronize the roadmap and project state to record TASK-037 terminal closure; preserve its archive.

## Out Of Scope

- Physical delete, Trash/deleted restore, retention jobs, batch operations, changed Project business statuses, and any child/source mutation caused by lifecycle.
- Notes, Calendar, Android, new sync entities/events, AI provider/Agent/memory work, and user database deployment.
- Existing child public DTO changes, completed task archives, old migrations, dependencies and unrelated restructuring.

## Relevant Files

- `docs/api-project-lifecycle.md`: exact storage, read/write, dependent-record, concurrency, replay and UI policy.
- `docs/pc-delivery-plan.md`, Project sections of `docs/requirements.md`, `docs/mvp.md`, `docs/architecture.md`; existing stage/milestone/Todo-link/timeline contracts as needed.
- `backend/app/models/project.py`, `backend/app/schemas/project.py`, `backend/app/api/v1/projects.py`, `backend/app/services/project_stages.py`, `backend/app/api/v1/ai_sessions.py`, existing nested routes and idempotency service.
- `backend/alembic/versions/20261015_0010_add_project_logs.py`, Project/child and disposable PostgreSQL tests.
- `web/src/App.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/Dashboard.tsx`, `web/src/dashboard-selection.ts`, `web/src/styles.css`, current Project/Dashboard/child tests.
- Search issue-log.md for TASK-038 and deferred ISSUE-20261011-001; do not read full issue history by default.

## Allowed Files

- Project model/schema/API, the existing shared owned-Project helper in project_stages.py, and ai_sessions.py only for shared ownership/locking integration. New narrowly scoped lifecycle service if needed.
- New `backend/alembic/versions/20261109_0011_add_project_lifecycle.py`; new `backend/tests/test_project_lifecycle.py` and `backend/tests/test_project_lifecycle_migration.py`; focused Project/child regression and disposable fixture/head updates only.
- Web files listed under Relevant Files, new focused ProjectLifecycle component/test helpers if useful, `web/e2e/project-lifecycle.spec.ts`, and narrowly scoped existing fixtures or compatibility tests.
- `docs/api-project-lifecycle.md` implementation-status header only; contract changes return to Decision. `docs/pc-delivery-plan.md` verified progress and active role-owned TASK-038 workflow/gate/Git/issue state.

## Forbidden Files And Changes

- Android, older migrations, completed archives, stable requirements/architecture/Phase 1A contracts, dependency/lockfile churn, private fixtures or generated output.
- Editing Todo or other child data because of lifecycle, physically deleting Projects, or weakening owner isolation.
- Broad changes to existing source APIs, Project UI navigation, sync, timeline semantics, Dashboard ranking, AI prompts/providers, or local deployment.

## Implementation Requirements

1. Implement the lifecycle contract exactly. Keep lifecycle separate from business status and pin; no inferred child transitions or tombstone exposure.
2. Add migration 0011 from 0010. Preserve existing records and versions; verify upgrade/repeated-head and the documented downgrade visibility behavior on disposable PostgreSQL.
3. Reuse authenticated parent resolution and locking for lifecycle and existing child writes, including AI Sessions. Close the deleted-parent boundary consistently for all current child reads and fresh writes. Preserve exact idempotency replay and existing source contracts.
4. Add Active/Archived Project views and explicit lifecycle commands. Confirm Delete, refresh canonical destination data and guard pending requests across identity/Project/scope changes.
5. Keep archived Projects off Dashboard, even if pinned. Verify source Todos, other Project links, child data, sync cursors, and active Project behavior remain intact.
6. Run scoped and full regressions, desktop/narrow browser flows, and actual disposable PostgreSQL migration/API/concurrency tests. Distinguish browser stubs from real API evidence; do not migrate the configured user database.

## Acceptance Criteria

- [x] Existing Projects migrate as active without data/version/timestamp/sync changes; repeated head preserves state and downgrade visibility is verified.
- [x] Default and archived listings are owner-scoped and correctly ordered; archived detail/children remain usable and deleted Projects are excluded from all fresh parent/child requests.
- [x] Archive/restore/delete enforce exact payload, ownership, idempotency, no-op, transaction and version rules; active DELETE is rejected.
- [x] Soft-delete preserves all dependent rows and independent Todo/sync data; other Projects retain shared Todo references.
- [x] PostgreSQL concurrency verifies Project and child mutations ordered before/after deletion, including AI Session writes, with no post-delete mutation or lost parent increments.
- [x] PC Active/Archived, archive/restore, confirm/cancel delete, navigation/refresh errors and identity/Project/scope switching work without stale responses.
- [x] Pinned archived Projects are excluded from Dashboard; existing Project/stage/milestone/log/timeline/Todo/AI Session/prompt behavior and sync regressions pass.
- [x] Backend/Web/build, desktop/narrow browser, disposable PostgreSQL and exact Git/security/whitespace checks pass or explicitly disposition environmental limits for Code Review.

## Verification Plan

- API: active/archive scopes and ordering; invalid scope/auth/owner; action body/key errors; no-op/version/timestamps; replay/conflict; active DELETE rejection; deleted-parent checks across every nested route; rollback and preserved rows.
- Disposable PostgreSQL: pre-0011 fixtures with all existing child kinds and shared Todos; schema check, upgrade/repeated head/downgrade/re-upgrade, lock ordering including concurrent AI Session create/update versus deletion, and unchanged Todo/sync state.
- Web: active/archive lists, pinned exclusion, successful mutations, cancellation, retry/readback and stale response guards; desktop 1280px and narrow 375px flows. Run backend full pytest with disposable PostgreSQL configuration, Web tests/build and Playwright; report conditional skips and real-versus-stubbed evidence.
- Inspect exact changed/staged scope, whitespace, generated artifacts and private data. No live provider calls or configured database changes.

## Risks

- Parent ownership lookup is shared by multiple child routes; preserve valid archived behavior and check deletion after taking write locks.
- Downgrade removes visibility flags; its test is disposable-only. Soft delete has no recovery UI in this slice.
- Project detail and Dashboard caches must not retain archived/deleted visibility after successful actions.

## Publication And Snapshot Scope

Base: main at `647f369741b6a1472f5ab6f6e465e3b1d01070ff`; local HEAD, origin/main and remote main matched with a clean worktree. TASK-037 is terminally closed and its completed archive remains unchanged.

Exact proposed pre-Coding Snapshot scope, including Task Review's gate and READY synchronization:

- `docs/api-project-lifecycle.md`
- `docs/pc-delivery-plan.md`
- `handoff/current-task.md`
- `handoff/project-state.md`
- `handoff/task-review-gate.md`
- `handoff/code-review-gate.md`
- `handoff/git-snapshot.md`
- `handoff/git-commit.md`
- `tasks/TASK-038-pc-project-lifecycle.md`

Only these nine documents are part of publication. Task Review must approve the exact set before Git Snapshot.

## Coding Output Requirements

Report lifecycle/migration behavior, child ownership and concurrency evidence, UI navigation and regressions, all acceptance results, test limitations, exact changed scope and next role.

## Current Stage

Git Snapshot: COMPLETE on branch main; base 647f369741b6a1472f5ab6f6e465e3b1d01070ff; snapshot 4138f592f7fa3bb0be080b28e97cce2e778e7732.

Snapshot Reason: approved TASK-038 readiness documents required a durable pre-Coding baseline.

Next Role: Git Commit (Terminal Closure Commit)

Required Next Action: commit and push only the five documents in the Terminal Closure File Allowlist below with message `docs(task): close TASK-038`. Verify parity and a clean worktree, then return to Decision without repeating Closure Check.

## Coding Result

- Result: PASS
- Task ID: TASK-038
- Final Status: REVIEWING
- Branch: main
- Snapshot and HEAD: `4138f592f7fa3bb0be080b28e97cce2e778e7732`
- Verified: 2026-11-18, Asia/Shanghai
- Next Role: Code Review

### Modified Files

The working tree contains these 25 paths including the existing snapshot record. Coding updated the two active task records and preserved their snapshot evidence.

- `backend/alembic/versions/20261109_0011_add_project_lifecycle.py`
- `backend/app/api/v1/ai_sessions.py`
- `backend/app/api/v1/projects.py`
- `backend/app/models/project.py`
- `backend/app/schemas/project.py`
- `backend/app/services/project_stages.py`
- `backend/tests/test_project_lifecycle.py`
- `backend/tests/test_project_lifecycle_migration.py`
- `backend/tests/test_project_log_migration.py`
- `backend/tests/test_project_milestone_migration.py`
- `backend/tests/test_project_stage_migration.py`
- `backend/tests/test_project_todo_link_migration.py`
- `docs/api-project-lifecycle.md`
- `docs/pc-delivery-plan.md`
- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-038-pc-project-lifecycle.md`
- `web/e2e/project-lifecycle.spec.ts`
- `web/src/App.tsx`
- `web/src/api.ts`
- `web/src/dashboard-selection.test.ts`
- `web/src/dashboard-selection.ts`
- `web/src/ProjectLifecycle.tsx`
- `web/src/styles.css`
- `web/src/types.ts`

### Implementation Summary

- Added nullable lifecycle timestamps and a database constraint requiring an archive timestamp for a deleted Project. Revision `20261109_0011` follows `20261015_0010`.
- Default and archived listings filter by owner and lifecycle, using the established pin, update time and ID order. Shared parent lookup filters deleted Projects, including when taking write locks. AI Session writes use that same lock.
- Archive, restore and archived-only soft deletion use empty bodies, UUID idempotency keys and one transaction for the Project update and stored response. Effective transitions bump the parent once. No-op actions preserve versions and timestamps. Historical responses remain replayable.
- PC Projects adds scope controls, confirmed deletion and canonical list/detail reads. A failed read after mutation can be retried as a read. Identity and Project request generations plus scope transitions guard late results. Dashboard excludes pinned archived Projects.

### Acceptance Criteria Results

1. PASS. Disposable PostgreSQL verified data and sync sequence preservation, active visibility on upgrade, retained deleted visibility on repeated head, and restored active visibility after downgrade removes the flags and re-upgrade recreates them.
2. PASS. Focused API tests cover owner and scope isolation, archived access and fresh 404s on deleted parent and child paths. The ordering clauses are the existing pin, update time and ID sequence.
3. PASS. Focused tests cover empty-body and key validation, conflict, exact replay including DELETE, no-op, active-delete rejection and transactional rollback.
4. PASS. PostgreSQL compares all retained child, Todo and sync records around deletion and verifies a shared Todo through a second Project.
5. PASS. PostgreSQL exercises both lock orders for Project PATCH, stage PUT, milestone PUT, link PUT, log POST and AI Session POST/PATCH. It checks conditional parent version increments and retained AI Session data.
6. PASS with recorded coverage. Both browser sizes exercise archive, restore, confirmation and cancellation, stable ambiguous retry keys, readback retry and a late mutation during scope switching. Identity and Project switching use the existing request-generation guards and existing suite coverage.
7. PASS. A Dashboard unit case excludes a pinned archived Project. Full backend, Web and browser regressions cover the existing Project and child workflows.
8. PASS with the verification boundaries below.

### Verification Commands And Results

- From `backend`, set `$env:LIFEOS_TEST_PG_BIN='D:/PostgreSQL/18/bin'` and run `python -m pytest tests/test_project_lifecycle.py tests/test_project_lifecycle_migration.py -q --tb=short`. Four passed. The expanded concurrency fixture required a milestone ID to reach the lock check.
- From `backend`, run `python -m pytest` with the same disposable PostgreSQL setting. 209 passed.
- From `backend`, run `python -m alembic heads`. Sole head is `20261109_0011`.
- From `web`, run `npm test -- --run`. 205 passed across 21 files.
- From `web`, run `npm run build`. Passed.
- From `web`, run `npx playwright test`. 18 passed and two existing direct-backend cases were skipped because their disposable-backend tokens were absent. Lifecycle tests passed at 1280px and 375px with API stubs. Screenshots and horizontal-overflow assertions passed. Playwright emitted the NO_COLOR and FORCE_COLOR precedence notice.
- Real migration, API persistence and concurrent transactions ran against a disposable PostgreSQL instance. Browser flows exercised the frontend with synthetic API responses. The configured user database still needs migration before runtime use. The frontend dev server returned HTTP 200 at `http://127.0.0.1:5173`.

### Git Diff Check

`git status --short --untracked-files=all`, `git diff --stat` and `git diff` were inspected. Tracked and untracked paths match the list above. Working and cached whitespace checks passed with Git line-ending notices. The index is empty. New-file whitespace, artifact path and credential-pattern scans passed. The original snapshot record was preserved.

### Unresolved Issues

Independent Code Review and configured database deployment are pending.

### Task-Outside Findings

None recorded.

## Code Review Result

- Result: CHANGES_REQUESTED
- Target Status: CHANGES_REQUESTED
- Reviewed by: Code Review window
- Reviewed at: 2026-11-18 14:06 +08:00
- Branch / HEAD / Snapshot: `main` / `4138f592f7fa3bb0be080b28e97cce2e778e7732`
- Next Role: Coding through guarded rework admission

### Blocking Issue

- `CR-TASK-038-001` (P1): lifecycle `inFlight` and ambiguous retry-key state is owned by the detail component and is discarded by scope navigation. A delayed successful write can leave the current Project list stale, while returning to the same Project permits a second request with a fresh key before the first completes.
- Required fix and verification are persisted in `handoff/code-review-gate.md` and `handoff/issue-log.md`.

### Independent Verification

- Focused lifecycle API/migration: 4 passed against disposable PostgreSQL.
- Full backend: 209 passed; Alembic sole head `20261109_0011`.
- Full Web: 21 files / 205 tests passed; production build PASS.
- Playwright: 18 passed / 2 existing conditional skips, but the lifecycle stale-scope case asserts only the selected tab and does not prove list reconciliation or duplicate-write prevention.
- Git working/cached whitespace, untracked EOF/whitespace, security/artifact scans, exact 25-path Coding scope, and empty staging passed before review persistence.

### Non-blocking Suggestion

- P3: consider a later shared helper for revision-aware Project migration fixtures/snapshots; this does not expand the current rework.

## Coding Rework Result

- Finding: CR-TASK-038-001
- Result: PASS
- Final Status: REVIEWING
- Branch and snapshot: `main`, `4138f592f7fa3bb0be080b28e97cce2e778e7732`
- Next Role: Code Review

### Changes

- `web/src/App.tsx` owns pending attempts and retry keys for the current identity session, by Project and action. An in-flight write locks lifecycle actions on that Project across detail remounts. Ambiguous failures keep the action's key, while deterministic 4xx responses discard it. Identity changes clear the registry and invalidate late completions.
- `web/src/ProjectLifecycle.tsx` receives pending and error state from App and owns confirmation UI only.
- Late success refreshes the current scope through the existing request-generation checks. It preserves navigation and refreshes detail only if the user is looking at the affected Project.
- `web/e2e/project-lifecycle.spec.ts` reproduces key loss on remount, then verifies same-key retry, disabled Archive after reopening during a delayed write, a single held request, automatic removal from Active and presence in Archived at 1280px and 375px.

### Verification

- From `web`, the expanded 1280px case failed before the fix because the retry generated a different key.
- `npx playwright test e2e/project-lifecycle.spec.ts` passed both widths.
- `npm test -- --run src/App.projects.test.tsx src/App.dashboard.test.tsx src/dashboard-selection.test.ts` passed 11 tests.
- `npm test -- --run` passed 205 tests across 21 files.
- `npm run build` passed.
- `npx playwright test` passed 18 tests, with two existing direct-backend cases conditionally skipped. Playwright emitted the existing color environment notice. The lifecycle browser tests use synthetic API responses.
- Backend verification for the original implementation is recorded above. This rework only changed Web behavior.
- Git whitespace checks passed for working and cached diffs, and staging is empty. The 27-path reviewed scope matches the current working tree. This rework touched only the three Web files above and the two active task records. The existing snapshot, review gate and issue evidence are preserved for re-review.

## Code Re-review Result

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-11-20 11:48 +08:00
- Branch / HEAD / Snapshot: `main` / `4138f592f7fa3bb0be080b28e97cce2e778e7732`
- Blocking issues: none. CR-TASK-038-001 is verified.
- Independent evidence: Web 205 passed, production build passed, Playwright 18 passed and 2 existing direct-backend cases were skipped. Both lifecycle viewports verified retry-key reuse, one pending write across remount, and authoritative list refresh after delayed success.
- Reviewed Scope: exactly 27 files listed in `handoff/code-review-gate.md`. Working and cached whitespace checks passed. Staging is empty.
- Final task status: REVIEWING
- Next Role: Git Commit
- Recommended commit message: `feat(project): add project lifecycle`

## Git Commit

- Status: COMPLETE
- Result Commit: `2308b53c3305b27a101a038c24dfe39467399c40`
- Commit Message: `feat(project): add project lifecycle`
- Push Target: `origin/main`
- Remote Parity: PASS; local HEAD, `origin/main`, and remote `refs/heads/main` matched after push.
- Code Review: PASS
- Next Role: Decision

## Closure

- Closure Check: PASS
- Checked At: 2026-11-20 11:53:07 +08:00
- Result Commit: `2308b53c3305b27a101a038c24dfe39467399c40`
- Completion Commit: `839a7dd5fe51aa092c4b21e7bfa1eaeaa3127b32`
- Remote Verification: before Closure edits, main HEAD, origin/main, and remote refs/heads/main all matched the Completion Commit. Result parent is snapshot 4138f59; completion parent is the Result Commit.
- Working Tree Before Closure Docs: clean, with no staged, unstaged, or untracked paths.
- Review/Test Evidence: final Code Review re-review PASS / COMPLETED at 2026-11-20 11:48 +08:00. Initial review verified 209 backend tests including disposable PostgreSQL and sole Alembic head 20261109_0011. Web-only rework was independently verified with 205 Web tests, production build PASS, and Playwright 18 passed / 2 existing conditional direct-backend skips at 1280px and 375px.
- Decision Verification: exact Result Commit paths match all 27 Reviewed Scope paths. Completion Commit contains only current-task.md, git-commit.md, project-state.md, and this archive. Both published commits pass Git whitespace checks. Decision checked the persisted review/test evidence without rerunning the already-reviewed suites or changing business code.
- Acceptance Criteria Result: all eight criteria are checked in both active records and supported by review evidence, including preserved children/Todos/sync state, deleted-parent access rules, parent locking, archived Dashboard exclusion, and navigation-safe lifecycle retries. Browser flows use synthetic API responses; actual backend migration/API/concurrency evidence comes separately from disposable PostgreSQL, not direct browser-to-user-database acceptance.
- Issue Disposition: CR-TASK-038-001 is verified in issue-log.md and final re-review; no blocking TASK-038 finding remains. ISSUE-20261011-001 remains open P3/non-blocking and deferred. The review's optional P3 suggestion to extract legacy-Project migration fixture/snapshot helpers is deferred test maintenance, not a closure blocker.
- Remaining Follow-ups: this check does not establish the configured user database's current revision or deploy 0011. Normal startup/deployment must verify and apply pending migrations through 20261109_0011 before lifecycle use. Retain the two conditional browser skips for later PC acceptance. Notes is the next unpublished business slice; Calendar/PC acceptance follow, then Android. AI memory/Agent work remains deferred.
- State Synchronization: both task records remain COMPLETED; live routing now authorizes terminal closure only. Roadmap, project state, and the lifecycle API status header are synchronized with final Review PASS and published-result evidence; API contract body is unchanged.
- Terminal Closure Commit: authorize exactly the five documents below with message `docs(task): close TASK-038`. Commit/push once; verify local/tracking/remote parity and a clean worktree; return to Decision. Do not repeat Closure Check, create post-closure state edits, or publish the next task from the Git window.

### Terminal Closure File Allowlist

- `docs/api-project-lifecycle.md`
- `docs/pc-delivery-plan.md`
- `handoff/current-task.md`
- `handoff/project-state.md`
- `tasks/TASK-038-pc-project-lifecycle.md`
