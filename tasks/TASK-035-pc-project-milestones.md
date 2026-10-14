# TASK-035: PC lightweight Project/Goal milestones

Last updated: 2026-10-14

## Metadata

- Task ID: TASK-035
- Task Name: PC lightweight Project/Goal milestones
- Status: REVIEWING
- Priority: P1
- Parent Task: PC V1 MVP completion / Project depth
- Dependencies: TASK-031 Project core; TASK-032 AI Sessions; TASK-034 terminal Closure Commit `9030c7d2c8d3896fcb3d65ea454547844949858c`; current migration `20261012_0007`
- Contract: `docs/api-project-milestones.md` (Task Review-approved)

## Background

TASK-034 is terminally closed. Decision verified local HEAD, origin/main, and remote main at its terminal Closure Commit on 2026-10-14 with a clean worktree. The roadmap next calls for lightweight milestones before Todo links, logs/timeline, lifecycle, Notes, Calendar, and PC acceptance. PC foundations remain ahead of Android; AI memory, self-iteration, and Agents stay deferred.

## Goal

A PC user can define a Project/Goal's ordered milestones, edit their titles and optional target dates, explicitly change status, remove items, save, and reopen the persisted result without modifying stages or manual Project progress.

## In Scope

- Normalized user-owned milestones, soft removal, one forward/backward migration, and unchanged empty defaults for existing/new Projects.
- Nested GET and atomic whole-collection PUT with bounded payloads, exact date/status/ID rules, idempotency, and shared parent version/locking behavior.
- PC Project-detail milestone display/editor with add/edit/reorder/remove, explicit status/date clear, Save/Cancel, durable readback, and independent failure states.
- Backend/API/constraint/migration/concurrency tests, Web tests, browser verification, and Project/stage/AI Session/Dashboard regressions.
- Publication housekeeping: record TASK-034 terminal closure in live milestone/plan documents and correct its stale API header only; preserve its completed archive.

## Out Of Scope

- Todo/stage links, milestone dependencies, automatic Project progress, reminders, recurring goals, timeline/history generation, archive/Project deletion, Trash/restore, or hard-delete cleanup.
- Notes, Calendar UI/aggregation, Dashboard milestone integration, statistics, Android, offline/sync/SSE protocols, identity redesign, deployment or user-data seeding.
- AI provider/language changes, personal memory, learning/Agents/autonomous writes, external imports, and generic collection-editor/workflow refactors.
- Completed task archive or unrelated stable product/API/architecture contract changes.

## Relevant Files

- `docs/api-project-milestones.md`: exact storage/read/write/date/status/no-op/soft-deletion/UI contract.
- `docs/requirements.md`: section 7 milestones and manual progress; section 13 source-based Calendar boundary only.
- `docs/mvp.md`: Phase 2 milestone scope; `docs/architecture.md`: sections 4-5 and 9-10 ownership and entity boundaries.
- `docs/api-project-stages.md`: existing stage PUT/parent lock contract; `docs/pc-delivery-plan.md`: PC-first sequence.
- `backend/app/models/project.py`, `backend/app/models/project_stage.py`, `backend/app/models/__init__.py`, `backend/app/services/project_stages.py`, `backend/app/api/v1/projects.py`, `backend/app/api/v1/project_stages.py`, `backend/app/api/v1/router.py`, `backend/app/services/idempotency.py`, `backend/app/core/errors.py`.
- `backend/alembic/versions/20261012_0007_add_project_stages.py`, `backend/tests/test_project_stages.py`, `backend/tests/test_project_stage_migration.py`, `backend/tests/test_projects.py`.
- `web/src/App.tsx`, `web/src/ProjectStages.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`, `web/src/ProjectStages.test.tsx`, existing Project/AI Session/Dashboard tests and `web/e2e/project-stages.spec.ts`.
- New paths below are expected outputs. Search issue-log.md by TASK-035 and the existing deferred ISSUE-20261011-001; full issue history is not required.

## Allowed Files

