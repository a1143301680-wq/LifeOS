# LifeOS Current Task

Last updated: 2026-10-10

## Metadata

- Task ID: TASK-032
- Task Name: PC AI Session records
- Status: COMPLETED
- Priority: P1
- Parent Task: PC V1 MVP completion
- Dependencies: TASK-031 terminal Closure Commit `6acfaaf893d2ec6ac85cdfdd4bd9b396ecf63c8b`; existing Project/Goal API, bearer identity, idempotency service, and PC shell

## Background

TASK-031 provides owner-scoped Project/Goal records and PC list/detail/edit. The next demonstration slice needs a durable record of AI collaboration on a project and a prompt the user can copy to continue later. `docs/pc-delivery-plan.md` places the focused Dashboard after this task.

## Goal

A signed-in user can manually save an AI Session under their own Project/Goal, edit and reopen it, see the latest session on project detail, and copy a deterministic continuation prompt.

## In Scope

- Add one owner-scoped `ai_sessions` table and Alembic migration, linked to an existing project.
- Add authenticated create, list, detail, and update endpoints under `/api/v1/projects/{project_id}/ai-sessions`.
- Add typed request/response models, validation, bearer-derived owner checks, deterministic list order, and idempotent writes following the existing Project API.
- Add a usable AI Session section to PC Project/Goal detail with create, edit, list, latest summary, and copyable start, end-summary, and continuation prompts.
- Add focused backend/frontend tests, disposable migration verification, production build, and desktop/narrow browser checks.

## Out Of Scope

- External chat import, AI provider calls, automatic Git/file scanning, autonomous writes, attachments, project logs, unified timeline, Dashboard/Resume overview, Notes, Calendar, Android, and session delete/archive.
- Changes to stable Phase 1A API/data-model/requirements documents or completed task archives.

## Relevant Files

- `docs/mvp.md`: Phase 3 AI Workspace fields, prompts, project detail, and later timeline expectation
- `docs/requirements.md`: sections 8-9 Resume and AI Workspace
- `docs/architecture.md`: section 11 AI Workspace data recommendation
- `docs/pc-delivery-plan.md`: PC-first task sequence and demonstration checkpoint
- `backend/app/models/project.py`, `backend/app/schemas/project.py`, `backend/app/api/v1/projects.py`, `backend/app/services/idempotency.py`: owner and write patterns
- `backend/app/api/v1/router.py`, `backend/app/models/__init__.py`, `backend/alembic/env.py`, latest migration, and `backend/tests/test_projects.py`
- `web/src/App.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`, `web/src/App.projects.test.tsx`, `web/e2e/projects.spec.ts`

## Allowed Files

- New narrowly named AI Session model, schema, API, migration, and tests under `backend/**`
- `backend/app/api/v1/router.py`, `backend/app/models/__init__.py`, `backend/alembic/env.py` only as needed for registration
- `web/src/App.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/styles.css`, and focused tests under `web/src/**` or `web/e2e/**`
- `docs/pc-delivery-plan.md` only to record verified progress, not to silently change scope
- Active TASK-032 workflow/gate/Git/issue files

## Forbidden Files And Changes

- `android/**`, existing Todo/category/sync/AI Today behavior, stable product/API/architecture/data-model documents, accepted ADRs, and completed task archives
- Browser-supplied `user_id`, cross-identity session access, provider credentials or calls, raw tokens, secrets, private fixture data, generated output, and machine paths
- Premature Dashboard, project timeline or `project_logs` scaffolding; TASK-034 will integrate sessions into the unified timeline

## Implementation Requirements

