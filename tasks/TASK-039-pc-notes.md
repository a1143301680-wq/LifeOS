# TASK-039: PC Notes

Last updated: 2026-11-21

## Metadata

- Task ID: TASK-039
- Task Name: PC Notes
- Status: REVIEWING
- Priority: P1
- Parent Task: PC V1 MVP completion
- Dependencies: TASK-038 terminal Closure Commit `08702c9ae28ff136b2ae8cedd02713740e00bb4e`; existing Project and Todo APIs; migration 20261109_0011
- Contract: `docs/api-notes.md` (approved by Task Review)

## Goal

Capture a plain-text note, optionally associate it with a Project and a Todo, and find it again from either context. Support adding an external knowledge-base URL.

## In Scope

- Owner-scoped note storage and API for create, list, read, edit and soft delete.
- Optional Project and Todo references, unavailable-source handling, external URL validation, and contextual navigation.
- PC Notes views and migration/API, Web and browser verification.
- Record TASK-038 terminal closure in the roadmap and project state.

## Out Of Scope

- Android and cross-device Notes sync, Calendar, AI/Agent/memory, Notes search and folders, Markdown editor, attachments and external knowledge retrieval.
- Writes to linked Project/Todo records, changes to existing API contracts, older migrations, completed archives, or configured database deployment.

## Relevant Files

- `docs/api-notes.md`, `docs/requirements.md` sections 14-15, `docs/mvp.md` Phase 4, `docs/pc-delivery-plan.md`, and `docs/api-project-lifecycle.md` for archived/deleted behavior.
- Existing backend models, owner resolution, Project/Todo list routes, idempotency/envelopes, Alembic revision 20261109_0011 and disposable PostgreSQL tests.
- `web/src/App.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`, and existing Project/Todo tests.
- Search issue-log.md for TASK-039 and deferred ISSUE-20261011-001.

## Allowed Files

- New Notes model/schema/service/API and scoped registration, new migration `backend/alembic/versions/20261120_0012_add_notes.py`, new Notes tests and focused existing fixture/head updates.
- Web files above, focused new Notes components/tests, new `web/e2e/notes.spec.ts` and scoped regression fixtures.
- Notes contract status header, delivery plan progress and active TASK-039 workflow documents as owned by each role. Contract body changes return to Decision.

## Implementation Requirements

1. Implement the Notes contract and additive migration. Retain existing legacy records and source behavior.
2. Apply owner checks to note access, association assignment and response projections. Preserve notes after source soft deletion.
3. Implement write validation, idempotency, note-row locking and version rules, plus scoped cursor pagination.
4. Deliver a usable Notes list/detail/editor, explicit delete confirmation, source-specific entry points and safe external links. Guard async results and retries across context changes.

## Acceptance Criteria

- [x] Notes can be created, reopened, edited and deleted on PC, with exact field validation and correct empty/error/loading states.
- [x] Project and Todo associations can be assigned/cleared independently, and an unavailable target leaves its note accessible.
- [x] Foreign identities cannot read or mutate notes or assign or expose foreign sources. Archived Projects can be associated.
- [x] Context actions open the correct filtered Notes view and prefill creation. Pagination and pickers work past the first page.
- [x] Safe external URL validation/opening, mutation replay/no-op/version behavior and stale-response/retry handling are verified.
- [x] Disposable PostgreSQL upgrade/downgrade and live API persistence preserve legacy Project/Todo/sync data. Existing feature regressions pass.
- [x] Backend and Web tests, production build, desktop/narrow Playwright and scope/whitespace checks pass or record concrete environmental limits.

## Verification Plan

- Backend: schema constraints, ownership, source states, URL validation, filtered pagination/ties/cursor binding, idempotency/no-op and concurrent update/delete.
- Disposable PostgreSQL: migrate 0011 to 0012, exercise persistence and source preservation, and verify downgrade/re-upgrade. Keep configured database untouched.
- Web and Playwright: standalone/context capture, linked retrieval, delete confirmation, pagination, unavailable links, retry and identity switching at 1280px and 375px. Distinguish mocked browser evidence from disposable real API verification. Run full backend and Web suites and build.

## Risks

- Separate source projection from persisted association IDs so deleted targets cannot leak titles and existing notes remain editable.
- Reuse existing Project/Todo source paths so contextual navigation does not interfere with source mutations or stale identity guards.

## Publication And Snapshot Scope

Base main: `08702c9ae28ff136b2ae8cedd02713740e00bb4e`. Local HEAD, origin/main and remote main matched at TASK-038 terminal closure, with clean worktree before publication.

- `docs/api-notes.md`
- `docs/pc-delivery-plan.md`
- `handoff/current-task.md`
- `handoff/project-state.md`
- `handoff/task-review-gate.md`
- `handoff/code-review-gate.md`
- `handoff/git-snapshot.md`
- `handoff/git-commit.md`
- `tasks/TASK-039-pc-notes.md`

Task Review verifies the exact nine-document readiness scope before Git Snapshot.

## Coding Output Requirements

Report changed paths, API and migration behavior, browser and backend verification, acceptance evidence, limits and next role.

## Current Stage