- New `backend/app/models/milestone.py`, `backend/app/schemas/milestone.py`, `backend/app/services/project_milestones.py`, `backend/app/api/v1/project_milestones.py`; model registration and `backend/app/api/v1/router.py`.
- New `backend/alembic/versions/20261014_0008_add_project_milestones.py` only; no changes to old revisions.
- New `backend/tests/test_project_milestones.py`, `backend/tests/test_project_milestone_migration.py`. Existing backend tests only for focused compatibility/fixture changes; a small shared disposable-PostgreSQL test helper or `backend/tests/conftest.py` is allowed if needed to reuse current fixture behavior without broad test refactoring.
- `backend/app/services/project_stages.py` and `backend/app/api/v1/projects.py` only if a narrowly scoped shared owned-parent/locking helper is necessary; no stage/Project contract changes.
- New `web/src/ProjectMilestones.tsx`, `web/src/ProjectMilestones.test.tsx`, `web/e2e/project-milestones.spec.ts`; scoped `web/src/App.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`.
- Existing Web/E2E tests and fixtures only for new nested milestone reads or focused Project/stage/AI Session/Dashboard regressions.
- `docs/api-project-milestones.md` header status only for verified implementation progress; contract-body changes return to Decision. `docs/pc-delivery-plan.md` for verified progress; role-owned active TASK-035 workflow/gate/Git/issue records.
- The stage-contract header update is already publication housekeeping, not permission for Coding to alter that contract.

## Forbidden Files And Changes

- `android/**`, existing migrations, completed task archives, requirements/MVP/architecture/Phase 1A API/data-model contracts, accepted ADRs, dependencies or lockfiles without a concrete blocker returned to Decision.
- Todo/sync/provider behavior, stage templates/current selection, Project/AI Session DTOs or saved AI prompts, machine-specific fixtures, credentials, private user data, generated output.
- Implicit status/date inference, calculated Project progress, milestone defaults on Project creation/read, restoring deleted IDs, or physical milestone deletion.
- New independent row CRUD/move endpoints, automatic writes outside explicit user save, or unrelated UI restructuring.

## Implementation Requirements

1. Implement `docs/api-project-milestones.md` exactly: every writable field, date/null/status transition, ordered list bound, row/parent version rule, tombstone collision behavior, and UI save/readback rule is settled for this slice.
2. Add the empty normalized table and migration from 0007 to 0008 with model registration for SQLite tests. Preserve old Project/stage/current/Session/user data during upgrade/downgrade; no user database mutation as a verification shortcut.
3. Implement owner-scoped nested GET and full-list PUT only. Share the existing parent Project lock boundary with Project PATCH/stage PUT; transact row edits/removals, parent version/timestamp, and idempotency response together.
4. Implement explicit milestone editing on Project detail using existing conventions. Preserve date strings, stable draft UUIDs, Save/Cancel, same-payload retry keys, and independent errors/readback; no automatic Project status/progress change.
5. Suppress stale GET/PUT/readback after Project or identity switches; reset drafts and never use a previous write result for a newly mounted section. On successful save refresh canonical collection and parent data, preserving existing stage/Session navigation.
6. Verify real PostgreSQL migration/API persistence/concurrent writes on a disposable cluster. Browser tests must cover desktop/narrow interaction; distinguish real browser/backend coverage from stubbed browser/API-only checks and record any conditional skips honestly.
7. Retain existing Project, stage, AI Session, Dashboard/Resume, Today/Todo and identity behavior. No live AI provider call or configured-user database migration is required to develop/review this task.

## Acceptance Criteria

