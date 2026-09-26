# TASK-029: Android identity-scoped Room cache and durable sync pull foundation

Status: READY

Priority: P1

Parent: Phase 1A Android client

Published by: Decision window

Published at: 2026-09-20

## Dependencies

- TASK-028 terminal Closure Commit `118de68`
- Android identity result `6b2a1fd`
- Sync changes pull API result `f6f9091`
- `docs/adr/0001-android-foundation.md`
- `docs/adr/0002-android-local-cache-sync-foundation.md`

## Goal

Add an identity-isolated Room cache and transactional, resumable `/sync/changes` pull/apply engine for Todo and Todo Category snapshots/tombstones. Do not expose the cache in product UI until a later task performs authoritative REST bootstrap/reconciliation.

## Scope Summary

- Pin compatible Room/KSP dependencies and commit schema export.
- Add owner-scoped Todo/category cache tables and one durable cursor per owner.
- Add strict bearer-authenticated sync page parsing and supported change validation.
- Apply each page and cursor atomically; paginate, resume, isolate identities, and return typed unauthorized/recoverable outcomes.
- Prove behavior with JVM and API 36 Room/instrumentation tests while preserving TASK-028 identity behavior.

## Scope Boundary

- The sync log alone is incomplete for bootstrap-created default categories.
- TASK-029 does not claim an authoritative first-install snapshot and does not wire cached data into UI.
- TASK-030 will add REST snapshot/bootstrap reconciliation and Today/Todo reads before any product data is displayed.
- SSE, WorkManager, pending operations, offline writes, mutations, reminders, backend, PC Web, and contract changes are excluded.

## Allowed Files

- `android/build.gradle.kts`, `android/app/build.gradle.kts`
- New narrowly named cache/sync Kotlin files under the existing application package
- New cache/sync JVM and instrumentation tests
- `android/app/schemas/**`
- `android/README.md`
- `.gitignore` only for a narrow generated-artifact exclusion
- `docs/phase1a-progress.md`
- Active TASK-029 workflow/gate/Git/issue files

## Forbidden Files And Changes

- `backend/**`, `web/**`, stable contract documents, accepted ADRs, completed task archives
- Existing product/identity UI unless Decision approves a proven compile blocker
- REST bootstrap/read UI, SSE, WorkManager, pending operations, offline writes, mutations, reminders, navigation/DI scaffolding
- Tokens in Room or URLs/logs/errors, DAO access without explicit owner, destructive migration fallback, dynamic dependencies, SDK/package/API-base changes, secrets, real LAN IPs, machine paths, signing material, generated output

## Implementation Contract

- One app-private Room database with composite `(owner_id, entity_id)` keys for cached Todo/category rows and one sync-state row per owner.
- Todo/category rows preserve stable snapshot fields and `last_sync_cursor`; bearer tokens remain only in Identity DataStore.
- Pull uses `GET /sync/changes?cursor=<owner_cursor>&limit=<bounded-limit>` with bearer and JSON accept headers only.
- Validate complete pages before mutation, including strict cursor/order/progress, UUID/version/snapshot/tombstone consistency, and supported event combinations. Gaps and empty high-water pages remain valid.
- Apply each page plus `next_cursor` in one transaction. Page failure rolls back all page mutations and cursor movement.
- Serialize per-owner runs; safely resume committed pages after cancellation/network failure; distinguish 401 without clearing identity/cache inside this foundation.
- Unknown, corrupt, out-of-range, mismatched, stale, or non-progressing state fails closed without destructive reset.
- No business UI may consume this cache until TASK-030 completes authoritative REST reconciliation.

## Acceptance Criteria

- [ ] Room schema/export, pinned Room/KSP dependencies, owner keys, cursor rows, and non-destructive migration policy are correct.
- [ ] Valid paginated Todo/category snapshots and tombstones apply atomically and end at high-water cursor.
- [ ] Gaps/empty pages succeed; malformed/out-of-order/mismatched/unknown/non-progressing pages roll back without cursor advance.
- [ ] Failure after a committed page resumes from its cursor; cancellation, duplicates, stale completion, 401, and recoverable errors are deterministic.
- [ ] Two owners with identical entity IDs remain fully isolated across reads, writes, deletes, and cursor advancement.
- [ ] Persistence survives database reopen; corrupt/out-of-range state fails closed without destructive reset.
- [ ] JVM and Room instrumentation tests, existing identity tests, lint, debug/release builds, and device launch checks pass or record an exact device limitation.
- [ ] No UI/bootstrap/SSE/WorkManager/write/backend/web/contract/credential/generated-artifact scope breach exists.

## Verification Plan

- MockWebServer tests for request safety, pagination, gaps, empty high-water, errors, malformed pages, mismatch, cancellation, duplicate/stale runs, and progress guards.
- In-memory/file-backed Room tests for schema, ownership, transaction rollback, cursor atomicity, reopen persistence, tombstones, and resume.
- Wrapper unit tests; lint and debug/release assembly; focused API 36 instrumentation and install/cold launch when available.
- Room schema/migration, exact diff, whitespace, staged state, dependencies, generated/KSP output, database files, token/bearer, URL/LAN/path/signing, and logging scans.

## Risks

- Sync replay is not an authoritative first-install category snapshot.
- Missing owner predicates could expose another identity's cached data.
- Non-atomic cursor movement could skip changes permanently.
- Category ordering relies on sync cursor because category snapshots have no version.
- Room/KSP compatibility must preserve the approved Kotlin/API 36 baseline.

## Workflow History

- 2026-09-20: Decision verified TASK-028 terminal closure `118de68`, clean worktree, and local/tracking/remote parity.
- 2026-09-20: Decision split local sync/cache foundation from authoritative REST bootstrap and Today/Todo UI after confirming default categories are not guaranteed to exist in sync history.

## Task Review

- Result: PASS
- Reviewed by: Task Review window
- Reviewed at: 2026-09-26 21:48 +08:00
- Target Status: READY
- Evidence: persisted in `handoff/task-review-gate.md`
- Blocking Issues: None
- Required Changes: None
- Next Role: Git Snapshot

## Git Snapshot

Pending.

## Coding Result

Pending.

## Code Review

Pending.

## Git Commit

Pending.

## Closure

Pending.
