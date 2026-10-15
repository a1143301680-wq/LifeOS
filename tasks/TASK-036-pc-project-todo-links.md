# TASK-036: PC Project/Goal Todo links

Last updated: 2026-10-15

## Metadata

- Task ID: TASK-036
- Task Name: PC Project/Goal Todo links
- Status: REVIEWING
- Priority: P1
- Parent Task: PC V1 MVP completion / Project depth
- Dependencies: TASK-034 editable stages; TASK-035 terminal Closure Commit `702c6759b82185a112607c3f1361add0c05969ea`; existing Todo list/detail and identity isolation; migration `20261014_0008`
- Contract: `docs/api-project-todo-links.md` (Task Review-approved)

## Background

TASK-035 is terminally closed. Decision verified main HEAD, origin/main, and remote main at its terminal Closure Commit on 2026-10-15 with a clean worktree and the exact five authorized Closure files. Normal LifeOS startup earlier on 2026-10-15 applied pending stage/milestone migrations and a separate query confirmed the configured user database at 20261014_0008. That deployment verification is distinct from earlier disposable test evidence.

The next roadmap slice connects existing Todo actions to Projects. PC foundations remain prioritized; AI memory/self-iteration/Agents and Android remain deferred.

## Goal

A PC user can explicitly associate existing owned Todos with a Project, reorder/unlink them, reopen the saved references, see current source state, and view the underlying Todo without creating duplicate Todos or changing Todo behavior.

## In Scope

- Empty normalized many-to-many Project/Todo association table and migration, with owner validation and bounded ordered references.
- Nested GET/full-list PUT, idempotency, no-op/version/locking behavior, and unavailable-source placeholders.
- Project-detail linked list/editor, paginated all-status candidate selection, refresh, and read-only source detail using existing Todo APIs.
- Focused tests, disposable PostgreSQL migration/API/concurrency verification, desktop/narrow browser flows, and existing Project/stage/milestone/Session/Dashboard/Todo regressions.
- Publication housekeeping: update TASK-035 terminal milestone/plan and persist the separately verified configured-database 0008 startup result; no completed-archive edits.

## Out Of Scope

- Todo creation/editing/completion/deletion from the Project panel, Todo project_id fields, reverse-project Todo UI, new Todo APIs, or Todo/sync contract changes.
- Stage/milestone links, auto-progress, logs/timeline/history, archive/Project delete, Notes, Calendar/Dashboard integration, reminders, Android/offline writes, and link sync/SSE.
- AI/provider/language fixes, memory/learning/Agents/autonomous linking, external imports, generic relationship engines, and global UI refactors.
- Business changes to completed task archives or unrelated product/architecture contracts.

## Relevant Files

- `docs/api-project-todo-links.md`: exact relationship/cardinality, source/unavailable DTOs, payload/error/locking/transaction rules, candidate pagination, source view, and PC flow.
- `docs/requirements.md`: sections 7/10 Project/Todo semantics; `docs/mvp.md`: Phase 2 Todo-link acceptance; `docs/architecture.md`: sections 4-5 and 9-10 ownership/entity boundaries.
- `docs/api-phase1a.md`: existing Todo list filters/cursors and detail/deleted-resource contract only; do not change it.
- `docs/api-project-stages.md`, `docs/api-project-milestones.md`: existing parent version/locking behavior; `docs/pc-delivery-plan.md`: sequence.
- `backend/app/models/project.py`, `backend/app/models/todo.py`, `backend/app/models/__init__.py`, `backend/app/api/v1/router.py`, `backend/app/services/project_stages.py`, `backend/app/services/project_milestones.py`, `backend/app/services/idempotency.py`, `backend/app/api/v1/todos.py`, `backend/app/services/todo_list.py`.
- `backend/alembic/versions/20261014_0008_add_project_milestones.py`, existing Project/milestone/Todo tests and disposable PostgreSQL fixtures.
- `web/src/App.tsx`, `web/src/ProjectMilestones.tsx`, `web/src/ProjectStages.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`; existing Project/milestone/Session/Dashboard/Todo browser and component tests.
- New paths below are expected outputs. Search issue-log.md for TASK-036 and deferred ISSUE-20261011-001; do not read full issue history by default.

## Allowed Files

