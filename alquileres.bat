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

start "Alquileres - Backend" cmd /k "cd /d "%BACKEND%" && npm run dev"
start "Alquileres - Frontend" cmd /k "cd /d "%FRONTEND%" && npm run dev"

exit /b 0
