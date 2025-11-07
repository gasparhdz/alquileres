import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Card,
  CardContent,
  Tabs,
  Tab,
  Divider,
  Snackbar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReceiptIcon from '@mui/icons-material/Receipt';
import api from '../api';
import ParametroSelect from '../components/ParametroSelect';
import { useParametrosMap, getDescripcion, getAbreviatura } from '../utils/parametros';
import dayjs from 'dayjs';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function Liquidaciones() {
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [generarOpen, setGenerarOpen] = useState(false);
  const [selectedLiquidacion, setSelectedLiquidacion] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [generarForm, setGenerarForm] = useState({ contratoId: '', periodo: '' });
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const queryClient = useQueryClient();

  // Mapas de parámetros para mostrar descripciones
  const estadoLiquidacionMap = useParametrosMap('estado_liquidacion');
  const tipoCargoMap = useParametrosMap('tipo_cargo');
  const tipoImpuestoMap = useParametrosMap('tipo_impuesto');
  const quienPagaMap = useParametrosMap('quien_paga');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['liquidaciones'],
    queryFn: async () => {
      const response = await api.get('/liquidaciones');
      return response.data;
    }
  });

  const { data: contratos } = useQuery({
    queryKey: ['contratos', 'activos'],
    queryFn: async () => {
      const response = await api.get('/contratos?activo=true');
      return response.data;
    }
  });

  const { data: liquidacionDetalle } = useQuery({
    queryKey: ['liquidacion', selectedLiquidacion],
    queryFn: async () => {
      if (!selectedLiquidacion) return null;
      const response = await api.get(`/liquidaciones/${selectedLiquidacion}`);
      return response.data;
    },
    enabled: !!selectedLiquidacion
  });

  const generarMutation = useMutation({
    mutationFn: (data) => api.post('/liquidaciones/generar', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['liquidaciones']);
      setGenerarOpen(false);
      setGenerarForm({ contratoId: '', periodo: '' });
      setSuccessMessage('Liquidación generada exitosamente');
      setSnackbarOpen(true);
    }
  });

  const emitirMutation = useMutation({
    mutationFn: (id) => api.put(`/liquidaciones/${id}/emitir`),
    onSuccess: () => {
      queryClient.invalidateQueries(['liquidaciones']);
      queryClient.invalidateQueries(['liquidacion', selectedLiquidacion]);
      setSuccessMessage('Liquidación emitida exitosamente');
      setSnackbarOpen(true);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/liquidaciones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['liquidaciones']);
      setSuccessMessage('Liquidación eliminada exitosamente');
      setSnackbarOpen(true);
    }
  });

  const handleGenerar = () => {
    generarMutation.mutate(generarForm);
  };

  const handleEmitir = () => {
    if (window.confirm('¿Está seguro de emitir esta liquidación? Una vez emitida no se podrá modificar.')) {
      emitirMutation.mutate(selectedLiquidacion);
    }
  };

  const handleDownloadPDF = async (id) => {
    try {
      const response = await api.get(`/liquidaciones/${id}/pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `liquidacion-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error al descargar PDF:', error);
      alert('Error al generar PDF');
    }
  };

  const handleView = (liquidacionId) => {
    setSelectedLiquidacion(liquidacionId);
    setViewOpen(true);
  };

  const handleEdit = (liquidacionId) => {
    setSelectedLiquidacion(liquidacionId);
    setEditOpen(true);
  };

  if (isLoading) return <div>Cargando...</div>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Liquidaciones</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setGenerarOpen(true)}
            sx={{ mr: 1 }}
          >
            Generar Automática
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Nueva Manual
          </Button>
        </Box>
      </Box>

      {/* Vista de tabla para desktop */}
      <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Período</TableCell>
              <TableCell>Nro. Liquidación</TableCell>
              <TableCell>Inquilino</TableCell>
              <TableCell>Unidad</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Vencimiento</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.data?.map((liquidacion) => (
              <TableRow key={liquidacion.id}>
                <TableCell>{liquidacion.periodo}</TableCell>
                <TableCell>{liquidacion.numeracion || '-'}</TableCell>
                <TableCell>
                  {liquidacion.contrato?.inquilino?.razonSocial ||
                    `${liquidacion.contrato?.inquilino?.nombre || ''} ${liquidacion.contrato?.inquilino?.apellido || ''}`.trim()}
                </TableCell>
                <TableCell>{liquidacion.contrato?.unidad?.direccion}</TableCell>
                <TableCell>
                  <Chip
                    label={getDescripcion(estadoLiquidacionMap, liquidacion.estado)}
                    color={
                      liquidacion.estado === 'emitida'
                        ? 'success'
                        : liquidacion.estado === 'pagada'
                        ? 'primary'
                        : 'default'
                    }
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  ${parseFloat(liquidacion.total).toLocaleString('es-AR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </TableCell>
                <TableCell>
                  {liquidacion.vencimiento
                    ? dayjs(liquidacion.vencimiento).format('DD/MM/YYYY')
                    : '-'}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <IconButton size="small" onClick={() => handleView(liquidacion.id)} title="Ver detalle" sx={{ padding: '4px' }}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    {liquidacion.estado === 'borrador' && (
                      <>
                        <IconButton size="small" onClick={() => handleEdit(liquidacion.id)} title="Editar" sx={{ padding: '4px' }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            if (window.confirm('¿Está seguro de eliminar esta liquidación?')) {
                              deleteMutation.mutate(liquidacion.id);
                            }
                          }}
                          title="Eliminar"
                          sx={{ padding: '4px' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                    {liquidacion.estado === 'emitida' && (
                      <IconButton
                        size="small"
                        onClick={() => handleDownloadPDF(liquidacion.id)}
                        title="Descargar PDF"
                        sx={{ padding: '4px' }}
                      >
                        <PictureAsPdfIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Vista de cards para mobile */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <Grid container spacing={2}>
          {data?.data?.map((liquidacion) => (
            <Grid item xs={12} key={liquidacion.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        {liquidacion.periodo}
                      </Typography>
                      {liquidacion.numeracion && (
                        <Typography variant="body2" color="text.secondary">
                          #{liquidacion.numeracion}
                        </Typography>
                      )}
                    </Box>
                    <Box>
                      <Chip
                        label={getDescripcion(estadoLiquidacionMap, liquidacion.estado)}
                        color={
                          liquidacion.estado === 'emitida'
                            ? 'success'
                            : liquidacion.estado === 'pagada'
                            ? 'primary'
                            : 'default'
                        }
                        size="small"
                      />
                    </Box>
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {liquidacion.contrato?.inquilino && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>Inquilino:</strong>{' '}
                          {liquidacion.contrato?.inquilino?.razonSocial ||
                            `${liquidacion.contrato?.inquilino?.nombre || ''} ${liquidacion.contrato?.inquilino?.apellido || ''}`.trim()}
                        </Typography>
                      </Box>
                    )}
                    {liquidacion.contrato?.unidad && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HomeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>Unidad:</strong> {liquidacion.contrato?.unidad?.direccion}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AttachMoneyIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2" fontWeight={600}>
                        <strong>Total:</strong> $
                        {parseFloat(liquidacion.total).toLocaleString('es-AR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </Typography>
                    </Box>
                    {liquidacion.vencimiento && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarTodayIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>Vencimiento:</strong> {dayjs(liquidacion.vencimiento).format('DD/MM/YYYY')}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
                    <IconButton size="small" onClick={() => handleView(liquidacion.id)}>
                      <VisibilityIcon />
                    </IconButton>
                    {liquidacion.estado === 'borrador' && (
                      <>
                        <IconButton size="small" onClick={() => handleEdit(liquidacion.id)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            if (window.confirm('¿Está seguro de eliminar esta liquidación?')) {
                              deleteMutation.mutate(liquidacion.id);
                            }
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </>
                    )}
                    {liquidacion.estado === 'emitida' && (
                      <IconButton size="small" onClick={() => handleDownloadPDF(liquidacion.id)}>
                        <PictureAsPdfIcon />
                      </IconButton>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Dialog de generación automática */}
      <Dialog open={generarOpen} onClose={() => setGenerarOpen(false)}>
        <DialogTitle>Generar Liquidación Automática</DialogTitle>
        <DialogContent>
          {generarMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {generarMutation.error?.response?.data?.error || 'Error al generar liquidación'}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1, minWidth: 400 }}>
            <FormControl fullWidth required>
              <InputLabel>Contrato</InputLabel>
              <Select
                value={generarForm.contratoId}
                onChange={(e) => setGenerarForm({ ...generarForm, contratoId: e.target.value })}
                label="Contrato"
              >
                {contratos?.data?.map((contrato) => (
                  <MenuItem key={contrato.id} value={contrato.id}>
                    {contrato.inquilino?.razonSocial ||
                      `${contrato.inquilino?.nombre} ${contrato.inquilino?.apellido}`} -{' '}
                    {contrato.unidad?.direccion}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Período"
              type="month"
              fullWidth
              required
              value={generarForm.periodo}
              onChange={(e) => setGenerarForm({ ...generarForm, periodo: e.target.value })}
              InputLabelProps={{ shrink: true }}
              helperText="Formato: YYYY-MM (ej: 2025-11)"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerarOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleGenerar}
            disabled={!generarForm.contratoId || !generarForm.periodo || generarMutation.isLoading}
          >
            {generarMutation.isLoading ? 'Generando...' : 'Generar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de creación manual */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Nueva Liquidación Manual</DialogTitle>
        <DialogContent>
          <LiquidacionForm onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Dialog de edición */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Editar Liquidación</DialogTitle>
        <DialogContent>
          {liquidacionDetalle && (
            <LiquidacionEditForm liquidacion={liquidacionDetalle} onClose={() => setEditOpen(false)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de vista detallada */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Detalle de Liquidación</DialogTitle>
        <DialogContent>
          {liquidacionDetalle && (
            <LiquidacionDetalle
              liquidacion={liquidacionDetalle}
              onEmitir={handleEmitir}
              onDownloadPDF={() => handleDownloadPDF(selectedLiquidacion)}
            />
          )}
        </DialogContent>
        <DialogActions>
          {liquidacionDetalle?.estado === 'borrador' && (
            <Button
              variant="contained"
              startIcon={<CheckCircleIcon />}
              onClick={handleEmitir}
              disabled={emitirMutation.isLoading}
            >
              Emitir Liquidación
            </Button>
          )}
          {liquidacionDetalle?.estado === 'emitida' && (
            <Button
              variant="contained"
              startIcon={<PictureAsPdfIcon />}
              onClick={() => handleDownloadPDF(selectedLiquidacion)}
            >
              Descargar PDF
            </Button>
          )}
          <Button onClick={() => setViewOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// Componente de formulario de liquidación manual
function LiquidacionForm({ onClose }) {
  // Obtener mes/año actual en formato YYYY-MM
  const mesActual = dayjs().format('YYYY-MM');
  
  const [formData, setFormData] = useState({
    contratoId: '',
    unidadId: '',
    periodo: mesActual,
    vencimiento: '',
    observaciones: '',
    items: []
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const queryClient = useQueryClient();
  const contratoIdRef = useRef('');
  const itemsCargadosRef = useRef(false);

  // Mapas de parámetros
  const tipoImpuestoMap = useParametrosMap('tipo_impuesto');
  const quienPagaMap = useParametrosMap('quien_paga');

  const { data: contratos } = useQuery({
    queryKey: ['contratos', 'activos'],
    queryFn: async () => {
      const response = await api.get('/contratos?activo=true');
      return response.data;
    }
  });

  // Obtener detalles del contrato seleccionado (con responsabilidades y unidad)
  const { data: contratoDetalle } = useQuery({
    queryKey: ['contrato', formData.contratoId],
    queryFn: async () => {
      if (!formData.contratoId) return null;
      const response = await api.get(`/contratos/${formData.contratoId}`);
      return response.data;
    },
    enabled: !!formData.contratoId
  });

  // Obtener cuentas tributarias de la unidad
  const { data: cuentasTributarias } = useQuery({
    queryKey: ['cuentasTributarias', formData.unidadId],
    queryFn: async () => {
      if (!formData.unidadId) return [];
      const response = await api.get(`/cuentas/unidad/${formData.unidadId}`);
      return response.data || [];
    },
    enabled: !!formData.unidadId
  });

  // Efecto para cargar items automáticamente cuando cambia el contrato
  useEffect(() => {
    // Solo cargar items si tenemos contrato cargado
    if (!contratoDetalle?.id || !contratoDetalle?.unidadId) {
      return;
    }
    
    const contratoIdActual = contratoDetalle.id;
    const unidadIdActual = contratoDetalle.unidadId;
    
    // Solo ejecutar si cambió el contrato
    if (contratoIdActual !== contratoIdRef.current) {
      contratoIdRef.current = contratoIdActual;
      itemsCargadosRef.current = false;
      
      // Actualizar unidadId inmediatamente
      setFormData((prev) => ({
        ...prev,
        unidadId: unidadIdActual,
        items: []
      }));
      return; // Salir para esperar a que se carguen las cuentas tributarias
    }
    
    // Si ya cargamos los items para este contrato, no volver a cargar
    if (itemsCargadosRef.current) return;
    
    // Necesitamos que se carguen las cuentas tributarias
    if (cuentasTributarias === undefined) return;
    
    itemsCargadosRef.current = true;
    
    // Si hay cuentas tributarias, crear items
    if (cuentasTributarias && cuentasTributarias.length > 0) {
      // Crear items basados en las cuentas tributarias
      const nuevosItems = cuentasTributarias.map((cuenta, index) => {
        // Buscar responsabilidad para este tipo de impuesto
        const responsabilidad = contratoDetalle.responsabilidades?.find(
          (r) => r.tipoCargo === cuenta.tipoImpuesto
        );

        return {
          tipoCargo: cuenta.tipoImpuesto,
          tipoCargoNombre: getAbreviatura(tipoImpuestoMap, cuenta.tipoImpuesto),
          quienPagaNombre: responsabilidad?.quienPaga 
            ? getDescripcion(quienPagaMap, responsabilidad.quienPaga) 
            : '',
          cuentaTributariaId: cuenta.id,
          importe: '',
          quienPaga: responsabilidad?.quienPaga || '',
          observaciones: cuenta.observaciones || '',
          orden: index,
          fuente: 'manual'
        };
      });

      setFormData((prev) => ({
        ...prev,
        items: nuevosItems
      }));
    } else {
      // Si no hay cuentas tributarias, limpiar items
      setFormData((prev) => ({
        ...prev,
        items: []
      }));
    }
  }, [contratoDetalle, cuentasTributarias, tipoImpuestoMap, quienPagaMap]);

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/liquidaciones', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['liquidaciones']);
      setSuccessMessage('Liquidación creada exitosamente');
      setSnackbarOpen(true);
      setErrors({});
      setTimeout(() => {
        onClose();
      }, 1500);
    },
    onError: (error) => {
      console.error('Error al crear liquidación:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Error al crear liquidación';
      alert(errorMessage);
    }
  });

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { tipoCargo: '', importe: '', quienPaga: '', observaciones: '', orden: formData.items.length }
      ]
    });
  };

  const handleRemoveItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const handleUpdateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
    
    // Limpiar error de items si se está editando
    if (errors.items) {
      setErrors({ ...errors, items: '' });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Validar contrato
    if (!formData.contratoId || formData.contratoId.trim() === '') {
      newErrors.contratoId = 'El contrato es requerido';
    }

    // Validar período
    if (!formData.periodo || formData.periodo.trim() === '') {
      newErrors.periodo = 'El período es requerido';
    }

    // Validar items
    const validItems = formData.items.filter(
      item => item.importe && parseFloat(item.importe) > 0
    );
    
    if (validItems.length === 0) {
      newErrors.items = 'Debe completar al menos un item con importe válido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validar formulario antes de enviar
    if (!validateForm()) {
      return;
    }

    const contrato = contratos?.data?.find((c) => c.id === formData.contratoId);
    if (!contrato) {
      setErrors({ contratoId: 'Contrato no encontrado' });
      return;
    }

    // Filtrar y validar items
    const validItems = formData.items
      .filter(item => item.tipoCargo && item.quienPaga && item.importe && parseFloat(item.importe) > 0)
      .map((item, index) => {
        const importe = parseFloat(item.importe);
        if (isNaN(importe) || importe <= 0) {
          throw new Error(`El item ${index + 1} debe tener un importe válido mayor a 0`);
        }
        return {
          tipoCargo: item.tipoCargo,
          cuentaTributariaId: item.cuentaTributariaId || null,
          periodoRef: item.periodoRef || null,
          importe: importe,
          quienPaga: item.quienPaga,
          fuente: item.fuente || 'manual',
          refExterna: item.refExterna || null,
          observaciones: item.observaciones || null,
          orden: index
        };
      });

    const submitData = {
      contratoId: formData.contratoId,
      unidadId: contrato.unidadId,
      periodo: formData.periodo,
      vencimiento: formData.vencimiento ? new Date(formData.vencimiento).toISOString() : null,
      observaciones: formData.observaciones || null,
      estado: 'borrador',
      items: validItems
    };

    createMutation.mutate(submitData);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required size="small" error={!!errors.contratoId}>
              <InputLabel>Contrato</InputLabel>
              <Select
                value={formData.contratoId}
                onChange={(e) => {
                  e.stopPropagation();
                  const nuevoContratoId = e.target.value;
                  contratoIdRef.current = '';
                  itemsCargadosRef.current = false;
                  setFormData({ 
                    ...formData, 
                    contratoId: nuevoContratoId,
                    unidadId: '',
                    items: []
                  });
                  if (errors.contratoId) {
                    setErrors({ ...errors, contratoId: '' });
                  }
                }}
                label="Contrato"
                MenuProps={{
                  disableScrollLock: true,
                }}
              >
                {contratos?.data?.map((contrato) => (
                  <MenuItem key={contrato.id} value={contrato.id}>
                    {contrato.inquilino?.razonSocial ||
                      `${contrato.inquilino?.nombre} ${contrato.inquilino?.apellido}`} -{' '}
                    {contrato.unidad?.direccion}
                  </MenuItem>
                ))}
              </Select>
              {errors.contratoId && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                  {errors.contratoId}
                </Typography>
              )}
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="Período"
              type="month"
              fullWidth
              required
              size="small"
              value={formData.periodo}
              onChange={(e) => {
                setFormData({ ...formData, periodo: e.target.value });
                if (errors.periodo) {
                  setErrors({ ...errors, periodo: '' });
                }
              }}
              InputLabelProps={{ shrink: true }}
              error={!!errors.periodo}
              helperText={errors.periodo}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="Vencimiento"
              type="date"
              fullWidth
              size="small"
              value={formData.vencimiento}
              onChange={(e) => setFormData({ ...formData, vencimiento: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Observaciones"
              multiline
              rows={3}
              fullWidth
              size="small"
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
            />
          </Grid>
        </Grid>

        <Box >
          <Typography variant="h6" sx={{ mb: 1.5 }}>Items</Typography>
          {errors.items && (
            <Typography variant="caption" color="error" sx={{ mb: 1, display: 'block' }}>
              {errors.items}
            </Typography>
          )}

          <TableContainer component={Paper} variant="outlined">
            <Table size="small" sx={{ 
              '& .MuiTableCell-root': { py: 0.25, px: 1, verticalAlign: 'middle' },
              '& .MuiTableCell-head': { py: 0.5 }
            }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '30%' }}>Impuesto</TableCell>
                  <TableCell sx={{ width: '15%' }}>Quién Paga</TableCell>
                  <TableCell sx={{ width: '15%' }}>Importe</TableCell>
                  <TableCell sx={{ width: '35%' }}>Observaciones</TableCell>
                  <TableCell sx={{ width: '5%', px: 0.5 }} align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {formData.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary">
                        {formData.contratoId 
                          ? 'No hay cuentas tributarias asociadas a esta unidad. Agregue cuentas tributarias en la sección de Unidades.'
                          : 'Seleccione un contrato para cargar los impuestos'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  formData.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          {item.tipoCargoNombre || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          {item.quienPagaNombre || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <TextField
                          size="small"
                          type="number"
                          value={item.importe || ''}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleUpdateItem(index, 'importe', e.target.value);
                          }}
                          onFocus={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="0.00"
                          inputProps={{ step: '0.01', min: '0' }}
                          sx={{ width: '100%' }}
                          autoComplete="off"
                        />
                      </TableCell>
                      
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <TextField
                          size="small"
                          value={item.observaciones || ''}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleUpdateItem(index, 'observaciones', e.target.value);
                          }}
                          onFocus={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Observaciones"
                          fullWidth
                          autoComplete="off"
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ px: 0.5 }}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveItem(index);
                          }}
                          sx={{ padding: '4px' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Typography variant="h6">
              Total: ${formData.items
                .reduce((sum, item) => sum + parseFloat(item.importe || 0), 0)
                .toLocaleString('es-AR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
            </Typography>
          </Box>
        </Box>
      </Box>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={createMutation.isLoading}>
          {createMutation.isLoading ? 'Creando...' : 'Crear'}
        </Button>
      </DialogActions>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
    </form>
  );
}

// Componente de edición de liquidación
function LiquidacionEditForm({ liquidacion, onClose }) {
  const [items, setItems] = useState(liquidacion.items || []);
  const [formData, setFormData] = useState({
    vencimiento: liquidacion.vencimiento ? dayjs(liquidacion.vencimiento).format('YYYY-MM-DD') : '',
    observaciones: liquidacion.observaciones || ''
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/liquidaciones/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['liquidaciones']);
      queryClient.invalidateQueries(['liquidacion', liquidacion.id]);
      setSuccessMessage('Liquidación actualizada exitosamente');
      setSnackbarOpen(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  });

  const handleAddItem = () => {
    setItems([
      ...items,
      { tipoCargo: '', importe: '', quienPaga: '', observaciones: '', orden: items.length }
    ]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const total = items.reduce((sum, item) => sum + parseFloat(item.importe || 0), 0);
    updateMutation.mutate({
      id: liquidacion.id,
      data: {
        ...formData,
        vencimiento: formData.vencimiento ? new Date(formData.vencimiento) : null,
        items: items.map((item, index) => ({
          ...item,
          importe: parseFloat(item.importe || 0),
          orden: index
        })),
        total
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Box sx={{ mt: 1 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Vencimiento"
              type="date"
              fullWidth
              value={formData.vencimiento}
              onChange={(e) => setFormData({ ...formData, vencimiento: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Total"
              fullWidth
              disabled
              value={items.reduce((sum, item) => sum + parseFloat(item.importe || 0), 0).toLocaleString('es-AR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Observaciones"
              multiline
              rows={3}
              fullWidth
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Items</Typography>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={handleAddItem}>
              Agregar Item
            </Button>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tipo Cargo</TableCell>
                  <TableCell>Importe</TableCell>
                  <TableCell>Quién Paga</TableCell>
                  <TableCell>Observaciones</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <ParametroSelect
                        categoriaCodigo="tipo_cargo"
                        label="Tipo"
                        value={item.tipoCargo}
                        onChange={(e) => handleUpdateItem(index, 'tipoCargo', e.target.value)}
                        fullWidth={false}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={item.importe}
                        onChange={(e) => handleUpdateItem(index, 'importe', e.target.value)}
                        inputProps={{ step: '0.01', min: 0 }}
                        sx={{ width: 120 }}
                      />
                    </TableCell>
                    <TableCell>
                      <ParametroSelect
                        categoriaCodigo="quien_paga"
                        label="Responsable"
                        value={item.quienPaga}
                        onChange={(e) => handleUpdateItem(index, 'quienPaga', e.target.value)}
                        fullWidth={false}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={item.observaciones || ''}
                        onChange={(e) => handleUpdateItem(index, 'observaciones', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleRemoveItem(index)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="contained">
          Guardar
        </Button>
      </DialogActions>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
    </form>
  );
}

// Componente de vista detallada
function LiquidacionDetalle({ liquidacion, onEmitir, onDownloadPDF }) {
  // Mapas de parámetros para mostrar descripciones
  const estadoLiquidacionMap = useParametrosMap('estado_liquidacion');
  const tipoCargoMap = useParametrosMap('tipo_cargo');
  const tipoImpuestoMap = useParametrosMap('tipo_impuesto');
  const quienPagaMap = useParametrosMap('quien_paga');
  const tipoUnidadMap = useParametrosMap('tipo_unidad');

  if (!liquidacion) {
    return <Alert severity="info">Cargando información de la liquidación...</Alert>;
  }

  const formatoMoneda = (valor) => {
    if (!valor) return '-';
    return `$${parseFloat(valor).toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatoFecha = (fecha) => {
    if (!fecha) return '-';
    return dayjs(fecha).format('DD/MM/YYYY');
  };

  return (
    <Box sx={{ py: 1 }}>
      <Grid container spacing={2}>
        {/* Header compacto */}
        <Grid item xs={12}>
          <Card sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', py: 1 }}>
            <CardContent sx={{ py: '8px !important' }}>
              <Typography variant="h6" component="div">
                Liquidación {liquidacion.numeracion ? `#${liquidacion.numeracion}` : liquidacion.periodo}
                {liquidacion.contrato?.unidad && (
                  <span style={{ fontWeight: 'normal', fontSize: '0.9em' }}>
                    {' - '}
                    {getDescripcion(tipoUnidadMap, liquidacion.contrato.unidad.tipo) || ''}
                    {liquidacion.contrato.unidad.direccion && ` ${liquidacion.contrato.unidad.direccion}`}
                    {liquidacion.contrato.unidad.codigoInterno && `, ${liquidacion.contrato.unidad.codigoInterno}`}
                    {liquidacion.contrato.unidad.localidad && `, ${liquidacion.contrato.unidad.localidad}`}
                    .
                  </span>
                )}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Información General */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, flex: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
                Información General
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Período</Typography>
                  <Typography variant="body2" fontWeight="medium">{liquidacion.periodo}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Estado</Typography>
                  <Chip
                    label={getDescripcion(estadoLiquidacionMap, liquidacion.estado)}
                    size="small"
                    color={
                      liquidacion.estado === 'emitida'
                        ? 'success'
                        : liquidacion.estado === 'pagada'
                        ? 'primary'
                        : 'default'
                    }
                    sx={{ mt: 0.5 }}
                  />
                </Grid>
                {liquidacion.numeracion && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Nro. Liquidación</Typography>
                    <Typography variant="body2">{liquidacion.numeracion}</Typography>
                  </Grid>
                )}
                {liquidacion.vencimiento && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Vencimiento</Typography>
                    <Typography variant="body2">{formatoFecha(liquidacion.vencimiento)}</Typography>
                  </Grid>
                )}
                {liquidacion.emisionAt && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary" display="block">Emisión</Typography>
                    <Typography variant="body2">{dayjs(liquidacion.emisionAt).format('DD/MM/YYYY HH:mm')}</Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                  <Typography variant="h6" color="primary.main" fontWeight="bold">
                    {formatoMoneda(liquidacion.total)}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Inquilino y Propietario */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, flex: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
                Inquilino
              </Typography>
              {liquidacion.contrato?.inquilino ? (
                <>
                  <Typography variant="body2" fontWeight="medium" gutterBottom>
                    {liquidacion.contrato.inquilino.razonSocial ||
                     `${liquidacion.contrato.inquilino.nombre} ${liquidacion.contrato.inquilino.apellido}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {liquidacion.contrato.inquilino.dni && `DNI: ${liquidacion.contrato.inquilino.dni}`}
                    {liquidacion.contrato.inquilino.dni && liquidacion.contrato.inquilino.cuit && ' • '}
                    {liquidacion.contrato.inquilino.cuit && `CUIT: ${liquidacion.contrato.inquilino.cuit}`}
                  </Typography>
                  {liquidacion.contrato.inquilino.email && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      {liquidacion.contrato.inquilino.email}
                    </Typography>
                  )}
                  {liquidacion.contrato.inquilino.telefono && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {liquidacion.contrato.inquilino.telefono}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">Sin inquilino</Typography>
              )}
              
              {liquidacion.contrato?.unidad?.propietario && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
                    Propietario
                  </Typography>
                  <Typography variant="body2" fontWeight="medium" gutterBottom>
                    {liquidacion.contrato.unidad.propietario.razonSocial || 
                     `${liquidacion.contrato.unidad.propietario.nombre} ${liquidacion.contrato.unidad.propietario.apellido}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {liquidacion.contrato.unidad.propietario.dni && `DNI: ${liquidacion.contrato.unidad.propietario.dni}`}
                    {liquidacion.contrato.unidad.propietario.dni && liquidacion.contrato.unidad.propietario.cuit && ' • '}
                    {liquidacion.contrato.unidad.propietario.cuit && `CUIT: ${liquidacion.contrato.unidad.propietario.cuit}`}
                  </Typography>
                  {liquidacion.contrato.unidad.propietario.email && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      {liquidacion.contrato.unidad.propietario.email}
                    </Typography>
                  )}
                  {liquidacion.contrato.unidad.propietario.telefono && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {liquidacion.contrato.unidad.propietario.telefono}
                    </Typography>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Items */}
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
                Items
              </Typography>
              {liquidacion.items && liquidacion.items.length > 0 ? (
                <TableContainer>
                  <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.75rem' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="none"><strong>Concepto</strong></TableCell>
                        <TableCell padding="none" align="right"><strong>Importe</strong></TableCell>
                        <TableCell padding="none"><strong>Responsable</strong></TableCell>
                        <TableCell padding="none"><strong>Observaciones</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {liquidacion.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell padding="none">
                            {item.cuentaTributaria?.tipoImpuesto 
                              ? getAbreviatura(tipoImpuestoMap, item.cuentaTributaria.tipoImpuesto)
                              : getDescripcion(tipoCargoMap, item.tipoCargo)}
                          </TableCell>
                          <TableCell padding="none" align="right">{formatoMoneda(item.importe)}</TableCell>
                          <TableCell padding="none">{getDescripcion(quienPagaMap, item.quienPaga)}</TableCell>
                          <TableCell padding="none">{item.observaciones || '-'}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell padding="none" colSpan={3}>
                          <strong>TOTAL</strong>
                        </TableCell>
                        <TableCell padding="none" align="right">
                          <strong>{formatoMoneda(liquidacion.total)}</strong>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="caption" color="text.secondary">Sin items</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Observaciones */}
        {liquidacion.observaciones && (
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
                  Observaciones
                </Typography>
                <Typography variant="body2">{liquidacion.observaciones}</Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
