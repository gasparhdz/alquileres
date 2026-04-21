#!/usr/bin/env bash
# Restaura un .sql generado por backup-tablas-datos.sh (solo datos).
# Antes: prisma migrate deploy. Si hay datos viejos en esas tablas, truncá antes (truncate-datos-reset-id.sql).
#
# Uso (desde la carpeta backend):
#   export DATABASE_URL="postgresql://..."
#   ./scripts/restore-tablas-datos.sh                      # último backup en backups/
#   ./scripts/restore-tablas-datos.sh backups/archivo.sql  # ruta explícita

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${BACKEND_ROOT}/.env"

if [[ -z "${DATABASE_URL:-}" ]] && [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC2046
  export $(grep -E '^DATABASE_URL=' "$ENV_FILE" | xargs)
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Definí DATABASE_URL o creá backend/.env" >&2
  exit 1
fi

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

resolve_psql() {
  if [[ -n "${PSQL:-}" && -x "$PSQL" ]]; then echo "$PSQL"; return; fi
  if [[ -n "${PG_BIN:-}" && -x "${PG_BIN}/psql" ]]; then echo "${PG_BIN}/psql"; return; fi
  command -v psql
}

PSQL_BIN="$(resolve_psql)"
echo "Usando: $PSQL_BIN"

SQL_FILE=""
BACKUPS_DIR="${BACKEND_ROOT}/backups"

if [[ -n "${1:-}" ]]; then
  for c in "$1" "${BACKEND_ROOT}/$1" "$(pwd)/$1"; do
    if [[ -f "$c" ]]; then
      SQL_FILE="$(cd "$(dirname "$c")" && pwd)/$(basename "$c")"
      break
    fi
  done
  if [[ -z "$SQL_FILE" || ! -f "$SQL_FILE" ]]; then
    echo "No se encontró: $1" >&2
    exit 1
  fi
else
  if [[ ! -d "$BACKUPS_DIR" ]]; then
    echo "No existe backups/. Pasá la ruta al .sql" >&2
    exit 1
  fi
  shopt -s nullglob
  _bk=("$BACKUPS_DIR"/backup_tablas_datos_*.sql)
  shopt -u nullglob
  if [[ ${#_bk[@]} -eq 0 ]]; then
    echo "No hay backup_tablas_datos_*.sql en backups/" >&2
    exit 1
  fi
  SQL_FILE="${_bk[0]}"
  for f in "${_bk[@]}"; do
    [[ "$f" -nt "$SQL_FILE" ]] && SQL_FILE="$f"
  done
  echo "Restaurando el más reciente: $SQL_FILE"
fi

echo "Ejecutando contra DATABASE_URL..."
"$PSQL_BIN" -d "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
echo "Listo."
