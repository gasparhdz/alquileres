import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
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
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import dayjs from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import api from '../api';
import ParametroSelect from '../components/ParametroSelect';
import ConfirmDialog from '../components/ConfirmDialog';
import { useParametrosMap } from '../utils/parametros';
import CatalogoABM from '../components/CatalogoABM';

// Función helper para convertir YYYY-MM a MM-AAAA (para mostrar al usuario)
const formatPeriodo = (periodo) => {
  if (!periodo) return '-';
  // Si ya está en formato MM-AAAA, devolverlo tal cual
  if (/^\d{2}-\d{4}$/.test(periodo)) return periodo;
  // Si está en formato YYYY-MM, convertirlo a MM-AAAA
  if (/^\d{4}-\d{2}$/.test(periodo)) {
    return periodo.replace(/^(\d{4})-(\d{2})$/, '$2-$1');
  }
  return periodo;
};

const INDICES_CODE = '__indices__';

// Catálogos de sistema que el usuario final no debe editar/eliminar (ocultos en Configuración)
const CATALOGOS_BLACKLIST = [
  'estados-contrato',           // Estados de Contrato
  'estados-garantia-contrato',  // Estados de Garantía
  'estados-item-liquidacion',   // Estados de Item Liquidación
  'estados-liquidacion',        // Estados de Liquidación
  'estados-propiedad',          // Estados de Propiedad
  'periodicidades-impuesto',    // Periodicidades
  'actores-responsable-contrato', // Responsables
  'tipos-persona',              // Tipos de Persona
  'tipos-documento-propiedad',  // Tipos de Documento
  'indices-ajuste',            // Valores Índices de Ajuste
  'tipos-cargo',                // Tipos de Cargo
  'tipos-expensa',              // Tipos de Expensa
  'tipos-impuesto-propiedad',   // Tipos de Impuesto
  'tipos-gasto-inicial-contrato', // Tipos de Gasto Inicial
];

// Lista de catálogos disponibles (los de CATALOGOS_BLACKLIST se filtran al armar el menú)
const CATALOGOS = [
  { codigo: 'tipos-persona', nombre: 'Tipos de Persona' },
  { codigo: 'provincias', nombre: 'Provincias' },
  { codigo: 'localidades', nombre: 'Localidades' },
  { codigo: 'condiciones-iva', nombre: 'Condiciones IVA' },
  { codigo: 'ambientes-propiedad', nombre: 'Ambientes de Propiedad' },
  { codigo: 'tipos-propiedad', nombre: 'Tipos de Propiedad' },
  { codigo: 'estados-propiedad', nombre: 'Estados de Propiedad' },
  { codigo: 'destinos-propiedad', nombre: 'Destinos de Propiedad' },
  { codigo: 'tipos-impuesto-propiedad', nombre: 'Tipos de Impuesto' },
  { codigo: 'oficinas-virtuales', nombre: 'Oficinas Virtuales' },
  { codigo: 'tipos-cargo', nombre: 'Tipos de Cargo' },
  { codigo: 'tipos-expensa', nombre: 'Tipos de Expensa' },
  { codigo: 'periodicidades-impuesto', nombre: 'Periodicidades' },
  { codigo: 'tipos-documento-propiedad', nombre: 'Tipos de Documento' },
  { codigo: 'monedas', nombre: 'Monedas' },
  { codigo: 'estados-contrato', nombre: 'Estados de Contrato' },
  { codigo: 'metodos-ajuste-contrato', nombre: 'Índices de Ajuste' },
  { codigo: 'indices-ajuste', nombre: 'Valores Índices de Ajuste' },
  { codigo: 'actores-responsable-contrato', nombre: 'Responsables' },
  { codigo: 'tipos-garantia-contrato', nombre: 'Tipos de Garantía' },
  { codigo: 'estados-garantia-contrato', nombre: 'Estados de Garantía' },
  { codigo: 'tipos-gasto-inicial-contrato', nombre: 'Tipos de Gasto Inicial' },
  { codigo: 'estados-liquidacion', nombre: 'Estados de Liquidación' },
  { codigo: 'estados-item-liquidacion', nombre: 'Estados de Item Liquidación' }
];

