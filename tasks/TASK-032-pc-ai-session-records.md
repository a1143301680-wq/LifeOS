# TASK-032: PC AI Session records

Status: COMPLETED

Priority: P1

Parent: PC V1 MVP completion

Published by: Decision window

Published at: 2026-10-10

## Dependencies

- TASK-031 terminal Closure Commit `6acfaaf893d2ec6ac85cdfdd4bd9b396ecf63c8b`
- Existing owner-scoped Project/Goal API, bearer identity, response envelopes, idempotency service, and PC shell
- `docs/pc-delivery-plan.md` PC-first sequence

## Goal

A signed-in user can save and edit a structured AI Session under their own Project/Goal, see the latest session on project detail, and copy a continuation prompt to resume work later.

## Scope Summary

- Additive `ai_sessions` model/migration linked to a Project/Goal, with structured manual context, timestamps, version, and owner-scoped ordering.
- Authenticated nested create/list/detail/update API with bearer ownership, existing envelopes, idempotent writes, and no-op update semantics.
- PC Project detail session create/list/open/edit/latest-summary flow and copyable start, end-summary, and continuation prompt templates.
- Focused and full backend/Web tests, migration verification, build, browser flow, and scope/security checks.

## Contract

- Required `goal` 1-500 characters; optional AI tool at most 100; optional context fields at most 4000 each, trimmed with blank values normalized to null. `modified_files` is user-entered text, not a scan.
- Server-default `started_at`, nullable `ended_at >= started_at`, version 1 on create, one increment on effective update. Sessions list by `started_at DESC, id ASC`. Full time/write rules are below.
- Nested `/api/v1/projects/{project_id}/ai-sessions` POST/GET and `/{session_id}` GET/PATCH; missing, cross-owner, or wrong-project IDs return `404 not_found`.
- UUID `Idempotency-Key` on writes; replay/conflict as existing Project API; empty PATCH is `400 validation_error`, normalized no-op preserves version/timestamp, no `sync_changes` write.
- Continuation prompt is a local deterministic composition from saved project/session fields, not a DeepSeek or other provider call. Clipboard success and failure are visible.
- Full implementation instructions, file allowlist, exclusions, acceptance criteria, and verification are in `handoff/current-task.md`.

### Create And PATCH Field Contract

Create and PATCH accept exactly these fields and reject unknown/server-owned fields (`id`, `user_id`, `project_id`, `version`, `created_at`, `updated_at`):

| Field | Create | PATCH |
| --- | --- | --- |
| `goal` | Required, non-null | Optional; if supplied, non-null |
| `completed_work`, `modified_files`, `verification_result`, `remaining_issues`, `next_step`, `recommended_next_prompt`, `ai_tool`, `user_note` | Optional, nullable | Optional, nullable; explicit null clears |
| `started_at` | Optional; omission uses server current UTC time; explicit null invalid | Optional; non-null timestamp may replace existing value; null invalid |
| `ended_at` | Optional, nullable; omission means null | Optional, nullable; explicit null clears |

Both time fields accept only timezone-aware RFC 3339 timestamps. Reject naive values, normalize accepted values to UTC for storage/response, and compare instants. On create and every PATCH, validate the complete resulting record after merging stored and submitted values, including clearing: if `ended_at` is non-null it must be at or after `started_at`. This covers changing either timestamp alone and permits equality. Equivalent-offset values are no-ops after UTC normalization. Empty PATCH is `400 validation_error`; normalized no-op preserves version and `updated_at`, including on replay.

### Prompt Composition Contract

Compose locally from the saved session and current linked project as UTF-8 plain text. Use LF, no blank separator lines, and no trailing newline. Every included field is one `Label: value` line. For prompt rendering only, trim each text value and replace every run of whitespace, including line breaks, with one ASCII space; omit optional null/blank fields. Do not mutate saved values. Use stored project `type`/`status` enum values, decimal progress plus `%`, and no timestamps, IDs, or versions. Labels and order are fixed:

