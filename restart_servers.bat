@echo off
setlocal enabledelayedexpansion

echo ==============================================
echo   Restarting Game Builder Servers
echo ==============================================
echo.

echo [1/4] Stopping existing servers...

:: Kill process on port 3000 (Game Server)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":3000" ^| findstr /I "LISTENING ABH"') do (
    echo Killing Game Server ^(PID %%a^)...
    taskkill /f /pid %%a >nul 2>&1
)

:: Kill process on port 5173 (Vite Frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":5173" ^| findstr /I "LISTENING ABH"') do (
    echo Killing Frontend ^(PID %%a^)...
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo [2/4] Checking for TypeScript errors...
echo (You can skip this by pressing Ctrl+C if you are in a rush)
call npx tsc --noEmit
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] TypeScript errors found! Fixed them before playing.
    echo Continuing anyway...
) else (
    echo [OK] No errors found.
)

echo.
echo [3/4] Starting Frontend Server...
start "Frontend (Vite)" cmd /c "npm run dev"

echo [4/4] Starting Game Server...
start "Game Server (Node)" cmd /c "cd game-server && npm run dev"

echo.
echo ==============================================
echo   Servers are starting in new windows!
echo   - Frontend: http://localhost:5173
echo   - Backend:  ws://localhost:3000
echo ==============================================
echo.
pause