- New `backend/app/models/project_todo_link.py`, `backend/app/schemas/project_todo_link.py`, `backend/app/services/project_todo_links.py`, `backend/app/api/v1/project_todo_links.py`; model registration and API router.
- New `backend/alembic/versions/20261015_0009_add_project_todo_links.py` only; no older revision rewrites.
- New `backend/tests/test_project_todo_links.py`, `backend/tests/test_project_todo_link_migration.py`; existing backend tests/disposable PostgreSQL helper only for scoped fixture/head/compatibility/concurrency coverage.
- `backend/app/services/project_stages.py` only if its existing shared owned-Project locking helper needs a narrowly scoped change; no Project/stage/milestone/Todo contract mutation.
- New `web/src/ProjectTodoLinks.tsx`, `web/src/ProjectTodoLinks.test.tsx`, `web/src/ProjectTodoDetail.tsx` and its focused tests if a separate detail component is useful; new `web/e2e/project-todo-links.spec.ts`.
- Scoped `web/src/App.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`; existing Web/E2E tests only for new nested reads/source API stubs or focused compatibility checks.
- `docs/api-project-todo-links.md` header status only for verified implementation progress; contract-body changes return to Decision. `docs/pc-delivery-plan.md` for verified progress; active TASK-036 role-owned workflow/gate/Git/issue records.

## Forbidden Files And Changes

- `android/**`, old migrations, completed archives, requirements/MVP/architecture/Phase 1A API/data-model contracts, accepted ADRs, dependencies/lockfiles without a concrete blocker returned to Decision.
- Todo model/schema/write endpoints, existing sync entity/event/cursor behavior, stage/milestone/progress semantics, AI prompts/providers, secrets, private user fixtures, generated build/test output.
- Copying Todo data into link storage, assuming single-Project ownership of a Todo, implicit link inference, deleting a Todo on unlink, or exposing deleted/foreign source content.
- Treating a 50-item candidate page as the whole Todo collection; silently removing saved selections outside loaded pages; writes during browsing/selection before Save.

## Implementation Requirements

1. Implement `docs/api-project-todo-links.md` exactly. Cardinality, source visibility/deletion, request fields, candidate pagination, read-only source view, transaction and version behavior are settled scope.
2. Add empty association storage and 0009 migration from 0008. Preserve all existing records/versions/cursors; do not backfill guessed links or seed user data.
3. Add only the two nested association endpoints. Lock the Project through the existing shared boundary and owned submitted Todos in deterministic order; validate before mutation. Persist link changes, one effective parent version/timestamp increment, and idempotency response atomically; never alter Todos or emit sync events.
4. Build independent Linked Todos display/editor with ordered selected references, all-status cursor-paginated candidates, unavailable placeholders, Save/Cancel, unchanged-payload retries, canonical readback, and parent refresh.
5. Add a bounded read-only source detail using existing GET Todo. Preserve Project context/focus; handle 401/404/410/retry and suppress stale reads/writes/pages/detail/readback on identity/Project changes.
6. Regress Project metadata/stages/milestones/AI Sessions/Dashboard/Today/Todo and existing sync behavior. Refresh/source navigation must not accidentally invoke mutation APIs.
7. Validate migration, persistence, ownership, shared Project version concurrency, and Todo-delete/link serialization on disposable PostgreSQL. Use synthetic fixtures; no configured-user DB mutation as a gate shortcut. The normal startup path applies implemented migrations before later runtime use.

## Acceptance Criteria

- [x] Existing/new Projects have no inferred links; one owned Todo can link to multiple Projects without copied or mutated source data.
- [x] Migration and constraints preserve existing Project/stage/milestone/Session/Todo/user data and sync cursors across upgrade/repeated-head/downgrade/re-upgrade.
- [x] GET/PUT enforce ownership, UUID/field/0-50/duplicate bounds, ordered membership, unavailable-source rules, and atomic invalid-request rollback.
- [x] Link/reorder/unlink/clear persist with no source mutation; Todo edits/status/deletion are reflected by current source projections and safe placeholders, without losing retained selections.
- [x] Idempotency/no-op/parent version/timestamp semantics are correct and concurrency with Project/stage/milestone writes plus Todo deletion respects the defined lock/visibility boundary.
- [x] PC handles paginated all-status candidates beyond the first page, explicit Save/Cancel, independent refresh/errors, stable retry payload/keys, and safe identity/Project switching across reads and writes.
- [x] Source detail reads the real Todo, handles unavailable/expired/error states, restores Project context/focus, and introduces no Todo mutation; existing feature/sync contracts regress.
- [x] Backend/Web tests, production build, desktop/narrow browser flows, disposable PostgreSQL evidence, and exact Git/security/whitespace checks pass or explicitly disposition environmental limits for Code Review.

## Verification Plan