1. Shared lines for every template, after its title: `Project: {project.name}`, `Type: {project.type}`, `Status: {project.status}`, `Progress: {project.manual_progress}%`, optional `Project next step: {project.next_step}`, optional `AI tool: {session.ai_tool}`.
2. `Start collaboration` title, then shared lines, then `Session goal: {session.goal}`, optional `Completed work: {session.completed_work}`, optional `Remaining issues: {session.remaining_issues}`, optional `Next step: {session.next_step}`, optional `User note: {session.user_note}`, then the fixed final line `Request: Help me work on this session goal using the context above.`
3. `End-of-session summary` title, then shared lines, then `Session goal: {session.goal}`, optional `Completed work: {session.completed_work}`, optional `Modified files: {session.modified_files}`, optional `Verification result: {session.verification_result}`, optional `Remaining issues: {session.remaining_issues}`, optional `Next step: {session.next_step}`, optional `User note: {session.user_note}`, then the fixed final line `Request: Summarize this session and propose the next prompt using the context above.`
4. `Continue progress` title, then shared lines, then `Session goal: {session.goal}`, optional `Completed work: {session.completed_work}`, optional `Modified files: {session.modified_files}`, optional `Verification result: {session.verification_result}`, optional `Remaining issues: {session.remaining_issues}`, optional `Next step: {session.next_step}`, optional `User note: {session.user_note}`, then exactly one `Request: {value}` line. `value` is the first nonblank choice: rendered `session.recommended_next_prompt`; else `Continue with: {session.next_step}`; else `Continue with: {project.next_step}`; else `Help me work toward: {session.goal}`. The recommended value replaces only the fallback request text, not the shared/context lines.

## Boundaries

- No external chat import, automatic file/Git inspection, provider call, autonomous writes, delete/archive, Android, Dashboard, unified timeline, `project_logs`, Notes, Calendar, or stable Phase 1A contract changes.
- Architecture's `project_logs` recommendation remains for TASK-034 timeline integration; this task must deliver a usable standalone session loop first.
- No browser-supplied `user_id`, cross-identity leakage, secrets, machine paths, private fixtures, or generated output.

## Acceptance Criteria

- [x] Session migration/model and nested API satisfy owner/project isolation, validation, ordering, idempotency, and version/no-op rules.
- [x] Create omission/default, supplied and equivalent-offset timestamps, single-field time edits, clearing `ended_at`, invalid merged-state ranges, and replay are covered.
- [x] PC can create, open, edit, and reopen a real AI Session, with latest summary visible on project detail.
- [x] All three prompt templates match exact full/sparse expected output, including recommended/fallback rules and clipboard failure, without external provider traffic.
- [x] Loading/empty/error/retry, identity/project switch, and desktop/narrow behavior are verified.
- [x] Full backend/Web suites, build, disposable migration, browser flow, and diff/security/scope checks pass or report exact limits.
- [x] Future-module, Android, provider, timeline, and autonomous-write boundaries remain intact.

## Verification Plan

- Focused backend API/model tests and full backend suite.
- Field allowlist, timestamp default/UTC/merged-range, null clearing, no-op, and idempotent replay tests.
- Disposable migration apply/schema/downgrade check, without mutating the configured user database.
- Focused PC component/browser flows and exact full/sparse prompt-output tests; full Web suite and production build.
- Exact diff, staged, whitespace, credential, private-data, and generated-output scans.

## Current Stage

Task Review Result: PASS

Reviewed At: 2026-10-10 10:14 +08:00

Git Snapshot Status: COMPLETE

Branch: `main`

Base Commit: `6acfaaf893d2ec6ac85cdfdd4bd9b396ecf63c8b`

Snapshot Commit Created: Yes

Snapshot Commit: `e22e94004b645f60acc912090fc9baa8715a8eba`

Snapshot Reason: approved TASK-032 readiness documents required a durable pre-Coding baseline

Target Status: REVIEWING

Previous Blocking Issues: the 10:04 Task Review rejected ambiguous timestamp mutability/resulting-range semantics and underspecified prompt templates. Decision revised both contracts; the 10:14 fresh review verified both resolutions.

Blocking Issues: None. Full fresh-review evidence and prior REJECT history are retained in `handoff/task-review-gate.md`.

Next Role: Decision

Required Next Action: perform the Decision Closure Check using Result Commit `500d3172a062bbd3c57db8c5af14681e724bbc3b` and the completion record.

## Coding Result

