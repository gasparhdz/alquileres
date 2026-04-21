import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  IconButton,
  Tooltip
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import EditIcon from '@mui/icons-material/Edit';
import PaidIcon from '@mui/icons-material/Paid';
import RequirePermission from '../RequirePermission';

/**
 * Considera que un ítem está completo si tiene estado COMPLETADO o tiene importe cargado.
 */
function todosItemsCompletos(liquidacion) {
  const items = liquidacion?.items;
  if (!items || items.length === 0) return false;
  return items.every(
    (item) =>
      item.estadoItem?.codigo === 'COMPLETADO' ||
      (item.importe != null && item.importe !== '' && Number(item.importe) >= 0)
  );
}

/**
 * Modal presentacional: vista detallada de una liquidación.
 * Recibe el contenido por children (loading / LiquidacionDetalle / error) y
 * renderiza la barra de acciones (Emitir Boleta, PDF, Registrar cobro/pago, Editar, Cerrar).
 */
export function LiquidacionViewDialog({
  open,
  onClose,
  liquidacion,
  onEmitirBoleta,
  onMarcarComoLista,
  onDownloadPDF,
  onRegistrarCobro,
  onRegistrarPagoPropietario,
  onOpenEdit,
  children
}) {
  const esBorrador = liquidacion?.estado?.codigo === 'BORRADOR';
  const mostrarListaParaEmitir = esBorrador && todosItemsCompletos(liquidacion) && onMarcarComoLista;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Detalle de Liquidación</DialogTitle>
      <DialogContent>
        {children}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {mostrarListaParaEmitir && (
            <RequirePermission codigo="liquidaciones.editar">
              <Button
                variant="contained"
                color="info"
                size="small"
                onClick={() => onMarcarComoLista?.(liquidacion)}
              >
                Lista para Emitir
              </Button>
            </RequirePermission>
          )}
          {liquidacion?.estado?.codigo === 'LISTA' && (
            <RequirePermission codigo="liquidaciones.editar">
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={() => onEmitirBoleta?.(liquidacion)}
              >
                Emitir Boleta
              </Button>
            </RequirePermission>
          )}
          {liquidacion?.estado?.codigo === 'EMITIDA' && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Tooltip title="Descargar PDF">
                <IconButton size="small" color="primary" onClick={onDownloadPDF}>
                  <PictureAsPdfIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <RequirePermission codigo="movimiento.inquilinos.crear">
                <Tooltip title={liquidacion?.contratoId ? 'Registrar cobro (marcar como pagada)' : 'Registrar pago a propietario'}>
                  <IconButton
                    size="small"
                    color="success"
                    onClick={() => {
                      if (liquidacion?.contratoId && onRegistrarCobro) {
                        onRegistrarCobro(liquidacion);
                      } else if (onRegistrarPagoPropietario && liquidacion?.id) {
                        onRegistrarPagoPropietario(liquidacion.id);
                      }
                    }}
                  >
                    <PaidIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </RequirePermission>
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {liquidacion?.estado?.codigo !== 'EMITIDA' && (
            <RequirePermission codigo="liquidaciones.editar">
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditIcon />}
                onClick={onOpenEdit}
              >
                Editar
              </Button>
            </RequirePermission>
          )}
          <Button size="small" onClick={onClose}>Cerrar</Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

