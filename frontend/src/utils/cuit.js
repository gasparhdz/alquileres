/**
 * Valida un CUIT/CUIL argentino usando el algoritmo Módulo 11
 * @param {string} cuit - CUIT/CUIL a validar (puede contener guiones o espacios)
 * @returns {boolean} - true si es válido, false si es inválido
 */
export function isValidCuit(cuit) {
  if (!cuit) return false;

  // Limpiar el string dejando solo números
  const cuitLimpio = cuit.replace(/\D/g, '');

  // Debe tener exactamente 11 dígitos
  if (cuitLimpio.length !== 11) return false;

  // Validar los primeros dos dígitos (tipos válidos de CUIT/CUIL)
  const tiposValidos = ['20', '23', '24', '27', '30', '33', '34'];
  const tipo = cuitLimpio.substring(0, 2);
  if (!tiposValidos.includes(tipo)) return false;

  // Algoritmo Módulo 11
  const multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    suma += parseInt(cuitLimpio[i], 10) * multiplicadores[i];
  }

  const resto = suma % 11;
  let digitoVerificadorCalculado;

  if (resto === 0) {
    digitoVerificadorCalculado = 0;
  } else if (resto === 1) {
    // Caso especial: si el resto es 1, el dígito verificador depende del tipo
    // Para tipo 23 (femenino), el dígito es 4; para otros, es 9
    digitoVerificadorCalculado = tipo === '23' ? 4 : 9;
  } else {
    digitoVerificadorCalculado = 11 - resto;
  }

  const digitoVerificadorReal = parseInt(cuitLimpio[10], 10);

  return digitoVerificadorCalculado === digitoVerificadorReal;
}

/**
 * Formatea un CUIT/CUIL agregando guiones (XX-XXXXXXXX-X)
 * @param {string} cuit - CUIT/CUIL sin formato
 * @returns {string} - CUIT/CUIL formateado
 */
export function formatCuit(cuit) {
  if (!cuit) return '';
  const cuitLimpio = cuit.replace(/\D/g, '');
  if (cuitLimpio.length <= 2) return cuitLimpio;
  if (cuitLimpio.length <= 10) return `${cuitLimpio.substring(0, 2)}-${cuitLimpio.substring(2)}`;
  return `${cuitLimpio.substring(0, 2)}-${cuitLimpio.substring(2, 10)}-${cuitLimpio.substring(10, 11)}`;
}

/**
 * Valida y retorna un objeto con el estado de validación
 * @param {string} cuit - CUIT/CUIL a validar
 * @returns {{ isValid: boolean, error: string | null }}
 */
export function validateCuit(cuit) {
  if (!cuit) return { isValid: true, error: null }; // Campo vacío es válido (la obligatoriedad se maneja aparte)
  
  const cuitLimpio = cuit.replace(/\D/g, '');
  
  if (cuitLimpio.length > 0 && cuitLimpio.length < 11) {
    return { isValid: false, error: 'CUIT/CUIL incompleto' };
  }
  
  if (cuitLimpio.length === 11 && !isValidCuit(cuit)) {
    return { isValid: false, error: 'CUIT/CUIL inválido' };
  }
  
  return { isValid: true, error: null };
}
