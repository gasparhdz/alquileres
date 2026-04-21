/**
 * Domicilio Argentina: provincia/localidad del catálogo (pais_codigo null).
 * Exterior: código ISO país + texto libre (sin parametrizar localidades del mundo).
 */

export function resolveDomicilioClienteFields(data) {
  const extranjero =
    data.domicilioExtranjero === true ||
    data.domicilioExtranjero === 'true' ||
    data.domicilioExtranjero === 1;

  if (!extranjero) {
    return {
      fields: {
        paisCodigo: null,
        provinciaExtranjera: null,
        localidadExtranjera: null,
        provinciaId: data.provinciaId ? parseInt(String(data.provinciaId), 10) : null,
        localidadId: data.localidadId ? parseInt(String(data.localidadId), 10) : null,
      },
    };
  }

  const pc = data.paisCodigo != null ? String(data.paisCodigo).trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(pc)) {
    return { error: 'Seleccione un país válido (código ISO).' };
  }
  const loc = data.localidadExtranjera != null ? String(data.localidadExtranjera).trim() : '';
  if (!loc) {
    return { error: 'Indique ciudad o localidad.' };
  }

  return {
    fields: {
      paisCodigo: pc,
      provinciaExtranjera: data.provinciaExtranjera != null ? String(data.provinciaExtranjera).trim() || null : null,
      localidadExtranjera: loc,
      provinciaId: null,
      localidadId: null,
    },
  };
}
