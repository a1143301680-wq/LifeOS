# TASK-027: Android toolchain and runnable Compose foundation

Status: REVIEWING

Priority: P1

Parent: Phase 1A Android client

Published by: Decision window

Published at: 2026-09-10

## Goal

Establish a reproducible Android toolchain and create a buildable, installable, nonblank LifeOS Jetpack Compose application foundation without adding identity, Todo, or sync behavior.

## Scope Summary

- Install or locate stable API 36 Android tooling and validate an API 36 phone AVD when possible.
- Create a single-module `android/` Kotlin/Compose project with committed Gradle Wrapper and pinned versions.
- Use package `com.bpn0416.lifeos`, SDK levels 26/36/36, and Java/Kotlin target 17.
- Add a compact Material 3 LifeOS shell plus debug-only emulator/LAN API-base configuration.
- Verify unit/UI tests, lint, assembly, install, launch, rendering, artifacts, and secrets.
- Keep identity, networking, local cache, Todo, sync, backend, and PC Web behavior out of scope.

## Environment Baseline

- JDK 21.0.10: available at `D:\tool\Java\Java21` through `JAVA_HOME`.
- Android Studio and Android SDK: not found.
- `ANDROID_HOME` / `ANDROID_SDK_ROOT`: unset.
- `adb`, `emulator`, `sdkmanager`, `avdmanager`, and system Gradle: not on PATH.
- Gradle 8.14.3 distributions exist in the user cache but are not an approved project build interface.
- Emulator/AVD: unavailable before SDK installation.
- Physical Android/ADB device: none detected.
- Host capacity: 15.4 GB RAM; approximately 239.7 GB free on C and 113.3 GB free on D.
- Windows hypervisor: detected and running; exact WHPX feature state was not readable without elevation and must be validated by launching the AVD.

## Decisions

- Durable decisions are recorded in `docs/adr/0001-android-foundation.md`.
- Missing Android tooling is in TASK-027 scope; it is not an unknown prerequisite.
- Existing role windows remain sufficient. No permanent Environment window is added.

## Required Evidence

- Exact installed tool versions and paths.
- Repository Wrapper tests, lint, and debug build.
- Package/SDK/JVM/API-base/cleartext configuration checks.
- Normal/narrow Compose rendering, accessibility, install/launch/logcat evidence when available.
- Exact scope, ignored/generated artifact, whitespace, absolute-path, LAN-IP, signing, and secret checks.

## Workflow History

- 2026-09-10: Decision verified TASK-026 terminal closure `0856e28`, re-audited Phase 1A, marked backend and PC Web complete, and selected Android foundation as the next slice.
- 2026-09-10: Decision found JDK 21 available but no Android Studio, Android SDK, ADB, Emulator, AVD, or authorized physical device.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-09-10 10:58 +08:00
- Blocking Issues: None
- Next Role: Git Snapshot

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: `0856e2896f4278938a9339e2b638ceb6e132968d`
- Snapshot Commit: `cdfcf2befe7e8cb63ae4195e6df1e00d998c3bd9`
- Reason: approved TASK-027 readiness documents required a durable pre-Coding baseline

## Coding Result

### Result

- Result: PASS
- Final Status: REVIEWING
- Completed at: 2026-09-11
- Next Role: Code Review

### Environment Changes

- Kept Android Studio uninstalled and validated the project with stable command-line tooling.
- Used Oracle JDK 21.0.10 at `D:\tool\Java\Java21`; Java and Kotlin bytecode target 17.
- Used Android SDK at `D:\tool\android-sdk`: command-line tools 20.0, Platform 36 revision 2, Build Tools 36.0.0, Platform Tools 37.0.0, Emulator 37.1.11, and API 36 Google APIs x86_64 system image revision 7.
- Created and launched reusable AVD `LifeOS_API_36`; no physical device was required.

### Modified Files

- `.gitignore`
- `android/README.md`
- `android/settings.gradle.kts`, `android/build.gradle.kts`, `android/gradle.properties`
- `android/gradlew`, `android/gradlew.bat`, and `android/gradle/wrapper/**`
- `android/app/build.gradle.kts`, `android/app/proguard-rules.pro`
- `android/app/src/main/**` and `android/app/src/debug/**`
- `android/app/src/test/**` and `android/app/src/androidTest/**`
- `handoff/current-task.md`
- `tasks/TASK-027-android-compose-foundation.md`

### Implementation Summary

- Added a single-module Kotlin/Compose application with namespace and application ID `com.bpn0416.lifeos`, `minSdk 26`, `compileSdk 36`, `targetSdk 36`, and JVM target 17.
- Pinned AGP 8.13.2, Gradle Wrapper 8.14.3 with distribution SHA-256 verification, Kotlin/Compose compiler 2.3.21, Compose UI/Foundation 1.10.6, and Material 3 1.4.0.
- Added typed API-base normalization and validation. Debug defaults to `http://10.0.2.2:8000/api/v1/` and accepts a Gradle property override; release defaults to an HTTPS placeholder and rejects HTTP configuration.
- Restricted cleartext traffic to debug resources. Main/release configuration rejects cleartext traffic.
- Added a responsive light/dark Material 3 LifeOS shell with stable semantics for app identity, Today content, and disconnected identity state.
- Added setup, Wrapper, emulator, physical-device LAN override, and backend `0.0.0.0` documentation plus Android artifact ignore rules.

