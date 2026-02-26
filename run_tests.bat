@echo off
echo [TESTS] Starte Regressionstests...
npx tsx scripts/test_runner.ts
if %errorlevel% neq 0 (
    echo [ERROR] Tests fehlgeschlagen!
    exit /b %errorlevel%
)
echo [SUCCESS] Alle Tests bestanden.
