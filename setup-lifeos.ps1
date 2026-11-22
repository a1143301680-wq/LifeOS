#Requires -Version 7.0
[CmdletBinding()]
param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$backendRoot = Join-Path $PSScriptRoot 'backend'
$webRoot = Join-Path $PSScriptRoot 'web'
$venvRoot = Join-Path $PSScriptRoot '.venv'
$venvPython = Join-Path $venvRoot 'Scripts\python.exe'
$envPath = Join-Path $backendRoot '.env'

function Get-SetupCommand([string]$Name, [string]$InstallHint) {
    $command = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $command) {
        throw "'$Name' was not found on PATH. $InstallHint"
    }
    return $command.Source
}

function Assert-PythonVersion([string]$Executable) {
    $version = & $Executable -c 'import sys; print(".".join(map(str, sys.version_info[:3])))'
    $parsed = $null
    if ($LASTEXITCODE -ne 0 -or -not [version]::TryParse([string]$version, [ref]$parsed) -or $parsed -lt [version]'3.11') {
        throw "Python 3.11 or newer is required. Check '$Executable' and your PATH."
    }
    return $version
}

$python = Get-SetupCommand 'python.exe' 'Install Python 3.11 or newer.'
$node = Get-SetupCommand 'node.exe' 'Install Node.js 24 LTS.'
$npm = Get-SetupCommand 'npm.cmd' 'Install Node.js with npm included.'
$pythonVersion = Assert-PythonVersion $python
$nodeVersion = & $node --version
$parsedNode = $null
if ($LASTEXITCODE -ne 0 -or -not [version]::TryParse(([string]$nodeVersion).TrimStart('v'), [ref]$parsedNode) -or
    -not (($parsedNode.Major -eq 22 -and $parsedNode -ge [version]'22.13') -or $parsedNode.Major -ge 24)) {
    throw "Node.js 22.13+ in the 22.x series or Node.js 24+ is required. Found: $nodeVersion"
}
$npmVersion = & $npm --version
if ($LASTEXITCODE -ne 0) { throw 'npm could not run. Check your Node.js installation.' }

Write-Host "PowerShell $($PSVersionTable.PSVersion); Python $pythonVersion; Node.js $nodeVersion; npm $npmVersion"
if (-not (Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue)) {
    Write-Warning 'No Windows PostgreSQL service was detected. If using PostgreSQL separately, configure its address in backend/.env.'
}
Write-Host 'PostgreSQL connectivity is not checked here. Set up your database before starting LifeOS.'

$hasVenv = Test-Path -LiteralPath $venvPython -PathType Leaf
if ($hasVenv) { $null = Assert-PythonVersion $venvPython }
if ($CheckOnly) {
    Write-Host 'Environment check complete. No files were changed.'
    return
}

if (-not $hasVenv) {
    & $python -m venv $venvRoot
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the project Python virtual environment.' }
}

Write-Host 'Installing backend dependencies...'
& $venvPython -m pip install -e $backendRoot
if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }

Write-Host 'Installing frontend dependencies...'
Push-Location -LiteralPath $webRoot
try {
    & $npm ci --include=dev
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
}
finally {
    Pop-Location
}

if (Test-Path -LiteralPath $envPath -PathType Leaf) {
    Write-Host 'Keeping existing backend/.env.'
}
else {
    [IO.File]::Copy((Join-Path $backendRoot '.env.example'), $envPath)
    Write-Host 'Created backend/.env from the example.'
}

Write-Host 'Setup complete. Configure DATABASE_URL in backend/.env, then follow the README to start LifeOS.'
