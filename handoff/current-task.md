# LifeOS Current Task

Last updated: 2026-09-20

## Metadata

- Task ID: TASK-028
- Task Name: Android identity validation and token persistence
- Status: COMPLETED
- Priority: P1
- Parent Task: Phase 1A Android client
- Dependencies:
  - TASK-027 terminal Closure Commit `658f800`
  - Android foundation result `629bf71`
  - Stable `/api/v1/me` contract and backend implementation from baseline `6a85b4a`

## Background

TASK-027 established a reproducible API 36 Compose application and verified the emulator, build, network-security, and API-base configuration. The Android client still has no authenticated identity. Phase 1A uses manually provisioned long-lived bootstrap tokens; the bearer token, not a visible alias or client-supplied `user_id`, determines the current user.

## Goal

Deliver a runnable Android identity flow that accepts a bootstrap token, validates it with `GET /api/v1/me`, persists only a validated identity session in app-private Preferences DataStore, restores and revalidates it after restart, and provides safe retry and identity-switch behavior.

## In Scope

- Add the Android `INTERNET` permission and a typed `/me` client using the existing `BuildConfig.API_BASE_URL`.
- Use pinned, toolchain-compatible OkHttp and Kotlinx Serialization dependencies for bearer HTTP and structured response parsing.
- Use pinned Preferences DataStore for the raw token and validated identity metadata: UUID, alias, display name, and timezone.
- Use a lifecycle-aware ViewModel/state holder with explicit loading, disconnected, validating, connected, recoverable-error, and unauthorized states.
- Add a password-style token entry, connect/retry actions, validated identity display, and a clear/switch-identity action.
- Add deterministic unit/instrumentation coverage, responsive/accessibility verification, and concise Android run documentation.

## Out Of Scope

- Identity discovery/listing, token generation/rotation, QR import, full login/account flows, biometric gating, and custom token encryption.
- Todo/category/Today APIs or UI, Room, local entity cache, sync pull, SSE, WorkManager, offline write replay, reminders, widgets, and notifications.
- Backend, PC Web, stable API/product/architecture/data-model changes, deployment, release server selection, or real LAN addresses.

## Relevant Files

- `docs/api-phase1a.md`: sections 2, 4, 5, and 8.1
- `docs/architecture.md`: Android and identity responsibilities
- `docs/data-model-phase1.md`: user identity and Android DataStore guidance
- `docs/adr/0001-android-foundation.md`: fixed Android/toolchain/API-base boundary
- `android/app/build.gradle.kts`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/java/com/bpn0416/lifeos/`
- `android/app/src/test/` and `android/app/src/androidTest/`

## Allowed Files

- `android/build.gradle.kts`
- `android/app/build.gradle.kts`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/java/com/bpn0416/lifeos/**`
- `android/app/src/main/res/values/strings.xml`
- `android/app/src/test/**`
- `android/app/src/androidTest/**`
- `android/README.md`
- `.gitignore` only if a newly introduced local/generated Android artifact requires a narrow exclusion
- `docs/phase1a-progress.md`
- Active TASK-028 workflow state, gate, Git record, and issue-log files

## Forbidden Files And Changes

- All `backend/**` and `web/**` files
- Stable contract documents, `docs/adr/0001-android-foundation.md`, and completed task archives
- Todo, category, Today, Room, sync, SSE, WorkManager, reminder, widget, notification, or offline-write behavior
- SharedPreferences or ad hoc token files as an alternative to DataStore
- Deprecated `EncryptedSharedPreferences`, custom cryptography, token-bearing URLs/logs/errors/screenshots/test reports, committed raw tokens, real LAN IPs, machine paths, signing material, or generated build output
- Dynamic dependency/plugin versions or unapproved SDK/package/API-base changes

## Implementation Requirements

1. Normalize manual input by trimming surrounding whitespace; reject an empty value locally. Never show the token again after successful connection.
2. Call exactly `GET <API_BASE_URL>/me` with `Authorization: Bearer <token>` and `Accept: application/json`. Do not send `user_id`, alias, or token in the URL, body, query, logs, analytics, exception text, or user-facing error details.
3. Parse the documented data/error envelopes structurally. A successful identity requires a valid UUID and nonblank alias, display name, and timezone. Authorization remains token-derived; persisted alias/UUID are display and future cache-partition metadata only.
4. Persist the raw token and complete validated identity metadata atomically only after a valid 200 `/me` response. Use one app-private Preferences DataStore owned by a narrowly scoped identity store.
5. On startup, read DataStore before rendering a final state. If a saved session exists, show a validating/restoring state and revalidate it with `/me`.
6. A `/me` `401 unauthorized` response clears token and identity metadata atomically and returns to token entry with a concise re-entry message. Explicit switch identity does the same without making a network request.
7. Network failures, timeouts, malformed responses, and non-401 server errors are recoverable. For an already saved session, retain the session and cached identity metadata, show an unavailable/retry state, and never falsely mark it freshly verified. For a newly entered token, do not persist it until validation succeeds.
8. Ignore or cancel stale request completion after retry, identity switch, ViewModel disposal, or a newer validation attempt. Duplicate connect/retry actions must not create competing state writes.
9. Preserve the existing API-base and debug-only cleartext/release HTTPS guarantees. Configure bounded connect/read/call timeouts and close response bodies.
10. Keep DataStore out of cloud backup/device transfer using the existing backup-disabled application boundary; do not introduce a second credential store. Record app-private unencrypted-at-rest storage as the accepted Phase 1A residual risk.
11. The operational first screen must support loading, token entry, validation, connected identity, recoverable unavailable/retry, invalid-token re-entry, and explicit switch states in light/dark normal and narrow layouts with large font scale.
12. Keep the implementation small and testable. Do not scaffold Room, repositories for future entities, navigation graphs, dependency-injection frameworks, or sync abstractions in this task.

