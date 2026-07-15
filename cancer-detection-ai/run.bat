@echo off
REM =============================================================================
REM AI Cancer Detection System - One-Command Startup (Windows)
REM =============================================================================
REM Starts the Flask backend (port 5000) and the React frontend (port 3000).
REM
REM Usage:
REM     run.bat
REM
REM To stop both processes, close the two terminal windows that open.
REM =============================================================================

setlocal

REM Resolve the project root (the directory containing this script)
pushd "%~dp0"

echo ============================================================
echo  AI Cancer Detection System - Startup
echo ============================================================
echo.

REM ----- 1. Python dependencies -----
echo [1/4] Checking Python dependencies...
python -c "import flask, flask_cors, tensorflow" 2>nul
if errorlevel 1 (
    echo   Installing Python dependencies...
    pip install -r requirements.txt
) else (
    echo   All Python dependencies are present.
)

REM ----- 2. Generate sample images -----
echo.
echo [2/4] Checking for sample images...
if not exist "data\samples\blood_cancer_positive_1.jpg" (
    echo   Generating 6 sample images...
    python backend\scripts\generate_sample_images.py
) else (
    echo   Sample images present.
)

REM ----- 3. Start Flask backend -----
echo.
echo [3/4] Starting Flask backend on http://localhost:5000 ...
start "CancerDetect-Backend" cmd /k "cd /d %~dp0backend && python api\app.py"
timeout /t 3 /nobreak > nul

REM ----- 4. Start React frontend -----
echo.
echo [4/4] Starting React frontend on http://localhost:3000 ...
if not exist "frontend\node_modules" (
    echo   node_modules/ missing - running npm install...
    pushd frontend
    call npm install
    popd
)
start "CancerDetect-Frontend" cmd /k "cd /d %~dp0frontend && npm start"
popd

echo.
echo ============================================================
echo  System is up!
echo  Backend:  http://localhost:5000
echo  Frontend: http://localhost:3000
echo ============================================================
echo.
echo Two terminal windows are now running. Close them to stop.

endlocal