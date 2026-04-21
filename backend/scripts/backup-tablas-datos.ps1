# Backup de tablas de datos (PostgreSQL) con pg_dump
# Solo DATOS (--data-only): el esquema lo define Prisma (migrations). Así podés agregar
# columnas en schema.prisma, migrar la base, y restaurar un backup viejo sin choque de CREATE TABLE.
# La versión mayor de pg_dump debe coincidir con la del servidor (ej. servidor 16 → cliente 16).
#
# Uso:
#   cd backend
#   $env:DATABASE_URL = "postgresql://usuario:clave@localhost:5432/nombre_bd"
#   .\scripts\backup-tablas-datos.ps1
#
# Si tenés varias versiones instaladas, forzá el binario del servidor:
#   $env:PG_BIN = "C:\Program Files\PostgreSQL\16\bin"
#   .\scripts\backup-tablas-datos.ps1
# O la ruta completa:
#   $env:PG_DUMP = "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Split-Path -Parent $scriptDir
$envFile = Join-Path $backendRoot ".env"

if (-not $env:DATABASE_URL -and (Test-Path $envFile)) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*DATABASE_URL\s*=\s*(.+)$') {
            $val = $Matches[1].Trim().Trim('"').Trim("'")
            $env:DATABASE_URL = $val
        }
    }
}

$dbUrl = $env:DATABASE_URL
if ([string]::IsNullOrWhiteSpace($dbUrl)) {
    Write-Error "Definí DATABASE_URL (variable de entorno o archivo backend/.env con DATABASE_URL=...)"
}

# Prisma agrega ?schema=public u otros query params que libpq/pg_dump no aceptan
function Remove-PrismaOnlyUriParams([string]$url) {
    if ($url -notmatch '\?') { return $url }
    $split = $url -split '\?', 2
    $base = $split[0]
    $query = $split[1]
    $pairs = @($query -split '&' | Where-Object { $_ -and ($_ -notmatch '^schema=') })
    if ($pairs.Count -eq 0) { return $base }
    return $base + '?' + ($pairs -join '&')
}
$dbUrl = Remove-PrismaOnlyUriParams $dbUrl

function Resolve-PgDumpExe {
    if ($env:PG_DUMP -and (Test-Path -LiteralPath $env:PG_DUMP)) {
        return $env:PG_DUMP
    }
    if ($env:PG_BIN) {
        $candidate = Join-Path $env:PG_BIN "pg_dump.exe"
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    $pgRoot = "C:\Program Files\PostgreSQL"
    if (Test-Path -LiteralPath $pgRoot) {
        $dirs = Get-ChildItem -LiteralPath $pgRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^\d+$' } |
            Sort-Object { [int]$_.Name } -Descending
        foreach ($d in $dirs) {
            $exe = Join-Path $d.FullName "bin\pg_dump.exe"
            if (Test-Path -LiteralPath $exe) { return $exe }
        }
    }
    return "pg_dump"
}

$pgDumpExe = Resolve-PgDumpExe
Write-Host "Usando: $pgDumpExe"

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outDir = Join-Path $backendRoot "backups"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$outFile = Join-Path $outDir "backup_tablas_datos_$timestamp.sql"

# Nombres según schema Prisma (@@map)
$tables = @(
    "clientes",
    "cliente_rol",
    "contratos",
    "contrato_ajuste",
    "contrato_garantias",
    "contrato_gastos_iniciales",
    "contrato_responsabilidades",
    "propiedades",
    "propiedad_cargo_campos",
    "propiedad_cargos",
    "propiedad_documento",
    "propiedad_impuesto_campos",
    "propiedad_impuestos",
    "propiedad_propietario"
)

# En Windows, pg_dump no acepta bien la URI como primer argumento suelto; usar -d (dbname)
$args = @(
    "-d", $dbUrl,
    "--data-only",
    "--no-owner",
    "--no-acl",
    "-F", "p",
    "-f", $outFile
)
foreach ($t in $tables) {
    $args += "-t"
    $args += "public.$t"
}

Write-Host "Generando: $outFile"
& $pgDumpExe @args

if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump falló (código $LASTEXITCODE). El servidor suele exigir la misma versión mayor que el cliente: instalá PostgreSQL 16+ client tools o definí `$env:PG_BIN a ...\PostgreSQL\16\bin"
}

Write-Host "Listo: $outFile"
