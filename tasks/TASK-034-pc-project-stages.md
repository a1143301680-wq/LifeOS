# TASK-034: PC editable Project/Goal stages

Last updated: 2026-10-12

## Metadata

- Task ID: TASK-034
- Task Name: PC editable Project/Goal stages
- Status: COMPLETED
- Priority: P1
- Parent Task: PC V1 MVP completion / Project depth
- Dependencies: TASK-031 Project core; TASK-032 AI Sessions; TASK-033 terminal Closure Commit `c78e6a2563a7033f7fb3f6d2317c767bc3fbda15`; current migration `20261010_0006`
- Contract: `docs/api-project-stages.md` (Task Review-approved)

## Background

TASK-033 is terminally closed and local HEAD, origin/main, and remote main were verified at its Closure Commit on 2026-10-12. The former Project depth roadmap row covered several distinct behaviors. Decision splits it into stages, milestones, Todo links, logs/timeline, and lifecycle follow-ups so each task has a verifiable product result. User direction remains PC foundations first, Android later; personal memory, self-iteration, and Agent participation are deferred.

## Goal

A PC user can open a Project/Goal, see its persisted type-based stage list, add/rename/remove/reorder stages, explicitly select or clear the current stage, save, and reopen without losing edits or changing manual progress.

## In Scope

- User-owned project_stages storage, a forward/backward Alembic migration, existing-project backfill, and transactional template creation for new Projects.
- Nested GET and atomic PUT collection endpoints with existing identity, envelopes, idempotency, and parent-version behavior.
- PC Project-detail stage display/editor with durable save/readback and independent failure states.
- Focused backend, migration, Web, and desktop/narrow browser verification; regression of existing Project, AI Session, and Dashboard flows.
- Publication housekeeping: synchronize PC roadmap and related Android reservation references, record TASK-033 terminal closure, and preserve the known issue-log entry.

## Out Of Scope

- Milestones, Todo links, logs/timeline, Project archive/delete, calculated progress, template reset/global template management, and Dashboard stage integration.
- Notes, Calendar, Android, reminders, offline writes, Project/stage SSE or sync protocols, account/auth redesign, and infrastructure deployment.
- AI personal memory, feedback learning, Agent execution, provider changes, language-consistency repair, autonomous writes, and external chat/Git import.
- Changes to completed task archives or unrelated product/API contracts.

## Relevant Files

- `docs/api-project-stages.md`: exact storage, six template mappings, endpoint/write/validation rules, migration semantics, and PC behavior.
- `docs/requirements.md`: section 7 Project/Goal stages and manual progress only.
- `docs/mvp.md`: Phase 2 editable-stage acceptance; `docs/architecture.md`: sections 4-5 and 9-10 identity, table, and Project boundaries.
- `docs/pc-delivery-plan.md`: split PC-first sequence and checkpoint.
- `backend/app/models/project.py`, `backend/app/models/__init__.py`, `backend/app/api/v1/projects.py`, `backend/app/api/v1/router.py`, `backend/app/schemas/project.py`.
- `backend/app/services/idempotency.py`, `backend/app/core/errors.py`, `backend/alembic/versions/20261009_0005_add_projects.py`, `backend/alembic/versions/20261010_0006_add_ai_sessions.py`, `backend/tests/test_projects.py`, `backend/tests/test_ai_sessions.py`.
- `web/src/App.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`, `web/src/App.projects.test.tsx`, `web/src/App.ai-sessions.test.tsx`, `web/src/App.dashboard.test.tsx`, `web/e2e/projects.spec.ts`.
- New implementation/test paths listed below are expected outputs, not missing prerequisites. Search `handoff/issue-log.md` for TASK-034 and ISSUE-20261011-001; no full issue history is required.

## Allowed Files

- `backend/app/models/project_stage.py`, `backend/app/models/__init__.py`; `backend/app/models/project.py` only if collection/locking integration requires it.
- `backend/app/schemas/project_stage.py`, `backend/app/services/project_stages.py`, `backend/app/api/v1/project_stages.py`, `backend/app/api/v1/router.py`, `backend/app/api/v1/projects.py`.
- `backend/alembic/versions/20261012_0007_add_project_stages.py` only; do not rewrite old migrations.
- `backend/tests/test_project_stages.py`, `backend/tests/test_project_stage_migration.py`; existing backend test fixtures only for stage-table registration or narrowly required Project regression coverage.
- `web/src/App.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`, new `web/src/ProjectStages.tsx` and focused stage tests, new `web/e2e/project-stages.spec.ts`; existing Web/E2E fixtures/tests only for compatibility regression.
- `docs/api-project-stages.md` header status only for verified implementation progress; contract-body revisions return to Decision. `docs/pc-delivery-plan.md` for verified progress only; active TASK-034 workflow/gate/Git/issue records for role-owned state changes.
- Other publication documents below belong in the readiness snapshot; their presence is not permission for unrelated Coding edits.

