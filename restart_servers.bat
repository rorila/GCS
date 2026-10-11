@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==============================================
echo   Restarting Game Builder V2 Servers
echo ==============================================
echo.

echo [1/3] Stopping existing servers...

:: Kill process on port 8080 (Game Server)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":8080" ^| findstr /I "LISTENING ABH"') do (
    echo Killing Game Server ^(PID %%a^)...
    taskkill /f /pid %%a >nul 2>&1
)

:: Kill process on port 8081 (CMS Server)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":8081" ^| findstr /I "LISTENING ABH"') do (
    echo Killing CMS Server ^(PID %%a^)...
    taskkill /f /pid %%a >nul 2>&1
)

:: Kill process on port 5173 (Vite Frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":5173" ^| findstr /I "LISTENING ABH"') do (
    echo Killing Frontend ^(PID %%a^)...
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo [2/3] Checking for TypeScript errors...
echo (You can skip this by pressing Ctrl+C if you are in a rush)
call node_modules\.bin\tsc.cmd --noEmit
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] TypeScript errors found! Fixed them before playing.
    echo Continuing anyway...
) else (
    echo [OK] No errors found.
)

echo.
echo [3/3] Starting Game Builder V2 (Frontend, Game Server, CMS and Speech)...
start "Game Builder V2" cmd /k "npm start"

echo.
echo ==============================================
echo   Alle Dienste starten ueber einen gemeinsamen Startweg.
echo   - Frontend: http://localhost:5173
echo   - Backend:  ws://localhost:8080
echo   - CMS:      http://localhost:8081
echo ==============================================
echo.
pause
