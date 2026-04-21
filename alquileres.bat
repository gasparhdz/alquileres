@echo off
setlocal

REM ROOT = carpeta donde está este .bat
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

echo Iniciando backend y frontend...
echo ROOT: %ROOT%
echo.

if not exist "%BACKEND%\package.json" (
  echo [ERROR] No existe %BACKEND%\package.json
  pause
  exit /b 1
)

if not exist "%FRONTEND%\package.json" (
  echo [ERROR] No existe %FRONTEND%\package.json
  pause
  exit /b 1
)

REM Abrir Windows Terminal con dos pestañas en la misma ventana
wt -w 0 new-tab --title "Backend" -d "%BACKEND%" cmd /k "npm run dev" ; new-tab --title "Frontend" -d "%FRONTEND%" cmd /k "npm run dev"

exit /b 0
