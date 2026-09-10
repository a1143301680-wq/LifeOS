# LifeOS Current Task

Last updated: 2026-09-10

## Metadata

- Task ID: TASK-027
- Task Name: Android toolchain and runnable Compose foundation
- Status: READY
- Priority: P1
- Parent Task: Phase 1A Android client
- Dependencies:
  - TASK-026 terminal Closure Commit published in `0856e28`
  - Phase 1A backend and stable API contract complete
  - PC Web Phase 1A client scope complete through TASK-025
  - Local JDK 21.0.10 available at `D:\tool\Java\Java21`

## Decision

Create the first Android vertical slice as a reproducible development toolchain plus a buildable, installable, nonblank Jetpack Compose application. Do not add identity or Todo behavior yet. The next task will build identity validation on this verified foundation.

Long-lived Android baseline decisions are recorded in `docs/adr/0001-android-foundation.md`:

- namespace/application ID: `com.bpn0416.lifeos`
- Kotlin + Jetpack Compose, Gradle Kotlin DSL
- `minSdk 26`, `compileSdk 36`, `targetSdk 36`
- Java source/toolchain level 17; Gradle may run on the installed JDK 21
- committed Gradle Wrapper with pinned plugin/dependency versions
- emulator debug API default: `http://10.0.2.2:8000/api/v1/`
- physical-device debug API: non-committed override to the PC LAN address
- cleartext HTTP permitted only for debug builds; release builds reject cleartext base URLs

## Environment Baseline

Checked by Decision on 2026-09-10:

- JDK/Javac: 21.0.10, available and selected by `JAVA_HOME`
- System Gradle: not on PATH; Gradle 8.14.3 distributions are cached, but TASK-027 must commit and use its own Wrapper
- Android Studio: not found in system or user-level common installation locations
- Android SDK: not found; `ANDROID_HOME` and `ANDROID_SDK_ROOT` are unset
- `adb`, `emulator`, `sdkmanager`, `avdmanager`: not on PATH
- Android AVD: unavailable because the SDK/emulator is absent
- Physical Android/ADB device: none detected; debugging authorization cannot be verified without `adb`
- Host capacity: 15.4 GB RAM; approximately 239.7 GB free on C and 113.3 GB free on D
- Windows hypervisor: detected and running; individual optional-feature state requires elevation and remains to be proven by an actual emulator launch

The missing Android toolchain is an explicit part of this bootstrap task, not an unknown prerequisite. Coding may install the selected stable Android Studio/SDK components, but must not change unrelated system software or claim emulator/device success without direct evidence.

## Goal

Produce a reproducible `android/` project that builds from the repository with its Gradle Wrapper, installs and launches on an available API 36 emulator, renders a compact LifeOS foundation screen without crashing or overflow, and documents the exact local setup and API-base override path for later Android tasks.

## Scope

### In Scope

- Install or locate a stable Android development toolchain compatible with API 36 and the pinned project build.
- Install Android SDK Platform 36, compatible Build Tools, Platform Tools, Emulator, and one API 36 x86_64 phone system image.
- Create and validate one reusable LifeOS API 36 phone AVD when Windows virtualization permits.
- Add a single-module `android/` Kotlin/Jetpack Compose application using Gradle Kotlin DSL.
- Commit Gradle Wrapper scripts/JAR/properties and pin every plugin/dependency version.
- Configure namespace and application ID `com.bpn0416.lifeos`.
- Configure `minSdk 26`, `compileSdk 36`, `targetSdk 36`, and Java/Kotlin JVM target 17.
- Add a small real LifeOS app shell using Material 3 that renders on normal and narrow phone dimensions.
- Add a typed, validated debug API-base build configuration with emulator default and non-committed LAN override.
- Restrict cleartext HTTP to debug; release configuration must reject or exclude cleartext endpoints.
- Add Android-specific ignore rules and setup/build/run documentation.
- Add focused unit/UI smoke coverage and verify build, lint, install, launch, and nonblank rendering where the environment permits.

### Out of Scope

- Identity token entry, `/me`, authentication, secure token persistence, logout, or user switching.
- Retrofit/Ktor API implementation, Todo/category calls, Room cache, sync cursor, SSE, WorkManager, or offline queue.
- Today, Todo, category, reminder, widget, or notification product behavior.
- Backend or PC Web modifications.
- Stable requirements, MVP, architecture, API-contract, or data-model changes beyond the Decision-owned audit/ADR publication files.
- Release signing, Play Console publication, developer registration, CI/CD, analytics, or crash reporting.
- Supporting multiple app modules, flavors other than standard debug/release, tablets, Wear, TV, Automotive, or XR.

## Relevant Files

### Expected Read Files

- `docs/adr/0001-android-foundation.md`
- `docs/architecture.md` Android and offline sections
- `docs/mvp.md` Phase 1A Android scope
- `.gitignore`
- repository root layout and existing build conventions
- Android official compatibility documentation routed by the ADR

### Allowed Modify Files

- `android/**`
- `.gitignore`
- `handoff/current-task.md`
- `tasks/TASK-027-android-compose-foundation.md`

### Forbidden Modify Files

- `backend/**`
- `web/**`
- `docs/requirements.md`
- `docs/architecture.md`
- `docs/mvp.md`
- `docs/api-phase1a.md`
- `docs/data-model-phase1.md`
- `docs/phase1a-progress.md`
- `docs/phase1a-completion-audit.md`
- `docs/adr/0001-android-foundation.md`
- `handoff/project-state.md`
- completed task archives through TASK-026
- workflow prompts and gate result files

## Implementation Requirements

