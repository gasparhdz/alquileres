import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  TableRow,
  TableCell,
  Checkbox,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  Grid,
  Paper,
  Typography,
  Stack,
  alpha
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PersonIcon from '@mui/icons-material/Person';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PaidIcon from '@mui/icons-material/Paid';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import api from '../api';
import RequirePermission from './RequirePermission';

const formatPeriodo = (periodo) => {
  if (!periodo) return '-';
  if (/^\d{2}-\d{4}$/.test(periodo)) return periodo;
  if (/^\d{4}-\d{2}$/.test(periodo)) return periodo.replace(/^(\d{4})-(\d{2})$/, '$2-$1');
  return periodo;
};

/**
 * Fila expandible de la tabla de liquidaciones (propietario + inquilino).
 * Recibe todos los handlers y datos necesarios por props.
 */
export function LiquidacionRow({
  liquidacion,
  calcularTotales,
  getEstadoChipColor,
  estadoBorradorId,
  estadoListaId,
  estadoEmitidaId,
  estadoPagadaId,
  selectedIds,
  handleSelectOne,
  handleView,
  handleEdit,
  handleEmitirBoleta,
  handleDownloadPDF,
  handlePagoLiquidacion,
  handleMarcarComoPagada,
  setLiquidacionAEliminar,
  generarBoletaInquilinoPDF,
  generarLiquidacionPropietarioPDFHandler,
  handleWhatsAppClick
}) {
  const [open, setOpen] = useState(false);

  const propiedad = liquidacion.propiedad || liquidacion.contrato?.propiedad;
  const inquilino = liquidacion.contrato?.inquilino;
  const propietarioData = propiedad?.propietarios?.[0]?.propietario;

  const direccionPropiedad = propiedad
    ? `${propiedad.dirCalle || ''} ${propiedad.dirNro || ''}${propiedad.dirPiso ? ` ${propiedad.dirPiso}°` : ''}${propiedad.dirDepto ? ` "${propiedad.dirDepto}"` : ''}`.trim()
    : '-';
  const nombreInquilino = inquilino
    ? (inquilino.razonSocial || `${inquilino.apellido || ''}, ${inquilino.nombre || ''}`.trim())
    : null;
  const nombrePropietario = propietarioData
    ? (propietarioData.razonSocial || `${propietarioData.apellido || ''}, ${propietarioData.nombre || ''}`.trim())
    : 'Sin propietario';

  const { totalInquilino, totalPropietario } = calcularTotales(liquidacion);

  const estadoId = liquidacion.estado?.id;
  const esSeleccionable = estadoId === estadoListaId || estadoId === estadoBorradorId;
  const estaSeleccionada = selectedIds.includes(liquidacion.id);
  const esEmitida = estadoId === estadoEmitidaId;
  const esPagada = estadoId === estadoPagadaId;

  const tieneInquilino = !!inquilino && !!liquidacion.contratoId;

  const { data: saldoInquilino } = useQuery({
    queryKey: ['cuenta-inquilino-saldo', liquidacion.contratoId],
    queryFn: () => api.get(`/contratos/${liquidacion.contratoId}/cuenta-inquilino/saldo`).then((r) => r.data?.saldo ?? 0),
    enabled: open && !!liquidacion.contratoId
  });
  const tooltipRegistrarMovimiento = saldoInquilino !== undefined ? ((saldoInquilino > 0) ? 'Registrar Cobro' : 'Registrar Pago') : 'Registrar movimiento';
  // Propietario: saldo negativo = le debemos → "Registrar Cobro"; positivo = nos debe → "Registrar Pago"
  const tooltipRegistrarPropietario = totalPropietario < 0 ? 'Registrar Cobro' : 'Registrar Pago';

  return (
    <>
      <TableRow
        selected={estaSeleccionada}
        onClick={() => setOpen(!open)}
        sx={{
          cursor: 'pointer',
          '& > *': { borderBottom: 'unset' },
          '&:hover': { bgcolor: 'action.hover' },
          '&.Mui-selected': {
            bgcolor: (theme) => `${alpha(theme.palette.primary.main, 0.12)} !important`
          },
          '&.Mui-selected:hover': {
            bgcolor: (theme) => `${alpha(theme.palette.primary.main, 0.16)} !important`
          }
        }}
      >
        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={estaSeleccionada}
            onChange={() => handleSelectOne(liquidacion.id)}
            disabled={!esSeleccionable}
          />
        </TableCell>
        <TableCell>{formatPeriodo(liquidacion.periodo)}</TableCell>
        <TableCell>{liquidacion.numeracion || '-'}</TableCell>
        <TableCell>{direccionPropiedad}</TableCell>
        <TableCell>
          <Chip
            label={liquidacion.estado?.nombre || liquidacion.estado?.codigo || '-'}
            color={getEstadoChipColor(estadoId)}
            size="small"
            variant="filled"
          />
        </TableCell>
        <TableCell
          align="right"
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            bgcolor: estaSeleccionada ? 'transparent' : 'rgba(25, 118, 210, 0.06)'
          }}
        >
          {tieneInquilino
            ? `$${totalInquilino.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : ''}
        </TableCell>
        <TableCell
          align="right"
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            bgcolor: estaSeleccionada ? 'transparent' : 'rgba(46, 125, 50, 0.06)'
          }}
        >
          {`$${totalPropietario.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', justifyContent: 'center' }}>
            <Tooltip title="Ver detalle">
              <IconButton size="small" onClick={() => handleView(liquidacion.id)} sx={{ padding: '4px' }}>
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {(estadoId === estadoBorradorId || estadoId === estadoListaId) && (
              <RequirePermission codigo="liquidaciones.editar">
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={() => handleEdit(liquidacion.id)} sx={{ padding: '4px' }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </RequirePermission>
            )}
            {estadoId === estadoListaId && (
              <RequirePermission codigo="liquidaciones.editar">
                <Tooltip title="Emitir boleta">
                  <IconButton size="small" color="primary" onClick={() => handleEmitirBoleta(liquidacion)} sx={{ padding: '4px' }}>
                    <CheckCircleIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </RequirePermission>
            )}
            {estadoId === estadoBorradorId && (
              <RequirePermission codigo="liquidaciones.eliminar">
                <Tooltip title="Eliminar">
                  <IconButton size="small" color="error" onClick={() => setLiquidacionAEliminar(liquidacion)} sx={{ padding: '4px' }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </RequirePermission>
            )}
          </Box>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box
              sx={{
                py: 2,
                px: 3,
                bgcolor: 'background.default',
                borderBottom: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Grid container spacing={3}>
                {tieneInquilino && (
                  <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                            <PersonIcon color="primary" fontSize="small" />
                            <Typography variant="subtitle2" fontWeight={600}>
                              Inquilino
                            </Typography>
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>
                            {nombreInquilino}
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            Total a Cobrar: ${totalInquilino.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                        {(esEmitida || esPagada) && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                            <Tooltip title="Descargar boleta PDF">
                              <IconButton size="large" color="primary" onClick={() => generarBoletaInquilinoPDF(liquidacion.id)}>
                                <PictureAsPdfIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Enviar por WhatsApp">
                              <IconButton
                                size="large"
                                onClick={() => handleWhatsAppClick(liquidacion, 'inquilino')}
                                sx={{ color: '#25D366', '&:hover': { bgcolor: 'rgba(37, 211, 102, 0.12)' } }}
                              >
                                <WhatsAppIcon />
                              </IconButton>
                            </Tooltip>
                            {esEmitida && handleMarcarComoPagada && (
                              <RequirePermission codigo="movimiento.inquilinos.crear">
                                <Tooltip title={tooltipRegistrarMovimiento}>
                                  <IconButton size="large" color="success" onClick={() => handleMarcarComoPagada(liquidacion)}>
                                    <PaidIcon />
                                  </IconButton>
                                </Tooltip>
                              </RequirePermission>
                            )}
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  </Grid>
                )}
                <Grid item xs={12} md={tieneInquilino ? 6 : 12}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                      <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                          <AccountBalanceWalletIcon color="warning" fontSize="small" />
                          <Typography variant="subtitle2" fontWeight={600}>
                            Propietario
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>
                          {nombrePropietario}
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          Total a Pagar: ${totalPropietario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </Typography>
                      </Box>
                      {(esEmitida || esPagada) && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                          <Tooltip title="Descargar liquidación PDF">
                            <IconButton size="large" color="primary" onClick={() => generarLiquidacionPropietarioPDFHandler(liquidacion.id)}>
                              <PictureAsPdfIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Enviar por WhatsApp">
                            <IconButton
                              size="large"
                              onClick={() => handleWhatsAppClick(liquidacion, 'propietario')}
                              sx={{ color: '#25D366', '&:hover': { bgcolor: 'rgba(37, 211, 102, 0.12)' } }}
                            >
                              <WhatsAppIcon />
                            </IconButton>
                          </Tooltip>
                          <RequirePermission codigo="movimiento.propietarios.crear">
                            <Tooltip title={tooltipRegistrarPropietario}>
                              <IconButton size="large" color="warning" onClick={() => handlePagoLiquidacion(liquidacion.id, 'propietario')}>
                                <PaidIcon />
                              </IconButton>
                            </Tooltip>
                          </RequirePermission>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}