Git Snapshot: COMPLETE on branch main; base 08702c9ae28ff136b2ae8cedd02713740e00bb4e; snapshot 4b4f7f510df20cce6e03b56769f6c1428edcf929.

Snapshot Reason: approved TASK-039 readiness documents required a durable pre-Coding baseline.

Next Role: Git Commit

Required Next Action: verify and publish the exact Reviewed Scope in `handoff/code-review-gate.md`.

## Coding Result

- Result: PASS
- Task ID: TASK-039
- Final Status: REVIEWING
- Branch and snapshot: `main`, `4b4f7f510df20cce6e03b56769f6c1428edcf929`
- Next Role: Code Review

### Modified Files

Exact working-tree scope of 24 paths, including the pre-existing snapshot record and two active task records.

- `backend/alembic/versions/20261120_0012_add_notes.py`
- `backend/app/api/v1/notes.py`
- `backend/app/api/v1/router.py`
- `backend/app/models/__init__.py`
- `backend/app/models/note.py`
- `backend/app/schemas/note.py`
- `backend/app/services/notes.py`
- `backend/tests/test_notes.py`
- `backend/tests/test_notes_migration.py`
- `backend/tests/test_project_log_migration.py`
- `backend/tests/test_project_milestone_migration.py`
- `backend/tests/test_project_todo_link_migration.py`
- `docs/api-notes.md`
- `docs/pc-delivery-plan.md`
- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-039-pc-notes.md`
- `web/e2e/notes.spec.ts`
- `web/src/App.tsx`
- `web/src/NotesSourcePicker.tsx`
- `web/src/NotesWorkspace.tsx`
- `web/src/api.ts`
- `web/src/styles.css`
- `web/src/types.ts`

### Implementation And Acceptance

1. PASS. Notes supports create/list/detail/edit and confirmed soft delete. Title/content limits are checked after trimming, optional blanks become null, and the UI handles loading, empty and error states.
2. PASS. Project and Todo references are independently assignable and clearable. A target's soft deletion retains the note and association while hiding the target label. Notes writes preserve source rows and sync state.
3. PASS. Bearer ownership scopes notes and reference projections. Missing, foreign and deleted assignments return 404. Archived owned Projects remain eligible.
4. PASS. Project detail and Todo editor open filtered Notes with a prefilled new draft and a return action. Todo draft edits survive the round trip. Notes and Todo picker pages use server cursors. Project choices include both scopes and are revealed in batches from the existing unpaginated Project APIs.
5. PASS. The backend validates HTTP(S) URLs locally, and the rendered anchor uses explicit interaction and `noopener noreferrer`. API and browser tests cover no-op/version behavior, replay, same-key retry, filtered cursor binding and stale identity response rejection.
6. PASS. Disposable PostgreSQL migration 0011 -> 0012 -> 0011 -> 0012 preserves legacy snapshots, tests real API persistence, and orders PATCH/DELETE in both directions using overlapping transactions.
7. PASS with verification limits below. Browser coverage includes desktop/narrow capture, reopen, editing, confirmation/cancellation, linked retrieval, Notes and Todo pagination, Project choice batches, unavailable sources, contextual return and identity switching. The narrow header was adjusted to contain its two navigation rows after visual verification.

### Verification Commands And Results

- Backend `python -m pytest tests/test_notes.py -q --tb=short`: 16 passed.
- Backend `$env:LIFEOS_TEST_PG_BIN='D:/PostgreSQL/18/bin'`, then `python -m pytest -q --tb=short`: 226 passed, including disposable PostgreSQL tests.
- Backend `python -m alembic heads`: sole head `20261120_0012`.
- Web `npm test -- --run`: 205 passed across 21 files.
- Web `npm run build`: PASS.
- Web `npx playwright test e2e/notes.spec.ts`: 2 passed at 1280px and 375px. Full `npx playwright test`: 20 passed and two existing conditional skips for direct-backend Project and AI Session tests. Playwright reported the existing color environment notice. The first focused run revealed ambiguous select labels, resolved with explicit label bindings.
- Notes browser cases use API stubs. Real persistence and transaction verification used FastAPI TestClient with disposable PostgreSQL. The configured user database was not migrated or queried. Frontend-only preview HTTP GET returned 200 at `http://127.0.0.1:5173`.

### Git Diff Check

Working-tree and cached whitespace checks pass. The index is empty, HEAD matches the snapshot, and tracked and untracked paths match the scope above. New-file whitespace, artifact and credential-pattern scans pass. The pre-existing snapshot and review gate remain intact.

### Unresolved Issues

Independent Code Review and configured database deployment remain pending.

### Task-Outside Findings

None recorded.

## Code Review Result

- Result: CHANGES_REQUESTED
- Target Status: CHANGES_REQUESTED
- Reviewed at: 2026-11-21 21:56 +08:00
- Branch / HEAD / Snapshot: main / `4b4f7f510df20cce6e03b56769f6c1428edcf929`
- P1 CR-TASK-039-001: leaving Notes during a pending create and reopening it allowed a second POST with a different key. Preserve or guard the pending attempt, draft and retry key across navigation.
- Independent verification: backend 226 passed with disposable PostgreSQL, Web 205 passed, build passed, Playwright 20 passed with two conditional skips, sole Alembic head 0012. Targeted browser probe confirmed the blocker.
- Exact scope and verification details: `handoff/code-review-gate.md`.
- Next Role: Coding. Publication is blocked pending re-review.

