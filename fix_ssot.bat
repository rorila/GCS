@echo off
echo [SSOT] Starte SSoT-Bereinigung...
node scripts/fix_project_ssot.cjs
if %errorlevel% neq 0 (
    echo [ERROR] SSoT-Bereinigung fehlgeschlagen!
    exit /b %errorlevel%
)
echo [SUCCESS] SSoT-Bereinigung abgeschlossen.