### Acceptance Criteria Results

- PASS: valid single-module Compose project, exact package and SDK levels, pinned versions, committed Wrapper, and JDK 21 build with JVM target 17.
- PASS: debug API default/override, URL validation, release HTTPS enforcement, and debug-only cleartext boundary.
- PASS: nonblank accessible shell rendered in light and dark themes at normal and narrow dimensions with font scale 1.3; hierarchy bounds and screenshot inspection found no clipping or overflow.
- PASS: four deterministic API-base unit tests and one Compose instrumentation smoke test.
- PASS: API 36 AVD installation, APK install, cold launch, live process, empty crash buffer, and screenshot evidence.
- PASS: setup documentation, ignored artifacts, exact-scope check, whitespace check, and credential/path/IP scans.
- PASS: no identity, networking, Todo, sync, backend, PC Web, or stable-contract behavior was added.

### Verification Commands and Results

- `android\gradlew.bat --version`: PASS; Gradle 8.14.3 on JDK 21.0.10.
- `android\gradlew.bat testDebugUnitTest lintDebug assembleDebug assembleRelease --console=plain`: PASS; 4 unit tests, 0 failures; debug and release APKs assembled.
- `android\gradlew.bat connectedDebugAndroidTest`: PASS on `LifeOS_API_36`; 1 test, 0 failures.
- `android\gradlew.bat installDebug`: PASS; installed on the API 36 AVD.
- `adb shell am start -W -S -n com.bpn0416.lifeos/.MainActivity`: PASS; cold start status `ok`, process present, 1205 ms total time, crash buffer empty.
- Normal 1080x2400 light and narrow 720x1280 dark/font-scale-1.3 screenshots: PASS by visual, hierarchy-bound, and nonblank pixel inspection; captures remain ignored.
- `-PLIFEOS_RELEASE_API_BASE_URL=http://example.test/api/v1/`: expected configuration failure proving the release HTTPS guard.
- `-PLIFEOS_API_BASE_URL=http://192.0.2.10:8000/api/v1`: PASS using a reserved documentation address, proving non-committed debug override support.
- Lint: 0 errors, 3 accepted warnings: newer Gradle available, Core 1.19 requires the newer API 37/AGP 9.1 line, and intentional debug-only cleartext configuration.

### Git Diff Check

- `git status --short --untracked-files=all`: only approved TASK-027 files plus the preserved pre-existing `handoff/git-snapshot.md` state change.
- `git diff --check`: PASS; LF-to-CRLF notices are informational.
- `git diff --cached` and `git diff --cached --check`: empty/PASS; nothing staged.
- Independent whitespace/final-newline scan of 23 untracked text files: PASS.
- Dynamic-version, generated-artifact, credential, private-key, user-path, LAN-IP, and signing-material scans: PASS.
- Build, IDE, capture, APK/AAB, local property, emulator, and signing artifacts are ignored.

### Unresolved Issues

- None blocking. Android Studio remains uninstalled by design; the stable command-line SDK/Wrapper path is fully validated.
- Three intentional/non-blocking lint warnings are recorded above.

### Task-Outside Findings

- None.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-09-11 15:11 +08:00
- Branch: `main`
- HEAD: `cdfcf2befe7e8cb63ae4195e6df1e00d998c3bd9`
- Snapshot Commit: `cdfcf2befe7e8cb63ae4195e6df1e00d998c3bd9`
- Blocking Issues: None.
- Verification:
  - PASS: project/package/SDK/JVM/Wrapper/plugin/dependency configuration matches TASK-027 and ADR-0001.
  - PASS: debug/release generated BuildConfig, merged manifests, and packaged network-security resources enforce the intended API-base and cleartext boundaries.
  - PASS: 4 JVM tests were independently rerun; lint, debug, and release builds were rerun successfully.
  - PASS: API 36 instrumentation test passed 1/1; APK install, cold launch, resumed Activity, process, and empty crash buffer were independently verified.
  - PASS: normal light and narrow dark/font-scale captures are nonblank and show no clipping, overlap, or horizontal overflow.
  - PASS: exact scope, Wrapper/package metadata, ignored/generated artifacts, dynamic versions, whitespace/final newline, LAN/path/signing material, secrets, staged state, and diff checks passed.
- Non-blocking Suggestions:
  - Retain the current pinned API 36-compatible versions until an explicit toolchain upgrade task; lint reports newer Gradle/Core lines that would change the approved baseline.
  - Android Studio remains optional for this verified command-line foundation.
- Follow-up Tasks: None.
- Reviewed Scope: exact TASK-027 Android foundation files listed in `handoff/code-review-gate.md`, plus the preserved Snapshot workflow-state record.
- Recommended Commit Message: `feat(android): add runnable Compose foundation`

## Git Commit

Authorized by Code Review PASS. Recommended commit message: `feat(android): add runnable Compose foundation`.

## Closure

Pending.