const emptyParametroForm = {
  codigo: '',
  descripcion: '',
  abreviatura: '',
  labelCodigo1: '',
  labelCodigo2: '',
  periodicidadPorDefecto: '',
  orden: '',
  activo: true
};

const emptyIndiceForm = {
  codigo: '',
  descripcion: '',
  periodo: dayjs().format('YYYY-MM'),
  valor: '',
  variacion: '',
  fuente: '',
  fechaPublicacion: dayjs().format('YYYY-MM-DD'),
  activo: true
};

function ParametrosCategoriaSection({
  categoria,
  mostrarInactivos,
  onMostrarInactivosChange,
  categorias = [],
  selectedCategoriaCodigo,
  onCategoriaChange
}) {
  if (!categoria?.parametroCodigo) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography color="text.secondary">Seleccioná una categoría para ver sus parámetros.</Typography>
      </Paper>
    );
  }

  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formValues, setFormValues] = useState(emptyParametroForm);
  const [editingParametro, setEditingParametro] = useState(null);
  const [parametroADesactivar, setParametroADesactivar] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Obtener parámetros de periodicidad para el selector y la tabla
  const periodicidadData = useParametrosMap('periodicidad');

  const {
    data: parametros,
    isLoading,
    isFetching
  } = useQuery({
    queryKey: ['configuracion', 'parametros', categoria.parametroCodigo, mostrarInactivos],
    enabled: !!categoria?.parametroCodigo,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('categoriaCodigo', categoria.parametroCodigo);
      if (!mostrarInactivos) {
        params.set('activo', 'true');
      }
      const response = await api.get(`/parametros/parametros?${params.toString()}`);
      return response.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.post('/parametros/parametros', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['configuracion', 'parametros', categoria.parametroCodigo]);
      setDialogOpen(false);
      setFormValues(emptyParametroForm);
      setEditingParametro(null);
      setErrorMessage('');
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'No se pudo crear el parámetro');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/parametros/parametros/${id}`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries(['configuracion', 'parametros', categoria.parametroCodigo]);
      if (!variables?.skipClose) {
        setDialogOpen(false);
        setEditingParametro(null);
        setFormValues(emptyParametroForm);
      }
      setErrorMessage('');
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'No se pudo actualizar el parámetro');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/parametros/parametros/${id}`);
      return response.data;
    },
    onSuccess: () => {
      setParametroADesactivar(null);
      queryClient.invalidateQueries(['configuracion', 'parametros', categoria.parametroCodigo]);
      setErrorMessage('');
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'No se pudo desactivar el parámetro');
    }
  });

  const handleOpenNew = () => {
    setFormValues({
      ...emptyParametroForm,
      orden: parametros && parametros.length ? String(parametros.length + 1) : '',
      labelCodigo1: '',
      labelCodigo2: ''
    });
    setEditingParametro(null);
    setErrorMessage('');
    setDialogOpen(true);
  };

  const handleEdit = (parametro) => {
    setFormValues({
      codigo: parametro.codigo || '',
      descripcion: parametro.descripcion || '',
      abreviatura: parametro.abreviatura || '',
      labelCodigo1: parametro.labelCodigo1 || '',
      labelCodigo2: parametro.labelCodigo2 || '',
      periodicidadPorDefecto: parametro.periodicidadPorDefecto || '',
      orden: parametro.orden !== null && parametro.orden !== undefined ? String(parametro.orden) : '',
      activo: Boolean(parametro.activo)
    });
    setEditingParametro(parametro);
    setErrorMessage('');
    setDialogOpen(true);
  };

  const handleToggleActivo = (parametro) => {
    if (updateMutation.isLoading) return;
    updateMutation.mutate({
      id: parametro.id,
      data: { activo: !parametro.activo },
      skipClose: true
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = {
      categoriaCodigo: categoria.parametroCodigo,
      codigo: formValues.codigo.trim(),
      descripcion: formValues.descripcion.trim(),
      abreviatura: formValues.abreviatura ? formValues.abreviatura.trim() : null,
      labelCodigo1: formValues.labelCodigo1 ? formValues.labelCodigo1.trim() : null,
      labelCodigo2: formValues.labelCodigo2 ? formValues.labelCodigo2.trim() : null,
      periodicidadPorDefecto: formValues.periodicidadPorDefecto || null,
      orden: formValues.orden !== '' ? Number(formValues.orden) : 0,
      activo: Boolean(formValues.activo)
    };

    if (!payload.codigo || !payload.descripcion) {
      setErrorMessage('Código y descripción son obligatorios');
      return;
    }

    if (editingParametro) {
      updateMutation.mutate({ id: editingParametro.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (parametro) => {
    setParametroADesactivar(parametro);
  };

  return (
    <Paper sx={{ p: 2 }}>
      <ConfirmDialog
        open={!!parametroADesactivar}
        onClose={() => setParametroADesactivar(null)}
        title="Desactivar parámetro"
        message="¿Seguro que desea desactivar este parámetro?"
        confirmLabel="Desactivar"
        confirmColor="error"
        loading={deleteMutation.isLoading}
        onConfirm={() => parametroADesactivar && deleteMutation.mutate(parametroADesactivar.id)}
      />
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} mb={1.5} flexWrap="wrap">
        <Box>
          <Typography variant="h5">{categoria.descripcion}</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
          <FormControlLabel
            control={
              <Switch
                checked={mostrarInactivos}
                onChange={(e) => onMostrarInactivosChange(e.target.checked)}
                size="small"
              />
            }
            label="Ver inactivos"
          />
          <Tooltip title="Actualizar">
            <span>
              <IconButton
                onClick={() =>
                  queryClient.invalidateQueries(['configuracion', 'parametros', categoria.parametroCodigo])
                }
                disabled={isFetching}
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNew}>
            Nuevo parámetro
          </Button>
        </Stack>
      </Stack>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 0 }}>
        <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.875rem' }, '& .MuiTableCell-head': { py: 0.5, px: 1 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: categoria.parametroCodigo === 'tipo_cargo' ? '12%' : '15%' }}>Código</TableCell>
              <TableCell sx={{ width: categoria.parametroCodigo === 'tipo_cargo' ? '25%' : '30%' }}>Descripción</TableCell>
              <TableCell sx={{ width: categoria.parametroCodigo === 'tipo_cargo' ? '12%' : '15%' }}>Abreviatura</TableCell>
              {categoria.parametroCodigo === 'tipo_cargo' && (
                <TableCell sx={{ width: '15%' }}>Periodicidad por defecto</TableCell>
              )}
              <TableCell sx={{ width: categoria.parametroCodigo === 'tipo_cargo' ? '8%' : '10%' }}>Orden</TableCell>
              <TableCell sx={{ width: categoria.parametroCodigo === 'tipo_cargo' ? '12%' : '15%' }}>Estado</TableCell>
              <TableCell sx={{ width: categoria.parametroCodigo === 'tipo_cargo' ? '16%' : '15%' }} align="right">
                Acciones
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!isLoading && (!parametros || parametros.length === 0) && (
              <TableRow>
                <TableCell colSpan={categoria.parametroCodigo === 'tipo_cargo' ? 7 : 6} align="center">
                  No hay parámetros registrados para esta categoría.
                </TableCell>
              </TableRow>
            )}
            {parametros?.map((parametro) => {
              const periodicidadDefecto = parametro.periodicidadPorDefecto 
                ? periodicidadData.parametros?.[parametro.periodicidadPorDefecto]?.descripcion || '-'
                : '-';
              
              return (
                <TableRow key={parametro.id} hover sx={{ '& .MuiTableCell-root': { verticalAlign: 'middle' } }}>
                  <TableCell>{parametro.codigo}</TableCell>
                  <TableCell>{parametro.descripcion}</TableCell>
                  <TableCell>{parametro.abreviatura || '-'}</TableCell>
                  {categoria.parametroCodigo === 'tipo_cargo' && (
                    <TableCell>{periodicidadDefecto}</TableCell>
                  )}
                  <TableCell>{parametro.orden ?? '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={parametro.activo ? 'Activo' : 'Inactivo'}
                      color={parametro.activo ? 'success' : 'default'}
                      size="small"
                      sx={{ height: 22, fontSize: '0.75rem' }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.5 }}>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleEdit(parametro)} sx={{ padding: '4px' }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={parametro.activo ? 'Desactivar' : 'Activar'}>
                        <Switch
                          edge="end"
                          size="small"
                          checked={parametro.activo}
                          onChange={() => handleToggleActivo(parametro)}
                          disabled={updateMutation.isLoading}
                          sx={{ transform: 'scale(0.85)' }}
                        />
                      </Tooltip>
                      <Tooltip title="Desactivar definitivamente">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(parametro)}
                            disabled={deleteMutation.isLoading}
                            sx={{ padding: '4px' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {editingParametro ? 'Editar parámetro' : 'Nuevo parámetro'}
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Código"
              value={formValues.codigo}
              onChange={(e) => setFormValues({ ...formValues, codigo: e.target.value })}
              required
              autoFocus
            />
            <TextField
              label="Descripción"
              value={formValues.descripcion}
              onChange={(e) => setFormValues({ ...formValues, descripcion: e.target.value })}
              required
            />
            <TextField
              label="Abreviatura"
              value={formValues.abreviatura}
              onChange={(e) => setFormValues({ ...formValues, abreviatura: e.target.value })}
            />
            {categoria.parametroCodigo === 'tipo_cargo' && (
              <>
                <TextField
                  label="Label Código 1"
                  value={formValues.labelCodigo1}
                  onChange={(e) => setFormValues({ ...formValues, labelCodigo1: e.target.value })}
                  placeholder="Ej: Número de cuenta"
                  helperText="Nombre que se mostrará para el campo Código 1 (opcional)"
                />
                <TextField
                  label="Label Código 2"
                  value={formValues.labelCodigo2}
                  onChange={(e) => setFormValues({ ...formValues, labelCodigo2: e.target.value })}
                  placeholder="Ej: Código de barra"
                  helperText="Nombre que se mostrará para el campo Código 2 (opcional)"
                />
                <ParametroSelect
                  categoriaCodigo="periodicidad"
                  label="Periodicidad por defecto"
                  value={formValues.periodicidadPorDefecto}
                  onChange={(e) => setFormValues({ ...formValues, periodicidadPorDefecto: e.target.value })}
                  required={false}
                  helperText="Periodicidad que se precargará automáticamente al asociar este impuesto a una propiedad (opcional)"
                />
              </>
            )}
            <TextField
              label="Orden"
              type="number"
              value={formValues.orden}
              onChange={(e) => setFormValues({ ...formValues, orden: e.target.value })}
              inputProps={{ 
                min: 0,
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
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formValues.activo}
                  onChange={(e) => setFormValues({ ...formValues, activo: e.target.checked })}
                />
              }
              label="Activo"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isLoading || updateMutation.isLoading}
            >
              Guardar
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Paper>
  );
}

function IndicesSection({
  categorias = [],
  selectedCategoriaCodigo,
  onCategoriaChange,
  showInactiveSwitch = false,
  mostrarInactivos = false,
  onMostrarInactivosChange
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formValues, setFormValues] = useState(emptyIndiceForm);
  const [errorMessage, setErrorMessage] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [selectedTipoIndice, setSelectedTipoIndice] = useState('');

  // Primera query para obtener todos los índices (sin filtro) para obtener los códigos únicos
  const {
    data: allIndicesResponse,
    isLoading: isLoadingAll
  } = useQuery({
    queryKey: ['configuracion', 'indices', 'all'],
    queryFn: async () => {
      const response = await api.get('/indices', {
        params: { page: 1, limit: 1000 }
      });
      return response.data;
    }
  });

  // Obtener códigos únicos de índices disponibles
  const tiposIndiceDisponibles = useMemo(() => {
    const allIndices = allIndicesResponse?.data || [];
    const codigosUnicos = [...new Set(allIndices.map(indice => indice.codigo).filter(Boolean))];
    return codigosUnicos.sort();
  }, [allIndicesResponse]);

  // Query filtrada por tipo de índice seleccionado
  const {
    data: indicesResponse,
    isLoading,
    isFetching
  } = useQuery({
    queryKey: ['configuracion', 'indices', selectedTipoIndice],
    queryFn: async () => {
      const params = { page: 1, limit: 1000 };
      if (selectedTipoIndice) {
        params.codigo = selectedTipoIndice;
      }
      const response = await api.get('/indices', { params });
      return response.data;
    },
    enabled: !isLoadingAll
  });

  const indices = indicesResponse?.data || [];

  const createIndiceMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.post('/indices', payload);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['configuracion', 'indices']);
      setDialogOpen(false);
      setFormValues(emptyIndiceForm);
      setErrorMessage('');
      setSyncMessage('Índice creado correctamente');
      // Si se creó un índice de un tipo diferente al filtro actual, cambiar el filtro al nuevo tipo
      if (data?.codigo && data.codigo !== selectedTipoIndice) {
        setSelectedTipoIndice(data.codigo);
      }
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'No se pudo crear el índice');
    }
  });

  const handleSyncIPC = async () => {
    try {
      setSyncing(true);
      setErrorMessage('');
      setSyncMessage('');
      const response = await api.post('/indices/sync/ipc');
      await queryClient.invalidateQueries(['configuracion', 'indices']);
      setSyncMessage(response.data?.message || 'Sincronización de IPC completada');
      // Si no hay filtro seleccionado o está filtrando por IPC, mantener o establecer el filtro IPC
      if (!selectedTipoIndice || selectedTipoIndice === 'ipc') {
        setSelectedTipoIndice('ipc');
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'No se pudo sincronizar el IPC');
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const payload = {
      codigo: formValues.codigo.trim(),
      descripcion: formValues.descripcion.trim(),
      periodo: formValues.periodo,
      valor: formValues.valor,
      variacion: formValues.variacion || undefined,
      fuente: formValues.fuente?.trim() || undefined,
      fechaPublicacion: formValues.fechaPublicacion,
      activo: formValues.activo
    };

    if (!payload.codigo || !payload.descripcion || !payload.periodo || !payload.valor || !payload.fechaPublicacion) {
      setErrorMessage('Código, descripción, período, valor y fecha de publicación son obligatorios');
      return;
    }

    createIndiceMutation.mutate(payload);
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} mb={1.5} flexWrap="wrap">
        <Box>
          <Typography variant="h5">Índices de ajuste</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="tipo-indice-selector">Tipo de índice</InputLabel>
            <Select
              labelId="tipo-indice-selector"
              value={selectedTipoIndice}
              label="Tipo de índice"
              onChange={(e) => setSelectedTipoIndice(e.target.value)}
            >
              <MenuItem value="">
                <em>Todos</em>
              </MenuItem>
              {tiposIndiceDisponibles.map((codigo) => (
                <MenuItem key={codigo} value={codigo}>
                  {codigo.toUpperCase()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {showInactiveSwitch && (
            <FormControlLabel
              control={
                <Switch
                  checked={mostrarInactivos}
                  onChange={(e) => onMostrarInactivosChange?.(e.target.checked)}
                  size="small"
                />
              }
              label="Ver inactivos"
            />
          )}
          <Button
            variant="outlined"
            onClick={handleSyncIPC}
            disabled={syncing || isFetching}
          >
            {syncing ? 'Sincronizando IPC...' : 'Sincronizar IPC'}
          </Button>
          <Tooltip title="Actualizar">
            <span>
              <IconButton
                onClick={() => {
                  queryClient.invalidateQueries(['configuracion', 'indices']);
                }}
                disabled={isFetching}
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setFormValues({
                ...emptyIndiceForm,
                codigo: selectedTipoIndice || ''
              });
              setDialogOpen(true);
            }}
          >
            Nuevo índice
          </Button>
        </Stack>
      </Stack>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}
      {syncMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {syncMessage}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 0 }}>
        <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.875rem' }, '& .MuiTableCell-head': { py: 0.5, px: 1 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '12%' }}>Código</TableCell>
              <TableCell sx={{ width: '20%' }}>Descripción</TableCell>
              <TableCell sx={{ width: '12%' }}>Período</TableCell>
              <TableCell sx={{ width: '12%' }}>Valor</TableCell>
              <TableCell sx={{ width: '12%' }}>Variación %</TableCell>
              <TableCell sx={{ width: '16%' }}>Fuente</TableCell>
              <TableCell sx={{ width: '10%' }}>Estado</TableCell>
              <TableCell sx={{ width: '6%' }}>Publicación</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!isLoading && indices.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No hay índices registrados.
                </TableCell>
              </TableRow>
            )}
            {indices.map((indice) => (
              <TableRow key={`${indice.codigo}-${indice.periodo}`} hover sx={{ '& .MuiTableCell-root': { verticalAlign: 'middle' } }}>
                <TableCell>{indice.codigo}</TableCell>
                <TableCell>{indice.descripcion}</TableCell>
                <TableCell>{formatPeriodo(indice.periodo)}</TableCell>
                <TableCell>{indice.valor}</TableCell>
                <TableCell>{indice.variacion ?? '-'}</TableCell>
                <TableCell>{indice.fuente || '-'}</TableCell>
                <TableCell>
                  <Chip
                    label={indice.activo ? 'Activo' : 'Inactivo'}
                    color={indice.activo ? 'success' : 'default'}
                    size="small"
                    sx={{ height: 22, fontSize: '0.75rem' }}
                  />
                </TableCell>
                <TableCell>{dayjs(indice.fechaPublicacion).format('DD/MM/YYYY')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>Nuevo índice de ajuste</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Autocomplete
              freeSolo
              options={tiposIndiceDisponibles}
              value={formValues.codigo}
              onInputChange={(event, newValue) => {
                setFormValues({ ...formValues, codigo: newValue || '' });
              }}
              onChange={(event, newValue) => {
                setFormValues({ ...formValues, codigo: newValue || '' });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Código"
                  required
                  autoFocus
                  helperText="Seleccioná un tipo existente o escribí uno nuevo"
                />
              )}
              getOptionLabel={(option) => (typeof option === 'string' ? option.toUpperCase() : option.toUpperCase())}
            />
            <TextField
              label="Descripción"
              value={formValues.descripcion}
              onChange={(e) => setFormValues({ ...formValues, descripcion: e.target.value })}
              required
            />
            <TextField
              label="Período"
              type="month"
              value={formValues.periodo}
              onChange={(e) => setFormValues({ ...formValues, periodo: e.target.value })}
              required
            />
            <TextField
              label="Valor"
              type="number"
              inputProps={{ 
                step: '0.000001',
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
              value={formValues.valor}
              onChange={(e) => setFormValues({ ...formValues, valor: e.target.value })}
              required
            />
            <TextField
              label="Variación (%)"
              type="number"
              inputProps={{ 
                step: '0.0001',
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
              value={formValues.variacion}
              onChange={(e) => setFormValues({ ...formValues, variacion: e.target.value })}
            />
            <TextField
              label="Fuente"
              value={formValues.fuente}
              onChange={(e) => setFormValues({ ...formValues, fuente: e.target.value })}
            />
            <DatePicker
              label="Fecha de publicación"
              value={formValues.fechaPublicacion ? dayjs(formValues.fechaPublicacion) : null}
              onChange={(newValue) => setFormValues({ ...formValues, fechaPublicacion: newValue ? newValue.format('YYYY-MM-DD') : '' })}
              slotProps={{
                textField: {
                  required: true,
                  fullWidth: true
                },
                actionBar: {
                  actions: ['clear', 'today']
                }
              }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formValues.activo}
                  onChange={(e) => setFormValues({ ...formValues, activo: e.target.checked })}
                />
              }
              label="Activo"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createIndiceMutation.isLoading}
            >
              Guardar
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Paper>
  );
}

export default function Configuracion() {
  const [selectedCategoriaCodigo, setSelectedCategoriaCodigo] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const { data: categorias, isLoading } = useQuery({
    queryKey: ['configuracion', 'categorias'],
    queryFn: async () => {
      const response = await api.get('/parametros/categorias');
      return response.data;
    }
  });

  const categoriasConIndices = useMemo(() => {
    const lista = [];

    // Categorías del API que no agregar: ya están en CATALOGOS o no tienen datos (evitar ítems que no levantan nada)
    const codigosApiQueOmitir = [
      'estado_liquidacion',  // = "Estados de Liquidación" (catálogo estados-liquidacion)
      'tipo_impuesto',       // = "Impuestos y servicios" (usa endpoint genérico vacío; usar catálogos Tipos de Impuesto / Tipos de Cargo)
      'tipo_cargo'          // = "Tipos de Cargo" (catálogo tipos-cargo)
    ];

    // Agregar categorías de parámetros si existen
    if (categorias && categorias.length > 0) {
      categorias.forEach((cat) => {
        if (codigosApiQueOmitir.includes(cat.codigo)) {
          return; // Ya en CATALOGOS o sin datos, evitar duplicado
        }

        lista.push({
          codigo: cat.codigo,
          parametroCodigo: cat.codigo,
          descripcion: cat.descripcion,
          totalParametros: cat._count?.parametros || 0,
          especial: false
        });
      });
    }

    /*// Siempre agregar Índices de ajuste
    lista.push({
      codigo: INDICES_CODE,
      parametroCodigo: INDICES_CODE,
      descripcion: 'Índices de ajuste',
      totalParametros: null,
      especial: true
    });*/

    // Agregar cada catálogo permitido como opción (excluir tablas de sistema en CATALOGOS_BLACKLIST)
    CATALOGOS.filter((cat) => !CATALOGOS_BLACKLIST.includes(cat.codigo)).forEach((cat) => {
      lista.push({
        codigo: `catalogo-${cat.codigo}`,
        parametroCodigo: `catalogo-${cat.codigo}`,
        descripcion: cat.nombre,
        totalParametros: null,
        especial: true,
        catalogoTipo: cat.codigo
      });
    });

    // Ordenar alfabéticamente por descripción
    return lista.sort((a, b) => a.descripcion.localeCompare(b.descripcion));
  }, [categorias]);

  useEffect(() => {
    if (!isLoading && categoriasConIndices.length > 0) {
      setSelectedCategoriaCodigo((prev) => {
        if (prev && categoriasConIndices.some((cat) => cat.codigo === prev)) {
          return prev;
        }
        return categoriasConIndices[0].codigo;
      });
    }
  }, [isLoading, categoriasConIndices]);

  useEffect(() => {
    if (selectedCategoriaCodigo === INDICES_CODE) {
      setMostrarInactivos(false);
    }
  }, [selectedCategoriaCodigo]);

  const categoriaSeleccionada = categoriasConIndices.find(
    (cat) => cat.codigo === selectedCategoriaCodigo
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Configuración
        </Typography>
        {categoriasConIndices.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 250 }}>
            <InputLabel>Sección</InputLabel>
            <Select
              value={selectedCategoriaCodigo}
              onChange={(e) => setSelectedCategoriaCodigo(e.target.value)}
              label="Sección"
            >
              {categoriasConIndices.map((cat) => (
                <MenuItem key={cat.codigo} value={cat.codigo}>
                  {cat.descripcion}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {!isLoading && categoriasConIndices.length === 0 ? (
        <Paper sx={{ p: 3 }}>No hay categorías configuradas.</Paper>
      ) : (
        categoriaSeleccionada ? (
          categoriaSeleccionada.codigo === INDICES_CODE ? (
            <IndicesSection
              categorias={categoriasConIndices}
              selectedCategoriaCodigo={selectedCategoriaCodigo}
              onCategoriaChange={setSelectedCategoriaCodigo}
            />
          ) : categoriaSeleccionada.catalogoTipo ? (
            <CatalogoABM
              tipo={categoriaSeleccionada.catalogoTipo}
              mostrarInactivos={mostrarInactivos}
              onMostrarInactivosChange={setMostrarInactivos}
            />
          ) : (
            <ParametrosCategoriaSection
              categoria={categoriaSeleccionada}
              mostrarInactivos={mostrarInactivos}
              onMostrarInactivosChange={setMostrarInactivos}
              categorias={categoriasConIndices}
              selectedCategoriaCodigo={selectedCategoriaCodigo}
              onCategoriaChange={setSelectedCategoriaCodigo}
            />
          )
        ) : (
          <Paper sx={{ p: 3 }}>Seleccioná una sección para continuar.</Paper>
        )
      )}
    </Box>
  );
}