## Coding Rework Result

- Finding: CR-TASK-039-001
- Result: PASS
- Final Status: REVIEWING
- Next Role: Code Review
- Snapshot: `4b4f7f510df20cce6e03b56769f6c1428edcf929` on `main`

### Changes And Evidence

- `web/src/App.tsx` keeps the identity-scoped Notes workspace mounted across view navigation and resumes unresolved work on re-entry. Contextual return can reopen the original Project after Dashboard clears its detail. Identity reset discards the old workspace.
- `web/src/NotesWorkspace.tsx` preserves the draft, pending guard and ambiguous retry key in the retained workspace and invalidates pending source navigation when hidden.
- `web/e2e/notes.spec.ts` verifies a held POST remains the only request after Notes -> Dashboard -> Notes. It then simulates a committed create with a dropped response and verifies the same key is reused and the stub records only one logical creation. The scenarios preserve contextual associations and return navigation. Identity switching clears the prior draft and ignores a late list response.

### Verification

- `npm test -- --run`: 205 passed across 21 files.
- `npm run build`: passed.
- `npx playwright test e2e/notes.spec.ts`: 2 passed at 1280px and 375px.
- `npx playwright test`: 20 passed and two existing conditional direct-backend skips. Notes uses API stubs. Playwright emitted the existing color environment notice. An initial run exposed the cleared Project detail after Dashboard navigation, which the final re-run verified was restored.
- Backend tests were not repeated for the Web-only rework. Original backend evidence remains above.
- Working and cached whitespace checks passed. The 26-path working tree matches Code Review scope and staging is empty. This rework touches only the three Web files above and both active task records. Historical review and snapshot evidence remain available for re-review.

## Code Re-review Result

- Result: CHANGES_REQUESTED
- Target Status: CHANGES_REQUESTED
- Reviewed at: 2026-11-21 22:12 +08:00
- HEAD / Snapshot: `4b4f7f510df20cce6e03b56769f6c1428edcf929`.
- CR-TASK-039-001: verified at both viewport widths. Navigation preserves the pending request and unchanged retry key.
- CR-TASK-039-002 (P2): opening Project B Notes while a Project A draft is retained shows the A draft and association. Independently reproduced on the production build with stubbed APIs.
- Verification: 205 Web tests passed, production build passed, Playwright 20 passed with two existing conditional skips. Exact 26-path scope and whitespace checks passed. Prior backend evidence remains applicable to this Web-only rework.
- Next Role: Coding. Git publication remains blocked by CR-TASK-039-002.

## Coding Rework Result For CR-TASK-039-002

- Result: PASS
- Final Status: REVIEWING
- Next Role: Code Review
- Snapshot: `4b4f7f510df20cce6e03b56769f6c1428edcf929` on `main`

### Changes And Verification

- `web/src/App.tsx` retains unfinished Notes workspaces by source kind and ID for the current identity. Contextual navigation opens the requested source, and a labeled Resume action selects other retained work. Each workspace keeps its own return target.
- `web/src/NotesWorkspace.tsx` reports retention by workspace ID. Drafts, pending writes and retry keys remain in their original workspace. A contextual Todo return can reopen its original editor when needed.
- `web/e2e/notes.spec.ts` verifies that Project B opens with its own filter, empty editor prefilled for B, and return to B while A retains a draft after a lost response. Explicit resume restores A's draft and association, retries with the original key, records one logical creation in the stub, and returns to A. Delayed POST and identity reset checks remain covered.
- `npm test -- --run`: 205 passed across 21 files. `npm run build`: passed.
- `npx playwright test e2e/notes.spec.ts`: 2 passed at 1280px and 375px. Full `npx playwright test`: 20 passed and two existing conditional direct-backend skips. Notes used API stubs. Playwright reported the color environment notice and Vite logged a sync proxy connection warning for unavailable port 8000.
- Backend verification was not repeated for this Web-only rework. Existing disposable PostgreSQL evidence is recorded above.
- Working and cached whitespace checks passed. The 26-path worktree matches the reviewed scope, staging is empty and HEAD matches the snapshot. Changes in this rework are limited to the three Web paths above and the two active task records.

## Final Code Re-review Result

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-11-21 22:42 +08:00
- Branch / HEAD / Snapshot: main / `4b4f7f510df20cce6e03b56769f6c1428edcf929`.
- CR-TASK-039-001 and CR-TASK-039-002 are verified. No remaining blocking issues.
- Build passed. Playwright 20 passed with two conditional skips. The standalone Web suite passed 205 after two unchanged Timeline tests failed in the initial concurrent run.
- Reviewed scope: exactly the 26 files listed in `handoff/code-review-gate.md`. Whitespace checks passed and staging was empty.
- Final task status: REVIEWING. Next Role: Git Commit.
- Recommended commit message: `feat(notes): add PC Notes workspace`
