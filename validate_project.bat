@echo off
echo [VALIDATION] Starte Projekt-Validierung...
node scripts/validate_project.cjs
if %errorlevel% neq 0 (
    echo [ERROR] Projekt-Validierung fehlgeschlagen!
    exit /b %errorlevel%
)
echo [SUCCESS] Projekt-Validierung abgeschlossen.