1. Store `ai_sessions` with UUID `id`, non-null UUID `user_id` and `project_id`, required `goal`, optional `completed_work`, `modified_files`, `verification_result`, `remaining_issues`, `next_step`, `recommended_next_prompt`, `ai_tool`, and `user_note`, plus `started_at`, nullable `ended_at`, `version`, `created_at`, and `updated_at`. `modified_files` is manually entered text, not a scanned file list. The migration must be additive; add owner/project/order indexes and foreign keys. Do not create `project_logs` yet.
2. Trim text. `goal` is 1-500 characters; `ai_tool` is at most 100; other optional text fields are at most 4000 and blank text becomes null. Version starts at 1. Create and PATCH accept exactly the fields in the following table; reject unknown fields, including `id`, `user_id`, `project_id`, `version`, `created_at`, and `updated_at`.

   | Field | Create | PATCH |
   | --- | --- | --- |
   | `goal` | Required, non-null | Optional; if supplied, non-null |
   | `completed_work`, `modified_files`, `verification_result`, `remaining_issues`, `next_step`, `recommended_next_prompt`, `ai_tool`, `user_note` | Optional, nullable | Optional, nullable; explicit null clears |
   | `started_at` | Optional; omission uses server current UTC time; explicit null invalid | Optional; non-null timestamp may replace existing value; null invalid |
   | `ended_at` | Optional, nullable; omission means null | Optional, nullable; explicit null clears |

   Both time fields accept timezone-aware RFC 3339 timestamps only; reject naive timestamps and normalize accepted values to UTC for storage and response. Compare instants, not their textual offsets. On create and every PATCH, build the complete resulting record (stored values plus supplied changes, including cleared fields), then require `ended_at >= started_at` whenever `ended_at` is non-null. Thus changing only `started_at` or only `ended_at` must still respect the other stored value; equality is valid. A valid equivalent-offset timestamp is a no-op after UTC normalization.
3. `POST /api/v1/projects/{project_id}/ai-sessions` creates; `GET` on the same collection lists only this owner's sessions for that project, ordered by `started_at DESC, id ASC`; `GET /{session_id}` reads one; `PATCH /{session_id}` updates only the explicitly listed mutable fields. Every operation verifies that both project and session belong to the bearer user and that the session belongs to the requested project. Missing, other-user, or mismatched IDs return `404 not_found` without existence disclosure. Use existing data/list/error envelopes.
4. Create/PATCH require a UUID `Idempotency-Key` and reuse canonical request-hash replay/conflict behavior. Empty PATCH is `400 validation_error`. A normalized no-op PATCH leaves version and `updated_at` unchanged; an effective edit increments version once. Replay cannot duplicate records or double-increment. No `sync_changes` write in this PC-only slice.
5. PC Project/Goal detail shows the latest AI Session summary and a scannable session list; the user can create, open, edit, and return to the project. Forms expose all structured fields and date/time values. Loading, empty, validation, error, retry, and identity-switch states remain safe; stale responses must not leak across identities or projects.
6. Provide copy buttons for start-collaboration, end-of-session-summary, and continuation prompts from the saved session and current linked project (never unsaved form values). Use the exact ordered, line-based contract under **Prompt Composition Contract** below. Copy feedback must distinguish success from clipboard failure. No AI provider call or external conversation fetch is part of this feature.
7. The latest session on Project detail is the first item under the defined order. The unified project timeline and Dashboard reuse this record later; this task does not create those views or write a second log record.

## Prompt Composition Contract

- Compose locally as UTF-8 plain text. Lines use LF, with no empty separator lines or trailing newline. Every included field is one line in `Label: value` form. For rendering only, trim each text value and replace every run of whitespace (including line breaks) with one ASCII space; do not mutate the saved record. Omit optional fields that are null or blank after normalization. Preserve the fixed labels, punctuation, and order below. `project.type` and `project.status` use their stored enum values; progress uses decimal integer plus `%`. Do not include timestamps, IDs, versions, or hidden fields in any prompt.
- All three templates start with the exact title shown below, then these shared lines in order: `Project: {project.name}`, `Type: {project.type}`, `Status: {project.status}`, `Progress: {project.manual_progress}%`, optional `Project next step: {project.next_step}`, optional `AI tool: {session.ai_tool}`. Use the current linked project returned for the same bearer identity.
- **Start collaboration** title: `Start collaboration`. After shared lines, append `Session goal: {session.goal}`, optional `Completed work: {session.completed_work}`, optional `Remaining issues: {session.remaining_issues}`, optional `Next step: {session.next_step}`, optional `User note: {session.user_note}`, then the fixed final line `Request: Help me work on this session goal using the context above.`
- **End-of-session summary** title: `End-of-session summary`. After shared lines, append `Session goal: {session.goal}`, optional `Completed work: {session.completed_work}`, optional `Modified files: {session.modified_files}`, optional `Verification result: {session.verification_result}`, optional `Remaining issues: {session.remaining_issues}`, optional `Next step: {session.next_step}`, optional `User note: {session.user_note}`, then the fixed final line `Request: Summarize this session and propose the next prompt using the context above.`
- **Continue progress** title: `Continue progress`. After shared lines, append `Session goal: {session.goal}`, optional `Completed work: {session.completed_work}`, optional `Modified files: {session.modified_files}`, optional `Verification result: {session.verification_result}`, optional `Remaining issues: {session.remaining_issues}`, optional `Next step: {session.next_step}`, optional `User note: {session.user_note}`, then exactly one `Request: {value}` line. Select `value` by first nonblank value in this order: `session.recommended_next_prompt` verbatim after rendering normalization; otherwise `Continue with: {session.next_step}`; otherwise `Continue with: {project.next_step}`; otherwise `Help me work toward: {session.goal}`. The recommended prompt replaces only the fallback request text; it does not replace the shared header or recorded context lines.