## Forbidden Files And Changes

- `android/**`, existing Alembic revisions, completed task archives, requirements/MVP/architecture/Phase 1A API/data-model contracts, accepted ADRs, dependencies/lockfiles unless a concrete task blocker returns to Decision.
- Unrelated Todo/sync/provider behavior, AI memory/agents, private data, credentials, generated build/test output, user data seeding or migration as a test shortcut.
- Inferring stage completion from manual percentage; regenerating defaults on type change/read/startup; silently choosing a current stage.
- New generic workflow/template engine, global UI refactor, or unapproved endpoints.

## Implementation Requirements

1. Implement `docs/api-project-stages.md` exactly. Six template mappings, collection payload fields, validation, ownership, idempotency, no-op/version behavior, and type-change preservation are implementation contracts, not choices left to Coding.
2. Add the normalized stage table and `20261012_0007` migration from `20261010_0006`. Backfill old projects without altering their existing values or selecting a current stage; freeze migration defaults. Register model metadata for the SQLite test setup.
3. Keep Project POST and its response compatible; create fresh default rows transactionally. Nested stage GET is read-only; PUT fully replaces one owned collection with atomic current selection and parent version update. Preserve existing Project PATCH behavior while serializing shared parent updates where necessary.
4. Add the Project-detail editor using existing UI conventions. Support add/rename/remove/move/current/clear/Save/Cancel, empty collections, stable draft IDs, bounded validation, independent failure/retry, and current Project readback.
5. Protect identity/project switching and in-flight writes/reads. Preserve unsaved edits after recoverable failures; do not carry draft state between Projects or identities.
6. Do not extend Dashboard or saved AI prompt composition. Regress them against Project creation/type changes/stage writes; no synthetic stage history or automatic progress calculation.
7. Verify migration and real API persistence on disposable PostgreSQL. Do not claim SQLite tests prove migration correctness, or claim the configured user database upgraded without evidence. Normal startup applies pending migrations before using the new endpoints.

## Acceptance Criteria

- [x] Each of six Project types gets the exact persisted defaults on create; no current stage is inferred; later type changes preserve edits.
- [x] Migration backfills existing projects, preserves their prior data and AI Sessions, and survives downgrade/upgrade and repeated head upgrade without silent reseeding.
- [x] Nested GET/PUT enforce owner isolation, exact payload bounds, ID membership/collision rules, and transaction rollback for invalid requests.
- [x] Add/rename/remove/reorder/current selection/clear/empty collection persist across readback and page reopening without changing manual progress/status/next step.
- [x] Idempotency replay/conflict and normalized no-op behavior are correct; effective writes increment parent version once, and concurrent parent/stage writes preserve the counter and single-current invariant.
- [x] PC editor has explicit Save/Cancel, recoverable failure/retry, stable IDs/keys, independent loading states, and no stale data after identity/project changes.
- [x] Existing Projects, AI Sessions, Dashboard/Resume, Today/Todo, and identity flows retain their contracts.
- [x] Backend/Web tests, production build, desktop/narrow browser flow, disposable PostgreSQL migration/API checks, and Git scope/whitespace checks pass or state concrete limitations for Code Review.

## Verification Plan

- Backend tests: all six default lists, create atomicity, no read-time reseed, type-change preservation, empty/max list, trimmed and invalid names, duplicate/foreign IDs, retained IDs, current switch/removal/clear, invalid-request rollback, auth/owner isolation, no-op/effective version/timestamp, and idempotency.
- Disposable PostgreSQL: start at 0006 with synthetic projects of all types plus an AI Session; upgrade/backfill and verify preserved values; edit and repeat head upgrade without reseeding; downgrade back to 0006 and re-upgrade. Verify same-Project concurrent PUT/PATCH version handling and final current-stage invariant.
- Web tests: full editor flow, order/current state, Save/Cancel, failures with unchanged/changed retry payloads, stale identity/project responses, loading/empty/error states, and compatibility with existing Project forms/AI Session prompts/Dashboard.
- Run `python -m pytest` in backend; `npm test -- --run`, `npm run build`, and `npx playwright test` in web. Add focused browser verification at 1280px and 375px; verify persisted save/readback through the real API on a disposable backend. Record pre-existing conditional skips accurately.
- Inspect tracked/untracked/staged scope, `git diff --check`, cached whitespace, secrets/private fixtures, and generated output. No live provider call is required.

