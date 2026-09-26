# TASK-029: Android identity-scoped Room cache and durable sync pull foundation

Status: COMPLETED

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

- Status: COMPLETE
- Branch: `main`
- Base Commit: `118de6867a4fb06d32022dd1117fcfb5681b5d26`
- Snapshot Commit Created: Yes
- Snapshot Commit: `e597e8842ba7ac4e9b0f434efe2a20c8380fcf3f`
- Reason: approved TASK-029 readiness documents required a durable pre-Coding baseline
- Next Role: Coding

## Coding Result

Result: PASS

Completed at: 2026-09-26

### Modified Files

- `android/build.gradle.kts`
- `android/app/build.gradle.kts`
- `android/README.md`
- `android/app/schemas/com.bpn0416.lifeos.LifeOSDatabase/1.json`
- `android/app/src/main/java/com/bpn0416/lifeos/CacheDatabase.kt`
- `android/app/src/main/java/com/bpn0416/lifeos/SyncModels.kt`
- `android/app/src/main/java/com/bpn0416/lifeos/SyncClient.kt`
- `android/app/src/main/java/com/bpn0416/lifeos/SyncCoordinator.kt`
- `android/app/src/test/java/com/bpn0416/lifeos/SyncPageParserTest.kt`
- `android/app/src/test/java/com/bpn0416/lifeos/SyncClientCoordinatorTest.kt`
- `android/app/src/androidTest/java/com/bpn0416/lifeos/SyncRoomStoreTest.kt`
- `handoff/current-task.md`
- `tasks/TASK-029-android-room-sync-foundation.md`

`handoff/git-snapshot.md` remains the pre-existing, unstaged Git Snapshot transition and was not changed by Coding.

### Implementation Summary

- Pinned Room `2.8.5` and KSP `2.3.12` while preserving Kotlin `2.3.21`, AGP `8.13.2`, API 26/36/36, JVM 17, and the existing API-base policy.
- Added exported Room schema version 1 with `cached_todos`, `cached_todo_categories`, and `sync_state`. Todo/category keys are `(owner_id, entity_id)` and sync state is keyed by `owner_id`; no credential column exists and no destructive migration fallback is configured.
- Todo rows preserve category summary, status, priority, planning/due/completion timestamps, entity version, source timestamps, and `last_sync_cursor`. Category rows preserve the stable DTO and `last_sync_cursor`.
- Added strict page parsing for Todo create/update/complete/reopen/delete and category create/update/delete. It rejects unknown fields/types, invalid UUIDs/timestamps, stale or out-of-order cursors, version/snapshot mismatches, malformed tombstones, and non-progressing pagination while accepting cursor gaps and empty high-water pages.
- Added bearer-only `GET /sync/changes?cursor=<cursor>&limit=<bounded-limit>` client behavior. Token data is confined to the Authorization header and never enters URL, body, Room, logs, or result objects.
- Added `RoomSyncPageStore`, which rechecks the durable owner cursor and applies each validated page plus `next_cursor` in one Room transaction. Upserts and tombstones always receive explicit owner predicates; database failure rolls back entity and cursor changes together.
- Added per-owner coordinator locks with deterministic duplicate rejection, durable resume, multi-page continuation, and typed completed, unauthorized, recoverable, invalid cursor/page, database failure, and cancellation outcomes.
- Kept the cache disconnected from UI and documented that TASK-030 REST bootstrap/reconciliation is required before product reads.

### Acceptance Criteria Results

- [x] Exported owner-scoped Room schema, composite keys, per-owner cursor, pinned dependencies, and non-destructive migration policy are present.
- [x] Sync requests use only bearer header, owner cursor, and bounded limit; request tests prove no body, `user_id`, or token URL leakage.
- [x] Pagination, cursor gaps, empty high-water pages, snapshots, tombstones, durable resume, and final high-water cursor are covered.
- [x] Malformed, stale, out-of-order, mismatched, unknown, non-progressing, corrupt-cursor, and database-failure paths fail without partial page persistence or cursor advancement.
- [x] Todo/category upserts and tombstones remain isolated for two owners even with identical entity IDs; owner cursors are independent.
- [x] 401, network/server recovery, cancellation, duplicate runs, and stale/database completion paths return deterministic outcomes without clearing identity/cache.
- [x] File-backed Room reopen retains cursor state; in-memory tests prove transaction rollback and owner isolation.
- [x] Existing identity/UI tests, JVM tests, API 36 device tests, lint, debug/release builds, install, and cold launch pass.
- [x] No product UI, REST bootstrap, SSE, WorkManager, writes, backend/web, stable contract, or completed-task archive was modified.

