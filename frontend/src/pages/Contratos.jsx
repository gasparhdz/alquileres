import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
  FormControlLabel,
  Switch,
  Stack,
  CircularProgress,
  FormHelperText,
  InputAdornment
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

// Función para formatear número con separadores de miles
const formatNumberWithThousands = (value) => {
  if (!value && value !== 0) return '';
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
  if (isNaN(numValue)) return '';
  return numValue.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

// Función para parsear número removiendo separadores de miles
const parseNumberFromFormatted = (value) => {
  if (!value) return '';
  // Remover todos los puntos (separadores de miles) y reemplazar coma por punto
  const cleaned = value.toString().replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? '' : parsed.toString();
};

export default function Contratos() {
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [selectedContrato, setSelectedContrato] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [formData, setFormData] = useState({
    unidadId: '',
    inquilinoId: '',
    nroContrato: '',
    fechaInicio: '',
    fechaFin: '',
    duracionMeses: '',
    montoInicial: '',
    montoActual: '',
    gastosAdministrativos: '',
    honorariosPropietario: '',
    metodoAjuste: '',
    frecuenciaAjusteMeses: '',
    indiceAumento: '',
    periodoAumento: '',
    ultimoAjusteAt: '',
    registradoAfip: false,
    moneda: 'ARS',
    estado: ''
  });
  const [propietarioNombre, setPropietarioNombre] = useState('');
  const [montoTotalContrato, setMontoTotalContrato] = useState(0);
  const [ultimaFechaFinCalculada, setUltimaFechaFinCalculada] = useState(null);
  const [errors, setErrors] = useState({});
  // Estados temporales para pestañas (se guardan al crear el contrato)
  const [responsabilidadesTemporales, setResponsabilidadesTemporales] = useState([]);
  const [garantiasTemporales, setGarantiasTemporales] = useState([]);
  const [gastosInicialesTemporales, setGastosInicialesTemporales] = useState([]);
  // Estado para filtro
  const [filtroEstado, setFiltroEstado] = useState('');

  const queryClient = useQueryClient();

  // Obtener parámetros de moneda para establecer valor por defecto
  const monedaData = useParametrosMap('moneda');

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
      const response = await api.get('/unidades?activo=true');
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

  // Obtener unidad seleccionada para mostrar propietario
  const unidadSeleccionada = useMemo(() => {
    if (!formData.unidadId || !unidades?.data) return null;
    return unidades.data.find(u => u.id === formData.unidadId);
  }, [formData.unidadId, unidades]);

  const { data: indicesAjusteActivos } = useQuery({
    queryKey: ['indices-ajuste', 'activos'],
    queryFn: async () => {
      const response = await api.get('/indices', {
        params: {
          limit: 200,
          activo: true
        }
      });
      return response.data;
    }
  });

  // Obtener mapas de parámetros para mostrar descripciones
  const metodoAjusteMap = useParametrosMap('metodo_ajuste');
  const monedaMap = useParametrosMap('moneda');
  const estadoContratoMap = useParametrosMap('estado_contrato');

  // Filtrar contratos por estado
  const contratosFiltrados = useMemo(() => {
    if (!data?.data) return [];
    if (!filtroEstado) return data.data;
    return data.data.filter(contrato => {
      // Si el filtro es 'vencido', verificar si la fechaFin < hoy
      if (filtroEstado === 'vencido') {
        if (!contrato.fechaFin) return false;
        const fechaFin = dayjs(contrato.fechaFin);
        const hoy = dayjs();
        // Un contrato está vencido si la fecha fin pasó y no está finalizado, anulado, cancelado o rescindido
        return fechaFin.isBefore(hoy, 'day') && 
               !['finalizado', 'anulado', 'cancelado', 'rescindido'].includes(contrato.estado);
      }
      return contrato.estado === filtroEstado;
    });
  }, [data?.data, filtroEstado]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Crear el contrato
      const contratoResponse = await api.post('/contratos', data);
      const contratoCreado = contratoResponse.data;
      
      // Guardar responsabilidades, garantías y gastos iniciales
      const promises = [];
      
      // Guardar responsabilidades
      if (responsabilidadesTemporales.length > 0) {
        responsabilidadesTemporales.forEach(resp => {
          promises.push(
            api.post(`/contratos/${contratoCreado.id}/responsabilidades`, resp)
          );
        });
      }
      
      // Guardar garantías
      if (garantiasTemporales.length > 0) {
        garantiasTemporales.forEach(garantia => {
          promises.push(
            api.post(`/contratos/${contratoCreado.id}/garantias`, garantia)
          );
        });
      }
      
      // Guardar gastos iniciales
      console.log('📊 Gastos temporales al crear contrato:', gastosInicialesTemporales);
      if (gastosInicialesTemporales.length > 0) {
        gastosInicialesTemporales.forEach(gasto => {
          // Validar que el gasto tenga tipoGastoInicial válido
          if (!gasto.tipoGastoInicial) {
            console.warn('⚠️ Gasto sin tipoGastoInicial:', gasto);
            return;
          }
          
          const importeNum = parseFloat(parseNumberFromFormatted(gasto.importe || '0'));
          console.log(`💰 Guardando gasto: ${gasto.tipoGastoInicialCodigo}, importe: ${importeNum}, tipoGastoInicial: ${gasto.tipoGastoInicial}`);
          // Guardar todos los gastos, incluso con importe 0 (pueden ser editados después)
          // Solo validar que el importe sea un número válido (puede ser 0)
          if (!isNaN(importeNum) && importeNum >= 0) {
            promises.push(
              api.post(`/contratos/${contratoCreado.id}/gastos-iniciales`, {
                tipoGastoInicial: gasto.tipoGastoInicial,
                valorCalculo: gasto.valorCalculo ? parseFloat(gasto.valorCalculo) : null,
                importe: importeNum,
                estado: gasto.estado || null,
                observaciones: gasto.observaciones || null
              }).then(response => {
                console.log(`✅ Gasto guardado: ${gasto.tipoGastoInicialCodigo}`, response.data);
                return response;
              }).catch(error => {
                console.error(`❌ Error al guardar gasto: ${gasto.tipoGastoInicialCodigo}`, error);
                throw error;
              })
            );
          } else {
            console.warn('⚠️ Gasto con importe inválido:', gasto);
          }
        });
      } else {
        console.warn('⚠️ No hay gastos temporales para guardar');
      }
      
      // Esperar a que se guarden todas las responsabilidades, garantías y gastos iniciales
      await Promise.all(promises);
      
      return contratoCreado;
    },
    onSuccess: async (contratoCreado) => {
      queryClient.invalidateQueries(['contratos']);
      setOpen(false);
      resetForm();
      setEditing(null);
      setSuccessMessage('Contrato creado exitosamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      console.error('Error al crear contrato:', error);
      setSuccessMessage('Error al crear el contrato. Por favor, intente nuevamente.');
      setSnackbarSeverity('error');
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
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/contratos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['contratos']);
      setSuccessMessage('Contrato eliminado exitosamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      console.error('Error completo al eliminar contrato:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      
      // Construir mensaje de error más completo
      let errorMessage = 'Error al eliminar el contrato';
      
      if (error.response?.data) {
        const errorData = error.response.data;
        // Si hay campo 'error' y 'detalles', combinarlos
        if (errorData.error && errorData.detalles) {
          errorMessage = `${errorData.error}. ${errorData.detalles}`;
        } else {
          // Priorizar el campo 'error', luego 'detalles', luego 'message'
          errorMessage = errorData.error || errorData.detalles || errorData.message || errorMessage;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Forzar que el mensaje se muestre
      setSnackbarSeverity('error');
      setSuccessMessage(errorMessage);
      setSnackbarOpen(true);
      
      console.log('Mensaje de error establecido:', errorMessage);
      console.log('Severity:', 'error');
      console.log('Snackbar abierto:', true);
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
      montoActual: '',
      gastosAdministrativos: '',
      honorariosPropietario: '',
      metodoAjuste: '',
      frecuenciaAjusteMeses: '',
      indiceAumento: '',
      periodoAumento: '',
      ultimoAjusteAt: '',
      registradoAfip: false,
      moneda: '', // Se establecerá automáticamente cuando monedaData esté disponible
      estado: '' // Se establecerá automáticamente cuando estadoContratoData esté disponible
    });
    setPropietarioNombre('');
    setMontoTotalContrato(0);
    setErrors({});
    setEditing(null);
    setTabValue(0);
    // Limpiar estados temporales
    setResponsabilidadesTemporales([]);
    setGarantiasTemporales([]);
    setGastosInicialesTemporales([]);
  };

  const handleOpen = () => {
    resetForm();
    setOpen(true);
  };

  const handleEdit = (contrato) => {
    setEditing(contrato);
    setTabValue(0); // Resetear a la primera pestaña al editar
    const unidad = contrato.unidad || unidades?.data?.find(u => u.id === contrato.unidadId);
    const propietario = unidad?.propietario;
    const nombrePropietario = propietario 
      ? (propietario.razonSocial || `${propietario.nombre || ''} ${propietario.apellido || ''}`.trim())
      : 'Sin propietario';
    
    setPropietarioNombre(nombrePropietario);
    
    const montoInicial = parseFloat(contrato.montoInicial) || 0;
    const duracionMeses = parseInt(contrato.duracionMeses) || 0;
    setMontoTotalContrato(montoInicial * duracionMeses);
    
    setFormData({
      unidadId: contrato.unidadId,
      inquilinoId: contrato.inquilinoId,
      nroContrato: contrato.nroContrato || '',
      fechaInicio: contrato.fechaInicio ? dayjs(contrato.fechaInicio).format('YYYY-MM-DD') : '',
      fechaFin: contrato.fechaFin ? dayjs(contrato.fechaFin).format('YYYY-MM-DD') : '',
      duracionMeses: contrato.duracionMeses || '',
      montoInicial: contrato.montoInicial ? formatNumberWithThousands(contrato.montoInicial) : '',
      montoActual: contrato.montoActual || contrato.montoInicial ? formatNumberWithThousands(contrato.montoActual || contrato.montoInicial) : '',
      gastosAdministrativos: contrato.gastosAdministrativos || '',
      honorariosPropietario: contrato.honorariosPropietario || '',
      metodoAjuste: contrato.metodoAjuste || '',
      frecuenciaAjusteMeses: contrato.frecuenciaAjusteMeses || '',
      indiceAumento: contrato.indiceAumento || '',
      periodoAumento: contrato.periodoAumento || contrato.frecuenciaAjusteMeses || '',
      ultimoAjusteAt: contrato.ultimoAjusteAt ? dayjs(contrato.ultimoAjusteAt).format('YYYY-MM-DD') : '',
      registradoAfip: contrato.registradoAfip || false,
      // Guardar el código de moneda tal cual viene del backend
      // Se convertirá a ID en el useEffect cuando monedaData esté disponible
      moneda: contrato.moneda || '',
      // Guardar el código de estado tal cual viene del backend
      // Se convertirá a ID en el useEffect cuando estadoContratoData esté disponible
      estado: contrato.estado || ''
    });
    setOpen(true);
  };

  const handleView = async (contratoId) => {
    setSelectedContrato(contratoId);
    setViewOpen(true);
  };

  // Efecto para actualizar propietario cuando se selecciona unidad
  useEffect(() => {
    if (unidadSeleccionada) {
      const propietario = unidadSeleccionada.propietario;
      const nombre = propietario 
        ? (propietario.razonSocial || `${propietario.nombre || ''} ${propietario.apellido || ''}`.trim())
        : 'Sin propietario';
      setPropietarioNombre(nombre);
    } else {
      setPropietarioNombre('');
    }
  }, [unidadSeleccionada]);

  // Efecto para establecer moneda por defecto y convertir código a ID cuando se cargan los parámetros
  useEffect(() => {
    if (open && monedaData?.lista) {
      if (!editing) {
        // Si es nuevo contrato y no hay moneda seleccionada, buscar el ID del parámetro 'ARS'
        if (!formData.moneda) {
          const arsParam = monedaData.lista.find(p => p.codigo === 'ARS');
          if (arsParam) {
            setFormData(prev => ({ ...prev, moneda: arsParam.id }));
          }
        }
      } else {
        // Si es edición, convertir el código de moneda a ID
        // El backend devuelve el código (ej: 'ARS'), pero el selector necesita el ID
        if (formData.moneda) {
          // Verificar si es un código (no está en el mapa de parámetros por ID)
          const esCodigo = !monedaData.parametros[formData.moneda];
          if (esCodigo) {
            // Buscar el parámetro por código y convertir a ID
            const monedaParam = monedaData.lista.find(p => p.codigo === formData.moneda);
            if (monedaParam && formData.moneda !== monedaParam.id) {
              setFormData(prev => ({ ...prev, moneda: monedaParam.id }));
            }
          }
        }
      }
    }
  }, [open, editing, monedaData?.lista, monedaData?.parametros, formData.moneda]);

  // Efecto para establecer estado por defecto y convertir código a ID cuando se cargan los parámetros
  useEffect(() => {
    if (open && estadoContratoMap?.lista) {
      if (!editing) {
        // Si es nuevo contrato y no hay estado seleccionado, buscar el ID del parámetro 'borrador'
        if (!formData.estado) {
          const borradorParam = estadoContratoMap.lista.find(p => p.codigo === 'borrador');
          if (borradorParam) {
            setFormData(prev => ({ ...prev, estado: borradorParam.id }));
          }
        }
      } else {
        // Si es edición, convertir el código de estado a ID
        // El backend devuelve el código (ej: 'borrador'), pero el selector necesita el ID
        if (formData.estado) {
          // Verificar si es un código (no está en el mapa de parámetros por ID)
          const esCodigo = !estadoContratoMap.parametros[formData.estado];
          if (esCodigo) {
            // Buscar el parámetro por código y convertir a ID
            const estadoParam = estadoContratoMap.lista.find(p => p.codigo === formData.estado);
            if (estadoParam && formData.estado !== estadoParam.id) {
              setFormData(prev => ({ ...prev, estado: estadoParam.id }));
            }
          }
        }
      }
    }
  }, [open, editing, estadoContratoMap?.lista, estadoContratoMap?.parametros, formData.estado]);

  // Efecto para calcular fecha fin cuando cambian fecha inicio o duración
  useEffect(() => {
    if (formData.fechaInicio && formData.duracionMeses) {
      const fechaInicio = dayjs(formData.fechaInicio);
      const meses = parseInt(formData.duracionMeses) || 0;
      if (meses > 0) {
        const fechaFinCalculada = fechaInicio.add(meses, 'month').subtract(1, 'day').format('YYYY-MM-DD');
        // Siempre calcular la fecha fin cuando cambian fecha inicio o duración
        setFormData(prev => ({ ...prev, fechaFin: fechaFinCalculada }));
      }
    }
  }, [formData.fechaInicio, formData.duracionMeses]);

  // Efecto para calcular monto total contrato
  useEffect(() => {
    const montoInicial = formData.montoInicial ? parseFloat(parseNumberFromFormatted(formData.montoInicial)) : 0;
    const duracionMeses = parseInt(formData.duracionMeses) || 0;
    setMontoTotalContrato(montoInicial * duracionMeses);
  }, [formData.montoInicial, formData.duracionMeses]);

  const validateForm = () => {
    const newErrors = {};

    // Validar Propiedad (obligatorio)
    const unidadIdStr = formData.unidadId ? String(formData.unidadId).trim() : '';
    if (!unidadIdStr) {
      newErrors.unidadId = 'La propiedad es obligatoria';
    }

    // Validar Inquilino (obligatorio)
    const inquilinoIdStr = formData.inquilinoId ? String(formData.inquilinoId).trim() : '';
    if (!inquilinoIdStr) {
      newErrors.inquilinoId = 'El inquilino es obligatorio';
    }

    // Validar Fecha Inicio (obligatorio)
    const fechaInicioStr = formData.fechaInicio ? String(formData.fechaInicio).trim() : '';
    if (!fechaInicioStr) {
      newErrors.fechaInicio = 'La fecha de inicio es obligatoria';
    }

    // Validar Duración (obligatorio)
    const duracionMesesStr = formData.duracionMeses ? String(formData.duracionMeses).trim() : '';
    if (!duracionMesesStr) {
      newErrors.duracionMeses = 'La duración es obligatoria';
    } else {
      const duracion = parseInt(duracionMesesStr, 10);
      if (isNaN(duracion) || duracion < 1) {
        newErrors.duracionMeses = 'La duración debe ser mayor a 0';
      }
    }

    // Validar Fecha Fin (obligatorio, pero se calcula automáticamente)
    // Si no está presente pero hay fechaInicio y duracionMeses, no es error
    // Pero si está presente, debe ser válida
    const fechaFinStr = formData.fechaFin ? String(formData.fechaFin).trim() : '';
    if (!fechaFinStr) {
      // Si hay fechaInicio y duracionMeses, la fechaFin debería calcularse automáticamente
      // Si no se calculó, es un error
      if (fechaInicioStr && duracionMesesStr) {
        // La fecha fin debería haberse calculado, pero no está presente
        // Esto puede pasar si el cálculo falló o si el usuario la borró manualmente
        newErrors.fechaFin = 'La fecha de fin es obligatoria';
      } else {
        // Si no hay fechaInicio o duracionMeses, la fechaFin no se puede calcular
        newErrors.fechaFin = 'Complete la fecha de inicio y duración primero';
      }
    }

    // Validar Monto Inicial (obligatorio)
    const montoInicialStr = formData.montoInicial ? String(formData.montoInicial).trim() : '';
    if (!montoInicialStr) {
      newErrors.montoInicial = 'El monto inicial es obligatorio';
    } else {
      const monto = parseFloat(parseNumberFromFormatted(montoInicialStr));
      if (isNaN(monto) || monto <= 0) {
        newErrors.montoInicial = 'El monto inicial debe ser mayor a 0';
      }
    }

    // Validar Índice Ajuste (obligatorio)
    const metodoAjusteStr = formData.metodoAjuste ? String(formData.metodoAjuste).trim() : '';
    if (!metodoAjusteStr) {
      newErrors.metodoAjuste = 'El índice de ajuste es obligatorio';
    }

    // Validar Actualización (obligatorio)
    const frecuenciaAjusteMesesStr = formData.frecuenciaAjusteMeses ? String(formData.frecuenciaAjusteMeses).trim() : '';
    if (!frecuenciaAjusteMesesStr) {
      newErrors.frecuenciaAjusteMeses = 'La actualización es obligatoria';
    } else {
      const frecuencia = parseInt(frecuenciaAjusteMesesStr, 10);
      if (isNaN(frecuencia) || frecuencia < 1) {
        newErrors.frecuenciaAjusteMeses = 'La actualización debe ser mayor a 0';
      }
    }

    // Validar Moneda (obligatorio)
    const monedaStr = formData.moneda ? String(formData.moneda).trim() : '';
    if (!monedaStr) {
      newErrors.moneda = 'La moneda es obligatoria';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validar formulario
    if (!validateForm()) {
      return;
    }
    
    // Parsear valores numéricos de manera segura
    const parseSafeNumber = (value) => {
      if (!value || value === '') return null;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    };
    
    const parseSafeInteger = (value) => {
      if (!value || value === '') return null;
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? null : parsed;
    };
    
    // Parsear monto inicial y actual (que pueden venir con separadores de miles)
    const parseMonto = (value) => {
      if (!value || value === '') return null;
      const parsedValue = parseNumberFromFormatted(value);
      if (!parsedValue || parsedValue === '') return null;
      const parsed = parseFloat(parsedValue);
      return isNaN(parsed) ? null : parsed;
    };
    
    const submitData = {
      unidadId: formData.unidadId || null,
      inquilinoId: formData.inquilinoId || null,
      fechaInicio: formData.fechaInicio ? new Date(formData.fechaInicio) : null,
      fechaFin: formData.fechaFin ? new Date(formData.fechaFin) : null,
      duracionMeses: parseSafeInteger(formData.duracionMeses),
      frecuenciaAjusteMeses: parseSafeInteger(formData.frecuenciaAjusteMeses),
      montoInicial: parseMonto(formData.montoInicial),
      montoActual: parseMonto(formData.montoActual),
      gastosAdministrativos: parseSafeNumber(formData.gastosAdministrativos),
      honorariosPropietario: parseSafeNumber(formData.honorariosPropietario),
      metodoAjuste: formData.metodoAjuste || null,
      indiceAumento: formData.indiceAumento || null,
      periodoAumento: parseSafeInteger(formData.periodoAumento),
      ultimoAjusteAt: formData.ultimoAjusteAt ? new Date(formData.ultimoAjusteAt) : null,
      registradoAfip: Boolean(formData.registradoAfip),
      // Convertir ID de moneda a código para el backend
      moneda: formData.moneda && monedaData?.codigos?.[formData.moneda] 
        ? monedaData.codigos[formData.moneda] 
        : (formData.moneda || 'ARS'),
      // Convertir ID de estado a código para el backend
      estado: formData.estado && estadoContratoMap?.codigos?.[formData.estado] 
        ? estadoContratoMap.codigos[formData.estado] 
        : (formData.estado || 'borrador')
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">Contratos</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Filtrar por Estado</InputLabel>
            <Select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              label="Filtrar por Estado"
            >
              <MenuItem value="">Todos</MenuItem>
              {estadoContratoMap?.lista?.map((estado) => (
                <MenuItem key={estado.id} value={estado.codigo}>
                  {estado.descripcion}
                </MenuItem>
              ))}
              <MenuItem value="vencido">Vencidos (automático)</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}>
            Nuevo Contrato
          </Button>
        </Box>
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
              <TableCell>Propiedad</TableCell>
              <TableCell>Propietario</TableCell>
              <TableCell>Inicio</TableCell>
              <TableCell>Fin</TableCell>
              <TableCell>Monto</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contratosFiltrados?.map((contrato) => {
              // Determinar estado real (si está vencido pero no marcado como tal)
              let estadoReal = contrato.estado;
              let esVencido = false;
              if (contrato.fechaFin && contrato.estado !== 'finalizado' && contrato.estado !== 'cancelado') {
                const fechaFin = dayjs(contrato.fechaFin);
                const hoy = dayjs();
                if (fechaFin.isBefore(hoy, 'day')) {
                  esVencido = true;
                  if (contrato.estado === 'activo' || contrato.estado === 'borrador') {
                    estadoReal = 'vencido';
                  }
                }
              }
              
              return (
              <TableRow key={contrato.id}>
                <TableCell>{contrato.nroContrato || '-'}</TableCell>
                <TableCell>
                  {contrato.inquilino?.razonSocial ||
                    `${contrato.inquilino?.nombre || ''} ${contrato.inquilino?.apellido || ''}`.trim()}
                </TableCell>
                <TableCell>{contrato.unidad?.direccion}</TableCell>
                <TableCell>
                  {contrato.unidad?.propietario 
                    ? (contrato.unidad.propietario.razonSocial ||
                       `${contrato.unidad.propietario.nombre || ''} ${contrato.unidad.propietario.apellido || ''}`.trim())
                    : <em style={{ color: '#999' }}>Sin propietario</em>}
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
                <TableCell>
                  <Chip 
                    label={String(getDescripcion(estadoContratoMap, estadoReal) || estadoReal || 'Sin estado')} 
                    size="small"
                    color={
                      estadoReal === 'activo' || estadoReal === 'vigente' ? 'success' :
                      estadoReal === 'vencido' || esVencido ? 'error' :
                      estadoReal === 'finalizado' ? 'default' :
                      estadoReal === 'cancelado' || estadoReal === 'anulado' ? 'warning' :
                      'default'
                    }
                    title={esVencido && contrato.estado !== 'vencido' ? 'Contrato vencido (no actualizado en BD)' : ''}
                  />
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
              );
            })}
            {contratosFiltrados?.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    No se encontraron contratos {filtroEstado ? `con estado "${estadoContratoMap?.lista?.find(e => e.codigo === filtroEstado)?.descripcion || filtroEstado}"` : ''}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Vista de cards para mobile */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <Grid container spacing={2}>
          {contratosFiltrados?.map((contrato) => {
            // Determinar estado real (si está vencido pero no marcado como tal)
            let estadoReal = contrato.estado;
            let esVencido = false;
            if (contrato.fechaFin && !['finalizado', 'anulado', 'cancelado', 'rescindido'].includes(contrato.estado)) {
              const fechaFin = dayjs(contrato.fechaFin);
              const hoy = dayjs();
              if (fechaFin.isBefore(hoy, 'day')) {
                esVencido = true;
                // Solo mostrar como vencido si el estado actual permite esa transición
                if (['activo', 'vigente', 'borrador', 'pendiente_de_firma', 'prorrogado'].includes(contrato.estado)) {
                  estadoReal = 'vencido';
                }
              }
            }
            
            return (
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
                          <strong>Propiedad:</strong> {contrato.unidad?.direccion}
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Estado:</strong>
                      </Typography>
                      <Chip 
                        label={String(getDescripcion(estadoContratoMap, estadoReal) || estadoReal || 'Sin estado')} 
                        size="small"
                        color={
                          estadoReal === 'activo' || estadoReal === 'vigente' ? 'success' :
                          estadoReal === 'vencido' || esVencido ? 'error' :
                          estadoReal === 'finalizado' ? 'default' :
                          estadoReal === 'cancelado' || estadoReal === 'anulado' ? 'warning' :
                          'default'
                        }
                        sx={{ height: '20px', fontSize: '0.7rem' }}
                      />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            );
          })}
          {contratosFiltrados?.length === 0 && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                    No se encontraron contratos {filtroEstado ? `con estado "${estadoContratoMap?.lista?.find(e => e.codigo === filtroEstado)?.descripcion || filtroEstado}"` : ''}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Box>

      {/* Dialog de creación/edición */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit} noValidate>
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
              <Tabs 
                value={tabValue} 
                onChange={(e, v) => {
                  // Si no hay edición y se intenta acceder a Ajustes (index 4), no permitirlo
                  if (!editing && v === 4) {
                    return;
                  }
                  setTabValue(v);
                }}
              >
                <Tab label="Datos Principales" />
                <Tab label="Gastos Iniciales" />
                <Tab label="Responsabilidades" />
                <Tab label="Garantías" />
                {editing && <Tab label="Ajustes" />}
              </Tabs>

              <TabPanel value={tabValue} index={0}>
                <Grid container spacing={2}>
                  {/* Fila 1: Propiedad, Propietario, Inquilino */}
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" error={!!errors.unidadId}>
                      <InputLabel>Propiedad *</InputLabel>
                      <Select
                        value={formData.unidadId}
                        onChange={(e) => {
                          setFormData({ ...formData, unidadId: e.target.value });
                          if (errors.unidadId) {
                            setErrors({ ...errors, unidadId: '' });
                          }
                        }}
                        label="Propiedad *"
                      >
                        {unidades?.data?.map((unidad) => (
                          <MenuItem key={unidad.id} value={unidad.id}>
                            {unidad.direccion}, {unidad.localidad}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.unidadId && (
                        <FormHelperText error>{errors.unidadId}</FormHelperText>
                      )}
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Propietario"
                      fullWidth
                      size="small"
                      value={propietarioNombre || ''}
                      disabled
                      InputProps={{
                        readOnly: true,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" error={!!errors.inquilinoId}>
                      <InputLabel>Inquilino *</InputLabel>
                      <Select
                        value={formData.inquilinoId}
                        onChange={(e) => {
                          setFormData({ ...formData, inquilinoId: e.target.value });
                          if (errors.inquilinoId) {
                            setErrors({ ...errors, inquilinoId: '' });
                          }
                        }}
                        label="Inquilino *"
                      >
                        {inquilinos?.data?.map((inq) => (
                          <MenuItem key={inq.id} value={inq.id}>
                            {inq.razonSocial || `${inq.nombre} ${inq.apellido}`}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.inquilinoId && (
                        <FormHelperText error>{errors.inquilinoId}</FormHelperText>
                      )}
                    </FormControl>
                  </Grid>

                  {/* Fila 2: Nro. Contrato, Fecha Inicio, Duración, Fecha Fin */}
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Nro. Contrato"
                      fullWidth
                      size="small"
                      value={formData.nroContrato}
                      disabled
                      InputProps={{
                        readOnly: true,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Fecha Inicio *"
                      type="date"
                      fullWidth
                      size="small"
                      value={formData.fechaInicio}
                      onChange={(e) => {
                        setFormData({ ...formData, fechaInicio: e.target.value });
                        if (errors.fechaInicio) {
                          setErrors({ ...errors, fechaInicio: '' });
                        }
                      }}
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.fechaInicio}
                      helperText={errors.fechaInicio || ''}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Duración (meses) *"
                      type="number"
                      fullWidth
                      size="small"
                      value={formData.duracionMeses}
                      onChange={(e) => {
                        setFormData({ ...formData, duracionMeses: e.target.value });
                        if (errors.duracionMeses) {
                          setErrors({ ...errors, duracionMeses: '' });
                        }
                      }}
                      inputProps={{ 
                        min: 1,
                        style: { MozAppearance: 'textfield' },
                        onWheel: (e) => e.target.blur()
                      }}
                      error={!!errors.duracionMeses}
                      helperText={errors.duracionMeses || ''}
                      sx={{
                        '& input[type=number]': {
                          MozAppearance: 'textfield',
                        },
                        '& input[type=number]::-webkit-outer-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                        },
                        '& input[type=number]::-webkit-inner-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Fecha Fin *"
                      type="date"
                      fullWidth
                      size="small"
                      value={formData.fechaFin}
                      onChange={(e) => {
                        setFormData({ ...formData, fechaFin: e.target.value });
                        if (errors.fechaFin) {
                          setErrors({ ...errors, fechaFin: '' });
                        }
                      }}
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.fechaFin}
                      helperText={errors.fechaFin || ''}
                    />
                  </Grid>

                  {/* Fila 3: Monto Inicial Alquiler, Monto Total Contrato, Gastos Adm., Honorarios */}
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Monto Inicial Alquiler *"
                      type="text"
                      fullWidth
                      size="small"
                      value={formData.montoInicial}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Permitir solo números, puntos y comas
                        if (value === '' || /^[\d.,]*$/.test(value)) {
                          setFormData({ ...formData, montoInicial: value });
                          if (errors.montoInicial) {
                            setErrors({ ...errors, montoInicial: '' });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const formatted = formatNumberWithThousands(parseNumberFromFormatted(e.target.value));
                        setFormData({ ...formData, montoInicial: formatted });
                      }}
                      error={!!errors.montoInicial}
                      helperText={errors.montoInicial || ''}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Monto Total Contrato"
                      type="text"
                      fullWidth
                      size="small"
                      value={formatNumberWithThousands(montoTotalContrato)}
                      disabled
                      InputProps={{
                        readOnly: true,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Gastos Adm. Inquilino (%)"
                      type="number"
                      fullWidth
                      size="small"
                      value={formData.gastosAdministrativos}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                          setFormData({ ...formData, gastosAdministrativos: value });
                        }
                      }}
                      inputProps={{ 
                        step: '0.01', 
                        min: 0, 
                        max: 100,
                        style: { MozAppearance: 'textfield' },
                        onWheel: (e) => e.target.blur()
                      }}
                      error={formData.gastosAdministrativos !== '' && (parseFloat(formData.gastosAdministrativos) < 0 || parseFloat(formData.gastosAdministrativos) > 100)}
                      sx={{
                        '& input[type=number]': {
                          MozAppearance: 'textfield',
                        },
                        '& input[type=number]::-webkit-outer-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                        },
                        '& input[type=number]::-webkit-inner-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Honorarios Propietario (%)"
                      type="number"
                      fullWidth
                      size="small"
                      value={formData.honorariosPropietario}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                          setFormData({ ...formData, honorariosPropietario: value });
                        }
                      }}
                      inputProps={{ 
                        step: '0.01', 
                        min: 0, 
                        max: 100,
                        style: { MozAppearance: 'textfield' },
                        onWheel: (e) => e.target.blur()
                      }}
                      error={formData.honorariosPropietario !== '' && (parseFloat(formData.honorariosPropietario) < 0 || parseFloat(formData.honorariosPropietario) > 100)}
                      sx={{
                        '& input[type=number]': {
                          MozAppearance: 'textfield',
                        },
                        '& input[type=number]::-webkit-outer-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                        },
                        '& input[type=number]::-webkit-inner-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                        },
                      }}
                    />
                  </Grid>

                  {/* Fila 4: Índice Ajuste, Actualización, Moneda, Registrado AFIP */}
                  <Grid item xs={12} sm={3}>
                    <ParametroSelect
                      categoriaCodigo="metodo_ajuste"
                      label="Índice Ajuste *"
                      value={formData.metodoAjuste}
                      onChange={(e) => {
                        setFormData({ ...formData, metodoAjuste: e.target.value });
                        if (errors.metodoAjuste) {
                          setErrors({ ...errors, metodoAjuste: '' });
                        }
                      }}
                      mostrarAbreviatura={true}
                      error={!!errors.metodoAjuste}
                      helperText={errors.metodoAjuste || ''}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Actualización (meses) *"
                      type="number"
                      fullWidth
                      size="small"
                      value={formData.frecuenciaAjusteMeses}
                      onChange={(e) => {
                        setFormData({ ...formData, frecuenciaAjusteMeses: e.target.value });
                        if (errors.frecuenciaAjusteMeses) {
                          setErrors({ ...errors, frecuenciaAjusteMeses: '' });
                        }
                      }}
                      inputProps={{ 
                        min: 1,
                        style: { MozAppearance: 'textfield' },
                        onWheel: (e) => e.target.blur()
                      }}
                      error={!!errors.frecuenciaAjusteMeses}
                      helperText={errors.frecuenciaAjusteMeses || ''}
                      sx={{
                        '& input[type=number]': {
                          MozAppearance: 'textfield',
                        },
                        '& input[type=number]::-webkit-outer-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                        },
                        '& input[type=number]::-webkit-inner-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <ParametroSelect
                      categoriaCodigo="moneda"
                      label="Moneda *"
                      value={formData.moneda}
                      onChange={(e) => {
                        setFormData({ ...formData, moneda: e.target.value });
                        if (errors.moneda) {
                          setErrors({ ...errors, moneda: '' });
                        }
                      }}
                      error={!!errors.moneda}
                      helperText={errors.moneda || ''}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <ParametroSelect
                      categoriaCodigo="estado_contrato"
                      label="Estado"
                      value={formData.estado}
                      onChange={(e) => {
                        setFormData({ ...formData, estado: e.target.value });
                      }}
                    />
                  </Grid>
                  
                  {/* Fila 5: Registrado AFIP */}
                  <Grid item xs={12} sm={3}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.registradoAfip}
                          onChange={(e) => setFormData({ ...formData, registradoAfip: e.target.checked })}
                        />
                      }
                      label="Registrado AFIP"
                    />
                  </Grid>
                </Grid>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <ContratoGastosIniciales 
                  contratoId={editing?.id} 
                  montoInicial={formData.montoInicial}
                  duracionMeses={formData.duracionMeses}
                  gastosTemporales={gastosInicialesTemporales}
                  setGastosTemporales={setGastosInicialesTemporales}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <ContratoResponsabilidades 
                  contratoId={editing?.id}
                  unidadId={formData.unidadId}
                  responsabilidadesTemporales={responsabilidadesTemporales}
                  setResponsabilidadesTemporales={setResponsabilidadesTemporales}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={3}>
                <ContratoGarantias 
                  contratoId={editing?.id}
                  garantiasTemporales={garantiasTemporales}
                  setGarantiasTemporales={setGarantiasTemporales}
                />
              </TabPanel>

              {editing && (
                <TabPanel value={tabValue} index={4}>
                  <ContratoAjustesTab
                    contratoId={editing?.id}
                    formData={formData}
                    setFormData={setFormData}
                    indices={indicesAjusteActivos?.data || []}
                    setSuccessMessage={setSuccessMessage}
                    setSnackbarOpen={setSnackbarOpen}
                  />
                </TabPanel>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setOpen(false);
              resetForm(); // Limpiar todos los estados temporales al cancelar
            }}>Cancelar</Button>
            <Button type="submit" variant="contained">
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
        autoHideDuration={6000}
        onClose={() => {
          setSnackbarOpen(false);
          setSnackbarSeverity('success'); // Resetear a success por defecto
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function ContratoAjustesTab({
  contratoId,
  formData,
  setFormData,
  indices,
  setSuccessMessage,
  setSnackbarOpen
}) {
  const [errorMessage, setErrorMessage] = useState('');
  const [calculando, setCalculando] = useState(false);
  const [resultadoCalculo, setResultadoCalculo] = useState(null);

  const indiceOptions = useMemo(() => {
    if (!indices || indices.length === 0) return [];
    const map = new Map();
    indices.forEach((item) => {
      if (!map.has(item.codigo)) {
        map.set(item.codigo, { codigo: item.codigo, descripcion: item.descripcion });
      }
    });
    return Array.from(map.values());
  }, [indices]);

  const calcularMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post(`/contratos/${contratoId}/ajustes/calcular`, data);
      return response.data;
    },
    onSuccess: (data) => {
      setResultadoCalculo(data);
      setErrorMessage('');
    },
    onError: (error) => {
      const message =
        error.response?.data?.error ||
        error.message ||
        'No se pudo calcular los ajustes proyectados';
      setErrorMessage(message);
      setResultadoCalculo(null);
    },
    onSettled: () => {
      setCalculando(false);
    }
  });

  const handleCalcular = () => {
    if (!formData.indiceAumento) {
      setErrorMessage('Debe seleccionar un índice de ajuste');
      return;
    }
    if (!formData.periodoAumento) {
      setErrorMessage('Debe ingresar el período de ajuste');
      return;
    }
    if (!formData.montoActual) {
      setErrorMessage('Debe ingresar el monto actual');
      return;
    }
    if (!formData.fechaInicio) {
      setErrorMessage('Debe ingresar la fecha de inicio del contrato');
      return;
    }

    setCalculando(true);
    setErrorMessage('');
    
    const payload = {
      fechaInicio: formData.fechaInicio,
      fechaFin: formData.fechaFin || null,
      indiceAumento: formData.indiceAumento,
      periodoAumento: parseInt(formData.periodoAumento),
      montoActual: parseFloat(parseNumberFromFormatted(formData.montoActual))
    };

    calcularMutation.mutate(payload);
  };

  if (!contratoId) {
    return (
      <Alert severity="info">
        Guardá el contrato para configurar los ajustes.
      </Alert>
    );
  }

  return (
    <Box sx={{ pt: 1 }}>
      <Stack spacing={2}>
        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Configuración
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Índice de Ajuste</InputLabel>
                  <Select
                    value={formData.indiceAumento || ''}
                    label="Índice de Ajuste"
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        indiceAumento: e.target.value
                      }))
                    }
                  >
                    <MenuItem value="">
                      <em>Sin índice</em>
                    </MenuItem>
                    {indiceOptions.map((option) => (
                      <MenuItem key={option.codigo} value={option.codigo}>
                        {option.codigo} — {option.descripcion}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Período (meses)"
                  type="number"
                  fullWidth
                  size="small"
                  value={formData.periodoAumento || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      periodoAumento: e.target.value
                    }))
                  }
                  inputProps={{ 
                    min: 0,
                    style: { MozAppearance: 'textfield' },
                    onWheel: (e) => e.target.blur()
                  }}
                  sx={{
                    '& input[type=number]': {
                      MozAppearance: 'textfield',
                    },
                    '& input[type=number]::-webkit-outer-spin-button': {
                      WebkitAppearance: 'none',
                      margin: 0,
                    },
                    '& input[type=number]::-webkit-inner-spin-button': {
                      WebkitAppearance: 'none',
                      margin: 0,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Monto Actual"
                  type="text"
                  fullWidth
                  size="small"
                  value={formData.montoActual || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Permitir solo números, puntos y comas
                    if (value === '' || /^[\d.,]*$/.test(value)) {
                      setFormData((prev) => ({
                        ...prev,
                        montoActual: value
                      }));
                    }
                  }}
                  onBlur={(e) => {
                    const formatted = formatNumberWithThousands(parseNumberFromFormatted(e.target.value));
                    setFormData((prev) => ({
                      ...prev,
                      montoActual: formatted
                    }));
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Fecha Inicio Contrato"
                  type="date"
                  fullWidth
                  size="small"
                  value={formData.fechaInicio || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      fechaInicio: e.target.value
                    }))
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleCalcular}
                disabled={calculando || !formData.indiceAumento || !formData.periodoAumento || !formData.montoActual || !formData.fechaInicio}
                fullWidth
              >
                {calculando ? 'Calculando...' : 'Calcular'}
              </Button>
            </Box>
          </Grid>

          {resultadoCalculo && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mt: 2 }}>
                Resultado del Cálculo
              </Typography>
              <CalculoAjustesResultado resultado={resultadoCalculo} />
            </Grid>
          )}
        </Grid>
      </Stack>
    </Box>
  );
}

// Componente para mostrar el resultado del cálculo
function CalculoAjustesResultado({ resultado }) {
  const [expandedCuatrimestres, setExpandedCuatrimestres] = useState({});

  const toggleExpand = (numero) => {
    setExpandedCuatrimestres(prev => ({
      ...prev,
      [numero]: !prev[numero]
    }));
  };

  if (!resultado || !resultado.cuatrimestres || resultado.cuatrimestres.length === 0) {
    return <Alert severity="info">No hay datos para mostrar.</Alert>;
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        {resultado.cuatrimestres.map((cuatrimestre, index) => {
          const isExpanded = expandedCuatrimestres[cuatrimestre.numero];
          const tieneMeses = cuatrimestre.meses && cuatrimestre.meses.length > 0;
          
          return (
            <Box key={cuatrimestre.numero} sx={{ mb: index < resultado.cuatrimestres.length - 1 ? 2 : 0 }}>
              {/* Resumen del cuatrimestre */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 1.5,
                  cursor: tieneMeses ? 'pointer' : 'default',
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': tieneMeses ? {
                    bgcolor: 'grey.200'
                  } : {}
                }}
                onClick={() => tieneMeses && toggleExpand(cuatrimestre.numero)}
              >
                <Typography variant="body1" fontWeight="bold">
                  Cuatr. {cuatrimestre.numero}
                </Typography>
                <Box sx={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <Box sx={{ minWidth: 120 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Fecha
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {dayjs(cuatrimestre.fechaInicio).format('DD/MM/YYYY')}
                    </Typography>
                  </Box>
                  <Box sx={{ minWidth: 100, textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Aumento
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {parseFloat(cuatrimestre.aumento).toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}%
                    </Typography>
                  </Box>
                  <Box sx={{ minWidth: 130, textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Valor
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" color="primary.main">
                      {parseFloat(cuatrimestre.valor).toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </Typography>
                  </Box>
                  {tieneMeses && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(cuatrimestre.numero);
                      }}
                    >
                      {isExpanded ? '▼' : '▲'}
                    </IconButton>
                  )}
                </Box>
              </Box>

              {/* Desglose mensual (expandible) */}
              {isExpanded && tieneMeses && (
                <Box sx={{ mt: 1, ml: 2, mr: 2, mb: 2 }}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Fecha</TableCell>
                          <TableCell align="right">Valor Índice</TableCell>
                          <TableCell align="right">Mes Anterior (%)</TableCell>
                          <TableCell align="right">Acumulado (%)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {cuatrimestre.meses.map((mes, mesIndex) => (
                          <TableRow
                            key={mesIndex}
                            sx={{
                              bgcolor: mesIndex === cuatrimestre.meses.length - 1 ? 'action.hover' : 'transparent'
                            }}
                          >
                            <TableCell>
                              {dayjs(mes.fecha).format('DD/MM/YYYY')}
                            </TableCell>
                            <TableCell align="right">
                              {parseFloat(mes.valorIndice).toLocaleString('es-AR', {
                                minimumFractionDigits: 3,
                                maximumFractionDigits: 6,
                                useGrouping: true
                              })}
                            </TableCell>
                            <TableCell align="right">
                              {parseFloat(mes.porcentajeMesAnterior).toLocaleString('es-AR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}%
                            </TableCell>
                            <TableCell align="right">
                              {parseFloat(mes.acumulado).toLocaleString('es-AR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          );
        })}
      </Paper>
      <Alert severity="info" sx={{ mt: 2 }}>
        *Se repiten los valores de meses anteriores para calcular el aumento
      </Alert>
    </Box>
  );
}

// Componente para Responsabilidades
function ContratoResponsabilidades({ contratoId, unidadId, responsabilidadesTemporales, setResponsabilidadesTemporales }) {
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const queryClient = useQueryClient();

  // Mapas de parámetros para mostrar descripciones
  const tipoImpuestoMap = useParametrosMap('tipo_cargo');
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

  // Obtener cuentas tributarias de la unidad (puede venir de contrato o de unidadId)
  const unidadIdParaCuentas = contrato?.unidadId || unidadId;
  const { data: cuentasTributarias } = useQuery({
    queryKey: ['cuentasTributarias', unidadIdParaCuentas],
    queryFn: async () => {
      if (!unidadIdParaCuentas) return [];
      const response = await api.get(`/cuentas/unidad/${unidadIdParaCuentas}`);
      return response.data || [];
    },
    enabled: !!unidadIdParaCuentas
  });

  // Obtener IDs de parámetros para las 4 responsabilidades
  const { data: quienPagaParams } = useQuery({
    queryKey: ['parametros', 'quien_paga'],
    queryFn: async () => {
      const response = await api.get(`/parametros/categorias/quien_paga/parametros`);
      return response.data;
    }
  });

  // Códigos esperados para las 4 responsabilidades (orden: según la imagen del usuario)
  const responsabilidadesConfig = [
    { codigo: 'inm_inq', label: 'Paga Inmobiliaria - Cobra a Inquilino' },
    { codigo: 'inm_prop', label: 'Paga Inmobiliaria - Cobra a Propietario' },
    { codigo: 'paga_inq', label: 'Paga Inquilino - Controla Inmobiliaria' },
    { codigo: 'paga_prop', label: 'Paga Propietario - Controla Inmobiliaria' }
  ];

  // Obtener IDs de los parámetros
  const responsabilidadesConIds = responsabilidadesConfig.map(config => ({
    ...config,
    id: quienPagaParams?.find(p => p.codigo === config.codigo)?.id,
    parametro: quienPagaParams?.find(p => p.codigo === config.codigo)
  }));

  // Función para verificar si existe una responsabilidad (en BD o temporal)
  const getResponsabilidad = (tipoImpuestoId, quienPagaId) => {
    // Si hay contratoId, buscar en BD
    if (contratoId && contrato?.responsabilidades) {
      return contrato.responsabilidades.find(
        resp => resp.tipoCargo === tipoImpuestoId && resp.quienPaga === quienPagaId
      );
    }
    // Si no hay contratoId, buscar en estado temporal
    return responsabilidadesTemporales.find(
      resp => resp.tipoCargo === tipoImpuestoId && resp.quienPaga === quienPagaId
    );
  };

  // Función para verificar si una responsabilidad está marcada
  const isResponsabilidadMarcada = (tipoImpuestoId, quienPagaId) => {
    return !!getResponsabilidad(tipoImpuestoId, quienPagaId);
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
    if (contratoId) {
      // Si hay contratoId, guardar inmediatamente en BD
      const responsabilidad = getResponsabilidad(cuenta.tipoImpuesto, quienPagaId);
      
      if (checked) {
        // Eliminar todas las responsabilidades existentes para este tipoCargo (solo puede haber una por fila)
        const responsabilidadesExistentes = contrato?.responsabilidades?.filter(
          r => r.tipoCargo === cuenta.tipoImpuesto
        ) || [];
        
        // Eliminar todas las responsabilidades existentes para este tipoCargo
        for (const respExistente of responsabilidadesExistentes) {
          if (respExistente.id) {
            await deleteMutation.mutateAsync(respExistente.id);
          }
        }
        
        // Crear la nueva responsabilidad
        await createMutation.mutateAsync({
          tipoCargo: cuenta.tipoImpuesto,
          quienPaga: quienPagaId,
          titular: null
        });
      } else {
        // Eliminar responsabilidad
        if (responsabilidad && responsabilidad.id) {
          await deleteMutation.mutateAsync(responsabilidad.id);
        }
      }
    } else {
      // Si no hay contratoId, actualizar estado temporal
      const nuevaResponsabilidad = {
        tipoCargo: cuenta.tipoImpuesto,
        quienPaga: quienPagaId,
        titular: null
      };
      
      if (checked) {
        // Agregar a estado temporal, pero primero eliminar cualquier otra responsabilidad del mismo tipoCargo
        setResponsabilidadesTemporales(prev => {
          // Filtrar todas las responsabilidades del mismo tipoCargo
          const sinEsteTipoCargo = prev.filter(
            r => r.tipoCargo !== cuenta.tipoImpuesto
          );
          // Agregar la nueva responsabilidad
          return [...sinEsteTipoCargo, nuevaResponsabilidad];
        });
      } else {
        // Remover de estado temporal
        setResponsabilidadesTemporales(prev => 
          prev.filter(
            r => !(r.tipoCargo === nuevaResponsabilidad.tipoCargo && 
                   r.quienPaga === nuevaResponsabilidad.quienPaga)
          )
        );
      }
    }
  };

  if (!unidadIdParaCuentas) {
    return <Alert severity="info">Seleccione una propiedad en el contrato para ver las cuentas tributarias</Alert>;
  }

  // Verificar si faltan parámetros
  const parametrosFaltantes = responsabilidadesConIds.filter(r => !r.id);
  const todosLosParametrosExisten = parametrosFaltantes.length === 0;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Responsabilidades de Pago</Typography>

      {!todosLosParametrosExisten && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Faltan parámetros de responsabilidades. Por favor, configure los siguientes parámetros en la sección de Configuración:
          <ul style={{ marginTop: 8, marginBottom: 0 }}>
            {parametrosFaltantes.map(param => (
              <li key={param.codigo}>{param.label} (código: {param.codigo})</li>
            ))}
          </ul>
        </Alert>
      )}

      {cuentasTributarias && cuentasTributarias.length > 0 ? (
        <TableContainer>
          <Table size="small" sx={{ width: '100%', '& .MuiTableCell-root': { py: 0.5, px: 0.75 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '25%', py: 1, fontWeight: 'bold' }}>Concepto</TableCell>
                {responsabilidadesConIds.map((resp) => {
                  // Dividir el label por el guion para hacer salto de línea
                  const [parte1, parte2] = resp.label.split(' - ');
                  return (
                    <TableCell 
                      key={resp.codigo} 
                      align="center" 
                      sx={{ 
                        width: `${75 / responsabilidadesConIds.length}%`,
                        whiteSpace: 'normal', 
                        lineHeight: 1.2,
                        py: 1,
                        px: 0.5,
                        fontWeight: 'bold'
                      }}
                    >
                      <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>
                        {parte1}
                        {parte2 && (
                          <>
                            <br />
                            - {parte2}
                          </>
                        )}
                      </Typography>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {cuentasTributarias.map((cuenta) => (
                <TableRow key={cuenta.id} sx={{ '& .MuiTableCell-root': { py: 0.5 } }}>
                  <TableCell sx={{ py: 0.5, fontSize: '0.875rem', width: '25%' }}>{getDescripcion(tipoImpuestoMap, cuenta.tipoImpuesto)}</TableCell>
                  {responsabilidadesConIds.map((resp) => (
                    <TableCell key={resp.codigo} align="center" sx={{ py: 0.5, px: 0.5, width: `${75 / responsabilidadesConIds.length}%` }}>
                      <Checkbox
                        checked={isResponsabilidadMarcada(cuenta.tipoImpuesto, resp.id)}
                        onChange={(e) => handleCheckboxChange(cuenta, resp.id, e.target.checked)}
                        size="small"
                        disabled={!resp.id}
                        sx={{ 
                          padding: '3px',
                          '& .MuiSvgIcon-root': { fontSize: '18px' }
                        }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Alert severity="info">
          No hay cuentas tributarias asociadas a esta propiedad. Agregue cuentas tributarias en la sección de Propiedades.
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
function ContratoGarantias({ contratoId, garantiasTemporales, setGarantiasTemporales }) {
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
  const [editingIndex, setEditingIndex] = useState(null);
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

  // Obtener garantías: de BD si hay contratoId, o del estado temporal
  const garantias = contratoId && contrato?.garantias 
    ? contrato.garantias 
    : garantiasTemporales;

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

  const handleSubmit = () => {
    const nuevaGarantia = {
      tipoGarantia: formData.tipoGarantia || null,
      estadoGarantia: formData.estadoGarantia || null,
      apellido: formData.apellido || null,
      nombre: formData.nombre || null,
      dni: formData.dni || null,
      cuit: formData.cuit || null,
      telefono: formData.telefono || null,
      mail: formData.mail || null,
      direccion: formData.direccion || null
    };

    if (contratoId) {
      // Si hay contratoId, guardar inmediatamente en BD
      createMutation.mutate(nuevaGarantia);
    } else {
      // Si no hay contratoId, actualizar estado temporal
      if (editingIndex !== null) {
        // Editar garantía existente
        setGarantiasTemporales(prev => {
          const nuevas = [...prev];
          nuevas[editingIndex] = nuevaGarantia;
          return nuevas;
        });
      } else {
        // Agregar nueva garantía
        setGarantiasTemporales(prev => [...prev, nuevaGarantia]);
      }
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
      setEditingIndex(null);
    }
  };

  const handleEdit = (index) => {
    const garantia = garantias[index];
    setFormData({
      tipoGarantia: garantia.tipoGarantia || '',
      estadoGarantia: garantia.estadoGarantia || '',
      apellido: garantia.apellido || '',
      nombre: garantia.nombre || '',
      dni: garantia.dni || '',
      cuit: garantia.cuit || '',
      telefono: garantia.telefono || '',
      mail: garantia.mail || '',
      direccion: garantia.direccion || ''
    });
    setEditingIndex(index);
    setOpen(true);
  };

  const handleDelete = async (index, id) => {
    if (contratoId && id) {
      // Si hay contratoId, eliminar de BD
      if (window.confirm('¿Eliminar esta garantía?')) {
        await deleteMutation.mutateAsync(id);
      }
    } else {
      // Si no hay contratoId, eliminar de estado temporal
      if (window.confirm('¿Eliminar esta garantía?')) {
        setGarantiasTemporales(prev => prev.filter((_, i) => i !== index));
      }
    }
  };

  const handleClose = () => {
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
    setEditingIndex(null);
  };

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
            {garantias && garantias.length > 0 ? (
              garantias.map((garantia, index) => (
                <TableRow key={garantia.id || `temp-${index}`}>
                  <TableCell>{getDescripcion(tipoGarantiaMap, garantia.tipoGarantia)}</TableCell>
                  <TableCell>{getDescripcion(estadoGarantiaMap, garantia.estadoGarantia)}</TableCell>
                  <TableCell>{garantia.nombre} {garantia.apellido}</TableCell>
                  <TableCell>{garantia.dni || garantia.cuit || '-'}</TableCell>
                  <TableCell>
                    {!contratoId && (
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(index)}
                        sx={{ mr: 1 }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(index, garantia.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No hay garantías agregadas
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editingIndex !== null ? 'Editar Garantía' : 'Nueva Garantía'}</DialogTitle>
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
          <Button onClick={handleClose}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
          >
            {editingIndex !== null ? 'Actualizar' : 'Agregar'}
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
function ContratoGastosIniciales({ contratoId, montoInicial, duracionMeses, gastosTemporales, setGastosTemporales }) {
  // Si no hay contratoId, usar el estado temporal del padre; si hay, usar estado local
  const [gastosEditablesLocal, setGastosEditablesLocal] = useState([]);
  const gastosEditables = contratoId ? gastosEditablesLocal : (gastosTemporales || []);
  const setGastosEditables = contratoId ? setGastosEditablesLocal : setGastosTemporales;
  
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const queryClient = useQueryClient();
  // Ref para rastrear si ya inicializamos los gastos y evitar loops
  const gastosInicializadosRef = useRef(false);
  // Ref para rastrear los valores anteriores y evitar recálculos innecesarios
  const valoresPreviosRef = useRef({ montoInicial: null, duracionMeses: null });

  // Mapas de parámetros para mostrar descripciones
  const tipoGastoInicialData = useParametrosMap('tipo_gasto_inicial');
  const estadoGastoMap = useParametrosMap('estado_gasto');
  
  // Obtener el ID del parámetro 'pendiente' para estado por defecto
  const estadoPendienteId = useMemo(() => {
    if (!estadoGastoMap?.lista) return '';
    const pendiente = estadoGastoMap.lista.find(p => p.codigo === 'pendiente');
    return pendiente?.id || '';
  }, [estadoGastoMap]);

  const { data: contrato } = useQuery({
    queryKey: ['contrato', contratoId],
    queryFn: async () => {
      if (!contratoId) return null;
      const response = await api.get(`/contratos/${contratoId}`);
      return response.data;
    },
    enabled: !!contratoId
  });

  // Calcular importes según las reglas
  const calcularImporte = useCallback((codigoTipoGasto) => {
    const montoInicialNum = parseFloat(parseNumberFromFormatted(montoInicial || '0')) || 0;
    const duracionMesesNum = parseInt(duracionMeses || '0') || 0;
    const montoTotalContrato = montoInicialNum * duracionMesesNum;

    switch (codigoTipoGasto) {
      case 'sellado':
        // 2% del monto total del contrato
        return montoTotalContrato * 0.02;
      case 'honorarios':
        // 5% del monto total del contrato
        return montoTotalContrato * 0.05;
      case 'deposito':
        // Igual al monto inicial del alquiler
        return montoInicialNum;
      case 'averiguacion_garantias':
      default:
        // Sin precargar (0)
        return 0;
    }
  }, [montoInicial, duracionMeses]);

  // Inicializar y sincronizar gastos precargados
  // Este efecto debe ejecutarse cuando:
  // 1. Se cargan los parámetros por primera vez
  // 2. Cambia el contrato (gastosIniciales) - solo si hay contratoId
  // 3. Cambia el contratoId
  // 4. Cambian montoInicial o duracionMeses (para recalcular importes)
  useEffect(() => {
    // Esperar a que los parámetros se carguen
    if (!tipoGastoInicialData?.lista || tipoGastoInicialData.lista.length === 0) {
      return; // No podemos inicializar sin parámetros
    }
    
    // Si ya se inicializaron los gastos, verificar si realmente cambiaron montoInicial o duracionMeses
    // Si no cambiaron, NO recalcular para evitar sobrescribir cambios manuales (como cambiar valorCalculo)
    if (gastosInicializadosRef.current) {
      const montoInicialActual = montoInicial || '';
      const duracionMesesActual = duracionMeses || '';
      const valoresPrevios = valoresPreviosRef.current;
      
      // Si los valores no cambiaron, NO recalcular (esto previene que se recalculen cuando solo se cambian los gastos manualmente)
      if (valoresPrevios.montoInicial === montoInicialActual && 
          valoresPrevios.duracionMeses === duracionMesesActual) {
        // Los valores no cambiaron, no recalcular para evitar sobrescribir cambios manuales
        // Esto evita que se recalculen los gastos cuando solo se actualizan manualmente (como cambiar valorCalculo)
        console.log('⏭️ Saltando recálculo: montoInicial y duracionMeses no cambiaron');
        return;
      } else {
        console.log('🔄 Valores cambiaron, recalculando:', {
          montoInicial: { anterior: valoresPrevios.montoInicial, nuevo: montoInicialActual },
          duracionMeses: { anterior: valoresPrevios.duracionMeses, nuevo: duracionMesesActual }
        });
      }
    }

    // Calcular importe localmente para evitar dependencia de calcularImporte
    const calcularImporteLocal = (codigoTipoGasto, valorCalculo = null) => {
      const montoInicialNum = parseFloat(parseNumberFromFormatted(montoInicial || '0')) || 0;
      const duracionMesesNum = parseInt(duracionMeses || '0') || 0;
      const montoTotalContrato = montoInicialNum * duracionMesesNum;

      switch (codigoTipoGasto) {
        case 'sellado':
          // Si hay valorCalculo, usar ese porcentaje, sino usar 2% por defecto
          const porcentajeSellado = valorCalculo !== null && valorCalculo !== undefined 
            ? parseFloat(valorCalculo) / 100 
            : 0.02;
          return montoTotalContrato * porcentajeSellado;
        case 'honorarios':
          // Si hay valorCalculo, usar ese porcentaje, sino usar 5% por defecto
          const porcentajeHonorarios = valorCalculo !== null && valorCalculo !== undefined 
            ? parseFloat(valorCalculo) / 100 
            : 0.05;
          return montoTotalContrato * porcentajeHonorarios;
        case 'deposito':
          // Si hay valorCalculo (meses), multiplicar montoInicial por meses, sino usar 1 mes
          const mesesDeposito = valorCalculo !== null && valorCalculo !== undefined 
            ? parseFloat(valorCalculo) 
            : 1;
          return montoInicialNum * mesesDeposito;
        case 'averiguacion_garantias':
        default:
          // Para averiguacion, el importe es libre (no se calcula automáticamente)
          return 0;
      }
    };

    // Obtener IDs de parámetros por código (función local)
    const getParametroIdByCodigo = (codigo) => {
      const param = tipoGastoInicialData.lista.find(p => p.codigo === codigo);
      return param?.id || null;
    };

    // Obtener el ID del parámetro 'otro' como fallback
    const parametroOtroId = getParametroIdByCodigo('otro');

    const gastosPrecargados = [
      { codigo: 'sellado', descripcion: 'Sellado Contrato', parametroCodigo: 'sellado' },
      { codigo: 'honorarios', descripcion: 'Honorarios Inmobiliarios', parametroCodigo: 'honorarios' },
      { codigo: 'deposito', descripcion: 'Deposito en garantia Inicial', parametroCodigo: 'deposito' },
      { codigo: 'averiguacion_garantias', descripcion: 'Averiguacion de garantias', parametroCodigo: 'otro' }
    ];

    const gastosExistentes = contrato?.gastosIniciales || [];
    
    let gastosActualizados = gastosPrecargados.map(gastoPrecargado => {
      // Obtener el ID del parámetro, usar 'otro' como fallback si no existe
      let parametroId = getParametroIdByCodigo(gastoPrecargado.parametroCodigo);
      if (!parametroId) {
        // Si no existe el parámetro específico, usar 'otro' como fallback
        parametroId = parametroOtroId;
        if (!parametroId) {
          // Si tampoco existe 'otro', no podemos crear el gasto
          console.error(`No se encontró parámetro para ${gastoPrecargado.codigo} ni 'otro' como fallback`);
          return null;
        }
      }

      // Buscar gastos existentes:
      // 1. Si hay contratoId, buscar primero en BD (gastosExistentes), luego en gastosEditables (estado local)
      // 2. Si no hay contratoId, buscar en gastosTemporales (del padre)
      let gastoExistente = null;
      
      if (contratoId) {
        // Si hay contratoId, buscar primero en BD
        if (gastosExistentes && gastosExistentes.length > 0) {
          const paramPrecargado = tipoGastoInicialData.lista.find(p => p.id === parametroId);
          gastoExistente = gastosExistentes.find(g => {
            if (!g) return false;
            const paramExistente = tipoGastoInicialData.lista.find(p => p.id === g.tipoGastoInicial);
            // Para averiguacion_garantias, buscar cualquier gasto con código 'otro'
            if (gastoPrecargado.parametroCodigo === 'otro') {
              return paramExistente?.codigo === 'otro';
            }
            return paramExistente?.codigo === paramPrecargado?.codigo;
          });
        }
        
        // Si no se encontró en BD, buscar en gastosEditables (estado local)
        if (!gastoExistente && gastosEditables && gastosEditables.length > 0) {
          gastoExistente = gastosEditables.find(g => 
            g && g.tipoGastoInicialCodigo === gastoPrecargado.codigo
          );
        }
      } else {
        // Si no hay contratoId, buscar en gastosTemporales
        if (gastosTemporales && gastosTemporales.length > 0) {
          gastoExistente = gastosTemporales.find(g => 
            g && g.tipoGastoInicialCodigo === gastoPrecargado.codigo
          );
        }
      }

      // Si se encontró un gasto existente, usar sus datos
      if (gastoExistente) {
        // Si fue editado manualmente (incluyendo cuando se cambia valorCalculo), mantener sus valores EXACTAMENTE
        if (gastoExistente.importeEditado) {
          return {
            id: gastoExistente.id || null,
            tipoGastoInicial: parametroId, // Asegurar que el ID del parámetro esté actualizado
            tipoGastoInicialCodigo: gastoPrecargado.codigo,
            valorCalculo: gastoExistente.valorCalculo ? (typeof gastoExistente.valorCalculo === 'string' ? gastoExistente.valorCalculo : parseFloat(gastoExistente.valorCalculo).toString()) : '',
            importe: gastoExistente.importe ? (typeof gastoExistente.importe === 'string' ? gastoExistente.importe : parseFloat(gastoExistente.importe).toString()) : '',
            estado: gastoExistente.estado || estadoPendienteId || '',
            observaciones: gastoExistente.observaciones || '',
            esNuevo: !gastoExistente.id,
            importeEditado: true // Mantener como editado
          };
        }
        
        // Si el gasto existe pero no fue editado, recalcular el importe si cambió montoInicial o duracionMeses
        // Obtener valorCalculo por defecto si no existe
        let valorCalculoDefault = '';
        if (gastoPrecargado.codigo === 'sellado') {
          valorCalculoDefault = '2';
        } else if (gastoPrecargado.codigo === 'honorarios') {
          valorCalculoDefault = '5';
        } else if (gastoPrecargado.codigo === 'deposito') {
          valorCalculoDefault = '1';
        }
        
        // Usar el valorCalculo existente si está disponible, sino usar el default
        const valorCalculoFinal = gastoExistente.valorCalculo || valorCalculoDefault;
        const importeCalculado = calcularImporteLocal(gastoPrecargado.codigo, valorCalculoFinal);
        const importeFinal = importeCalculado.toString();
        
        return {
          id: gastoExistente.id || null,
          tipoGastoInicial: parametroId,
          tipoGastoInicialCodigo: gastoPrecargado.codigo,
          valorCalculo: valorCalculoFinal,
          importe: importeFinal, // Recalcular el importe solo si no fue editado manualmente
          estado: gastoExistente.estado || estadoPendienteId || '',
          observaciones: gastoExistente.observaciones || '',
          esNuevo: !gastoExistente.id,
          importeEditado: false // No fue editado manualmente, puede recalcularse
        };
      }

      // Si no existe en el estado, crear uno nuevo con importe calculado y estado pendiente
      // Obtener valorCalculo por defecto
      let valorCalculoDefault = '';
      if (gastoPrecargado.codigo === 'sellado') {
        valorCalculoDefault = '2';
      } else if (gastoPrecargado.codigo === 'honorarios') {
        valorCalculoDefault = '5';
      } else if (gastoPrecargado.codigo === 'deposito') {
        valorCalculoDefault = '1';
      }
      
      const importeCalculado = calcularImporteLocal(gastoPrecargado.codigo, valorCalculoDefault);
      // Siempre guardar el importe como string, incluso si es 0 (para que se guarde en BD)
      const importeFinal = importeCalculado.toString();

      return {
        id: null,
        tipoGastoInicial: parametroId,
        tipoGastoInicialCodigo: gastoPrecargado.codigo,
        valorCalculo: valorCalculoDefault,
        importe: importeFinal, // Puede ser '0' si no hay montoInicial o duracionMeses
        estado: estadoPendienteId || '',
        observaciones: '',
        esNuevo: true,
        importeEditado: false
      };
    }).filter(g => g !== null && g.tipoGastoInicial); // Filtrar solo los que no tienen tipoGastoInicial válido

    // Eliminar duplicados basándose en tipoGastoInicialCodigo (debería haber solo uno de cada tipo)
    // Esto previene que se creen gastos duplicados si el useEffect se ejecuta múltiples veces
    const gastosUnicos = [];
    const codigosVistos = new Set();
    for (const gasto of gastosActualizados) {
      if (!codigosVistos.has(gasto.tipoGastoInicialCodigo)) {
        codigosVistos.add(gasto.tipoGastoInicialCodigo);
        gastosUnicos.push(gasto);
      } else {
        console.warn('⚠️ Gasto duplicado detectado y eliminado:', gasto.tipoGastoInicialCodigo, gasto);
      }
    }
    gastosActualizados = gastosUnicos;

    // Asegurar que siempre haya exactamente 4 gastos (los precargados)
    // Si faltan algunos, agregarlos
    if (gastosActualizados.length < 4) {
      const codigosExistentes = new Set(gastosActualizados.map(g => g.tipoGastoInicialCodigo));
      const gastosFaltantes = gastosPrecargados.filter(g => !codigosExistentes.has(g.codigo));
      
      gastosFaltantes.forEach(gastoPrecargado => {
        let parametroId = getParametroIdByCodigo(gastoPrecargado.parametroCodigo);
        if (!parametroId && parametroOtroId) {
          parametroId = parametroOtroId;
        }
        if (parametroId) {
          // Obtener valorCalculo por defecto
          let valorCalculoDefault = '';
          if (gastoPrecargado.codigo === 'sellado') {
            valorCalculoDefault = '2';
          } else if (gastoPrecargado.codigo === 'honorarios') {
            valorCalculoDefault = '5';
          } else if (gastoPrecargado.codigo === 'deposito') {
            valorCalculoDefault = '1';
          }
          
          const importeCalculado = calcularImporteLocal(gastoPrecargado.codigo, valorCalculoDefault);
          // Siempre guardar el importe como string, incluso si es 0 (para que se guarde en BD)
          gastosActualizados.push({
            id: null,
            tipoGastoInicial: parametroId,
            tipoGastoInicialCodigo: gastoPrecargado.codigo,
            valorCalculo: valorCalculoDefault,
            importe: importeCalculado.toString(), // Puede ser '0' si no hay montoInicial o duracionMeses
            estado: estadoPendienteId || '',
            observaciones: '',
            esNuevo: true,
            importeEditado: false
          });
        }
      });
    }

    console.log('🔄 Actualizando gastos editables:', {
      contratoId,
      montoInicial,
      duracionMeses,
      gastosActualizados: gastosActualizados.length,
      razon: !contratoId && gastosInicializadosRef.current ? 'Recálculo por cambio en montoInicial/duracionMeses' : 'Inicialización',
      importesEditados: gastosActualizados.filter(g => g.importeEditado).length,
      detalles: gastosActualizados.map(g => ({
        codigo: g.tipoGastoInicialCodigo,
        importeEditado: g.importeEditado,
        importe: g.importe
      }))
    });
    setGastosEditables(gastosActualizados);
    gastosInicializadosRef.current = true;
    // Actualizar referencias después de inicializar
    valoresPreviosRef.current = { 
      montoInicial: montoInicial || '', 
      duracionMeses: duracionMeses || '' 
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoGastoInicialData?.lista, estadoGastoMap?.lista, contrato?.gastosIniciales, contratoId, montoInicial, duracionMeses, estadoPendienteId]);

  // Ref para rastrear si ya se intentó guardar los gastos para este contratoId
  const gastosGuardadosRef = useRef(new Set());
  const prevContratoIdRef = useRef(contratoId);

  // Efecto para guardar gastos automáticamente cuando se crea el contrato
  // Este efecto se ejecuta cuando cambia contratoId de null/undefined a un valor
  useEffect(() => {
    const contratoIdAnterior = prevContratoIdRef.current;
    const contratoIdNuevo = contratoId && !contratoIdAnterior;
    
    // Actualizar la referencia
    prevContratoIdRef.current = contratoId;
    
    // Si hay un contratoId nuevo y los gastos están inicializados, guardar los gastos que no tienen ID
    if (contratoIdNuevo && gastosInicializadosRef.current) {
      // Verificar si ya se guardaron los gastos para este contratoId
      if (gastosGuardadosRef.current.has(contratoId)) {
        return; // Ya se guardaron los gastos para este contrato
      }

      // Usar el estado actual de gastosEditables
      const gastosActuales = gastosEditables;
      
      // Guardar gastos que no tienen ID (son nuevos y no están guardados en BD)
      const gastosAGuardar = gastosActuales.filter(g => 
        g && !g.id && g.importe && parseFloat(parseNumberFromFormatted(g.importe || '0')) > 0
      );
      
      if (gastosAGuardar.length > 0) {
        // Marcar que se están guardando los gastos para este contrato
        gastosGuardadosRef.current.add(contratoId);
        
        // Guardar cada gasto de forma secuencial
        (async () => {
          for (const gasto of gastosAGuardar) {
            try {
              const importeNum = parseFloat(parseNumberFromFormatted(gasto.importe || '0'));
              if (isNaN(importeNum) || importeNum < 0) continue;

              const payload = {
                tipoGastoInicial: gasto.tipoGastoInicial,
                valorCalculo: gasto.valorCalculo ? parseFloat(gasto.valorCalculo) : null,
                importe: importeNum,
                estado: gasto.estado || null,
                observaciones: gasto.observaciones || null
              };

              const nuevoGasto = await createMutation.mutateAsync(payload);
              
              // Actualizar el estado local con el ID asignado
              setGastosEditables(prev => {
                return prev.map(g => {
                  if (g.tipoGastoInicialCodigo === gasto.tipoGastoInicialCodigo && !g.id) {
                    return {
                      ...g,
                      id: nuevoGasto.id,
                      esNuevo: false,
                      importeEditado: true
                    };
                  }
                  return g;
                });
              });
            } catch (error) {
              console.error('Error al guardar gasto automáticamente:', error);
              // Remover el contratoId del Set si hay error para permitir reintento
              gastosGuardadosRef.current.delete(contratoId);
            }
          }
        })();
      } else {
        // Si no hay gastos para guardar, marcar como guardado igualmente
        gastosGuardadosRef.current.add(contratoId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/contratos/gastos-iniciales/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contrato', contratoId]);
      setSuccessMessage('Gasto inicial actualizado exitosamente');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      console.error('Error al actualizar gasto inicial:', error);
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post(`/contratos/${contratoId}/gastos-iniciales`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contrato', contratoId]);
      setSuccessMessage('Gasto inicial creado exitosamente');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      console.error('Error al crear gasto inicial:', error);
    }
  });

  const handleImporteChange = (index, nuevoImporte) => {
    setGastosEditables(prev => {
      const actualizados = [...prev];
      actualizados[index] = {
        ...actualizados[index],
        importe: nuevoImporte,
        importeEditado: true // Marcar como editado manualmente
      };
      return actualizados;
    });
  };

  const handleImporteBlur = async (gasto, index) => {
    // Si no hay contratoId, solo actualizar el estado local
    if (!contratoId) {
      // Marcar como editado para que no se recalcule automáticamente
      setGastosEditables(prev => {
        const actualizados = [...prev];
        if (actualizados[index]) {
          actualizados[index] = {
            ...actualizados[index],
            importeEditado: true
          };
        }
        return actualizados;
      });
      return;
    }

    const importeNum = parseFloat(parseNumberFromFormatted(gasto.importe || '0'));
    if (isNaN(importeNum) || importeNum < 0) {
      setSuccessMessage('El importe debe ser un número válido mayor o igual a 0');
      setSnackbarOpen(true);
      return;
    }

    const payload = {
      tipoGastoInicial: gasto.tipoGastoInicial,
      valorCalculo: gasto.valorCalculo ? parseFloat(gasto.valorCalculo) : null,
      importe: importeNum,
      estado: gasto.estado || null,
      observaciones: gasto.observaciones || null
    };

    try {
      if (gasto.id) {
        // Actualizar existente
        await updateMutation.mutateAsync({ id: gasto.id, data: payload });
      } else {
        // Crear nuevo
        const nuevoGasto = await createMutation.mutateAsync(payload);
        // Actualizar el estado local con el ID asignado
        setGastosEditables(prev => {
          const actualizados = [...prev];
          actualizados[index] = {
            ...actualizados[index],
            id: nuevoGasto.id,
            esNuevo: false,
            importeEditado: true // Mantener la marca de editado
          };
          return actualizados;
        });
      }
    } catch (error) {
      console.error('Error al guardar gasto:', error);
      setSuccessMessage('Error al guardar el gasto. Por favor, intente nuevamente.');
      setSnackbarOpen(true);
    }
  };

  const handleValorCalculoChange = (index, nuevoValor, gasto) => {
    setGastosEditables(prev => {
      const actualizados = [...prev];
      
      // Recalcular el importe automáticamente si es sellado, honorarios o deposito
      if (gasto.tipoGastoInicialCodigo === 'sellado' || 
          gasto.tipoGastoInicialCodigo === 'honorarios' || 
          gasto.tipoGastoInicialCodigo === 'deposito') {
        const montoInicialNum = parseFloat(parseNumberFromFormatted(montoInicial || '0')) || 0;
        const duracionMesesNum = parseInt(duracionMeses || '0') || 0;
        const montoTotalContrato = montoInicialNum * duracionMesesNum;
        
        let nuevoImporte = 0;
        if (gasto.tipoGastoInicialCodigo === 'sellado' || gasto.tipoGastoInicialCodigo === 'honorarios') {
          const porcentaje = parseFloat(nuevoValor) || 0;
          nuevoImporte = montoTotalContrato * (porcentaje / 100);
        } else if (gasto.tipoGastoInicialCodigo === 'deposito') {
          const meses = parseFloat(nuevoValor) || 1;
          nuevoImporte = montoInicialNum * meses;
        }
        
        // Actualizar solo el gasto específico que se está editando
        actualizados[index] = {
          ...actualizados[index],
          valorCalculo: nuevoValor,
          importe: nuevoImporte.toString(), // Siempre guardar como string, incluso si es '0'
          importeEditado: true // Marcar como editado para evitar que el useEffect lo sobrescriba
        };
      } else {
        // Para otros gastos (como averiguacion_garantias), solo actualizar el valorCalculo
        actualizados[index] = {
          ...actualizados[index],
          valorCalculo: nuevoValor
        };
      }
      
      return actualizados;
    });
  };

  const handleValorCalculoBlur = async (gasto, index) => {
    // Si no hay contratoId, solo actualizar el estado local
    if (!contratoId) return;

    const valorCalculoNum = parseFloat(gasto.valorCalculo || '0');
    if (isNaN(valorCalculoNum) || valorCalculoNum < 0) {
      setSuccessMessage('El valor debe ser un número válido mayor o igual a 0');
      setSnackbarOpen(true);
      return;
    }

    const payload = {
      tipoGastoInicial: gasto.tipoGastoInicial,
      valorCalculo: valorCalculoNum > 0 ? valorCalculoNum : null,
      importe: parseFloat(parseNumberFromFormatted(gasto.importe || '0')),
      estado: gasto.estado || null,
      observaciones: gasto.observaciones || null
    };

    try {
      if (gasto.id) {
        // Actualizar existente
        await updateMutation.mutateAsync({ id: gasto.id, data: payload });
      } else {
        // Crear nuevo
        const nuevoGasto = await createMutation.mutateAsync(payload);
        // Actualizar el estado local con el ID asignado
        setGastosEditables(prev => {
          const actualizados = [...prev];
          actualizados[index] = {
            ...actualizados[index],
            id: nuevoGasto.id,
            esNuevo: false,
            importeEditado: true
          };
          return actualizados;
        });
      }
    } catch (error) {
      console.error('Error al guardar gasto:', error);
      setSuccessMessage('Error al guardar el gasto. Por favor, intente nuevamente.');
      setSnackbarOpen(true);
    }
  };

  const handleEstadoChange = async (index, nuevoEstado) => {
    if (!contratoId) return;

    setGastosEditables(prev => {
      const actualizados = [...prev];
      actualizados[index] = {
        ...actualizados[index],
        estado: nuevoEstado
      };
      return actualizados;
    });

    const gasto = gastosEditables[index];
    if (!gasto.id) return; // Si no tiene ID, se guardará cuando se edite el importe

    const payload = {
      tipoGastoInicial: gasto.tipoGastoInicial,
      valorCalculo: gasto.valorCalculo ? parseFloat(gasto.valorCalculo) : null,
      importe: parseFloat(parseNumberFromFormatted(gasto.importe || '0')),
      estado: nuevoEstado || null,
      observaciones: gasto.observaciones || null
    };

    await updateMutation.mutateAsync({ id: gasto.id, data: payload });
  };

  const handleObservacionesChange = async (index, nuevasObservaciones) => {
    // Actualizar el estado local siempre
    setGastosEditables(prev => {
      const actualizados = [...prev];
      actualizados[index] = {
        ...actualizados[index],
        observaciones: nuevasObservaciones
      };
      return actualizados;
    });

    // Si no hay contratoId, solo actualizar el estado local
    if (!contratoId) return;

    const gasto = gastosEditables[index];
    if (!gasto.id) return; // Si no tiene ID, se guardará cuando se edite el importe

    const payload = {
      tipoGastoInicial: gasto.tipoGastoInicial,
      valorCalculo: gasto.valorCalculo ? parseFloat(gasto.valorCalculo) : null,
      importe: parseFloat(parseNumberFromFormatted(gasto.importe || '0')),
      estado: gasto.estado || null,
      observaciones: nuevasObservaciones || null
    };

    await updateMutation.mutateAsync({ id: gasto.id, data: payload });
  };

  // Obtener descripción del gasto
  const getDescripcionGasto = (gasto) => {
    if (gasto.tipoGastoInicialCodigo === 'sellado') return 'Sellado Contrato';
    if (gasto.tipoGastoInicialCodigo === 'honorarios') return 'Honorarios Inmobiliarios';
    if (gasto.tipoGastoInicialCodigo === 'deposito') return 'Deposito en garantia Inicial';
    if (gasto.tipoGastoInicialCodigo === 'averiguacion_garantias') return 'Averiguacion de garantias';
    return getDescripcion(tipoGastoInicialData, gasto.tipoGastoInicial);
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Gastos Iniciales</Typography>


      <TableContainer>
        <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ py: 1, fontWeight: 'bold' }}>Concepto</TableCell>
              <TableCell sx={{ py: 1, fontWeight: 'bold' }}>% / Cant.</TableCell>
              <TableCell sx={{ py: 1, fontWeight: 'bold' }}>Importe</TableCell>
              <TableCell sx={{ py: 1, fontWeight: 'bold' }}>Estado</TableCell>
              <TableCell sx={{ py: 1, fontWeight: 'bold' }}>Observaciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {gastosEditables.length === 0 && tipoGastoInicialData?.lista ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Cargando...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              gastosEditables.map((gasto, index) => {
                // Determinar el label y tipo de campo según el tipo de gasto
                let campoLabel = '';
                let mostrarCampo = true;
                if (gasto.tipoGastoInicialCodigo === 'sellado' || gasto.tipoGastoInicialCodigo === 'honorarios') {
                  campoLabel = '%';
                } else if (gasto.tipoGastoInicialCodigo === 'deposito') {
                  campoLabel = 'Meses';
                  mostrarCampo = false;
                } else if (gasto.tipoGastoInicialCodigo === 'averiguacion_garantias') {
                  campoLabel = 'Cant.';
                } else {
                  mostrarCampo = false;
                }

                return (
                  <TableRow key={`${gasto.tipoGastoInicialCodigo}-${gasto.id || index}`} sx={{ '& .MuiTableCell-root': { py: 0.5 } }}>
                    <TableCell sx={{ py: 0.5 }}>{getDescripcionGasto(gasto)}</TableCell>
                    {mostrarCampo && (
                      <TableCell sx={{ py: 0.5 }}>
                        <TextField
                          type="number"
                          size="small"
                          value={gasto.valorCalculo || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            handleValorCalculoChange(index, value, gasto);
                          }}
                          onBlur={() => handleValorCalculoBlur(gasto, index)}
                          placeholder={campoLabel}
                          sx={{ 
                            width: 100,
                            '& .MuiInputBase-root': { 
                              height: '32px',
                              fontSize: '0.875rem'
                            },
                            '& .MuiInputBase-input': {
                              py: 0.5,
                              px: 1
                            }
                          }}
                          inputProps={{ 
                            style: { MozAppearance: 'textfield' },
                            onWheel: (e) => e.target.blur(),
                            min: 0,
                            step: gasto.tipoGastoInicialCodigo === 'deposito' || gasto.tipoGastoInicialCodigo === 'averiguacion_garantias' ? 1 : 0.01
                          }}
                        />
                      </TableCell>
                    )}
                    {!mostrarCampo && <TableCell sx={{ py: 0.5 }}></TableCell>}
                    <TableCell sx={{ py: 0.5 }}>
                      <TextField
                        type="text"
                        size="small"
                        value={formatNumberWithThousands(parseNumberFromFormatted(gasto.importe || ''))}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || /^[\d.,]*$/.test(value)) {
                            handleImporteChange(index, value);
                          }
                        }}
                        onBlur={() => handleImporteBlur(gasto, index)}
                        sx={{ 
                          width: 130,
                          '& .MuiInputBase-root': { 
                            height: '32px',
                            fontSize: '0.875rem'
                          },
                          '& .MuiInputBase-input': {
                            py: 0.5,
                            px: 1
                          }
                        }}
                        inputProps={{ 
                          style: { MozAppearance: 'textfield' },
                          onWheel: (e) => e.target.blur()
                        }}
                      />
                    </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    <ParametroSelect
                      categoriaCodigo="estado_gasto"
                      value={gasto.estado || estadoPendienteId || ''}
                      onChange={(e) => handleEstadoChange(index, e.target.value)}
                      disabled={false}
                      size="small"
                      sx={{ 
                        minWidth: 130,
                        '& .MuiInputBase-root': { 
                          height: '32px',
                          fontSize: '0.875rem'
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    <TextField
                      size="small"
                      value={gasto.observaciones || ''}
                      onChange={(e) => handleObservacionesChange(index, e.target.value)}
                      onBlur={() => {
                        if (gasto.id && contratoId) {
                          handleObservacionesChange(index, gasto.observaciones);
                        }
                      }}
                      sx={{ 
                        width: 180,
                        '& .MuiInputBase-root': { 
                          height: '32px',
                          fontSize: '0.875rem'
                        },
                        '& .MuiInputBase-input': {
                          py: 0.5,
                          px: 1
                        }
                      }}
                    />
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

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
  const tipoImpuestoMap = useParametrosMap('tipo_cargo');
  const quienPagaMap = useParametrosMap('quien_paga');
  const monedaMap = useParametrosMap('moneda');
  const metodoAjusteMap = useParametrosMap('metodo_ajuste');
  const tipoUnidadMap = useParametrosMap('tipo_unidad');
  const estadoUnidadMap = useParametrosMap('estado_unidad');
  const tipoGarantiaMap = useParametrosMap('tipo_garantia');
  const estadoGarantiaMap = useParametrosMap('estado_garantia');
  const tipoGastoInicialMap = useParametrosMap('tipo_gasto_inicial');
  const estadoGastoMap = useParametrosMap('estado_gasto');
  const estadoContratoMap = useParametrosMap('estado_contrato');

  if (!contrato) {
    return <Alert severity="info">Cargando información del contrato...</Alert>;
  }

  const formatoMoneda = (valor) => {
    if (!valor) return '-';
    return parseFloat(valor).toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatoFecha = (fecha) => {
    if (!fecha) return '-';
    return dayjs(fecha).format('DD/MM/YYYY');
  };

  const periodoAjuste = contrato.periodoAumento || contrato.frecuenciaAjusteMeses || null;
  const proximoAjuste = periodoAjuste
    ? dayjs(contrato.ultimoAjusteAt || contrato.fechaInicio).add(periodoAjuste, 'month')
    : null;

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

        {/* Primera fila: Contrato y Propiedad */}
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
                  <Typography variant="caption" color="text.secondary" display="block">Monto Actual</Typography>
                  <Typography variant="body2" fontWeight="medium" color="success.main">
                    {formatoMoneda(contrato.montoActual || contrato.montoInicial)}
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
                {contrato.indiceAumento && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Índice</Typography>
                    <Typography variant="body2">{contrato.indiceAumento}</Typography>
                  </Grid>
                )}
                {periodoAjuste && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Período Ajuste</Typography>
                    <Typography variant="body2">{periodoAjuste} meses</Typography>
                  </Grid>
                )}
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Último Ajuste</Typography>
                  <Typography variant="body2">
                    {contrato.ultimoAjusteAt ? formatoFecha(contrato.ultimoAjusteAt) : 'Nunca'}
                  </Typography>
                </Grid>
                {proximoAjuste && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Próximo Ajuste estimado</Typography>
                    <Typography variant="body2">{formatoFecha(proximoAjuste)}</Typography>
                  </Grid>
                )}
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Estado</Typography>
                  <Chip 
                    label={String(getDescripcion(estadoContratoMap, contrato.estado) || contrato.estado || 'Borrador')} 
                    size="small"
                    color={
                      contrato.estado === 'activo' || contrato.estado === 'vigente' ? 'success' :
                      contrato.estado === 'vencido' ? 'error' :
                      contrato.estado === 'finalizado' ? 'default' :
                      contrato.estado === 'cancelado' || contrato.estado === 'anulado' ? 'warning' :
                      'default'
                    }
                    sx={{ mt: 0.5 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Registrado AFIP</Typography>
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

        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  Historial de Ajustes
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Configurá ajustes desde la pestaña "Ajustes" en la edición del contrato.
                </Typography>
              </Box>
              {contrato.ajustes && contrato.ajustes.length > 0 ? (
                <TableContainer>
                  <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.75rem' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="none"><strong>Fecha</strong></TableCell>
                        <TableCell padding="none"><strong>Índice</strong></TableCell>
                        <TableCell padding="none" align="right"><strong>Valor</strong></TableCell>
                        <TableCell padding="none" align="right"><strong>Monto anterior</strong></TableCell>
                        <TableCell padding="none" align="right"><strong>Monto nuevo</strong></TableCell>
                        <TableCell padding="none" align="right"><strong>% Aumento</strong></TableCell>
                        <TableCell padding="none"><strong>Origen</strong></TableCell>
                        <TableCell padding="none"><strong>Observaciones</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {contrato.ajustes.map((ajuste) => (
                        <TableRow key={ajuste.id}>
                          <TableCell padding="none">{formatoFecha(ajuste.fechaAjuste)}</TableCell>
                          <TableCell padding="none">{ajuste.indiceUsado}</TableCell>
                          <TableCell padding="none" align="right">
                            {parseFloat(ajuste.valorIndice).toLocaleString('es-AR', {
                              minimumFractionDigits: 4,
                              maximumFractionDigits: 4
                            })}
                          </TableCell>
                          <TableCell padding="none" align="right">
                            {formatoMoneda(ajuste.montoAnterior)}
                          </TableCell>
                          <TableCell padding="none" align="right">
                            {formatoMoneda(ajuste.montoNuevo)}
                          </TableCell>
                          <TableCell padding="none" align="right">
                            {parseFloat(ajuste.porcentajeAumento).toLocaleString('es-AR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}%
                          </TableCell>
                          <TableCell padding="none">{ajuste.origen === 'automatico' ? 'Automático' : 'Manual'}</TableCell>
                          <TableCell padding="none">{ajuste.observaciones || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Aún no se registraron ajustes para este contrato.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
