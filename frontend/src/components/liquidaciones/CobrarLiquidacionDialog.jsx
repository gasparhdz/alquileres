import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField
} from '@mui/material';

// Helper: formatear período YYYY-MM → MM-AAAA (solo presentación)
const formatPeriodo = (periodo) => {
  if (!periodo) return '-';
  if (/^\d{2}-\d{4}$/.test(periodo)) return periodo;
  if (/^\d{4}-\d{2}$/.test(periodo)) {
    return periodo.replace(/^(\d{4})-(\d{2})$/, '$2-$1');
  }
  return periodo;
};

// Total a cobrar al inquilino (INQ cargo +, PROP+INQ pago -)
function totalInquilinoFromItems(items) {
  if (!items?.length) return 0;
  return items.reduce((sum, item) => {
    const imp = item.importe != null ? parseFloat(item.importe) : 0;
    if (isNaN(imp) || imp === 0) return sum;
    const soporta = item.quienSoportaCosto?.codigo;
    const pagado = item.pagadoPorActor?.codigo;
    if (soporta === 'INQ') return sum + Math.abs(imp);
    if (soporta === 'PROP' && pagado === 'INQ') return sum - Math.abs(imp);
    return sum;
  }, 0);
}

/**
 * Modal presentacional: marcar liquidación como cobrada (registrar cobro y pasar a estado Cobrada).
 * Props: open, liquidacion, mediosPago, onClose, onConfirm, loading.
 */
export default function CobrarLiquidacionDialog({
  open,
  liquidacion,
  mediosPago = [],
  onClose,
  onConfirm,
  loading
}) {
  const [medioPagoId, setMedioPagoId] = useState('');
  const [nroComprobante, setNroComprobante] = useState('');

  const totalInquilino = liquidacion ? totalInquilinoFromItems(liquidacion.items) : 0;
  const periodoFormateado = liquidacion?.periodo ? formatPeriodo(liquidacion.periodo) : '-';
  const montoFormato = totalInquilino.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleConfirm = () => {
    onConfirm({
      id: liquidacion.id,
      medioPagoId: medioPagoId ? parseInt(medioPagoId, 10) : undefined,
      nroComprobante: nroComprobante.trim() || undefined
    });
  };

  const handleClose = () => {
    setMedioPagoId('');
    setNroComprobante('');
    onClose();
  };

  const nroLiquidacion = liquidacion?.numeracion || (liquidacion?.id ? `#${liquidacion.id}` : '-');

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Registrar Cobro de Liquidación</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          ¿Está seguro que desea marcar la liquidación <strong>{nroLiquidacion}</strong> por un total de <strong>$ {montoFormato}</strong> como pagada?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Se registrará el ingreso correspondiente al período <strong>{periodoFormateado}</strong> en la cuenta corriente del inquilino.
        </Typography>
        <FormControl fullWidth size="small" sx={{ mt: 1, mb: 2 }}>
          <InputLabel>Medio de Pago</InputLabel>
          <Select
            value={medioPagoId}
            label="Medio de Pago"
            onChange={(e) => setMedioPagoId(e.target.value)}
          >
            <MenuItem value="">(Opcional)</MenuItem>
            {mediosPago.map((mp) => (
              <MenuItem key={mp.id} value={String(mp.id)}>{mp.nombre}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          fullWidth
          size="small"
          label="Nº de Comprobante"
          value={nroComprobante}
          onChange={(e) => setNroComprobante(e.target.value)}
          placeholder="Opcional"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancelar</Button>
        <Button variant="contained" color="success" onClick={handleConfirm} disabled={loading}>
          {loading ? 'Registrando...' : 'Confirmar Pago'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
