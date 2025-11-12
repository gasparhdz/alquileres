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
  Snackbar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import BadgeIcon from '@mui/icons-material/Badge';
import HomeIcon from '@mui/icons-material/Home';
import api from '../api';
import ParametroSelect from '../components/ParametroSelect';

export default function Propietarios() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    cuit: '',
    mail: '',
    telefono: '',
    direccion: '',
    localidad: '',
    condicionIva: ''
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['propietarios'],
    queryFn: async () => {
      const response = await api.get('/propietarios');
      return response.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/propietarios', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['propietarios']);
      setOpen(false);
      resetForm();
      setSuccessMessage('Propietario creado exitosamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al crear el propietario');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/propietarios/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['propietarios']);
      setOpen(false);
      resetForm();
      setSuccessMessage('Propietario actualizado exitosamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al actualizar el propietario');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/propietarios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['propietarios']);
      setSuccessMessage('Propietario eliminado exitosamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al eliminar el propietario');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const resetForm = () => {
    setFormData({
      nombre: '',
      apellido: '',
      dni: '',
      cuit: '',
      mail: '',
      telefono: '',
      direccion: '',
      localidad: '',
      condicionIva: ''
    });
    setErrors({});
    setEditing(null);
  };

  const checkDniCuitExists = async (dni, cuit) => {
    try {
      // Obtener todos los propietarios para verificar duplicados
      const response = await api.get('/propietarios?limit=1000');
      const propietarios = response.data?.data || [];

      // Buscar por DNI si existe
      if (dni) {
        const existeDni = propietarios.find(
          (prop) => prop.dni === dni && (!editing || prop.id !== editing.id)
        );
        if (existeDni) {
          return { field: 'dni', message: 'Este DNI ya está registrado en el sistema' };
        }
      }

      // Buscar por CUIT si existe
      if (cuit) {
        const cuitSinGuiones = cuit.replace(/\D/g, '');
        const existeCuit = propietarios.find((prop) => {
          const propCuitSinGuiones = prop.cuit?.replace(/\D/g, '') || '';
          return (
            propCuitSinGuiones === cuitSinGuiones &&
            (!editing || prop.id !== editing.id)
          );
        });
        if (existeCuit) {
          return { field: 'cuit', message: 'Este CUIT ya está registrado en el sistema' };
        }
      }

      return null;
    } catch (error) {
      console.error('Error al verificar DNI/CUIT:', error);
      return null;
    }
  };

  const validateForm = async () => {
    const newErrors = {};

    // Validar nombre obligatorio
    if (!formData.nombre || formData.nombre.trim() === '') {
      newErrors.nombre = 'El nombre es obligatorio';
    }

    // Validar DNI o CUIT obligatorio (al menos uno)
    const dniSinGuiones = formData.dni.replace(/\D/g, '');
    const cuitSinGuiones = formData.cuit.replace(/\D/g, '');

    if (!dniSinGuiones && !cuitSinGuiones) {
      newErrors.dniCuit = 'Debe ingresar DNI o CUIT';
    }

    // Validar formato DNI (si se ingresa, debe tener 7 u 8 dígitos)
    if (dniSinGuiones && (dniSinGuiones.length < 7 || dniSinGuiones.length > 8)) {
      newErrors.dni = 'El DNI debe tener entre 7 y 8 dígitos';
    }

    // Validar formato CUIT (si se ingresa, debe tener 11 dígitos)
    if (cuitSinGuiones) {
      if (cuitSinGuiones.length !== 11) {
        newErrors.cuit = 'El CUIT debe tener 11 dígitos (formato: XX-XXXXXXXX-X)';
      } else {
        // Validar formato CUIT: XX-XXXXXXXX-X
        const cuitFormato = /^\d{2}-\d{8}-\d{1}$/;
        if (!cuitFormato.test(formData.cuit)) {
          newErrors.cuit = 'Formato de CUIT inválido. Use: XX-XXXXXXXX-X';
        }
      }
    }

    // Validar formato email (si se ingresa)
    if (formData.mail && formData.mail.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.mail)) {
        newErrors.mail = 'Formato de email inválido';
      }
    }

    // Validar teléfono solo números (si se ingresa)
    if (formData.telefono && formData.telefono.trim() !== '') {
      const telefonoRegex = /^\d+$/;
      if (!telefonoRegex.test(formData.telefono)) {
        newErrors.telefono = 'El teléfono solo debe contener números';
      }
    }

    // Si hay errores de formato, mostrar esos primero
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    // Verificar si DNI o CUIT ya existen en el sistema
    const duplicado = await checkDniCuitExists(
      dniSinGuiones || null,
      cuitSinGuiones || null
    );

    if (duplicado) {
      newErrors[duplicado.field] = duplicado.message;
      setErrors(newErrors);
      return false;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleOpen = () => {
    resetForm();
    setOpen(true);
  };

  const handleEdit = (propietario) => {
    setEditing(propietario);
    // Limpiar datos para el formulario, excluyendo relaciones
    setFormData({
      nombre: propietario.nombre || '',
      apellido: propietario.apellido || '',
      dni: propietario.dni || '',
      cuit: propietario.cuit || '',
      mail: propietario.mail || '',
      telefono: propietario.telefono || '',
      direccion: propietario.direccion || '',
      localidad: propietario.localidad || '',
      condicionIva: propietario.condicionIva || ''
    });
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar formulario antes de enviar
    const isValid = await validateForm();
    if (!isValid) {
      return;
    }

    // Preparar datos para enviar, excluyendo campos vacíos opcionales
    const dataToSend = {
      nombre: formData.nombre.trim(),
      apellido: formData.apellido?.trim() || null,
      dni: formData.dni?.trim() || null,
      cuit: formData.cuit?.trim() || null,
      mail: formData.mail?.trim() || null,
      telefono: formData.telefono?.trim() || null,
      direccion: formData.direccion?.trim() || null,
      localidad: formData.localidad?.trim() || null,
      condicionIva: formData.condicionIva?.trim() || null
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: dataToSend });
    } else {
      createMutation.mutate(dataToSend);
    }
  };

  if (isLoading) return <div>Cargando...</div>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Propietarios</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}>
          Nuevo Propietario
        </Button>
      </Box>

      {/* Vista de tabla para desktop */}
      <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nombre/Apellido</TableCell>
              <TableCell>DNI</TableCell>
              <TableCell>CUIT</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Propiedades</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.data?.map((propietario) => (
              <TableRow key={propietario.id}>
                <TableCell>
                  {propietario.nombre} {propietario.apellido}
                </TableCell>
                <TableCell>{propietario.dni || '-'}</TableCell>
                <TableCell>{propietario.cuit || '-'}</TableCell>
                <TableCell>{propietario.mail || '-'}</TableCell>
                <TableCell>{propietario.unidades?.length || 0}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleEdit(propietario)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (window.confirm('¿Está seguro de eliminar este propietario?')) {
                        deleteMutation.mutate(propietario.id);
                      }
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Vista de cards para mobile */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <Grid container spacing={2}>
          {data?.data?.map((propietario) => (
            <Grid item xs={12} key={propietario.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        {propietario.nombre} {propietario.apellido}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={() => handleEdit(propietario)} sx={{ mr: 0.5 }}>
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (window.confirm('¿Está seguro de eliminar este propietario?')) {
                            deleteMutation.mutate(propietario.id);
                          }
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {propietario.dni && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BadgeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>DNI:</strong> {propietario.dni}
                        </Typography>
                      </Box>
                    )}
                    {propietario.cuit && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BadgeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>CUIT:</strong> {propietario.cuit}
                        </Typography>
                      </Box>
                    )}
                    {propietario.mail && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>Email:</strong> {propietario.mail}
                        </Typography>
                      </Box>
                    )}
                    {propietario.telefono && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>Teléfono:</strong> {propietario.telefono}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <HomeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        <strong>Propiedades:</strong> {propietario.unidades?.length || 0}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit} noValidate>
          <DialogTitle>
            {editing ? 'Editar Propietario' : 'Nuevo Propietario'}
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
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Nombre *"
                    fullWidth
                    value={formData.nombre}
                    onChange={(e) => {
                      setFormData({ ...formData, nombre: e.target.value });
                      if (errors.nombre) {
                        setErrors({ ...errors, nombre: '' });
                      }
                    }}
                    error={!!errors.nombre}
                    helperText={errors.nombre}
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
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="DNI *"
                    type="text"
                    fullWidth
                    size="small"
                    value={formData.dni}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').substring(0, 8);
                      setFormData({ ...formData, dni: value });
                      if (errors.dni || errors.dniCuit) {
                        const newErrors = { ...errors };
                        delete newErrors.dni;
                        delete newErrors.dniCuit;
                        setErrors(newErrors);
                      }
                    }}
                    inputProps={{ maxLength: 8 }}
                    error={!!errors.dni || !!errors.dniCuit}
                    helperText={errors.dni || (errors.dniCuit && !formData.cuit ? errors.dniCuit : '')}
                    placeholder="Al menos DNI o CUIT requerido"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="CUIT *"
                    type="text"
                    fullWidth
                    size="small"
                    value={formData.cuit}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, '');
                      if (value.length > 2) value = value.substring(0, 2) + '-' + value.substring(2);
                      if (value.length > 11) value = value.substring(0, 11) + '-' + value.substring(11);
                      value = value.substring(0, 13);
                      setFormData({ ...formData, cuit: value });
                      if (errors.cuit || errors.dniCuit) {
                        const newErrors = { ...errors };
                        delete newErrors.cuit;
                        delete newErrors.dniCuit;
                        setErrors(newErrors);
                      }
                    }}
                    placeholder="XX-XXXXXXXX-X"
                    error={!!errors.cuit || !!errors.dniCuit}
                    helperText={errors.cuit || (errors.dniCuit && !formData.dni ? errors.dniCuit : '')}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <ParametroSelect
                    categoriaCodigo="condicion_iva"
                    label="Condición IVA"
                    value={formData.condicionIva}
                    onChange={(e) => setFormData({ ...formData, condicionIva: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Email"
                    type="text"
                    fullWidth
                    value={formData.mail}
                    onChange={(e) => {
                      setFormData({ ...formData, mail: e.target.value });
                      if (errors.mail) {
                        setErrors({ ...errors, mail: '' });
                      }
                    }}
                    error={!!errors.mail}
                    helperText={errors.mail || ''}
                    inputProps={{
                      autoComplete: 'email'
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Teléfono"
                    type="tel"
                    fullWidth
                    value={formData.telefono}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, telefono: value });
                      if (errors.telefono) {
                        setErrors({ ...errors, telefono: '' });
                      }
                    }}
                    placeholder="Solo números"
                    error={!!errors.telefono}
                    helperText={errors.telefono || ''}
                  />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField
                    label="Dirección"
                    fullWidth
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Localidad"
                    fullWidth
                    value={formData.localidad}
                    onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained">
              {editing ? 'Actualizar' : 'Crear'}
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
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity} 
          sx={{ width: '100%' }}
        >
          {snackbarSeverity === 'success' ? successMessage : errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

