import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Alert, Stack } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { formatARS, formatPeriodoYYYYMM } from './formatters';

export default function FichaBloqueFinanciero({ data }) {
  if (!data) return null;

  const tieneFormula =
    data.alquilerBrutoMensual != null ||
    data.honorarios != null ||
    data.gastosCargoPropietario != null ||
    data.netoEstimadoMensual != null;

  const liqs = data.liquidacionesRecientes?.filter(Boolean) || [];
  const pendientes = data.pendientesCobro?.filter((p) => p?.periodo && p?.monto != null) || [];

  if (!tieneFormula && liqs.length === 0 && pendientes.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
        Resumen financiero
      </Typography>

      {tieneFormula && (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 1,
            bgcolor: 'grey.50',
            borderColor: 'divider'
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Estimación mensual (referencia)
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            flexWrap="wrap"
          >
            <Box sx={{ flex: 1, minWidth: 140 }}>
              <Typography variant="caption" color="text.secondary">
                Alquiler bruto
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {formatARS(data.alquilerBrutoMensual)}
              </Typography>
            </Box>
            <Typography variant="h6" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              −
            </Typography>
            {data.honorarios && (data.honorarios.monto != null || data.honorarios.porcentaje != null) && (
              <Box sx={{ flex: 1, minWidth: 140 }}>
                <Typography variant="caption" color="text.secondary">
                  Honorarios administración
                  {data.honorarios.porcentaje != null ? ` (${data.honorarios.porcentaje} %)` : ''}
                </Typography>
                <Typography variant="h6" fontWeight={600}>
                  {formatARS(data.honorarios.monto)}
                </Typography>
              </Box>
            )}
            <Typography variant="h6" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              −
            </Typography>
            {data.gastosCargoPropietario != null && (
              <Box sx={{ flex: 1, minWidth: 140 }}>
                <Typography variant="caption" color="text.secondary">
                  Gastos a cargo del propietario
                </Typography>
                <Typography variant="h6" fontWeight={600}>
                  {formatARS(data.gastosCargoPropietario)}
                </Typography>
              </Box>
            )}
            <Typography variant="h6" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
              =
            </Typography>
            {data.netoEstimadoMensual != null && (
              <Box
                sx={{
                  flex: 1.2,
                  minWidth: 160,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText'
                }}
              >
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Neto estimado mensual
                </Typography>
                <Typography variant="h5" fontWeight={800}>
                  {formatARS(data.netoEstimadoMensual)}
                </Typography>
              </Box>
            )}
          </Stack>
        </Paper>
      )}

      {liqs.length > 0 && (
        <>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Últimas liquidaciones
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Período</TableCell>
                  <TableCell align="right">Total boleta inquilino</TableCell>
                  <TableCell align="right">Neto al propietario</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {liqs.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{formatPeriodoYYYYMM(row.periodo)}</TableCell>
                    <TableCell align="right">{formatARS(row.totalBoletaInquilino)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {formatARS(row.netoPropietario)}
                    </TableCell>
                    <TableCell>{row.estado}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {pendientes.length > 0 ? (
        <Stack spacing={1}>
          {pendientes.map((p, i) => (
            <Alert key={i} severity="warning" variant="outlined">
              Período {formatPeriodoYYYYMM(p.periodo)}: pendiente de cobro {formatARS(p.monto)}
            </Alert>
          ))}
        </Stack>
      ) : (
        liqs.length > 0 && (
          <Alert
            severity="success"
            variant="outlined"
            icon={<CheckCircleOutlineIcon fontSize="inherit" />}
          >
            Sin saldos pendientes respecto de los períodos informados.
          </Alert>
        )
      )}
    </Box>
  );
}
