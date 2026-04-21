/**
 * Solo dígitos para enlaces wa.me. Si el valor guardado empieza con +, no se antepone 54 (Argentina).
 */
export function formatWhatsAppNumber(telefono) {
  if (!telefono) return null;
  const trimmed = String(telefono).trim();
  const numero = trimmed.replace(/\D/g, '');
  if (!numero) return null;
  if (trimmed.startsWith('+')) {
    return numero;
  }
  if (!numero.startsWith('54')) {
    return `54${numero}`;
  }
  return numero;
}

/**
 * Normaliza lo que el usuario escribe: permite + al inicio (código de país), dígitos y separadores habituales.
 */
export function sanitizeTelefonoInput(raw) {
  if (raw == null || raw === '') return '';
  let s = String(raw).replace(/[^\d+\s\-().]/g, '');
  const hadPlus = s.includes('+');
  s = s.replace(/\+/g, '');
  if (hadPlus) s = `+${s}`;
  return s;
}

/**
 * @returns {string|null} mensaje de error o null si es válido (vacío también válido)
 */
export function validateTelefonoCliente(value) {
  const t = value != null ? String(value).trim() : '';
  if (!t) return null;
  if (t.length > 40) return 'El teléfono es demasiado largo';
  if (!/^\+?[\d\s\-().]+$/.test(t)) return 'Use solo dígitos, + al inicio para código de país, y separadores (espacios, guiones, paréntesis)';
  if (!/\d/.test(t)) return 'Ingrese al menos un dígito';
  return null;
}
