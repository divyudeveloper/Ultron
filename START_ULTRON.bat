@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo              ULTRON 2.0
echo ==========================================
echo.

if not exist "node_modules" (
    echo First run detected. Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed.
        pause
        exit /b 1
    )
)

echo Starting ULTRON...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ULTRON_START.ps1"
if errorlevel 1 (
    echo ULTRON startup failed.
    pause
    exit /b 1
)

echo ULTRON is running.
exit /b 0