- Backend: owner/auth/empty behavior, same Todo in two Projects, active/terminal/deleted source states, generic foreign/missing errors, retained unavailable references, duplicates/UUID/unknown/null/max bounds, order/no-op/clear/relink, idempotency replay/conflict, and full rollback.
- Verify no Todo field/version/timestamp/category/completion or sync cursor/row change from association PUT. Source edit/delete changes projection without parent bump; unavailable responses contain no deleted content.
- Disposable PostgreSQL: synthetic legacy data at 0008; upgrade without backfill; keyed API save/readback; constraint/ownership/foreign-key checks; concurrent Project PATCH/stage PUT/milestone PUT/link PUT preserve parent increments; concurrent link creation/Todo deletion yields the permitted serial outcomes. Repeat head, downgrade/re-upgrade, and preserve pre-existing data/cursors.
- Web: more than 50 all-status candidates with opaque cursor paging/deduplication, selections outside pages, unavailable retained items, reordering, limit validation, Save/Cancel, unchanged/changed retry keys, refresh-only readback failures, and late GET/PUT/page/detail responses after Project/identity switching.
- Source view: real Todo GET request, live metadata and note/category rendering, 404/410/401/retry, close/focus return, refresh after source changes, and no mutation request.
- Run backend `python -m pytest` with existing disposable PostgreSQL test-bin configuration, Web `npm test -- --run`, `npm run build`, and `npx playwright test`. Add focused 1280px/375px link/source flows and real disposable-API persistence evidence; distinguish stubbed browser from direct browser/backend coverage and report conditional skips honestly.
- Inspect exact changed/untracked/staged scope, `git diff --check`, cached whitespace, secrets/private fixtures, generated output, and test service cleanup. No live AI provider call is required.

## Risks

- Whole-list writes remain last-write-wins; locking guarantees transaction/version integrity, not multi-editor optimistic conflict handling.
- Source Todo state can change after a successful save. Canonical GET and explicit refresh, rather than copied state, keep source ownership/deletion meaningful.
- Candidate pagination must preserve existing selections that are absent from the current page. Source status/priority must not be used as an implicit link filter.
- Read-only source navigation is a new entry point into existing Todo records; isolate context/focus/race handling without widening Todo editing scope.
- Configured database was verified at 0008 during user-authorized startup on 2026-10-15. That does not apply the future 0009 or replace disposable migration/concurrency verification.

## Publication And Snapshot Scope

Base: main at `702c6759b82185a112607c3f1361add0c05969ea`; local HEAD, origin/main, and remote main matched with a clean worktree. TASK-035 terminal commit contains exactly its five authorized documents and passes whitespace checks. Do not repeat its Closure Check or edit its completed archive.

Proposed pre-Coding snapshot scope, including Task Review's gate/READY synchronization, is exactly these nine documents:

- `docs/api-project-todo-links.md`
- `docs/pc-delivery-plan.md`
- `handoff/current-task.md`
- `handoff/project-state.md`
- `handoff/task-review-gate.md`
- `handoff/code-review-gate.md`
- `handoff/git-snapshot.md`
- `handoff/git-commit.md`
- `tasks/TASK-036-pc-project-todo-links.md`

No business implementation, issue-log edit, or unknown pre-existing work is included. Task Review must independently approve exact scope before Git Snapshot.

## Decision Record

- 2026-10-15: verified TASK-035 terminal Closure Commit 702c675 and clean three-way parity; published this next bounded Project foundation slice.
- 2026-10-15: selected same-owner many-to-many references to preserve existing Todo/Android sync DTOs; unlink affects only a reference.
- 2026-10-15: earlier authorized startup applied 0007/0008 and the configured DB query confirmed 0008. Publication does not claim 0009 implemented/deployed.
- 2026-10-15: deferred P3 language issue, personal AI memory, self-iteration, and Agents remain outside scope.

## Coding Output Requirements

Report changed paths, schema/migration and cardinality/deletion policy, API/locking/version/idempotency evidence, no Todo/sync mutation proof, candidate paging/source-navigation behavior, all acceptance results, tests/build/browser/PostgreSQL checks, exact security/diff checks, limitations, and next role.

## Current Stage

Task Review: PASS at 2026-10-15 09:21 +08:00. Full evidence and the exact approved nine-file scope are in `handoff/task-review-gate.md`.

Git Snapshot: COMPLETE on branch `main`; base commit `702c6759b82185a112607c3f1361add0c05969ea`; snapshot commit `39872aa423abfa03092593797bb5e1f7630f4b89`.

Snapshot Reason: approved TASK-036 readiness documents required a durable pre-Coding baseline.

Next Role: Code Review

Required Next Action: independently review TASK-036 implementation and verification evidence. Git publication remains blocked until Code Review PASS.

## Coding Result

