@echo off
setlocal

REM ROOT = carpeta donde esta este .bat
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"

echo ============================================
echo   ASISTENTE DE LIMPIEZA Y RESEED
echo ============================================
echo.
echo Este asistente puede:
echo  1. Limpiar la base operativa previa al reseed
echo  2. Insertar admin + parametros
echo  3. Insertar datos reales
echo.

if not exist "%BACKEND%\package.json" (
  echo [ERROR] No existe %BACKEND%\package.json
  pause
  exit /b 1
)

set "DO_TRUNCATE=N"
set "DO_BASE=N"
set "DO_REAL=N"

set /p "DO_TRUNCATE=Queres limpiar la base operativa previa al reseed? (S/N): "
set /p "DO_BASE=Queres insertar admin + parametros? (S/N): "
set /p "DO_REAL=Queres insertar datos reales? (S/N): "

echo.
echo Resumen:
echo  - Limpiar base operativa: %DO_TRUNCATE%
echo  - Insertar admin + parametros: %DO_BASE%
echo  - Insertar datos reales: %DO_REAL%
echo.
set /p "CONFIRM=Escribi SI para ejecutar: "

if /I not "%CONFIRM%"=="SI" (
  echo.
  echo Operacion cancelada.
  pause
  exit /b 0
)

pushd "%BACKEND%"

if /I "%DO_TRUNCATE%"=="S" (
  echo.
  echo [1] Truncando base operativa previa al reseed...
  call npm run db:truncate-seed
  if errorlevel 1 (
    echo.
    echo [ERROR] Fallo el truncado.
    popd
    pause
    exit /b 1
  )
)

if /I "%DO_BASE%"=="S" (
  echo.
  echo [2] Insertando admin + parametros...
  call npm run prisma:seed:base
  if errorlevel 1 (
    echo.
    echo [ERROR] Fallo el seed base.
    popd
    pause
    exit /b 1
  )
)

if /I "%DO_REAL%"=="S" (
  echo.
  echo [3] Insertando datos reales...
  call npm run prisma:seed:datos-reales
  if errorlevel 1 (
    echo.
    echo [ERROR] Fallo el seed de datos reales.
    popd
    pause
    exit /b 1
  )
)

popd

echo.
echo ============================================
echo   Proceso finalizado correctamente
echo ============================================
pause
exit /b 0