- Result: PASS; final status: REVIEWING. No commit or push.
- Modified Files: `backend/alembic/env.py`, `backend/alembic/versions/20261010_0006_add_ai_sessions.py`, `backend/app/api/v1/ai_sessions.py`, `backend/app/api/v1/router.py`, `backend/app/models/__init__.py`, `backend/app/models/ai_session.py`, `backend/app/schemas/ai_session.py`, `backend/tests/test_ai_sessions.py`, `web/src/App.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`, `web/src/App.ai-sessions.test.tsx`, `web/src/ai-session-prompts.test.ts`, `web/e2e/ai-sessions.spec.ts`, `web/e2e/projects.spec.ts`, `docs/pc-delivery-plan.md`, and active TASK-032 handoff/task records. The pre-existing `handoff/git-snapshot.md` change was preserved unchanged.
- Implementation Summary: Added owner-scoped AI Session persistence and additive migration; nested bearer-authenticated create/list/detail/update endpoints with shared idempotency replay/conflict, UTC time validation, deterministic order, and effective/no-op version rules. Added Project detail session create/list/open/edit/latest-summary and three local copyable prompts. No provider request, sync write, project log, or Dashboard work.
- Acceptance Criteria Results: All seven task criteria met by focused automated tests and a disposable PostgreSQL-backed browser flow. Owner/project mismatch returns 404; session text and time validation, replay, no-op, identity switching, clipboard outcomes, and responsive layout are covered.
- Verification Commands and Results: `python -m pytest -q` in `backend`: 136 passed. `npm test` in `web`: 125 passed across 13 files. `npm run build` in `web`: PASS. `npx playwright test` in `web`: 6 passed, 2 conditionally skipped live-backend cases; `npx playwright test e2e/ai-sessions.spec.ts --grep 'disposable PostgreSQL backend'` with a temporary synthetic token/backend: 1 passed. Disposable PostgreSQL Alembic `upgrade head`, schema/index/check/FK inspection, then `downgrade -1`: PASS; temporary schema dropped. Normal Playwright run reported only `NO_COLOR`/`FORCE_COLOR` environment warnings; no backend/Web test warnings were reported.
- Git Diff Check: reviewed tracked/untracked changes against the task allowlist; `git diff --check` passed (Git emitted LF-to-CRLF conversion notices only). Staging remained empty. Targeted secret/path scan found only a synthetic bearer-token assertion in a test, no credential or machine path. No generated outputs appear in Git status.
- Unresolved Issues: configured user PostgreSQL database was intentionally not migrated. Its revision must be verified and upgraded through `20261010_0006` before using AI Session endpoints outside the disposable test schema.
- Task-Outside Findings: none. Existing PostgreSQL service remained running; only the temporary test API server and schema were removed.

## Code Review Result

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-10-10 20:36 +08:00
- Blocking Issues: None.
- Findings: migration/model, bearer owner and parent isolation, exact field/time validation, UUID idempotency, merged-state range checks, normalized no-op semantics, deterministic ordering, no-sync boundary, PC session flow, stale-response protection, and exact local prompt templates match the approved contract.
- Independent Verification: focused backend 6 passed; full backend 136 passed; focused Web 8 passed; full Web 125 passed; production build PASS; Playwright 6 passed / 2 conditional tests skipped; `git diff --check` and cached check PASS; staging empty.
- Migration Evidence: one Alembic head at `20261010_0006`; migration source and registration reviewed. Coding's disposable PostgreSQL upgrade/schema inspection/downgrade and conditional persisted browser flow passed. Code Review did not modify the configured user database, whose current revision was not confirmed during the bounded check.
- Residual Risk: the normal runtime/deployment path must verify and upgrade the configured PostgreSQL database through `20261010_0006` before AI Session endpoints are used there.
- Reviewed Scope: the 20 Coding/snapshot files listed above plus `handoff/code-review-gate.md`.
- Recommended Commit Message: `feat(ai-session): add project AI Session records`
- Authorization: Git Commit may commit and push the exact reviewed scope. Keep task status `REVIEWING` until publication succeeds.
- Next Role: Git Commit.

## Git Commit

- Status: COMPLETE
- Result Commit: `500d3172a062bbd3c57db8c5af14681e724bbc3b`
- Commit Message: `feat(ai-session): add project AI Session records`
- Push Target: `origin/main`
- Remote Parity: PASS; local HEAD, `origin/main`, and remote `refs/heads/main` matched after push.
- Code Review: PASS
- Next Role: Decision

## Closure

- Closure Check: PENDING
- Terminal Closure Commit: not authorized until Decision records a PASS and exact closure-file allowlist.