## Risks

- Full-list PUT uses last-write-wins; the task guarantees transaction integrity, not multi-editor optimistic conflict detection.
- Migration backfill must not misrepresent current progress. Existing user data must not be used as a disposable test database.
- Current PC Project state is shared in App.tsx; independent collection state must not leak across identities or resurrect stale responses.
- The existing language inconsistency is non-blocking and deferred; carrying its log forward authorizes no AI repair.

## Publication And Snapshot Scope

Decision publication base: `main` at `c78e6a2563a7033f7fb3f6d2317c767bc3fbda15`; local HEAD, origin/main, and remote main matched before edits. The only pre-existing edit was Decision's authorized ISSUE-20261011-001 in issue-log.md. It is preserved unchanged and explicitly carried as documentation housekeeping, not business implementation.

The exact proposed pre-Coding snapshot scope is these 12 documents, including Task Review's subsequent gate and READY synchronization:

- `docs/api-project-stages.md`
- `docs/pc-delivery-plan.md`
- `docs/phase1a-progress.md`
- `docs/phase1a-completion-audit.md`
- `handoff/current-task.md`
- `handoff/project-state.md`
- `handoff/task-review-gate.md`
- `handoff/code-review-gate.md`
- `handoff/git-snapshot.md`
- `handoff/git-commit.md`
- `handoff/issue-log.md`
- `tasks/TASK-034-pc-project-stages.md`

Task Review must approve this exact document scope or report discrepancies. No other pre-existing business changes were found. This list is not an implementation Review PASS.

## Decision Record

- 2026-10-12: confirmed TASK-033 terminal Closure Commit and remote parity; no repeated Closure Check.
- 2026-10-12: published this bounded Project-stage slice; remaining Project depth features stay in the roadmap and future IDs are assigned at publication rather than repeatedly renumbered.
- 2026-10-12: user deferred AI memory/self-iteration/Agent participation until after foundations; ISSUE-20261011-001 remains P3, non-blocking.
- 2026-10-12: a read-only configured-database revision probe did not complete and was stopped. No user DB migration or mutation occurred; current deployed revision is not asserted by this publication.

## Coding Output Requirements

Report changed paths, schema/migration evidence, exact API/default/write semantics, PC persistence flow, ownership/race handling, all acceptance results, tests/build/browser evidence, exact Git/security checks, limitations, and the next role.

## Current Stage

Task Review: PASS at 2026-10-12 13:21 +08:00. Full evidence and the exact approved 12-file scope are in `handoff/task-review-gate.md`.

Git Snapshot: COMPLETE on branch `main`; base commit `c78e6a2563a7033f7fb3f6d2317c767bc3fbda15`; snapshot commit `9a0b781fc7874c75d5a4f12544d1fd27773448c6`.

Snapshot Reason: approved TASK-034 readiness documents required a durable pre-Coding baseline.

Next Role: Decision

Required Next Action: perform the Decision Closure Check using Result Commit `7fa8153c7c0ba6a0ef6ed8a2e05b7a17936fcbe8` and the completion record.

## Coding Result

