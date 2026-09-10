@echo off
setlocal
cd /d "%~dp0"

if exist ".ultron.pid" (
    set /p PID=<".ultron.pid"
    if not "%PID%"=="" (
        echo Stopping ULTRON process %PID%...
        taskkill /PID %PID% /T /F >nul 2>&1
    )
    del /q ".ultron.pid" >nul 2>&1
) else (
    echo No ULTRON PID file found.
)

echo ULTRON stopped.
pause
