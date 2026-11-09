# LifeOS Current Task

Last updated: 2026-10-16

## Metadata

- Task ID: TASK-037
- Task Name: PC Project logs and timeline foundation
- Status: COMPLETED
- Priority: P1
- Parent Task: PC V1 MVP completion / Project depth
- Dependencies: Project/stage/milestone/AI Session foundations; TASK-036 terminal Closure Commit `4073c098e779e602409cfb45d25408d640fe9a25`; existing owned Todo source APIs; migration `20261015_0009`
- Contract: `docs/api-project-timeline.md` (Task Review-approved)

## Background

TASK-036 terminal closure is published; main HEAD, origin/main, and remote main matched its terminal commit with a clean worktree before this publication. Its exact five-file Closure scope and commit whitespace were verified. The next roadmap slice is Project logs/timeline before lifecycle, Notes, Calendar, and PC acceptance.

Reliable timestamps already exist for AI Sessions and completed linked Todos; milestone status-change history does not. This slice adds real manual records and a common read-only timeline without inventing past events. PC foundations remain ahead of Android and deferred AI memory/Agent work.

## Goal

A PC user can record/edit/remove a manual Project log, see it alongside actual AI Sessions and qualifying completed linked Todos in one ordered paginated timeline, and open the underlying source with correct Project context.

## In Scope

- User-owned manual project_logs storage, soft deletion, and a forward/backward migration with no historical backfill.
- Keyed manual log create/read/update/delete, exact content/field rules, no-op and shared parent-version/transaction behavior.
- Read-only three-source timeline with explicit occurrence semantics, deterministic keyset pagination, ownership/deletion filters, and bounded queries.
- Project-detail timeline/manual-log UI, source navigation/back/focus, independent failures, retries, and identity/Project race protection.
- Focused/backend/migration/concurrency/Web/browser verification and existing feature regressions.
- Publication housekeeping: record TASK-036 terminal closure and correct stale live plan/state wording without editing its completed archive.

## Out Of Scope

- Milestone/stage change history, immutable audit/event store, automatic source logging/backfill, custom/backdated manual log occurrence, and AI Session schema/table-link migration.
- Project lifecycle/archive/delete, Notes, Calendar/Dashboard timeline integration, stats, auto-progress, reminders, Android/offline/sync/SSE.
- Todo/source editing from timeline, new Todo fields/endpoints, AI prompt/provider/language/memory/Agent changes, automatic writes, and generic workflow/UI rewrites.
- Completed task archives, old migrations, or unrelated stable contract changes.

## Relevant Files

- `docs/api-project-timeline.md`: complete manual CRUD/source/timestamp/pagination/UI contract.
- `docs/requirements.md`: sections 7 Timeline, 8 Resume, and 9 AI Workspace; `docs/mvp.md`: Phase 2 timeline foundation / Phase 3 Session appearance; `docs/architecture.md`: ownership/core tables/AI Workspace recommendations.
- `docs/pc-delivery-plan.md`; existing stage/milestone/Todo-link API docs for parent locking and source boundaries; `docs/api-phase1a.md` Todo detail/completion semantics only.
- `backend/app/models/project.py`, `backend/app/models/ai_session.py`, `backend/app/models/todo.py`, `backend/app/models/project_todo_link.py`, model registration and API router.
- `backend/app/services/project_stages.py`, `backend/app/services/project_todo_links.py`, `backend/app/services/idempotency.py`, `backend/app/services/todo_list.py`, `backend/app/api/v1/ai_sessions.py`, `backend/app/api/v1/todos.py`; latest 0009 migration and existing disposable PostgreSQL tests.
- `web/src/App.tsx` Project/AI Session navigation, `web/src/ProjectTodoDetail.tsx`, `web/src/ProjectTodoLinks.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`; existing Project/Session/link/Dashboard component and E2E tests.
- New paths below are expected outputs. Search issue-log.md for TASK-037 and deferred ISSUE-20261011-001; full issue history is not required.

## Allowed Files

- New `backend/app/models/project_log.py`, `backend/app/schemas/project_log.py`, `backend/app/schemas/project_timeline.py`, `backend/app/services/project_logs.py`, `backend/app/services/project_timeline.py`, `backend/app/api/v1/project_logs.py`, `backend/app/api/v1/project_timeline.py`; model registration and API router.
- New `backend/alembic/versions/20261015_0010_add_project_logs.py` only; existing shared owned-Project helper in `backend/app/services/project_stages.py` only for necessary narrow reuse.
- New `backend/tests/test_project_logs.py`, `backend/tests/test_project_timeline.py`, `backend/tests/test_project_log_migration.py`; existing tests/disposable PostgreSQL helper only for focused compatibility/head/fixture/concurrency checks.
- New `web/src/ProjectTimeline.tsx`, `web/src/ProjectTimeline.test.tsx`; narrowly scoped new ProjectLog editor/detail helpers/tests under `web/src/ProjectLog*` if useful; new `web/e2e/project-timeline.spec.ts`.
- `web/src/App.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`; `web/src/ProjectTodoDetail.tsx` only for necessary reusable source/focus integration; existing Web/E2E tests only for focused navigation/new read compatibility.
- `docs/api-project-timeline.md` header status for verified implementation progress only; contract-body changes return to Decision. `docs/pc-delivery-plan.md` verified progress and active role-owned TASK-037 workflow/gate/Git/issue state.

