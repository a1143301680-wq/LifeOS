# LifeOS Android

## Pinned Toolchain

- Android Studio: not installed; the project was validated with the stable command-line SDK toolchain below
- JDK runtime: Oracle JDK 21.0.10 at `D:\tool\Java\Java21`
- Java and Kotlin bytecode target: 17
- Android SDK: `D:\tool\android-sdk`
- SDK command-line tools: 20.0
- Android SDK Platform: 36 revision 2
- Android SDK Build Tools: 36.0.0
- Android SDK Platform Tools: 37.0.0
- Android Emulator: 37.1.11
- System image: `system-images;android-36;google_apis;x86_64` revision 7
- Android Gradle Plugin: 8.13.2
- Gradle Wrapper: 8.14.3
- Kotlin and Compose compiler plugin: 2.3.21
- Compose UI/Foundation: 1.10.6
- Material 3: 1.4.0
- Lifecycle ViewModel/Compose: 2.9.4
- Preferences DataStore: 1.2.1
- OkHttp: 5.3.0
- Kotlinx Serialization JSON: 1.11.0
- Kotlinx Coroutines: 1.11.0

## Local Setup

Use PowerShell 7 and configure the toolchain for the current shell:

```powershell
$env:JAVA_HOME = 'D:\tool\Java\Java21'
$env:ANDROID_HOME = 'D:\tool\android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
```

The repository Wrapper is the only supported Gradle entry point:

```powershell
cd D:\LifeOS\android
.\gradlew.bat testDebugUnitTest lintDebug assembleDebug
```

Do not commit `local.properties`. `ANDROID_HOME` is sufficient for command-line builds.

## Emulator

Create the reusable API 36 phone AVD once:

```powershell
"no" | & "$env:ANDROID_HOME\cmdline-tools\latest\bin\avdmanager.bat" create avd `
  --name LifeOS_API_36 `
  --package "system-images;android-36;google_apis;x86_64" `
  --device "pixel_6"
```

Launch it and install the debug APK:

```powershell
& "$env:ANDROID_HOME\emulator\emulator.exe" -avd LifeOS_API_36
.\gradlew.bat installDebug
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell am start `
  -n com.bpn0416.lifeos/.MainActivity
```

## API Base Configuration

Debug builds default to `http://10.0.2.2:8000/api/v1/`, which reaches the development host from the Android Emulator. A physical device needs a non-committed PC LAN override:

```powershell
.\gradlew.bat assembleDebug -PLIFEOS_API_BASE_URL=http://<pc-lan-ip>:8000/api/v1/
```

For a physical device, run the backend on `0.0.0.0` and allow its port through Windows Firewall. Release builds use the HTTPS placeholder `https://api.invalid/api/v1/`; an HTTP `LIFEOS_RELEASE_API_BASE_URL` fails Gradle configuration. Debug-only manifest resources permit local cleartext traffic, while the main/release manifest rejects it.

## Identity Connection

The first screen accepts a manually provisioned bootstrap token and validates it with `GET /api/v1/me`. Only a successful response is stored. The app restores saved identity metadata on startup, revalidates it, clears it after a `401` or explicit identity switch, and keeps a previously validated session available for retry during temporary network failures.

The token is sent only in the `Authorization: Bearer` header. It is stored unencrypted in one app-private Preferences DataStore and excluded from Android backup/device transfer. This is the accepted Phase 1A baseline, not protection against a compromised or rooted device.
