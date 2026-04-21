#!/usr/bin/env bash
# Backup de tablas de datos (PostgreSQL) con pg_dump
# Solo DATOS (--data-only): el esquema lo define Prisma. Columnas nuevas se rellenan con NULL/default al restaurar.
# La versión mayor de pg_dump debe coincidir con la del servidor.
# Opcional: export PG_BIN=/usr/lib/postgresql/16/bin
#
# Uso (desde la carpeta backend):
#   export DATABASE_URL="postgresql://usuario:clave@localhost:5432/nombre_bd"
#   ./scripts/backup-tablas-datos.sh
#
# O: source .env && ./scripts/backup-tablas-datos.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(dirname "$SCRIPT_DIR")"
OUT_DIR="${BACKEND_ROOT}/backups"
mkdir -p "$OUT_DIR"

if [[ -z "${DATABASE_URL:-}" ]] && [[ -f "${BACKEND_ROOT}/.env" ]]; then
  # shellcheck disable=SC2046
  export $(grep -E '^DATABASE_URL=' "${BACKEND_ROOT}/.env" | xargs)
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Definí DATABASE_URL o creá backend/.env con DATABASE_URL=..." >&2
  exit 1
fi

# Prisma agrega ?schema=public; libpq/pg_dump no acepta el parámetro «schema»
strip_prisma_uri_params() {
  local url="$1"
  [[ "$url" != *"?"* ]] && { echo "$url"; return; }
  local base="${url%%\?*}"
  local q="${url#*\?}"
  local out="" sep=""
  IFS='&' read -ra PARTS <<< "$q"
  for p in "${PARTS[@]}"; do
    [[ -z "$p" ]] && continue
    [[ "$p" == schema=* ]] && continue
    out="${out}${sep}${p}"
    sep="&"
  done
  if [[ -z "$out" ]]; then echo "$base"; else echo "$base?$out"; fi
}
DATABASE_URL="$(strip_prisma_uri_params "$DATABASE_URL")"

resolve_pg_dump() {
  if [[ -n "${PG_DUMP:-}" && -x "$PG_DUMP" ]]; then echo "$PG_DUMP"; return; fi
  if [[ -n "${PG_BIN:-}" && -x "${PG_BIN}/pg_dump" ]]; then echo "${PG_BIN}/pg_dump"; return; fi
  command -v pg_dump
}

PG_DUMP_BIN="$(resolve_pg_dump)"
echo "Usando: $PG_DUMP_BIN"

TS=$(date +%Y%m%d_%H%M%S)
OUT_FILE="${OUT_DIR}/backup_tablas_datos_${TS}.sql"

TABLES=(
  clientes
  cliente_rol
  contratos
  contrato_ajuste
  contrato_garantias
  contrato_gastos_iniciales
  contrato_responsabilidades
  propiedades
  propiedad_cargo_campos
  propiedad_cargos
  propiedad_documento
  propiedad_impuesto_campos
  propiedad_impuestos
  propiedad_propietario
)

ARGS=(-d "$DATABASE_URL" --data-only --no-owner --no-acl -F p -f "$OUT_FILE")
for t in "${TABLES[@]}"; do
  ARGS+=(-t "public.$t")
done

echo "Generando: $OUT_FILE"
"$PG_DUMP_BIN" "${ARGS[@]}"
echo "Listo: $OUT_FILE"
