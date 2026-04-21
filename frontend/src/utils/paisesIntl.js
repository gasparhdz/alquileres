/** Lista fija mínima si el navegador no expone Intl.supportedValuesOf('region') */
const FALLBACK_PAISES = [
  { codigo: 'AR', nombre: 'Argentina' },
  { codigo: 'BO', nombre: 'Bolivia' },
  { codigo: 'BR', nombre: 'Brasil' },
  { codigo: 'CL', nombre: 'Chile' },
  { codigo: 'CO', nombre: 'Colombia' },
  { codigo: 'ES', nombre: 'España' },
  { codigo: 'US', nombre: 'Estados Unidos' },
  { codigo: 'FR', nombre: 'Francia' },
  { codigo: 'IT', nombre: 'Italia' },
  { codigo: 'MX', nombre: 'México' },
  { codigo: 'PY', nombre: 'Paraguay' },
  { codigo: 'PE', nombre: 'Perú' },
  { codigo: 'PT', nombre: 'Portugal' },
  { codigo: 'UY', nombre: 'Uruguay' },
  { codigo: 'VE', nombre: 'Venezuela' }
];

/**
 * Opciones para Autocomplete: códigos ISO 3166-1 alpha-2 con nombre en español (sin cargar localidades).
 */
export function getOpcionesPais() {
  if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
    try {
      const codes = Intl.supportedValuesOf('region').filter((c) => /^[A-Z]{2}$/.test(c));
      const dn = new Intl.DisplayNames(['es'], { type: 'region' });
      return codes
        .map((codigo) => ({ codigo, nombre: dn.of(codigo) || codigo }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    } catch {
      /* fallthrough */
    }
  }
  return [...FALLBACK_PAISES].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function nombrePaisDesdeCodigo(codigo) {
  if (!codigo || String(codigo).length !== 2) return codigo || '';
  const c = String(codigo).toUpperCase();
  try {
    const dn = new Intl.DisplayNames(['es'], { type: 'region' });
    return dn.of(c) || c;
  } catch {
    const op = getOpcionesPais().find((x) => x.codigo === c);
    return op?.nombre || c;
  }
}
