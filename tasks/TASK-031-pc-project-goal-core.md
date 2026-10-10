# TASK-031: PC Project/Goal core

Status: COMPLETED

Priority: P1

Parent: PC V1 MVP completion

Published by: Decision window

Published at: 2026-10-09

## Dependencies

- TASK-030 terminal Closure Commit `da506ae691b822dc022485e1272594534943e1b4`
- Existing bearer identity, response/error envelope, idempotency service, and PC shell
- `docs/pc-delivery-plan.md` PC-first sequence

## Goal

A signed-in user can create, list, open, edit, and pin their own Project/Goal with manual progress and next step, creating a durable base for AI Session and Dashboard slices.

## Scope Summary

- User-owned `projects` migration/model with UUID identity, name/description, type/status, manual progress, next step, pin, version, and timestamps.
- Bearer-authenticated `POST /projects`, `GET /projects`, `GET /projects/{id}`, and `PATCH /projects/{id}` under `/api/v1`, with current-user isolation and idempotent writes.
- PC Projects/Goals navigation, list/detail, create/edit/pin forms, loading/empty/error states, and identity switch protection.
- Backend/frontend regression tests, migration verification, production build, and desktop/narrow browser checks.

## Contract

- Types: `development`, `learning`, `life`, `health`, `pet`, `other`; statuses: `planning`, `in_progress`, `paused`, `completed`, `abandoned`.
- Name: trimmed 1-200 characters; description: at most 2000; next step: at most 1000; blank optional text becomes null. Progress: integer 0-100. Defaults: `other`, `planning`, 0, false pin, version 1.
- List: bearer user's projects only, ordered pinned first, then `updated_at DESC, id ASC`. Missing/cross-user detail or update: `404 not_found`.
- Create/PATCH: UUID `Idempotency-Key`, replay/conflict semantics from existing writes, no duplicate project or double version increment on replay. Empty PATCH returns `400 validation_error`; a nonempty normalized no-op returns the unchanged record/version/timestamp, including on replay.
- Existing data/list/error envelopes apply. No `sync_changes` write for projects in this slice.
- Full implementation instructions, file allowlist, exclusions, and verification are in `handoff/current-task.md`.

## Boundaries

- No project delete/archive, stages, milestones, Todo links, logs/timeline, AI Sessions, Dashboard, Notes, Calendar, Android, autonomous writes, or changes to stable Phase 1A contracts.
- No browser-supplied `user_id`, shared records across identities, credentials, private fixtures, machine paths, or generated artifacts.
- Project/Goal CRUD depth is completed in later PC tasks; this slice must still deliver a working create-to-edit loop.

## Acceptance Criteria

- [x] Migration/model and owner-scoped API contract are correct and tested.
- [x] Two identities remain isolated across list/detail/create/update.
- [x] Idempotency, malformed input, no-op update, version changes, and deterministic order are covered.
- [x] PC creates, lists, opens, edits, pins, and reopens a project through the backend.
- [x] Loading/empty/error/retry, identity switch, and desktop/narrow use are verified.
- [x] Full backend/Web suites, build, migration check, browser flow, diff/security/scope checks pass or report exact limits.
- [x] No future-module or Android scope breach occurs.

## Verification Plan

- Focused backend model/API tests and full backend suite.
- Disposable migration application or exact environment limitation.
- Focused component/browser flows, full Web suite, and production build.
- Exact diff, staged, whitespace, credential, private-data, and generated-output scans.

## Workflow History

- 2026-10-09: Decision verified TASK-030 terminal Closure Commit `da506ae`, clean worktree, and local/tracking/remote parity.
- 2026-10-09: User directed PC V1 completion ahead of Android work; Decision published the PC delivery plan and TASK-031 as its first slice.

## Current Stage

- Task Review Result: PASS
- Reviewed At: 2026-10-09 19:48 +08:00
- Git Snapshot Status: COMPLETE
- Branch: `main`
- Base Commit: `da506ae691b822dc022485e1272594534943e1b4`
- Snapshot Commit Created: Yes
- Snapshot Commit: `8464846013236887e3e477d6ad5ef0db16dabbad`
- Snapshot Reason: approved TASK-031 readiness documents required a durable pre-Coding baseline
- Target Status: COMPLETED
- Blocking Issues: None
- Evidence: `handoff/task-review-gate.md`
- Next Role: Git Commit
- Required Next Action: commit and push the exact Code Review PASS scope, then transition the task to `COMPLETED` only after publication succeeds.

## Coding Result

