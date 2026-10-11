@echo off
setlocal
cd /d "%~dp0"
call npm run start:cms
if errorlevel 1 pause
