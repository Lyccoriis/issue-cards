@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
call npm run build
echo.
echo Done. The installer and the portable exe are in the release folder.
pause
