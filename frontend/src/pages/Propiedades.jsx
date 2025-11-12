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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  Divider,
  Chip,
  Snackbar,
  Tabs,
  Tab,
  InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HomeIcon from '@mui/icons-material/Home';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import PersonIcon from '@mui/icons-material/Person';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Checkbox from '@mui/material/Checkbox';
import api from '../api';
import ParametroSelect from '../components/ParametroSelect';
import { useParametrosMap, getDescripcion, getAbreviatura } from '../utils/parametros';

export default function Propiedades() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [cuentaFormData, setCuentaFormData] = useState({
    tipoImpuesto: '',
    codigo1: '',
    codigo2: '',
    periodicidad: '',
    observaciones: ''
  });
  // Array temporal de cuentas tributarias antes de guardar
  const [cuentasTemporales, setCuentasTemporales] = useState([]);
  // Estado para la tabla editable de impuestos
  const [impuestosEditables, setImpuestosEditables] = useState([]);
  // Estado para la documentación
  const [documentacion, setDocumentacion] = useState([]);
  const [formData, setFormData] = useState({
    propietarioId: '',
    direccion: '',
    localidad: '',
    tipo: '',
    estado: '',
    codigoInterno: '',
    ambientes: '',
    descripcion: ''
  });
  const [errors, setErrors] = useState({});
  const [cuentaErrors, setCuentaErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  // Estado para controlar la visibilidad de contraseñas en la tabla
  const [showPasswords, setShowPasswords] = useState({});
  const queryClient = useQueryClient();

  const { data: propiedades, isLoading } = useQuery({
    queryKey: ['unidades'],
    queryFn: async () => {
      const response = await api.get('/unidades');
      return response.data;
    }
  });

  const { data: propietarios } = useQuery({
    queryKey: ['propietarios'],
    queryFn: async () => {
      const response = await api.get('/propietarios');
      return response.data;
    }
  });

  // Obtener mapas de parámetros para mostrar descripciones
  const tipoPropiedadMap = useParametrosMap('tipo_unidad');
  const estadoPropiedadMap = useParametrosMap('estado_unidad');
  const ambientesMap = useParametrosMap('ambientes');
  const tipoImpuestoData = useParametrosMap('tipo_cargo');
  const periodicidadMap = useParametrosMap('periodicidad');
  const documentacionData = useParametrosMap('documentacion');

  // Obtener todos los impuestos activos con periodicidad por defecto
  const impuestosConPeriodicidad = tipoImpuestoData.lista?.filter(
    impuesto => impuesto.activo && impuesto.periodicidadPorDefecto
  ) || [];

  // Efecto para inicializar impuestos editables cuando se abre el diálogo o cambian los datos
  useEffect(() => {
    if (open && impuestosConPeriodicidad.length > 0) {
      if (!editing?.id && impuestosEditables.length === 0) {
        // Si es nuevo y no hay impuestos editables inicializados, inicializar con impuestos vacíos
        inicializarImpuestosEditables([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, impuestosConPeriodicidad.length, tipoImpuestoData.lista]);


  const createMutation = useMutation({
    mutationFn: (data) => api.post('/unidades', data)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/unidades/${id}`, data)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/unidades/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['unidades']);
      setSuccessMessage('Propiedad eliminada exitosamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al eliminar la propiedad');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });


  const validateForm = () => {
    const newErrors = {};

    // Validar dirección obligatoria
    if (!formData.direccion || formData.direccion.trim() === '') {
      newErrors.direccion = 'La dirección es obligatoria';
    }

    // Validar localidad obligatoria
    if (!formData.localidad || formData.localidad.trim() === '') {
      newErrors.localidad = 'La localidad es obligatoria';
    }

    // Propietario es opcional

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      propietarioId: '',
      direccion: '',
      localidad: '',
      tipo: '',
      estado: '',
      codigoInterno: '',
      ambientes: '',
      descripcion: ''
    });
    setErrors({});
    setEditing(null);
    setCuentasTemporales([]);
    setImpuestosEditables([]);
    setTabValue(0);
    // Inicializar documentación desde parámetros
    inicializarDocumentacion([]);
    resetCuentaForm();
  };

  // Función para inicializar la documentación desde parámetros
  const inicializarDocumentacion = (documentosExistentes = []) => {
    if (!documentacionData.lista || documentacionData.lista.length === 0) {
      setDocumentacion([]);
      return;
    }

    const documentosIniciales = documentacionData.lista.map(param => {
      // Buscar si existe un documento para este parámetro
      const docExistente = documentosExistentes.find(
        doc => doc.tipoDocumentoId === param.id
      );
      
      const documento = {
        tipoDocumentoId: param.id,
        nombre: param.descripcion,
        necesario: docExistente ? Boolean(docExistente.necesario) : false,
        recibido: docExistente ? Boolean(docExistente.recibido) : false,
        id: docExistente?.id || null // ID si existe en BD
      };
      
      return documento;
    });

    setDocumentacion(documentosIniciales);
  };

  // Función para inicializar la tabla de impuestos editables
  const inicializarImpuestosEditables = (cuentasExistentes = []) => {
    if (!impuestosConPeriodicidad || impuestosConPeriodicidad.length === 0) {
      setImpuestosEditables([]);
      return;
    }

    const impuestosIniciales = impuestosConPeriodicidad.map(impuesto => {
      // Buscar si existe una cuenta tributaria para este impuesto
      const cuentaExistente = cuentasExistentes.find(
        cuenta => cuenta.tipoImpuesto === impuesto.id
      );
      
      return {
        tipoImpuestoId: impuesto.id,
        tipoImpuesto: impuesto.id,
        codigo1: cuentaExistente?.codigo1 || '',
        codigo2: cuentaExistente?.codigo2 || '',
        periodicidad: cuentaExistente?.periodicidad || impuesto.periodicidadPorDefecto,
        usuarioEmail: cuentaExistente?.usuarioEmail || '',
        password: cuentaExistente?.password || '',
        observaciones: cuentaExistente?.observaciones || '',
        activo: !!cuentaExistente, // Activo si ya existe una cuenta
        cuentaId: cuentaExistente?.id || null // ID de la cuenta existente para actualización
      };
    });
    
    setImpuestosEditables(impuestosIniciales);
  };

  const handleOpen = () => {
    resetForm();
    setOpen(true);
  };


  const resetCuentaForm = () => {
    setCuentaFormData({
      tipoImpuesto: '',
      codigo1: '',
      codigo2: '',
      periodicidad: '',
      observaciones: ''
    });
    setCuentaErrors({});
  };

  const handleEditCuenta = (index) => {
    const cuenta = cuentasTemporales[index];
    setCuentaFormData({
      tipoImpuesto: cuenta.tipoImpuesto || '',
      codigo1: cuenta.codigo1 || '',
      codigo2: cuenta.codigo2 || '',
      periodicidad: cuenta.periodicidad || '',
      observaciones: cuenta.observaciones || ''
    });
    // Eliminar de la lista temporal y se agregará de nuevo al guardar
    const nuevasCuentas = [...cuentasTemporales];
    nuevasCuentas.splice(index, 1);
    setCuentasTemporales(nuevasCuentas);
  };

  const handleAgregarCuenta = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Evitar que el evento se propague al formulario principal
    
    const newErrors = {};
    if (!cuentaFormData.tipoImpuesto) {
      newErrors.tipoImpuesto = 'Debe seleccionar un impuesto';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setCuentaErrors(newErrors);
      return;
    }
    
    setCuentaErrors({});

    // Agregar a la lista temporal
    const nuevaCuenta = {
      tempId: `temp-${Date.now()}`,
      tipoImpuesto: cuentaFormData.tipoImpuesto,
      codigo1: cuentaFormData.codigo1?.trim() || null,
      codigo2: cuentaFormData.codigo2?.trim() || null,
      periodicidad: cuentaFormData.periodicidad || null,
      observaciones: cuentaFormData.observaciones?.trim() || null
    };

    setCuentasTemporales([...cuentasTemporales, nuevaCuenta]);
    resetCuentaForm();
    
    return false; // Prevenir cualquier comportamiento por defecto
  };

  const handleEliminarCuenta = (index) => {
    const nuevasCuentas = [...cuentasTemporales];
    nuevasCuentas.splice(index, 1);
    setCuentasTemporales(nuevasCuentas);
  };

  const handleEdit = async (propiedad) => {
    setEditing(propiedad);
    resetCuentaForm();
    // Limpiar datos para el formulario, excluyendo relaciones y campos read-only
    setFormData({
      propietarioId: propiedad.propietarioId || '',
      direccion: propiedad.direccion || '',
      localidad: propiedad.localidad || '',
      tipo: propiedad.tipo || '',
      estado: propiedad.estado || '',
      codigoInterno: propiedad.codigoInterno || '',
      ambientes: propiedad.ambientes || '',
      descripcion: propiedad.descripcion || ''
    });
    setOpen(true);
    
    // Cargar las cuentas tributarias existentes
    try {
      const response = await api.get(`/cuentas/unidad/${propiedad.id}`);
      const cuentasExistentes = response.data || [];
      // Inicializar la tabla de impuestos editables con las cuentas existentes
      // Usar setTimeout para asegurar que impuestosConPeriodicidad esté disponible
      setTimeout(() => {
        inicializarImpuestosEditables(cuentasExistentes);
      }, 100);
      // Ya no necesitamos cuentasTemporales, todo se maneja con impuestosEditables
    } catch (error) {
      console.error('Error al cargar cuentas tributarias:', error);
      setCuentasTemporales([]);
      if (impuestosConPeriodicidad.length > 0) {
        inicializarImpuestosEditables([]);
      } else {
        setTimeout(() => {
          inicializarImpuestosEditables([]);
        }, 200);
      }
    }

    // Cargar los documentos existentes
    try {
      const documentosResponse = await api.get(`/documentos-propiedad/unidad/${propiedad.id}`);
      const documentosExistentes = documentosResponse.data || [];
      // Inicializar documentación con los documentos existentes
      // Esperar a que los parámetros estén cargados
      if (documentacionData.lista && documentacionData.lista.length > 0) {
        inicializarDocumentacion(documentosExistentes);
      } else {
        // Si los parámetros aún no están cargados, esperar un poco más
        setTimeout(() => {
          inicializarDocumentacion(documentosExistentes);
        }, 300);
      }
    } catch (error) {
      console.error('Error al cargar documentos:', error);
      // Si hay error, inicializar sin documentos existentes (todos en false)
      if (documentacionData.lista && documentacionData.lista.length > 0) {
        inicializarDocumentacion([]);
      } else {
        setTimeout(() => {
          inicializarDocumentacion([]);
        }, 300);
      }
    }
  };

  // Efecto para inicializar documentación cuando se abre el diálogo para nueva propiedad
  useEffect(() => {
    if (open && !editing && documentacionData.lista && documentacionData.lista.length > 0 && documentacion.length === 0) {
      inicializarDocumentacion([]);
    }
  }, [open, editing, documentacionData.lista]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar formulario antes de enviar
    if (!validateForm()) {
      return;
    }
    
    // Preparar datos para enviar, excluyendo campos vacíos opcionales
    const dataToSend = {
      propietarioId: formData.propietarioId?.trim() || null,
      direccion: formData.direccion.trim(),
      localidad: formData.localidad.trim(),
      tipo: formData.tipo?.trim() || null,
      estado: formData.estado?.trim() || null,
      codigoInterno: formData.codigoInterno?.trim() || null,
      ambientes: formData.ambientes?.trim() || null,
      descripcion: formData.descripcion?.trim() || null
    };

    try {
      let propiedadId;
      
      if (editing?.id) {
        // Actualizar propiedad
        const response = await updateMutation.mutateAsync({ id: editing.id, data: dataToSend });
        propiedadId = editing.id;
      } else {
        // Crear propiedad
        const response = await createMutation.mutateAsync(dataToSend);
        propiedadId = response.data.id;
      }

      // Guardar todas las cuentas tributarias desde la tabla editable
      // Obtener cuentas existentes si estamos editando
      let cuentasExistentes = [];
      if (editing?.id) {
        try {
          const cuentasExistentesResponse = await api.get(`/cuentas/unidad/${propiedadId}`);
          cuentasExistentes = cuentasExistentesResponse.data || [];
        } catch (error) {
          console.error('Error al obtener cuentas existentes:', error);
        }
      }

      // Procesar impuestos editables
      const impuestosActivos = impuestosEditables.filter(imp => imp.activo);
      
      // Mapear IDs existentes válidos (solo los que realmente existen en la respuesta del servidor)
      const idsExistentesValidos = new Set(cuentasExistentes.map(c => c.id));
      
      // Verificar que los cuentaId en impuestosEditables realmente existen
      const impuestosConCuentaIdValido = impuestosActivos.map(imp => ({
        ...imp,
        cuentaId: imp.cuentaId && idsExistentesValidos.has(imp.cuentaId) ? imp.cuentaId : null
      }));

      const idsAGuardar = new Set(
        impuestosConCuentaIdValido
          .filter(imp => imp.cuentaId)
          .map(imp => imp.cuentaId)
      );

      // Eliminar cuentas que ya no están activas (solo las que realmente existen)
      const idsAEliminar = cuentasExistentes
        .filter(c => !idsAGuardar.has(c.id))
        .map(c => c.id);
      
      if (idsAEliminar.length > 0) {
        await Promise.all(
          idsAEliminar.map(id => 
            api.delete(`/cuentas/${id}`).catch(err => {
              console.warn(`No se pudo eliminar cuenta ${id}:`, err);
            })
          )
        );
      }

      // Crear/actualizar cuentas activas
      if (impuestosConCuentaIdValido.length > 0) {
        const promises = impuestosConCuentaIdValido.map(async (impuesto) => {
          const cuentaData = {
            unidadId: propiedadId,
            tipoImpuesto: impuesto.tipoImpuesto,
            codigo1: impuesto.codigo1?.trim() || null,
            codigo2: impuesto.codigo2?.trim() || null,
            periodicidad: impuesto.periodicidad || null,
            usuarioEmail: impuesto.usuarioEmail?.trim() || null,
            password: impuesto.password?.trim() || null,
            observaciones: impuesto.observaciones?.trim() || null
          };

          try {
            // Si tiene cuentaId válido, intentar actualizar
            if (impuesto.cuentaId) {
              try {
                return await api.put(`/cuentas/${impuesto.cuentaId}`, cuentaData);
              } catch (updateError) {
                // Si la cuenta no existe (404), crear una nueva
                if (updateError.response?.status === 404) {
                  console.warn(`Cuenta tributaria ${impuesto.cuentaId} no encontrada, creando nueva`);
                  return await api.post('/cuentas', cuentaData);
                }
                // Si es otro error, relanzarlo
                throw updateError;
              }
            } else {
              // Crear nueva
              return await api.post('/cuentas', cuentaData);
            }
          } catch (error) {
            console.error('Error al guardar cuenta tributaria:', error);
            const impuestoNombre = tipoImpuestoData.parametros?.[impuesto.tipoImpuesto]?.descripcion || 'impuesto';
            throw new Error(error.response?.data?.error || `Error al guardar la cuenta tributaria: ${impuestoNombre}`);
          }
        });

        await Promise.all(promises);
      }

      // Guardar documentos de la propiedad (guardar todos, incluso los que están en false)
      let errorDocumentos = null;
      
      if (documentacion && Array.isArray(documentacion) && documentacion.length > 0) {
        try {
          const documentosAGuardar = documentacion
            .filter(doc => doc && doc.tipoDocumentoId)
            .map(doc => ({
              tipoDocumentoId: doc.tipoDocumentoId,
              necesario: Boolean(doc.necesario),
              recibido: Boolean(doc.recibido)
            }));
          
          if (documentosAGuardar.length > 0) {
            await api.post(`/documentos-propiedad/unidad/${propiedadId}`, {
              documentos: documentosAGuardar
            });
          }
        } catch (error) {
          console.error('Error al guardar documentos:', error);
          errorDocumentos = error.response?.data?.error || error.message || 'Error al guardar documentos';
        }
      }

      queryClient.invalidateQueries(['unidades']);
      queryClient.invalidateQueries(['cuentasTributarias']);
      // Invalidar también los documentos de la propiedad para que se recarguen si se consultan
      queryClient.invalidateQueries(['documentos-propiedad']);
      
      // Si hubo error solo en documentos, mostrar advertencia pero cerrar el diálogo
      if (errorDocumentos) {
        setErrorMessage(`La propiedad se guardó correctamente, pero hubo un error al guardar los documentos: ${errorDocumentos}`);
        setSnackbarSeverity('warning');
        setSnackbarOpen(true);
      } else {
        setOpen(false);
        resetForm();
        setSuccessMessage(editing?.id ? 'Propiedad actualizada exitosamente' : 'Propiedad creada exitosamente');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('❌ ERROR GENERAL al guardar:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Error al guardar la propiedad y cuentas tributarias';
      setErrorMessage(errorMessage);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  if (isLoading) return <div>Cargando...</div>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Propiedades</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}>
          Nueva Propiedad
        </Button>
      </Box>

      {/* Vista de tabla para desktop */}
      <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Dirección</TableCell>
              <TableCell>Localidad</TableCell>
              <TableCell>Propietario</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {propiedades?.data?.map((propiedad) => (
              <TableRow key={propiedad.id}>
                <TableCell>{propiedad.direccion}</TableCell>
                <TableCell>{propiedad.localidad}</TableCell>
                <TableCell>
                  {propiedad.propietario 
                    ? (propiedad.propietario.razonSocial ||
                       `${propiedad.propietario.nombre || ''} ${propiedad.propietario.apellido || ''}`.trim())
                    : <em style={{ color: '#999' }}>Sin propietario</em>}
                </TableCell>
                <TableCell>{getDescripcion(tipoPropiedadMap, propiedad.tipo)}</TableCell>
                <TableCell>{getDescripcion(estadoPropiedadMap, propiedad.estado)}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleEdit(propiedad)} title="Editar">
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (window.confirm('¿Está seguro de eliminar esta propiedad?')) {
                        deleteMutation.mutate(propiedad.id);
                      }
                    }}
                    title="Eliminar"
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
          {propiedades?.data?.map((propiedad) => (
            <Grid item xs={12} key={propiedad.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        {propiedad.direccion}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={() => handleEdit(propiedad)} sx={{ mr: 0.5 }} title="Editar">
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (window.confirm('¿Está seguro de eliminar esta propiedad?')) {
                            deleteMutation.mutate(propiedad.id);
                          }
                        }}
                        title="Eliminar"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {propiedad.localidad && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocationCityIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>Localidad:</strong> {propiedad.localidad}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        <strong>Propietario:</strong>{' '}
                        {propiedad.propietario 
                          ? (propiedad.propietario.razonSocial ||
                             `${propiedad.propietario.nombre || ''} ${propiedad.propietario.apellido || ''}`.trim())
                          : <em style={{ color: '#999' }}>Sin propietario</em>}
                      </Typography>
                    </Box>
                    {propiedad.tipo && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HomeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>Tipo:</strong> {getDescripcion(tipoPropiedadMap, propiedad.tipo)}
                        </Typography>
                      </Box>
                    )}
                    {propiedad.estado && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={getDescripcion(estadoPropiedadMap, propiedad.estado)} size="small" color="primary" />
                      </Box>
                    )}
                    {propiedad.ambientes && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          <strong>Ambientes:</strong> {getDescripcion(ambientesMap, propiedad.ambientes)}
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

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
        <form onSubmit={handleSubmit} noValidate>
          <DialogTitle>
            {editing ? 'Editar Propiedad' : 'Nueva Propiedad'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Dirección"
                    required
                    fullWidth
                    size="small"
                    value={formData.direccion}
                    onChange={(e) => {
                      setFormData({ ...formData, direccion: e.target.value });
                      if (errors.direccion) {
                        setErrors({ ...errors, direccion: '' });
                      }
                    }}
                    error={!!errors.direccion}
                    helperText={errors.direccion}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Localidad"
                    required
                    fullWidth
                    size="small"
                    value={formData.localidad}
                    onChange={(e) => {
                      setFormData({ ...formData, localidad: e.target.value });
                      if (errors.localidad) {
                        setErrors({ ...errors, localidad: '' });
                      }
                    }}
                    error={!!errors.localidad}
                    helperText={errors.localidad}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl fullWidth size="small" error={!!errors.propietarioId}>
                    <InputLabel>Propietario</InputLabel>
                    <Select
                      value={formData.propietarioId || ''}
                      onChange={(e) => {
                        setFormData({ ...formData, propietarioId: e.target.value || '' });
                        if (errors.propietarioId) {
                          setErrors({ ...errors, propietarioId: '' });
                        }
                      }}
                      label="Propietario"
                    >
                      <MenuItem value="">
                        <em>Sin propietario</em>
                      </MenuItem>
                      {propietarios?.data?.map((prop) => (
                        <MenuItem key={prop.id} value={prop.id}>
                          {prop.razonSocial || `${prop.nombre || ''} ${prop.apellido || ''}`.trim() || 'Sin nombre'}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.propietarioId && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                        {errors.propietarioId}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <ParametroSelect
                    categoriaCodigo="tipo_unidad"
                    label="Tipo de Propiedad"
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <ParametroSelect
                    categoriaCodigo="ambientes"
                    label="Ambientes"
                    value={formData.ambientes}
                    onChange={(e) => setFormData({ ...formData, ambientes: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <ParametroSelect
                    categoriaCodigo="estado_unidad"
                    label="Estado"
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="Código Interno"
                    fullWidth
                    size="small"
                    value={formData.codigoInterno}
                    onChange={(e) => setFormData({ ...formData, codigoInterno: e.target.value })}
                  />
                </Grid>
              </Grid>

              {/* Campo Descripción */}
              <Box sx={{ mt: 3 }}>
                <TextField
                  label="Descripción"
                  fullWidth
                  multiline 
                  rows={4}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Ingrese una descripción de la propiedad..."
                  sx={{
                    '& .MuiInputBase-root': {
                      alignItems: 'flex-start',
                      minHeight: '80px'
                    },
                    '& .MuiInputBase-input': {
                      padding: '16.5px 14px',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      boxSizing: 'border-box'
                    },
                    '& .MuiOutlinedInput-root': {
                      '& textarea': {
                        overflowY: 'auto !important',
                        overflowX: 'hidden !important',
                        resize: 'vertical',
                        padding: 0,
                        margin: 0,
                        boxSizing: 'border-box'
                      },
                      '& fieldset': {
                        borderWidth: '1px'
                      }
                    }
                  }}
                />
              </Box>

              {/* Sección de Tabs: Asociar Impuestos y Documentación */}
              <Box sx={{ mt: 3 }}>
                <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Tab label="Asociar Impuestos" />
                  <Tab label="Documentación" />
                </Tabs>

                {/* Tab Panel: Asociar Impuestos */}
                {tabValue === 0 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      Seleccioná los impuestos que aplican a esta propiedad y completá los códigos correspondientes.
                    </Typography>

                {/* Tabla editable de impuestos */}
                {impuestosConPeriodicidad.length > 0 ? (() => {
                  const tieneCodigo1 = impuestosEditables.some(imp => {
                    const param = tipoImpuestoData.parametros?.[imp.tipoImpuesto];
                    return param?.labelCodigo1;
                  });
                  const tieneCodigo2 = impuestosEditables.some(imp => {
                    const param = tipoImpuestoData.parametros?.[imp.tipoImpuesto];
                    return param?.labelCodigo2;
                  });
                  const anchoCodigo = 200; // Ancho de cada columna de código
                  const anchoMinimo = 800 + (tieneCodigo1 ? anchoCodigo : 0) + (tieneCodigo2 ? anchoCodigo : 0);
                  
                  return (
                    <TableContainer 
                      sx={{ 
                        mb: 2, 
                        border: '1px solid', 
                        borderColor: 'divider', 
                        borderRadius: 1,
                        maxWidth: '100%',
                        overflowX: 'auto'
                      }}
                    >
                      <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.25 }, minWidth: anchoMinimo }}>
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.100' }}>
                          <TableCell padding="checkbox" sx={{ width: '60px', minWidth: '60px', py: 0.75 }}>Activo</TableCell>
                          <TableCell sx={{ width: '140px', minWidth: '140px', py: 0.75, whiteSpace: 'nowrap' }}>Impuesto</TableCell>
                          <TableCell sx={{ width: '160px', minWidth: '160px', py: 0.75 }}>Periodicidad</TableCell>
                          {tieneCodigo1 && (
                            <TableCell sx={{ width: '200px', minWidth: '200px', py: 0.75 }}>Código 1</TableCell>
                          )}
                          {tieneCodigo2 && (
                            <TableCell sx={{ width: '200px', minWidth: '200px', py: 0.75 }}>Código 2</TableCell>
                          )}
                          <TableCell sx={{ width: '200px', minWidth: '200px', py: 0.75 }}>Usuario/Email</TableCell>
                          <TableCell sx={{ width: '180px', minWidth: '180px', py: 0.75 }}>Contraseña</TableCell>
                          <TableCell sx={{ width: '200px', minWidth: '200px', py: 0.75 }}>Observaciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {impuestosEditables.map((impuesto, index) => {
                          const parametroImpuesto = tipoImpuestoData.parametros?.[impuesto.tipoImpuesto];
                          const labelCodigo1 = parametroImpuesto?.labelCodigo1;
                          const labelCodigo2 = parametroImpuesto?.labelCodigo2;
                          const mostrarCodigo1 = !!labelCodigo1;
                          const mostrarCodigo2 = !!labelCodigo2;
                          
                          return (
                            <TableRow 
                              key={impuesto.tipoImpuestoId} 
                              sx={{ 
                                '&:hover': { bgcolor: 'action.hover' },
                                bgcolor: impuesto.activo ? 'transparent' : 'grey.50'
                              }}
                            >
                              <TableCell padding="checkbox" sx={{ py: 0.25, width: '60px', minWidth: '60px' }}>
                                <Checkbox
                                  checked={impuesto.activo}
                                  onChange={(e) => {
                                    const nuevosImpuestos = [...impuestosEditables];
                                    nuevosImpuestos[index].activo = e.target.checked;
                                    setImpuestosEditables(nuevosImpuestos);
                                  }}
                                  size="small"
                                  sx={{ py: 0 }}
                                />
                              </TableCell>
                              <TableCell sx={{ py: 0.25, whiteSpace: 'nowrap', width: '140px', minWidth: '140px' }}>
                                <Typography variant="body2" fontWeight={impuesto.activo ? 'medium' : 'normal'} noWrap>
                                  {getAbreviatura(tipoImpuestoData, impuesto.tipoImpuesto)}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ py: 0.25, width: '160px', minWidth: '160px' }}>
                                <FormControl 
                                  fullWidth 
                                  size="small"
                                  disabled={!impuesto.activo}
                                  sx={{
                                    '& .MuiInputBase-root': {
                                      height: '28px'
                                    },
                                    '& .MuiSelect-select': {
                                      py: 0.5,
                                      fontSize: '0.875rem'
                                    },
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      padding: 0
                                    }
                                  }}
                                >
                                  <Select
                                    value={impuesto.periodicidad || ''}
                                    onChange={(e) => {
                                      const nuevosImpuestos = [...impuestosEditables];
                                      nuevosImpuestos[index].periodicidad = e.target.value;
                                      setImpuestosEditables(nuevosImpuestos);
                                    }}
                                    disabled={!impuesto.activo}
                                    displayEmpty
                                    onClick={(e) => e.stopPropagation()}
                                    renderValue={(selected) => {
                                      if (!selected) return <em style={{ color: '#9e9e9e' }}>-</em>;
                                      const periodicidad = periodicidadMap.lista?.find(p => p.id === selected);
                                      return periodicidad?.descripcion || '-';
                                    }}
                                    sx={{
                                      '& .MuiSelect-select': {
                                        py: 0.5,
                                        fontSize: '0.875rem'
                                      }
                                    }}
                                  >
                                    <MenuItem value="">
                                      <em>-</em>
                                    </MenuItem>
                                    {periodicidadMap.lista?.map((param) => (
                                      <MenuItem key={param.id} value={param.id}>
                                        {param.descripcion}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </TableCell>
                              {(() => {
                                // Si tiene ambos labels, mostrar dos campos separados
                                if (mostrarCodigo1 && mostrarCodigo2) {
                                  return (
                                    <>
                                      <TableCell sx={{ py: 0.25, width: '200px', minWidth: '200px' }}>
                                        <TextField
                                          size="small"
                                          fullWidth
                                          placeholder={labelCodigo1}
                                          value={impuesto.codigo1 || ''}
                                          onChange={(e) => {
                                            const nuevosImpuestos = [...impuestosEditables];
                                            nuevosImpuestos[index].codigo1 = e.target.value;
                                            setImpuestosEditables(nuevosImpuestos);
                                          }}
                                          disabled={!impuesto.activo}
                                          onClick={(e) => e.stopPropagation()}
                                          sx={{ 
                                            '& .MuiInputBase-root': {
                                              height: '28px'
                                            },
                                            '& .MuiInputBase-input': { 
                                              py: 0.25,
                                              fontSize: '0.875rem'
                                            },
                                            '& .MuiOutlinedInput-notchedOutline': {
                                              padding: 0
                                            }
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell sx={{ py: 0.25, width: '200px', minWidth: '200px' }}>
                                        <TextField
                                          size="small"
                                          fullWidth
                                          placeholder={labelCodigo2}
                                          value={impuesto.codigo2 || ''}
                                          onChange={(e) => {
                                            const nuevosImpuestos = [...impuestosEditables];
                                            nuevosImpuestos[index].codigo2 = e.target.value;
                                            setImpuestosEditables(nuevosImpuestos);
                                          }}
                                          disabled={!impuesto.activo}
                                          onClick={(e) => e.stopPropagation()}
                                          sx={{ 
                                            '& .MuiInputBase-root': {
                                              height: '28px'
                                            },
                                            '& .MuiInputBase-input': { 
                                              py: 0.25,
                                              fontSize: '0.875rem'
                                            },
                                            '& .MuiOutlinedInput-notchedOutline': {
                                              padding: 0
                                            }
                                          }}
                                        />
                                      </TableCell>
                                    </>
                                  );
                                }
                                // Si solo tiene código 1, ocupar el espacio de ambos si hay otra columna de código 2
                                if (mostrarCodigo1 && !mostrarCodigo2) {
                                  return (
                                    <TableCell 
                                      colSpan={tieneCodigo2 ? 2 : 1}
                                      sx={{ 
                                        py: 0.25, 
                                        width: tieneCodigo2 ? '400px' : '200px', 
                                        minWidth: tieneCodigo2 ? '400px' : '200px' 
                                      }}
                                    >
                                      <TextField
                                        size="small"
                                        fullWidth
                                        placeholder={labelCodigo1}
                                        value={impuesto.codigo1 || ''}
                                        onChange={(e) => {
                                          const nuevosImpuestos = [...impuestosEditables];
                                          nuevosImpuestos[index].codigo1 = e.target.value;
                                          setImpuestosEditables(nuevosImpuestos);
                                        }}
                                        disabled={!impuesto.activo}
                                        onClick={(e) => e.stopPropagation()}
                                        sx={{ 
                                          '& .MuiInputBase-root': {
                                            height: '28px'
                                          },
                                          '& .MuiInputBase-input': { 
                                            py: 0.25,
                                            fontSize: '0.875rem'
                                          },
                                          '& .MuiOutlinedInput-notchedOutline': {
                                            padding: 0
                                          }
                                        }}
                                      />
                                    </TableCell>
                                  );
                                }
                                // Si solo tiene código 2, ocupar el espacio de ambos si hay otra columna de código 1
                                if (!mostrarCodigo1 && mostrarCodigo2) {
                                  return (
                                    <TableCell 
                                      colSpan={tieneCodigo1 ? 2 : 1}
                                      sx={{ 
                                        py: 0.25, 
                                        width: tieneCodigo1 ? '400px' : '200px', 
                                        minWidth: tieneCodigo1 ? '400px' : '200px' 
                                      }}
                                    >
                                      <TextField
                                        size="small"
                                        fullWidth
                                        placeholder={labelCodigo2}
                                        value={impuesto.codigo2 || ''}
                                        onChange={(e) => {
                                          const nuevosImpuestos = [...impuestosEditables];
                                          nuevosImpuestos[index].codigo2 = e.target.value;
                                          setImpuestosEditables(nuevosImpuestos);
                                        }}
                                        disabled={!impuesto.activo}
                                        onClick={(e) => e.stopPropagation()}
                                        sx={{ 
                                          '& .MuiInputBase-root': {
                                            height: '28px'
                                          },
                                          '& .MuiInputBase-input': { 
                                            py: 0.25,
                                            fontSize: '0.875rem'
                                          },
                                          '& .MuiOutlinedInput-notchedOutline': {
                                            padding: 0
                                          }
                                        }}
                                      />
                                    </TableCell>
                                  );
                                }
                                // Si no tiene ningún código pero otros impuestos sí, mostrar celdas vacías
                                if (!mostrarCodigo1 && !mostrarCodigo2 && (tieneCodigo1 || tieneCodigo2)) {
                                  const totalColumnasCodigo = (tieneCodigo1 ? 1 : 0) + (tieneCodigo2 ? 1 : 0);
                                  return (
                                    <TableCell 
                                      colSpan={totalColumnasCodigo}
                                      sx={{ 
                                        py: 0.25, 
                                        width: totalColumnasCodigo === 2 ? '400px' : '200px', 
                                        minWidth: totalColumnasCodigo === 2 ? '400px' : '200px' 
                                      }}
                                    ></TableCell>
                                  );
                                }
                                return null;
                              })()}
                              <TableCell sx={{ py: 0.25, width: '200px', minWidth: '200px' }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  placeholder="Usuario/Email"
                                  value={impuesto.usuarioEmail || ''}
                                  onChange={(e) => {
                                    const nuevosImpuestos = [...impuestosEditables];
                                    nuevosImpuestos[index].usuarioEmail = e.target.value;
                                    setImpuestosEditables(nuevosImpuestos);
                                  }}
                                  disabled={!impuesto.activo}
                                  onClick={(e) => e.stopPropagation()}
                                  sx={{ 
                                    '& .MuiInputBase-root': {
                                      height: '28px'
                                    },
                                    '& .MuiInputBase-input': { 
                                      py: 0.25,
                                      fontSize: '0.875rem'
                                    },
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      padding: 0
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ py: 0.25, width: '180px', minWidth: '180px' }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  type={showPasswords[index] ? 'text' : 'password'}
                                  placeholder="Contraseña"
                                  value={impuesto.password || ''}
                                  onChange={(e) => {
                                    const nuevosImpuestos = [...impuestosEditables];
                                    nuevosImpuestos[index].password = e.target.value;
                                    setImpuestosEditables(nuevosImpuestos);
                                  }}
                                  disabled={!impuesto.activo}
                                  onClick={(e) => e.stopPropagation()}
                                  InputProps={{
                                    endAdornment: (
                                      <InputAdornment position="end">
                                        <IconButton
                                          aria-label="toggle password visibility"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowPasswords(prev => ({
                                              ...prev,
                                              [index]: !prev[index]
                                            }));
                                          }}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                          }}
                                          edge="end"
                                          size="small"
                                          sx={{ padding: '2px' }}
                                          disabled={!impuesto.activo}
                                        >
                                          {showPasswords[index] ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                        </IconButton>
                                      </InputAdornment>
                                    )
                                  }}
                                  sx={{ 
                                    '& .MuiInputBase-root': {
                                      height: '28px'
                                    },
                                    '& .MuiInputBase-input': { 
                                      py: 0.25,
                                      fontSize: '0.875rem',
                                      pr: 1
                                    },
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      padding: 0
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ py: 0.25, width: '200px', minWidth: '200px' }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  placeholder="Observaciones"
                                  value={impuesto.observaciones || ''}
                                  onChange={(e) => {
                                    const nuevosImpuestos = [...impuestosEditables];
                                    nuevosImpuestos[index].observaciones = e.target.value;
                                    setImpuestosEditables(nuevosImpuestos);
                                  }}
                                  disabled={!impuesto.activo}
                                  onClick={(e) => e.stopPropagation()}
                                  sx={{ 
                                    '& .MuiInputBase-root': {
                                      height: '28px'
                                    },
                                    '& .MuiInputBase-input': { 
                                      py: 0.25,
                                      fontSize: '0.875rem'
                                    },
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      padding: 0
                                    }
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  );
                })() : (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No hay impuestos configurados con periodicidad por defecto. Configurá la periodicidad por defecto en la sección de Configuración.
                  </Alert>
                )}
                  </Box>
                )}

                {/* Tab Panel: Documentación */}
                {tabValue === 1 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Marcá los documentos necesarios y aquellos que ya fueron recibidos.
                    </Typography>
                    {documentacion.length === 0 ? (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        No hay tipos de documentación configurados. Configurá los tipos de documentación en la sección de Configuración.
                      </Alert>
                    ) : (
                      <TableContainer 
                      component={Paper}
                      sx={{ 
                        border: '1px solid', 
                        borderColor: 'divider', 
                        borderRadius: 1
                      }}
                    >
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'grey.100' }}>
                            <TableCell sx={{ width: '50%', py: 1, fontWeight: 'medium' }}>Documento</TableCell>
                            <TableCell align="center" sx={{ width: '25%', py: 1, fontWeight: 'medium' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                <Checkbox
                                  indeterminate={
                                    documentacion.some(doc => doc.necesario) &&
                                    !documentacion.every(doc => doc.necesario)
                                  }
                                  checked={
                                    documentacion.length > 0 &&
                                    documentacion.every(doc => doc.necesario)
                                  }
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const nuevoValor = e.target.checked;
                                    setDocumentacion(prev =>
                                      prev.map(doc => ({
                                        ...doc,
                                        necesario: nuevoValor,
                                        recibido: nuevoValor ? doc.recibido : false
                                      }))
                                    );
                                  }}
                                  size="small"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <Typography variant="caption" component="span">
                                  Necesario
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="center" sx={{ width: '25%', py: 1, fontWeight: 'medium' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                <Checkbox
                                  indeterminate={
                                    documentacion.filter(doc => doc.necesario).length > 0 &&
                                    documentacion.filter(doc => doc.necesario).some(doc => doc.recibido) &&
                                    !documentacion.filter(doc => doc.necesario).every(doc => doc.recibido)
                                  }
                                  checked={
                                    documentacion.filter(doc => doc.necesario).length > 0 &&
                                    documentacion.filter(doc => doc.necesario).every(doc => doc.recibido)
                                  }
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const nuevoValor = e.target.checked;
                                    setDocumentacion(prev =>
                                      prev.map(doc => ({
                                        ...doc,
                                        recibido: doc.necesario ? nuevoValor : false
                                      }))
                                    );
                                  }}
                                  size="small"
                                  disabled={documentacion.filter(doc => doc.necesario).length === 0}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <Typography variant="caption" component="span">
                                  Recibido
                                </Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {documentacion.map((doc, index) => (
                            <TableRow key={doc.tipoDocumentoId || `doc-${index}`} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                              <TableCell sx={{ py: 1 }}>
                                <Typography variant="body2">{doc.nombre}</Typography>
                              </TableCell>
                              <TableCell align="center" sx={{ py: 1 }}>
                                <Checkbox
                                  checked={doc.necesario || false}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const nuevoValor = e.target.checked;
                                    setDocumentacion(prev => 
                                      prev.map(d =>
                                        d.tipoDocumentoId === doc.tipoDocumentoId 
                                          ? { ...d, necesario: nuevoValor, recibido: nuevoValor ? d.recibido : false } 
                                          : d
                                      )
                                    );
                                  }}
                                  size="small"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </TableCell>
                              <TableCell align="center" sx={{ py: 1 }}>
                                <Checkbox
                                  checked={doc.recibido || false}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const nuevoValor = e.target.checked;
                                    setDocumentacion(prev => 
                                      prev.map(d =>
                                        d.tipoDocumentoId === doc.tipoDocumentoId 
                                          ? { ...d, recibido: nuevoValor } 
                                          : d
                                      )
                                    );
                                  }}
                                  size="small"
                                  disabled={!doc.necesario}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setOpen(false);
              resetForm();
            }}>
              Cancelar
            </Button>
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

