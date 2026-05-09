@echo off
set "PYTHON_PATH=C:\Users\loken\AppData\Local\Programs\Python\Python311\python.exe"
echo ========================================
echo   Starting Jara AI Backend (Python 3.11)
echo ========================================
if not exist "%PYTHON_PATH%" (
    echo [ERROR] Python 3.11 not found at %PYTHON_PATH%
    echo Please install Python 3.11 or check the path.
    pause
    exit /b
)
"%PYTHON_PATH%" jara.py
pause
