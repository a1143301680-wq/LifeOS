[CmdletBinding()]
param(
    [int]$BackendPort = 8000,
    [int]$WebPort = 5173,
    [switch]$NoBrowser,
    [switch]$LocalOnly
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot
$backendRoot = Join-Path $repoRoot 'backend'
$webRoot = Join-Path $repoRoot 'web'
$runRoot = Join-Path $env:TEMP 'LifeOS\run'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Get-RequiredCommand([string]$Name) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "Required command '$Name' was not found on PATH."
    }
    return $command.Source
}

function Test-ListeningPort([int]$Port) {
    return $null -ne (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Test-Http([string]$Url) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    }
    catch {
        return $false
    }
}

function Wait-ForHttp([string]$Name, [string]$Url, [System.Diagnostics.Process]$Process, [string]$ErrorLog) {
    $deadline = (Get-Date).AddSeconds(30)
    do {
        if (Test-Http $Url) {
            Write-Host "$Name is ready." -ForegroundColor Green
            return
        }
        if ($Process.HasExited) {
            $details = if (Test-Path $ErrorLog) { (Get-Content $ErrorLog -Tail 20) -join "`n" } else { 'No error log was written.' }
            throw "$Name exited before becoming ready.`n$details"
        }
        Start-Sleep -Milliseconds 400
    } while ((Get-Date) -lt $deadline)

    throw "$Name did not become ready within 30 seconds. See $ErrorLog"
}

function Get-LanAddress {
    $address = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
        Where-Object { $_.NetAdapter.Status -eq 'Up' -and $_.IPv4DefaultGateway -and $_.IPv4Address } |
        ForEach-Object { $_.IPv4Address.IPAddress } |
        Where-Object { $_ -and $_ -notlike '127.*' -and $_ -notlike '169.254.*' } |
        Select-Object -First 1
    return $address
}

function Get-ProcessRecord([string]$Name, [int]$Port) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop |
        Select-Object -First 1
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction Stop
    return [ordered]@{
        name = $Name
        port = $Port
        processId = [int]$process.ProcessId
        creationDate = ([datetime]$process.CreationDate).ToString('o')
        commandLine = [string]$process.CommandLine
    }
}

