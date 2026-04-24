#!/usr/bin/env bash
# Trunca la base operativa completa antes de resembrar y reinicia secuencias.
# Incluye tablas seedables y tablas operativas dependientes (liquidaciones/movimientos/índices).
# No usa CASCADE: si existen dependencias nuevas fuera del alcance del script, aborta.
#
# Uso (desde backend):
#   ./scripts/truncate-tablas-seed.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${BACKEND_ROOT}/.env"
SQL_FILE="${SCRIPT_DIR}/truncate-tablas-seed.sql"

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
echo "Ejecutando truncado seedable con: $SQL_FILE"

"$PSQL_BIN" -d "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
echo "Listo."
