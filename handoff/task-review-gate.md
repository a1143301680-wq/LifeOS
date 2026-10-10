# LifeOS Task Review Gate

Last updated: 2026-10-10

## Gate Status

Result: PASS

Target Status: READY

Reviewed by: Task Review window

Reviewed at: 2026-10-10 10:14 +08:00

Reviewed task: TASK-032 PC AI Session records

## Previous Review

- Result: REJECT on 2026-10-10 10:04 +08:00.
- Blocker 1 was ambiguous Create/PATCH mutability and merged timestamp validation.
- Blocker 2 was an underspecified deterministic contract for the three prompt templates.
- Decision revised both active task records while keeping TASK-032 `PLANNED` and reset this gate for fresh review.

## Required Review

- [x] Goal, one-slice boundary, dependencies, exclusions, and later Dashboard/timeline ownership are coherent.
- [x] Owner/project isolation, nested routes, list order, idempotency, no-op update, and migration strategy are executable.
- [x] Create/PATCH mutable fields and timestamp default/edit/clear/resulting-range semantics are explicit and testable.
- [x] All three prompt templates have exact ordered composition, omission, normalization, and fallback rules.
- [x] Backend/frontend/migration verification and exact publication scope are sufficient.
- [x] Branch, HEAD, worktree, staged state, diff check, and Git Snapshot readiness are persisted.

## Issues

None. Both prior blocking issues are resolved.

## Review Evidence

### Repository State

- Branch: `main`
- HEAD: `6acfaaf893d2ec6ac85cdfdd4bd9b396ecf63c8b`
- `origin/main`: `6acfaaf893d2ec6ac85cdfdd4bd9b396ecf63c8b`
- Remote `refs/heads/main`: `6acfaaf893d2ec6ac85cdfdd4bd9b396ecf63c8b`
- Dependency check: TASK-031 terminal Closure Commit `6acfaaf893d2ec6ac85cdfdd4bd9b396ecf63c8b` exists and is the aligned local/tracking/remote baseline.
- Worktree Summary before this fresh review: 7 modified tracked files and 1 untracked task archive. All eight paths are TASK-032 Decision publication/revision, PC plan progress, and active gate/Git-record reset files.
- Staged Changes: None.
- `git diff --check`: exit code 0. Git emitted LF-to-CRLF working-copy warnings only; no whitespace errors were reported.
- `git diff --cached --check`: exit code 0.
- Publication-file whitespace/EOF check: PASS for all eight files, including the untracked archive.
- Issue-log search: no TASK-032 or unresolved blocking entry.

### Changed Files

- `docs/pc-delivery-plan.md`
- `handoff/code-review-gate.md`
- `handoff/current-task.md`
- `handoff/git-commit.md`
- `handoff/git-snapshot.md`
- `handoff/project-state.md`
- `handoff/task-review-gate.md`
- `tasks/TASK-032-pc-ai-session-records.md` (untracked)

These eight files form the exact TASK-032 publication/readiness scope. No backend, web, Android, migration, stable product/API/architecture/data-model document, accepted ADR, completed task archive, generated output, credential, private fixture, or machine path is included.

### Prior Blocker Resolution

- Create and PATCH now have an explicit field table. `goal`, all nullable context fields, `started_at`, and `ended_at` have defined omission, null, replacement, and clear behavior; server-owned and unknown fields are rejected.
- Both timestamps require timezone-aware RFC 3339 input, normalize to UTC, compare as instants, and validate the complete merged record. Single-field edits cannot violate the stored counterpart; equality is valid; equivalent-offset values are normalized no-ops.
- Acceptance and verification now explicitly cover omitted/default and supplied timestamps, equivalent offsets, single-field edits, clearing `ended_at`, invalid merged ranges, no-op version/timestamp behavior, and idempotent replay.
- All three prompt templates now specify exact titles, shared fields, ordered template-specific fields, labels, LF formatting, whitespace normalization, optional-field omission, prohibited hidden fields, and no trailing newline.
- Continue-progress request precedence is deterministic: normalized `recommended_next_prompt`, then session next step, then project next step, then session goal. The selected request text replaces only the fallback line and never removes the fixed project/session context.
- Prompt tests can assert exact full and sparse output, every fallback branch, and clipboard success/failure independently. Prompt composition uses saved session/current owned project records only and invokes no provider or external import.

### Start-Readiness Review

- TASK-032 is one closeable vertical slice: one additive owner-scoped session entity, nested create/list/detail/update API, Project detail session loop, local prompt composition, and focused/full verification.
- Nested ownership is fail-closed: project and session must both belong to the bearer user and match each other; missing, cross-user, and wrong-project identifiers all return `404` without existence disclosure.
- UUID idempotency, canonical request fingerprints, transactional response storage, empty PATCH rejection, normalized no-op preservation, effective version increment, and no `sync_changes` behavior are defined by the task and existing Project patterns.
- Latest-session behavior is deterministic from `started_at DESC, id ASC`; stale identity/project responses, loading/empty/error/retry states, and desktop/narrow layouts have explicit acceptance coverage.
- Provider calls, automatic import/scanning, autonomous writes, Dashboard, timeline, `project_logs`, delete/archive, Notes, Calendar, Android, and stable-contract changes remain outside scope.
- Verification is executable through focused/full backend and Web suites, exact prompt-output tests, production build, disposable migration apply/schema/downgrade checks, browser flows, and scope/security/artifact scans.

### Artifact And Secret Checks

- All eight publication files passed trailing-whitespace, final-newline, and extra-EOF-blank checks.
- Pattern scans found no private key, API key value, bearer credential, user-machine path, real private LAN address, generated build output, or private fixture. Security-related phrases are guardrail text only.

### Git Snapshot Readiness

READY. The next role is Git Snapshot. Its approved pre-Coding scope is exactly the eight files listed under Changed Files, including this fresh Task Review PASS and the synchronized `READY` updates in `handoff/current-task.md` and `tasks/TASK-032-pc-ai-session-records.md`. Git Snapshot must independently recheck branch, HEAD, staged state, exact scope, whitespace, artifacts, and secrets before creating or recording the baseline.

## Instructions

Task Review PASS authorizes Git Snapshot for the exact approved TASK-032 publication/readiness scope. Do not start Coding until Git Snapshot completes and synchronizes both active task records to `IN_PROGRESS`.