- [x] Existing/new Projects have an empty collection without automatic seeding; type changes preserve milestones.
- [x] Migration upgrade/downgrade/re-upgrade preserves old Project/stage/current/AI Session/user data and enforces the new table's constraints.
- [x] GET/PUT enforce ownership, exact fields, valid calendar dates/null, all three explicit statuses, 0-50 bounds, unique/available IDs, and atomic validation rollback.
- [x] Add/title/date/status/reorder/remove and clear-all persist across readback/reopen; soft-deleted IDs cannot be reused/restored and canceled rows remain visible.
- [x] Normalized no-op/replay/conflict behavior preserves correct versions/timestamps; effective row and parent changes increment once at their respective boundaries, including serialized Project PATCH/stage PUT/milestone PUT concurrency.
- [x] PC supports explicit Save/Cancel, date clearing, stable IDs/retry keys, independent loading/error/refresh states, and safe identity/Project switching through reads and writes.
- [x] Manual Project progress/status/next-step, stages, AI Sessions/prompts, Dashboard, and Today/Todo contracts regress without scope expansion.
- [x] Backend/Web tests, production build, desktop/narrow browser checks, disposable PostgreSQL evidence, and exact Git/security/whitespace checks pass or explicitly disposition environmental limitations for Code Review.

## Verification Plan

- Backend: empty/no-seed behavior; field/type/size/name/date/leap-day/status bounds; duplicate/foreign/deleted IDs; ownership/auth; retained/new/order/status/date changes; soft deletion and empty/no-op; idempotency replay/conflict; invalid rollback; row and parent version/timestamp preservation.
- Disposable PostgreSQL: create synthetic users, Projects, stages/current selections, and AI Sessions at 0007; upgrade to 0008 with no seed; exercise keyed API save/readback, status/date clear/removal/tombstone rules, and interleaved Project PATCH/stage PUT/milestone PUT without lost parent increments. Verify unchanged data across repeated-head and downgrade/re-upgrade, and the single Alembic head.
- Web: empty/full/editor validation, date strings without timezone drift, all statuses, reorder/clear/remove/Cancel, ambiguous retry keys versus changed payload, failed post-save readback as refresh-only error, and delayed read/write responses across identity/Project switches.
- Run backend `python -m pytest` (including disposable PostgreSQL tests via the existing test-bin configuration), Web `npm test -- --run`, `npm run build`, and `npx playwright test`. Add focused 1280px/375px milestone browser flows and demonstrate persistence through a real disposable API; state exactly whether browser flows are stubbed or directly attached.
- Inspect `git diff --check`, cached whitespace, exact changed/untracked/staged sets, secrets/private fixtures, and generated output. Use synthetic data; stop disposable test services and report cleanup residue accurately.

## Risks

- Full-list PUT remains last-write-wins. Parent locking preserves data/version transaction integrity, not multi-editor optimistic conflict detection.
- Date conversion through JavaScript UTC would change calendar meaning; retain the date string at the API boundary.
- Milestone removal is soft but no restore UI exists; do not label it as permanent erasure or invent history from tombstones.
- PC detail now has independent stage and milestone requests; read/write responses must remain tied to the original identity/Project.
- Prior review's configured-user database deployment limit remains distinct from disposable-test evidence. Normal startup must apply the implemented head before real local use; this publication asserts no live database revision.

## Publication And Snapshot Scope

Base: branch main at `9030c7d2c8d3896fcb3d65ea454547844949858c`; local HEAD, origin/main, and remote main matched and the worktree was clean before publication. TASK-034 terminal commit changed exactly its four authorized Closure documents and passed whitespace checks. No repeated Closure Check or completed-archive edit is needed.

Proposed pre-Coding snapshot scope, including Task Review's READY/gate persistence, is exactly these 10 documents:

- `docs/api-project-milestones.md`
- `docs/api-project-stages.md`
- `docs/pc-delivery-plan.md`
- `handoff/current-task.md`
- `handoff/project-state.md`
- `handoff/task-review-gate.md`
- `handoff/code-review-gate.md`
- `handoff/git-snapshot.md`
- `handoff/git-commit.md`
- `tasks/TASK-035-pc-project-milestones.md`

The stage API file changes only its stale pending-Code-Review header. No business implementation or issue-log edit is part of publication. Task Review must independently approve the exact set before Git Snapshot.

## Decision Record

