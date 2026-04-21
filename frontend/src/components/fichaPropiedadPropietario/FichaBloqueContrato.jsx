import {
  Box,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import { formatARS, formatFechaISO, formatPorcentaje } from './formatters';

export default function FichaBloqueContrato({ contrato, ajustes }) {
  if (!contrato && !ajustes) return null;

  const tieneContrato =
    contrato &&
    (contrato.inquilinoNombre ||
      contrato.fechaInicio ||
      contrato.montoInicial != null ||
      (contrato.garantias && contrato.garantias.length));

  const tieneAjustes =
    ajustes &&
    (ajustes.indicePactado ||
      ajustes.historial?.length ||
      ajustes.ultimoAjuste ||
      ajustes.proximoAjuste);

  if (!tieneContrato && !tieneAjustes) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
        Situación contractual
      </Typography>

      {tieneContrato && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 1, width: '100%' }}>
          <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700, mb: 2 }}>
            Contrato vigente
          </Typography>

          <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
            {contrato.inquilinoNombre && (
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Inquilino
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {contrato.inquilinoNombre}
                </Typography>
              </Grid>
            )}

            {(contrato.fechaInicio || contrato.fechaFin || contrato.duracionMeses != null) && (
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Plazo
                </Typography>
                <Typography variant="body2">
                  {contrato.fechaInicio && contrato.fechaFin && (
                    <>
                      {formatFechaISO(contrato.fechaInicio)} — {formatFechaISO(contrato.fechaFin)}
                    </>
                  )}
                  {contrato.duracionMeses != null && (
                    <Typography component="span" variant="body2" display="block" color="text.secondary">
                      Duración: {contrato.duracionMeses} meses
                    </Typography>
                  )}
                </Typography>
              </Grid>
            )}

            {(contrato.montoInicial != null || contrato.montoActual != null) && (
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Evolución del alquiler
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatARS(contrato.montoInicial)} → {formatARS(contrato.montoActual)}
                </Typography>
              </Grid>
            )}

            {contrato.deposito &&
              (contrato.deposito.montoOriginal != null ||
                contrato.deposito.montoActualizado != null ||
                contrato.deposito.titularFondos) && (
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Depósito / garantía monetaria
                  </Typography>
                  <Typography variant="body2">
                    {contrato.deposito.montoOriginal != null && contrato.deposito.montoActualizado != null && (
                      <>
                        Original {formatARS(contrato.deposito.montoOriginal)} → Actualizado{' '}
                        {formatARS(contrato.deposito.montoActualizado)}
                      </>
                    )}
                    {contrato.deposito.titularFondos && (
                      <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Fondos a cargo de: {contrato.deposito.titularFondos}
                      </Typography>
                    )}
                  </Typography>
                </Grid>
              )}
          </Grid>

          {contrato.garantias && contrato.garantias.length > 0 && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                Garantías
              </Typography>
              {contrato.garantias.map((g, i) => (
                <Typography key={i} variant="body2" sx={{ mt: 0.5 }}>
                  <strong>{g.tipo}:</strong>
                  {g.detalle ? ` ${g.detalle}` : ''}
                </Typography>
              ))}
            </Box>
          )}
        </Paper>
      )}

      {tieneAjustes && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, width: '100%' }}>
          <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700, mb: 2 }}>
            Ajustes contractuales
          </Typography>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            {ajustes.indicePactado && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2">
                  <strong>Índice pactado:</strong> {ajustes.indicePactado}
                </Typography>
              </Grid>
            )}
            {ajustes.frecuenciaMeses != null && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2">
                  <strong>Frecuencia:</strong> cada {ajustes.frecuenciaMeses} meses
                </Typography>
              </Grid>
            )}
            {ajustes.ultimoAjuste?.fecha && (
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Último ajuste
                </Typography>
                <Typography variant="body2">
                  {formatFechaISO(ajustes.ultimoAjuste.fecha)}
                  {ajustes.ultimoAjuste.porcentajeAplicado != null &&
                    ` · ${formatPorcentaje(ajustes.ultimoAjuste.porcentajeAplicado)}`}
                </Typography>
              </Grid>
            )}
          </Grid>

          {ajustes.proximoAjuste &&
            (ajustes.proximoAjuste.fechaEstimada ||
              ajustes.proximoAjuste.montoEstimado != null ||
              ajustes.proximoAjuste.notaProyeccion) && (
              <Box
                sx={{
                  mb: 2,
                  p: 1.5,
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  borderLeft: '4px solid',
                  borderColor: 'primary.main',
                  '@media print': { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Próximo ajuste estimado
                </Typography>
                {ajustes.proximoAjuste.fechaEstimada && (
                  <Typography variant="body2" fontWeight={600}>
                    Fecha referencia: {formatFechaISO(ajustes.proximoAjuste.fechaEstimada)}
                  </Typography>
                )}
                {ajustes.proximoAjuste.montoEstimado != null && (
                  <Box>
                    <Typography variant="body2">
                      Alquiler aprox.: {formatARS(ajustes.proximoAjuste.montoEstimado)}
                    </Typography>
                    {ajustes.proximoAjuste.notaProyeccion && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        ({ajustes.proximoAjuste.notaProyeccion})
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            )}

          {ajustes.historial && ajustes.historial.length > 0 && (
            <Box sx={{ width: '100%' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Historial de ajustes
              </Typography>
              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{
                  overflow: 'visible',
                  '@media print': { boxShadow: 'none' }
                }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Fecha</TableCell>
                      <TableCell align="right">Monto ant.</TableCell>
                      <TableCell align="right">Monto nuevo</TableCell>
                      <TableCell align="right">%</TableCell>
                      <TableCell>Índice</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ajustes.historial.map((h, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{formatFechaISO(h.fecha)}</TableCell>
                        <TableCell align="right">{formatARS(h.montoAnterior)}</TableCell>
                        <TableCell align="right">{formatARS(h.montoNuevo)}</TableCell>
                        <TableCell align="right">{formatPorcentaje(h.porcentaje)}</TableCell>
                        <TableCell>{h.indice ?? ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}
