@echo off
echo ============================================================
echo [MASTER] Game-Builder-V1 Maintenance & Test Suite
echo ============================================================

call validate_project.bat
if %errorlevel% neq 0 goto :failed

call fix_ssot.bat
if %errorlevel% neq 0 goto :failed

call run_tests.bat
if %errorlevel% neq 0 goto :failed

echo ============================================================
echo [SUCCESS] Gesamter Workflow erfolgreich abgeschlossen.
echo ============================================================
exit /b 0

:failed
echo ============================================================
echo [CRITICAL ERROR] Workflow an einer Stelle abgebrochen!
echo ============================================================
exit /b 1