## Acceptance Criteria

- [x] Additive migration and model support owner-scoped, project-linked AI Sessions with constraints, timestamps, version, and deterministic order.
- [x] Create/list/detail/update follow the contract and existing envelopes; malformed/empty input and missing or cross-owner IDs fail closed.
- [x] Idempotency replay/conflict and effective/no-op edit semantics are deterministic and tested.
- [x] Create omission/default, supplied and equivalent-offset timestamps, single-field time edits, `ended_at` clearing, invalid resulting ranges, and no-op/replay cases are tested against the full resulting record.
- [x] PC user can save, reopen, edit, and review sessions in a real project, and the latest summary appears on project detail.
- [x] All three prompt actions match the exact composition contract for full and sparse records, with and without `recommended_next_prompt`; clipboard success/failure is visible and no provider or external import is invoked.
- [x] Identity/project switching, loading/empty/error/retry, and desktop/narrow layout work without stale data or overflow.
- [x] Full backend tests, full Web tests, Web production build, disposable migration check, focused browser flow, and exact Git/security scans pass or record exact environmental limits.
- [x] No Android, Dashboard, timeline, provider integration, autonomous write, secret, or generated artifact is included.

## Verification Plan

- Backend: field allowlist/null rules, timestamp default/normalization and merged-state range checks, project/session owner isolation and mismatch, list order, 404, write idempotency replay/conflict, version/no-op behavior, and no sync write.
- Apply migration to a disposable database, inspect schema/indexes/constraints, and check downgrade without touching user data; record an exact environment limitation if unavailable.
- Frontend: create/list/detail/edit, latest summary, exact full/sparse outputs for all three prompt copies and recommended/fallback precedence, clipboard failure, validation, empty/loading/error/retry, identity/project switch, and Todo/Today/Project regression.
- Run full backend pytest, full Web tests, Web production build, and desktop/narrow browser flows; inspect `git diff --check`, exact scope, secrets, private data, and generated artifacts.

## Risks

- Nested project/session lookup must never reveal another identity's record or a session attached to another project.
- Text may contain user-entered sensitive context. Do not send it to an AI provider, log raw content, or persist it beyond the intended session record.
- `docs/architecture.md` recommends `project_logs` for a unified timeline, but TASK-034 owns that integration. This slice stores a linked session only and must remain consumable by later Dashboard/timeline work.

## Coding Output Requirements

Report modified files, migration/schema, API behavior, owner isolation, idempotency/no-op rule, PC session and prompt flows, test/build/browser/migration evidence, exact scope/security scans, issues, and next role.

## Current Stage

Closure Check: PASS

Checked At: 2026-10-11 00:34 +08:00

Result Commit: `500d3172a062bbd3c57db8c5af14681e724bbc3b`

Completion Commit: `623426e68c91f2b8a629429d90495231fa5631c6`

Next Role: Git Commit (Terminal Closure Commit)

Required Next Action: commit and push only the four Closure-authorized documents listed in `tasks/TASK-032-pc-ai-session-records.md` with message `docs(task): close TASK-032`; verify local/tracking/remote parity and return control to Decision. Do not run another Closure Check or publish TASK-033 here.
