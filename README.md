# LifeOS

## Local startup

Double-click `start-lifeos.cmd`, or run the PowerShell 7 launcher from the
repository root:

```powershell
pwsh -File .\start-lifeos.ps1
```

The launcher checks PostgreSQL, applies pending database migrations, bootstraps
local identities when needed, starts the API and PC Web app, opens the browser,
and prints both PC and same-Wi-Fi phone URLs. Runtime logs are stored under the
system temporary directory rather than in the repository.

Useful options:

```powershell
# Do not open the browser automatically.
pwsh -File .\start-lifeos.ps1 -NoBrowser

# Bind the web app to this PC only.
pwsh -File .\start-lifeos.ps1 -LocalOnly
```

## Local shutdown

Double-click `stop-lifeos.cmd`, or run:

```powershell
pwsh -File .\stop-lifeos.ps1
```

The stop launcher validates the process IDs, start times, and command lines
recorded by `start-lifeos` before stopping anything. PostgreSQL remains running
by default. To stop it too (which may show a Windows administrator prompt), run:

```powershell
pwsh -File .\stop-lifeos.ps1 -StopPostgres
```