### Verification Commands And Results

- From `android`, with Android SDK environment configured, ran `./gradlew.bat testDebugUnitTest lintDebug assembleDebug assembleRelease connectedDebugAndroidTest --rerun-tasks --console=plain --offline --init-script <temporary-external-local-maven-init>`: PASS, 140 tasks executed.
- JVM: 27 tests across 5 suites, 0 failures, 0 errors.
- API 36 AVD: 11 tests, including 5 Room tests plus existing identity/UI coverage, 0 failures, 0 errors.
- Lint: 0 errors and 5 warnings. Warnings are the existing Gradle 8.14.5 availability, core-ktx 1.19/API-37 baseline mismatch, OkHttp/MockWebServer 5.5/API-37 mismatch, and intentional debug cleartext configuration.
- `./gradlew.bat installDebug`: PASS on `LifeOS_API_36`.
- Cold launch: `Status: ok`, `LaunchState: COLD`, `TotalTime: 683 ms`; process remained alive and crash buffer was empty.
- Room/KSP first-use artifacts were supplied through a temporary external local Maven mirror after checksum verification because the host proxy stalled on the 77 MB KSP compiler artifact. No mirror path or artifact was added to the repository; ordinary dependency coordinates remain standard and pinned.

### Git Diff Check

- Branch remains `main`; HEAD remains Snapshot Commit `e597e8842ba7ac4e9b0f434efe2a20c8380fcf3f`.
- `git diff --check`: PASS; only informational LF-to-CRLF working-copy warnings were emitted.
- `git diff --cached`: empty. Coding did not stage, commit, or push.
- Exact-scope scan found only approved Android cache/sync files, schema, README, and active task-state updates. No backend, web, stable contract, UI/identity implementation, generated build output, database file, APK/AAB, signing material, secret, real LAN IP, absolute user path, debug logging, or dynamic dependency is present.
- Exported schema and DAO scan confirm explicit owner columns/predicates, no token column, and no destructive migration fallback.
- All new text files have no trailing whitespace and end with a newline.

### Unresolved Issues

None blocking. The cache intentionally remains non-authoritative until TASK-030 adds REST bootstrap/reconciliation, and bearer storage remains the accepted TASK-028 DataStore residual risk.

### Task-Outside Findings

None.

### Next Role

Code Review. Independently review TASK-029; do not stage, commit, or push during review.

## Code Review

- Result: CHANGES_REQUESTED
- Target Status: CHANGES_REQUESTED
- Reviewed by: Code Review window
- Reviewed at: 2026-09-26 23:08 +08:00
- Branch: `main`
- HEAD: `e597e8842ba7ac4e9b0f434efe2a20c8380fcf3f`
- Snapshot Commit: `e597e8842ba7ac4e9b0f434efe2a20c8380fcf3f`
- Blocking Issues:
  - P2 / ISSUE-20260926-001: `SyncCoordinator.sync()` catches `CancellationException` from the initial `store.cursor(ownerId)` call as a generic `Exception` and returns `InvalidLocalState(0)` instead of the required typed cancellation result.
- Verification:
  - PASS: 27 JVM tests and 11 API 36 device tests, with 0 failures/errors/skips.
  - PASS: lint reported 0 errors and 5 accepted warnings; debug/release builds, API 36 install, cold launch, process, and crash-buffer checks passed through the external checksum-verified Maven mirror.
  - PASS: Room schema, owner isolation, page transaction, strict payload parsing, pagination/high-water behavior, scope, whitespace, staged state, artifact, credential, path/LAN/signing, logging, and destructive-migration checks passed.
  - FAIL: cancellation during the initial durable cursor read is neither correctly classified nor directly tested.
- Non-blocking Suggestions:
  - Keep the documented host-only external Maven mirror limitation; normal offline mode does not currently contain the KSP compiler artifact in its standard resolution cache.
- Follow-up Tasks: None outside the blocking correction.
- Reviewed Scope: exact TASK-029 files and review records listed in `handoff/code-review-gate.md`.
- Recommended Commit Message: Not authorized until re-review passes.
- Next Role: Coding

## Coding Rework 2026-09-26

Result: PASS

### Modified Files

- `android/app/src/main/java/com/bpn0416/lifeos/SyncCoordinator.kt`
- `android/app/src/test/java/com/bpn0416/lifeos/SyncClientCoordinatorTest.kt`
- `handoff/current-task.md`
- `tasks/TASK-029-android-room-sync-foundation.md`

### Implementation Summary

