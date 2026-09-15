@echo off
setlocal
where pwsh.exe >nul 2>nul
if errorlevel 1 (
  echo PowerShell 7 ^(pwsh.exe^) was not found.
  pause
  exit /b 1
)

pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-lifeos.ps1" %*
set "LIFEOS_EXIT=%ERRORLEVEL%"
echo.
if not "%LIFEOS_EXIT%"=="0" echo Stop failed with exit code %LIFEOS_EXIT%.
pause
exit /b %LIFEOS_EXIT%