## Forbidden Files And Changes

- `android/**`, older migrations, completed archives, requirements/MVP/architecture/Phase 1A API/data-model/accepted ADR bodies, dependencies/lockfiles without a concrete blocker returned to Decision.
- Existing AI Session/Todo/stage/milestone/link model/write contracts or sync entities/events/cursors; copied AI Session rows or fabricated source history.
- Inferring milestone completions from updated_at/status or showing Todo completions that preceded linking as Project activity.
- Client-writable log ownership/timestamps/kinds, unbounded timeline history loading, source mutation just from navigation, credentials/private fixtures/generated output.

## Implementation Requirements

1. Implement `docs/api-project-timeline.md` exactly: manual writable/read fields, server occurrence time, source inclusion/exclusion, summary composition, tie ordering, cursor binding, transaction/version and navigation rules are settled scope.
2. Add empty project_logs and 0010 migration from 0009. Preserve all legacy records/versions/cursors. Do not backfill manual rows or physically migrate existing AI Sessions into the new table.
3. Implement manual POST/GET-detail/PATCH/DELETE with existing identity/envelopes/idempotency and shared Project lock. Validate before writes; transact log state, effective parent version/timestamp, and idempotency response together.
4. Implement the read-only timeline over active manual logs, AI Sessions, and currently linked owned completed Todos whose actual completion is not earlier than linking. Normalize timestamp comparisons and use bounded keyset retrieval with the exact tie tuple.
5. Build independent Timeline/manual log UI with load-more/refresh, explicit Save/Cancel/Delete, source opening and return/focus, canonical post-save refresh, retry keys, and no cross-context stale responses.
6. Preserve existing Project, stage, milestone, Todo-link, Session/AI prompt, Dashboard/Today/Todo and sync behavior. Reuse source navigation without automatic source edits or provider calls.
7. Verify migration/API/pagination/locking on disposable PostgreSQL plus SQLite-focused tests, Web tests, and desktop/narrow browser flow. Clearly distinguish stubbed browser evidence from direct browser/backend coverage; do not mutate user data or claim deployed 0010 from test results.

## Acceptance Criteria

- [x] Manual logs create/read/edit/soft-delete with exact title/content validation, server occurrence, owner isolation, replay/conflict/no-op, and effective row/parent version behavior.
- [x] Migration starts empty, preserves legacy Project/stage/milestone/Session/Todo/link/user/sync data across upgrade/repeated-head/downgrade/re-upgrade, and enforces log constraints.
- [x] Timeline exposes exactly the three eligible source kinds with correct current title/summary/version/time and no foreign/deleted/pre-link/reopened or fabricated history.
- [x] Ordering and cursor seek match the complete tie tuple; more-than-one-page equal-time/cross-kind/same-UUID cases are deterministic, bounded, owner/Project-bound, and malformed cursors are rejected.
- [x] Source edits/removal/unlink/re-completion and refresh follow the current-source contract; timeline GET never changes sources/parent/sync state.
- [x] PC supports manual Save/Cancel/Delete, independent load/page/detail/refresh errors, stable retry keys, source/back/focus, identity/Project switching, and no stale read/write/page callback leakage.
- [x] Concurrent manual log and existing Project/stage/milestone/link mutations preserve parent increments; existing source APIs, prompts, Dashboard/Resume, Todo/Today, and sync regress without scope expansion.
- [x] Backend/Web tests, production build, desktop/narrow browser checks, disposable PostgreSQL evidence, and exact Git/security/whitespace checks pass or explicitly disposition environmental limitations for Code Review.

## Verification Plan

