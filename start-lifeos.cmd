@echo off
setlocal
where pwsh.exe >nul 2>nul
if errorlevel 1 (
  echo PowerShell 7 ^(pwsh.exe^) was not found.
  echo Install PowerShell 7 or run start-lifeos.ps1 from an existing pwsh session.
  pause
  exit /b 1
)

pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-lifeos.ps1" %*
set "LIFEOS_EXIT=%ERRORLEVEL%"
echo.
if not "%LIFEOS_EXIT%"=="0" echo Startup failed with exit code %LIFEOS_EXIT%.
echo You can close this window; the LifeOS services will keep running.
pause
exit /b %LIFEOS_EXIT%
