import { useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  IconButton,
  useTheme,
  useMediaQuery,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import dayjs from 'dayjs';
import api from '../api';

const formatCurrency = (value) => {
  if (value == null) return '$ 0,00';
  return `$ ${parseFloat(value).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Modal con el historial de movimientos de la cuenta corriente del cliente.
 * - Propietario: GET /clientes/:id/cuenta-propietario/movimientos
 * - Inquilino: GET /contratos/:id/cuenta-inquilino/movimientos por cada contrato, luego se unifican y ordenan por fecha.
 */
export default function MovimientosClienteDialog({
  open,
  onClose,
  clienteId,
  tipoRol,
  nombreCliente,
  contratoIds = [],
}) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isPropietario = tipoRol === 'propietario';
  const closeButtonRef = useRef(null);

  // Al abrir, mover foco al diálogo interno de inmediato para evitar "Blocked aria-hidden" (foco no debe quedar en ancestro)
  useEffect(() => {
    if (!open) return;
    const el = closeButtonRef.current;
    if (el) {
      const id = setTimeout(() => el.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [open]);

  const handleIrACuentaCorriente = () => {
    onClose();
    const tab = isPropietario ? 'propietarios' : 'inquilinos';
    // PagosCobranzas filtra por "apellido nombre" (sin coma); normalizar para que coincida
    const textoBusqueda = nombreCliente
      ? nombreCliente.replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
      : '';
    const busqueda = textoBusqueda ? encodeURIComponent(textoBusqueda) : '';
    const url = busqueda
      ? `/pagos-cobranzas?tab=${tab}&busqueda=${busqueda}`
      : `/pagos-cobranzas?tab=${tab}`;
    navigate(url);
  };

  const { data: movimientosPropietario, isLoading: loadingProp } = useQuery({
    queryKey: ['movimientos-propietario-cliente', clienteId],
    queryFn: () =>
      api.get(`/clientes/${clienteId}/cuenta-propietario/movimientos`).then((r) => r.data),
    enabled: open && !!clienteId && isPropietario,
  });

  const contratoIdsKey = Array.isArray(contratoIds) && contratoIds.length > 0
    ? [...contratoIds].sort((a, b) => a - b).join(',')
    : '';
  const { data: movimientosInquilinoPorContrato, isLoading: loadingInq } = useQuery({
    queryKey: ['movimientos-inquilino-contratos', contratoIdsKey],
    queryFn: async () => {
      if (!contratoIds?.length) return [];
      const results = await Promise.all(
        contratoIds.map((id) =>
          api.get(`/contratos/${id}/cuenta-inquilino/movimientos`).then((r) => r.data || [])
        )
      );
      return results.flat();
    },
    enabled: open && !!clienteId && !isPropietario && !!contratoIdsKey,
  });

  const movimientos = isPropietario ? movimientosPropietario || [] : movimientosInquilinoPorContrato || [];
  const isLoading = isPropietario ? loadingProp : loadingInq;

  const movimientosConSaldo = useMemo(() => {
    if (!movimientos.length) return [];
    const sorted = [...movimientos].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    let saldoAcum = 0;
    return sorted.map((mov) => {
      const importe = parseFloat(mov.importe);
      const esDebito = mov.tipoMovimiento?.codigo === 'DEBITO';
      if (isPropietario) {
        saldoAcum += esDebito ? -importe : importe;
      } else {
        saldoAcum += esDebito ? importe : -importe;
      }
      const montoDebe = esDebito ? Math.abs(importe) : null;
      const montoHaber = !esDebito ? Math.abs(importe) : null;
      return {
        ...mov,
        saldoAcumulado: saldoAcum,
        montoDebe,
        montoHaber,
      };
    });
  }, [movimientos, isPropietario]);

  const titulo = nombreCliente
    ? `Historial de movimientos - ${nombreCliente}`
    : 'Historial de movimientos';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { maxHeight: '90vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        <Typography variant="h6" component="span" noWrap sx={{ flex: 1, mr: 1 }}>
          {titulo}
        </Typography>
        <IconButton ref={closeButtonRef} aria-label="cerrar" onClick={onClose} size="small" autoFocus>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : movimientosConSaldo.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            Sin movimientos registrados
          </Typography>
        ) : isMobile ? (
          <Box sx={{ maxHeight: '60vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {movimientosConSaldo.map((mov, index) => {
              const saldoColor =
                mov.saldoAcumulado > 0
                  ? isPropietario ? 'success.main' : 'error.main'
                  : mov.saldoAcumulado < 0
                    ? isPropietario ? 'error.main' : 'success.main'
                    : 'text.primary';
              return (
                <Box key={mov.id}>
                  <Box sx={{ py: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={500}>{mov.concepto || '-'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {dayjs(mov.fecha).format('DD/MM/YYYY')}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">Debe</Typography>
                        <Typography variant="body2" fontWeight={600} color={mov.montoDebe ? 'error.main' : 'text.disabled'}>
                          {mov.montoDebe ? formatCurrency(mov.montoDebe) : '-'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">Haber</Typography>
                        <Typography variant="body2" fontWeight={600} color={mov.montoHaber ? 'success.main' : 'text.disabled'}>
                          {mov.montoHaber ? formatCurrency(mov.montoHaber) : '-'}
                        </Typography>
                      </Box>
                      <Box sx={{ ml: 'auto' }}>
                        <Typography variant="caption" color="text.secondary" display="block">Saldo</Typography>
                        <Typography variant="body2" fontWeight={600} color={saldoColor}>
                          {formatCurrency(mov.saldoAcumulado)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  {index < movimientosConSaldo.length - 1 && <Divider />}
                </Box>
              );
            })}
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '60vh' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Fecha</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Concepto</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Debe</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Haber</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Saldo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {movimientosConSaldo.map((mov) => {
                  const saldoColor =
                    mov.saldoAcumulado > 0
                      ? isPropietario ? 'success.main' : 'error.main'
                      : mov.saldoAcumulado < 0
                        ? isPropietario ? 'error.main' : 'success.main'
                        : 'text.primary';
                  return (
                    <TableRow key={mov.id}>
                      <TableCell>{dayjs(mov.fecha).format('DD/MM/YYYY')}</TableCell>
                      <TableCell sx={{ maxWidth: 280 }}>{mov.concepto || '-'}</TableCell>
                      <TableCell align="right" sx={{ color: mov.montoDebe ? 'error.main' : 'text.disabled' }}>
                        {mov.montoDebe ? formatCurrency(mov.montoDebe) : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: mov.montoHaber ? 'success.main' : 'text.disabled' }}>
                        {mov.montoHaber ? formatCurrency(mov.montoHaber) : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: saldoColor }}>
                        {formatCurrency(mov.saldoAcumulado)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={handleIrACuentaCorriente}
          variant="contained"
          color="primary"
          startIcon={<OpenInNewIcon />}
        >
          Ir a cuenta corriente
        </Button>
      </DialogActions>
    </Dialog>
  );
}
