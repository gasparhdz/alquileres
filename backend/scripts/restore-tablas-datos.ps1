# Restaura un .sql generado por backup-tablas-datos.ps1 (solo datos, COPY/INSERT).
# Requiere: misma versión mayor de psql que el servidor (ej. 16) — usá $env:PG_BIN si hace falta.
#
# Antes: aplicá migraciones Prisma (schema al día). Si ya hay datos en esas tablas,
# vaciálas antes (ej. truncate-datos-reset-id.sql) o vas a tener errores de PK duplicada.
#
# Uso (desde la carpeta backend):
#   .\scripts\restore-tablas-datos.ps1                           # último backup en backups\
#   .\scripts\restore-tablas-datos.ps1 ".\backups\backup_tablas_datos_20260406_195417.sql"

param(
    [Parameter(Position = 0)]
    [string] $Path = ""
)

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

function Resolve-PsqlExe {
    if ($env:PSQL -and (Test-Path -LiteralPath $env:PSQL)) {
        return $env:PSQL
    }
    if ($env:PG_BIN) {
        $candidate = Join-Path $env:PG_BIN "psql.exe"
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    $pgRoot = "C:\Program Files\PostgreSQL"
    if (Test-Path -LiteralPath $pgRoot) {
        $dirs = Get-ChildItem -LiteralPath $pgRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^\d+$' } |
            Sort-Object { [int]$_.Name } -Descending
        foreach ($d in $dirs) {
            $exe = Join-Path $d.FullName "bin\psql.exe"
            if (Test-Path -LiteralPath $exe) { return $exe }
        }
    }
    return "psql"
}

$psqlExe = Resolve-PsqlExe
Write-Host "Usando: $psqlExe"

$backupsDir = Join-Path $backendRoot "backups"
$sqlPath = $null

if ($Path) {
    $candidates = @($Path, (Join-Path $backendRoot $Path), (Join-Path $PWD.Path $Path))
    foreach ($c in $candidates) {
        if ($c -and (Test-Path -LiteralPath $c)) {
            $sqlPath = (Resolve-Path -LiteralPath $c).Path
            break
        }
    }
    if (-not $sqlPath) {
        Write-Error "No se encontró el archivo: $Path"
    }
} else {
    # Sin -Path: usar el backup más reciente (nombre backup_tablas_datos_*.sql)
    if (-not (Test-Path -LiteralPath $backupsDir)) {
        Write-Error "No existe la carpeta backups\. Pasá la ruta con -Path o generá un backup primero."
    }
    $latest = Get-ChildItem -LiteralPath $backupsDir -Filter "backup_tablas_datos_*.sql" -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $latest) {
        Write-Error "No hay archivos backup_tablas_datos_*.sql en backups\. Pasá -Path al .sql."
    }
    $sqlPath = $latest.FullName
    Write-Host "Restaurando el más reciente: $sqlPath"
}

Write-Host "Ejecutando contra la base de DATABASE_URL..."
$args = @(
    "-d", $dbUrl,
    "-v", "ON_ERROR_STOP=1",
    "-f", $sqlPath
)
& $psqlExe @args

if ($LASTEXITCODE -ne 0) {
    Write-Error "psql falló (código $LASTEXITCODE)."
}

Write-Host "Listo."