1. Prefer stable Android Studio/SDK packages. Record exact installed versions and paths; do not use preview/canary components.
2. Use the repository Gradle Wrapper for every build. Do not depend on a system `gradle` command or unpinned dynamic versions.
3. Keep generated/local files out of Git, including `local.properties`, `.gradle/`, `.idea/`, module/root `build/`, captures, APK output, emulator data, and signing material.
4. The committed project must build with the installed JDK 21 while explicitly targeting Java/Kotlin 17 bytecode/toolchain semantics.
5. The default debug API base must be `http://10.0.2.2:8000/api/v1/`. Permit an override through a non-secret Gradle/local property such as `LIFEOS_API_BASE_URL`; never commit a machine LAN IP.
6. Normalize and validate the configured base URL, including required scheme and trailing slash. Do not add network calls in this task.
7. Debug may opt into cleartext HTTP solely for local development. Release must not inherit broad cleartext permission and must fail configuration or use an HTTPS placeholder when given HTTP.
8. The first screen must be a usable app shell, not a marketing page: LifeOS identity, a restrained top bar, and a stable content area ready for the next identity task. It must support system light/dark theme, font scaling, and accessibility semantics.
9. Keep UI state and dimensions stable at a common phone viewport and a narrow phone viewport; no overlap, clipping, or horizontal overflow.
10. Add deterministic unit tests for API-base normalization/validation and at least one Compose UI smoke test for visible app identity/content semantics.
11. Run Wrapper verification, unit tests, lint, and debug assembly. If an emulator can run, install the APK, launch it, inspect logcat for fatal errors, and capture evidence at normal and narrow phone profiles.
12. If Android Studio installation, SDK license acceptance, WHPX/virtualization, or device authorization requires user interaction, stop only that external step with exact evidence; continue every independent repository/build check that remains possible.

## Acceptance Criteria

- [ ] `android/` is a valid single-module Kotlin/Compose project with no generated IDE project noise committed.
- [ ] Namespace and application ID are exactly `com.bpn0416.lifeos`.
- [ ] `minSdk`, `compileSdk`, and `targetSdk` are exactly 26, 36, and 36.
- [ ] Plugin and dependency versions are pinned; Gradle Wrapper files are committed and used successfully.
- [ ] Build runs with local JDK 21 and Java/Kotlin target/toolchain level 17.
- [ ] Debug API base defaults to `http://10.0.2.2:8000/api/v1/` and supports a non-committed LAN override.
- [ ] Invalid API base values fail safely; no token, LAN IP, secret, or user-specific absolute path is committed.
- [ ] Cleartext local HTTP is debug-only and release does not permit broad cleartext traffic.
- [ ] The launch activity renders a nonblank LifeOS Compose shell with stable light/dark behavior and accessibility semantics.
- [ ] Normal and narrow phone checks show no overlap, clipping, horizontal overflow, or unreadable text.
- [ ] Unit tests and Compose UI smoke tests pass.
- [ ] `gradlew.bat lintDebug`, `testDebugUnitTest`, and `assembleDebug` pass.
- [ ] An API 36 AVD and `adb` installation/launch result are evidenced, or the exact external virtualization/authorization blocker is recorded without a false success claim.
- [ ] Android setup documentation includes SDK requirements, Wrapper commands, emulator run, LAN override, and backend `0.0.0.0` requirement for a physical device.
- [ ] `.gitignore` excludes local Android SDK, IDE, build, APK, capture, emulator, and signing artifacts.
- [ ] No backend, PC Web, stable contract, completed task archive, auth, Todo, sync, reminder, or other out-of-scope change is included.
- [ ] `git diff --check`, staged checks, artifact checks, and secret scans pass.

## Verification Plan

- Record exact Java, Android Studio, SDK, build-tools, platform-tools, emulator, system-image, Gradle Wrapper, AGP, Kotlin, and Compose versions.
- Run `android/gradlew.bat --version`, `testDebugUnitTest`, `lintDebug`, and `assembleDebug` from the repository.
- Inspect Gradle dependency/plugin declarations for dynamic versions and unexpected repositories.
- Verify package, SDK levels, Java/Kotlin target, API-base default/override, and debug/release cleartext separation.
- Run unit and Compose UI smoke tests.
- Use `adb devices -l`, AVD inventory, APK install, activity launch, screenshot/pixel inspection, and filtered logcat when an emulator/device is available.
- Inspect normal and narrow rendering, font scaling, dark theme, semantics, and overflow.
- Inspect exact Git status/diff, ignored/generated files, whitespace, credentials, absolute paths, LAN addresses, and signing files.

## Risks

- SDK and emulator downloads are large and may require interactive license acceptance.
- Windows virtualization/WHPX may require a reboot or system setting outside repository work.
- A fresh API 36 image may require substantial RAM and disk space.
- Over-scaffolding architecture before identity/sync requirements are implemented would create avoidable abstraction.
- Broad cleartext configuration could leak into release builds if variant ownership is not explicit.

## Coding Output Requirements

Report environment changes and exact versions/paths, modified files, package/SDK/toolchain settings, Wrapper/plugin/dependency versions, API-base and cleartext strategy, app-shell behavior, accessibility/responsive evidence, tests/lint/build, AVD/adb/install/launch/logcat/screenshot evidence or exact limitation, ignored/generated files, diff/whitespace/artifact/secret checks, unresolved issues, and next role.

## Current Stage

Next role: Git Snapshot

Required next action: establish the pre-Coding Git Snapshot for the approved ten-file TASK-027 publication/readiness scope. Do not install Android tooling or start Coding before Git Snapshot completes.
