export function formatARS(valor) {
  if (valor == null || Number.isNaN(Number(valor))) return '—';
  return Number(valor).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

export function formatPorcentaje(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

export function formatFechaISO(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatPeriodoYYYYMM(yyyyMm) {
  if (!yyyyMm || !/^\d{4}-\d{2}$/.test(yyyyMm)) return yyyyMm || '';
  const [y, m] = yyyyMm.split('-');
  return `${m}/${y}`;
}