try {
    Write-Step 'Checking prerequisites'
    $python = Get-RequiredCommand 'python'
    $node = Get-RequiredCommand 'node'
    $pwsh = Get-RequiredCommand 'pwsh'
    $vite = Join-Path $webRoot 'node_modules\vite\bin\vite.js'
    if (-not (Test-Path $vite)) {
        throw "Frontend dependencies are missing. Run 'npm install' in $webRoot first."
    }

    $postgresServices = @(Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue)
    if (Test-ListeningPort 5432) {
        Write-Host 'PostgreSQL is already listening on port 5432.' -ForegroundColor Green
    }
    elseif ($postgresServices.Count -gt 0) {
        foreach ($service in $postgresServices | Where-Object Status -ne 'Running') {
            Write-Host "Starting PostgreSQL service $($service.Name)..."
            try {
                Start-Service -Name $service.Name
            }
            catch {
                Write-Host 'Windows administrator approval is required to start PostgreSQL.' -ForegroundColor Yellow
                $escapedServiceName = $service.Name.Replace("'", "''")
                $elevatedCommand = "Start-Service -Name '$escapedServiceName'"
                $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($elevatedCommand))
                $elevated = Start-Process -FilePath $pwsh `
                    -ArgumentList @('-NoLogo', '-NoProfile', '-EncodedCommand', $encodedCommand) `
                    -Verb RunAs `
                    -Wait `
                    -PassThru
                if ($elevated.ExitCode -ne 0) {
                    throw "PostgreSQL was not started. Approve the Windows prompt and run the launcher again."
                }
            }
            $service.Refresh()
            $service.WaitForStatus('Running', (New-TimeSpan -Seconds 15))
        }
        Write-Host 'PostgreSQL is running.' -ForegroundColor Green
    }
    else {
        Write-Warning 'No Windows PostgreSQL service was found; continuing with the configured DATABASE_URL.'
    }

    Write-Step 'Updating the local database'
    Push-Location $backendRoot
    try {
        & $python -m alembic upgrade head
        if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }

        # On an empty database this creates the local Me and Partner identities and
        # prints their one-time tokens. Existing identities are never rotated.
        & $python -m app.scripts.bootstrap_users
        if ($LASTEXITCODE -ne 0) { throw 'Local identity bootstrap failed.' }
    }
    finally {
        Pop-Location
    }

    New-Item -ItemType Directory -Force -Path $runRoot | Out-Null
    $backendOut = Join-Path $runRoot "backend-$timestamp.stdout.log"
    $backendErr = Join-Path $runRoot "backend-$timestamp.stderr.log"
    $webOut = Join-Path $runRoot "web-$timestamp.stdout.log"
    $webErr = Join-Path $runRoot "web-$timestamp.stderr.log"

    Write-Step 'Starting backend'
    $backendUrl = "http://127.0.0.1:$BackendPort"
    if (Test-ListeningPort $BackendPort) {
        if (-not (Test-Http "$backendUrl/docs")) {
            throw "Port $BackendPort is already used by another process."
        }
        Write-Host "Reusing the backend already running on port $BackendPort." -ForegroundColor Yellow
    }
    else {
        $backendProcess = Start-Process -FilePath $python `
            -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', "$BackendPort") `
            -WorkingDirectory $backendRoot `
            -RedirectStandardOutput $backendOut `
            -RedirectStandardError $backendErr `
            -WindowStyle Hidden `
            -PassThru
        Wait-ForHttp 'Backend' "$backendUrl/docs" $backendProcess $backendErr
    }

    Write-Step 'Starting frontend'
    $webHost = if ($LocalOnly) { '127.0.0.1' } else { '0.0.0.0' }
    $localUrl = "http://127.0.0.1:$WebPort/"
    if (Test-ListeningPort $WebPort) {
        if (-not (Test-Http $localUrl)) {
            throw "Port $WebPort is already used by another process."
        }
        Write-Host "Reusing the frontend already running on port $WebPort." -ForegroundColor Yellow
    }
    else {
        $webProcess = Start-Process -FilePath $node `
            -ArgumentList @($vite, '--host', $webHost, '--port', "$WebPort") `
            -WorkingDirectory $webRoot `
            -RedirectStandardOutput $webOut `
            -RedirectStandardError $webErr `
            -WindowStyle Hidden `
            -PassThru
        Wait-ForHttp 'Frontend' $localUrl $webProcess $webErr
    }

    $lanAddress = if ($LocalOnly) { $null } else { Get-LanAddress }
    Write-Host "`nLifeOS is ready" -ForegroundColor Green
    Write-Host "PC:      $localUrl"
    Write-Host "API docs: $backendUrl/docs"
    if ($lanAddress) {
        Write-Host "Phone:   http://${lanAddress}:$WebPort/" -ForegroundColor Green
        Write-Host 'The phone and PC must be on the same Wi-Fi. If it cannot connect, allow Node.js on Windows private networks.'
    }
    elseif (-not $LocalOnly) {
        Write-Warning 'No LAN IPv4 address was detected, so a phone URL could not be printed.'
    }
    Write-Host "Logs:    $runRoot"

    $state = [ordered]@{
        version = 1
        repository = $repoRoot
        recordedAt = (Get-Date).ToString('o')
        processes = @(
            Get-ProcessRecord 'backend' $BackendPort
            Get-ProcessRecord 'frontend' $WebPort
        )
    }
    $state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $runRoot 'state.json') -Encoding utf8

    if (-not $NoBrowser) {
        Start-Process $localUrl
    }
}
catch {
    Write-Host "`nLifeOS failed to start: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
