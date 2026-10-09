# TASK-031: PC Project/Goal core

Status: READY

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

- [ ] Migration/model and owner-scoped API contract are correct and tested.
- [ ] Two identities remain isolated across list/detail/create/update.
- [ ] Idempotency, malformed input, no-op update, version changes, and deterministic order are covered.
- [ ] PC creates, lists, opens, edits, pins, and reopens a project through the backend.
- [ ] Loading/empty/error/retry, identity switch, and desktop/narrow use are verified.
- [ ] Full backend/Web suites, build, migration check, browser flow, diff/security/scope checks pass or report exact limits.
- [ ] No future-module or Android scope breach occurs.

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
- Target Status: READY
- Blocking Issues: None
- Evidence: `handoff/task-review-gate.md`
- Next Role: Git Snapshot
- Required Next Action: establish the pre-Coding Git Snapshot for the exact ten-file TASK-031 publication/readiness scope. Do not start Coding until Git Snapshot completes.