## Acceptance Criteria

- [ ] A fresh install shows accessible token entry and cannot submit an empty token.
- [ ] A valid mocked `/me` response stores one validated session and displays server-returned identity metadata.
- [ ] Restart/process recreation restores the saved session, revalidates it, and reaches connected state without exposing the token.
- [ ] Every `/me` request uses the bearer header only; no `user_id`, alias, or token appears in URL/body/query/logs/errors.
- [ ] Invalid/missing authorization clears saved identity on 401 and provides a clear re-entry path.
- [ ] Recoverable failures retain an existing saved session, do not persist a new unvalidated token, and provide retry without false verified state.
- [ ] Explicit switch identity atomically clears token and metadata and prevents stale requests from restoring them.
- [ ] Corrupt, partial, or invalid persisted identity metadata fails closed to token entry without crashing or leaking values.
- [ ] Unit tests cover URL/header construction, strict envelope parsing, state transitions, persistence rules, 401, recoverable failures, cancellation/stale responses, and duplicate actions.
- [ ] Instrumentation/UI checks cover DataStore persistence/clear behavior and the principal Compose states on the API 36 AVD.
- [ ] `testDebugUnitTest`, `lintDebug`, `assembleDebug`, `assembleRelease`, and applicable instrumentation tests pass using `android\gradlew.bat` on JDK 21.
- [ ] Normal/narrow, light/dark, font-scale, semantics, focus, keyboard, loading, error, retry, and switch controls are usable without clipping or overlap.
- [ ] Dependency versions are pinned; generated artifacts, credentials, real LAN addresses, machine paths, and out-of-scope changes are absent.

## Verification Plan

- Use deterministic fake or MockWebServer responses for valid identity, 401, malformed 200/error envelopes, timeout, connection failure, and non-401 server errors.
- Test the identity store with isolated DataStore files and verify atomic save/clear, complete-record validation, corruption handling, and no write before successful validation.
- Test ViewModel/state transitions with controllable requests, including retry, duplicate actions, stale completion, and switch during validation.
- Run `android\gradlew.bat testDebugUnitTest --rerun-tasks --console=plain`.
- Run `android\gradlew.bat lintDebug assembleDebug assembleRelease --rerun-tasks --console=plain`.
- Run focused instrumentation/UI tests on `LifeOS_API_36`, then install and cold-launch the debug APK; inspect crash logs and normal/narrow screenshots when the emulator is available.
- Optionally smoke-test `/me` against a running local backend only when a disposable raw token can be supplied without writing it to the repository, command history, logs, or chat. Mocked deterministic coverage is mandatory regardless.
- Inspect exact Git scope, staged state, whitespace, dependency locking, ignored output, APK/resources, token-like strings, URLs, LAN IPs, user paths, signing files, and debug logging.

## Risks

- A long-lived raw token remains readable to a compromised/rooted device because Phase 1A specifies app-private DataStore without a custom encryption layer.
- Startup network failure must not be confused with invalid authorization or erase a valid saved session.
- Async validation can restore stale credentials after identity switch unless request ownership is explicit.
- UI tests must avoid embedding realistic token material in screenshots or reports.
- Adding broad networking or architecture layers now could accidentally absorb later Todo/sync scope.

## Coding Output Requirements

Report modified files, pinned dependency versions, identity-store schema, HTTP request/response behavior, state model, persistence/clear rules, cancellation ownership, security checks, UI/accessibility behavior, unit/instrumentation/build/lint/emulator evidence, optional live-backend limitation, exact diff/artifact/secret checks, unresolved issues, task-outside findings, and next role.

## Current Stage

Closure Check: PASS

Checked at: 2026-09-20 14:15 +08:00

Result commit: `6b2a1fd23f29b66f96adb87a57f955465ddd5f8b`

Completion commit: `e29d69204f2c64d72d305d890a444af52c0da6e0`

Next role: Git Commit (Terminal Closure Commit)

Required next action: commit and push only the five Closure-authorized documents with message `docs(task): close TASK-028`, verify remote parity, and return control to Decision. Do not run another Closure Check.
