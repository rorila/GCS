@echo off
cd /d "%~dp0"
call npm test
exit /b %errorlevel%
