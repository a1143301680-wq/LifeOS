# TASK-028: Android identity validation and token persistence

Status: READY

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

Pending.

## Coding Result

Pending.

## Code Review

Pending.

## Git Commit

Pending.

## Closure

Pending.
