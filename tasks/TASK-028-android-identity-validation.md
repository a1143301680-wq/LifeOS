# TASK-028: Android identity validation and token persistence

Status: COMPLETED

Priority: P1

Parent: Phase 1A Android client

Published by: Decision window

Published at: 2026-09-15

## Dependencies

- TASK-027 terminal Closure Commit `658f800`
- Android foundation result `629bf71`
- Stable `/api/v1/me` contract and backend implementation from baseline `6a85b4a`

## Goal

Deliver a runnable Android identity flow that accepts a manually provisioned bootstrap token, validates it with `GET /api/v1/me`, atomically persists only a validated session in app-private Preferences DataStore, restores and revalidates it after restart, and provides safe retry and identity-switch behavior.

## Contract

- The bearer token alone determines authorization; the client never sends `user_id` or trusts alias/UUID for authorization.
- Manual token input is trimmed and validated through `/me`; an unvalidated token is never persisted.
- A validated session consists of the raw token plus server-returned UUID, alias, display name, and timezone in one Preferences DataStore.
- Startup revalidates a stored session. `401 unauthorized` and explicit switch clear it atomically; recoverable failures retain an existing session but do not claim fresh verification.
- Tokens are forbidden from URLs, request bodies, logs, errors, analytics, screenshots, reports, fixtures that resemble real credentials, and repository files outside controlled test literals.
- App-private DataStore plus the existing backup-disabled application boundary is the accepted Phase 1A storage baseline; custom encryption and full authentication remain out of scope.

## In Scope

- Android `INTERNET` permission and typed `/me` API access using `BuildConfig.API_BASE_URL`.
- Pinned OkHttp, Kotlinx Serialization, Preferences DataStore, coroutine, and lifecycle/ViewModel dependencies needed by this slice.
- Identity store, strict envelope parsing, lifecycle-safe validation orchestration, and explicit UI states.
- Password-style token entry, connect/retry, validated identity display, invalid-token re-entry, and switch identity.
- Focused unit/instrumentation/UI coverage, API 36 launch/rendering verification, and Android run documentation.

## Out Of Scope

- Identity listing/discovery, token generation/rotation, QR import, biometric gating, custom encryption, and full login/account flows.
- Todo/category/Today, Room/cache, sync/SSE, WorkManager, offline writes, reminders, widgets, notifications, backend, PC Web, stable contracts, deployment, and release endpoint work.

## Relevant Files

