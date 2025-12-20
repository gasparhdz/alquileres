import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
  Grid,
  Alert,
  Divider
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../api';

// Configuración de campos especiales por tipo de catálogo
const CATALOGO_CONFIG = {
  'provincias': {
    title: 'Provincias',
    fields: [
      { name: 'codigo', label: 'Código', type: 'text', required: false },
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'activo', label: 'Activo', type: 'switch', required: false }
    ]
  },
  'localidades': {
    title: 'Localidades',
    fields: [
      { name: 'codigo', label: 'Código', type: 'text', required: false },
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'provinciaId', label: 'Provincia', type: 'select', required: true, 
        optionsEndpoint: '/catalogos/provincias', optionLabel: 'nombre', optionValue: 'id' },
      { name: 'activo', label: 'Activo', type: 'switch', required: false }
    ]
  },
  'indices-ajuste': {
    title: 'Índices de Ajuste',
    fields: [
      { name: 'metodoAjusteContratoId', label: 'Método de Ajuste', type: 'select', required: true,
        optionsEndpoint: '/catalogos-abm/metodos-ajuste-contrato', optionLabel: 'nombre', optionValue: 'id' },
      { name: 'periodo', label: 'Período (YYYY-MM)', type: 'text', required: true, placeholder: '2024-11' },
      { name: 'valor', label: 'Valor', type: 'number', required: true, step: '0.000001' },
      { name: 'variacion', label: 'Variación', type: 'number', required: false, step: '0.000001' },
      { name: 'fuente', label: 'Fuente', type: 'text', required: false },
      { name: 'fechaPublicacion', label: 'Fecha de Publicación', type: 'date', required: true },
      { name: 'activo', label: 'Activo', type: 'switch', required: false }
    ]
  },
  'monedas': {
    title: 'Monedas',
    fields: [
      { name: 'codigo', label: 'Código', type: 'text', required: true, placeholder: 'ARS, USD' },
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'simbolo', label: 'Símbolo', type: 'text', required: false, placeholder: '$' },
      { name: 'activo', label: 'Activo', type: 'switch', required: false }
    ]
  },
  'tipos-documento-propiedad': {
    title: 'Tipos de Documento de Propiedad',
    fields: [
      { name: 'codigo', label: 'Código', type: 'text', required: true },
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'descripcion', label: 'Descripción', type: 'textarea', required: false },
      { name: 'activo', label: 'Activo', type: 'switch', required: false }
    ]
  },
  'estados-contrato': {
    title: 'Estados de Contrato',
    fields: [
      { name: 'codigo', label: 'Código', type: 'text', required: true },
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'esFinal', label: 'Es Estado Final', type: 'switch', required: false },
      { name: 'activo', label: 'Activo', type: 'switch', required: false }
    ]
  },
  'estados-liquidacion': {
    title: 'Estados de Liquidación',
    fields: [
      { name: 'codigo', label: 'Código', type: 'text', required: true },
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'esFinal', label: 'Es Estado Final', type: 'switch', required: false },
      { name: 'activo', label: 'Activo', type: 'switch', required: false }
    ]
  },
  'tipos-impuesto-propiedad': {
    title: 'Tipos de Impuesto de Propiedad',
    fields: [
      { name: 'codigo', label: 'Código', type: 'text', required: true },
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'periodicidadId', label: 'Periodicidad por Defecto', type: 'select', required: false,
        optionsEndpoint: '/catalogos-abm/periodicidades-impuesto', optionLabel: 'nombre', optionValue: 'id' },
      { name: 'activo', label: 'Activo', type: 'switch', required: false }
    ]
  },
  'tipos-cargo': {
    title: 'Tipos de Cargo',
    fields: [
      { name: 'codigo', label: 'Código', type: 'text', required: true },
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'periodicidadId', label: 'Periodicidad por Defecto', type: 'select', required: false,
        optionsEndpoint: '/catalogos-abm/periodicidades-impuesto', optionLabel: 'nombre', optionValue: 'id' },
      { name: 'activo', label: 'Activo', type: 'switch', required: false }
    ]
  },
  'tipos-gasto-inicial-contrato': {
    title: 'Tipos de Gasto Inicial',
    fields: [
      { name: 'codigo', label: 'Código', type: 'text', required: true },
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'valorDefault', label: 'Valor por Defecto', type: 'number', required: false, step: 'any' },
      { name: 'esPorcentaje', label: 'Es Porcentaje', type: 'switch', required: false },
      { name: 'activo', label: 'Activo', type: 'switch', required: false }
    ]
  }
};