- Backend manual CRUD: ownership/parent/log mismatch, 400 bounds/null/extra/empty patch/body rules, 410 tombstones, content clear, no-op/edit/occurrence preservation, delete and identical replay, version/timestamp/idempotency atomicity and rollback.
- Timeline: exact kinds/source mappings and 300-code-point previews; timezone/SQLite/PostgreSQL timestamp normalization; equal time/rank/UUID tie cases; source edits, deleted logs/Todos, unlinked/reopened/recompleted Todos, missing/pre-link completion time, no double counting and no GET writes.
- Pagination: more than limit across all sources; same UUID across source kinds; no duplicates/skips for unchanged tuples; owner/Project/version/type/shape/date/kind/length-invalid cursors; page-size changes; bounded retrieval rather than loading all history.
- Disposable PostgreSQL: synthetic legacy sources at 0009; empty migration/data preservation/constraints/round trip; actual keyed CRUD/timeline readback and keyset ordering; concurrent manual and metadata/stage/milestone/link writes preserve parent counter. Confirm no unexpected source/sync mutation.
- Web: form/detail/readback and ambiguous retry keys, manual edit/delete invalidation, source-specific navigation and 401/404/410 errors, close/back/focus, live refresh, append deduplication, independent partial failures, and late requests after identity/Project switches.
- Run backend `python -m pytest` including disposable PostgreSQL configuration; Web `npm test -- --run`, `npm run build`, and `npx playwright test`; focused 1280px/375px timeline browser flow and real disposable-API persistence evidence. Record conditional skips and exact browser/backend boundaries.
- Inspect exact tracked/untracked/staged scope, `git diff --check`, cached whitespace, secrets/private fixtures/generated output, and disposable service cleanup. No live AI call is required.

## Risks

- A current-source feed changes when sources are edited/unlinked/deleted; it cannot promise immutable historical/audit pagination. Show actual timestamps and preserve the declared refresh semantics.
- Existing milestone records lack state-change history; defer those events instead of inventing them. Existing AI Session specialized timeline entries do not require a duplicate manual row.
- Cross-source timestamp normalization and kind/UUID ties must agree in SQL, cursor encoding, and UI keys.
- Multiple source navigation entry points and in-flight writes require strict identity/Project scoping and focus restoration.
- Last verified configured user DB is 0008; TASK-036 introduced 0009 and this task proposes 0010. Normal startup/deployment must apply the implemented head before runtime use; disposable migration evidence is separate.

## Publication And Snapshot Scope

Base: main at `4073c098e779e602409cfb45d25408d640fe9a25`; local HEAD/origin/main/remote parity and clean worktree verified before publication. TASK-036 terminal commit matches its exact five Closure documents and passes whitespace. No repeated Closure Check or completed-archive edit.

Proposed snapshot scope, including Task Review's gate/READY synchronization, is exactly these nine readiness documents:

- `docs/api-project-timeline.md`
- `docs/pc-delivery-plan.md`
- `handoff/current-task.md`
- `handoff/project-state.md`
- `handoff/task-review-gate.md`
- `handoff/code-review-gate.md`
- `handoff/git-snapshot.md`
- `handoff/git-commit.md`
- `tasks/TASK-037-pc-project-logs-timeline.md`

No business implementation, issue-log edit, or unknown pre-existing work is included. Task Review must independently approve exact scope before Git Snapshot.

## Decision Record

- 2026-10-15: verified TASK-036 terminal Closure Commit 4073c09 and clean three-way parity; published the next bounded PC foundation slice.
- 2026-10-15: selected manual recording-time logs plus read-only AI Session/current linked-completion aggregation; milestone/stage historical events remain deferred rather than inferred.
- 2026-10-15: no runtime/user-database change; existing configured-0008 checkpoint is preserved separately from disposable-test evidence and future migration requirements.
- 2026-10-15: personal memory/self-iteration/Agent work and the P3 language issue remain deferred.

## Coding Output Requirements

Report changed files, migration/data preservation, manual write/ownership/version/idempotency behavior, precise source/timestamp/cursor rules, UI/navigation/race behavior, all acceptance results, test/build/browser/PostgreSQL evidence, exact scope/security checks, limitations, and next role.

## Current Stage

Task Review: PASS at 2026-10-16 09:08 +08:00. Full evidence and the exact approved nine-file scope are in `handoff/task-review-gate.md`.

Git Snapshot: COMPLETE on branch `main`; base commit `4073c098e779e602409cfb45d25408d640fe9a25`; snapshot commit `6c956a35dd6245e45ac5edfa224b99285199b23b`.

Snapshot Reason: approved TASK-037 readiness documents required a durable pre-Coding baseline.

Closure Check: PASS

Checked At: 2026-11-09 13:25:47 +08:00

Result Commit: `937d1fdfdb617fa85ef563fcc1643f47622ee489`

Completion Commit: `cd451ff842ac9c7d4d30dd53452f8aa6022f28e6`

Next Role: Git Commit (Terminal Closure Commit)

Required Next Action: commit and push only the five documents in the TASK-037 archive's Terminal Closure File Allowlist with message `docs(task): close TASK-037`. Verify local/tracking/remote parity and a clean worktree, then return to Decision. Do not repeat Closure Check or publish the next task from this step.