- `docs/api-phase1a.md` sections 2, 4, 5, and 8.1
- `docs/architecture.md` Android and identity sections
- `docs/data-model-phase1.md` identity and Android local-data sections
- `docs/adr/0001-android-foundation.md`
- `android/app/build.gradle.kts`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/java/com/bpn0416/lifeos/**`
- `android/app/src/test/**`, `android/app/src/androidTest/**`

## Allowed Files

- `android/build.gradle.kts`
- `android/app/build.gradle.kts`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/java/com/bpn0416/lifeos/**`
- `android/app/src/main/res/values/strings.xml`
- `android/app/src/test/**`
- `android/app/src/androidTest/**`
- `android/README.md`
- `.gitignore` only for a narrowly required new Android artifact exclusion
- `docs/phase1a-progress.md`
- Active TASK-028 workflow/gate/Git/issue files

## Forbidden Files And Changes

- `backend/**`, `web/**`, stable contract documents, Android foundation ADR, and completed task archives
- Todo, category, Today, Room, sync, SSE, WorkManager, reminder, widget, notification, or offline-write behavior
- SharedPreferences, ad hoc credential files, deprecated `EncryptedSharedPreferences`, custom cryptography, dynamic dependencies, SDK/package/API-base changes, secrets, real LAN IPs, machine paths, signing material, and generated output

## Implementation Requirements

1. Use pinned, mutually compatible OkHttp and Kotlinx Serialization for a typed `/me` client, Preferences DataStore for one identity session, and a lifecycle-aware ViewModel/state holder.
2. Send only `GET <API_BASE_URL>/me`, `Authorization: Bearer <token>`, and `Accept: application/json`; use bounded timeouts and close response bodies.
3. Strictly validate the documented success/error envelope and complete identity metadata. Persist atomically only after a valid 200 response.
4. Restore DataStore before choosing the final screen and revalidate saved credentials on startup.
5. Clear saved state on 401 or explicit switch. Preserve an existing saved session on recoverable failures and expose retry without claiming verification; never persist a failed new token.
6. Prevent stale/duplicate request completion from changing state after retry, switch, disposal, or a newer attempt.
7. Deliver accessible, responsive loading, entry, validating, connected, unavailable/retry, unauthorized, and switch states without adding Todo or sync scaffolding.
8. Preserve TASK-027 API-base, debug cleartext, release HTTPS, package, SDK, and toolchain decisions.

## Acceptance Criteria

- [ ] Fresh install, valid connection, persisted restart/revalidation, invalid-token re-entry, recoverable retry, and explicit switch flows work.
- [ ] Token-derived authorization and header-only token transport are enforced; no request sends `user_id` or alias.
- [ ] Persistence is atomic and fail-closed for partial/corrupt records; unvalidated tokens are never saved.
- [ ] 401 clears saved state; recoverable failures retain only previously validated state and do not claim fresh verification.
- [ ] Stale/duplicate requests cannot restore cleared identity or overwrite a newer attempt.
- [ ] Focused unit tests cover client parsing, storage, state transitions, errors, cancellation, and duplicate actions.
- [ ] Instrumentation/UI tests cover DataStore save/restore/clear and principal Compose identity states on API 36.
- [ ] Wrapper unit tests, lint, debug/release builds, instrumentation, install/launch, and responsive/accessibility checks pass or record an exact external device limitation.
- [ ] Dependencies are pinned and no token, secret, generated artifact, real LAN IP, machine path, backend/web/stable-contract change, or later Android feature is included.

## Verification Plan

- Deterministic fake/MockWebServer coverage for valid, 401, malformed, timeout, connection, non-401, duplicate, retry, stale, and switch-during-validation paths.
- Isolated DataStore tests for atomic save/clear, complete-record validation, corruption, and restart restoration.
- `android\gradlew.bat testDebugUnitTest --rerun-tasks --console=plain`.
- `android\gradlew.bat lintDebug assembleDebug assembleRelease --rerun-tasks --console=plain`.
- Focused API 36 instrumentation/UI tests, install, cold launch, crash-log check, and normal/narrow light/dark/font-scale inspection when available.
- Exact-scope, dependency, whitespace, artifact, backup, credential, token-string, URL, LAN-IP, machine-path, signing, and debug-log scans.

## Risks

- Phase 1A app-private DataStore is not a defense against a compromised/rooted device.
- Incorrect error classification could erase a valid identity during an outage.
- Async request races could reintroduce cleared credentials.
- Test tooling could leak realistic token material into reports if fixtures are careless.

## Workflow History

- 2026-09-15: Decision verified TASK-027 terminal closure `658f800`, clean worktree, and local/tracking/remote parity before publishing TASK-028.
- 2026-09-15: Decision selected identity validation/persistence as the next Phase 1A Android slice and kept Todo/cache/sync work separate.

## Task Review

- Result: PASS
- Reviewed by: Task Review window
- Reviewed at: 2026-09-15 10:18 +08:00
- Target Status: READY
- Evidence: persisted in `handoff/task-review-gate.md`
- Blocking Issues: None
- Required Changes: None
- Next Role: Git Snapshot

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: `658f8003f84622d807094b2b13ab0d3594ca3d03`
- Snapshot Commit: `3b1f1fe638321bf3cfc0b2e7e998ef9edfc37338`
- Reason: approved TASK-028 readiness documents required a durable pre-Coding baseline

## Coding Result

### Result

- Result: PASS
- Final Status: REVIEWING
- Completed at: 2026-09-17
- Next Role: Code Review

### Modified Files

- `android/build.gradle.kts`, `android/app/build.gradle.kts`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/java/com/bpn0416/lifeos/IdentityClient.kt`
- `android/app/src/main/java/com/bpn0416/lifeos/IdentityModels.kt`
- `android/app/src/main/java/com/bpn0416/lifeos/IdentityStore.kt`
- `android/app/src/main/java/com/bpn0416/lifeos/IdentityViewModel.kt`
- `android/app/src/main/java/com/bpn0416/lifeos/LifeOSApp.kt`
- `android/app/src/main/java/com/bpn0416/lifeos/MainActivity.kt`
- `android/app/src/test/java/com/bpn0416/lifeos/IdentityApiClientTest.kt`
- `android/app/src/test/java/com/bpn0416/lifeos/IdentityViewModelTest.kt`
- `android/app/src/androidTest/java/com/bpn0416/lifeos/IdentityStoreTest.kt`
- `android/app/src/androidTest/java/com/bpn0416/lifeos/LifeOSAppTest.kt`
- `android/README.md`
- `handoff/current-task.md`
- `tasks/TASK-028-android-identity-validation.md`

### Implementation Summary

- Added `INTERNET` permission and a typed OkHttp `/me` client using `BuildConfig.API_BASE_URL`, bounded 10-second connect, 15-second read, and 20-second call timeouts, cancellable calls, closed response bodies, and strict Kotlinx Serialization envelopes.
- Requests use only `GET /me`, `Authorization: Bearer <token>`, and `Accept: application/json`; no client request contains `user_id`, alias, body, query token, logging interceptor, or debug logging.
- Added one Preferences DataStore containing `token`, `user_id`, `alias`, `display_name`, and `timezone`. Complete sessions are replaced or cleared atomically; partial, corrupt, invalid-UUID, or blank metadata fails closed.
- Added lifecycle-aware states for loading, disconnected, validating, connected, unavailable/retry, and unauthorized. New tokens are persisted only after a valid 200 response; startup restores then revalidates; 401 and explicit switch clear the session; recoverable failures retain only an existing validated session.
- Request generation plus cancellation and a storage mutex prevent duplicate/stale completion from restoring a switched identity or overwriting a newer operation.
- Replaced the static shell with accessible password-style token entry, progress, validated identity, unavailable/retry, unauthorized re-entry, and switch controls. The screen is vertically scrollable and IME-aware.
- Pinned Lifecycle 2.9.4, DataStore 1.2.1, OkHttp/MockWebServer 5.3.0, Kotlinx Serialization 1.11.0, and Coroutines 1.11.0. OkHttp 5.5.0 was rejected by direct build evidence because it requires compileSdk 37; TASK-027 fixes this project at API 36.
- Documented identity connection, persistence, clear/retry behavior, and the accepted Phase 1A unencrypted app-private storage risk.

### Acceptance Criteria Results

- PASS: fresh entry rejects blank input; controlled valid `/me` persists and displays UUID, alias, display name, and timezone without exposing the token.
- PASS: process restart restores the session and revalidates to connected; 401 and explicit switch clear it, and restart after switch remains disconnected.
- PASS: recoverable failures retain saved metadata without claiming verification and never persist a failed new token; retry succeeds without competing writes.
- PASS: stale response, duplicate connect, malformed envelope, 401, server error, connection refusal, call timeout, partial/corrupt storage, and invalid metadata paths are covered.
- PASS: normal and 720x1280 narrow layouts, light/dark modes, 1.3 font scale, keyboard/IME, scrolling, semantics, loading, error, retry, connected, and switch states were exercised without clipping or overlap.
- PASS: no Todo, Room, sync, SSE, backend, PC Web, stable-contract, SDK, package, or release API-base change was introduced.

### Verification Commands And Results

- `android\gradlew.bat testDebugUnitTest lintDebug assembleDebug assembleRelease connectedDebugAndroidTest --rerun-tasks --console=plain`: PASS; 17 JVM tests and 6 API 36 device tests, all with zero failures/errors; debug and release builds succeeded.
- `android\gradlew.bat installDebug --console=plain`: PASS on `LifeOS_API_36`.
- `adb shell am start -W -S -n com.bpn0416.lifeos/.MainActivity`: PASS; cold launch status `ok`, process present, 681 ms total time, crash buffer empty.
- Temporary host-only fixture `/me` mock: PASS for actual token entry, bearer validation, connected display, restart/revalidation, switch clear, and restart-after-clear. It used no real bootstrap token and wrote nothing to the repository.
- Normal 1080x2400 light and narrow 720x1280 dark/font-scale-1.3 screenshots and UI hierarchy checks: PASS; 0 out-of-bounds nodes, keyboard visible with input usable, final connected hierarchy contained no token.
- Lint: 0 errors, 5 warnings. Accepted warnings are TASK-027-pinned Gradle/Core updates, OkHttp 5.5 requiring the forbidden API 37 baseline, its matching MockWebServer warning, and intentional debug-only cleartext networking.
- Optional real-backend smoke test was not run because no disposable real token was supplied; deterministic MockWebServer, device tests, and the temporary fixture server cover the contract without credential exposure.

### Git Diff Check

- `git status --short --untracked-files=all`: only TASK-028 Android files, the two active task records, and the preserved pre-existing `handoff/git-snapshot.md` transition.
- `git diff --check`: PASS; LF-to-CRLF notices are informational.
- `git diff --cached` and `git diff --cached --check`: empty/PASS; nothing staged.
- Independent trailing-whitespace/final-newline scan of 7 untracked text files: PASS.
- Dynamic-version, production logging, report-token, private-key, user-path, private-LAN, signing, generated-artifact, and forbidden request-field scans: PASS.
- Build outputs, APKs, captures, DataStore files, local properties, and emulator data remain ignored and absent from Git status.

### Unresolved Issues

- None blocking.
- Phase 1A intentionally stores the long-lived token unencrypted in app-private, backup-excluded DataStore; a compromised or rooted device remains an accepted residual risk.

### Task-Outside Findings

- None.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-09-20 13:26 +08:00
- Branch: `main`
- HEAD: `3b1f1fe638321bf3cfc0b2e7e998ef9edfc37338`
- Snapshot Commit: `3b1f1fe638321bf3cfc0b2e7e998ef9edfc37338`
- Blocking Issues: None.
- Verification:
  - PASS: typed bearer-only `/me` transport, strict identity parsing, complete-session DataStore persistence, startup revalidation, 401 clear, recoverable retention/retry, switch behavior, request generation/cancellation, and UI states match the approved task.
  - PASS: independent JVM tests reported 17 tests with 0 failures/errors/skips; API 36 instrumentation reported 6 tests with 0 failures/errors/skips.
  - PASS: lint reported 0 errors and 5 accepted warnings; debug/release builds, API 36 install, cold launch, process, crash-buffer, normal UI, and narrow dark/font-scale-1.3 checks passed.
  - PASS: backup exclusion, exact scope, pinned dependencies, whitespace, staged state, artifact, credential, URL/LAN/path/signing, logging, and forbidden-field scans passed.
- Non-blocking Suggestions:
  - The five lint warnings are accepted version-availability/debug-cleartext warnings under the fixed API 36 foundation.
  - An explicit ViewModel-disposal-only unit test is optional residual coverage; lifecycle cancellation is supplied by `viewModelScope`, and stale switch plus duplicate actions are directly tested.
  - Unencrypted app-private, backup-excluded DataStore remains the accepted Phase 1A rooted-device residual risk.
- Follow-up Tasks: None.
- Reviewed Scope: exact TASK-028 Android identity implementation/tests/docs plus active workflow records listed in `handoff/code-review-gate.md`.
- Recommended Commit Message: `feat(android): add identity validation and persistence`
- Next Role: Git Commit

## Git Commit

- Result Commit: `6b2a1fd23f29b66f96adb87a57f955465ddd5f8b`
- Commit Message: `feat(android): add identity validation and persistence`
- Branch: main
- Push Target: `origin/main`
- Code Review Result: PASS
- Completion Status: TASK-028 marked `COMPLETED` in both active task-status files after result commit publication.

## Closure

Result: PASS

Checked by: Decision window

Checked at: 2026-09-20 14:15 +08:00

Result Commit: `6b2a1fd23f29b66f96adb87a57f955465ddd5f8b`

Completion Commit: `e29d69204f2c64d72d305d890a444af52c0da6e0`

Remote Verification: local `HEAD`, `origin/main`, and remote `refs/heads/main` all matched completion commit `e29d69204f2c64d72d305d890a444af52c0da6e0` before closure-document edits.

Working Tree Before Closure Docs: clean; no staged, unstaged, or untracked files.

### Independent Verification

- `android\gradlew.bat testDebugUnitTest lintDebug assembleDebug assembleRelease --rerun-tasks --console=plain`: PASS on the published completion state; all 105 tasks executed successfully.
- JVM test reports: PASS, 17 tests with 0 failures, 0 errors, and 0 skipped.
- Lint: PASS with 0 errors; the five version-availability/debug-cleartext warnings accepted by Code Review remain non-blocking.
- Debug and release builds: PASS.
- Code Review: PASS with no blocking findings.
- Code Review independently verified 6/6 API 36 device tests, installation, cold launch, process/crash buffer, normal and narrow dark/font-scale rendering, backup exclusion, exact scope, artifact boundaries, and credential/security scans. No ADB device was connected during Closure, so these same-day device checks were not redundantly rerun.
- All TASK-028 acceptance criteria are confirmed from the published implementation, Code Review evidence, and Closure verification.

### Issue Disposition

- No TASK-028 issue-log entry or unresolved P0/P1/P2 issue exists.
- The optional ViewModel-disposal-only test remains non-blocking because lifecycle cancellation uses `viewModelScope`, while stale switch and duplicate-action paths have direct coverage.
- App-private, backup-excluded DataStore remains unencrypted at rest as the explicitly accepted Phase 1A rooted-device residual risk.
- A real-backend `/me` smoke test remains unclaimed because no disposable real token was supplied; deterministic MockWebServer, device tests, and the temporary fixture server cover the contract without credential exposure.

### Remaining Follow-ups

- Add Android identity-scoped local cache, durable sync pull/application, and Today/Todo read experience as the next bounded slice.
- Follow with Android quick add/edit/complete writes and then PC/Android end-to-end Phase 1A acceptance.
- Phase 1B reminder work remains excluded until Phase 1A Android and cross-client acceptance are complete or explicitly re-scoped.

### Terminal Closure Authorization

- Approved files: `docs/phase1a-progress.md`, `docs/phase1a-completion-audit.md`, `handoff/current-task.md`, `handoff/project-state.md`, and `tasks/TASK-028-android-identity-validation.md`.
- Recommended commit message: `docs(task): close TASK-028`.
- After this exact-scope commit is pushed and remote parity is verified, return to Decision without another Closure Check.
