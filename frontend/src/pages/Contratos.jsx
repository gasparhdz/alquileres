import { useState } from 'react';
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
  Tabs,
  Tab,
  Card,
  CardContent,
  Divider,
  Snackbar,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
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

export default function Contratos() {
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [selectedContrato, setSelectedContrato] = useState(null);
  const [formData, setFormData] = useState({
    unidadId: '',
    inquilinoId: '',
    nroContrato: '',
    fechaInicio: '',
    fechaFin: '',
    duracionMeses: '',
    montoInicial: '',
    gastosAdministrativos: '',
    metodoAjuste: '',
    frecuenciaAjusteMeses: '',
    topeAjuste: '',
    registradoAfip: false,
    moneda: 'ARS'
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['contratos'],
    queryFn: async () => {
      const response = await api.get('/contratos?activo=true');
      return response.data;
    }
  });

  const { data: unidades } = useQuery({
    queryKey: ['unidades'],
    queryFn: async () => {
      const response = await api.get('/unidades');
      return response.data;
    }
  });

  const { data: inquilinos } = useQuery({
    queryKey: ['inquilinos'],
    queryFn: async () => {
      const response = await api.get('/inquilinos');
      return response.data;
    }
  });

  // Obtener mapas de parámetros para mostrar descripciones
  const metodoAjusteMap = useParametrosMap('metodo_ajuste');
  const monedaMap = useParametrosMap('moneda');

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/contratos', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contratos']);
      setOpen(false);
      resetForm();
      setSuccessMessage('Contrato creado exitosamente');
      setSnackbarOpen(true);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/contratos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contratos']);
      setOpen(false);
      resetForm();
      setSuccessMessage('Contrato actualizado exitosamente');
      setSnackbarOpen(true);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/contratos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['contratos']);
      setSuccessMessage('Contrato eliminado exitosamente');
      setSnackbarOpen(true);
    }
  });

  const { data: contratoDetalle } = useQuery({
    queryKey: ['contrato', selectedContrato],
    queryFn: async () => {
      if (!selectedContrato) return null;
      const response = await api.get(`/contratos/${selectedContrato}`);
      return response.data;
    },
    enabled: !!selectedContrato
  });

  const resetForm = () => {
    setFormData({
      unidadId: '',
      inquilinoId: '',
      nroContrato: '',
      fechaInicio: '',
      fechaFin: '',
      duracionMeses: '',
      montoInicial: '',
      gastosAdministrativos: '',
      metodoAjuste: '',
      frecuenciaAjusteMeses: '',
      topeAjuste: '',
      registradoAfip: false,
      moneda: 'ARS'
    });
    setEditing(null);
    setTabValue(0);
  };

  const handleOpen = () => {
    resetForm();
    setOpen(true);
  };

  const handleEdit = (contrato) => {
    setEditing(contrato);
    setFormData({
      unidadId: contrato.unidadId,
      inquilinoId: contrato.inquilinoId,
      nroContrato: contrato.nroContrato || '',
      fechaInicio: contrato.fechaInicio ? dayjs(contrato.fechaInicio).format('YYYY-MM-DD') : '',
      fechaFin: contrato.fechaFin ? dayjs(contrato.fechaFin).format('YYYY-MM-DD') : '',
      duracionMeses: contrato.duracionMeses || '',
      montoInicial: contrato.montoInicial || '',
      gastosAdministrativos: contrato.gastosAdministrativos || '',
      metodoAjuste: contrato.metodoAjuste || '',
      frecuenciaAjusteMeses: contrato.frecuenciaAjusteMeses || '',
      topeAjuste: contrato.topeAjuste || '',
      registradoAfip: contrato.registradoAfip || false,
      moneda: contrato.moneda || 'ARS'
    });
    setOpen(true);
  };

  const handleView = async (contratoId) => {
    setSelectedContrato(contratoId);
    setViewOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      fechaInicio: new Date(formData.fechaInicio),
      fechaFin: formData.fechaFin ? new Date(formData.fechaFin) : null,
      duracionMeses: formData.duracionMeses ? parseInt(formData.duracionMeses) : null,
      frecuenciaAjusteMeses: formData.frecuenciaAjusteMeses ? parseInt(formData.frecuenciaAjusteMeses) : null,
      montoInicial: parseFloat(formData.montoInicial),
      gastosAdministrativos: formData.gastosAdministrativos ? parseFloat(formData.gastosAdministrativos) : null,
      topeAjuste: formData.topeAjuste ? parseFloat(formData.topeAjuste) : null
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  if (isLoading) return <div>Cargando...</div>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Contratos</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}>
          Nuevo Contrato
        </Button>
      </Box>

      {/* Vista de tabla para desktop */}
      <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table size="small" sx={{
          '& .MuiTableCell-root': {
            padding: '6px 16px',
            fontSize: '0.875rem'
          },
          '& .MuiTableCell-head': {
            padding: '8px 16px'
          }
        }}>
          <TableHead>
            <TableRow>
              <TableCell>Nro. Contrato</TableCell>
              <TableCell>Inquilino</TableCell>
              <TableCell>Unidad</TableCell>
              <TableCell>Propietario</TableCell>
              <TableCell>Inicio</TableCell>
              <TableCell>Fin</TableCell>
              <TableCell>Monto</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.data?.map((contrato) => (
              <TableRow key={contrato.id}>
                <TableCell>{contrato.nroContrato || '-'}</TableCell>
                <TableCell>
                  {contrato.inquilino?.razonSocial ||
                    `${contrato.inquilino?.nombre || ''} ${contrato.inquilino?.apellido || ''}`.trim()}
                </TableCell>
                <TableCell>{contrato.unidad?.direccion}</TableCell>
                <TableCell>
                  {contrato.unidad?.propietario?.razonSocial ||
                    `${contrato.unidad?.propietario?.nombre || ''} ${contrato.unidad?.propietario?.apellido || ''}`.trim()}
                </TableCell>
                <TableCell>{dayjs(contrato.fechaInicio).format('DD/MM/YYYY')}</TableCell>
                <TableCell>
                  {contrato.fechaFin ? dayjs(contrato.fechaFin).format('DD/MM/YYYY') : 'Indefinido'}
                </TableCell>
                <TableCell>
                  ${parseFloat(contrato.montoInicial).toLocaleString('es-AR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </TableCell>
                <TableCell sx={{ padding: '4px 8px' }}>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <IconButton size="small" onClick={() => handleView(contrato.id)} title="Ver detalle" sx={{ padding: '4px' }}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleEdit(contrato)} title="Editar" sx={{ padding: '4px' }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (window.confirm('¿Está seguro de eliminar este contrato?')) {
                          deleteMutation.mutate(contrato.id);
                        }
                      }}
                      title="Eliminar"
                      sx={{ padding: '4px' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
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
          {data?.data?.map((contrato) => (
            <Grid item xs={12} key={contrato.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        Contrato #{contrato.nroContrato || 'N/A'}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={() => handleView(contrato.id)} sx={{ mr: 0.5 }}>
                        <VisibilityIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleEdit(contrato)} sx={{ mr: 0.5 }}>
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (window.confirm('¿Está seguro de eliminar este contrato?')) {
                            deleteMutation.mutate(contrato.id);
                          }
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {contrato.inquilino && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>Inquilino:</strong>{' '}
                          {contrato.inquilino?.razonSocial ||
                            `${contrato.inquilino?.nombre || ''} ${contrato.inquilino?.apellido || ''}`.trim()}
                        </Typography>
                      </Box>
                    )}
                    {contrato.unidad && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HomeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>Unidad:</strong> {contrato.unidad?.direccion}
                        </Typography>
                      </Box>
                    )}
                    {contrato.unidad?.propietario && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>Propietario:</strong>{' '}
                          {contrato.unidad?.propietario?.razonSocial ||
                            `${contrato.unidad?.propietario?.nombre || ''} ${contrato.unidad?.propietario?.apellido || ''}`.trim()}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarTodayIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        <strong>Inicio:</strong> {dayjs(contrato.fechaInicio).format('DD/MM/YYYY')}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarTodayIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        <strong>Fin:</strong> {contrato.fechaFin ? dayjs(contrato.fechaFin).format('DD/MM/YYYY') : 'Indefinido'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AttachMoneyIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        <strong>Monto:</strong> $
                        {parseFloat(contrato.montoInicial).toLocaleString('es-AR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Dialog de creación/edición */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {editing ? 'Editar Contrato' : 'Nuevo Contrato'}
          </DialogTitle>
          <DialogContent>
            {(createMutation.isError || updateMutation.isError) && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {createMutation.error?.response?.data?.error ||
                  updateMutation.error?.response?.data?.error ||
                  'Error al guardar'}
              </Alert>
            )}
            <Box sx={{ mt: 1 }}>
              <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
                <Tab label="Datos Principales" />
                <Tab label="Responsabilidades" />
                <Tab label="Garantías" />
                <Tab label="Gastos Iniciales" />
              </Tabs>

              <TabPanel value={tabValue} index={0}>
                <Grid container spacing={2}>
                  {/* Fila 1: Unidad, Inquilino, Nro. Contrato */}
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth required size="small">
                      <InputLabel>Unidad</InputLabel>
                      <Select
                        value={formData.unidadId}
                        onChange={(e) => setFormData({ ...formData, unidadId: e.target.value })}
                        label="Unidad"
                      >
                        {unidades?.data?.map((unidad) => (
                          <MenuItem key={unidad.id} value={unidad.id}>
                            {unidad.direccion}, {unidad.localidad}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth required size="small">
                      <InputLabel>Inquilino</InputLabel>
                      <Select
                        value={formData.inquilinoId}
                        onChange={(e) => setFormData({ ...formData, inquilinoId: e.target.value })}
                        label="Inquilino"
                      >
                        {inquilinos?.data?.map((inq) => (
                          <MenuItem key={inq.id} value={inq.id}>
                            {inq.razonSocial || `${inq.nombre} ${inq.apellido}`}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Nro. Contrato"
                      fullWidth
                      size="small"
                      value={formData.nroContrato}
                      onChange={(e) => setFormData({ ...formData, nroContrato: e.target.value })}
                    />
                  </Grid>

                  {/* Fila 2: Fecha Inicio, Fecha Fin, Duración */}
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Fecha Inicio"
                      type="date"
                      fullWidth
                      required
                      size="small"
                      value={formData.fechaInicio}
                      onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Fecha Fin"
                      type="date"
                      fullWidth
                      size="small"
                      value={formData.fechaFin}
                      onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Duración (meses)"
                      type="number"
                      fullWidth
                      size="small"
                      value={formData.duracionMeses}
                      onChange={(e) => setFormData({ ...formData, duracionMeses: e.target.value })}
                    />
                  </Grid>

                  {/* Fila 3: Monto Inicial, Gastos Administrativos, Método Ajuste, Frecuencia */}
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Monto Inicial"
                      type="number"
                      fullWidth
                      required
                      size="small"
                      value={formData.montoInicial}
                      onChange={(e) => setFormData({ ...formData, montoInicial: e.target.value })}
                      inputProps={{ step: '0.01', min: 0 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Gastos Administrativos"
                      type="number"
                      fullWidth
                      size="small"
                      value={formData.gastosAdministrativos}
                      onChange={(e) => setFormData({ ...formData, gastosAdministrativos: e.target.value })}
                      inputProps={{ step: '0.01', min: 0 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <ParametroSelect
                      categoriaCodigo="metodo_ajuste"
                      label="Método de Ajuste"
                      value={formData.metodoAjuste}
                      onChange={(e) => setFormData({ ...formData, metodoAjuste: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Frecuencia Ajuste (meses)"
                      type="number"
                      fullWidth
                      size="small"
                      value={formData.frecuenciaAjusteMeses}
                      onChange={(e) => setFormData({ ...formData, frecuenciaAjusteMeses: e.target.value })}
                    />
                  </Grid>

                  {/* Fila 4: Tope, Moneda, Registrado AFIP */}
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Tope Ajuste (%)"
                      type="number"
                      fullWidth
                      size="small"
                      value={formData.topeAjuste}
                      onChange={(e) => setFormData({ ...formData, topeAjuste: e.target.value })}
                      inputProps={{ step: '0.01', min: 0, max: 100 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <ParametroSelect
                      categoriaCodigo="moneda"
                      label="Moneda"
                      value={formData.moneda}
                      onChange={(e) => setFormData({ ...formData, moneda: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Registrado AFIP</InputLabel>
                      <Select
                        value={formData.registradoAfip ? 'true' : 'false'}
                        onChange={(e) => setFormData({ ...formData, registradoAfip: e.target.value === 'true' })}
                        label="Registrado AFIP"
                      >
                        <MenuItem value="false">No</MenuItem>
                        <MenuItem value="true">Sí</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <ContratoResponsabilidades contratoId={editing?.id} />
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <ContratoGarantias contratoId={editing?.id} />
              </TabPanel>

              <TabPanel value={tabValue} index={3}>
                <ContratoGastosIniciales contratoId={editing?.id} />
              </TabPanel>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={!editing && tabValue !== 0}>
              {editing ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog de vista detallada */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Detalle del Contrato</DialogTitle>
        <DialogContent>
          {contratoDetalle && (
            <ContratoDetalle contrato={contratoDetalle} />
          )}
        </DialogContent>
        <DialogActions>
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

// Componente para Responsabilidades
function ContratoResponsabilidades({ contratoId }) {
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const queryClient = useQueryClient();

  // Mapas de parámetros para mostrar descripciones
  const tipoImpuestoMap = useParametrosMap('tipo_impuesto');
  const periodicidadMap = useParametrosMap('periodicidad');
  const quienPagaMap = useParametrosMap('quien_paga');

  const { data: contrato } = useQuery({
    queryKey: ['contrato', contratoId],
    queryFn: async () => {
      if (!contratoId) return null;
      const response = await api.get(`/contratos/${contratoId}`);
      return response.data;
    },
    enabled: !!contratoId
  });

  // Obtener cuentas tributarias de la unidad
  const { data: cuentasTributarias } = useQuery({
    queryKey: ['cuentasTributarias', contrato?.unidadId],
    queryFn: async () => {
      if (!contrato?.unidadId) return [];
      const response = await api.get(`/cuentas/unidad/${contrato.unidadId}`);
      return response.data || [];
    },
    enabled: !!contrato?.unidadId
  });

  // Obtener IDs de parámetros para "inquilino" y "propietario"
  const { data: quienPagaParams } = useQuery({
    queryKey: ['parametros', 'quien_paga'],
    queryFn: async () => {
      const response = await api.get(`/parametros/categorias/quien_paga/parametros`);
      return response.data;
    }
  });

  const inquilinoParamId = quienPagaParams?.find(p => p.codigo === 'inquilino')?.id;
  const propietarioParamId = quienPagaParams?.find(p => p.codigo === 'propietario')?.id;

  // Función para verificar si existe una responsabilidad para una cuenta y quien paga
  const getResponsabilidad = (tipoImpuestoId, quienPagaId) => {
    return contrato?.responsabilidades?.find(
      resp => resp.tipoCargo === tipoImpuestoId && resp.quienPaga === quienPagaId
    );
  };

  const createMutation = useMutation({
    mutationFn: (data) => api.post(`/contratos/${contratoId}/responsabilidades`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contrato', contratoId]);
      setSuccessMessage('Responsabilidad actualizada exitosamente');
      setSnackbarOpen(true);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/contratos/responsabilidades/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['contrato', contratoId]);
      setSuccessMessage('Responsabilidad eliminada exitosamente');
      setSnackbarOpen(true);
    }
  });

  const handleCheckboxChange = async (cuenta, quienPagaId, checked) => {
    const responsabilidad = getResponsabilidad(cuenta.tipoImpuesto, quienPagaId);
    
    if (checked) {
      // Crear responsabilidad
      await createMutation.mutateAsync({
        tipoCargo: cuenta.tipoImpuesto,
        quienPaga: quienPagaId,
        titular: null
      });
    } else {
      // Eliminar responsabilidad
      if (responsabilidad) {
        await deleteMutation.mutateAsync(responsabilidad.id);
      }
    }
  };

  if (!contratoId) {
    return <Alert severity="info">Guarde el contrato primero para agregar responsabilidades</Alert>;
  }

  if (!contrato?.unidadId) {
    return <Alert severity="info">Seleccione una unidad en el contrato para ver las cuentas tributarias</Alert>;
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Responsabilidades de Pago</Typography>

      {cuentasTributarias && cuentasTributarias.length > 0 ? (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Impuesto</TableCell>
                <TableCell>Periodicidad</TableCell>
                <TableCell>Código 1</TableCell>
                <TableCell>Código 2</TableCell>
                <TableCell align="center">Inquilino</TableCell>
                <TableCell align="center">Propietario</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cuentasTributarias.map((cuenta) => {
                const respInquilino = getResponsabilidad(cuenta.tipoImpuesto, inquilinoParamId);
                const respPropietario = getResponsabilidad(cuenta.tipoImpuesto, propietarioParamId);
                
                return (
                  <TableRow key={cuenta.id}>
                    <TableCell>{getAbreviatura(tipoImpuestoMap, cuenta.tipoImpuesto)}</TableCell>
                    <TableCell>{getDescripcion(periodicidadMap, cuenta.periodicidad) || '-'}</TableCell>
                    <TableCell>{cuenta.codigo1 || '-'}</TableCell>
                    <TableCell>{cuenta.codigo2 || '-'}</TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={!!respInquilino}
                        onChange={(e) => handleCheckboxChange(cuenta, inquilinoParamId, e.target.checked)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={!!respPropietario}
                        onChange={(e) => handleCheckboxChange(cuenta, propietarioParamId, e.target.checked)}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Alert severity="info">
          No hay cuentas tributarias asociadas a esta unidad. Agregue cuentas tributarias en la sección de Unidades.
        </Alert>
      )}

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

// Componente para Garantías
function ContratoGarantias({ contratoId }) {
  const [formData, setFormData] = useState({
    tipoGarantia: '',
    estadoGarantia: '',
    apellido: '',
    nombre: '',
    dni: '',
    cuit: '',
    telefono: '',
    mail: '',
    direccion: ''
  });
  const [open, setOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const queryClient = useQueryClient();

  // Mapas de parámetros para mostrar descripciones
  const tipoGarantiaMap = useParametrosMap('tipo_garantia');
  const estadoGarantiaMap = useParametrosMap('estado_garantia');

  const { data: contrato } = useQuery({
    queryKey: ['contrato', contratoId],
    queryFn: async () => {
      if (!contratoId) return null;
      const response = await api.get(`/contratos/${contratoId}`);
      return response.data;
    },
    enabled: !!contratoId
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post(`/contratos/${contratoId}/garantias`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contrato', contratoId]);
      setOpen(false);
      setFormData({
        tipoGarantia: '',
        estadoGarantia: '',
        apellido: '',
        nombre: '',
        dni: '',
        cuit: '',
        telefono: '',
        mail: '',
        direccion: ''
      });
      setSuccessMessage('Garantía agregada exitosamente');
      setSnackbarOpen(true);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/contratos/garantias/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['contrato', contratoId]);
      setSuccessMessage('Garantía eliminada exitosamente');
      setSnackbarOpen(true);
    }
  });

  if (!contratoId) {
    return <Alert severity="info">Guarde el contrato primero para agregar garantías</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Garantías</Typography>
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Agregar
        </Button>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tipo</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>DNI/CUIT</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contrato?.garantias?.map((garantia) => (
              <TableRow key={garantia.id}>
                <TableCell>{getDescripcion(tipoGarantiaMap, garantia.tipoGarantia)}</TableCell>
                <TableCell>{getDescripcion(estadoGarantiaMap, garantia.estadoGarantia)}</TableCell>
                <TableCell>{garantia.nombre} {garantia.apellido}</TableCell>
                <TableCell>{garantia.dni || garantia.cuit || '-'}</TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (window.confirm('¿Eliminar esta garantía?')) {
                        deleteMutation.mutate(garantia.id);
                      }
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva Garantía</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <ParametroSelect
                categoriaCodigo="tipo_garantia"
                label="Tipo de Garantía"
                value={formData.tipoGarantia}
                onChange={(e) => setFormData({ ...formData, tipoGarantia: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ParametroSelect
                categoriaCodigo="estado_garantia"
                label="Estado"
                value={formData.estadoGarantia}
                onChange={(e) => setFormData({ ...formData, estadoGarantia: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nombre"
                fullWidth
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Apellido"
                fullWidth
                value={formData.apellido}
                onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="DNI"
                fullWidth
                value={formData.dni}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').substring(0, 8);
                  setFormData({ ...formData, dni: value });
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="CUIT"
                fullWidth
                value={formData.cuit}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, '');
                  if (value.length > 2) value = value.substring(0, 2) + '-' + value.substring(2);
                  if (value.length > 11) value = value.substring(0, 11) + '-' + value.substring(11);
                  value = value.substring(0, 13);
                  setFormData({ ...formData, cuit: value });
                }}
                placeholder="XX-XXXXXXXX-X"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Teléfono"
                fullWidth
                value={formData.telefono}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setFormData({ ...formData, telefono: value });
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                type="email"
                fullWidth
                value={formData.mail}
                onChange={(e) => setFormData({ ...formData, mail: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Dirección"
                fullWidth
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => {
              createMutation.mutate(formData);
            }}
          >
            Agregar
          </Button>
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

// Componente para Gastos Iniciales
function ContratoGastosIniciales({ contratoId }) {
  const [formData, setFormData] = useState({
    tipoGastoInicial: '',
    importe: '',
    estado: '',
    observaciones: ''
  });
  const [open, setOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const queryClient = useQueryClient();

  // Mapas de parámetros para mostrar descripciones
  const tipoGastoInicialMap = useParametrosMap('tipo_gasto_inicial');
  const estadoGastoMap = useParametrosMap('estado_gasto');

  const { data: contrato } = useQuery({
    queryKey: ['contrato', contratoId],
    queryFn: async () => {
      if (!contratoId) return null;
      const response = await api.get(`/contratos/${contratoId}`);
      return response.data;
    },
    enabled: !!contratoId
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post(`/contratos/${contratoId}/gastos-iniciales`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contrato', contratoId]);
      setOpen(false);
      setFormData({
        tipoGastoInicial: '',
        importe: '',
        estado: '',
        observaciones: ''
      });
      setSuccessMessage('Gasto inicial agregado exitosamente');
      setSnackbarOpen(true);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/contratos/gastos-iniciales/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['contrato', contratoId]);
      setSuccessMessage('Gasto inicial eliminado exitosamente');
      setSnackbarOpen(true);
    }
  });

  if (!contratoId) {
    return <Alert severity="info">Guarde el contrato primero para agregar gastos iniciales</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Gastos Iniciales</Typography>
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Agregar
        </Button>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tipo</TableCell>
              <TableCell>Importe</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Observaciones</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contrato?.gastosIniciales?.map((gasto) => (
              <TableRow key={gasto.id}>
                <TableCell>{getDescripcion(tipoGastoInicialMap, gasto.tipoGastoInicial)}</TableCell>
                <TableCell>
                  ${parseFloat(gasto.importe).toLocaleString('es-AR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </TableCell>
                <TableCell>{getDescripcion(estadoGastoMap, gasto.estado)}</TableCell>
                <TableCell>{gasto.observaciones || '-'}</TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (window.confirm('¿Eliminar este gasto?')) {
                        deleteMutation.mutate(gasto.id);
                      }
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Nuevo Gasto Inicial</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1, minWidth: 300 }}>
            <ParametroSelect
              categoriaCodigo="tipo_gasto_inicial"
              label="Tipo de Gasto"
              value={formData.tipoGastoInicial}
              onChange={(e) => setFormData({ ...formData, tipoGastoInicial: e.target.value })}
              required
            />
            <TextField
              label="Importe"
              type="number"
              fullWidth
              required
              value={formData.importe}
              onChange={(e) => setFormData({ ...formData, importe: e.target.value })}
              inputProps={{ step: '0.01', min: 0 }}
            />
            <ParametroSelect
              categoriaCodigo="estado_gasto"
              label="Estado"
              value={formData.estado}
              onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
            />
            <TextField
              label="Observaciones"
              multiline
              rows={3}
              fullWidth
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => {
              createMutation.mutate(formData);
            }}
            disabled={!formData.tipoGastoInicial || !formData.importe}
          >
            Agregar
          </Button>
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

// Componente de vista detallada
function ContratoDetalle({ contrato }) {
  // Mapas de parámetros para mostrar descripciones
  const tipoImpuestoMap = useParametrosMap('tipo_impuesto');
  const quienPagaMap = useParametrosMap('quien_paga');
  const monedaMap = useParametrosMap('moneda');
  const metodoAjusteMap = useParametrosMap('metodo_ajuste');
  const tipoUnidadMap = useParametrosMap('tipo_unidad');
  const estadoUnidadMap = useParametrosMap('estado_unidad');
  const tipoGarantiaMap = useParametrosMap('tipo_garantia');
  const estadoGarantiaMap = useParametrosMap('estado_garantia');
  const tipoGastoInicialMap = useParametrosMap('tipo_gasto_inicial');
  const estadoGastoMap = useParametrosMap('estado_gasto');

  if (!contrato) {
    return <Alert severity="info">Cargando información del contrato...</Alert>;
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
                Contrato {contrato.nroContrato || 'Sin número'}
                {contrato.unidad && (
                  <span style={{ fontWeight: 'normal', fontSize: '0.9em' }}>
                    {' - '}
                    {getDescripcion(tipoUnidadMap, contrato.unidad.tipo) || ''}
                    {contrato.unidad.direccion && ` ${contrato.unidad.direccion}`}
                    {contrato.unidad.codigoInterno && `, ${contrato.unidad.codigoInterno}`}
                    {contrato.unidad.localidad && `, ${contrato.unidad.localidad}`}
                    .
                  </span>
                )}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Primera fila: Contrato y Unidad */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, flex: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
                Datos del Contrato
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Inicio</Typography>
                  <Typography variant="body2">{formatoFecha(contrato.fechaInicio)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Fin</Typography>
                  <Typography variant="body2">{contrato.fechaFin ? formatoFecha(contrato.fechaFin) : 'Indefinido'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Monto</Typography>
                  <Typography variant="body2" fontWeight="medium" color="primary.main">
                    {formatoMoneda(contrato.montoInicial)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Moneda</Typography>
                  <Typography variant="body2">{getDescripcion(monedaMap, contrato.moneda)}</Typography>
                </Grid>
                {contrato.duracionMeses && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Duración</Typography>
                    <Typography variant="body2">{contrato.duracionMeses} meses</Typography>
                  </Grid>
                )}
                {contrato.metodoAjuste && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Ajuste</Typography>
                    <Typography variant="body2">{getDescripcion(metodoAjusteMap, contrato.metodoAjuste)}</Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Chip 
                    label={contrato.registradoAfip ? 'Registrado AFIP' : 'No registrado'} 
                    size="small"
                    color={contrato.registradoAfip ? 'success' : 'default'}
                    sx={{ mt: 0.5 }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, flex: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
                Inquilino
              </Typography>
              {contrato.inquilino ? (
                <>
                  <Typography variant="body2" fontWeight="medium" gutterBottom>
                    {contrato.inquilino.razonSocial || 
                     `${contrato.inquilino.nombre} ${contrato.inquilino.apellido}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {contrato.inquilino.dni && `DNI: ${contrato.inquilino.dni}`}
                    {contrato.inquilino.dni && contrato.inquilino.cuit && ' • '}
                    {contrato.inquilino.cuit && `CUIT: ${contrato.inquilino.cuit}`}
                  </Typography>
                  {contrato.inquilino.email && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      {contrato.inquilino.email}
                    </Typography>
                  )}
                  {contrato.inquilino.telefono && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {contrato.inquilino.telefono}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">Sin inquilino</Typography>
              )}
              
              {contrato.unidad?.propietario && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
                    Propietario
                  </Typography>
                  <Typography variant="body2" fontWeight="medium" gutterBottom>
                    {contrato.unidad.propietario.razonSocial || 
                     `${contrato.unidad.propietario.nombre} ${contrato.unidad.propietario.apellido}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {contrato.unidad.propietario.dni && `DNI: ${contrato.unidad.propietario.dni}`}
                    {contrato.unidad.propietario.dni && contrato.unidad.propietario.cuit && ' • '}
                    {contrato.unidad.propietario.cuit && `CUIT: ${contrato.unidad.propietario.cuit}`}
                  </Typography>
                  {contrato.unidad.propietario.email && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      {contrato.unidad.propietario.email}
                    </Typography>
                  )}
                  {contrato.unidad.propietario.telefono && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {contrato.unidad.propietario.telefono}
                    </Typography>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Responsabilidades, Garantías y Gastos en una fila */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, flex: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
                Responsabilidades
              </Typography>
              {contrato.responsabilidades && contrato.responsabilidades.length > 0 ? (
                <TableContainer>
                  <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.75rem' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="none"><strong>Impuesto</strong></TableCell>
                        <TableCell padding="none"><strong>Paga</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {contrato.responsabilidades.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell padding="none">{getAbreviatura(tipoImpuestoMap, r.tipoCargo)}</TableCell>
                          <TableCell padding="none">{getDescripcion(quienPagaMap, r.quienPaga)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="caption" color="text.secondary">Sin responsabilidades</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, flex: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
                Garantías
              </Typography>
              {contrato.garantias && contrato.garantias.length > 0 ? (
                <TableContainer>
                  <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.75rem' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="none"><strong>Tipo</strong></TableCell>
                        <TableCell padding="none"><strong>Estado</strong></TableCell>
                        <TableCell padding="none"><strong>Garante</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {contrato.garantias.map((g) => (
                        <TableRow key={g.id}>
                          <TableCell padding="none">{getDescripcion(tipoGarantiaMap, g.tipoGarantia)}</TableCell>
                          <TableCell padding="none">
                            <Chip 
                              label={getDescripcion(estadoGarantiaMap, g.estadoGarantia)} 
                              size="small"
                              sx={{ height: '20px', fontSize: '0.7rem' }}
                            />
                          </TableCell>
                          <TableCell padding="none">{g.nombre} {g.apellido}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="caption" color="text.secondary">Sin garantías</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, flex: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
                Gastos Iniciales
              </Typography>
              {contrato.gastosIniciales && contrato.gastosIniciales.length > 0 ? (
                <TableContainer>
                  <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.75rem' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="none"><strong>Tipo</strong></TableCell>
                        <TableCell padding="none"><strong>Importe</strong></TableCell>
                        <TableCell padding="none"><strong>Estado</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {contrato.gastosIniciales.map((g) => (
                        <TableRow key={g.id}>
                          <TableCell padding="none">{getDescripcion(tipoGastoInicialMap, g.tipoGastoInicial)}</TableCell>
                          <TableCell padding="none">{formatoMoneda(g.importe)}</TableCell>
                          <TableCell padding="none">
                            <Chip 
                              label={getDescripcion(estadoGastoMap, g.estado)} 
                              size="small"
                              sx={{ height: '20px', fontSize: '0.7rem' }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="caption" color="text.secondary">Sin gastos iniciales</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