// Configuración por defecto para catálogos simples
const DEFAULT_CONFIG = {
  fields: [
    { name: 'codigo', label: 'Código', type: 'text', required: true },
    { name: 'nombre', label: 'Nombre', type: 'text', required: true },
    { name: 'activo', label: 'Activo', type: 'switch', required: false }
  ]
};

export default function CatalogoABM({ tipo, mostrarInactivos = false, onMostrarInactivosChange }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  
  // Estados para gestión de campos de tipo de impuesto
  const [camposDialogOpen, setCamposDialogOpen] = useState(false);
  const [editingCampo, setEditingCampo] = useState(null);
  const [campoFormData, setCampoFormData] = useState({ codigo: '', nombre: '', orden: 0 });
  const [campoErrorMessage, setCampoErrorMessage] = useState('');

  const config = CATALOGO_CONFIG[tipo] || { ...DEFAULT_CONFIG, title: tipo.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) };
  const fields = config.fields || DEFAULT_CONFIG.fields;

  // Obtener datos del catálogo
  const { data: items, isLoading } = useQuery({
    queryKey: ['catalogos-abm', tipo, mostrarInactivos],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (!mostrarInactivos) {
        params.set('mostrarInactivos', 'false');
      }
      const response = await api.get(`/catalogos-abm/${tipo}?${params.toString()}`);
      return response.data;
    }
  });

  // Obtener opciones para selects
  const selectFields = fields.filter(f => f.type === 'select');
  const selectQueries = {};
  
  selectFields.forEach(field => {
    const queryKey = `select-${field.optionsEndpoint}`;
    selectQueries[field.name] = useQuery({
      queryKey: [queryKey],
      queryFn: async () => {
        const response = await api.get(field.optionsEndpoint);
        return response.data;
      },
      enabled: !!field.optionsEndpoint
    });
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post(`/catalogos-abm/${tipo}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['catalogos-abm', tipo]);
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al crear el registro');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/catalogos-abm/${tipo}/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['catalogos-abm', tipo]);
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al actualizar el registro');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/catalogos-abm/${tipo}/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['catalogos-abm', tipo]);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al eliminar el registro');
    }
  });

  const resetForm = () => {
    const initialData = {};
    fields.forEach(field => {
      if (field.type === 'switch') {
        initialData[field.name] = field.name === 'activo' ? true : false;
      } else if (field.type === 'date') {
        initialData[field.name] = '';
      } else if (field.type === 'number') {
        initialData[field.name] = '';
      } else {
        initialData[field.name] = '';
      }
    });
    setFormData(initialData);
    setEditingItem(null);
    setErrorMessage('');
  };

  // Obtener campos de tipo de impuesto o cargo (solo si estamos editando tipos-impuesto-propiedad o tipos-cargo)
  const esTipoImpuesto = tipo === 'tipos-impuesto-propiedad';
  const esTipoCargo = tipo === 'tipos-cargo';
  const tipoImpuestoId = editingItem?.id;
  const tipoCargoId = editingItem?.id;
  
  const { data: campos } = useQuery({
    queryKey: esTipoImpuesto 
      ? ['tipos-impuesto-propiedad-campos', tipoImpuestoId]
      : ['tipos-cargo-campos', tipoCargoId],
    queryFn: async () => {
      if (esTipoImpuesto) {
        if (!tipoImpuestoId) return [];
        const response = await api.get(`/tipos-impuesto-propiedad-campos/tipo-impuesto/${tipoImpuestoId}`);
        return response.data;
      } else if (esTipoCargo) {
        if (!tipoCargoId) return [];
        const response = await api.get(`/tipos-cargo-campos/tipo-cargo/${tipoCargoId}`);
        return response.data;
      }
      return [];
    },
    enabled: (esTipoImpuesto && !!tipoImpuestoId) || (esTipoCargo && !!tipoCargoId)
  });

  const createCampoMutation = useMutation({
    mutationFn: async (data) => {
      if (esTipoImpuesto) {
        const response = await api.post('/tipos-impuesto-propiedad-campos', {
          ...data,
          tipoImpuestoId: tipoImpuestoId
        });
        return response.data;
      } else if (esTipoCargo) {
        const response = await api.post('/tipos-cargo-campos', {
          ...data,
          tipoCargoId: tipoCargoId
        });
        return response.data;
      }
    },
    onSuccess: () => {
      if (esTipoImpuesto) {
        queryClient.invalidateQueries(['tipos-impuesto-propiedad-campos', tipoImpuestoId]);
      } else if (esTipoCargo) {
        queryClient.invalidateQueries(['tipos-cargo-campos', tipoCargoId]);
      }
      setCamposDialogOpen(false);
      setCampoFormData({ codigo: '', nombre: '', orden: 0 });
      setEditingCampo(null);
      setCampoErrorMessage('');
    },
    onError: (error) => {
      setCampoErrorMessage(error.response?.data?.error || 'Error al crear el campo');
    }
  });

  const updateCampoMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (esTipoImpuesto) {
        const response = await api.put(`/tipos-impuesto-propiedad-campos/${id}`, data);
        return response.data;
      } else if (esTipoCargo) {
        const response = await api.put(`/tipos-cargo-campos/${id}`, data);
        return response.data;
      }
    },
    onSuccess: () => {
      if (esTipoImpuesto) {
        queryClient.invalidateQueries(['tipos-impuesto-propiedad-campos', tipoImpuestoId]);
      } else if (esTipoCargo) {
        queryClient.invalidateQueries(['tipos-cargo-campos', tipoCargoId]);
      }
      setCamposDialogOpen(false);
      setCampoFormData({ codigo: '', nombre: '', orden: 0 });
      setEditingCampo(null);
      setCampoErrorMessage('');
    },
    onError: (error) => {
      setCampoErrorMessage(error.response?.data?.error || 'Error al actualizar el campo');
    }
  });

  const deleteCampoMutation = useMutation({
    mutationFn: async (id) => {
      if (esTipoImpuesto) {
        await api.delete(`/tipos-impuesto-propiedad-campos/${id}`);
      } else if (esTipoCargo) {
        await api.delete(`/tipos-cargo-campos/${id}`);
      }
    },
    onSuccess: () => {
      if (esTipoImpuesto) {
        queryClient.invalidateQueries(['tipos-impuesto-propiedad-campos', tipoImpuestoId]);
      } else if (esTipoCargo) {
        queryClient.invalidateQueries(['tipos-cargo-campos', tipoCargoId]);
      }
    }
  });

  const handleOpenDialog = (item = null) => {
    if (item) {
      const editData = { ...item };
      // Convertir fechas para inputs de tipo date
      fields.forEach(field => {
        if (field.type === 'date' && editData[field.name]) {
          const date = new Date(editData[field.name]);
          editData[field.name] = date.toISOString().split('T')[0];
        }
        // Convertir números para inputs de tipo number
        if (field.type === 'number' && editData[field.name] !== null && editData[field.name] !== undefined) {
          editData[field.name] = String(editData[field.name]);
        }
      });
      setFormData(editData);
      setEditingItem(item);
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleOpenCampoDialog = (campo = null) => {
    if (campo) {
      setCampoFormData({ codigo: campo.codigo, nombre: campo.nombre, orden: campo.orden });
      setEditingCampo(campo);
    } else {
      setCampoFormData({ codigo: '', nombre: '', orden: campos?.length || 0 });
      setEditingCampo(null);
    }
    setCampoErrorMessage('');
    setCamposDialogOpen(true);
  };

  const handleSubmitCampo = (e) => {
    e.preventDefault();
    setCampoErrorMessage('');

    if (!campoFormData.codigo || !campoFormData.nombre) {
      setCampoErrorMessage('Código y nombre son obligatorios');
      return;
    }

    if (editingCampo) {
      updateCampoMutation.mutate({ id: editingCampo.id, data: campoFormData });
    } else {
      createCampoMutation.mutate(campoFormData);
    }
  };

  const handleDeleteCampo = (id) => {
    if (window.confirm('¿Está seguro de eliminar este campo?')) {
      deleteCampoMutation.mutate(id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Preparar datos para enviar
    const submitData = { ...formData };
    
    // Convertir campos numéricos
    fields.forEach(field => {
      if (field.type === 'number') {
        if (submitData[field.name] === '' || submitData[field.name] === null || submitData[field.name] === undefined) {
          submitData[field.name] = null;
        } else {
          const parsed = parseFloat(String(submitData[field.name]).replace(',', '.'));
          submitData[field.name] = isNaN(parsed) ? null : parsed;
        }
      }
    });

    // Validar campos requeridos
    const requiredFields = fields.filter(f => f.required);
    for (const field of requiredFields) {
      if (!submitData[field.name] || (typeof submitData[field.name] === 'string' && submitData[field.name].trim() === '')) {
        setErrorMessage(`El campo "${field.label}" es obligatorio`);
        return;
      }
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('¿Está seguro de eliminar este registro?')) {
      deleteMutation.mutate(id);
    }
  };

  const renderField = (field) => {
    const value = formData[field.name] || '';
    
    switch (field.type) {
      case 'select':
        const selectQuery = selectQueries[field.name];
        const options = selectQuery?.data || [];
        return (
          <FormControl fullWidth key={field.name} required={field.required}>
            <InputLabel>{field.label}</InputLabel>
            <Select
              value={value}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              label={field.label}
            >
              <MenuItem value="">
                <em>Seleccionar {field.label}</em>
              </MenuItem>
              {options.map((option) => (
                <MenuItem key={option.id} value={option[field.optionValue]}>
                  {option[field.optionLabel]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      
      case 'textarea':
        return (
          <TextField
            key={field.name}
            fullWidth
            label={field.label}
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
            multiline
            rows={3}
            required={field.required}
            placeholder={field.placeholder}
          />
        );
      
      case 'switch':
        return (
          <FormControlLabel
            key={field.name}
            control={
              <Switch
                checked={formData[field.name] !== undefined ? formData[field.name] : (field.name === 'activo' ? true : false)}
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })}
              />
            }
            label={field.label}
          />
        );
      
      case 'date':
        return (
          <TextField
            key={field.name}
            fullWidth
            label={field.label}
            type="date"
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
            required={field.required}
            InputLabelProps={{ shrink: true }}
          />
        );
      
      case 'number':
        return (
          <TextField
            key={field.name}
            fullWidth
            label={field.label}
            type="number"
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
            required={field.required}
            inputProps={{ 
              step: field.step || '1',
              style: { MozAppearance: 'textfield' },
              onWheel: (e) => e.target.blur()
            }}
            sx={{
              '& input[type=number]::-webkit-outer-spin-button': {
                WebkitAppearance: 'none',
                margin: 0
              },
              '& input[type=number]::-webkit-inner-spin-button': {
                WebkitAppearance: 'none',
                margin: 0
              }
            }}
            placeholder={field.placeholder}
          />
        );
      
      default:
        return (
          <TextField
            key={field.name}
            fullWidth
            label={field.label}
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
            required={field.required}
            placeholder={field.placeholder}
          />
        );
    }
  };

  const getDisplayValue = (item, fieldName) => {
    if (fieldName === 'provinciaId' && item.provincia) {
      return item.provincia.nombre;
    }
    if (fieldName === 'metodoAjusteContratoId' && item.metodoAjuste) {
      return item.metodoAjuste.nombre;
    }
    if (fieldName === 'esPorcentaje') {
      return item[fieldName] ? 'Sí' : 'No';
    }
    if (fieldName === 'valorDefault' && item[fieldName] !== null && item[fieldName] !== undefined) {
      const valor = parseFloat(item[fieldName]);
      let valorFormateado;
      // Si es un número entero, mostrarlo sin decimales
      if (Number.isInteger(valor)) {
        valorFormateado = valor.toString();
      } else {
        // Si tiene decimales, mostrar hasta 4 decimales
        valorFormateado = valor.toFixed(4);
      }
      // Si es porcentaje, agregar el símbolo % antes del valor
      if (item.esPorcentaje) {
        return `% ${valorFormateado}`;
      }
      return valorFormateado;
    }
    return item[fieldName];
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">{config.title}</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={mostrarInactivos}
                onChange={(e) => onMostrarInactivosChange(e.target.checked)}
              />
            }
            label="Mostrar inactivos"
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Nuevo
          </Button>
        </Box>
      </Box>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage('')}>
          {errorMessage}
        </Alert>
      )}

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {fields.filter(f => f.type !== 'switch').map(field => (
                <TableCell key={field.name}>{field.label}</TableCell>
              ))}
              <TableCell>Estado</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={fields.length + 2} align="center">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : items && items.length > 0 ? (
              items.map((item) => (
                <TableRow key={item.id}>
                  {fields.filter(f => f.type !== 'switch').map(field => (
                    <TableCell key={field.name}>
                      {getDisplayValue(item, field.name) || '-'}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Chip
                      label={item.activo ? 'Activo' : 'Inactivo'}
                      color={item.activo ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleOpenDialog(item)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(item.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={fields.length + 2} align="center">
                  No hay registros
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {editingItem ? 'Editar' : 'Nuevo'} {config.title}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {fields.map(field => renderField(field))}
            </Box>
            {errorMessage && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {errorMessage}
              </Alert>
            )}
            
            {/* Sección de campos para tipos de impuesto */}
            {(esTipoImpuesto || esTipoCargo) && editingItem && (
              <>
                <Divider sx={{ my: 3 }} />
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">{esTipoImpuesto ? 'Campos del Impuesto' : 'Campos del Cargo'}</Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenCampoDialog()}
                    >
                      Agregar Campo
                    </Button>
                  </Box>
                  
                  {campos && campos.length > 0 ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Código</TableCell>
                            <TableCell>Nombre</TableCell>
                            <TableCell>Orden</TableCell>
                            <TableCell>Acciones</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {campos.map((campo) => (
                            <TableRow key={campo.id}>
                              <TableCell>{campo.codigo}</TableCell>
                              <TableCell>{campo.nombre}</TableCell>
                              <TableCell>{campo.orden}</TableCell>
                              <TableCell>
                                <IconButton size="small" onClick={() => handleOpenCampoDialog(campo)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => handleDeleteCampo(campo.id)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No hay campos configurados. Agregue campos para este tipo de impuesto.
                    </Typography>
                  )}
                </Box>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isLoading || updateMutation.isLoading}>
              Guardar
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog para gestionar campos */}
      {(esTipoImpuesto || esTipoCargo) && (
        <Dialog open={camposDialogOpen} onClose={() => setCamposDialogOpen(false)} maxWidth="sm" fullWidth>
          <form onSubmit={handleSubmitCampo}>
            <DialogTitle>
              {editingCampo ? 'Editar Campo' : 'Nuevo Campo'}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                <TextField
                  fullWidth
                  label="Código"
                  value={campoFormData.codigo}
                  onChange={(e) => setCampoFormData({ ...campoFormData, codigo: e.target.value })}
                  required
                  placeholder="Ej: CUENTA, PARTIDA, PADRON"
                />
                <TextField
                  fullWidth
                  label="Nombre"
                  value={campoFormData.nombre}
                  onChange={(e) => setCampoFormData({ ...campoFormData, nombre: e.target.value })}
                  required
                  placeholder="Ej: Nº de cuenta, Partida, Padrón"
                />
                <TextField
                  fullWidth
                  label="Orden"
                  type="number"
                  value={campoFormData.orden}
                  onChange={(e) => setCampoFormData({ ...campoFormData, orden: parseInt(e.target.value) || 0 })}
                />
              </Box>
              {campoErrorMessage && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {campoErrorMessage}
                </Alert>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCamposDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="contained" disabled={createCampoMutation.isLoading || updateCampoMutation.isLoading}>
                Guardar
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      )}
    </Paper>
  );
}

