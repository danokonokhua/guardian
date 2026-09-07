@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\guardian.ps1" %*
exit /b %ERRORLEVEL%
