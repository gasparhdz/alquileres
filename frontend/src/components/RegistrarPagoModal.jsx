import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Typography
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import Receipt from '@mui/icons-material/Receipt';
import Payment from '@mui/icons-material/Payment';
import AccountBalance from '@mui/icons-material/AccountBalance';
import AttachMoney from '@mui/icons-material/AttachMoney';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutline from '@mui/icons-material/RemoveCircleOutline';
import dayjs from 'dayjs';
import api from '../api';

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
};

// ============================================
// MODAL REGISTRAR MOVIMIENTO INQUILINO (Bidireccional)
// ============================================
export function RegistrarCobroModal({ 
  open, 
  onClose, 
  contrato, 
  onSuccess, 
  tipoOperacion = 'cobro',
  importePreset,
  conceptoPreset
}) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    fecha: dayjs(),
    tipoMovimiento: 'CREDITO',
    concepto: '',
    importe: '',
    medioPagoId: '',
    observaciones: ''
  });

  useEffect(() => {
    if (open) {
      const saldo = contrato?.saldoDeudor ?? 0;
      const importeInicial = importePreset !== undefined ? importePreset : Math.abs(saldo);
      const esReintegro = tipoOperacion === 'reintegro';
      // Si debemos dinero al inquilino (saldo <= 0) → "Registrar Pago" / Cargo (DEBITO)
      // Si el inquilino nos debe (saldo > 0) → "Registrar Cobro" / Pago Recibido (CREDITO)
      const tipoInicial = esReintegro ? 'DEBITO' : (saldo > 0 ? 'CREDITO' : 'DEBITO');

      // Formato período: MM-AAAA
      const periodoActual = `${dayjs().format('MM')}-${dayjs().format('YYYY')}`;
      // Solo setear concepto por defecto para Abono/Cobro, dejar vacío para Cargo
      const conceptoInicial = conceptoPreset || (esReintegro || tipoInicial === 'DEBITO' ? '' : `Cobro Liquidación ${periodoActual}`);

      setFormData(prev => ({
        ...prev,
        importe: importeInicial.toFixed(2),
        concepto: conceptoInicial,
        tipoMovimiento: tipoInicial,
        fecha: dayjs(),
        medioPagoId: '',
        observaciones: ''
      }));
    }
  }, [open, contrato, tipoOperacion, importePreset, conceptoPreset]);

  // Actualizar concepto cuando cambia el tipo de movimiento
  const handleTipoMovimientoChange = (newTipo) => {
    if (!newTipo) return;
    
    const periodoActual = `${dayjs().format('MM')}-${dayjs().format('YYYY')}`;
    let nuevoConcepto = '';
    
    if (newTipo === 'CREDITO') {
      // Abono / Pago Recibido → sugerir concepto de cobro
      nuevoConcepto = `Cobro Liquidación ${periodoActual}`;
    }
    // Si es DEBITO (Cargo), dejar concepto vacío
    
    setFormData(prev => ({ 
      ...prev, 
      tipoMovimiento: newTipo,
      concepto: nuevoConcepto
    }));
  };

  const { data: mediosPago = [] } = useQuery({
    queryKey: ['medios-pago'],
    queryFn: () => api.get('/medios-pago').then(r => r.data)
  });

  const mutation = useMutation({
    mutationFn: (data) => api.post('/cobros', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['cobranzas-pendientes']);
      queryClient.invalidateQueries(['movimientos-inquilino', contrato?.id]);
      queryClient.invalidateQueries(['liquidaciones']);
      queryClient.invalidateQueries({ queryKey: ['cuenta-inquilino-saldo'] });
      onSuccess?.();
      onClose();
    }
  });

  const handleSubmit = () => {
    if (!formData.importe || !formData.medioPagoId) {
      alert('Complete los campos requeridos');
      return;
    }
    
    const importeBase = parseFloat(formData.importe);
    const importeFinal = Math.abs(importeBase);
    
    const esCredito = formData.tipoMovimiento === 'CREDITO';
    const conceptoDefault = esCredito ? 'Cobro' : 'Cargo';
    
    mutation.mutate({
      contratoId: contrato.id,
      fecha: formData.fecha.toISOString(),
      concepto: formData.concepto || `${conceptoDefault} ${dayjs().format('DD/MM/YYYY')}`,
      importe: importeFinal,
      medioPagoId: parseInt(formData.medioPagoId, 10),
      tipoMovimiento: formData.tipoMovimiento,
      observaciones: formData.observaciones || null
    });
  };

  const inquilino = contrato?.inquilino;
  const nombreInquilino = inquilino?.razonSocial || `${inquilino?.apellido || ''}, ${inquilino?.nombre || ''}`.trim() || 'Sin datos';
  const saldoDeudor = contrato?.saldoDeudor || 0;
  
  const esCredito = formData.tipoMovimiento === 'CREDITO';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Receipt color={esCredito ? 'success' : 'error'} />
          Registrar Movimiento - Inquilino
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>Inquilino:</strong> {nombreInquilino}<br />
            <strong>{saldoDeudor >= 0 ? 'Saldo Deudor' : 'Saldo a Favor'}:</strong> {formatCurrency(Math.abs(saldoDeudor))}
          </Alert>
          
          {/* Selector de Efecto en Cuenta */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Efecto en Cuenta *
            </Typography>
            <ToggleButtonGroup
              value={formData.tipoMovimiento}
              exclusive
              onChange={(e, val) => handleTipoMovimientoChange(val)}
              fullWidth
              size="small"
            >
              <ToggleButton
                value="CREDITO"
                sx={{ 
                  '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.main' } }
                }}
              >
                <AttachMoney sx={{ mr: 1 }} />
                <Box textAlign="left">
                  <Typography variant="body2" fontWeight={600}>Pago Recibido</Typography>
                  <Typography variant="caption" display="block">Reduce la deuda del inquilino</Typography>
                </Box>
              </ToggleButton>
              <ToggleButton 
                value="DEBITO"
                sx={{ 
                  '&.Mui-selected': { bgcolor: 'error.light', color: 'error.contrastText', '&:hover': { bgcolor: 'error.main' } }
                }}
              >
                <AttachMoney sx={{ mr: 1 }} />
                <Box textAlign="left">
                  <Typography variant="body2" fontWeight={600}>Cargo / Deuda</Typography>
                  <Typography variant="caption" display="block">Aumenta la deuda del inquilino</Typography>
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Fecha"
                value={formData.fecha}
                onChange={(val) => setFormData(prev => ({ ...prev, fecha: val }))}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                label="Importe *" 
                type="number" 
                fullWidth 
                size="small"
                value={formData.importe} 
                onChange={(e) => setFormData(prev => ({ ...prev, importe: e.target.value }))} 
                InputProps={{ 
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  sx: { fontSize: '1.1rem', fontWeight: 600 }
                }}
                inputProps={{ style: { textAlign: 'right' }, step: '0.01', min: '0' }}
                sx={{ '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 }, '& input[type=number]': { MozAppearance: 'textfield' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Medio de Pago</InputLabel>
                <Select value={formData.medioPagoId} label="Medio de Pago" onChange={(e) => setFormData(prev => ({ ...prev, medioPagoId: e.target.value }))}>
                  {mediosPago.map((mp) => (<MenuItem key={mp.id} value={mp.id}>{mp.nombre}</MenuItem>))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Concepto" fullWidth size="small" value={formData.concepto} onChange={(e) => setFormData(prev => ({ ...prev, concepto: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Observaciones" fullWidth size="small" multiline rows={2} value={formData.observaciones} onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))} />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button 
          variant="contained" 
          color={esCredito ? 'primary' : 'error'} 
          onClick={handleSubmit} 
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Registrando...' : esCredito ? 'Guardar' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================
// MODAL REGISTRAR MOVIMIENTO PROPIETARIO (Bidireccional)
// ============================================
export function RegistrarPagoModal({ 
  open, 
  onClose, 
  contrato, 
  onSuccess, 
  tipoOperacion = 'pago',
  importePreset,
  conceptoPreset
}) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    fecha: dayjs(),
    tipoMovimiento: 'DEBITO',
    concepto: '',
    importe: '',
    medioPagoId: '',
    observaciones: ''
  });

  useEffect(() => {
    if (open) {
      const saldo = contrato?.saldoAPagar ?? 0;
      const importeInicial = importePreset !== undefined ? importePreset : Math.abs(saldo);
      
      // Formato período: MM-AAAA
      const periodoActual = `${dayjs().format('MM')}-${dayjs().format('YYYY')}`;
      
      // Determinar tipo de movimiento según el saldo y la operación solicitada:
      // - Si saldo > 0 (inmobiliaria debe) → preseleccionar DÉBITO (pago emitido)
      // - Si saldo < 0 (propietario debe) → preseleccionar CRÉDITO (cobro recibido)
      // - Si viene tipoOperacion='cobro' explícito, usar CRÉDITO
      let tipoMovimientoInicial = 'DEBITO';
      let conceptoInicial = `Pago Liquidación ${periodoActual}`;
      
      if (tipoOperacion === 'cobro' || saldo < 0) {
        tipoMovimientoInicial = 'CREDITO';
        conceptoInicial = `Cobro Liquidación ${periodoActual}`;
      }
      
      if (conceptoPreset) {
        conceptoInicial = conceptoPreset;
      }
      
      setFormData(prev => ({ 
        ...prev, 
        importe: importeInicial.toFixed(2), 
        concepto: conceptoInicial,
        tipoMovimiento: tipoMovimientoInicial,
        fecha: dayjs(),
        medioPagoId: '',
        observaciones: ''
      }));
    }
  }, [open, contrato, tipoOperacion, importePreset, conceptoPreset]);

  // Actualizar concepto cuando cambia el tipo de movimiento
  const handleTipoMovimientoPropChange = (newTipo) => {
    if (!newTipo) return;
    
    const periodoActual = `${dayjs().format('MM')}-${dayjs().format('YYYY')}`;
    let nuevoConcepto = '';
    
    if (newTipo === 'DEBITO') {
      // Pago Emitido → sugerir concepto de pago
      nuevoConcepto = `Pago Liquidación ${periodoActual}`;
    } else {
      // Cobro Recibido → sugerir concepto de cobro
      nuevoConcepto = `Cobro Liquidación ${periodoActual}`;
    }
    
    setFormData(prev => ({ 
      ...prev, 
      tipoMovimiento: newTipo,
      concepto: nuevoConcepto
    }));
  };

  const { data: mediosPago = [] } = useQuery({
    queryKey: ['medios-pago'],
    queryFn: () => api.get('/medios-pago').then(r => r.data)
  });

  const mutation = useMutation({
    mutationFn: (data) => api.post('/pagos-propietario', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['pagos-propietario-pendientes']);
      queryClient.invalidateQueries(['cuentas-propietarios']);
      if (contrato?.propietarioId) {
        queryClient.invalidateQueries(['movimientos-propietario', 'cliente', contrato?.propietarioId]);
      }
      if (contrato?.tipo === 'propiedad') {
        queryClient.invalidateQueries(['movimientos-propietario', 'propiedad', contrato?.propiedadId]);
      } else {
        queryClient.invalidateQueries(['movimientos-propietario', 'contrato', contrato?.id]);
      }
      queryClient.invalidateQueries(['liquidaciones']);
      onSuccess?.();
      onClose();
    }
  });

  const handleSubmit = () => {
    if (!formData.importe || !formData.medioPagoId) {
      alert('Complete los campos requeridos');
      return;
    }
    
    const importeBase = parseFloat(formData.importe);
    const importeFinal = Math.abs(importeBase);
    
    const esDebito = formData.tipoMovimiento === 'DEBITO';
    const conceptoDefault = esDebito ? 'Pago Propietario' : 'Cargo Propietario';
    
    const payload = {
      fecha: formData.fecha.toISOString(),
      concepto: formData.concepto || `${conceptoDefault} ${dayjs().format('DD/MM/YYYY')}`,
      importe: importeFinal,
      medioPagoId: parseInt(formData.medioPagoId, 10),
      tipoMovimiento: formData.tipoMovimiento,
      observaciones: formData.observaciones || null
    };
    
    if (contrato.propiedadId) {
      payload.propiedadId = contrato.propiedadId;
    }
    if (contrato.tipo !== 'propiedad' && contrato.id) {
      payload.contratoId = contrato.id;
    }
    
    mutation.mutate(payload);
  };

  const propietario = contrato?.propietario;
  const nombrePropietario = propietario?.razonSocial || `${propietario?.apellido || ''}, ${propietario?.nombre || ''}`.trim() || 'Sin propietario';
  const saldoAPagar = contrato?.saldoAPagar || 0;
  
  const esDebito = formData.tipoMovimiento === 'DEBITO';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <AccountBalance color={esDebito ? 'primary' : 'error'} />
          Registrar Movimiento - Propietario
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>Propietario:</strong> {nombrePropietario}<br />
            <strong>{saldoAPagar >= 0 ? 'Saldo a Pagar' : 'Saldo a Cobrar'}:</strong> {formatCurrency(Math.abs(saldoAPagar))}
            {saldoAPagar < 0 && (
              <Typography variant="caption" display="block" color="error.main">
                El propietario debe dinero a la inmobiliaria
              </Typography>
            )}
          </Alert>
          
          {/* Selector de Efecto en Cuenta */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Efecto en Cuenta *
            </Typography>
            <ToggleButtonGroup
              value={formData.tipoMovimiento}
              exclusive
              onChange={(e, val) => handleTipoMovimientoPropChange(val)}
              fullWidth
              size="small"
            >
              <ToggleButton 
                value="CREDITO"
                sx={{ 
                  '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.main' } }
                }}
              >
                <AttachMoney sx={{ mr: 1 }} />
                <Box textAlign="left">
                  <Typography variant="body2" fontWeight={600}>Ingreso</Typography>
                  <Typography variant="caption" display="block">El propietario nos paga</Typography>
                </Box>
              </ToggleButton>
              <ToggleButton 
                value="DEBITO" 
                sx={{ 
                  '&.Mui-selected': { bgcolor: 'error.light', color: 'error.contrastText', '&:hover': { bgcolor: 'error.main' } }
                }}
              >
                <AttachMoney sx={{ mr: 1 }} />
                <Box textAlign="left">
                  <Typography variant="body2" fontWeight={600}>Egreso</Typography>
                  <Typography variant="caption" display="block">Pagamos al propietario</Typography>
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Fecha"
                value={formData.fecha}
                onChange={(val) => setFormData(prev => ({ ...prev, fecha: val }))}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                label="Importe *" 
                type="number" 
                fullWidth 
                size="small"
                value={formData.importe} 
                onChange={(e) => setFormData(prev => ({ ...prev, importe: e.target.value }))} 
                InputProps={{ 
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  sx: { fontSize: '1.1rem', fontWeight: 600 }
                }}
                inputProps={{ style: { textAlign: 'right' }, step: '0.01', min: '0' }}
                sx={{ '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 }, '& input[type=number]': { MozAppearance: 'textfield' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Medio de Pago</InputLabel>
                <Select value={formData.medioPagoId} label="Medio de Pago" onChange={(e) => setFormData(prev => ({ ...prev, medioPagoId: e.target.value }))}>
                  {mediosPago.map((mp) => (<MenuItem key={mp.id} value={mp.id}>{mp.nombre}</MenuItem>))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Concepto" fullWidth size="small" value={formData.concepto} onChange={(e) => setFormData(prev => ({ ...prev, concepto: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Observaciones" fullWidth size="small" multiline rows={2} value={formData.observaciones} onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))} />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button 
          variant="contained" 
          color={esDebito ? 'primary' : 'error'} 
          onClick={handleSubmit} 
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Registrando...' : esDebito ? 'Guardar' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
