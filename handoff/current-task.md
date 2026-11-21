# LifeOS Current Task

Last updated: 2026-11-20

## Metadata

- Task ID: TASK-039
- Task Name: PC Notes
- Status: READY
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

- [ ] Notes can be created, reopened, edited and deleted on PC, with exact field validation and correct empty/error/loading states.
- [ ] Project and Todo associations can be assigned/cleared independently, and an unavailable target leaves its note accessible.
- [ ] Foreign identities cannot read or mutate notes or assign or expose foreign sources. Archived Projects can be associated.
- [ ] Context actions open the correct filtered Notes view and prefill creation. Pagination and pickers work past the first page.
- [ ] Safe external URL validation/opening, mutation replay/no-op/version behavior and stale-response/retry handling are verified.
- [ ] Disposable PostgreSQL upgrade/downgrade and live API persistence preserve legacy Project/Todo/sync data. Existing feature regressions pass.
- [ ] Backend and Web tests, production build, desktop/narrow Playwright and scope/whitespace checks pass or record concrete environmental limits.

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

Next Role: Git Snapshot

Required Next Action: establish the pre-Coding Git Snapshot from the exact nine-document approved scope and independently verify branch, HEAD, remote parity, staged state, whitespace, secrets, private fixtures, and generated artifacts. Do not start Coding until Snapshot synchronizes both active task records to IN_PROGRESS.
