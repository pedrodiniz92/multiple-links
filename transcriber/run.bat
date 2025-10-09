@echo off
setlocal ENABLEEXTENSIONS
chcp 65001 >nul

REM --- Always run from this script’s folder
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
  echo.
  pause
  exit /b 1
)

REM --- Activate venv
call "%ACT%" >nul 2>&1

REM --- Optional: better CUDA memory behavior
set "PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True,max_split_size_mb:256"

REM --- Run and capture stderr to error.txt
set "ERRLOG=%~dp0error.txt"
del "%ERRLOG%" >nul 2>&1

echo Running with: %PY%
"%PY%" "%~dp0transcribe.py" 2> "%ERRLOG%"
set "ERR=%ERRORLEVEL%"

echo.
if not "%ERR%"=="0" (
  echo [ERROR] Script failed with exit code %ERR%
  echo See error.txt for details.
) else (
  echo [DONE] Finished successfully.
)

echo Press any key to close...
pause >nul
endlocal
exit /b %ERR%
