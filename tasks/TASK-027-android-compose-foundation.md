# TASK-027: Android toolchain and runnable Compose foundation

Status: READY

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

Pending.

## Coding Result

Pending.

## Code Review

Pending.

## Git Commit

Pending.

## Closure

Pending.