- Result: PASS; final status: REVIEWING. No stage, commit, or push.
- Modified Files: new stage model, schema, service, nested API router, `20261012_0007` migration, backend stage/API/migration tests; scoped edits to Project POST/PATCH, model registration, and API router; new `ProjectStages` component, types, API client, focused component/browser tests, scoped Project detail/styles, and compatibility updates to existing Project, AI Session, and Dashboard E2E route stubs; approved contract header, PC roadmap, and active task state files. The pre-existing `handoff/git-snapshot.md` modification was preserved unchanged.
- Implementation Summary: Project POST now creates type-specific persisted stage rows in its transaction without changing its DTO. The new owner-scoped nested GET reads without seeding; keyed PUT validates and replaces the full ordered collection, preserving retained IDs, allowing an empty list, explicitly selecting or clearing current, and returning a replayable response. Parent-row locking serializes stage PUT with Project PATCH; effective writes increment parent version once, normalized no-ops do not. The PC detail editor supports add/rename/remove/reorder/current/clear, Save/Cancel, stable draft UUIDs and retry keys, independent loading/error states, and parent readback without changing Dashboard or AI prompt contracts.
- Acceptance Criteria Results: All eight criteria are covered by focused tests and the verification below. SQLite covers API semantics; disposable PostgreSQL separately covers backfill, preserved Project/AI Session values, repeated-head empty-list preservation, downgrade/re-upgrade, database single-current uniqueness, fresh Project API seeding, and concurrent PUT/PATCH version preservation.
- Verification Commands And Results: `D:\LifeOS\backend`: `$env:LIFEOS_TEST_PG_BIN='D:\PostgreSQL\18\bin'; python -m pytest` -> 147 passed, 0 warnings, including one disposable PostgreSQL migration/API/concurrency test. `D:\LifeOS\web`: `npm test -- --run` -> 17 files / 147 passed; `npm run build` -> PASS; `npx playwright test` -> 10 passed, 2 conditional disposable-backend cases skipped. Stage editor browser flows passed at 1280px and 375px with API stubs; real persistence was verified separately through FastAPI TestClient against the disposable PostgreSQL instance. Playwright emitted only the existing `NO_COLOR`/`FORCE_COLOR` environment warning.
- Git Diff Check: Tracked/untracked/staged scope, `git diff --stat`, `git diff --check`, and cached whitespace were inspected; changed paths are within the TASK-034 allowlist, staging is empty, and no secret/generated artifact appears in Git status. `git diff --check` exits 0 with informational LF-to-CRLF warnings.
- Unresolved Issues: The configured PostgreSQL Windows service is stopped and could not be started with current permissions; the configured user database was not accessed or upgraded. Normal startup must apply `20261012_0007` before real local use. The two pre-existing optional browser cases remain skipped. Two interrupted disposable-cluster directories remain outside the repository under system Temp after cleanup was refused by the host policy; no PostgreSQL test process remains running.
- Task-Outside Findings: None; existing `ISSUE-20261011-001` remains P3 and unchanged.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-10-12 13:56:49 +08:00
- Branch: `main`
- HEAD: `9a0b781fc7874c75d5a4f12544d1fd27773448c6`
- Snapshot Commit: `9a0b781fc7874c75d5a4f12544d1fd27773448c6`
- Blocking Issues: None.
- Non-blocking Suggestions: the configured PostgreSQL service/database revision remains unverified and normal startup must apply `20261012_0007`; two optional live-backend Playwright cases remain conditionally skipped but their persistence/concurrency boundaries are covered by the disposable PostgreSQL backend suite; two interrupted disposable-cluster directories remain outside the repository with no PostgreSQL process running.
- Verification: focused backend `10 passed`; full backend with `LIFEOS_TEST_PG_BIN=D:\PostgreSQL\18\bin` `147 passed`; focused Web `4 passed`; full Web `147 passed`; production build PASS; Playwright `10 passed / 2 conditional skipped`; Alembic head `20261012_0007`; worktree and cached whitespace checks PASS.
- Scope Conclusion: the exact reviewed publish scope is 26 files: the 25 pre-review TASK-034 paths plus `handoff/code-review-gate.md`. All 26 are authorized implementation or workflow records. No Android, Todo-stage link, milestone, log/timeline, Dashboard-stage integration, provider, dependency, generated artifact, secret, stage, commit, or push was introduced by Code Review.
- Final Task Status: `REVIEWING`; Git Commit owns transition to `COMPLETED` after successful publication.
- Recommended Commit Message: `feat(project): add editable project stages`
- Next Role: Git Commit

## Git Commit

- Status: COMPLETE
- Result Commit: `7fa8153c7c0ba6a0ef6ed8a2e05b7a17936fcbe8`
- Commit Message: `feat(project): add editable project stages`
- Push Target: `origin/main`
- Remote Parity: PASS; local HEAD, `origin/main`, and remote `refs/heads/main` matched after push.
- Code Review: PASS
- Next Role: Decision

## Closure

- Closure Check: PENDING
- Terminal Closure Commit: not authorized until Decision records a PASS and exact closure-file allowlist.
