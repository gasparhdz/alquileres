# Trunca la base operativa completa antes de resembrar y reinicia sus secuencias.
# Incluye tablas seedables y tablas operativas dependientes (liquidaciones/movimientos/índices).
# No usa CASCADE: si existen dependencias nuevas fuera del alcance del script, aborta para evitar pérdidas inesperadas.
#
# Uso (desde backend):
#   .\scripts\truncate-tablas-seed.ps1
#   $env:PG_BIN = "C:\Program Files\PostgreSQL\16\bin"; .\scripts\truncate-tablas-seed.ps1

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Split-Path -Parent $scriptDir
$envFile = Join-Path $backendRoot ".env"
$sqlPath = Join-Path $scriptDir "truncate-tablas-seed.sql"

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
Write-Host "Ejecutando truncado seedable con: $sqlPath"

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
