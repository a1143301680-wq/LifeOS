# ADR-0001: Android Foundation Baseline

Status: Accepted

Date: 2026-09-10

## Context

Phase 1A backend and PC Web delivery are complete. The repository has no Android project or installed Android SDK on the current Windows host. The Android foundation must be reproducible, support local emulator and physical-device development, and avoid prematurely implementing identity, Todo, sync, reminders, or offline behavior.

## Decision

### Application Identity

- Repository directory: `android/`
- Gradle module: `app`
- Namespace and application ID: `com.bpn0416.lifeos`
- Initial version: `versionCode = 1`, `versionName = "0.1.0"`

The application ID is treated as permanent and remains `com.bpn0416.lifeos` in the initial debug and release variants.

### Platform Levels

- `minSdk = 26`
- `compileSdk = 36`
- `targetSdk = 36`

API 26 is sufficient for the intended personal devices and avoids carrying compatibility work for obsolete Android versions. API 36 satisfies the Google Play target requirement effective 2026-08-31 while avoiding premature target behavior changes from API 37.

### Language And Build

- Native Kotlin and Jetpack Compose with Material 3
- Gradle Kotlin DSL
- Java/Kotlin source and bytecode target 17
- Gradle may run with the installed JDK 21
- Gradle Wrapper is committed and is the only supported command-line build entry
- Android Gradle Plugin, Kotlin/Compose, libraries, and Wrapper versions are pinned; dynamic versions are forbidden
- Use a current stable Android Studio/API 36-compatible template, not preview or canary tooling

Exact plugin and library versions become part of the committed project and must be reported by TASK-027. The selected versions must be mutually compatible and supported by stable Android Studio.

### API Base Address

- Emulator debug default: `http://10.0.2.2:8000/api/v1/`
- Physical-device debug: non-committed override such as `http://<pc-lan-ip>:8000/api/v1/`
- Override input: Gradle/local property named `LIFEOS_API_BASE_URL` or an equivalently narrow non-secret mechanism
- Committed configuration must not contain a real LAN address, bearer token, user identity, or machine-specific absolute path
- Base URLs are validated and normalized with a trailing slash

The emulator uses `10.0.2.2` because Android Emulator reserves it as the alias for the development host loopback interface. A physical device instead uses the PC LAN address, requires the backend to listen on `0.0.0.0`, and may require a Windows Firewall rule.

### Network Security

- Local HTTP cleartext is allowed only in the debug variant.
- Release must not inherit broad cleartext permission.
- Release configuration must reject an HTTP base or use an explicit HTTPS placeholder until deployment is defined.
- TASK-027 defines configuration only and performs no API request.

### Local Tooling And Device

- Install stable Android Studio or equivalent stable command-line SDK components.
- Required SDK components: Platform 36, compatible Build Tools, Platform Tools, Emulator, and an API 36 x86_64 phone system image.
- Prefer Windows Hypervisor Platform for emulator acceleration when available.
- Create one reusable API 36 phone AVD for development.
- Machine installations, SDK paths, `local.properties`, AVD data, emulator images, IDE state, captures, APKs, and signing material are not committed.

## Consequences

- TASK-027 can close with a reproducible build and runnable shell before product behavior is introduced.
- Identity/authentication follows in a separate task with a stable package and build base.
- API-base differences between emulator and physical device do not require source edits.
- Debug local HTTP remains convenient without weakening release networking.
- Supporting Android versions below API 26 requires a future explicit Decision.

## References

- Android Studio stable releases and AGP compatibility: https://developer.android.com/studio/releases
- Android Gradle Plugin compatibility: https://developer.android.com/build/releases/gradle-plugin
- Java versions in Android builds: https://developer.android.com/build/jdks
- Google Play target API requirements: https://developer.android.com/google/play/requirements/target-sdk
- Android Emulator network address space: https://developer.android.com/studio/run/emulator-networking-address
