@echo off
setlocal ENABLEEXTENSIONS
chcp 65001 >nul

REM --- Always run from this script's folder
cd /d "%~dp0"

REM --- Venv paths
set "VENV_DIR=%~dp0wxa"
set "PY=%VENV_DIR%\Scripts\python.exe"
set "ACT=%VENV_DIR%\Scripts\activate.bat"

REM --- Ensure the venv exists
if not exist "%PY%" (
  echo [ERROR] Python venv not found at "%VENV_DIR%".
  echo Create it and install deps in THIS folder:
  echo    python -m venv wxa
  echo    wxa\Scripts\python -m pip install --upgrade pip setuptools wheel
  echo    wxa\Scripts\python -m pip install --index-url https://download.pytorch.org/whl/cu129 torch torchvision torchaudio
  echo    wxa\Scripts\python -m pip install whisperx yt-dlp tqdm python-dotenv soundfile
  echo    wxa\Scripts\python -m pip install gradio ollama
  echo.
  pause
  exit /b 1
)

REM --- Activate venv
call "%ACT%" >nul 2>&1

REM --- Optional: better CUDA memory behavior
set "PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True,max_split_size_mb:256"

REM --- Check if Gradio is installed
"%PY%" -c "import gradio" >nul 2>&1
if errorlevel 1 (
  echo [INFO] Gradio not installed. Installing now...
  "%PY%" -m pip install gradio
  if errorlevel 1 (
    echo [ERROR] Failed to install Gradio
    pause
    exit /b 1
  )
)

REM --- Run GUI
echo Starting WhisperX Transcriber GUI...
echo.
"%PY%" "%~dp0gui.py"

REM --- Keep window open if there's an error
if errorlevel 1 (
  echo.
  echo [ERROR] GUI exited with error code %ERRORLEVEL%
  pause
)

endlocal
