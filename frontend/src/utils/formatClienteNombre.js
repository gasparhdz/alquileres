/**
 * Persona física en listados: "Apellido, Nombre". Si solo hay un campo, sin coma.
 */
export function formatApellidoNombrePF(nombre, apellido) {
  const n = (nombre ?? '').trim();
  const a = (apellido ?? '').trim();
  if (a && n) return `${a}, ${n}`;
  return a || n || '';
}

/** Texto para titular de un impuesto/servicio de propiedad (API: titularModo + datos). */
export function formatTitularPropiedadImpuesto(imp) {
  if (!imp?.titularModo) return '';
  if (imp.titularModo === 'PROPIETARIO' && imp.titularPropietario) {
    const p = imp.titularPropietario;
    const rs = (p.razonSocial ?? '').trim();
    if (rs) return rs;
    return formatApellidoNombrePF(p.nombre, p.apellido) || '—';
  }
  if (imp.titularModo === 'OTRO') {
    return formatApellidoNombrePF(imp.titularOtroNombre, imp.titularOtroApellido) || '—';
  }
  return '';
}
