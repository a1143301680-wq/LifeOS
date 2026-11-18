# TASK-038: PC Project lifecycle

Last updated: 2026-11-09

## Metadata

- Task ID: TASK-038
- Task Name: PC Project lifecycle
- Status: READY
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

- [ ] Existing Projects migrate as active without data/version/timestamp/sync changes; repeated head preserves state and downgrade visibility is verified.
- [ ] Default and archived listings are owner-scoped and correctly ordered; archived detail/children remain usable and deleted Projects are excluded from all fresh parent/child requests.
- [ ] Archive/restore/delete enforce exact payload, ownership, idempotency, no-op, transaction and version rules; active DELETE is rejected.
- [ ] Soft-delete preserves all dependent rows and independent Todo/sync data; other Projects retain shared Todo references.
- [ ] PostgreSQL concurrency verifies Project and child mutations ordered before/after deletion, including AI Session writes, with no post-delete mutation or lost parent increments.
- [ ] PC Active/Archived, archive/restore, confirm/cancel delete, navigation/refresh errors and identity/Project/scope switching work without stale responses.
- [ ] Pinned archived Projects are excluded from Dashboard; existing Project/stage/milestone/log/timeline/Todo/AI Session/prompt behavior and sync regressions pass.
- [ ] Backend/Web/build, desktop/narrow browser, disposable PostgreSQL and exact Git/security/whitespace checks pass or explicitly disposition environmental limits for Code Review.

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

Next Role: Git Snapshot

Required Next Action: establish the pre-Coding Git Snapshot from the exact nine-document approved scope and independently verify branch, HEAD, remote parity, staged state, whitespace, secrets, private fixtures, and generated artifacts. Do not start Coding until Snapshot synchronizes both records to IN_PROGRESS.
