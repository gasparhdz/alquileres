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
  Card,
  CardContent,
  Divider,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HomeIcon from '@mui/icons-material/Home';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import api from '../api';
import ParametroSelect from '../components/ParametroSelect';
import { useParametrosMap, getDescripcion } from '../utils/parametros';

export default function CuentasTributarias() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    unidadId: '',
    tipoImpuesto: '',
    codigo1: '',
    codigo2: '',
    periodicidad: '',
    usuarioEmail: '',
    password: '',
    observaciones: ''
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const queryClient = useQueryClient();

  // Mapas de parámetros para mostrar descripciones
  const tipoImpuestoMap = useParametrosMap('tipo_impuesto');
  const periodicidadMap = useParametrosMap('periodicidad');

  const { data, isLoading } = useQuery({
    queryKey: ['cuentasTributarias'],
    queryFn: async () => {
      const response = await api.get('/cuentas-tributarias');
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

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/cuentas-tributarias', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['cuentasTributarias']);
      setOpen(false);
      resetForm();
      setSuccessMessage('Cuenta tributaria creada exitosamente');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      console.error('Error al crear cuenta tributaria:', error);
      alert(error.response?.data?.error || 'Error al crear cuenta tributaria');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/cuentas-tributarias/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['cuentasTributarias']);
      setOpen(false);
      resetForm();
      setSuccessMessage('Cuenta tributaria actualizada exitosamente');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      console.error('Error al actualizar cuenta tributaria:', error);
      alert(error.response?.data?.error || 'Error al actualizar cuenta tributaria');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/cuentas-tributarias/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['cuentasTributarias']);
      setSuccessMessage('Cuenta tributaria eliminada exitosamente');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      console.error('Error al eliminar cuenta tributaria:', error);
      alert(error.response?.data?.error || 'Error al eliminar cuenta tributaria');
    }
  });

  const resetForm = () => {
    setFormData({
      unidadId: '',
      tipoImpuesto: '',
      codigo1: '',
      codigo2: '',
      periodicidad: '',
      usuarioEmail: '',
      password: '',
      observaciones: ''
    });
    setEditing(null);
  };

  const handleOpen = () => {
    resetForm();
    setOpen(true);
  };

  const handleEdit = (cuenta) => {
    setEditing(cuenta.id);
    setFormData({
      unidadId: cuenta.unidadId,
      tipoImpuesto: cuenta.tipoImpuesto || '',
      codigo1: cuenta.codigo1 || '',
      codigo2: cuenta.codigo2 || '',
      periodicidad: cuenta.periodicidad || '',
      usuarioEmail: cuenta.usuarioEmail || cuenta.usuarioPortal || '',
      password: cuenta.password || '',
      observaciones: cuenta.observaciones || ''
    });
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const dataToSend = {
      unidadId: formData.unidadId,
      tipoImpuesto: formData.tipoImpuesto,
      codigo1: formData.codigo1?.trim() || null,
      codigo2: formData.codigo2?.trim() || null,
      periodicidad: formData.periodicidad || null,
      usuarioEmail: formData.usuarioEmail?.trim() || null,
      password: formData.password?.trim() || null,
      observaciones: formData.observaciones?.trim() || null
    };

    if (editing) {
      updateMutation.mutate({ id: editing, data: dataToSend });
    } else {
      createMutation.mutate(dataToSend);
    }
  };


  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Cuentas Tributarias</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}>
          Nueva Cuenta Tributaria
        </Button>
      </Box>

      {/* Vista de tabla para desktop */}
      <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Unidad</TableCell>
              <TableCell>Propietario</TableCell>
              <TableCell>Tipo Impuesto</TableCell>
              <TableCell>Código 1</TableCell>
              <TableCell>Código 2</TableCell>
              <TableCell>Periodicidad</TableCell>
              <TableCell>Usuario</TableCell>
              <TableCell>Contraseña</TableCell>
              <TableCell>Observaciones</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.data?.map((cuenta) => (
              <TableRow key={cuenta.id}>
                <TableCell>
                  {cuenta.unidad?.direccion}, {cuenta.unidad?.localidad}
                </TableCell>
                <TableCell>
                  {cuenta.unidad?.propietario?.razonSocial ||
                    `${cuenta.unidad?.propietario?.nombre || ''} ${cuenta.unidad?.propietario?.apellido || ''}`.trim() || '-'}
                </TableCell>
                <TableCell>{getDescripcion(tipoImpuestoMap, cuenta.tipoImpuesto)}</TableCell>
                <TableCell>{cuenta.codigo1 || '-'}</TableCell>
                <TableCell>{cuenta.codigo2 || '-'}</TableCell>
                <TableCell>{getDescripcion(periodicidadMap, cuenta.periodicidad)}</TableCell>
                <TableCell>{cuenta.usuarioEmail || cuenta.usuarioPortal || '-'}</TableCell>
                <TableCell>{cuenta.password ? '••••••••' : '-'}</TableCell>
                <TableCell>{cuenta.observaciones || '-'}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleEdit(cuenta)} title="Editar">
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => {
                      if (window.confirm('¿Está seguro de eliminar esta cuenta tributaria?')) {
                        deleteMutation.mutate(cuenta.id);
                      }
                    }}
                    title="Eliminar"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {(!data?.data || data.data.length === 0) && (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Typography color="text.secondary">No hay cuentas tributarias registradas</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Vista de cards para mobile */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <Grid container spacing={2}>
          {data?.data?.map((cuenta) => (
            <Grid item xs={12} key={cuenta.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        {getDescripcion(tipoImpuestoMap, cuenta.tipoImpuesto)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {cuenta.unidad?.direccion}, {cuenta.unidad?.localidad}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={() => handleEdit(cuenta)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          if (window.confirm('¿Está seguro de eliminar esta cuenta tributaria?')) {
                            deleteMutation.mutate(cuenta.id);
                          }
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {cuenta.unidad?.propietario && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccountBalanceIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          <strong>Propietario:</strong>{' '}
                          {cuenta.unidad.propietario.razonSocial ||
                            `${cuenta.unidad.propietario.nombre || ''} ${cuenta.unidad.propietario.apellido || ''}`.trim() || '-'}
                        </Typography>
                      </Box>
                    )}
                    {cuenta.codigo1 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          <strong>Código 1:</strong> {cuenta.codigo1}
                        </Typography>
                      </Box>
                    )}
                    {cuenta.codigo2 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          <strong>Código 2:</strong> {cuenta.codigo2}
                        </Typography>
                      </Box>
                    )}
                    {cuenta.periodicidad && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarTodayIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          <strong>Periodicidad:</strong> {getDescripcion(periodicidadMap, cuenta.periodicidad)}
                        </Typography>
                      </Box>
                    )}
                    {(cuenta.usuarioEmail || cuenta.usuarioPortal) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          <strong>Usuario:</strong> {cuenta.usuarioEmail || cuenta.usuarioPortal}
                        </Typography>
                      </Box>
                    )}
                    {cuenta.password && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          <strong>Contraseña:</strong> ••••••••
                        </Typography>
                      </Box>
                    )}
                    {cuenta.observaciones && (
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mt: 1 }}>
                        <Typography variant="body2">
                          <strong>Observaciones:</strong> {cuenta.observaciones}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {(!data?.data || data.data.length === 0) && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" align="center">
                    No hay cuentas tributarias registradas
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Box>

      {/* Dialog de creación/edición */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editing ? 'Editar Cuenta Tributaria' : 'Nueva Cuenta Tributaria'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControl fullWidth required size="small">
                  <InputLabel>Propiedad</InputLabel>
                  <Select
                    value={formData.unidadId}
                    onChange={(e) => setFormData({ ...formData, unidadId: e.target.value })}
                    label="Propiedad"
                  >
                    {unidades?.data?.map((unidad) => (
                      <MenuItem key={unidad.id} value={unidad.id}>
                        {unidad.direccion}, {unidad.localidad} - {unidad.propietario?.razonSocial ||
                          `${unidad.propietario?.nombre || ''} ${unidad.propietario?.apellido || ''}`.trim() || 'Sin propietario'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <ParametroSelect
                  categoriaCodigo="tipo_impuesto"
                  label="Tipo de Impuesto"
                  value={formData.tipoImpuesto}
                  onChange={(e) => setFormData({ ...formData, tipoImpuesto: e.target.value })}
                  required
                  mostrarAbreviatura={true}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <ParametroSelect
                  categoriaCodigo="periodicidad"
                  label="Periodicidad"
                  value={formData.periodicidad}
                  onChange={(e) => setFormData({ ...formData, periodicidad: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Código 1"
                  fullWidth
                  size="small"
                  value={formData.codigo1}
                  onChange={(e) => setFormData({ ...formData, codigo1: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Código 2"
                  fullWidth
                  size="small"
                  value={formData.codigo2}
                  onChange={(e) => setFormData({ ...formData, codigo2: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Usuario (Email/Portal)"
                  fullWidth
                  size="small"
                  value={formData.usuarioEmail}
                  onChange={(e) => setFormData({ ...formData, usuarioEmail: e.target.value })}
                  placeholder="Usuario de la oficina virtual"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Contraseña"
                  fullWidth
                  size="small"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Contraseña de la oficina virtual"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Observaciones"
                  fullWidth
                  multiline
                  rows={3}
                  size="small"
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isLoading || updateMutation.isLoading}>
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
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

