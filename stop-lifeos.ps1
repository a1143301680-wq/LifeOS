[CmdletBinding()]
param(
    [switch]$StopPostgres
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot
$runRoot = Join-Path $env:TEMP 'LifeOS\run'
$statePath = Join-Path $runRoot 'state.json'

function Stop-PostgresService {
    $services = @(Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue |
        Where-Object Status -eq 'Running')
    if ($services.Count -eq 0) {
        Write-Host 'PostgreSQL is already stopped.' -ForegroundColor Yellow
        return
    }

    $pwsh = (Get-Command pwsh -ErrorAction Stop).Source
    foreach ($service in $services) {
        try {
            Stop-Service -Name $service.Name
        }
        catch {
            Write-Host 'Windows administrator approval is required to stop PostgreSQL.' -ForegroundColor Yellow
            $escapedServiceName = $service.Name.Replace("'", "''")
            $elevatedCommand = "Stop-Service -Name '$escapedServiceName'"
            $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($elevatedCommand))
            $elevated = Start-Process -FilePath $pwsh `
                -ArgumentList @('-NoLogo', '-NoProfile', '-EncodedCommand', $encodedCommand) `
                -Verb RunAs `
                -Wait `
                -PassThru
            if ($elevated.ExitCode -ne 0) {
                throw 'PostgreSQL was not stopped.'
            }
        }
    }
    Write-Host 'PostgreSQL stopped.' -ForegroundColor Green
}

try {
    if (-not (Test-Path -LiteralPath $statePath)) {
        Write-Host 'No LifeOS launcher state was found. The frontend and backend are already stopped, or were not started with start-lifeos.' -ForegroundColor Yellow
        if ($StopPostgres) { Stop-PostgresService }
        exit 0
    }

    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if ($state.version -ne 1 -or $state.repository -ne $repoRoot) {
        throw "The launcher state is invalid or belongs to another repository. Refusing to stop any process. State: $statePath"
    }

    $stateIsSafeToRemove = $true
    foreach ($record in $state.processes) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($record.processId)" -ErrorAction SilentlyContinue
        if (-not $process) {
            Write-Host "$($record.name) is already stopped." -ForegroundColor Yellow
            continue
        }

        $sameProcess = ([datetime]$process.CreationDate) -eq ([datetime]$record.creationDate) -and
            [string]$process.CommandLine -eq [string]$record.commandLine
        if (-not $sameProcess) {
            Write-Warning "PID $($record.processId) no longer matches the recorded $($record.name) process. It was not stopped."
            $stateIsSafeToRemove = $false
            continue
        }

        Stop-Process -Id $record.processId -ErrorAction Stop
        Write-Host "$($record.name) stopped (PID $($record.processId))." -ForegroundColor Green
    }

    if ($stateIsSafeToRemove) {
        Remove-Item -LiteralPath $statePath -Force
    }
    else {
        throw "One or more recorded processes failed identity validation. State retained at $statePath"
    }

    if ($StopPostgres) {
        Stop-PostgresService
    }
    else {
        Write-Host 'PostgreSQL was left running. Use -StopPostgres to stop it too.'
    }

    Write-Host "`nLifeOS services stopped." -ForegroundColor Green
}
catch {
    Write-Host "`nLifeOS stop failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