- 2026-10-14: verified TASK-034 terminal closure 9030c7d, three-way remote parity, and a clean worktree.
- 2026-10-14: published the next bounded PC foundation slice, milestones; Todo links and other future rows remain unpublished.
- 2026-10-14: deferred ISSUE-20261011-001 and AI memory/self-iteration/Agent capabilities remain outside this task.

## Coding Output Requirements

Report changed files, schema/migration and tombstone policy, exact date/status/version/idempotency behavior, PC save/readback/switching, all acceptance results, test/build/browser/PostgreSQL evidence, exact diff/security checks, limitations, and next role.

## Current Stage

Task Review: PASS at 2026-10-14 09:30 +08:00. Full evidence and the exact approved 10-file scope are in `handoff/task-review-gate.md`.

Git Snapshot: COMPLETE on branch `main`; base commit `9030c7d2c8d3896fcb3d65ea454547844949858c`; snapshot commit `e5c975b1af3106e88d24d85d262ef4373d66a27c`.

Snapshot Reason: approved TASK-035 readiness documents required a durable pre-Coding baseline.

Next Role: Code Review

Required Next Action: independently review TASK-035 implementation and the Coding Result in its task archive. Git publication awaits Code Review PASS.

## Coding Result

- Result: PASS; final status: REVIEWING. No stage, commit, push, or Code Review performed.
- Implementation Summary: Added empty-by-default owner-scoped milestones and migration 0008. Nested GET returns active rows; whole-collection PUT validates all IDs/fields before mutating, updates retained rows, soft-deletes omissions, rejects foreign/tombstone IDs, and commits rows, parent metadata, and idempotency response together. Parent locking reuses the existing Project PATCH/stage PUT boundary. Dates are strict valid YYYY-MM-DD strings/null; all three statuses are explicit. No-op preserves every timestamp/version; effective rows and parent increment once at their respective boundaries. PC editing supports add/title/date/status/reorder/remove/clear, stable draft IDs, Save/Cancel, retry keys, canonical readback and separate refresh-only failures. Identity/project changes remount the section and suppress pending reads/writes/readback; parent metadata refresh also checks the current identity generation and detail request.
- Acceptance Criteria Results: All eight criteria satisfied by the focused/full verification below. No defaults, computed progress, Todo/stage links, sync/SSE, provider call, Dashboard integration, or saved-prompt change was added.
- Pre-existing State Preserved: The Snapshot trio was present at admission. The Snapshot file was left byte-for-byte unchanged; both active task records retain their Snapshot evidence and now route to Code Review.
- Git Diff Check: Exact tracked/untracked scope is the 25 paths listed below, including the pre-existing Snapshot file. Staging is empty. Full tracked diff, new-file content/trailing-whitespace scans, git diff --check, and cached whitespace passed; Git emits informational LF-to-CRLF notices only. No .env, real credential, private fixture, database file, debug code, dependency, generated output, old migration, completed archive, or unrelated business file is included.
- Unresolved Issues: Configured-user PostgreSQL was not accessed/migrated, and its deployed revision is not asserted. Normal startup/deployment must apply 0008 before local milestone use. Two existing optional browser-to-disposable-backend cases remain skipped. Milestone browser checks use stubs; real persistence is separately verified by TestClient against a disposable PostgreSQL cluster. No new temporary-cluster residue or PostgreSQL test process remains; the two old TASK-034 Temp directories observed at admission were left untouched.
- Task-Outside Findings: None. Deferred ISSUE-20261011-001 remains unchanged.
- Preview Environment: Optional persistent frontend preview launch was refused by host automatic approval with `blocked by policy`. No preview service was left running. Playwright started/stopped its own Vite server successfully for the recorded browser checks.
- Next Role: Code Review.

### Modified Files

Exact worktree scope (25 files; includes the preserved pre-existing Snapshot state):