- Fixed ISSUE-20260926-001 by rethrowing `CancellationException` from the initial durable cursor read so the coordinator's existing outer cancellation boundary returns `Cancelled(0)`.
- Preserved `InvalidLocalState(0)` for non-cancellation cursor-read failures.
- Added a same-owner regression test that cancels the first cursor load and proves a subsequent run completes, confirming the per-owner lock is released.

### Acceptance Criteria Results

- [x] Cursor-load cancellation is classified as `Cancelled(0)`, not `InvalidLocalState(0)`.
- [x] Cancellation does not strand the owner lock; the same coordinator and owner can run again successfully.
- [x] Existing cancellation, database-failure, sync, Room, identity, build, lint, install, and launch behavior remains green.

### Verification Commands And Results

- Focused TDD RED: `gradlew.bat testDebugUnitTest --tests com.bpn0416.lifeos.SyncClientCoordinatorTest.cursorLoadCancellationReturnsCancelledAndReleasesOwnerLock --rerun-tasks --console=plain --offline --init-script <temporary-external-init>` failed with 1 test / 1 failure before the implementation correction.
- Focused GREEN: the same command passed after the correction.
- Full JVM: `gradlew.bat testDebugUnitTest --rerun-tasks --console=plain --offline --init-script <temporary-external-init>` passed with 28 tests across 5 suites, 0 failures, 0 errors, and 0 skipped.
- Full task regression: `gradlew.bat testDebugUnitTest lintDebug assembleDebug assembleRelease connectedDebugAndroidTest --rerun-tasks --console=plain --offline --init-script <temporary-external-init>` passed; 140 tasks executed, 11 API 36 device tests passed, and lint reported 0 errors / 5 accepted warnings.
- `gradlew.bat installDebug --console=plain --offline --init-script <temporary-external-init>` passed on `LifeOS_API_36`.
- Cold launch passed with `Status: ok`, `LaunchState: COLD`, and `TotalTime: 1395 ms`; the app process remained alive and the crash buffer was empty.

### Git Diff Check

- Branch and HEAD remain `main` at Snapshot Commit `e597e8842ba7ac4e9b0f434efe2a20c8380fcf3f`.
- Rework is limited to the reviewed coordinator defect, its focused test, and active Coding records. Code Review gate and issue evidence were preserved.
- Coding did not stage, commit, push, reset, discard, or overwrite the pre-existing TASK-029 implementation/state changes.

### Unresolved Issues

None blocking. The temporary external dependency mirror remains a host-only verification aid and is not part of the repository.

### Task-Outside Findings

None.

### Next Role

Code Review. Independently re-review ISSUE-20260926-001 and TASK-029; do not stage, commit, or push during review.

## Code Review Re-review 2026-09-26

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-09-26 23:22 +08:00
- Branch: `main`
- HEAD: `e597e8842ba7ac4e9b0f434efe2a20c8380fcf3f`
- Snapshot Commit: `e597e8842ba7ac4e9b0f434efe2a20c8380fcf3f`
- Blocking Issues: None. ISSUE-20260926-001 is verified fixed.
- Verification:
  - PASS: cursor-read cancellation now reaches the typed `Cancelled(0)` boundary, while non-cancellation cursor-read errors remain `InvalidLocalState(0)`.
  - PASS: focused regression proves cancellation and subsequent same-owner lock reuse.
  - PASS: independent full JVM run reported 28 tests with 0 failures/errors/skips; API 36 instrumentation reported 11 tests with 0 failures/errors/skips.
  - PASS: lint reported 0 errors and 5 accepted warnings; debug/release builds, API 36 install, cold launch, process, and crash-buffer checks passed through the external checksum-verified Maven mirror.
  - PASS: the initial full-scope contract, Room, ownership, transaction, parser, pagination, artifact, credential, and scope checks remain valid.
- Non-blocking Suggestions:
  - Preserve the host-only external Maven mirror limitation in durable evidence; standard offline mode still lacks the large KSP compiler artifact in its ordinary cache.
- Follow-up Tasks: None.
- Reviewed Scope: exact TASK-029 files and review records listed in `handoff/code-review-gate.md`.
- Recommended Commit Message: `feat(android): add Room sync pull foundation`
- Next Role: Git Commit

## Git Commit

- Status: COMPLETE
- Branch: `main`
- Result Commit: `5bcdfab0541afd3229109f8437f381dd21c4d935`
- Commit Message: `feat(android): add Room sync pull foundation`
- Push Target: `origin/main`
- Remote Parity: PASS; local HEAD, `origin/main`, and remote `refs/heads/main` matched after push.
- Code Review Result: PASS
- Next Role: Decision

## Closure

Pending.