- Result: PASS; final status `REVIEWING`. No commit, push, or Code Review was performed by Coding.
- Modified Files: `backend/alembic/env.py`, `backend/alembic/versions/20261009_0005_add_projects.py`, `backend/app/api/v1/router.py`, `backend/app/api/v1/projects.py`, `backend/app/models/__init__.py`, `backend/app/models/project.py`, `backend/app/schemas/project.py`, `backend/tests/test_projects.py`, `web/src/App.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`, `web/src/App.projects.test.tsx`, `web/e2e/projects.spec.ts`, `docs/pc-delivery-plan.md`, `handoff/current-task.md`, and this task archive. Pre-Coding `handoff/git-snapshot.md` remains untouched.
- Implementation Summary: Added owner-scoped Project model/migration with defaults, checks, index, and four authenticated API routes. POST/PATCH reuse canonical request hashing and stored idempotency replay; normalized PATCH no-op preserves version and timestamp. Added PC Project/Goal navigation, list/detail/create/edit/pin, recoverable failures, identity-switch and stale-list request guards. No project sync changes or future-module behavior.
- Acceptance Criteria Results: All seven criteria above met. Two-user API isolation, payload field restrictions, validation, no-op/replay/conflict, and deterministic list order have focused tests. Browser paths cover desktop and 375px widths; a separate disposable-backend browser test persisted an edit across page reload.
- Verification Commands and Results: `python -m pytest tests/test_projects.py -q` 7 passed; `python -m pytest -q` 130 passed; `npm test` 117 passed; `npm run build` passed; `npx playwright test` 4 passed, 1 intentionally skipped without a disposable-backend token; the skipped test was run separately with a temporary SQLite-backed FastAPI service and passed (1 passed). PostgreSQL Alembic `upgrade head` from empty schema, project column/index/check inspection, and `downgrade -1` passed in a disposable schema; that schema was cleaned. Temporary SQLite database and API service were also cleaned/stopped.
- Git Diff Check: `main` HEAD remains snapshot `8464846013236887e3e477d6ad5ef0db16dabbad`; staged diff empty. `git diff --check` passed with LF-to-CRLF working-copy warnings only. Modified/untracked files are within the TASK-031 allowlist; no secret, private key, raw token, machine path, generated build output, or Android/future-module edit was found. The three pre-existing workflow state files were preserved.
- Unresolved Issues: None in implementation. PostgreSQL Windows service was stopped on the resumed day and this shell could not start it; no repeat live PostgreSQL browser run was made. The PostgreSQL migration had already passed in a disposable schema before that environmental change; real API browser persistence was verified with disposable SQLite.
- Task-Outside Findings: None requiring an issue-log entry.

## Code Review Result

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-10-10 09:50 +08:00
- Blocking Issues: None.
- Findings: Project migration/model, owner isolation, API envelopes, UUID idempotency, normalized no-op semantics, version increments, deterministic ordering, no-sync boundary, PC create/list/detail/edit/pin flow, stale identity protection, and scope exclusions match the approved contract.
- Independent Verification: focused backend 7 passed; full backend 130 passed; focused Web 5 passed; full Web 117 passed; production build PASS; Playwright 4 passed / 1 conditional test skipped in the ordinary run; Coding's separately persisted disposable-backend run passed 1/1; `git diff --check` and cached check PASS; staging empty.
- Migration Evidence: one Alembic head at `20261009_0005`; migration source and registration reviewed. Coding's disposable PostgreSQL upgrade/schema inspection/downgrade passed. The configured local database remains at `20260713_0004` and was not modified by Code Review.
- Residual Risk: the normal runtime/deployment path must apply migration `20261009_0005` before Project endpoints are used against the configured local PostgreSQL database.
- Reviewed Scope: the 17 Coding files listed above plus `handoff/code-review-gate.md`.
- Recommended Commit Message: `feat(project): add Project Goal core`
- Authorization: Git Commit may commit and push the exact reviewed scope. Keep task status `REVIEWING` until publication succeeds.
- Next Role: Git Commit.

## Git Commit

- Status: COMPLETE
- Branch: `main`
- Result Commit: `79be9625571714e085fb51fb446653e61213c5f7`
- Commit Message: `feat(project): add Project Goal core`
- Push Target: `origin/main`
- Remote Parity: PASS; local HEAD, `origin/main`, and remote `refs/heads/main` matched after push.
- Code Review Result: PASS
- Next Role: Decision

## Closure

Result: PASS

Checked at: 2026-10-10 09:55 +08:00

Result Commit: `79be9625571714e085fb51fb446653e61213c5f7`

Completion Commit: `8c668af61711b698c84a76a15807b180bc65ba72`

Remote Verification: local `HEAD`, `origin/main`, and remote `refs/heads/main` all matched completion commit `8c668af61711b698c84a76a15807b180bc65ba72` before Closure-document edits.

Working Tree Before Closure Docs: clean; no staged, unstaged, or untracked files.

### Independent Verification

- Snapshot `8464846` is an ancestor of result commit `79be962`; result commit is an ancestor of completion commit `8c668af`.
- The result commit matches the 19-file final Code Review allowlist, and the completion commit contains only four workflow/state files.
- Focused backend Project API tests: 7 passed independently; final Code Review ran the full backend suite with 130 passed.
- Focused PC Project component tests: 5 passed independently; final Code Review ran the full Web suite with 117 passed, production build PASS, and standard Playwright 4 passed with one conditional disposable-backend case separately passed by Coding.
- Alembic has one head `20261009_0005`. The configured PostgreSQL database is at `20260713_0004`. Coding's disposable PostgreSQL upgrade, schema/index/check inspection, and downgrade passed; Decision did not migrate the user's database.
- Source inspection confirms bearer-scoped list/detail/update, existing idempotency replay/conflict, normalized no-op PATCH preservation, and no Project sync-change writes. PC UI covers create/list/detail/edit/pin and stale-identity suppression.
- Code Review: PASS; no unresolved TASK-031 blocking issue. Published commits passed whitespace checks and had no Android or future-module files.

### Residual Risk And Next Step

- Before demonstrating Project endpoints against the configured local PostgreSQL database, run the normal startup/deployment migration to `20261009_0005`; the launcher applies pending migrations before serving the UI.
- After terminal closure, Decision may publish TASK-032 structured AI Session records, followed by the focused Dashboard/Resume slice in `docs/pc-delivery-plan.md`.

### Terminal Closure Authorization

- Approved files: `docs/pc-delivery-plan.md`, `docs/phase1a-progress.md`, `docs/phase1a-completion-audit.md`, `handoff/current-task.md`, `handoff/project-state.md`, and `tasks/TASK-031-pc-project-goal-core.md`.
- Recommended commit message: `docs(task): close TASK-031`.
- After this exact-scope commit is pushed and remote parity is verified, return to Decision without another Closure Check.
