@echo off
echo ========================================
echo Sistema de Alquileres - Setup Inicial
echo ========================================
echo.

echo [1/6] Instalando dependencias del backend...
cd backend
call npm install
if errorlevel 1 (
    echo ERROR: Fallo la instalacion del backend
    pause
    exit /b 1
)

echo.
echo [2/6] Instalando dependencias del frontend...
cd ..\frontend
call npm install
if errorlevel 1 (
    echo ERROR: Fallo la instalacion del frontend
    pause
    exit /b 1
)

echo.
echo [3/6] Generando cliente Prisma...
cd ..\backend
call npm run prisma:generate
if errorlevel 1 (
    echo ERROR: Fallo la generacion de Prisma
    pause
    exit /b 1
)

echo.
echo [4/6] Verificando archivo .env...
if not exist .env (
    if exist .env.example (
        echo Creando archivo .env desde .env.example...
        copy .env.example .env
        echo Archivo .env creado exitosamente
    ) else (
        echo Creando archivo .env con valores por defecto...
        (
            echo # Database
            echo DATABASE_URL="postgresql://postgres:postgres@localhost:5432/alquileres"
            echo.
            echo # JWT
            echo JWT_SECRET="clave_super_segura_cambiar_en_produccion"
            echo JWT_EXPIRES_IN="7d"
            echo.
            echo # Server
            echo PORT=4000
            echo NODE_ENV=development
            echo.
            echo # CORS
            echo CORS_ORIGIN="http://localhost:5173"
        ) > .env
        echo Archivo .env creado exitosamente
    )
    echo.
    echo IMPORTANTE: Edita backend\.env con tus credenciales de PostgreSQL
    echo Si tu usuario/password de PostgreSQL es diferente, cambia DATABASE_URL
    echo.
    pause
)

echo.
echo [5/6] Ejecutando migraciones de base de datos...
echo ATENCION: Esto requiere que PostgreSQL este corriendo y la base de datos 'alquileres' exista
echo.
call npm run prisma:migrate
if errorlevel 1 (
    echo ERROR: Fallo la migracion
    echo Verifica que PostgreSQL este corriendo y la base de datos exista
    pause
    exit /b 1
)

echo.
echo [6/6] Ejecutando seed (datos iniciales)...
call npm run prisma:seed
if errorlevel 1 (
    echo ERROR: Fallo el seed
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup completado exitosamente!
echo ========================================
echo.
echo Para iniciar el sistema:
echo   1. Abre una terminal y ejecuta: cd backend ^&^& npm run dev
echo   2. Abre otra terminal y ejecuta: cd frontend ^&^& npm run dev
echo.
echo Credenciales por defecto:
echo   Email: admin@alquileres.com
echo   Password: admin123
echo.
pause

