import { useState, useEffect } from 'react';
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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormHelperText
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import BadgeIcon from '@mui/icons-material/Badge';
import api from '../api';

export default function Inquilinos() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    tipoPersonaId: '',
    nombre: '',
    apellido: '',
    razonSocial: '',
    dni: '',
    cuit: '',
    mail: '',
    telefono: '',
    dirCalle: '',
    dirNro: '',
    dirPiso: '',
    dirDepto: '',
    provinciaId: '',
    localidadId: '',
    condicionIvaId: ''
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['inquilinos'],
    queryFn: async () => {
      const response = await api.get('/inquilinos');
      return response.data;
    }
  });

  // Obtener catálogos
  const { data: tiposPersona } = useQuery({
    queryKey: ['tiposPersona'],
    queryFn: async () => {
      const response = await api.get('/catalogos/tipos-persona');
      return response.data;
    }
  });

  const { data: provincias } = useQuery({
    queryKey: ['provincias'],
    queryFn: async () => {
      const response = await api.get('/catalogos/provincias');
      return response.data;
    }
  });

  const { data: localidades } = useQuery({
    queryKey: ['localidades', formData.provinciaId],
    queryFn: async () => {
      if (!formData.provinciaId) return [];
      const response = await api.get(`/catalogos/provincias/${formData.provinciaId}/localidades`);
      return response.data;
    },
    enabled: !!formData.provinciaId
  });

  const { data: condicionesIva } = useQuery({
    queryKey: ['condicionesIva'],
    queryFn: async () => {
      const response = await api.get('/catalogos/condiciones-iva');
      return response.data;
    }
  });

  // Preseleccionar Persona Física por defecto
  useEffect(() => {
    if (tiposPersona && tiposPersona.length > 0 && !formData.tipoPersonaId && !editing) {
      const personaFisica = tiposPersona.find(tp => tp.codigo === 'FISICA');
      if (personaFisica) {
        setFormData(prev => ({ ...prev, tipoPersonaId: personaFisica.id.toString() }));
      }
    }
  }, [tiposPersona]);

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/inquilinos', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['inquilinos']);
      setOpen(false);
      resetForm();
      setSuccessMessage('Inquilino creado exitosamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al crear el inquilino');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/inquilinos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['inquilinos']);
      setOpen(false);
      resetForm();
      setSuccessMessage('Inquilino actualizado exitosamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al actualizar el inquilino');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/inquilinos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['inquilinos']);
      setSuccessMessage('Inquilino eliminado exitosamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al eliminar el inquilino');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const resetForm = () => {
    const personaFisica = tiposPersona?.find(tp => tp.codigo === 'FISICA');
    setFormData({
      tipoPersonaId: personaFisica?.id.toString() || '',
      nombre: '',
      apellido: '',
      razonSocial: '',
      dni: '',
      cuit: '',
      mail: '',
      telefono: '',
      dirCalle: '',
      dirNro: '',
      dirPiso: '',
      dirDepto: '',
      provinciaId: '',
      localidadId: '',
      condicionIvaId: ''
    });
    setErrors({});
    setEditing(null);
  };

  const checkDniCuitExists = async (dni, cuit) => {
    try {
      // Obtener todos los inquilinos para verificar duplicados
      const response = await api.get('/inquilinos?limit=1000');
      const inquilinos = response.data?.data || [];

      // Buscar por DNI si existe
      if (dni) {
        const existeDni = inquilinos.find(
          (inq) => inq.dni === dni && (!editing || inq.id !== editing.id)
        );
        if (existeDni) {
          return { field: 'dni', message: 'Este DNI ya está registrado en el sistema' };
        }
      }

      // Buscar por CUIT si existe
      if (cuit) {
        const cuitSinGuiones = cuit.replace(/\D/g, '');
        const existeCuit = inquilinos.find((inq) => {
          const inqCuitSinGuiones = inq.cuit?.replace(/\D/g, '') || '';
          return (
            inqCuitSinGuiones === cuitSinGuiones &&
            (!editing || inq.id !== editing.id)
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

    // Validar tipo de persona
    if (!formData.tipoPersonaId) {
      newErrors.tipoPersonaId = 'El tipo de persona es obligatorio';
    }

    const tipoPersona = tiposPersona?.find(tp => tp.id === parseInt(formData.tipoPersonaId));
    const personaFisicaId = tiposPersona?.find(tp => tp.codigo === 'FISICA')?.id;
    const esFisica = personaFisicaId != null && tipoPersona?.id === personaFisicaId;

    // Validar campos según tipo de persona
    if (esFisica) {
      if (!formData.nombre || formData.nombre.trim() === '') {
        newErrors.nombre = 'El nombre es obligatorio para persona física';
      }
    } else {
      if (!formData.razonSocial || formData.razonSocial.trim() === '') {
        newErrors.razonSocial = 'La razón social es obligatoria para persona jurídica';
      }
    }

    // Validar DNI o CUIT obligatorio (al menos uno)
    const dniSinGuiones = formData.dni?.replace(/\D/g, '') || '';
    const cuitSinGuiones = formData.cuit?.replace(/\D/g, '') || '';

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

  const handleEdit = (inquilino) => {
    setEditing(inquilino);
    setFormData({
      tipoPersonaId: inquilino.tipoPersonaId || '',
      nombre: inquilino.nombre || '',
      apellido: inquilino.apellido || '',
      razonSocial: inquilino.razonSocial || '',
      dni: inquilino.dni || '',
      cuit: inquilino.cuit || '',
      mail: inquilino.mail || '',
      telefono: inquilino.telefono || '',
      dirCalle: inquilino.dirCalle || '',
      dirNro: inquilino.dirNro || '',
      dirPiso: inquilino.dirPiso || '',
      dirDepto: inquilino.dirDepto || '',
      provinciaId: inquilino.provinciaId || '',
      localidadId: inquilino.localidadId || '',
      condicionIvaId: inquilino.condicionIvaId || ''
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

    // Preparar datos para enviar (convertir strings vacíos a null y IDs a números)
    const dataToSend = {
      tipoPersonaId: formData.tipoPersonaId ? parseInt(formData.tipoPersonaId) : null,
      nombre: formData.nombre?.trim() || null,
      apellido: formData.apellido?.trim() || null,
      razonSocial: formData.razonSocial?.trim() || null,
      dni: formData.dni?.trim() || null,
      cuit: formData.cuit?.trim() || null,
      mail: formData.mail?.trim() || null,
      telefono: formData.telefono?.trim() || null,
      dirCalle: formData.dirCalle?.trim() || null,
      dirNro: formData.dirNro?.trim() || null,
      dirPiso: formData.dirPiso?.trim() || null,
      dirDepto: formData.dirDepto?.trim() || null,
      provinciaId: formData.provinciaId ? parseInt(formData.provinciaId) : null,
      localidadId: formData.localidadId ? parseInt(formData.localidadId) : null,
      condicionIvaId: formData.condicionIvaId ? parseInt(formData.condicionIvaId) : null
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: dataToSend });
    } else {
      createMutation.mutate(dataToSend);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Inquilinos</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}>
          Nuevo Inquilino
        </Button>
      </Box>

      {/* Vista de tabla para desktop */}
      <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Nombre/Apellido</TableCell>
              <TableCell>DNI</TableCell>
              <TableCell>CUIT</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Teléfono</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.data?.map((inquilino) => (
              <TableRow key={inquilino.id}>
                <TableCell>
                  {inquilino.razonSocial || `${inquilino.nombre || ''} ${inquilino.apellido || ''}`.trim() || '-'}
                </TableCell>
                <TableCell>{inquilino.dni || '-'}</TableCell>
                <TableCell>{inquilino.cuit || '-'}</TableCell>
                <TableCell>{inquilino.mail || '-'}</TableCell>
                <TableCell>{inquilino.telefono || '-'}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleEdit(inquilino)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => {
                      if (window.confirm('¿Está seguro de eliminar este inquilino?')) {
                        deleteMutation.mutate(inquilino.id);
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
          {data?.data?.map((inquilino) => (
            <Grid item xs={12} key={inquilino.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        {inquilino.razonSocial || `${inquilino.nombre || ''} ${inquilino.apellido || ''}`.trim() || 'Sin nombre'}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={() => handleEdit(inquilino)} sx={{ mr: 0.5 }}>
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          if (window.confirm('¿Está seguro de eliminar este inquilino?')) {
                            deleteMutation.mutate(inquilino.id);
                          }
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {inquilino.dni && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BadgeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>DNI:</strong> {inquilino.dni}
                        </Typography>
                      </Box>
                    )}
                    {inquilino.cuit && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BadgeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>CUIT:</strong> {inquilino.cuit}
                        </Typography>
                      </Box>
                    )}
                    {inquilino.mail && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>Email:</strong> {inquilino.mail}
                        </Typography>
                      </Box>
                    )}
                    {inquilino.telefono && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>Teléfono:</strong> {inquilino.telefono}
                        </Typography>
                      </Box>
                    )}
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
            {editing ? 'Editar Inquilino' : 'Nuevo Inquilino'}
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
                {(() => {
                  const tipoPersona = tiposPersona?.find(tp => tp.id === parseInt(formData.tipoPersonaId));
                  const personaFisicaId = tiposPersona?.find(tp => tp.codigo === 'FISICA')?.id;
                  const esFisica = personaFisicaId != null && tipoPersona?.id === personaFisicaId;

                  if (esFisica) {
                    // Persona Física
                    return (
                      <>
                        {/* Línea 1: tipo persona, nombre, apellido */}
                        <Grid item xs={12} sm={4}>
                          <FormControl fullWidth error={!!errors.tipoPersonaId} size="small">
                            <InputLabel>Tipo de Persona *</InputLabel>
                            <Select
                              value={formData.tipoPersonaId}
                              label="Tipo de Persona *"
                              onChange={(e) => {
                                const nuevoTipoId = e.target.value;
                                
                                // Limpiar TODOS los campos excepto el tipo de persona
                                setFormData({ 
                                  tipoPersonaId: nuevoTipoId,
                                  nombre: '',
                                  apellido: '',
                                  razonSocial: '',
                                  dni: '',
                                  cuit: '',
                                  mail: '',
                                  telefono: '',
                                  dirCalle: '',
                                  dirNro: '',
                                  dirPiso: '',
                                  dirDepto: '',
                                  provinciaId: '',
                                  localidadId: '',
                                  condicionIvaId: ''
                                });
                                
                                // Limpiar todos los errores
                                setErrors({});
                              }}
                            >
                              {tiposPersona?.map((tipo) => (
                                <MenuItem key={tipo.id} value={tipo.id}>
                                  {tipo.nombre}
                                </MenuItem>
                              ))}
                            </Select>
                            {errors.tipoPersonaId && <FormHelperText>{errors.tipoPersonaId}</FormHelperText>}
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Nombre *"
                            fullWidth
                            size="small"
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
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Apellido"
                            fullWidth
                            size="small"
                            value={formData.apellido}
                            onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                          />
                        </Grid>
                        {/* Línea 2: DNI, CUIT, email, teléfono */}
                        <Grid item xs={12} sm={3}>
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
                        <Grid item xs={12} sm={3}>
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
                        <Grid item xs={12} sm={3}>
                          <TextField
                            label="Email"
                            type="email"
                            fullWidth
                            size="small"
                            value={formData.mail}
                            onChange={(e) => {
                              setFormData({ ...formData, mail: e.target.value });
                              if (errors.mail) {
                                setErrors({ ...errors, mail: '' });
                              }
                            }}
                            error={!!errors.mail}
                            helperText={errors.mail || ''}
                            inputProps={{ autoComplete: 'email' }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField
                            label="Teléfono"
                            type="tel"
                            fullWidth
                            size="small"
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
                      </>
                    );
                  } else if (formData.tipoPersonaId) {
                    // Persona Jurídica
                    return (
                      <>
                        {/* Línea 1: tipo persona, razón social */}
                        <Grid item xs={12} sm={4}>
                          <FormControl fullWidth error={!!errors.tipoPersonaId} size="small">
                            <InputLabel>Tipo de Persona *</InputLabel>
                            <Select
                              value={formData.tipoPersonaId}
                              label="Tipo de Persona *"
                              onChange={(e) => {
                                const nuevoTipoId = e.target.value;
                                
                                // Limpiar TODOS los campos excepto el tipo de persona
                                setFormData({ 
                                  tipoPersonaId: nuevoTipoId,
                                  nombre: '',
                                  apellido: '',
                                  razonSocial: '',
                                  dni: '',
                                  cuit: '',
                                  mail: '',
                                  telefono: '',
                                  dirCalle: '',
                                  dirNro: '',
                                  dirPiso: '',
                                  dirDepto: '',
                                  provinciaId: '',
                                  localidadId: '',
                                  condicionIvaId: ''
                                });
                                
                                // Limpiar todos los errores
                                setErrors({});
                              }}
                            >
                              {tiposPersona?.map((tipo) => (
                                <MenuItem key={tipo.id} value={tipo.id}>
                                  {tipo.nombre}
                                </MenuItem>
                              ))}
                            </Select>
                            {errors.tipoPersonaId && <FormHelperText>{errors.tipoPersonaId}</FormHelperText>}
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={8}>
                          <TextField
                            label="Razón Social *"
                            fullWidth
                            size="small"
                            value={formData.razonSocial}
                            onChange={(e) => {
                              setFormData({ ...formData, razonSocial: e.target.value });
                              if (errors.razonSocial) {
                                setErrors({ ...errors, razonSocial: '' });
                              }
                            }}
                            error={!!errors.razonSocial}
                            helperText={errors.razonSocial}
                          />
                        </Grid>
                        {/* Línea 2: CUIT, email, teléfono */}
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
                            helperText={errors.cuit || errors.dniCuit || ''}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Email"
                            type="email"
                            fullWidth
                            size="small"
                            value={formData.mail}
                            onChange={(e) => {
                              setFormData({ ...formData, mail: e.target.value });
                              if (errors.mail) {
                                setErrors({ ...errors, mail: '' });
                              }
                            }}
                            error={!!errors.mail}
                            helperText={errors.mail || ''}
                            inputProps={{ autoComplete: 'email' }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Teléfono"
                            type="tel"
                            fullWidth
                            size="small"
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
                      </>
                    );
                  } else {
                    // Sin tipo de persona seleccionado
                    return (
                      <Grid item xs={12}>
                        <FormControl fullWidth error={!!errors.tipoPersonaId} size="small">
                          <InputLabel>Tipo de Persona *</InputLabel>
                          <Select
                            value={formData.tipoPersonaId}
                            label="Tipo de Persona *"
                            onChange={(e) => {
                              setFormData({ ...formData, tipoPersonaId: e.target.value, localidadId: '' });
                              if (errors.tipoPersonaId) {
                                setErrors({ ...errors, tipoPersonaId: '' });
                              }
                            }}
                          >
                            {tiposPersona?.map((tipo) => (
                              <MenuItem key={tipo.id} value={tipo.id}>
                                {tipo.nombre}
                              </MenuItem>
                            ))}
                          </Select>
                          {errors.tipoPersonaId && <FormHelperText>{errors.tipoPersonaId}</FormHelperText>}
                        </FormControl>
                      </Grid>
                    );
                  }
                })()}

                {/* Dirección - siempre visible */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Calle"
                    fullWidth
                    size="small"
                    value={formData.dirCalle}
                    onChange={(e) => setFormData({ ...formData, dirCalle: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    label="Nro"
                    fullWidth
                    size="small"
                    value={formData.dirNro}
                    onChange={(e) => setFormData({ ...formData, dirNro: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    label="Piso"
                    fullWidth
                    size="small"
                    value={formData.dirPiso}
                    onChange={(e) => setFormData({ ...formData, dirPiso: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    label="Depto"
                    fullWidth
                    size="small"
                    value={formData.dirDepto}
                    onChange={(e) => setFormData({ ...formData, dirDepto: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Provincia</InputLabel>
                    <Select
                      value={formData.provinciaId}
                      label="Provincia"
                      onChange={(e) => {
                        setFormData({ ...formData, provinciaId: e.target.value, localidadId: '' });
                      }}
                    >
                      {provincias?.map((prov) => (
                        <MenuItem key={prov.id} value={prov.id}>
                          {prov.nombre}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Localidad</InputLabel>
                    <Select
                      value={formData.localidadId}
                      label="Localidad"
                      onChange={(e) => setFormData({ ...formData, localidadId: e.target.value })}
                      disabled={!formData.provinciaId}
                    >
                      {localidades?.map((loc) => (
                        <MenuItem key={loc.id} value={loc.id}>
                          {loc.nombre}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Condición IVA</InputLabel>
                    <Select
                      value={formData.condicionIvaId}
                      label="Condición IVA"
                      onChange={(e) => setFormData({ ...formData, condicionIvaId: e.target.value })}
                    >
                      {condicionesIva?.map((cond) => (
                        <MenuItem key={cond.id} value={cond.id}>
                          {cond.nombre}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained">
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

