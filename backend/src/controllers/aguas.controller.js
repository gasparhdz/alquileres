const AGUAS_DESHABILITADO_MSG = 'El autocompletado de Aguas Santafesinas esta temporalmente deshabilitado.';

/**
 * Autocompletar importes y vencimientos desde Aguas Santafesinas.
 * POST /api/liquidaciones/impuestos/aguas/autocompletar
 */
export const autocompletarAguas = async (_req, res) => {
  return res.status(503).json({
    error: AGUAS_DESHABILITADO_MSG,
    actualizados: 0,
    sinFacturaEnPeriodo: [],
    sinMatchPunto: [],
    warnings: [],
    errores: [AGUAS_DESHABILITADO_MSG],
  });
};

// Alias temporal para no romper integraciones viejas mientras migramos a /aguas.
export const autocompletarAssa = autocompletarAguas;