- Result: PASS (Coding verification; not Code Review approval)
- Task ID: TASK-036
- Final Status: REVIEWING
- Branch: main
- HEAD / Snapshot: `39872aa423abfa03092593797bb5e1f7630f4b89` (unchanged)
- Next Role: Code Review

### Modified Files

Exact working-tree scope, including the three pre-existing state files. `handoff/git-snapshot.md` is preserved unchanged by Coding; the other two state files retain their existing snapshot evidence and receive the completion handoff below.

- `backend/alembic/versions/20261015_0009_add_project_todo_links.py`
- `backend/app/api/v1/project_todo_links.py`
- `backend/app/api/v1/router.py`
- `backend/app/models/__init__.py`
- `backend/app/models/project_todo_link.py`
- `backend/app/schemas/project_todo_link.py`
- `backend/app/services/project_todo_links.py`
- `backend/tests/test_project_milestone_migration.py`
- `backend/tests/test_project_todo_link_migration.py`
- `backend/tests/test_project_todo_links.py`
- `docs/api-project-todo-links.md`
- `docs/pc-delivery-plan.md`
- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-036-pc-project-todo-links.md`
- `web/e2e/ai-sessions.spec.ts`
- `web/e2e/dashboard.spec.ts`
- `web/e2e/project-milestones.spec.ts`
- `web/e2e/project-stages.spec.ts`
- `web/e2e/project-todo-links.spec.ts`
- `web/e2e/projects.spec.ts`
- `web/src/App.tsx`
- `web/src/ProjectTodoDetail.test.tsx`
- `web/src/ProjectTodoDetail.tsx`
- `web/src/ProjectTodoLinks.test.tsx`
- `web/src/ProjectTodoLinks.tsx`
- `web/src/api.ts`
- `web/src/styles.css`
- `web/src/types.ts`

### Implementation Summary

- Empty normalized many-to-many association table, composite Project/Todo key, cascading foreign keys, nonnegative order constraint and owner/Project/order index; migration 0009 follows 0008 without inferred links. Existing milestone migration test changes only its expected head.
- Owner-scoped nested GET/full-list PUT, maximum 50 distinct UUIDs, forbidden extra fields, current seven-field source projection and unavailable placeholders. Retained unavailable references survive saves; new inaccessible/deleted references fail atomically.
- Reuses shared owned-Project lock and canonical idempotency hashing/replay. Locks submitted owned Todos in UUID order. Effective membership/order changes increment parent version/timestamp once; no-op preserves parent state and retained link creation times. Idempotency persistence failure rolls back the whole write.
- No Todo model/schema/write endpoint or sync behavior changes. Tests compare complete Todo rows, sync rows and sequence values before/after link writes. Unlink removes only the association.
- PC ordered editor uses all-status opaque cursor pagination, deduplication, off-page/unavailable selection retention, explicit Save/Cancel, stable unchanged-payload retry keys, canonical GET and parent refresh. Post-save readback failures retry refresh, not PUT.
- Read-only source detail uses existing Todo GET, live note/category/status/priority/date metadata, unavailable/auth/retry states, collection refresh on manual source refresh and close, and post-render focus restoration. Identity/Project changes suppress stale collection/page/write/detail/readback results.
- Contract body remains unchanged; header and delivery-plan progress updated only. Existing E2E files only add nested empty-link read stubs.

### Acceptance Criteria Results

1. PASS: empty new/existing Project state and many-to-many references covered; no source copying/mutation.
2. PASS: disposable PostgreSQL preserves synthetic legacy users/Projects/stages/milestones/Sessions/Todos and sync data/sequence across upgrade, repeated head, downgrade and re-upgrade; PK/FK/order constraints exercised.
3. PASS: auth/owner, missing/deleted parent/source, UUID/extra/null/duplicate/max validation, exact projection, retained unavailable references and rollback covered.
4. PASS: keyed save/readback, reorder/unlink/clear/relink, live source edits/deletion and safe inaccessible placeholders covered.
5. PASS: replay/conflict/no-op/version/timestamp and rollback covered. Real PostgreSQL concurrent Project PATCH/stage PUT/milestone PUT/link PUT preserves four parent increments. Deterministic barriers exercise both link-first and delete-first source lock outcomes.
6. PASS: beyond-50 candidate paging, opaque cursor/filter preservation, deduplication, selection cap, Cancel, retry/readback failures and identity/Project race matrix covered.
7. PASS: source GET-only behavior, live/deleted category metadata, 401/404/410/network retry, manual/close collection refresh and focus return covered; full existing regressions pass.
8. PASS with documented coverage limits below: backend/Web/build and desktop/narrow browser checks pass, disposable PostgreSQL runs, exact scope/security/whitespace checks pass.

### Verification Commands And Results

Executed on 2026-10-15. Backend commands run from `D:\LifeOS\backend`; Web commands from `D:\LifeOS\web`.

- `python -m pytest tests/test_project_todo_links.py -q --tb=short`: 12 passed.
- `$env:LIFEOS_TEST_PG_BIN='D:\PostgreSQL\18\bin'` then `python -m pytest tests/test_project_todo_link_migration.py -q --tb=short`: 1 passed; real disposable PostgreSQL migration/API/concurrency evidence.
- With the same PostgreSQL-bin environment, `python -m pytest`: 186 passed, no warnings; includes existing migration regressions and the new PostgreSQL test.
- `python -m alembic heads`: sole `20261015_0009 (head)`.
- `npm test -- --run src/ProjectTodoLinks.test.tsx src/ProjectTodoDetail.test.tsx`: 21 passed.
- `npm test -- --run`: 20 files, 180 passed.
- `npm run build`: PASS.
- `npx playwright test e2e/project-todo-links.spec.ts`: 2 passed (1280px/375px).
- `npx playwright test`: 14 passed / 2 skipped. Existing optional Project/AI Session direct-backend browser cases remain conditional skips; no new link test skipped.
- Desktop/narrow editor and saved-list screenshots visually inspected; no horizontal overflow or overlapping controls. Candidate selection assertions wait for selected-list state because selection intentionally removes a candidate from that list.
- No final test/build warnings observed. Git reports informational LF-to-CRLF conversion notices only.

### Git Diff Check

- Inspected `git status --short --untracked-files=all`, `git diff --stat`, `git diff`, `git diff --check`, and `git diff --cached`; exact 29-path scope above includes new files and preserved workflow state.
- `git diff --check` and `git diff --cached --check`: PASS; staging remains empty. New source/test files also checked for trailing whitespace and credential patterns, no matches.
- No secrets, tokens, `.env`, local databases, caches, screenshots or build/test artifacts in changed/untracked scope; no debug code, dependency churn or broad formatting.
- Three pre-existing state files preserved: current-task and task archive retain snapshot/decision records; git-snapshot content untouched by Coding. No stage, commit, push, destructive Git operation or Code Review performed.
- Disposable test clusters cleaned up by fixture. Pre-existing PostgreSQL services and old temporary directories were not stopped/deleted.

### Unresolved Issues And Coverage Limits

- No unresolved TASK-036 implementation blocker identified by Coding; independent Code Review remains required.
- Browser checks use synthetic API stubs. Actual API persistence/locking/migration evidence is FastAPI TestClient against disposable PostgreSQL, not a direct browser-to-real-backend acceptance claim.
- Configured user database was previously verified at 0008. Coding did not upgrade or re-query it; normal startup/deployment must apply 0009 before configured-database link use.
- Whole-list writes retain the approved last-write-wins policy. No optimistic multi-editor conflict protocol or link sync/SSE added.
- No live AI call, Android run or full PC cross-module real-backend acceptance executed: outside this slice.

### Task-Outside Findings

None added. Deferred ISSUE-20261011-001 remains outside scope and unchanged.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-10-15 09:57:58 +08:00
- Branch: `main`
- HEAD: `39872aa423abfa03092593797bb5e1f7630f4b89`
- Snapshot Commit: `39872aa423abfa03092593797bb5e1f7630f4b89`
- Blocking Issues: None.
- Non-blocking Suggestions: the configured user PostgreSQL revision is verified only through `20261014_0008`, so normal startup/deployment must apply `20261015_0009`; link browser flows use stubs while real persistence/migration/locking/delete serialization are covered through TestClient on disposable PostgreSQL; two existing optional live-backend browser cases remain conditionally skipped.
- Verification: focused backend `12 passed`; focused disposable PostgreSQL `1 passed`; full backend `186 passed`; focused Web `21 passed`; full Web `180 passed`; production build PASS; Playwright `14 passed / 2 conditional skipped`; Alembic sole head `20261015_0009`; desktop/narrow screenshots inspected; whitespace, scope, staging, security, and repository-artifact checks PASS. Pre-existing host PostgreSQL services were observed but not altered.
- Scope Conclusion: exact reviewed publish scope is 30 files, comprising the 29 Coding paths plus `handoff/code-review-gate.md`. No scope drift or unreviewed path is authorized.
- Final Task Status: `REVIEWING`; Git Commit owns transition to `COMPLETED` after successful publication.
- Recommended Commit Message: `feat(project): link todos to projects`
- Next Role: Git Commit