- `backend/alembic/versions/20261014_0008_add_project_milestones.py`
- `backend/app/api/v1/project_milestones.py`
- `backend/app/api/v1/router.py`
- `backend/app/models/__init__.py`
- `backend/app/models/milestone.py`
- `backend/app/schemas/milestone.py`
- `backend/app/services/project_milestones.py`
- `backend/tests/test_project_milestone_migration.py`
- `backend/tests/test_project_milestones.py`
- `docs/api-project-milestones.md`
- `docs/pc-delivery-plan.md`
- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-035-pc-project-milestones.md`
- `web/e2e/ai-sessions.spec.ts`
- `web/e2e/dashboard.spec.ts`
- `web/e2e/project-milestones.spec.ts`
- `web/e2e/project-stages.spec.ts`
- `web/e2e/projects.spec.ts`
- `web/src/App.tsx`
- `web/src/ProjectMilestones.test.tsx`
- `web/src/ProjectMilestones.tsx`
- `web/src/api.ts`
- `web/src/styles.css`
- `web/src/types.ts`

### Verification Commands And Results

| Directory | Complete command | Result |
| --- | --- | --- |
| backend | `python -m pytest tests/test_project_milestones.py -q --tb=short` | 25 passed; includes final parent timestamp no-op assertion |
| backend | `$env:LIFEOS_TEST_PG_BIN='D:\PostgreSQL\18\bin'; python -m pytest` | 173 passed; includes both disposable PostgreSQL tests; no warnings |
| backend | `python -m alembic heads` | sole head: `20261014_0008` |
| web | `npm test -- --run` | 18 files / 159 passed; no warnings |
| web | `npm run build` | PASS after final CSS change |
| web | `npx playwright test` | 12 passed / 2 existing conditional skips; no page errors in milestone flows |
| web | `npx playwright test e2e/project-milestones.spec.ts` | final 1280px/375px flows: 2 passed; saved/editor screenshots inspected; no horizontal overflow |
| root | `git status --short --untracked-files=all`, `git diff --stat`, `git diff`, `git diff --check`, `git diff --cached`, `git diff --cached --check` | scoped to the exact list above, whitespace PASS, staged empty |

Playwright warnings: existing NO_COLOR/FORCE_COLOR environment notice only. Browser milestone flows are stubbed; PostgreSQL API checks are real in-process HTTP routing backed by disposable SQL storage. The PostgreSQL test starts at 0007 with synthetic legacy data/current stage/AI Session, verifies no seed and preserved values, keyed writes/readback/status/date clearing/tombstones, schema constraints, three concurrent parent/stage/milestone writes, repeated-head preservation, downgrade/re-upgrade, and cleanup. No live provider call or configured-user DB migration was run, as excluded by this task. An initial constraint-test expectation was corrected to accept PostgreSQL DataError for VARCHAR overflow; final suites pass. An Alembic heads probe run from the root lacked config, then succeeded from backend as recorded above.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-10-14 10:41:48 +08:00
- Branch: `main`
- HEAD: `e5c975b1af3106e88d24d85d262ef4373d66a27c`
- Snapshot Commit: `e5c975b1af3106e88d24d85d262ef4373d66a27c`
- Blocking Issues: None.
- Non-blocking Suggestions: the configured user PostgreSQL revision remains unverified and normal startup/deployment must apply `20261014_0008`; milestone browser flows use stubs while real persistence/migration/concurrency are covered through TestClient on disposable PostgreSQL; two existing optional live-backend browser cases remain conditionally skipped.
- Verification: focused backend `25 passed`; full backend with `LIFEOS_TEST_PG_BIN=D:\PostgreSQL\18\bin` `173 passed`; focused Web `12 passed`; full Web `159 passed`; production build PASS; Playwright `12 passed / 2 conditional skipped`; Alembic sole head `20261014_0008`; desktop/narrow screenshots inspected; whitespace, scope, staging, security, artifact, and process checks PASS.
- Scope Conclusion: exact reviewed publish scope is 26 files, comprising the 25 Coding paths plus `handoff/code-review-gate.md`. No scope drift or unreviewed path is authorized.
- Final Task Status: `REVIEWING`; Git Commit owns transition to `COMPLETED` after successful publication.
- Recommended Commit Message: `feat(project): add lightweight milestones`
- Next Role: Git Commit
