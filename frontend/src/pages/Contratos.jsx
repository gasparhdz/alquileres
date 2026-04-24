import React, { useEffect, useLayoutEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
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
  InputAdornment,
  TableSortLabel,
  TablePagination,
  Tooltip,
  Link,
  Avatar
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import DescriptionIcon from '@mui/icons-material/Description';
import CloseIcon from '@mui/icons-material/Close';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import api from '../api';
import { usePermissions } from '../contexts/AuthContext';
import ParametroSelect from '../components/ParametroSelect';
import ConfirmDialog from '../components/ConfirmDialog';
import RequirePermission from '../components/RequirePermission';
import { getReturnUrl } from '../utils/returnPath';
import { useParametrosMap, getDescripcion, getAbreviatura } from '../utils/parametros';
import { useDebounce } from '../hooks/useDebounce';
import dayjs from 'dayjs';

// Función helper para parsear fechas del backend como hora local (no UTC)
// Esto evita el problema de que las fechas se muestren un día antes
const parseFechaLocal = (fecha) => {
  if (!fecha) return null;
  // Si la fecha viene como string ISO con timezone, extraer solo la parte de fecha
  // y crear un objeto dayjs en hora local
  if (typeof fecha === 'string') {
    // Extraer YYYY-MM-DD de cualquier formato
    const match = fecha.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      // Crear fecha en hora local (no UTC)
      return dayjs(`${year}-${month}-${day}`).startOf('day');
    }
  }
  // Si es un objeto Date, crear dayjs y ajustar a hora local
  return dayjs(fecha).startOf('day');
};

function TabPanel({ children, value, index }) {
  // Siempre montar children: si solo se renderiza la pestaña activa, Gastos Iniciales no existe
  // hasta visitarla y gastosEditablesRef queda vacío al guardar desde otra pestaña.
  return (
    <div role="tabpanel" hidden={value !== index}>
      <Box sx={{ pt: 2 }}>{children}</Box>
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
// Convierte "250.000" -> "250000" -> 250000
const parseNumberFromFormatted = (value) => {
  if (!value && value !== 0) return '';
  // Convertir a string y remover todos los puntos (separadores de miles)
  const str = value.toString();
  // Remover puntos (separadores de miles) y reemplazar coma por punto (decimal)
  const cleaned = str.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  // Retornar como string para mantener consistencia, o número vacío si es NaN
  return isNaN(parsed) ? '' : parsed.toString();
};

/**
 * Persiste gastos iniciales al guardar el contrato (PUT/POST por ítem).
 * No usa refs de React: recibe el array ya resuelto en el momento del submit.
 */
async function persistGastosInicialesAlGuardarContrato(apiClient, { contratoId, gastosEditables, allow }) {
  if (!allow || !contratoId || !Array.isArray(gastosEditables) || gastosEditables.length === 0) {
    return;
  }

  const { data: contratoData } = await apiClient.get(`/contratos/${contratoId}`);
  const gastosExistentes = contratoData?.gastosIniciales || [];

  let actoresCache = null;
  const obtenerActores = async () => {
    if (actoresCache) return actoresCache;
    const actoresResponse = await apiClient.get('/catalogos-abm/actores-responsable-contrato');
    actoresCache = actoresResponse.data || [];
    return actoresCache;
  };

  const promises = [];

  for (const gasto of gastosEditables) {
    const valorCalculoNum = gasto.valorCalculo ? parseFloat(gasto.valorCalculo) : null;
    const rawImp = gasto.importe;
    let importeNum;
    if (typeof rawImp === 'number' && Number.isFinite(rawImp)) {
      importeNum = rawImp;
    } else if (rawImp != null && rawImp !== '') {
      const s = typeof rawImp === 'object' && typeof rawImp.toString === 'function' ? rawImp.toString() : String(rawImp);
      const parsedStr = parseNumberFromFormatted(s);
      importeNum = parsedStr === '' || parsedStr == null ? NaN : parseFloat(String(parsedStr));
      if (Number.isNaN(importeNum)) {
        importeNum = parseFloat(s.replace(/\./g, '').replace(',', '.'));
      }
    } else {
      importeNum = NaN;
    }

    if (Number.isNaN(importeNum) || importeNum < 0) {
      continue;
    }

    const tipoGastoId = gasto.tipoGastoInicialId != null ? Number(gasto.tipoGastoInicialId) : null;
    if (tipoGastoId == null || Number.isNaN(tipoGastoId)) {
      continue;
    }

    const gastoExistente = gastosExistentes.find(
      (g) => Number(g.tipoGastoInicialId) === tipoGastoId
    );

    let quienPagaId = gasto.quienPagaId ?? gastoExistente?.quienPagaId;
    if (!quienPagaId) {
      try {
        const actores = await obtenerActores();
        const inquilinoActor = actores.find((a) => a.codigo === 'INQ' && a.activo);
        quienPagaId = inquilinoActor ? inquilinoActor.id : (actores.find((a) => a.activo)?.id || null);
      } catch (error) {
        console.error('Error al obtener actores responsables:', error);
      }
    }

    const quienPagaNum =
      quienPagaId !== '' && quienPagaId != null ? Number(quienPagaId) : null;
    const payload = {
      tipoGastoInicialId: tipoGastoId,
      valorCalculo: valorCalculoNum > 0 ? valorCalculoNum : null,
      importe: importeNum,
      quienPagaId: quienPagaNum != null && !Number.isNaN(quienPagaNum) ? quienPagaNum : null
    };

    if (gastoExistente) {
      promises.push(
        apiClient.put(`/contratos/gastos-iniciales/${gastoExistente.id}`, payload).catch((error) => {
          console.error('Error al actualizar gasto inicial:', error);
          throw error;
        })
      );
    } else {
      promises.push(
        apiClient.post(`/contratos/${contratoId}/gastos-iniciales`, payload).catch((error) => {
          console.error('Error al crear gasto inicial:', error);
          throw error;
        })
      );
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

/** ID del contrato en edición: editing puede ser objeto (grilla) o número (deep link). */
function resolveEditingContratoId(editing) {
  if (typeof editing === 'number' && Number.isFinite(editing)) return editing;
  if (editing != null && typeof editing === 'object' && editing.id != null) return editing.id;
  return null;
}

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
    propiedadId: '',
    inquilinoId: '',
    nroContrato: '',
    fechaInicio: '',
    fechaFin: '',
    duracionMeses: '',
    montoInicial: '',
    montoActual: '',
    gastosAdministrativos: '',
    honorariosPropietario: '',
    metodoAjusteContratoId: '',
    frecuenciaAjusteMeses: '',
    monedaId: '',
    estadoContratoId: '',
    cantidadGarantiasNecesarias: '',
    gastosInicialesLiquidados: false,
  });
  const [propietarioNombre, setPropietarioNombre] = useState('');
  const [montoTotalContrato, setMontoTotalContrato] = useState(0);
  const [ultimaFechaFinCalculada, setUltimaFechaFinCalculada] = useState(null);
  const [errors, setErrors] = useState({});
  // Estados temporales para pestañas (se guardan al crear el contrato)
  const [responsabilidadesTemporales, setResponsabilidadesTemporales] = useState([]);
  const [garantiasTemporales, setGarantiasTemporales] = useState([]);
  const [gastosInicialesTemporales, setGastosInicialesTemporales] = useState([]);
  /** Gastos iniciales al editar un contrato existente (estado en padre para que Guardar envíe siempre la lista actual). */
  const [gastosInicialesEdicion, setGastosInicialesEdicion] = useState([]);

  // Ref para acceder a los gastos editables desde updateMutation (respaldo; al editar se usa gastosInicialesEdicion)
  const gastosEditablesRef = useRef([]);
  const responsabilidadesEditablesRef = useRef([]);
  // Estado para filtro
  const [filtroEstado, setFiltroEstado] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [orderBy, setOrderBy] = useState('nroContrato');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  // Deep link: abrir contrato en tab Ajustes y/o modal Nuevo ajuste
  const [openNuevoAjusteModal, setOpenNuevoAjusteModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  // Confirmación de eliminación de contrato (evita window.confirm)
  const [contratoAEliminar, setContratoAEliminar] = useState(null);

  // Permisos RBAC para pestañas del formulario (solo lectura si no tiene crear/editar)
  // Backend: GET /api/auth/me y login devuelven user.permisos = array de códigos (ej. 'contrato.gastos_iniciales.crear')
  const { hasPermission, permisos } = usePermissions();
  const puedeCrearGastos = hasPermission('contrato.gastos_iniciales.crear');
  const puedeEditarGastos = hasPermission('contrato.gastos_iniciales.editar');
  const puedeCrearResponsabilidades = hasPermission('contrato.responsabilidades.crear');
  const puedeEditarResponsabilidades = hasPermission('contrato.responsabilidades.editar');
  const puedeCrearGarantias = hasPermission('contrato.garantias.crear');
  const puedeEditarGarantias = hasPermission('contrato.garantias.editar');
  const readonlyGastos = !puedeCrearGastos && !puedeEditarGastos;
  const readonlyResponsabilidades = !puedeCrearResponsabilidades && !puedeEditarResponsabilidades;
  const readonlyGarantias = !puedeCrearGarantias && !puedeEditarGarantias;

  // Debug: en consola podés ver qué permisos llegan y si las pestañas quedan en solo lectura
  useEffect(() => {
    if (import.meta.env.DEV && open) {
      const relacionados = permisos.filter(p => typeof p === 'string' && p.startsWith('contrato.'));
      console.debug('[Contratos RBAC] permisos del usuario (contrato.*):', relacionados);
      console.debug('[Contratos RBAC] gastos_iniciales/responsabilidades/garantias → readonly:', { readonlyGastos, readonlyResponsabilidades, readonlyGarantias });
    }
  }, [open, permisos, readonlyGastos, readonlyResponsabilidades, readonlyGarantias]);

  // Efecto para abrir automáticamente el modal de Detalle si viene por URL (ej. Return Path)
  useEffect(() => {
    const viewId = searchParams.get('view');
    if (viewId && !viewOpen) {
      setSelectedContrato(Number(viewId));
      setViewOpen(true);

      // Limpiamos el parámetro de la URL para no volver a abrirlo al refrescar manualmente
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('view');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, viewOpen, setSearchParams]);

  // Al cerrar "Editar Contrato" (Cancelar/Guardar/X) volver siempre al origen: Dashboard, Contratos, o donde sea
  const navigate = useNavigate();
  const location = useLocation();
  const returnToRef = useRef(null);
  if (location.state?.from != null) returnToRef.current = location.state.from;
  if (location.state?.returnTo != null) {
    const url = getReturnUrl(location.state);
    returnToRef.current = url || location.state.returnTo;
  }
  const returnTo = location.state?.from ?? getReturnUrl(location.state) ?? location.state?.returnTo ?? returnToRef.current ?? null;
  const shouldNavigateToReturn = useMemo(() => {
    if (!returnTo) return false;
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
      const returnUrl = new URL(returnTo, origin);
      return returnUrl.pathname !== location.pathname;
    } catch {
      return returnTo !== location.pathname;
    }
  }, [returnTo, location.pathname]);

  const handleCloseView = useCallback(() => {
    setViewOpen(false);
    setSelectedContrato(null);
    if (shouldNavigateToReturn) {
      navigate(returnTo);
    }
  }, [shouldNavigateToReturn, returnTo, navigate]);

  const queryClient = useQueryClient();

  const searchDebounced = useDebounce(searchTerm, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['contratos', page, rowsPerPage, searchDebounced, filtroEstado, orderBy, order],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        activo: true
      });
      if (searchDebounced) params.append('search', searchDebounced);
      if (filtroEstado) params.append('estado', filtroEstado);
      if (orderBy) params.append('orderBy', orderBy);
      if (order) params.append('order', order);

      const response = await api.get(`/contratos?${params.toString()}`);
      return response.data;
    }
  });

  const { data: propiedades } = useQuery({
    queryKey: ['propiedades'],
    queryFn: async () => {
      const response = await api.get('/propiedades');
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

  // Catálogos para contratos
  const { data: monedas } = useQuery({
    queryKey: ['monedas'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/monedas');
      return response.data;
    }
  });

  const { data: estadosContrato } = useQuery({
    queryKey: ['estados-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/estados-contrato');
      return response.data;
    }
  });

  const { data: metodosAjusteContrato } = useQuery({
    queryKey: ['metodos-ajuste-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/metodos-ajuste-contrato');
      return response.data;
    }
  });

  const { data: tiposGarantiaContrato } = useQuery({
    queryKey: ['tipos-garantia-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-garantia-contrato');
      return response.data;
    }
  });

  const { data: estadosGarantiaContrato } = useQuery({
    queryKey: ['estados-garantia-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/estados-garantia-contrato');
      return response.data;
    }
  });

  const { data: tiposGastoInicialContrato } = useQuery({
    queryKey: ['tipos-gasto-inicial-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-gasto-inicial-contrato');
      return response.data;
    }
  });

  const { data: actoresResponsablesContrato } = useQuery({
    queryKey: ['actores-responsable-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/actores-responsable-contrato');
      return response.data;
    }
  });

  // Obtener propiedad seleccionada para mostrar propietarios
  const propiedadSeleccionada = useMemo(() => {
    if (!formData.propiedadId || !propiedades) return null;
    return Array.isArray(propiedades)
      ? propiedades.find(p => p.id === formData.propiedadId)
      : propiedades.data?.find(p => p.id === formData.propiedadId);
  }, [formData.propiedadId, propiedades]);

  // Obtener índices de ajuste activos
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

  // Función auxiliar para obtener nombre de estado por código
  const getEstadoNombre = (codigo) => {
    if (!codigo || !estadosContrato) return 'Sin estado';
    const estado = estadosContrato.find(e => e.codigo === codigo);
    return estado?.nombre || codigo;
  };

  // Función auxiliar para obtener nombre de moneda por ID
  const getMonedaNombre = (monedaId) => {
    if (!monedaId || !monedas) return 'Sin moneda';
    const moneda = monedas.find(m => m.id === monedaId);
    return moneda?.nombre || moneda?.codigo || 'Sin moneda';
  };

  // Función auxiliar para obtener nombre de método de ajuste por ID
  const getMetodoAjusteNombre = (metodoAjusteId) => {
    if (!metodoAjusteId || !metodosAjusteContrato) return 'Sin método';
    const metodo = metodosAjusteContrato.find(m => m.id === metodoAjusteId);
    return metodo?.nombre || metodo?.codigo || 'Sin método';
  };

  // Función para calcular días hasta vencimiento y estado de alerta
  const calcularAlertaVencimiento = (fechaFin, estadoCodigo) => {
    if (!fechaFin) return { diasRestantes: null, proximoAVencer: false, yaVencido: false };

    // No mostrar alerta para contratos finalizados/cancelados/anulados
    if (['FINALIZADO', 'CANCELADO', 'ANULADO', 'RESCINDIDO', 'finalizado', 'cancelado', 'anulado', 'rescindido'].includes(estadoCodigo)) {
      return { diasRestantes: null, proximoAVencer: false, yaVencido: false };
    }

    const fechaFinParsed = parseFechaLocal(fechaFin);
    const hoy = dayjs().startOf('day');
    const diasRestantes = fechaFinParsed.diff(hoy, 'day');

    return {
      diasRestantes,
      proximoAVencer: diasRestantes > 0 && diasRestantes <= 60,
      yaVencido: diasRestantes <= 0
    };
  };

  // Función para obtener tooltip de ajuste de monto
  const getAjusteTooltip = (contrato) => {
    const metodo = getMetodoAjusteNombre(contrato.metodoAjusteContratoId);
    const frecuencia = contrato.frecuenciaAjusteMeses;

    if (!contrato.metodoAjusteContratoId || metodo === 'Sin método') {
      return null;
    }

    let frecuenciaTexto = '';
    if (frecuencia === 1) frecuenciaTexto = 'Mensual';
    else if (frecuencia === 2) frecuenciaTexto = 'Bimestral';
    else if (frecuencia === 3) frecuenciaTexto = 'Trimestral';
    else if (frecuencia === 4) frecuenciaTexto = 'Cuatrimestral';
    else if (frecuencia === 6) frecuenciaTexto = 'Semestral';
    else if (frecuencia === 12) frecuenciaTexto = 'Anual';
    else if (frecuencia) frecuenciaTexto = `Cada ${frecuencia} meses`;

    return `Ajuste ${metodo}${frecuenciaTexto ? ` - ${frecuenciaTexto}` : ''}`;
  };

  const contratosPaginados = useMemo(() => {
    return data?.data || [];
  }, [data]);

  const totalRegistros = data?.pagination?.total || 0;

  const handleSortContratos = (column) => {
    const isAsc = orderBy === column && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(column);
    setPage(0);
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Crear el contrato
      const contratoResponse = await api.post('/contratos', data);
      const contratoCreado = contratoResponse.data;

      // Guardar responsabilidades, garantías y gastos iniciales (solo si el usuario tiene permiso)
      const promises = [];

      // Guardar responsabilidades (omitir si no tiene permiso)
      if (!readonlyResponsabilidades && responsabilidadesTemporales.length > 0) {
        responsabilidadesTemporales.forEach(resp => {
          promises.push(
            api.post(`/contratos/${contratoCreado.id}/responsabilidades`, resp)
          );
        });
      }

      // Guardar garantías (omitir si no tiene permiso)
      if (!readonlyGarantias && garantiasTemporales.length > 0) {
        garantiasTemporales.forEach(garantia => {
          promises.push(
            api.post(`/contratos/${contratoCreado.id}/garantias`, garantia)
          );
        });
      }

      // Crear automáticamente todos los gastos iniciales activos (omitir si no tiene permiso)
      if (!readonlyGastos) {
        // Obtener los tipos de gasto activos desde el catálogo
        const tiposGastoResponse = await api.get('/catalogos-abm/tipos-gasto-inicial-contrato');
        const tiposGastoActivos = tiposGastoResponse.data?.filter(t => t.activo === true) || [];

        // Calcular montoInicial y duracionMeses para calcular importes
        const montoInicialStr = data.montoInicial || '0';
        const montoInicialParsed = montoInicialStr.toString().replace(/\./g, '').replace(',', '.');
        const montoInicialNum = parseFloat(montoInicialParsed) || 0;
        const duracionMesesNum = parseInt(String(data.duracionMeses || '0'), 10) || 0;
        const montoTotalContrato = montoInicialNum * duracionMesesNum;

        // Función para calcular el importe de un gasto
        const calcularImporteGasto = (tipoGasto) => {
          const valorDefault = tipoGasto.valorDefault ? parseFloat(tipoGasto.valorDefault) : null;

          if (tipoGasto.esPorcentaje && valorDefault !== null && montoTotalContrato > 0) {
            // Si es porcentaje, calcular sobre el monto total del contrato
            const porcentajeDecimal = valorDefault / 100;
            const importeCalculado = montoTotalContrato * porcentajeDecimal;
            return Math.round(importeCalculado * 100) / 100;
          } else if (!tipoGasto.esPorcentaje && valorDefault !== null && montoInicialNum > 0) {
            // Si no es porcentaje (ej: Depósito), multiplicar el valor por el monto inicial
            return montoInicialNum * valorDefault;
          }

          // Si no hay valorDefault o no se puede calcular, retornar 0
          return 0;
        };

        // Crear un gasto inicial para cada tipo activo
        tiposGastoActivos.forEach(tipoGasto => {
          const valorCalculo = tipoGasto.valorDefault ? parseFloat(tipoGasto.valorDefault) : null;
          const importe = calcularImporteGasto(tipoGasto);

          promises.push(
            api.post(`/contratos/${contratoCreado.id}/gastos-iniciales`, {
              tipoGastoInicialId: tipoGasto.id,
              valorCalculo: valorCalculo,
              importe: importe
            }).catch(error => {
              console.error(`❌ Error al crear gasto inicial: ${tipoGasto.codigo}`, error);
              // No lanzar error para que no falle la creación del contrato
              // Solo loguear el error
            })
          );
        });

        // También guardar los gastos temporales si existen (por si el usuario editó alguno antes de crear)
        if (gastosInicialesTemporales.length > 0) {
          // Obtener el contrato completo una sola vez para buscar gastos existentes
          const contratoCompleto = await api.get(`/contratos/${contratoCreado.id}`);
          const gastosExistentes = contratoCompleto.data?.gastosIniciales || [];

          // Procesar cada gasto temporal
          for (const gasto of gastosInicialesTemporales) {
            // Validar que el gasto tenga tipoGastoInicialId válido
            if (!gasto.tipoGastoInicialId) {
              console.warn('⚠️ Gasto sin tipoGastoInicialId:', gasto);
              continue;
            }

            // Verificar si ya se creó este tipo de gasto automáticamente
            const yaExiste = tiposGastoActivos.some(t => t.id === gasto.tipoGastoInicialId);
            if (yaExiste) {
              // Si ya existe, actualizar en lugar de crear
              const importeNum = parseFloat(parseNumberFromFormatted(gasto.importe || '0'));
              if (!isNaN(importeNum) && importeNum >= 0) {
                // Buscar el gasto existente en la lista que ya obtuvimos
                const gastoExistente = gastosExistentes.find(
                  g => g.tipoGastoInicialId === gasto.tipoGastoInicialId
                );

                if (gastoExistente) {
                  promises.push(
                    api.put(`/contratos/gastos-iniciales/${gastoExistente.id}`, {
                      tipoGastoInicialId: gasto.tipoGastoInicialId,
                      valorCalculo: gasto.valorCalculo ? parseFloat(gasto.valorCalculo) : null,
                      importe: importeNum
                    }).catch(error => {
                      console.error(`❌ Error al actualizar gasto: ${gasto.tipoGastoInicialCodigo}`, error);
                    })
                  );
                }
              }
            } else {
              // Si no existe en los tipos activos, crear como gasto adicional
              const importeNum = parseFloat(parseNumberFromFormatted(gasto.importe || '0'));
              if (!isNaN(importeNum) && importeNum >= 0) {
                promises.push(
                  api.post(`/contratos/${contratoCreado.id}/gastos-iniciales`, {
                    tipoGastoInicialId: gasto.tipoGastoInicialId,
                    valorCalculo: gasto.valorCalculo ? parseFloat(gasto.valorCalculo) : null,
                    importe: importeNum
                  }).catch(error => {
                    console.error(`❌ Error al guardar gasto: ${gasto.tipoGastoInicialCodigo}`, error);
                  })
                );
              }
            }
          }
        }
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
    mutationFn: async ({ id, data, gastosIniciales: gastosInicialesArg, allowGastos }) => {
      // Actualizar el contrato
      const contratoResponse = await api.put(`/contratos/${id}`, data);
      const contratoActualizado = contratoResponse.data;

      const gastosEditables = Array.isArray(gastosInicialesArg) ? gastosInicialesArg : [];
      const puedeGastos = allowGastos !== undefined ? allowGastos : !readonlyGastos;
      await persistGastosInicialesAlGuardarContrato(api, {
        contratoId: id,
        gastosEditables,
        allow: puedeGastos && !!id
      });

      // Guardar/actualizar responsabilidades si hay contratoId (omitir si no tiene permiso)
      const responsabilidadesEditables = responsabilidadesEditablesRef.current;
      if (!readonlyResponsabilidades && id && responsabilidadesEditables.length > 0) {
        const promises = [];

        // Obtener responsabilidades existentes en la BD
        const contratoData = await api.get(`/contratos/${id}`);
        const responsabilidadesExistentes = contratoData.data?.responsabilidades || [];

        for (const responsabilidad of responsabilidadesEditables) {
          // Procesar tanto impuestos como cargos
          if (!responsabilidad.tipoImpuestoId && !responsabilidad.tipoCargoId) {
            continue;
          }

          const payload = {
            ...(responsabilidad.tipoImpuestoId && { tipoImpuestoId: parseInt(responsabilidad.tipoImpuestoId) }),
            ...(responsabilidad.tipoCargoId && { tipoCargoId: parseInt(responsabilidad.tipoCargoId) }),
            ...(responsabilidad.tipoExpensaId != null && responsabilidad.tipoExpensaId !== '' && { tipoExpensaId: parseInt(responsabilidad.tipoExpensaId) }),
            quienPagaProveedorId: responsabilidad.quienPagaProveedorId ? parseInt(responsabilidad.quienPagaProveedorId) : null,
            quienSoportaCostoId: responsabilidad.quienSoportaCostoId ? parseInt(responsabilidad.quienSoportaCostoId) : null
          };

          const responsabilidadExistente = responsabilidadesExistentes.find(
            r => (responsabilidad.tipoImpuestoId && r.tipoImpuestoId === responsabilidad.tipoImpuestoId) ||
              (responsabilidad.tipoCargoId && r.tipoCargoId === responsabilidad.tipoCargoId && (r.tipoExpensaId ?? null) === (responsabilidad.tipoExpensaId ?? null))
          );

          if (responsabilidadExistente) {
            // Actualizar existente
            const tipoDesc = responsabilidad.tipoImpuestoId ? `impuesto ${responsabilidad.tipoImpuestoId}` : `cargo ${responsabilidad.tipoCargoId}`;
            promises.push(
              api.put(`/contratos/responsabilidades/${responsabilidadExistente.id}`, payload).catch(error => {
                console.error(`❌ Error al actualizar responsabilidad: ${tipoDesc}`, error);
                throw error;
              })
            );
          } else {
            // Crear nuevo solo si no existe
            const tipoDesc = responsabilidad.tipoImpuestoId ? `impuesto ${responsabilidad.tipoImpuestoId}` : `cargo ${responsabilidad.tipoCargoId}`;
            promises.push(
              api.post(`/contratos/${id}/responsabilidades`, payload).catch(error => {
                console.error(`❌ Error al crear responsabilidad: ${tipoDesc}`, error);
                throw error;
              })
            );
          }
        }

        // Esperar a que se guarden todas las responsabilidades
        await Promise.all(promises);
      }

      return contratoActualizado;
    },
    onSuccess: async (data, variables) => {
      // Invalidar todas las queries relacionadas con contratos
      await queryClient.invalidateQueries(['contratos']);
      await queryClient.invalidateQueries({ queryKey: ['contrato', variables.id] });
      if (editing?.id && editing.id !== variables.id) {
        await queryClient.invalidateQueries({ queryKey: ['contrato', editing.id] });
      }
      // Forzar refetch de la query del contrato para actualizar los gastos
      await queryClient.refetchQueries({ queryKey: ['contrato', variables.id] });
      setOpen(false);
      resetForm();
      setSuccessMessage('Contrato actualizado exitosamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);

      // Navegar de vuelta a la ruta de origen si existe (ej: Dashboard)
      if (shouldNavigateToReturn) {
        navigate(returnTo);
      }
    },
    onError: (error) => {
      console.error('Error al actualizar contrato:', error);
      const msg =
        error?.response?.data?.error ||
        error?.message ||
        'Error al guardar el contrato';
      setSuccessMessage(msg);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/contratos/${id}`),
    onSuccess: () => {
      setContratoAEliminar(null);
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

    }
  });

  const { data: contratoDetalle, isLoading: isLoadingContratoDetalle, error: errorContratoDetalle } = useQuery({
    queryKey: ['contrato', selectedContrato],
    queryFn: async () => {
      if (!selectedContrato) return null;
      const response = await api.get(`/contratos/${selectedContrato}`);
      return response.data;
    },
    enabled: !!selectedContrato
  });

  const editingId = resolveEditingContratoId(editing);
  const { data: contratoParaEditar } = useQuery({
    queryKey: ['contrato', editingId],
    queryFn: async () => {
      const response = await api.get(`/contratos/${editingId}`);
      return response.data;
    },
    // editing suele ser el objeto contrato desde la grilla, no un number
    enabled: !!open && !!editingId
  });

  useEffect(() => {
    if (!open || !editingId || !contratoParaEditar) return;
    const c = contratoParaEditar;
    const propiedad = c.propiedad;
    const propietarios = propiedad?.propietarios || [];
    const nombrePropietario = propietarios.length > 0
      ? propietarios.map(p => {
        const prop = p.propietario || p;
        return prop.razonSocial || `${prop.nombre || ''} ${prop.apellido || ''}`.trim();
      }).join(', ')
      : 'Sin propietario';
    setPropietarioNombre(nombrePropietario);
    const montoInicial = parseFloat(c.montoInicial) || 0;
    const duracionMeses = parseInt(c.duracionMeses) || 0;
    setMontoTotalContrato(montoInicial * duracionMeses);
    setFormData({
      propiedadId: c.propiedadId || '',
      inquilinoId: c.inquilinoId || '',
      nroContrato: c.nroContrato || '',
      fechaInicio: c.fechaInicio ? parseFechaLocal(c.fechaInicio).format('YYYY-MM-DD') : '',
      fechaFin: c.fechaFin ? parseFechaLocal(c.fechaFin).format('YYYY-MM-DD') : '',
      duracionMeses: c.duracionMeses || '',
      montoInicial: c.montoInicial ? formatNumberWithThousands(c.montoInicial) : '',
      montoActual: (c.montoActual || c.montoInicial) ? formatNumberWithThousands(c.montoActual || c.montoInicial) : '',
      gastosAdministrativos: c.gastosAdministrativos || '',
      honorariosPropietario: c.honorariosPropietario || '',
      metodoAjusteContratoId: c.metodoAjusteContratoId ?? c.metodoAjusteId ?? '',
      frecuenciaAjusteMeses: c.frecuenciaAjusteMeses || '',
      monedaId: c.monedaId || '',
      estadoContratoId: c.estadoContratoId || '',
      cantidadGarantiasNecesarias: c.cantidadGarantiasNecesarias != null ? String(c.cantidadGarantiasNecesarias) : '',
      gastosInicialesLiquidados: c.gastosInicialesLiquidados || false,
    });
    setEditing(c);
  }, [open, editingId, editing, contratoParaEditar]);

  const resetForm = () => {
    setFormData({
      propiedadId: '',
      inquilinoId: '',
      nroContrato: '',
      fechaInicio: '',
      fechaFin: '',
      duracionMeses: '',
      montoInicial: '',
      montoActual: '',
      gastosAdministrativos: '',
      honorariosPropietario: '',
      metodoAjusteContratoId: '',
      frecuenciaAjusteMeses: '',
      monedaId: '',
      estadoContratoId: '',
      cantidadGarantiasNecesarias: '',
      gastosInicialesLiquidados: false,
      registradoAfip: false
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
    setGastosInicialesEdicion([]);
    setUltimaFechaFinCalculada(null);
  };

  // Autocalcular Fecha Fin cuando cambian Fecha Inicio y Duración
  useEffect(() => {
    if (formData.fechaInicio && formData.duracionMeses) {
      const duracion = parseInt(formData.duracionMeses);
      if (duracion > 0) {
        const fechaInicio = dayjs(formData.fechaInicio);
        if (fechaInicio.isValid()) {
          // Fecha Fin = Fecha Inicio + Duración meses - 1 día
          const fechaFinCalculada = fechaInicio.add(duracion, 'month').subtract(1, 'day').format('YYYY-MM-DD');

          // Solo actualizar si es diferente a la última calculada (evita loops)
          if (fechaFinCalculada !== ultimaFechaFinCalculada) {
            setFormData(prev => ({ ...prev, fechaFin: fechaFinCalculada }));
            setUltimaFechaFinCalculada(fechaFinCalculada);
            if (errors.fechaFin) {
              setErrors(prev => ({ ...prev, fechaFin: '' }));
            }
          }
        }
      }
    }
  }, [formData.fechaInicio, formData.duracionMeses]);

  const handleOpen = () => {
    returnToRef.current = location.pathname; // Al cerrar, volver a donde estaba
    resetForm();
    setOpen(true);
  };

  const handleEdit = (contrato) => {
    returnToRef.current = location.pathname; // Al cerrar este modal, volver a esta página (Contratos u otra)
    setGastosInicialesEdicion([]);
    setEditing(contrato);
    setTabValue(0); // Resetear a la primera pestaña al editar

    // Obtener propietarios de la propiedad
    const propiedad = contrato.propiedad;
    const propietarios = propiedad?.propietarios || [];
    const nombrePropietario = propietarios.length > 0
      ? propietarios.map(p => {
        const prop = p.propietario || p;
        return prop.razonSocial || `${prop.nombre || ''} ${prop.apellido || ''}`.trim();
      }).join(', ')
      : 'Sin propietario';

    setPropietarioNombre(nombrePropietario);

    const montoInicial = parseFloat(contrato.montoInicial) || 0;
    const duracionMeses = parseInt(contrato.duracionMeses) || 0;
    setMontoTotalContrato(montoInicial * duracionMeses);

    setFormData({
      propiedadId: contrato.propiedadId || '',
      inquilinoId: contrato.inquilinoId || '',
      nroContrato: contrato.nroContrato || '',
      // Usar parseFechaLocal para evitar problemas de zona horaria al cargar fechas
      fechaInicio: contrato.fechaInicio ? parseFechaLocal(contrato.fechaInicio).format('YYYY-MM-DD') : '',
      fechaFin: contrato.fechaFin ? parseFechaLocal(contrato.fechaFin).format('YYYY-MM-DD') : '',
      duracionMeses: contrato.duracionMeses || '',
      montoInicial: contrato.montoInicial ? formatNumberWithThousands(contrato.montoInicial) : '',
      montoActual: contrato.montoActual || contrato.montoInicial ? formatNumberWithThousands(contrato.montoActual || contrato.montoInicial) : '',
      gastosAdministrativos: contrato.gastosAdministrativos || '',
      honorariosPropietario: contrato.honorariosPropietario || '',
      metodoAjusteContratoId: contrato.metodoAjusteContratoId ?? contrato.metodoAjusteId ?? '',
      frecuenciaAjusteMeses: contrato.frecuenciaAjusteMeses || '',
      monedaId: contrato.monedaId || '',
      estadoContratoId: contrato.estadoContratoId || '',
      cantidadGarantiasNecesarias: contrato.cantidadGarantiasNecesarias != null ? String(contrato.cantidadGarantiasNecesarias) : '',
      gastosInicialesLiquidados: contrato.gastosInicialesLiquidados || false,
    });
    setOpen(true);
  };

  const handleView = async (contratoId) => {
    setSelectedContrato(contratoId);
    setViewOpen(true);
  };

  // Efecto para actualizar propietario cuando se selecciona propiedad
  useEffect(() => {
    if (propiedadSeleccionada) {
      const propietarios = propiedadSeleccionada.propietarios || [];
      const nombre = propietarios.length > 0
        ? propietarios.map(p => {
          const prop = p.propietario || p;
          return prop.razonSocial || `${prop.nombre || ''} ${prop.apellido || ''}`.trim();
        }).join(', ')
        : 'Sin propietario';
      setPropietarioNombre(nombre);
    } else {
      setPropietarioNombre('');
    }
  }, [propiedadSeleccionada]);

  // Efecto para establecer moneda por defecto cuando se abre el diálogo
  useEffect(() => {
    if (open && !editing && monedas && !formData.monedaId) {
      // Buscar moneda ARS por defecto
      const arsMoneda = monedas.find(m => m.codigo === 'ARS');
      if (arsMoneda) {
        setFormData(prev => ({ ...prev, monedaId: arsMoneda.id }));
      }
    }
  }, [open, editing, monedas, formData.monedaId]);

  // Efecto para establecer estado por defecto cuando se abre el diálogo
  useEffect(() => {
    if (open && !editing && estadosContrato && !formData.estadoContratoId) {
      // Buscar estado BORRADOR por defecto
      const borradorEstado = estadosContrato.find(e => e.codigo === 'BORRADOR');
      if (borradorEstado) {
        setFormData(prev => ({ ...prev, estadoContratoId: borradorEstado.id }));
      }
    }
  }, [open, editing, estadosContrato, formData.estadoContratoId]);

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

  // Deep link: /contratos?contratoId=X&tab=ajustes&accion=nuevo -> abrir edición, tab Ajustes, modal Nuevo
  useEffect(() => {
    const contratoId = searchParams.get('contratoId');
    const tab = searchParams.get('tab');
    const accion = searchParams.get('accion');
    if (!contratoId || tab !== 'ajustes') return;
    const id = parseInt(contratoId, 10);
    if (Number.isNaN(id)) return;
    setEditing(id);
    setOpen(true);
    setTabValue(4);
    if (accion === 'nuevo') setOpenNuevoAjusteModal(true);
    // Reemplazar URL sin query pero preservando state (from dashboard) para volver al cerrar
    navigate({ pathname: '/contratos', search: '', state: location.state }, { replace: true });
  }, [searchParams, navigate, location.state]);

  // Desde detalle de propiedad: state.propiedadId -> abrir modal "Nuevo Contrato" con la propiedad preseleccionada
  const propiedadIdFromState = location.state?.propiedadId;
  useEffect(() => {
    if (propiedadIdFromState == null) return;
    // Evitar "Blocked aria-hidden": quitar foco del árbol que quedará inerte al abrir el modal
    if (typeof document !== 'undefined' && document.activeElement?.blur) document.activeElement.blur();
    resetForm();
    setFormData(prev => ({ ...prev, propiedadId: String(propiedadIdFromState) }));
    setOpen(true);
    setTabValue(0);
    navigate({ pathname: '/contratos', search: '', state: { ...location.state, propiedadId: undefined } }, { replace: true });
  }, [propiedadIdFromState]);

  // Deep link desde búsqueda global, perfil inquilino o detalle propiedad: /contratos?id=X -> abrir detalle (vista) del contrato
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (!idParam) return;
    const id = parseInt(idParam, 10);
    if (Number.isNaN(id)) return;
    if (typeof document !== 'undefined' && document.activeElement?.blur) document.activeElement.blur();
    setSelectedContrato(id);
    setViewOpen(true);
  }, [searchParams]);

  // Limpiar id de la URL después de abrir la vista, salvo si hay return path (volver a Propiedades)
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (!idParam || location.state?.returnTo) return;
    searchParams.delete('id');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, location.state?.returnTo]);

  const validateForm = () => {
    const newErrors = {};

    // Validar Propiedad (obligatorio)
    const propiedadIdStr = formData.propiedadId ? String(formData.propiedadId).trim() : '';
    if (!propiedadIdStr) {
      newErrors.propiedadId = 'La propiedad es obligatoria';
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

    // Validar Método de Ajuste (obligatorio)
    if (!formData.metodoAjusteContratoId) {
      newErrors.metodoAjusteContratoId = 'El método de ajuste es obligatorio';
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
    if (!formData.monedaId) {
      newErrors.monedaId = 'La moneda es obligatoria';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
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

    // Convertir fechas usando dayjs para evitar problemas de zona horaria
    // dayjs crea la fecha en hora local, no UTC
    const fechaInicioDate = formData.fechaInicio
      ? dayjs(formData.fechaInicio).startOf('day').toDate()
      : null;
    const fechaFinDate = formData.fechaFin
      ? dayjs(formData.fechaFin).startOf('day').toDate()
      : null;

    const submitData = {
      propiedadId: formData.propiedadId || null,
      inquilinoId: formData.inquilinoId || null,
      fechaInicio: fechaInicioDate,
      fechaFin: fechaFinDate,
      duracionMeses: parseSafeInteger(formData.duracionMeses),
      frecuenciaAjusteMeses: parseSafeInteger(formData.frecuenciaAjusteMeses),
      montoInicial: parseMonto(formData.montoInicial),
      montoActual: parseMonto(formData.montoActual),
      gastosAdministrativos: parseSafeNumber(formData.gastosAdministrativos),
      honorariosPropietario: parseSafeNumber(formData.honorariosPropietario),
      metodoAjusteContratoId: formData.metodoAjusteContratoId || null,
      monedaId: formData.monedaId || null,
      estadoContratoId: formData.estadoContratoId || null,
      cantidadGarantiasNecesarias: parseSafeInteger(formData.cantidadGarantiasNecesarias),
      // Si no tiene permiso para editar gastos iniciales, mantener el valor original del contrato
      gastosInicialesLiquidados: (readonlyGastos && editing && contratoParaEditar)
        ? (contratoParaEditar.gastosInicialesLiquidados ?? false)
        : (formData.gastosInicialesLiquidados || false),
    };

    if (editing) {
      const nuevoEstadoId = submitData.estadoContratoId;
      const estadoSel = estadosContrato?.find(e => e.id === nuevoEstadoId);
      const codigoEstado = estadoSel?.codigo || '';
      try {
        const { data: contratoCompleto } = await api.get(`/contratos/${editingId}`);
        const estadoActualId = contratoCompleto?.estadoContratoId;
        const estaCambiandoEstado = estadoActualId !== nuevoEstadoId;
        // Solo validar responsabilidades/garantías cuando se está PASANDO al estado Pendiente de Firma o Vigente (no cuando el contrato ya está en ese estado y solo se editan datos)
        const requiereValidacion = (codigoEstado === 'PENDIENTE_FIRMA' || codigoEstado === 'VIGENTE') && estaCambiandoEstado;
        if (requiereValidacion) {
          const propiedadId = contratoCompleto?.propiedadId ?? submitData.propiedadId;
          // Validar responsabilidades: la propiedad tiene impuestos y cargos (sin Alquiler); cada uno debe existir en contrato_responsabilidades con Quién paga y Cobra a
          if (propiedadId) {
            const [impuestosRes, cargosRes, tiposExpensaRes] = await Promise.all([
              api.get(`/propiedad-impuestos/propiedad/${propiedadId}`),
              api.get(`/propiedad-cargos/propiedad/${propiedadId}`),
              api.get('/catalogos-abm/tipos-expensa')
            ]);
            const impuestosPropiedad = impuestosRes.data || [];
            const cargosPropiedad = cargosRes.data || [];
            const tiposExpensa = tiposExpensaRes.data || [];
            const itemsRequeridos = [];
            impuestosPropiedad.forEach(imp => {
              itemsRequeridos.push({ esImpuesto: true, esCargo: false, tipoId: imp.tipoImpuestoId, tipoExpensaId: null, tipoNombre: imp.tipoImpuesto?.nombre || imp.tipoImpuesto?.codigo || 'Impuesto' });
            });
            const tipoExpensaORD = tiposExpensa.find(t => t.codigo === 'ORD');
            const tipoExpensaEXT = tiposExpensa.find(t => t.codigo === 'EXT');
            (cargosPropiedad || []).forEach(cargo => {
              const codigo = cargo.tipoCargo?.codigo || '';
              if (codigo === 'ALQUILER') return;
              if (codigo === 'EXPENSAS' && tiposExpensa.length > 0) {
                if (tipoExpensaORD) itemsRequeridos.push({ esImpuesto: false, esCargo: true, tipoId: cargo.tipoCargoId, tipoExpensaId: tipoExpensaORD.id, tipoNombre: 'Expensas Ordinarias' });
                if (tipoExpensaEXT) itemsRequeridos.push({ esImpuesto: false, esCargo: true, tipoId: cargo.tipoCargoId, tipoExpensaId: tipoExpensaEXT.id, tipoNombre: 'Expensas Extraordinarias' });
                return;
              }
              itemsRequeridos.push({ esImpuesto: false, esCargo: true, tipoId: cargo.tipoCargoId, tipoExpensaId: null, tipoNombre: cargo.tipoCargo?.nombre || cargo.tipoCargo?.codigo || 'Cargo' });
            });
            const responsabilidadesDelFormulario = responsabilidadesEditablesRef.current || [];
            const responsabilidadesAValidar = responsabilidadesDelFormulario.length > 0
              ? responsabilidadesDelFormulario
              : (contratoCompleto?.responsabilidades || []).filter(r => r.activo !== false && r.deletedAt == null);
            const matchResp = (item, r) => {
              if (item.esImpuesto) return r.tipoImpuestoId === item.tipoId;
              return r.tipoCargoId === item.tipoId && (r.tipoExpensaId ?? null) === (item.tipoExpensaId ?? null);
            };
            const sinCompletar = itemsRequeridos.filter(item => {
              const resp = responsabilidadesAValidar.find(r => matchResp(item, r));
              if (!resp) return true;
              const paga = resp.quienPagaProveedorId ?? resp.quienPagaProveedor?.id;
              const cobra = resp.quienSoportaCostoId ?? resp.quienSoportaCosto?.id;
              return !paga || !cobra;
            });
            if (sinCompletar.length > 0) {
              setErrors(prev => { const next = { ...prev }; delete next.estadoContratoId; return next; });
              setSuccessMessage('Debe asignar todas las responsabilidades. No se puede pasar a "Pendiente de Firma".');
              setSnackbarSeverity('error');
              setSnackbarOpen(true);
              return;
            }
          }
          if (submitData.cantidadGarantiasNecesarias != null && submitData.cantidadGarantiasNecesarias > 0) {
            const garantiasActivas = (contratoCompleto?.garantias || []).filter(g => g.activo !== false && g.deletedAt == null);
            if (garantiasActivas.length !== submitData.cantidadGarantiasNecesarias) {
              setErrors(prev => {
                const next = { ...prev };
                delete next.estadoContratoId;
                return next;
              });
              setSuccessMessage(`La cantidad de garantías cargadas (${garantiasActivas.length}) no coincide con la cantidad necesaria configurada (${submitData.cantidadGarantiasNecesarias}). No se puede pasar a "${estadoSel?.nombre || codigoEstado}".`);
              setSnackbarSeverity('error');
              setSnackbarOpen(true);
              return;
            }
          }
        }
      } catch (err) {
        setErrors(prev => {
          const next = { ...prev };
          delete next.estadoContratoId;
          return next;
        });
        setSuccessMessage('No se pudo verificar responsabilidades o garantías. Intente de nuevo.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return;
      }
      const gastosParaGuardar =
        Array.isArray(gastosEditablesRef.current) && gastosEditablesRef.current.length > 0
          ? gastosEditablesRef.current
          : (Array.isArray(gastosInicialesEdicion) ? gastosInicialesEdicion : []);

      try {
        await updateMutation.mutateAsync({
          id: editingId,
          data: submitData,
          gastosIniciales: gastosParaGuardar,
          allowGastos: !readonlyGastos
        });
      } catch {
        // Errores: onError de updateMutation
      }
    } else {
      createMutation.mutate(submitData);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
        Contratos
      </Typography>
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', md: 'center' },
        mb: 2,
        gap: 2
      }}>
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          alignItems: { xs: 'stretch', sm: 'center' },
          flexWrap: 'wrap',
          flex: 1
        }}>
          <TextField
            size="small"
            placeholder="Buscar por nro, inquilino, propiedad, propietario..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            sx={{ width: { xs: '100%', sm: 280 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />
          <FormControl size="small" sx={{ width: { xs: '100%', sm: 180 } }}>
            <InputLabel>Estado</InputLabel>
            <Select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              label="Estado"
            >
              <MenuItem value="">Todos</MenuItem>
              {estadosContrato?.map((estado) => (
                <MenuItem key={estado.id} value={estado.codigo}>
                  {estado.nombre}
                </MenuItem>
              ))}
              <MenuItem value="vencido">Vencidos (automático)</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <RequirePermission codigo="contratos.crear">
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen} sx={{ height: 36, py: 0, px: 1.5, fontSize: '0.875rem', '& .MuiButton-startIcon': { marginRight: 0.5 }, width: { xs: '100%', md: 'auto' } }}>
            Nuevo Contrato
          </Button>
        </RequirePermission>
      </Box>

      {/* Vista de tabla para desktop */}
      <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table size="small" sx={{
          '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.875rem' },
          '& .MuiTableCell-head': { py: 0.5, px: 1 },
          '& .MuiTableSortLabel-root': { fontSize: '0.875rem' }
        }}>
          <TableHead>
            <TableRow>
              <TableCell sortDirection={orderBy === 'nroContrato' ? order : false}>
                <TableSortLabel active={orderBy === 'nroContrato'} direction={orderBy === 'nroContrato' ? order : 'asc'} onClick={() => handleSortContratos('nroContrato')}>
                  Nro. Contrato
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'inquilino' ? order : false}>
                <TableSortLabel active={orderBy === 'inquilino'} direction={orderBy === 'inquilino' ? order : 'asc'} onClick={() => handleSortContratos('inquilino')}>
                  Inquilino
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'propiedad' ? order : false}>
                <TableSortLabel active={orderBy === 'propiedad'} direction={orderBy === 'propiedad' ? order : 'asc'} onClick={() => handleSortContratos('propiedad')}>
                  Propiedad
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'propietario' ? order : false}>
                <TableSortLabel active={orderBy === 'propietario'} direction={orderBy === 'propietario' ? order : 'asc'} onClick={() => handleSortContratos('propietario')}>
                  Propietario
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'inicio' ? order : false}>
                <TableSortLabel active={orderBy === 'inicio'} direction={orderBy === 'inicio' ? order : 'asc'} onClick={() => handleSortContratos('inicio')}>
                  Inicio
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'fin' ? order : false}>
                <TableSortLabel active={orderBy === 'fin'} direction={orderBy === 'fin' ? order : 'asc'} onClick={() => handleSortContratos('fin')}>
                  Fin
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'monto' ? order : false}>
                <TableSortLabel active={orderBy === 'monto'} direction={orderBy === 'monto' ? order : 'asc'} onClick={() => handleSortContratos('monto')}>
                  Monto Actual
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'estado' ? order : false}>
                <TableSortLabel active={orderBy === 'estado'} direction={orderBy === 'estado' ? order : 'asc'} onClick={() => handleSortContratos('estado')}>
                  Estado
                </TableSortLabel>
              </TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contratosPaginados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {searchTerm.trim() ? 'No se encontraron contratos con ese criterio.' : 'No se encontraron contratos' + (filtroEstado ? ` con estado "${getEstadoNombre(filtroEstado)}"` : '.')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              contratosPaginados.map((contrato) => {
                // Determinar estado real (si está vencido pero no marcado como tal)
                const estadoCodigo = contrato.estado?.codigo || contrato.estadoContrato?.codigo || contrato.estado || '';
                let estadoReal = estadoCodigo;
                let esVencido = false;
                if (contrato.fechaFin && !['FINALIZADO', 'CANCELADO', 'ANULADO'].includes(estadoCodigo)) {
                  const fechaFin = parseFechaLocal(contrato.fechaFin);
                  const hoy = dayjs().startOf('day');
                  if (fechaFin && fechaFin.isBefore(hoy, 'day')) {
                    esVencido = true;
                    if (estadoCodigo === 'VIGENTE' || estadoCodigo === 'BORRADOR' || estadoCodigo === 'vigente' || estadoCodigo === 'borrador') {
                      estadoReal = 'vencido';
                    }
                  }
                }

                // Calcular alerta de vencimiento
                const alertaVencimiento = calcularAlertaVencimiento(contrato.fechaFin, estadoCodigo);
                const ajusteTooltip = getAjusteTooltip(contrato);

                return (
                  <TableRow key={contrato.id}>
                    <TableCell>{contrato.nroContrato || '-'}</TableCell>
                    <TableCell>
                      {contrato.inquilino?.razonSocial ||
                        `${contrato.inquilino?.nombre || ''} ${contrato.inquilino?.apellido || ''}`.trim()}
                    </TableCell>
                    <TableCell>
                      {contrato.propiedad
                        ? `${contrato.propiedad.dirCalle} ${contrato.propiedad.dirNro || ''}${contrato.propiedad.dirPiso ? `, Piso ${contrato.propiedad.dirPiso}` : ''}${contrato.propiedad.dirDepto ? `, Dto. ${contrato.propiedad.dirDepto}` : ''}`
                        : 'Sin propiedad'}
                    </TableCell>
                    <TableCell>
                      {contrato.propiedad?.propietarios && contrato.propiedad.propietarios.length > 0
                        ? contrato.propiedad.propietarios.map(p => {
                          const prop = p.propietario || p;
                          return prop.razonSocial || `${prop.nombre || ''} ${prop.apellido || ''}`.trim();
                        }).join(', ')
                        : <em style={{ color: '#999' }}>Sin propietario</em>}
                    </TableCell>
                    <TableCell>{parseFechaLocal(contrato.fechaInicio)?.format('DD/MM/YYYY') || '-'}</TableCell>
                    <TableCell>
                      {contrato.fechaFin ? (
                        <Tooltip
                          title={
                            alertaVencimiento.yaVencido
                              ? `Vencido hace ${Math.abs(alertaVencimiento.diasRestantes)} día${Math.abs(alertaVencimiento.diasRestantes) !== 1 ? 's' : ''}`
                              : alertaVencimiento.proximoAVencer
                                ? `Faltan ${alertaVencimiento.diasRestantes} día${alertaVencimiento.diasRestantes !== 1 ? 's' : ''} para el vencimiento`
                                : ''
                          }
                          arrow
                          disableHoverListener={!alertaVencimiento.proximoAVencer && !alertaVencimiento.yaVencido}
                        >
                          <Box
                            component="span"
                            sx={{
                              color: alertaVencimiento.yaVencido ? 'error.main' : alertaVencimiento.proximoAVencer ? 'warning.dark' : 'inherit',
                              fontWeight: (alertaVencimiento.yaVencido || alertaVencimiento.proximoAVencer) ? 600 : 'inherit'
                            }}
                          >
                            {parseFechaLocal(contrato.fechaFin)?.format('DD/MM/YYYY')}
                          </Box>
                        </Tooltip>
                      ) : 'Indefinido'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        ${parseFloat(contrato.montoActual || contrato.montoInicial).toLocaleString('es-AR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                        {ajusteTooltip && (
                          <Tooltip title={ajusteTooltip} arrow>
                            <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary', cursor: 'help' }} />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          label={String(getEstadoNombre(estadoReal) || 'Sin estado')}
                          size="small"
                          color={
                            estadoReal === 'VIGENTE' || estadoReal === 'vigente' || estadoReal === 'activo' ? 'success' :
                              estadoReal === 'vencido' || esVencido ? 'error' :
                                estadoReal === 'FINALIZADO' || estadoReal === 'finalizado' ? 'default' :
                                  estadoReal === 'CANCELADO' || estadoReal === 'ANULADO' || estadoReal === 'cancelado' || estadoReal === 'anulado' ? 'warning' :
                                    'default'
                          }
                          title={esVencido && contrato.estadoContratoId && contrato.estado?.codigo !== 'VENCIDO' ? 'Contrato vencido (no actualizado en BD)' : ''}
                        />
                        {alertaVencimiento.proximoAVencer && !esVencido && (
                          <Chip
                            icon={<WarningAmberIcon sx={{ fontSize: '14px !important' }} />}
                            label="Próx. a vencer"
                            size="small"
                            color="warning"
                            sx={{ height: 20, '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' }, '& .MuiChip-icon': { ml: 0.5 } }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <IconButton size="small" onClick={() => handleView(contrato.id)} title="Ver detalle" sx={{ padding: '4px' }}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        <RequirePermission codigo="contratos.editar">
                          <IconButton size="small" onClick={() => handleEdit(contrato)} title="Editar" sx={{ padding: '4px' }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </RequirePermission>
                        <RequirePermission codigo="contratos.eliminar">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setContratoAEliminar(contrato)}
                            title="Eliminar"
                            sx={{ padding: '4px' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </RequirePermission>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={totalRegistros}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Filas:"
          sx={{
            '& .MuiTablePagination-toolbar': { minHeight: 36 },
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: '0.875rem' },
            '& .MuiTablePagination-select': { fontSize: '0.875rem', py: 0.25 }
          }}
        />
      </TableContainer>

      {/* Vista de cards para mobile */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {contratosPaginados.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
            {searchTerm.trim() ? 'No se encontraron contratos con ese criterio.' : 'No se encontraron contratos' + (filtroEstado ? ` con estado "${getEstadoNombre(filtroEstado)}"` : '.')}
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {contratosPaginados.map((contrato) => {
              // Determinar estado real (si está vencido pero no marcado como tal)
              const estadoCodigo = contrato.estado?.codigo || contrato.estadoContrato?.codigo || contrato.estado || '';
              let estadoReal = estadoCodigo;
              let esVencido = false;
              if (contrato.fechaFin && !['FINALIZADO', 'ANULADO', 'CANCELADO', 'RESCINDIDO'].includes(estadoCodigo)) {
                const fechaFin = parseFechaLocal(contrato.fechaFin);
                const hoy = dayjs().startOf('day');
                if (fechaFin && fechaFin.isBefore(hoy, 'day')) {
                  esVencido = true;
                  // Solo mostrar como vencido si el estado actual permite esa transición
                  if (['VIGENTE', 'BORRADOR', 'vigente', 'borrador', 'activo', 'pendiente_de_firma', 'prorrogado'].includes(estadoCodigo)) {
                    estadoReal = 'vencido';
                  }
                }
              }

              // Calcular alerta de vencimiento
              const alertaVencimiento = calcularAlertaVencimiento(contrato.fechaFin, estadoCodigo);
              const ajusteTooltip = getAjusteTooltip(contrato);

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
                          <RequirePermission codigo="contratos.editar">
                            <IconButton size="small" onClick={() => handleEdit(contrato)} sx={{ mr: 0.5 }}>
                              <EditIcon />
                            </IconButton>
                          </RequirePermission>
                          <RequirePermission codigo="contratos.eliminar">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setContratoAEliminar(contrato)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </RequirePermission>
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
                            <strong>Inicio:</strong> {parseFechaLocal(contrato.fechaInicio)?.format('DD/MM/YYYY') || '-'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CalendarTodayIcon sx={{ fontSize: 18, color: alertaVencimiento.yaVencido ? 'error.main' : alertaVencimiento.proximoAVencer ? 'warning.main' : 'text.secondary' }} />
                          <Typography
                            variant="body2"
                            sx={{
                              color: alertaVencimiento.yaVencido ? 'error.main' : alertaVencimiento.proximoAVencer ? 'warning.dark' : 'inherit',
                              fontWeight: (alertaVencimiento.yaVencido || alertaVencimiento.proximoAVencer) ? 600 : 'inherit'
                            }}
                          >
                            <strong>Fin:</strong> {contrato.fechaFin ? parseFechaLocal(contrato.fechaFin)?.format('DD/MM/YYYY') : 'Indefinido'}
                            {alertaVencimiento.proximoAVencer && !esVencido && (
                              <Typography component="span" variant="caption" sx={{ ml: 1, color: 'warning.main' }}>
                                ({alertaVencimiento.diasRestantes} días)
                              </Typography>
                            )}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AttachMoneyIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            <strong>Monto Actual:</strong> $
                            {parseFloat(contrato.montoActual || contrato.montoInicial).toLocaleString('es-AR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                            {ajusteTooltip && (
                              <Tooltip title={ajusteTooltip} arrow>
                                <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary', ml: 0.5, verticalAlign: 'middle', cursor: 'help' }} />
                              </Tooltip>
                            )}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body2" color="text.secondary">
                            <strong>Estado:</strong>
                          </Typography>
                          <Chip
                            label={String(getEstadoNombre(estadoReal) || 'Sin estado')}
                            size="small"
                            color={
                              estadoReal === 'activo' || estadoReal === 'vigente' || estadoReal === 'VIGENTE' ? 'success' :
                                estadoReal === 'vencido' || esVencido ? 'error' :
                                  estadoReal === 'finalizado' || estadoReal === 'FINALIZADO' ? 'default' :
                                    estadoReal === 'cancelado' || estadoReal === 'anulado' || estadoReal === 'CANCELADO' || estadoReal === 'ANULADO' ? 'warning' :
                                      'default'
                            }
                            sx={{ height: '20px', fontSize: '0.7rem' }}
                          />
                          {alertaVencimiento.proximoAVencer && !esVencido && (
                            <Chip
                              icon={<WarningAmberIcon sx={{ fontSize: '12px !important' }} />}
                              label="Próx. a vencer"
                              size="small"
                              color="warning"
                              sx={{ height: 20, '& .MuiChip-label': { px: 0.5, fontSize: '0.65rem' }, '& .MuiChip-icon': { ml: 0.5 } }}
                            />
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
        <TablePagination
          component="div"
          count={totalRegistros}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Filas:"
          sx={{
            '& .MuiTablePagination-toolbar': { minHeight: 36 },
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: '0.875rem' },
            '& .MuiTablePagination-select': { fontSize: '0.875rem', py: 0.25 }
          }}
        />
      </Box>

      {/* Dialog de creación/edición */}
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          if (shouldNavigateToReturn) navigate(returnTo);
        }}
        maxWidth="md"
        fullWidth
        closeAfterTransition={false}
      >
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
              {(() => {
                const estadoActual = estadosContrato?.find(e => e.id === formData.estadoContratoId);
                const esVigente = estadoActual?.codigo === 'VIGENTE';
                return (
                  <Tabs
                    value={tabValue}
                    onChange={(e, v) => {
                      e.preventDefault();
                      setTabValue(v);
                    }}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                  >
                    <Tab label="Datos Principales" type="button" />
                    <Tab label="Gastos Iniciales" type="button" />
                    <Tab label="Responsabilidades" type="button" />
                    <Tab label="Garantías" type="button" />
                    <Tab
                      type="button"
                      label="Ajustes"
                      disabled={!esVigente}
                      title={!esVigente ? 'Los ajustes solo están disponibles para contratos en estado Vigente' : ''}
                    />
                  </Tabs>
                );
              })()}

              <TabPanel value={tabValue} index={0}>
                <Grid container spacing={2}>
                  {/* Fila 1: Propiedad, Propietario, Inquilino */}
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" error={!!errors.propiedadId}>
                      <InputLabel>Propiedad *</InputLabel>
                      <Select
                        value={formData.propiedadId}
                        onChange={(e) => {
                          setFormData({ ...formData, propiedadId: e.target.value });
                          if (errors.propiedadId) {
                            setErrors({ ...errors, propiedadId: '' });
                          }
                        }}
                        label="Propiedad *"
                      >
                        {Array.isArray(propiedades)
                          ? propiedades.map((propiedad) => (
                            <MenuItem key={propiedad.id} value={propiedad.id}>
                              {propiedad.dirCalle} {propiedad.dirNro}{propiedad.dirPiso ? `, Piso ${propiedad.dirPiso}` : ''}{propiedad.dirDepto ? `, Dto. ${propiedad.dirDepto}` : ''}, {propiedad.localidad?.nombre || propiedad.provincia?.nombre || ''}
                            </MenuItem>
                          ))
                          : propiedades?.data?.map((propiedad) => (
                            <MenuItem key={propiedad.id} value={propiedad.id}>
                              {propiedad.dirCalle} {propiedad.dirNro}{propiedad.dirPiso ? `, Piso ${propiedad.dirPiso}` : ''}{propiedad.dirDepto ? `, Dto. ${propiedad.dirDepto}` : ''}, {propiedad.localidad?.nombre || propiedad.provincia?.nombre || ''}
                            </MenuItem>
                          ))}
                      </Select>
                      {errors.propiedadId && (
                        <FormHelperText error>{errors.propiedadId}</FormHelperText>
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
                    <DatePicker
                      label="Fecha Inicio *"
                      value={formData.fechaInicio ? dayjs(formData.fechaInicio) : null}
                      onChange={(newValue) => {
                        setFormData({ ...formData, fechaInicio: newValue ? newValue.format('YYYY-MM-DD') : '' });
                        if (errors.fechaInicio) {
                          setErrors({ ...errors, fechaInicio: '' });
                        }
                      }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small',
                          error: !!errors.fechaInicio,
                          helperText: errors.fechaInicio || ''
                        },
                        actionBar: {
                          actions: ['clear', 'today']
                        }
                      }}
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
                    <DatePicker
                      label="Fecha Fin *"
                      value={formData.fechaFin ? dayjs(formData.fechaFin) : null}
                      onChange={(newValue) => {
                        setFormData({ ...formData, fechaFin: newValue ? newValue.format('YYYY-MM-DD') : '' });
                        if (errors.fechaFin) {
                          setErrors({ ...errors, fechaFin: '' });
                        }
                      }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small',
                          error: !!errors.fechaFin,
                          helperText: errors.fechaFin || ''
                        },
                        actionBar: {
                          actions: ['clear', 'today']
                        }
                      }}
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
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
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
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Gastos Adm. Inquilino"
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
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
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
                      label="Honorarios Propietario"
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
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
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

                  {/* Fila 4: Método Ajuste, Actualización, Moneda, Estado, Cant. garantías (una línea) */}
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: '1 1 130px', minWidth: 130 }}>
                        <FormControl fullWidth size="small" error={!!errors.metodoAjusteContratoId}>
                          <InputLabel>Método de Ajuste *</InputLabel>
                          <Select
                            value={formData.metodoAjusteContratoId}
                            onChange={(e) => {
                              setFormData({ ...formData, metodoAjusteContratoId: e.target.value });
                              if (errors.metodoAjusteContratoId) setErrors({ ...errors, metodoAjusteContratoId: '' });
                            }}
                            label="Método de Ajuste *"
                          >
                            {metodosAjusteContrato?.length > 0 ? (
                              metodosAjusteContrato.map((metodo) => (
                                <MenuItem key={metodo.id} value={metodo.id}>{metodo.codigo || metodo.nombre}</MenuItem>
                              ))
                            ) : (
                              <MenuItem disabled>No hay métodos disponibles</MenuItem>
                            )}
                          </Select>
                          {errors.metodoAjusteContratoId && <FormHelperText error>{errors.metodoAjusteContratoId}</FormHelperText>}
                        </FormControl>
                      </Box>
                      <Box sx={{ flex: '1 1 130px', minWidth: 130 }}>
                        <TextField
                          label="Actualización (meses) *"
                          type="number"
                          fullWidth
                          size="small"
                          value={formData.frecuenciaAjusteMeses}
                          onChange={(e) => {
                            setFormData({ ...formData, frecuenciaAjusteMeses: e.target.value });
                            if (errors.frecuenciaAjusteMeses) setErrors({ ...errors, frecuenciaAjusteMeses: '' });
                          }}
                          inputProps={{ min: 1, style: { MozAppearance: 'textfield' }, onWheel: (e) => e.target.blur() }}
                          error={!!errors.frecuenciaAjusteMeses}
                          helperText={errors.frecuenciaAjusteMeses || ''}
                          sx={{ '& input[type=number]': { MozAppearance: 'textfield' }, '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 }, '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 } }}
                        />
                      </Box>
                      <Box sx={{ flex: '1 1 130px', minWidth: 130 }}>
                        <FormControl fullWidth size="small" error={!!errors.monedaId}>
                          <InputLabel>Moneda *</InputLabel>
                          <Select
                            value={formData.monedaId}
                            onChange={(e) => {
                              setFormData({ ...formData, monedaId: e.target.value });
                              if (errors.monedaId) setErrors({ ...errors, monedaId: '' });
                            }}
                            label="Moneda *"
                          >
                            {monedas?.length > 0 ? (
                              monedas.map((moneda) => (
                                <MenuItem key={moneda.id} value={moneda.id}>{moneda.nombre}</MenuItem>
                              ))
                            ) : (
                              <MenuItem disabled>No hay monedas disponibles</MenuItem>
                            )}
                          </Select>
                          {errors.monedaId && <FormHelperText error>{errors.monedaId}</FormHelperText>}
                        </FormControl>
                      </Box>
                      <Box sx={{ flex: '1 1 130px', minWidth: 130 }}>
                        <TextField
                          label="Garantías necesarias"
                          type="number"
                          fullWidth
                          size="small"
                          value={formData.cantidadGarantiasNecesarias}
                          onChange={(e) => {
                            const v = e.target.value;
                            setFormData({ ...formData, cantidadGarantiasNecesarias: v });
                            if (errors.cantidadGarantiasNecesarias) setErrors({ ...errors, cantidadGarantiasNecesarias: '' });
                          }}
                          inputProps={{ min: 0, style: { MozAppearance: 'textfield' }, onWheel: (e) => e.target.blur() }}
                          error={!!errors.cantidadGarantiasNecesarias}
                          helperText={errors.cantidadGarantiasNecesarias || ''}
                          placeholder="0 = sin requisito"
                          sx={{ '& input[type=number]': { MozAppearance: 'textfield' }, '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 }, '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 } }}
                        />
                      </Box>
                      <Box sx={{ flex: '1 1 130px', minWidth: 130 }}>
                        <FormControl fullWidth size="small" error={!!errors.estadoContratoId}>
                          <InputLabel>Estado</InputLabel>
                          <Select
                            value={formData.estadoContratoId}
                            onChange={(e) => {
                              setFormData({ ...formData, estadoContratoId: e.target.value });
                              if (errors.estadoContratoId) setErrors({ ...errors, estadoContratoId: '' });
                            }}
                            label="Estado"
                          >
                            {estadosContrato?.length > 0 ? (
                              estadosContrato.map((estado) => (
                                <MenuItem key={estado.id} value={estado.id}>{estado.nombre}</MenuItem>
                              ))
                            ) : (
                              <MenuItem disabled>No hay estados disponibles</MenuItem>
                            )}
                          </Select>
                          {errors.estadoContratoId && <FormHelperText error>{errors.estadoContratoId}</FormHelperText>}
                        </FormControl>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <ContratoGastosIniciales
                  contratoId={editingId || undefined}
                  montoInicial={formData.montoInicial}
                  duracionMeses={formData.duracionMeses}
                  gastosTemporales={gastosInicialesTemporales}
                  setGastosTemporales={setGastosInicialesTemporales}
                  gastosEdicion={editingId ? gastosInicialesEdicion : undefined}
                  setGastosEdicion={editingId ? setGastosInicialesEdicion : undefined}
                  gastosEditablesRef={gastosEditablesRef}
                  garantiasContrato={contratoParaEditar?.garantias ?? (typeof editing === 'object' && editing != null ? editing.garantias : undefined)}
                  garantiasTemporales={garantiasTemporales}
                  gastosInicialesLiquidados={formData.gastosInicialesLiquidados}
                  onGastosInicialesLiquidadosChange={(value) => setFormData(prev => ({ ...prev, gastosInicialesLiquidados: value }))}
                  readonly={readonlyGastos}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <ContratoResponsabilidades
                  contratoId={editing?.id}
                  propiedadId={formData.propiedadId}
                  responsabilidadesTemporales={responsabilidadesTemporales}
                  setResponsabilidadesTemporales={setResponsabilidadesTemporales}
                  responsabilidadesEditablesRef={responsabilidadesEditablesRef}
                  readonly={readonlyResponsabilidades}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={3}>
                <ContratoGarantias
                  contratoId={editing?.id}
                  garantiasTemporales={garantiasTemporales}
                  setGarantiasTemporales={setGarantiasTemporales}
                  readonly={readonlyGarantias}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={4}>
                <ContratoAjustesTab
                  contratoId={editingId}
                  fechaInicio={formData.fechaInicio}
                  fechaFin={formData.fechaFin}
                  montoActual={formData.montoActual}
                  onContratoUpdated={() => {
                    queryClient.invalidateQueries({ queryKey: ['contrato', selectedContrato] });
                    queryClient.invalidateQueries({ queryKey: ['contratos'] });
                  }}
                  openNuevoAjuste={tabValue === 4 && openNuevoAjusteModal}
                  onCloseNuevoAjuste={() => {
                    setOpenNuevoAjusteModal(false);
                    // Solo cerrar todo y volver al origen si vinimos de otra página (ej. Dashboard); si estamos en Contratos, quedarse en Editar Contrato
                    if (shouldNavigateToReturn) {
                      setOpen(false);
                      navigate(returnTo);
                    }
                  }}
                />
              </TabPanel>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setOpen(false);
              resetForm();
              if (shouldNavigateToReturn) {
                navigate(returnTo);
              }
            }}>Cancelar</Button>
            <Button type="submit" variant="contained">
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog de vista detallada (misma estructura que Clientes y Propiedades) */}
      <Dialog
        open={viewOpen}
        onClose={handleCloseView}
        maxWidth="lg"
        fullWidth
        closeAfterTransition={false}
        PaperProps={{ sx: { minHeight: '70vh' } }}
      >
        <DialogContent sx={{ p: 0, minHeight: '400px', maxHeight: '65vh', overflowY: 'auto' }}>
          {isLoadingContratoDetalle ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 300, gap: 2 }}>
              <CircularProgress />
              <Button variant="outlined" onClick={handleCloseView} autoFocus>Cerrar</Button>
            </Box>
          ) : errorContratoDetalle ? (
            <Box sx={{ p: 2 }}>
              <Alert severity="error" sx={{ mb: 2 }}>Error al cargar el contrato.</Alert>
              <Button variant="outlined" onClick={handleCloseView} autoFocus>Cerrar</Button>
            </Box>
          ) : contratoDetalle ? (
            <>
              {/* Header / tarjeta de presentación (scroll con el contenido) */}
              <Box
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  p: 3,
                  pb: 2,
                  position: 'relative'
                }}
              >
                <Tooltip title="Cerrar">
                  <IconButton
                    size="small"
                    onClick={handleCloseView}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                      width: 40,
                      height: 40,
                      borderRadius: 1
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Tooltip>

                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    gap: 2,
                    pr: 5
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 2,
                      flex: { xs: 'none', sm: 1 },
                      minWidth: 0
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 64,
                        height: 64,
                        bgcolor: 'rgba(255,255,255,0.2)',
                        flexShrink: 0
                      }}
                    >
                      <DescriptionIcon sx={{ fontSize: 32, color: 'white' }} />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="h5" fontWeight="bold" sx={{ color: 'white' }}>
                        {(() => {
                          const prop = contratoDetalle.propiedad;
                          const direccion = prop
                            ? `${prop.dirCalle || ''} ${prop.dirNro || ''}${prop.dirPiso ? `, Piso ${prop.dirPiso}` : ''}${prop.dirDepto ? `, Dto. ${prop.dirDepto}` : ''}`.trim()
                            : '';
                          const localidad = prop?.localidad?.nombre || '';
                          return `Contrato ${contratoDetalle.nroContrato || contratoDetalle.id}${direccion ? ` - ${direccion}` : ''}${localidad ? `, ${localidad}` : ''}` || 'Detalle del Contrato';
                        })()}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mt: 0.25 }}>
                        {contratoDetalle.propiedad?.localidad?.nombre || ''}
                      </Typography>
                      <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                        {contratoDetalle.estado && (
                          <Chip
                            label={contratoDetalle.estado.nombre || contratoDetalle.estado.codigo || 'Vigente'}
                            size="small"
                            sx={{
                              color: 'white',
                              borderColor: 'rgba(255,255,255,0.5)',
                              fontWeight: 600,
                              bgcolor: 'rgba(255,255,255,0.2)'
                            }}
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, flexShrink: 0 }}>
                    <RequirePermission codigo="contratos.editar">
                      <Tooltip title="Editar contrato">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setViewOpen(false);
                            handleEdit(contratoDetalle);
                          }}
                          sx={{
                            bgcolor: 'white !important',
                            color: 'primary.main',
                            '&:hover': { bgcolor: 'grey.100 !important' },
                            width: 40,
                            height: 40,
                            borderRadius: 1
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </RequirePermission>
                  </Box>
                </Box>
              </Box>

              {/* Contenido (misma sección con padding que Clientes/Propiedades) */}
              <Box sx={{ px: 3, py: 2 }}>
                <ContratoDetalle contrato={contratoDetalle} onCloseView={handleCloseView} />
              </Box>
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseView}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmar eliminación de contrato */}
      <ConfirmDialog
        open={!!contratoAEliminar}
        onClose={() => setContratoAEliminar(null)}
        title="Eliminar contrato"
        message={`¿Está seguro de eliminar este contrato${contratoAEliminar?.nroContrato ? ` #${contratoAEliminar.nroContrato}` : ''}?`}
        confirmLabel="Eliminar"
        confirmColor="error"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (contratoAEliminar?.id != null) deleteMutation.mutate(Number(contratoAEliminar.id));
        }}
      />

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

// Componente pestaña Ajustes de alquiler (historial, nuevo, editar, ver, anular)
function ContratoAjustesTab({
  contratoId,
  fechaInicio,
  fechaFin,
  montoActual,
  onContratoUpdated,
  openNuevoAjusteModal,
  onCloseNuevoAjuste
}) {
  const queryClient = useQueryClient();
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalVer, setModalVer] = useState(false);
  const [anulandoAjuste, setAnulandoAjuste] = useState(null);
  const [ajusteSeleccionado, setAjusteSeleccionado] = useState(null);
  const [formAjuste, setFormAjuste] = useState({ fechaAjuste: '', montoNuevo: '', montoAnterior: '', porcentajeAumento: '' });
  const [errorAjuste, setErrorAjuste] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const { data: ajustes = [], refetch: refetchAjustes } = useQuery({
    queryKey: ['contrato-ajustes', contratoId],
    queryFn: async () => {
      const res = await api.get(`/contratos/${contratoId}/ajustes`);
      return res.data;
    },
    enabled: !!contratoId
  });

  const montoActualNum = useMemo(() => {
    if (montoActual === undefined || montoActual === null || montoActual === '') return null;
    const v = typeof montoActual === 'string' ? parseNumberFromFormatted(montoActual) : montoActual;
    return parseFloat(v);
  }, [montoActual]);

  // Monto anterior para un nuevo ajuste: último del historial (ajustes ordenados por fecha desc) o monto actual del contrato
  const montoAnteriorParaNuevo = useMemo(() => {
    if (ajustes?.length > 0 && ajustes[0].montoNuevo != null) {
      return Number(ajustes[0].montoNuevo);
    }
    return montoActualNum;
  }, [ajustes, montoActualNum]);

  useEffect(() => {
    if (openNuevoAjusteModal && contratoId) {
      setModalNuevo(true);
      setFormAjuste({
        fechaAjuste: dayjs().format('YYYY-MM-DD'),
        montoNuevo: '',
        montoAnterior: montoAnteriorParaNuevo != null ? String(montoAnteriorParaNuevo) : '',
        porcentajeAumento: ''
      });
    }
  }, [openNuevoAjusteModal, contratoId, montoAnteriorParaNuevo]);

  const createMutation = useMutation({
    mutationFn: (body) => api.post(`/contratos/${contratoId}/ajustes`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrato-ajustes', contratoId] });
      queryClient.invalidateQueries({ queryKey: ['contrato', contratoId] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      onContratoUpdated?.();
      setModalNuevo(false);
      onCloseNuevoAjuste?.();
      setSnackbar({ open: true, message: 'Ajuste creado correctamente', severity: 'success' });
      setErrorAjuste('');
    },
    onError: (err) => {
      setErrorAjuste(err.response?.data?.error || 'Error al crear ajuste');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ ajusteId, body }) => api.put(`/contratos/${contratoId}/ajustes/${ajusteId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrato-ajustes', contratoId] });
      queryClient.invalidateQueries({ queryKey: ['contrato', contratoId] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      onContratoUpdated?.();
      setModalEditar(false);
      setAjusteSeleccionado(null);
      setSnackbar({ open: true, message: 'Ajuste actualizado', severity: 'success' });
    },
    onError: (err) => {
      setErrorAjuste(err.response?.data?.error || 'Error al actualizar ajuste');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (ajusteId) => api.delete(`/contratos/${contratoId}/ajustes/${ajusteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrato-ajustes', contratoId] });
      queryClient.invalidateQueries({ queryKey: ['contrato', contratoId] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      onContratoUpdated?.();
      setAnulandoAjuste(null);
      setSnackbar({ open: true, message: 'Ajuste anulado', severity: 'success' });
    },
    onError: (err) => {
      setSnackbar({ open: true, message: err.response?.data?.error || 'Error al anular', severity: 'error' });
    }
  });

  const handleOpenNuevo = () => {
    setErrorAjuste('');
    setFormAjuste({
      fechaAjuste: dayjs().format('YYYY-MM-DD'),
      montoNuevo: '',
      montoAnterior: montoAnteriorParaNuevo != null ? String(montoAnteriorParaNuevo) : '',
      porcentajeAumento: ''
    });
    setModalNuevo(true);
  };

  // Función para calcular monto nuevo desde porcentaje
  const handlePorcentajeChange = (porcentaje) => {
    setFormAjuste(prev => {
      const newState = { ...prev, porcentajeAumento: porcentaje };
      if (porcentaje !== '' && prev.montoAnterior) {
        const pct = parseFloat(porcentaje);
        const anterior = parseFloat(parseNumberFromFormatted(prev.montoAnterior));
        if (!isNaN(pct) && !isNaN(anterior) && anterior > 0) {
          const nuevoMonto = anterior * (1 + pct / 100);
          newState.montoNuevo = formatNumberWithThousands(Math.round(nuevoMonto * 100) / 100);
        }
      }
      return newState;
    });
  };

  // Función para calcular porcentaje desde monto nuevo
  const handleMontoNuevoChange = (valor) => {
    setFormAjuste(prev => {
      const newState = { ...prev, montoNuevo: valor };
      if (valor !== '' && prev.montoAnterior) {
        const nuevo = parseFloat(parseNumberFromFormatted(valor));
        const anterior = parseFloat(parseNumberFromFormatted(prev.montoAnterior));
        if (!isNaN(nuevo) && !isNaN(anterior) && anterior > 0) {
          const pct = ((nuevo - anterior) / anterior) * 100;
          newState.porcentajeAumento = pct.toFixed(2);
        }
      } else {
        newState.porcentajeAumento = '';
      }
      return newState;
    });
  };

  const handleSubmitNuevo = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setErrorAjuste('');
    const montoNuevo = parseFloat(parseNumberFromFormatted(formAjuste.montoNuevo));
    if (!montoNuevo || montoNuevo <= 0) {
      setErrorAjuste('El monto nuevo debe ser mayor a 0');
      return;
    }
    const fecha = formAjuste.fechaAjuste ? new Date(formAjuste.fechaAjuste) : new Date();
    const fechaIni = fechaInicio ? new Date(fechaInicio) : null;
    if (fechaIni && fecha < fechaIni) {
      setErrorAjuste('La fecha de ajuste no puede ser anterior al inicio del contrato');
      return;
    }
    if (fechaFin) {
      const fechaF = new Date(fechaFin);
      if (fecha > fechaF) {
        setErrorAjuste('La fecha de ajuste no puede ser posterior al fin del contrato');
        return;
      }
    }
    createMutation.mutate({ fechaAjuste: formAjuste.fechaAjuste, montoNuevo });
  };

  const handleOpenEditar = (ajuste) => {
    setAjusteSeleccionado(ajuste);
    setErrorAjuste('');
    const anterior = Number(ajuste.montoAnterior);
    const nuevo = Number(ajuste.montoNuevo);
    const pct = anterior > 0 ? ((nuevo - anterior) / anterior) * 100 : 0;
    setFormAjuste({
      fechaAjuste: parseFechaLocal(ajuste.fechaAjuste).format('YYYY-MM-DD'),
      montoAnterior: String(anterior),
      montoNuevo: formatNumberWithThousands(nuevo),
      porcentajeAumento: pct.toFixed(2)
    });
    setModalEditar(true);
  };

  const handleSubmitEditar = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setErrorAjuste('');
    const montoNuevo = parseFloat(parseNumberFromFormatted(formAjuste.montoNuevo));
    if (!montoNuevo || montoNuevo <= 0) {
      setErrorAjuste('El monto nuevo debe ser mayor a 0');
      return;
    }
    updateMutation.mutate({
      ajusteId: ajusteSeleccionado.id,
      body: {
        fechaAjuste: formAjuste.fechaAjuste,
        montoAnterior: parseFloat(formAjuste.montoAnterior),
        montoNuevo
      }
    });
  };

  const handleAnular = (ajuste) => setAnulandoAjuste(ajuste);
  const confirmAnular = () => {
    if (anulandoAjuste) deleteMutation.mutate(anulandoAjuste.id);
  };

  const fmtFecha = (f) => (f ? parseFechaLocal(f).format('DD/MM/YYYY') : '-');
  const fmtMoneda = (v) => (v != null ? Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-');
  const fmtPct = (v) => (v != null ? `${Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` : '-');

  if (!contratoId) {
    return (
      <Typography color="text.secondary">
        Guardá el contrato para gestionar ajustes de alquiler.
      </Typography>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Historial de Ajustes</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNuevo}>
          Nuevo ajuste
        </Button>
      </Box>
      {/* Vista tabla (desktop) */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Fecha</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Monto anterior</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Monto nuevo</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>% aumento</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ajustes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 2 }}>
                    <Typography variant="body2" color="text.secondary">No hay ajustes registrados</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                ajustes.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{fmtFecha(a.fechaAjuste)}</TableCell>
                    <TableCell align="right">${fmtMoneda(a.montoAnterior)}</TableCell>
                    <TableCell align="right">${fmtMoneda(a.montoNuevo)}</TableCell>
                    <TableCell align="right">{fmtPct(a.porcentajeAumento)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton size="small" onClick={() => { setAjusteSeleccionado(a); setModalVer(true); }} title="Ver" sx={{ p: 0.5 }}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleOpenEditar(a)} title="Editar" sx={{ p: 0.5 }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleAnular(a)} color="error" title="Anular" sx={{ p: 0.5 }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Vista lista en cards (mobile) */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
        {ajustes.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No hay ajustes registrados
          </Typography>
        ) : (
          ajustes.map((a) => (
            <Card key={a.id} variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Fecha: {fmtFecha(a.fechaAjuste)}</Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>Monto anterior: ${fmtMoneda(a.montoAnterior)}</Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>Monto nuevo: ${fmtMoneda(a.montoNuevo)}</Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>% aumento: {fmtPct(a.porcentajeAumento)}</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton size="small" onClick={() => { setAjusteSeleccionado(a); setModalVer(true); }} title="Ver" sx={{ p: 0.5 }}>
                  <VisibilityIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => handleOpenEditar(a)} title="Editar" sx={{ p: 0.5 }}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => handleAnular(a)} color="error" title="Anular" sx={{ p: 0.5 }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </Card>
          ))
        )}
      </Box>

      {/* Modal Nuevo ajuste */}
      <Dialog open={modalNuevo} onClose={() => { setModalNuevo(false); onCloseNuevoAjuste?.(); }} maxWidth="sm" fullWidth closeAfterTransition={false}>
        <DialogTitle>Nuevo ajuste</DialogTitle>
        <form onSubmit={handleSubmitNuevo}>
          <DialogContent>
            {errorAjuste && <Alert severity="error" sx={{ mb: 2 }}>{errorAjuste}</Alert>}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Fecha ajuste"
                  value={formAjuste.fechaAjuste ? dayjs(formAjuste.fechaAjuste) : null}
                  onChange={(newValue) => setFormAjuste((p) => ({ ...p, fechaAjuste: newValue ? newValue.format('YYYY-MM-DD') : '' }))}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: 'small'
                    },
                    actionBar: {
                      actions: ['clear', 'today']
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Monto anterior"
                  value={formatNumberWithThousands(formAjuste.montoAnterior)}
                  disabled
                  InputProps={{
                    readOnly: true,
                    startAdornment: <InputAdornment position="start">$</InputAdornment>
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Monto nuevo *"
                  type="text"
                  value={formAjuste.montoNuevo}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^[\d.,]*$/.test(value)) handleMontoNuevoChange(value);
                  }}
                  onBlur={(e) => {
                    const formatted = formatNumberWithThousands(parseNumberFromFormatted(e.target.value));
                    if (formatted !== '') setFormAjuste((p) => ({ ...p, montoNuevo: formatted }));
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>
                  }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="% aumento"
                  type="text"
                  value={formAjuste.porcentajeAumento}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^-?[\d.,]*$/.test(value)) handlePorcentajeChange(value);
                  }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>
                  }}
                  placeholder="Ej: 5.5"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setModalNuevo(false); onCloseNuevoAjuste?.(); }}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}>Guardar</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Modal Editar ajuste */}
      <Dialog open={modalEditar} onClose={() => { setModalEditar(false); setAjusteSeleccionado(null); }} maxWidth="sm" fullWidth closeAfterTransition={false}>
        <DialogTitle>Editar ajuste</DialogTitle>
        <form onSubmit={handleSubmitEditar}>
          <DialogContent>
            {errorAjuste && <Alert severity="error" sx={{ mb: 2 }}>{errorAjuste}</Alert>}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Fecha ajuste"
                  value={formAjuste.fechaAjuste ? dayjs(formAjuste.fechaAjuste) : null}
                  onChange={(newValue) => setFormAjuste((p) => ({ ...p, fechaAjuste: newValue ? newValue.format('YYYY-MM-DD') : '' }))}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: 'small'
                    },
                    actionBar: {
                      actions: ['clear', 'today']
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Monto anterior"
                  value={formatNumberWithThousands(formAjuste.montoAnterior)}
                  disabled
                  InputProps={{
                    readOnly: true,
                    startAdornment: <InputAdornment position="start">$</InputAdornment>
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Monto nuevo *"
                  type="text"
                  value={formAjuste.montoNuevo}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^[\d.,]*$/.test(value)) handleMontoNuevoChange(value);
                  }}
                  onBlur={(e) => {
                    const formatted = formatNumberWithThousands(parseNumberFromFormatted(e.target.value));
                    if (formatted !== '') setFormAjuste((p) => ({ ...p, montoNuevo: formatted }));
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>
                  }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="% aumento"
                  type="text"
                  value={formAjuste.porcentajeAumento}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^-?[\d.,]*$/.test(value)) handlePorcentajeChange(value);
                  }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>
                  }}
                  placeholder="Ej: 5.5"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setModalEditar(false); setAjusteSeleccionado(null); }}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={updateMutation.isPending}>Guardar</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Modal Ver detalle ajuste */}
      <Dialog open={modalVer} onClose={() => { setModalVer(false); setAjusteSeleccionado(null); }} closeAfterTransition={false}>
        <DialogTitle>Detalle del ajuste</DialogTitle>
        <DialogContent>
          {ajusteSeleccionado && (
            <Grid container spacing={2}>
              <Grid item xs={12}><Typography variant="body2"><strong>Fecha ajuste:</strong> {fmtFecha(ajusteSeleccionado.fechaAjuste)}</Typography></Grid>
              <Grid item xs={12}><Typography variant="body2"><strong>Monto anterior:</strong> {fmtMoneda(ajusteSeleccionado.montoAnterior)}</Typography></Grid>
              <Grid item xs={12}><Typography variant="body2"><strong>Monto nuevo:</strong> {fmtMoneda(ajusteSeleccionado.montoNuevo)}</Typography></Grid>
              <Grid item xs={12}><Typography variant="body2"><strong>% aumento:</strong> {fmtPct(ajusteSeleccionado.porcentajeAumento)}</Typography></Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setModalVer(false); setAjusteSeleccionado(null); }}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmar anulación */}
      <Dialog open={!!anulandoAjuste} onClose={() => setAnulandoAjuste(null)} closeAfterTransition={false}>
        <DialogTitle>Anular ajuste</DialogTitle>
        <DialogContent>
          ¿Anular este ajuste? El monto actual del contrato se recalculará según el historial restante.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAnulandoAjuste(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={confirmAnular} disabled={deleteMutation.isPending}>
            Anular
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  );
}

// Componente para Responsabilidades
function ContratoResponsabilidades({ contratoId, propiedadId, responsabilidadesTemporales, setResponsabilidadesTemporales, responsabilidadesEditablesRef, readonly = false }) {
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const queryClient = useQueryClient();

  // Obtener tipos de impuesto y actores responsables desde catálogos
  const { data: tiposImpuestoPropiedad } = useQuery({
    queryKey: ['tipos-impuesto-propiedad'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-impuesto-propiedad');
      return response.data;
    }
  });

  const { data: actoresResponsables } = useQuery({
    queryKey: ['actores-responsable-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/actores-responsable-contrato');
      return response.data;
    }
  });

  const { data: contrato } = useQuery({
    queryKey: ['contrato', contratoId],
    queryFn: async () => {
      if (!contratoId) return null;
      const response = await api.get(`/contratos/${contratoId}`);
      return response.data;
    },
    enabled: !!contratoId
  });

  // Obtener impuestos y cargos de la propiedad (puede venir de contrato o de propiedadId)
  const propiedadIdParaImpuestos = contrato?.propiedadId || propiedadId;

  const { data: impuestosPropiedad } = useQuery({
    queryKey: ['impuestos-propiedad', propiedadIdParaImpuestos],
    queryFn: async () => {
      if (!propiedadIdParaImpuestos) return [];
      const response = await api.get(`/propiedad-impuestos/propiedad/${propiedadIdParaImpuestos}`);
      return response.data || [];
    },
    enabled: !!propiedadIdParaImpuestos
  });

  const { data: cargosPropiedad } = useQuery({
    queryKey: ['cargos-propiedad', propiedadIdParaImpuestos],
    queryFn: async () => {
      if (!propiedadIdParaImpuestos) return [];
      const response = await api.get(`/propiedad-cargos/propiedad/${propiedadIdParaImpuestos}`);
      return response.data || [];
    },
    enabled: !!propiedadIdParaImpuestos
  });

  const { data: tiposExpensa } = useQuery({
    queryKey: ['tipos-expensa'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-expensa');
      return response.data || [];
    }
  });

  // Actores responsables (incluir todos, incluyendo Inmobiliaria)
  const actoresResponsablesFiltrados = useMemo(() => {
    if (!actoresResponsables) return [];
    return actoresResponsables.filter(a => a.activo === true);
  }, [actoresResponsables]);

  // IDs por defecto: Inmobiliaria, Inquilino, Propietario
  const actorInmobiliariaId = useMemo(() => actoresResponsables?.find(a => a.codigo === 'INM')?.id ?? null, [actoresResponsables]);
  const actorInquilinoId = useMemo(() => actoresResponsables?.find(a => a.codigo === 'INQ')?.id ?? null, [actoresResponsables]);
  const actorPropietarioId = useMemo(() => actoresResponsables?.find(a => a.codigo === 'PROP')?.id ?? null, [actoresResponsables]);

  // Combinar impuestos y cargos en una sola lista (sin Alquiler; Expensas como Ordinarias y Extraordinarias)
  const itemsCombinados = useMemo(() => {
    const items = [];

    // Agregar impuestos
    if (impuestosPropiedad && impuestosPropiedad.length > 0) {
      impuestosPropiedad.forEach(impuesto => {
        items.push({
          id: impuesto.id,
          tipoId: impuesto.tipoImpuestoId,
          tipoNombre: impuesto.tipoImpuesto?.nombre || impuesto.tipoImpuesto?.codigo || 'Sin nombre',
          tipoCodigo: impuesto.tipoImpuesto?.codigo || '',
          esImpuesto: true,
          esCargo: false,
          tipoExpensaId: null
        });
      });
    }

    // Agregar cargos (excluir Alquiler; Expensas se abren en Ordinarias y Extraordinarias)
    if (cargosPropiedad && cargosPropiedad.length > 0) {
      const tipoExpensaORD = tiposExpensa?.find(t => t.codigo === 'ORD');
      const tipoExpensaEXT = tiposExpensa?.find(t => t.codigo === 'EXT');
      cargosPropiedad.forEach(cargo => {
        const codigo = cargo.tipoCargo?.codigo || '';
        if (codigo === 'ALQUILER') return;
        if (codigo === 'EXPENSAS' && tiposExpensa?.length > 0) {
          if (tipoExpensaORD) {
            items.push({
              id: cargo.id,
              tipoId: cargo.tipoCargoId,
              tipoNombre: 'Expensas Ordinarias',
              tipoCodigo: 'EXPENSAS',
              esImpuesto: false,
              esCargo: true,
              tipoExpensaId: tipoExpensaORD.id,
              tipoExpensaCodigo: 'ORD'
            });
          }
          if (tipoExpensaEXT) {
            items.push({
              id: `exp-ext-${cargo.id}`,
              tipoId: cargo.tipoCargoId,
              tipoNombre: 'Expensas Extraordinarias',
              tipoCodigo: 'EXPENSAS',
              esImpuesto: false,
              esCargo: true,
              tipoExpensaId: tipoExpensaEXT.id,
              tipoExpensaCodigo: 'EXT'
            });
          }
          return;
        }
        items.push({
          id: cargo.id,
          tipoId: cargo.tipoCargoId,
          tipoNombre: cargo.tipoCargo?.nombre || cargo.tipoCargo?.codigo || 'Sin nombre',
          tipoCodigo: codigo,
          esImpuesto: false,
          esCargo: true,
          tipoExpensaId: null
        });
      });
    }

    return items;
  }, [impuestosPropiedad, cargosPropiedad, tiposExpensa]);

  // Obtener responsabilidades existentes del contrato
  const responsabilidadesExistentes = contrato?.responsabilidades || [];

  // Función para obtener la responsabilidad de un item (prioriza temporales, luego BD; default EXT = Inq paga, Prop soporta)
  const getResponsabilidadItem = (item) => {
    const matchResp = (resp) => {
      if (item.esImpuesto) return resp.tipoImpuestoId === item.tipoId;
      if (item.esCargo) {
        if (resp.tipoCargoId !== item.tipoId) return false;
        const respExp = (resp.tipoExpensaId ?? null);
        const itemExp = (item.tipoExpensaId ?? null);
        return respExp === itemExp;
      }
      return false;
    };
    const responsabilidadTemporal = responsabilidadesTemporales.find(matchResp);
    if (responsabilidadTemporal) return responsabilidadTemporal;
    const existente = contratoId && responsabilidadesExistentes.length > 0
      ? responsabilidadesExistentes.find(matchResp)
      : null;
    if (existente) return existente;
    // Default impuestos: Agua, API, Gas, TGI → Inmobiliaria paga, Inquilino cobra; Luz → Inquilino en ambos
    if (item.esImpuesto && item.tipoCodigo) {
      const codigo = String(item.tipoCodigo).toUpperCase();
      if (['AGUA', 'API', 'GAS', 'TGI'].includes(codigo) && actorInmobiliariaId != null && actorInquilinoId != null) {
        return { quienPagaProveedorId: actorInmobiliariaId, quienSoportaCostoId: actorInquilinoId };
      }
      if (codigo === 'LUZ' && actorInquilinoId != null) {
        return { quienPagaProveedorId: actorInquilinoId, quienSoportaCostoId: actorInquilinoId };
      }
    }
    // Default Expensas Ordinarias: Inquilino paga, Inquilino soporta
    if (item.esCargo && item.tipoExpensaCodigo === 'ORD' && actorInquilinoId != null) {
      return { quienPagaProveedorId: actorInquilinoId, quienSoportaCostoId: actorInquilinoId };
    }
    // Default Expensas Extraordinarias: Inquilino paga, Propietario soporta
    if (item.esCargo && item.tipoExpensaCodigo === 'EXT' && actorInquilinoId != null && actorPropietarioId != null) {
      return { quienPagaProveedorId: actorInquilinoId, quienSoportaCostoId: actorPropietarioId };
    }
    return null;
  };

  const createMutation = useMutation({
    mutationFn: (data) => api.post(`/contratos/${contratoId}/responsabilidades`, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries(['contrato', contratoId]);
      setSuccessMessage('Responsabilidad creada exitosamente');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      console.error('Error al crear responsabilidad:', error);
      setSuccessMessage('Error al crear responsabilidad');
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

  const mismoItem = (it, r) => {
    if (it.esImpuesto) return r.tipoImpuestoId === it.tipoId;
    if (it.esCargo) {
      if (r.tipoCargoId !== it.tipoId) return false;
      return (r.tipoExpensaId ?? null) === (it.tipoExpensaId ?? null);
    }
    return false;
  };

  const handleQuienPagaChange = (item, nuevoQuienPagaId) => {
    const responsabilidadExistente = getResponsabilidadItem(item);
    setResponsabilidadesTemporales(prev => {
      const sinEsteItem = prev.filter(r => !mismoItem(item, r));
      const nuevaResponsabilidad = {
        ...(responsabilidadExistente?.id && { id: responsabilidadExistente.id }),
        ...(item.esImpuesto ? { tipoImpuestoId: item.tipoId } : {}),
        ...(item.esCargo ? { tipoCargoId: item.tipoId, ...(item.tipoExpensaId != null && { tipoExpensaId: item.tipoExpensaId }) } : {}),
        quienPagaProveedorId: nuevoQuienPagaId ? parseInt(nuevoQuienPagaId) : null,
        quienSoportaCostoId: responsabilidadExistente?.quienSoportaCostoId ?? null
      };
      if (nuevoQuienPagaId || nuevaResponsabilidad.quienSoportaCostoId) return [...sinEsteItem, nuevaResponsabilidad];
      return sinEsteItem;
    });
  };

  const handleQuienCobraChange = (item, nuevoQuienCobraId) => {
    const responsabilidadExistente = getResponsabilidadItem(item);
    setResponsabilidadesTemporales(prev => {
      const sinEsteItem = prev.filter(r => !mismoItem(item, r));
      const nuevaResponsabilidad = {
        ...(responsabilidadExistente?.id && { id: responsabilidadExistente.id }),
        ...(item.esImpuesto ? { tipoImpuestoId: item.tipoId } : {}),
        ...(item.esCargo ? { tipoCargoId: item.tipoId, ...(item.tipoExpensaId != null && { tipoExpensaId: item.tipoExpensaId }) } : {}),
        quienPagaProveedorId: responsabilidadExistente?.quienPagaProveedorId ?? null,
        quienSoportaCostoId: nuevoQuienCobraId ? parseInt(nuevoQuienCobraId) : null
      };
      if (nuevoQuienCobraId || nuevaResponsabilidad.quienPagaProveedorId) return [...sinEsteItem, nuevaResponsabilidad];
      return sinEsteItem;
    });
  };

  // Inicializar defaults: impuestos (Agua/API/Gas/TGI = Inmobiliaria/Inquilino, Luz = Inquilino/Inquilino), ORD, EXT
  useEffect(() => {
    if (!itemsCombinados?.length || !actorInquilinoId) return;
    const toAdd = [];
    // Impuestos: Agua, API, Gas, TGI → Inmobiliaria paga, Inquilino cobra; Luz → Inquilino en ambos
    itemsCombinados.filter(it => it.esImpuesto && it.tipoCodigo).forEach(item => {
      const codigo = String(item.tipoCodigo).toUpperCase();
      if (!['AGUA', 'API', 'GAS', 'TGI', 'LUZ'].includes(codigo)) return;
      const yaExiste = responsabilidadesExistentes.some(r => r.tipoImpuestoId === item.tipoId);
      const yaEnTemporales = responsabilidadesTemporales.some(r => r.tipoImpuestoId === item.tipoId);
      if (yaExiste || yaEnTemporales) return;
      if (['AGUA', 'API', 'GAS', 'TGI'].includes(codigo) && actorInmobiliariaId != null && actorInquilinoId != null) {
        toAdd.push({
          tipoImpuestoId: item.tipoId,
          quienPagaProveedorId: actorInmobiliariaId,
          quienSoportaCostoId: actorInquilinoId
        });
      } else if (codigo === 'LUZ') {
        toAdd.push({
          tipoImpuestoId: item.tipoId,
          quienPagaProveedorId: actorInquilinoId,
          quienSoportaCostoId: actorInquilinoId
        });
      }
    });
    // Expensas Ordinarias: Inquilino/Inquilino
    const ordItem = itemsCombinados.find(it => it.tipoExpensaCodigo === 'ORD');
    if (ordItem) {
      const yaExiste = responsabilidadesExistentes.some(
        r => r.tipoCargoId === ordItem.tipoId && r.tipoExpensaId === ordItem.tipoExpensaId
      );
      const yaEnTemporales = responsabilidadesTemporales.some(
        r => r.tipoCargoId === ordItem.tipoId && (r.tipoExpensaId ?? null) === ordItem.tipoExpensaId
      );
      if (!yaExiste && !yaEnTemporales) {
        toAdd.push({
          tipoCargoId: ordItem.tipoId,
          tipoExpensaId: ordItem.tipoExpensaId,
          quienPagaProveedorId: actorInquilinoId,
          quienSoportaCostoId: actorInquilinoId
        });
      }
    }
    // Expensas Extraordinarias: Inquilino/Propietario
    if (actorPropietarioId) {
      const extItem = itemsCombinados.find(it => it.tipoExpensaCodigo === 'EXT');
      if (extItem) {
        const yaExiste = responsabilidadesExistentes.some(
          r => r.tipoCargoId === extItem.tipoId && r.tipoExpensaId === extItem.tipoExpensaId
        );
        const yaEnTemporales = responsabilidadesTemporales.some(
          r => r.tipoCargoId === extItem.tipoId && (r.tipoExpensaId ?? null) === extItem.tipoExpensaId
        );
        if (!yaExiste && !yaEnTemporales) {
          toAdd.push({
            tipoCargoId: extItem.tipoId,
            tipoExpensaId: extItem.tipoExpensaId,
            quienPagaProveedorId: actorInquilinoId,
            quienSoportaCostoId: actorPropietarioId
          });
        }
      }
    }
    if (toAdd.length > 0) {
      setResponsabilidadesTemporales(prev => [...prev, ...toAdd]);
    }
  }, [itemsCombinados, responsabilidadesExistentes, responsabilidadesTemporales, actorInmobiliariaId, actorInquilinoId, actorPropietarioId]);

  // Sincronizar responsabilidadesTemporales con el ref cuando cambien
  useEffect(() => {
    if (responsabilidadesEditablesRef) {
      responsabilidadesEditablesRef.current = responsabilidadesTemporales;
    }
  }, [responsabilidadesTemporales]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/contratos/responsabilidades/${id}`, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries(['contrato', contratoId]);
      setSuccessMessage('Responsabilidad actualizada exitosamente');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      console.error('Error al actualizar responsabilidad:', error);
      setSuccessMessage('Error al actualizar responsabilidad');
      setSnackbarOpen(true);
    }
  });

  if (!propiedadIdParaImpuestos) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 6,
          px: 2
        }}
      >
        <HomeWorkIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="body1" color="text.secondary" textAlign="center">
          Seleccione una propiedad en la pestaña "Datos Principales" para configurar las responsabilidades de pago.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', minHeight: 120 }}>
      {readonly && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            bgcolor: 'rgba(255,255,255,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 1,
            pointerEvents: 'auto',
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', px: 2 }}>
            No tiene permiso para modificar responsabilidades.
          </Typography>
        </Box>
      )}
      <Box sx={{ ...(readonly && { pointerEvents: 'none', userSelect: 'none', opacity: 0.9 }) }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Responsabilidades de Pago</Typography>

      {itemsCombinados && itemsCombinados.length > 0 ? (
        <>
          {/* Vista tabla (desktop) */}
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '34%', fontWeight: 'bold' }}>Concepto</TableCell>
                    <TableCell sx={{ width: '33%', fontWeight: 'bold' }}>Quién Paga</TableCell>
                    <TableCell sx={{ width: '33%', fontWeight: 'bold' }}>Cobra a</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {itemsCombinados.map((item) => {
                    const responsabilidad = getResponsabilidadItem(item);
                    return (
                      <TableRow key={`${item.esImpuesto ? 'imp' : 'carg'}-${item.tipoId}-${item.tipoExpensaId ?? 'n'}`}>
                        <TableCell sx={{ fontSize: '0.875rem' }}>
                          {item.tipoNombre}
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" sx={{ width: '100%', maxWidth: 160 }} disabled={readonly}>
                            <Select
                              value={responsabilidad?.quienPagaProveedorId ? Number(responsabilidad.quienPagaProveedorId) : ''}
                              onChange={(e) => handleQuienPagaChange(item, e.target.value)}
                              displayEmpty
                              disabled={readonly}
                              sx={{ height: '32px', fontSize: '0.8rem' }}
                            >
                              <MenuItem value=""><em>Seleccionar</em></MenuItem>
                              {actoresResponsablesFiltrados?.map((actor) => (
                                <MenuItem key={actor.id} value={actor.id}>{actor.nombre || actor.codigo}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" sx={{ width: '100%', maxWidth: 160 }} disabled={readonly}>
                            <Select
                              value={responsabilidad?.quienSoportaCostoId ? Number(responsabilidad.quienSoportaCostoId) : ''}
                              onChange={(e) => handleQuienCobraChange(item, e.target.value)}
                              displayEmpty
                              disabled={readonly}
                              sx={{ height: '32px', fontSize: '0.8rem' }}
                            >
                              <MenuItem value=""><em>Seleccionar</em></MenuItem>
                              {actoresResponsablesFiltrados?.map((actor) => (
                                <MenuItem key={actor.id} value={actor.id}>{actor.nombre || actor.codigo}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* Vista lista en cards (mobile) */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
            {itemsCombinados.map((item) => {
              const responsabilidad = getResponsabilidadItem(item);
              return (
                <Card key={`${item.esImpuesto ? 'imp' : 'carg'}-${item.tipoId}-${item.tipoExpensaId ?? 'n'}`} variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
                    {item.tipoNombre}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Quién Paga</Typography>
                      <FormControl size="small" fullWidth disabled={readonly}>
                        <Select
                          value={responsabilidad?.quienPagaProveedorId ? Number(responsabilidad.quienPagaProveedorId) : ''}
                          onChange={(e) => handleQuienPagaChange(item, e.target.value)}
                          displayEmpty
                          disabled={readonly}
                          sx={{ height: '36px' }}
                        >
                          <MenuItem value=""><em>Seleccionar</em></MenuItem>
                          {actoresResponsablesFiltrados?.map((actor) => (
                            <MenuItem key={actor.id} value={actor.id}>{actor.nombre || actor.codigo}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Cobra a</Typography>
                      <FormControl size="small" fullWidth disabled={readonly}>
                        <Select
                          value={responsabilidad?.quienSoportaCostoId ? Number(responsabilidad.quienSoportaCostoId) : ''}
                          onChange={(e) => handleQuienCobraChange(item, e.target.value)}
                          displayEmpty
                          disabled={readonly}
                          sx={{ height: '36px' }}
                        >
                          <MenuItem value=""><em>Seleccionar</em></MenuItem>
                          {actoresResponsablesFiltrados?.map((actor) => (
                            <MenuItem key={actor.id} value={actor.id}>{actor.nombre || actor.codigo}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  </Box>
                </Card>
              );
            })}
          </Box>
        </>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 4,
            px: 2,
            bgcolor: 'grey.50',
            borderRadius: 1
          }}
        >
          <Typography variant="body2" color="text.secondary" textAlign="center">
            No hay impuestos ni cargos asociados a esta propiedad. Agregue impuestos o cargos en la sección de Propiedades.
          </Typography>
        </Box>
      )}

      </Box>
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
function ContratoGarantias({ contratoId, garantiasTemporales, setGarantiasTemporales, readonly = false }) {
  const [formData, setFormData] = useState({
    tipoGarantia: '',
    estadoGarantia: '',
    apellido: '',
    nombre: '',
    dni: '',
    cuit: '',
    telefono: '',
    mail: '',
    direccion: '',
    costoAveriguacion: ''
  });
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [garantiaAEliminar, setGarantiaAEliminar] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const queryClient = useQueryClient();

  // Obtener catálogos necesarios
  const { data: tiposGarantiaContrato } = useQuery({
    queryKey: ['tipos-garantia-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-garantia-contrato');
      return response.data;
    }
  });

  const { data: estadosGarantiaContrato } = useQuery({
    queryKey: ['estados-garantia-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/estados-garantia-contrato');
      return response.data;
    }
  });

  // Funciones auxiliares
  const getTipoGarantiaNombre = (tipoGarantiaId) => {
    if (!tipoGarantiaId || !tiposGarantiaContrato) return 'Sin tipo';
    const tipo = tiposGarantiaContrato.find(t => t.id === tipoGarantiaId);
    return tipo?.nombre || tipo?.codigo || 'Sin tipo';
  };

  const getEstadoGarantiaNombre = (estadoGarantiaId) => {
    if (!estadoGarantiaId || !estadosGarantiaContrato) return 'Sin estado';
    const estado = estadosGarantiaContrato.find(e => e.id === estadoGarantiaId);
    return estado?.nombre || estado?.codigo || 'Sin estado';
  };

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
        direccion: '',
        costoAveriguacion: ''
      });
      setSuccessMessage('Garantía agregada exitosamente');
      setSnackbarOpen(true);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/contratos/garantias/${id}`, data),
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
        direccion: '',
        costoAveriguacion: ''
      });
      setEditingIndex(null);
      setSuccessMessage('Garantía actualizada exitosamente');
      setSnackbarOpen(true);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/contratos/garantias/${id}`),
    onSuccess: () => {
      setGarantiaAEliminar(null);
      queryClient.invalidateQueries(['contrato', contratoId]);
      setSuccessMessage('Garantía eliminada exitosamente');
      setSnackbarOpen(true);
    }
  });

  const handleSubmit = () => {
    const nuevaGarantia = {
      tipoGarantiaId: formData.tipoGarantia || null,
      estadoGarantiaId: formData.estadoGarantia || null,
      apellido: formData.apellido || null,
      nombre: formData.nombre || null,
      dni: formData.dni || null,
      cuit: formData.cuit || null,
      telefono: formData.telefono || null,
      mail: formData.mail || null,
      direccion: formData.direccion || null,
      costoAveriguacion: formData.costoAveriguacion ? parseFloat(parseNumberFromFormatted(formData.costoAveriguacion)) : null
    };

    if (contratoId) {
      // Si hay contratoId, guardar inmediatamente en BD
      if (editingIndex !== null && garantias[editingIndex]?.id) {
        // Actualizar garantía existente
        updateMutation.mutate({
          id: garantias[editingIndex].id,
          data: nuevaGarantia
        });
      } else {
        // Crear nueva garantía
        createMutation.mutate(nuevaGarantia);
      }
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
        direccion: '',
        costoAveriguacion: ''
      });
      setEditingIndex(null);
    }
  };

  const handleEdit = (index) => {
    const garantia = garantias[index];
    setFormData({
      tipoGarantia: garantia.tipoGarantiaId || '',
      estadoGarantia: garantia.estadoGarantiaId || '',
      apellido: garantia.apellido || '',
      nombre: garantia.nombre || '',
      dni: garantia.dni || '',
      cuit: garantia.cuit || '',
      telefono: garantia.telefono || '',
      mail: garantia.mail || '',
      direccion: garantia.direccion || '',
      costoAveriguacion: garantia.costoAveriguacion ? formatNumberWithThousands(String(garantia.costoAveriguacion)) : ''
    });
    setEditingIndex(index);
    setOpen(true);
  };

  const handleDelete = (index, id) => {
    setGarantiaAEliminar({ index, id });
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
      direccion: '',
      costoAveriguacion: ''
    });
    setEditingIndex(null);
  };

  return (
    <Box sx={{ position: 'relative', minHeight: 120 }}>
      {readonly && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            bgcolor: 'rgba(255,255,255,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 1,
            pointerEvents: 'auto',
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', px: 2 }}>
            No tiene permiso para modificar garantías.
          </Typography>
        </Box>
      )}
      <Box sx={{ ...(readonly && { pointerEvents: 'none', userSelect: 'none', opacity: 0.9 }) }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Garantías</Typography>
        {!readonly && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Nueva Garantía
          </Button>
        )}
      </Box>

      {/* Vista tabla (desktop) */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Tipo</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Nombre</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>DNI/CUIT</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Costo Averig.</TableCell>
                {!readonly && <TableCell sx={{ fontWeight: 'bold' }}>Acciones</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {garantias && garantias.length > 0 ? (
                garantias.map((garantia, index) => (
                  <TableRow key={garantia.id || `temp-${index}`}>
                    <TableCell>{getTipoGarantiaNombre(garantia.tipoGarantiaId)}</TableCell>
                    <TableCell>{getEstadoGarantiaNombre(garantia.estadoGarantiaId)}</TableCell>
                    <TableCell>{garantia.nombre} {garantia.apellido}</TableCell>
                    <TableCell>{garantia.dni || garantia.cuit || '-'}</TableCell>
                    <TableCell align="right">
                      {garantia.costoAveriguacion
                        ? `$${formatNumberWithThousands(String(garantia.costoAveriguacion))}`
                        : '-'}
                    </TableCell>
                    {!readonly && (
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <IconButton size="small" onClick={() => handleEdit(index)} sx={{ p: 0.5 }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(index, garantia.id)} sx={{ p: 0.5 }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={readonly ? 5 : 6} align="center" sx={{ py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      No hay garantías agregadas
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Vista lista en cards (mobile) */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
        {garantias && garantias.length > 0 ? (
          garantias.map((garantia, index) => (
            <Card key={garantia.id || `temp-${index}`} variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                {getTipoGarantiaNombre(garantia.tipoGarantiaId)} · {getEstadoGarantiaNombre(garantia.estadoGarantiaId)}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>{garantia.nombre} {garantia.apellido}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>DNI/CUIT: {garantia.dni || garantia.cuit || '-'}</Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Costo averig.: {garantia.costoAveriguacion ? `$${formatNumberWithThousands(String(garantia.costoAveriguacion))}` : '-'}
              </Typography>
              {!readonly && (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton size="small" onClick={() => handleEdit(index)} sx={{ p: 0.5 }} title="Editar">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(index, garantia.id)} sx={{ p: 0.5 }} title="Eliminar">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Card>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No hay garantías agregadas
          </Typography>
        )}
      </Box>

      </Box>
      <ConfirmDialog
        open={!!garantiaAEliminar}
        onClose={() => setGarantiaAEliminar(null)}
        title="Eliminar garantía"
        message="¿Eliminar esta garantía?"
        confirmLabel="Eliminar"
        confirmColor="error"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!garantiaAEliminar) return;
          if (contratoId && garantiaAEliminar.id) {
            deleteMutation.mutate(garantiaAEliminar.id);
          } else {
            setGarantiasTemporales(prev => prev.filter((_, i) => i !== garantiaAEliminar.index));
            setGarantiaAEliminar(null);
          }
        }}
      />

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth closeAfterTransition={false}>
        <DialogTitle>{editingIndex !== null ? 'Editar Garantía' : 'Nueva Garantía'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Tipo de Garantía</InputLabel>
                <Select
                  value={formData.tipoGarantia || ''}
                  onChange={(e) => setFormData({ ...formData, tipoGarantia: e.target.value })}
                  label="Tipo de Garantía"
                >
                  <MenuItem value="">
                    <em>Seleccione...</em>
                  </MenuItem>
                  {tiposGarantiaContrato?.filter(t => t.activo !== false).map((tipo) => (
                    <MenuItem key={tipo.id} value={tipo.id}>
                      {tipo.nombre || tipo.codigo}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Estado</InputLabel>
                <Select
                  value={formData.estadoGarantia || ''}
                  onChange={(e) => setFormData({ ...formData, estadoGarantia: e.target.value })}
                  label="Estado"
                >
                  <MenuItem value="">
                    <em>Seleccione...</em>
                  </MenuItem>
                  {estadosGarantiaContrato?.filter(e => e.activo !== false).map((estado) => (
                    <MenuItem key={estado.id} value={estado.id}>
                      {estado.nombre || estado.codigo}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                label="Nombre"
                fullWidth
                size="small"
                value={formData.nombre ?? ''}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                label="Apellido"
                fullWidth
                size="small"
                value={formData.apellido ?? ''}
                onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                label="DNI"
                fullWidth
                size="small"
                value={formData.dni ?? ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').substring(0, 8);
                  setFormData({ ...formData, dni: value });
                }}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                label="CUIT"
                fullWidth
                size="small"
                value={formData.cuit ?? ''}
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
            <Grid item xs={6} sm={4}>
              <TextField
                label="Teléfono"
                fullWidth
                size="small"
                value={formData.telefono ?? ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setFormData({ ...formData, telefono: value });
                }}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                label="Email"
                type="email"
                fullWidth
                size="small"
                value={formData.mail ?? ''}
                onChange={(e) => setFormData({ ...formData, mail: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Dirección"
                fullWidth
                size="small"
                value={formData.direccion ?? ''}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Costo Averiguación"
                type="text"
                fullWidth
                size="small"
                value={formData.costoAveriguacion ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^[\d.,]*$/.test(value)) {
                    setFormData({ ...formData, costoAveriguacion: value });
                  }
                }}
                onBlur={(e) => {
                  const formatted = formatNumberWithThousands(parseNumberFromFormatted(e.target.value));
                  setFormData({ ...formData, costoAveriguacion: formatted });
                }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
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
            {editingIndex !== null ? 'Guardar' : 'Guardar'}
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

/** Firma estable de los gastos iniciales del contrato en API (para no saltar el merge cuando llega el GET). */
function snapshotGastosContratoApi(gastos) {
  if (!gastos?.length) return '';
  return gastos
    .map((g) =>
      `${g.id ?? ''}|${Number(g.tipoGastoInicialId)}|${String(g.importe ?? '')}|${g.quienPagaId ?? ''}`
    )
    .sort()
    .join(';');
}

// Componente para Gastos Iniciales
function ContratoGastosIniciales({
  contratoId,
  montoInicial,
  duracionMeses,
  gastosTemporales,
  setGastosTemporales,
  gastosEdicion,
  setGastosEdicion,
  gastosEditablesRef,
  garantiasContrato,
  garantiasTemporales,
  gastosInicialesLiquidados,
  onGastosInicialesLiquidadosChange,
  readonly = false
}) {
  const [gastosEditablesLocal, setGastosEditablesLocal] = useState([]);
  /** Al editar contrato existente el padre guarda el array para que Guardar envíe siempre los datos actuales. */
  const parentControlled = Boolean(contratoId && typeof setGastosEdicion === 'function');
  const gastosEditables = parentControlled
    ? (gastosEdicion ?? [])
    : (contratoId ? gastosEditablesLocal : (gastosTemporales || []));
  const setGastosEditables = parentControlled
    ? setGastosEdicion
    : (contratoId ? setGastosEditablesLocal : setGastosTemporales);

  // Ref sincrónico con el render: el padre lee gastosEditablesRef al hacer submit (sin depender solo de effects).
  if (gastosEditablesRef) {
    gastosEditablesRef.current = gastosEditables;
  }

  // Calcular el total de costos de averiguación de garantías
  const totalCostoAveriguacion = useMemo(() => {
    const garantias = contratoId ? (garantiasContrato || []) : (garantiasTemporales || []);
    return garantias.reduce((total, g) => {
      const costo = g.costoAveriguacion ? parseFloat(g.costoAveriguacion) : 0;
      return total + (isNaN(costo) ? 0 : costo);
    }, 0);
  }, [contratoId, garantiasContrato, garantiasTemporales]);

  // Sincronizar el ref con el estado actual (layout: listo antes del submit en el mismo tick)
  useLayoutEffect(() => {
    if (gastosEditablesRef) {
      gastosEditablesRef.current = gastosEditables;
    }
  }, [gastosEditables, gastosEditablesRef]);

  // Función helper para parsear el importe correctamente (puede venir como string, number, o Decimal de Prisma)
  const parseImporte = (importeValue) => {
    if (!importeValue && importeValue !== 0) return '';

    // Si es un objeto (Decimal de Prisma), convertirlo a string
    if (typeof importeValue === 'object' && importeValue !== null) {
      importeValue = String(importeValue);
    }

    // Si es número, convertirlo a string
    if (typeof importeValue === 'number') {
      importeValue = Number.isInteger(importeValue)
        ? importeValue.toString()
        : importeValue.toFixed(2);
    }

    // Parsear y formatear
    const parsed = parseNumberFromFormatted(String(importeValue));
    return formatNumberWithThousands(parsed);
  };

  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const queryClient = useQueryClient();
  // Ref para rastrear si ya inicializamos los gastos y evitar loops
  const gastosInicializadosRef = useRef(false);
  // Ref para rastrear los valores anteriores y evitar recálculos innecesarios
  const valoresPreviosRef = useRef({ montoInicial: null, duracionMeses: null });
  /** Evita el early-return cuando el GET del contrato aún no había traído gastosIniciales. */
  const ultimoContratoGastosMergeRef = useRef('');

  // Obtener tipos de gasto inicial desde el catálogo (solo activos)
  const { data: tiposGastoInicialContrato } = useQuery({
    queryKey: ['tipos-gasto-inicial-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-gasto-inicial-contrato');
      return response.data;
    }
  });

  // Filtrar solo los tipos activos
  const tiposGastoActivos = useMemo(() => {
    if (!tiposGastoInicialContrato) return [];
    return tiposGastoInicialContrato.filter(t => t.activo === true);
  }, [tiposGastoInicialContrato]);

  // Obtener actores responsables desde el catálogo (solo activos)
  const { data: actoresResponsablesGastos } = useQuery({
    queryKey: ['actores-responsable-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/actores-responsable-contrato');
      return response.data;
    }
  });

  const actoresResponsablesContrato = useMemo(() => {
    if (!actoresResponsablesGastos) return [];
    return actoresResponsablesGastos.filter(a =>
      a.activo === true &&
      a.codigo !== 'INMO' &&
      !a.nombre?.toLowerCase().includes('inmobiliaria')
    );
  }, [actoresResponsablesGastos]);

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

  // Inicializar y sincronizar gastos desde el catálogo (solo activos)
  // Este efecto debe ejecutarse cuando:
  // 1. Se cargan los tipos de gasto del catálogo por primera vez
  // 2. Cambia el contrato (gastosIniciales) - solo si hay contratoId
  // 3. Cambia el contratoId
  // 4. Cambian montoInicial o duracionMeses (para recalcular importes)
  useEffect(() => {
    // Esperar a que los tipos de gasto se carguen
    if (!tiposGastoActivos || tiposGastoActivos.length === 0) {
      return; // No podemos inicializar sin tipos de gasto
    }

    // Si ya se inicializaron los gastos, verificar si realmente cambiaron montoInicial o duracionMeses
    // Si no cambiaron, NO recalcular para evitar sobrescribir cambios manuales (como cambiar valorCalculo)
    if (gastosInicializadosRef.current) {
      const montoInicialActual = montoInicial || '';
      const duracionMesesActual = duracionMeses || '';
      const valoresPrevios = valoresPreviosRef.current;

      const montoDuracionIguales =
        valoresPrevios.montoInicial === montoInicialActual &&
        valoresPrevios.duracionMeses === duracionMesesActual;

      const snapApi = snapshotGastosContratoApi(contrato?.gastosIniciales);

      // Solo omitir recálculo si monto/duración no cambiaron Y el snapshot de gastos del servidor es el mismo
      // que la última vez que fusionamos. Si el contrato acaba de cargar gastos desde la API, snapApi cambia
      // y NO debemos salir: antes el return impedía aplicar ids/importes de BD.
      if (montoDuracionIguales && ultimoContratoGastosMergeRef.current === snapApi) {
        return;
      }
    }

    // Calcular importe localmente usando los valores del catálogo
    const calcularImporteLocal = (tipoGasto, valorCalculo = null) => {
      // Caso especial: Averiguación de garantías - suma de costos de averiguación de todas las garantías
      const codigoLower = tipoGasto.codigo?.toLowerCase() || '';
      if (codigoLower.includes('averig') || codigoLower === 'averiguacion' || codigoLower === 'averiguacion_garantias') {
        return totalCostoAveriguacion;
      }

      // Parsear montoInicial correctamente (puede venir con formato de miles como "250.000")
      // parseNumberFromFormatted convierte "250.000" -> "250000" (string)
      // Luego parseFloat convierte "250000" -> 250000 (number)
      const montoInicialStr = montoInicial || '0';
      const montoInicialParsed = parseNumberFromFormatted(montoInicialStr);
      const montoInicialNum = montoInicialParsed && montoInicialParsed !== ''
        ? parseFloat(montoInicialParsed)
        : 0;
      const duracionMesesNum = parseInt(duracionMeses || '0') || 0;
      const montoTotalContrato = montoInicialNum * duracionMesesNum;

      // Si es porcentaje (Sellado, Honorarios), calcular sobre el monto total del contrato
      if (tipoGasto.esPorcentaje) {
        let porcentaje = 0;
        if (valorCalculo !== null && valorCalculo !== undefined && valorCalculo !== '') {
          const parsed = parseFloat(String(valorCalculo));
          porcentaje = !isNaN(parsed) && isFinite(parsed) ? parsed / 100 : 0;
        } else if (tipoGasto.valorDefault) {
          const parsed = parseFloat(String(tipoGasto.valorDefault));
          porcentaje = !isNaN(parsed) && isFinite(parsed) ? parsed / 100 : 0;
        }
        const resultadoCalculado = montoTotalContrato * porcentaje;
        // Redondear a 2 decimales para evitar problemas de precisión de punto flotante
        // Ejemplo: 420000.00000000006 -> Math.round(42000000.000000006) / 100 -> 42000000 / 100 -> 420000
        const resultado = Math.round(resultadoCalculado * 100) / 100;
        return isNaN(resultado) || !isFinite(resultado) ? 0 : resultado;
      } else {
        // Si NO es porcentaje (Depósito), multiplicar el valor por el monto inicial
        let cantidad = 0;
        if (valorCalculo !== null && valorCalculo !== undefined && valorCalculo !== '') {
          const parsed = parseFloat(String(valorCalculo));
          cantidad = !isNaN(parsed) && isFinite(parsed) ? parsed : 0;
        } else if (tipoGasto.valorDefault) {
          const parsed = parseFloat(String(tipoGasto.valorDefault));
          cantidad = !isNaN(parsed) && isFinite(parsed) ? parsed : 0;
        }
        // Multiplicar cantidad por montoInicial (ej: 1 * 250000 = 250000)
        const resultadoCalculado = cantidad >= 0 ? montoInicialNum * cantidad : 0;
        // Redondear a 2 decimales para evitar problemas de precisión de punto flotante
        const resultado = Math.round(resultadoCalculado * 100) / 100;
        return isNaN(resultado) || !isFinite(resultado) ? 0 : resultado;
      }
    };

    const gastosExistentes = contrato?.gastosIniciales || [];

    // Crear gastos para todos los tipos activos del catálogo
    // Filtrar solo los tipos que tienen id válido
    let gastosActualizados = tiposGastoActivos
      .filter(tipoGasto => tipoGasto && tipoGasto.id)
      .map(tipoGasto => {
        const tipoGastoId = tipoGasto.id;
        const tipoGastoCodigo = tipoGasto.codigo;

        // Buscar gastos existentes:
        // 1. Si hay contratoId, buscar primero en BD (gastosExistentes), luego en gastosEditables (estado local)
        // 2. Si no hay contratoId, buscar en gastosTemporales (del padre)
        let gastoExistente = null;

        if (contratoId) {
          // Si hay contratoId, buscar primero en BD (prioridad)
          if (gastosExistentes && gastosExistentes.length > 0) {
            gastoExistente = gastosExistentes.find(g => {
              if (!g) return false;
              return Number(g.tipoGastoInicialId) === Number(tipoGastoId);
            });
          }

          // Si no se encontró en BD, buscar en gastosEditables (estado local)
          // pero solo si tiene id (para preservar el id del gasto existente)
          if (!gastoExistente && gastosEditables && gastosEditables.length > 0) {
            const gastoLocal = gastosEditables.find(g =>
              g && Number(g.tipoGastoInicialId) === Number(tipoGastoId) && g.id
            );
            if (gastoLocal) {
              gastoExistente = gastoLocal;
            }
          }
        } else {
          // Si no hay contratoId, buscar en gastosTemporales
          if (gastosTemporales && gastosTemporales.length > 0) {
            gastoExistente = gastosTemporales.find(g =>
              g && g.tipoGastoInicialId === tipoGastoId
            );
          }
        }

        // Si se encontró un gasto existente, usar sus datos
        if (gastoExistente) {
          // Si fue editado manualmente (incluyendo cuando se cambia valorCalculo), mantener sus valores EXACTAMENTE
          if (gastoExistente.importeEditado) {
            return {
              id: gastoExistente.id || null,
              tipoGastoInicialId: tipoGastoId,
              tipoGastoInicialCodigo: tipoGastoCodigo,
              valorCalculo: gastoExistente.valorCalculo ? (typeof gastoExistente.valorCalculo === 'string' ? gastoExistente.valorCalculo : parseFloat(gastoExistente.valorCalculo).toString()) : '',
              importe: gastoExistente.importe
                ? (typeof gastoExistente.importe === 'string'
                  ? gastoExistente.importe
                  : (typeof gastoExistente.importe === 'number'
                    ? (Number.isInteger(gastoExistente.importe)
                      ? gastoExistente.importe.toString()
                      : gastoExistente.importe.toFixed(2))
                    : String(gastoExistente.importe)))
                : '',
              quienPagaId: gastoExistente.quienPagaId || null,
              esNuevo: !gastoExistente.id,
              importeEditado: true // Mantener como editado
            };
          }

          const valorCalculoCat = tipoGasto.valorDefault ? tipoGasto.valorDefault.toString() : '';
          const importeRecalculado = calcularImporteLocal(tipoGasto, valorCalculoCat);
          
          let importeFinal = '0';
          let valorCalculoFinal = valorCalculoCat;

          // Verificar si el montoInicial o duracionMeses cambiaron en el formulario (ignorar si es la primera carga)
          const esRecargaOPrimerCarga = 
            !gastosInicializadosRef.current || 
            (valoresPreviosRef.current.montoInicial === (montoInicial || '') &&
             valoresPreviosRef.current.duracionMeses === (duracionMeses || ''));

          if (gastoExistente.id && esRecargaOPrimerCarga) {
            // Si viene de la BD y NO cambiamos el monto base en esta sesión interactiva, 
            // RESPETAR el valor guardado en la BD (podría haber sido editado manualmente)
            valorCalculoFinal = gastoExistente.valorCalculo !== null && gastoExistente.valorCalculo !== undefined 
                ? String(gastoExistente.valorCalculo) : valorCalculoCat;
            
            if (gastoExistente.importe !== null && gastoExistente.importe !== undefined) {
              // Prisma devuelve Decimal como string con formato de base de datos (p.ej. "84000.00").
              // No usar parseNumberFromFormatted aquí porque borraría el punto asumiendo que es millar.
              const parsedImp = parseFloat(gastoExistente.importe);
              if (!isNaN(parsedImp)) {
                importeFinal = Number.isInteger(parsedImp)
                  ? parsedImp.toString()
                  : parsedImp.toFixed(2).replace('.', ','); // Convertir a coma decimal para la UI
              }
            }
          } else {
            // Es nuevo o se cambió la base del contrato explícitamente -> RECALCULAR
            if (!isNaN(importeRecalculado) && isFinite(importeRecalculado) && importeRecalculado >= 0) {
              importeFinal = Number.isInteger(importeRecalculado) 
                ? importeRecalculado.toString() 
                : importeRecalculado.toFixed(2).replace('.', ',');
            }
          }

          return {
            id: gastoExistente.id || null, // SIEMPRE preservar el ID si existe
            tipoGastoInicialId: tipoGastoId,
            tipoGastoInicialCodigo: tipoGastoCodigo,
            valorCalculo: valorCalculoFinal,
            importe: importeFinal,
            quienPagaId: gastoExistente.quienPagaId || null,
            esNuevo: !gastoExistente.id,
            importeEditado: false // Inicia como no editado localmente en esta renderización
          };
        }

        // Si no existe en el estado, crear uno nuevo con importe calculado y estado pendiente
        // Usar valorDefault del catálogo si existe
        const valorCalculoDefault = tipoGasto.valorDefault ? tipoGasto.valorDefault.toString() : '';
        const importeCalculado = calcularImporteLocal(tipoGasto, valorCalculoDefault);
        // Guardar como número sin decimales si es entero, o con 2 decimales si tiene decimales
        let importeFinal = '0';
        if (!isNaN(importeCalculado) && isFinite(importeCalculado) && importeCalculado >= 0) {
          if (Number.isInteger(importeCalculado)) {
            importeFinal = importeCalculado.toString();
          } else {
            importeFinal = importeCalculado.toFixed(2);
          }
        }

        // Determinar quienPagaId por defecto: buscar "INQ" (Inquilino) primero, sino cualquier actor activo
        let quienPagaIdDefault = null;
        if (actoresResponsablesContrato && actoresResponsablesContrato.length > 0) {
          const inquilinoActor = actoresResponsablesContrato.find(a => a.activo && (a.codigo === 'INQ' || a.nombre?.toLowerCase().includes('inquilino')));
          quienPagaIdDefault = inquilinoActor ? inquilinoActor.id : (actoresResponsablesContrato.find(a => a.activo)?.id || null);
        }

        return {
          id: null,
          tipoGastoInicialId: tipoGastoId,
          tipoGastoInicialCodigo: tipoGastoCodigo,
          valorCalculo: valorCalculoDefault,
          importe: importeFinal, // Puede ser '0' si no hay montoInicial o duracionMeses
          quienPagaId: quienPagaIdDefault,
          esNuevo: true,
          importeEditado: false // No fue editado manualmente, no se guardará hasta que el usuario lo edite
        };
      }).filter(g => g !== null && g.tipoGastoInicialId); // Filtrar solo los que tienen tipoGastoInicialId válido

    // Eliminar duplicados basándose en tipoGastoInicialId (debería haber solo uno de cada tipo)
    // Esto previene que se creen gastos duplicados si el useEffect se ejecuta múltiples veces
    const gastosUnicos = [];
    const idsVistos = new Set();
    for (const gasto of gastosActualizados) {
      if (!idsVistos.has(gasto.tipoGastoInicialId)) {
        idsVistos.add(gasto.tipoGastoInicialId);
        gastosUnicos.push(gasto);
      } else {
        console.warn('⚠️ Gasto duplicado detectado y eliminado:', gasto.tipoGastoInicialCodigo, gasto);
      }
    }
    gastosActualizados = gastosUnicos;

    setGastosEditables(gastosActualizados);
    gastosInicializadosRef.current = true;
    ultimoContratoGastosMergeRef.current = snapshotGastosContratoApi(contrato?.gastosIniciales);
    // Actualizar referencias después de inicializar
    valoresPreviosRef.current = {
      montoInicial: montoInicial || '',
      duracionMeses: duracionMeses || ''
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiposGastoActivos, contrato?.gastosIniciales, contratoId, montoInicial, duracionMeses, actoresResponsablesContrato]);

  // Efecto para actualizar el importe de "Averiguación de garantías" cuando cambia el total de costos
  useEffect(() => {
    if (!tiposGastoActivos || tiposGastoActivos.length === 0) return;

    // Buscar el tipo de gasto "Averiguación de garantías"
    const tipoAveriguacion = tiposGastoActivos.find(t => {
      const codigoLower = t.codigo?.toLowerCase() || '';
      return codigoLower.includes('averig') || codigoLower === 'averiguacion' || codigoLower === 'averiguacion_garantias';
    });

    if (!tipoAveriguacion) return;

    setGastosEditables(prev => {
      const actualizados = [...prev];
      const indice = actualizados.findIndex(g => g.tipoGastoInicialId === tipoAveriguacion.id);

      if (indice !== -1) {
        // Solo actualizar si el importe cambió y no fue editado manualmente
        const importeActual = parseFloat(parseNumberFromFormatted(actualizados[indice].importe || '0')) || 0;
        if (importeActual !== totalCostoAveriguacion && !actualizados[indice].importeEditado) {
          actualizados[indice] = {
            ...actualizados[indice],
            importe: totalCostoAveriguacion > 0
              ? (Number.isInteger(totalCostoAveriguacion) ? totalCostoAveriguacion.toString() : totalCostoAveriguacion.toFixed(2))
              : '0'
          };
        }
      }

      return actualizados;
    });
  }, [totalCostoAveriguacion, tiposGastoActivos, setGastosEditables]);

  // NO guardar automáticamente los gastos al inicializar
  // Los gastos solo se guardarán cuando el usuario edite manualmente un valor
  // (handleValorCalculoBlur o handleImporteBlur)

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

  const createGastoInicialMutation = useMutation({
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

  const updateGastoInicialMutation = useMutation({
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

  const handleQuienPagaChange = (gasto, nuevoQuienPagaId) => {
    setGastosEditables(prev => {
      const actualizados = [...prev];

      // Buscar el gasto en el array original por tipoGastoInicialId
      const indiceReal = actualizados.findIndex(g =>
        g && g.tipoGastoInicialId === gasto.tipoGastoInicialId
      );

      // Si no se encuentra el gasto, no hacer nada
      if (indiceReal === -1 || !actualizados[indiceReal]) {
        return actualizados;
      }

      actualizados[indiceReal] = {
        ...actualizados[indiceReal],
        quienPagaId: nuevoQuienPagaId ? parseInt(nuevoQuienPagaId) : null,
        importeEditado: true // Marcar como editado para que se guarde
      };

      // Sincronizar con el ref inmediatamente
      if (gastosEditablesRef) {
        gastosEditablesRef.current = actualizados;
      }

      return actualizados;
    });
  };

  const handleImporteChange = (index, nuevoImporte, gasto) => {
    setGastosEditables(prev => {
      const actualizados = [...prev];

      // Buscar el gasto en el array original por tipoGastoInicialId en lugar de usar el índice
      const indiceReal = actualizados.findIndex(g =>
        g && g.tipoGastoInicialId === gasto.tipoGastoInicialId
      );

      // Si no se encuentra el gasto, no hacer nada
      if (indiceReal === -1 || !actualizados[indiceReal]) {
        return actualizados;
      }

      actualizados[indiceReal] = {
        ...actualizados[indiceReal],
        importe: nuevoImporte,
        importeEditado: true // Marcar como editado manualmente
      };
      if (gastosEditablesRef) {
        gastosEditablesRef.current = actualizados;
      }
      return actualizados;
    });
  };

  const handleImporteBlur = (gasto, index) => {
    // Solo actualizar el estado local, no guardar en BD
    // Los gastos se guardarán cuando se haga click en "Guardar" del contrato
    // Marcar como editado para que no se recalcule automáticamente
    setGastosEditables(prev => {
      const actualizados = [...prev];

      // Buscar el gasto en el array original por tipoGastoInicialId
      const indiceReal = actualizados.findIndex(g =>
        g && g.tipoGastoInicialId === gasto.tipoGastoInicialId
      );

      if (indiceReal !== -1 && actualizados[indiceReal]) {
        actualizados[indiceReal] = {
          ...actualizados[indiceReal],
          importeEditado: true
        };
      }
      if (gastosEditablesRef) {
        gastosEditablesRef.current = actualizados;
      }
      return actualizados;
    });
  };

  const handleValorCalculoChange = (index, nuevoValor, gasto) => {
    setGastosEditables(prev => {
      const actualizados = [...prev];

      // Buscar el gasto en el array original por tipoGastoInicialId en lugar de usar el índice
      // Esto es necesario porque el índice puede ser del array filtrado/ordenado, no del original
      const indiceReal = actualizados.findIndex(g =>
        g && g.tipoGastoInicialId === gasto.tipoGastoInicialId
      );

      // Si no se encuentra el gasto, no hacer nada
      if (indiceReal === -1 || !actualizados[indiceReal]) {
        return actualizados;
      }

      // Buscar el tipo de gasto en el catálogo para obtener esPorcentaje
      const tipoGasto = tiposGastoActivos?.find(
        (t) => Number(t.id) === Number(gasto.tipoGastoInicialId)
      );

      // Si el tipo de gasto no existe, solo actualizar el valorCalculo sin recalcular
      if (!tipoGasto) {
        actualizados[indiceReal] = {
          ...actualizados[indiceReal],
          valorCalculo: nuevoValor
        };
        return actualizados;
      }

      // Si el tipo de gasto existe, recalcular el importe
      if (tipoGasto) {
        // Parsear montoInicial correctamente (puede venir con formato de miles como "250.000")
        // parseNumberFromFormatted("250.000") -> "250000" -> parseFloat -> 250000
        const montoInicialStr = montoInicial || '0';
        const montoInicialParsed = parseNumberFromFormatted(montoInicialStr);
        const montoInicialNum = montoInicialParsed && montoInicialParsed !== ''
          ? parseFloat(montoInicialParsed)
          : 0;
        const duracionMesesNum = parseInt(String(duracionMeses || '0'), 10) || 0;
        const montoTotalContrato = montoInicialNum * duracionMesesNum;

        let nuevoImporte = 0;
        if (tipoGasto.esPorcentaje) {
          // Si es porcentaje (Sellado, Honorarios), calcular sobre el monto total del contrato
          // nuevoValor viene como string (ej: "5" para 5%), parsearlo a número y dividir por 100
          const porcentaje = nuevoValor !== '' && nuevoValor !== null && nuevoValor !== undefined
            ? parseFloat(String(nuevoValor))
            : 0;

          if (!isNaN(porcentaje) && porcentaje >= 0 && isFinite(porcentaje)) {
            // Dividir por 100 para convertir el porcentaje a decimal (7% = 0.07)
            // Ejemplo: montoTotalContrato = 6000000, porcentaje = 7
            // nuevoImporte = 6000000 * (7 / 100) = 6000000 * 0.07 = 420000
            const porcentajeDecimal = porcentaje / 100;
            const importeCalculado = montoTotalContrato * porcentajeDecimal;
            // Redondear a 2 decimales para evitar problemas de precisión de punto flotante
            nuevoImporte = Math.round(importeCalculado * 100) / 100;
          }
        } else {
          // Si NO es porcentaje (Depósito), multiplicar el valor ingresado por el monto inicial
          // Ejemplo: valor ingresado = 1, montoInicial = 250000
          // nuevoImporte = 250000 * 1 = 250000
          const cantidad = nuevoValor !== '' && nuevoValor !== null && nuevoValor !== undefined
            ? parseFloat(String(nuevoValor))
            : 0;

          if (!isNaN(cantidad) && cantidad >= 0 && isFinite(cantidad)) {
            nuevoImporte = montoInicialNum * cantidad;
          }
        }

        // Actualizar solo el gasto específico que se está editando
        // Asegurarse de que el importe no sea NaN o Infinity
        // Guardar como número sin decimales si es entero, o con 2 decimales si tiene decimales
        let importeFinal = '0';
        if (!isNaN(nuevoImporte) && isFinite(nuevoImporte) && nuevoImporte >= 0) {
          // Si es un número entero, guardarlo sin decimales
          if (Number.isInteger(nuevoImporte)) {
            importeFinal = nuevoImporte.toString();
          } else {
            // Si tiene decimales, guardarlo con 2 decimales
            importeFinal = nuevoImporte.toFixed(2);
          }
        }

        actualizados[indiceReal] = {
          ...actualizados[indiceReal],
          valorCalculo: nuevoValor,
          importe: importeFinal,
          importeEditado: true // Marcar como editado para evitar que el useEffect lo sobrescriba
        };
      } else {
        // Para otros gastos, solo actualizar el valorCalculo
        actualizados[indiceReal] = {
          ...actualizados[indiceReal],
          valorCalculo: nuevoValor
        };
      }

      return actualizados;
    });
  };

  const handleValorCalculoBlur = (gasto, index) => {
    // Solo actualizar el estado local, no guardar en BD
    // Los gastos se guardarán cuando se haga click en "Guardar" del contrato
    // Marcar como editado para que no se recalcule automáticamente
    setGastosEditables(prev => {
      const actualizados = [...prev];

      // Buscar el gasto en el array original por tipoGastoInicialId
      const indiceReal = actualizados.findIndex(g =>
        g && g.tipoGastoInicialId === gasto.tipoGastoInicialId
      );

      if (indiceReal !== -1 && actualizados[indiceReal]) {
        actualizados[indiceReal] = {
          ...actualizados[indiceReal],
          importeEditado: true
        };
      }
      return actualizados;
    });
  };


  // Obtener descripción del gasto desde el catálogo (solo por id; código es editable por el usuario)
  const getDescripcionGasto = (gasto) => {
    if (!tiposGastoActivos || !gasto.tipoGastoInicialId) return gasto.tipoGastoInicialCodigo || 'Sin nombre';
    const tipoGasto = tiposGastoActivos.find(
      (t) => Number(t.id) === Number(gasto.tipoGastoInicialId)
    );
    const nombre = tipoGasto?.nombre || gasto.tipoGastoInicialCodigo || 'Sin nombre';

    // Determinar el valor a mostrar entre paréntesis
    // SIEMPRE usar valorDefault del catálogo para mostrar, NO el valorCalculo del gasto
    let valorParentesis = '';
    if (tipoGasto) {
      const codigo = tipoGasto.codigo?.toLowerCase() || '';
      const nombreLower = tipoGasto.nombre?.toLowerCase() || '';
      const esDeposito = codigo.includes('deposito') || codigo.includes('depósito') ||
        nombreLower.includes('depósito') || nombreLower.includes('deposito');
      // Verificar si es sellado de contrato (no mostrar porcentaje)
      const esSellado = codigo.includes('sello') || codigo.includes('sellos') ||
        nombreLower.includes('sellado');

      // Para depósito, usar valorDefault del catálogo
      if (esDeposito && tipoGasto.valorDefault) {
        const valor = parseFloat(tipoGasto.valorDefault);
        if (!isNaN(valor)) {
          if (valor === 1) {
            valorParentesis = '(1 mes)';
          } else {
            valorParentesis = `(${valor} meses)`;
          }
        }
      } else if (tipoGasto.esPorcentaje && !esSellado && tipoGasto.valorDefault) {
        // Para porcentajes (excepto sellado), mostrar el valorDefault del catálogo
        const valor = parseFloat(tipoGasto.valorDefault);
        if (!isNaN(valor)) {
          valorParentesis = `(%${valor})`;
        }
      }
    }

    return valorParentesis ? `${nombre} ${valorParentesis}` : nombre;
  };

  return (
    <Box sx={{ position: 'relative', minHeight: 120 }}>
      {readonly && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            bgcolor: 'rgba(255,255,255,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 1,
            pointerEvents: 'auto',
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', px: 2 }}>
            No tiene permiso para modificar gastos iniciales.
          </Typography>
        </Box>
      )}
      <Box sx={{ ...(readonly && { pointerEvents: 'none', userSelect: 'none', opacity: 0.9 }) }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Gastos Iniciales</Typography>

        <FormControlLabel
          control={
            <Switch
              checked={gastosInicialesLiquidados || false}
              onChange={(e) => onGastosInicialesLiquidadosChange?.(e.target.checked)}
              color="primary"
              disabled={readonly}
            />
          }
          label={
            <Typography variant="body2" color="text.secondary">
              Ya fueron cobrados (contrato migrado)
            </Typography>
          }
          labelPlacement="start"
          sx={{ mr: 0 }}
        />
      </Box>

      {gastosInicialesLiquidados && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Los gastos iniciales de este contrato ya fueron cobrados fuera del sistema. No se generarán en las liquidaciones automáticas.
        </Alert>
      )}

      {(() => {
        const listaGastos = [...gastosEditables]
          .filter(gasto => {
            const tipoGasto = tiposGastoActivos?.find(
              (t) => Number(t.id) === Number(gasto.tipoGastoInicialId)
            );
            return tipoGasto !== undefined;
          })
          .sort((a, b) => (a.tipoGastoInicialId || 0) - (b.tipoGastoInicialId || 0));

        const renderFila = (gasto, index) => {
          const tipoGasto = tiposGastoActivos?.find(
            (t) => Number(t.id) === Number(gasto.tipoGastoInicialId)
          );
          if (!tipoGasto) return null;
          return (
            <React.Fragment key={`${gasto.tipoGastoInicialCodigo}-${gasto.id || index}`}>
              <TableCell sx={{ fontSize: '0.875rem' }}>{getDescripcionGasto(gasto)}</TableCell>
              <TableCell>
                <TextField
                  type="text"
                  size="small"
                  value={parseImporte(gasto.importe)}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^[\d.,]*$/.test(value)) {
                      handleImporteChange(index, value, gasto);
                    }
                  }}
                  onBlur={() => handleImporteBlur(gasto, index)}
                  disabled={readonly}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  sx={{
                    width: '100%',
                    maxWidth: 140,
                    '& .MuiInputBase-root': { height: '32px', fontSize: '0.8rem' }
                  }}
                  inputProps={{
                    style: { MozAppearance: 'textfield' },
                    onWheel: (e) => e.target.blur()
                  }}
                />
              </TableCell>
              <TableCell>
                <FormControl size="small" sx={{ width: '100%', maxWidth: 140 }} disabled={readonly}>
                  <Select
                    value={gasto.quienPagaId || ''}
                    onChange={(e) => handleQuienPagaChange(gasto, e.target.value)}
                    displayEmpty
                    disabled={readonly}
                    sx={{ height: '32px', fontSize: '0.8rem' }}
                  >
                    <MenuItem value=""><em>Seleccionar</em></MenuItem>
                    {actoresResponsablesContrato?.length > 0 ? (
                      actoresResponsablesContrato.map((actor) => (
                        <MenuItem key={actor.id} value={actor.id}>{actor.nombre || actor.codigo}</MenuItem>
                      ))
                    ) : (
                      <MenuItem value="" disabled>No hay actores</MenuItem>
                    )}
                  </Select>
                </FormControl>
              </TableCell>
            </React.Fragment>
          );
        };

        return (
          <>
            {/* Vista tabla (desktop) */}
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1 } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '40%', fontWeight: 'bold' }}>Concepto</TableCell>
                      <TableCell sx={{ width: '30%', fontWeight: 'bold' }}>Importe</TableCell>
                      <TableCell sx={{ width: '30%', fontWeight: 'bold' }}>Quién paga</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {listaGastos.length === 0 && tiposGastoActivos?.length > 0 ? null : (
                      listaGastos.map((gasto, index) => {
                        const tipoGasto = tiposGastoActivos?.find(
                          (t) => Number(t.id) === Number(gasto.tipoGastoInicialId)
                        );
                        if (!tipoGasto) return null;
                        return (
                          <TableRow key={`${gasto.tipoGastoInicialCodigo}-${gasto.id || index}`}>
                            {renderFila(gasto, index)}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Vista lista en cards (mobile) */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
              {listaGastos.length === 0 && tiposGastoActivos?.length > 0 ? null : (
                listaGastos.map((gasto, index) => {
                  const tipoGasto = tiposGastoActivos?.find(
                    (t) => Number(t.id) === Number(gasto.tipoGastoInicialId)
                  );
                  if (!tipoGasto) return null;
                  return (
                    <Card key={`${gasto.tipoGastoInicialCodigo}-${gasto.id || index}`} variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
                        {getDescripcionGasto(gasto)}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Importe</Typography>
                          <TextField
                            type="text"
                            size="small"
                            fullWidth
                            value={parseImporte(gasto.importe)}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || /^[\d.,]*$/.test(value)) {
                                handleImporteChange(index, value, gasto);
                              }
                            }}
                            onBlur={() => handleImporteBlur(gasto, index)}
                            disabled={readonly}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">$</InputAdornment>,
                            }}
                            sx={{ '& .MuiInputBase-root': { height: '36px' } }}
                            inputProps={{
                              style: { MozAppearance: 'textfield' },
                              onWheel: (e) => e.target.blur()
                            }}
                          />
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Quién paga</Typography>
                          <FormControl size="small" fullWidth disabled={readonly}>
                            <Select
                              value={gasto.quienPagaId || ''}
                              onChange={(e) => handleQuienPagaChange(gasto, e.target.value)}
                              displayEmpty
                              disabled={readonly}
                              sx={{ height: '36px' }}
                            >
                              <MenuItem value=""><em>Seleccionar</em></MenuItem>
                              {actoresResponsablesContrato?.length > 0 ? (
                                actoresResponsablesContrato.map((actor) => (
                                  <MenuItem key={actor.id} value={actor.id}>{actor.nombre || actor.codigo}</MenuItem>
                                ))
                              ) : (
                                <MenuItem value="" disabled>No hay actores</MenuItem>
                              )}
                            </Select>
                          </FormControl>
                        </Box>
                      </Box>
                    </Card>
                  );
                })
              )}
            </Box>
          </>
        );
      })()}

      </Box>
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
function ContratoDetalle({ contrato, onCloseView }) {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  // Obtener catálogos necesarios
  const { data: monedas } = useQuery({
    queryKey: ['monedas'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/monedas');
      return response.data;
    }
  });

  const { data: metodosAjusteContrato } = useQuery({
    queryKey: ['metodos-ajuste-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/metodos-ajuste-contrato');
      return response.data;
    }
  });

  const { data: estadosContrato } = useQuery({
    queryKey: ['estados-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/estados-contrato');
      return response.data;
    }
  });

  const { data: tiposGarantiaContrato } = useQuery({
    queryKey: ['tipos-garantia-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-garantia-contrato');
      return response.data;
    }
  });

  const { data: estadosGarantiaContrato } = useQuery({
    queryKey: ['estados-garantia-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/estados-garantia-contrato');
      return response.data;
    }
  });

  const { data: tiposGastoInicialContrato } = useQuery({
    queryKey: ['tipos-gasto-inicial-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-gasto-inicial-contrato');
      return response.data;
    }
  });

  const { data: actoresResponsablesContrato } = useQuery({
    queryKey: ['actores-responsable-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/actores-responsable-contrato');
      return response.data;
    }
  });

  // Funciones auxiliares para obtener nombres
  const getMonedaNombre = (monedaId) => {
    if (!monedaId || !monedas) return 'Sin moneda';
    const moneda = monedas.find(m => m.id === monedaId);
    return moneda?.nombre || moneda?.codigo || 'Sin moneda';
  };

  const getMetodoAjusteNombre = (metodoAjusteId) => {
    if (!metodoAjusteId || !metodosAjusteContrato) return 'Sin método';
    const metodo = metodosAjusteContrato.find(m => m.id === metodoAjusteId);
    return metodo?.nombre || metodo?.codigo || 'Sin método';
  };

  const getEstadoNombre = (estadoId) => {
    if (!estadoId || !estadosContrato) return 'Sin estado';
    const estado = estadosContrato.find(e => e.id === estadoId);
    return estado?.nombre || estado?.codigo || 'Sin estado';
  };

  const getTipoGarantiaNombre = (tipoGarantiaId) => {
    if (!tipoGarantiaId || !tiposGarantiaContrato) return 'Sin tipo';
    const tipo = tiposGarantiaContrato.find(t => t.id === tipoGarantiaId);
    return tipo?.nombre || tipo?.codigo || 'Sin tipo';
  };

  const getEstadoGarantiaNombre = (estadoGarantiaId) => {
    if (!estadoGarantiaId || !estadosGarantiaContrato) return 'Sin estado';
    const estado = estadosGarantiaContrato.find(e => e.id === estadoGarantiaId);
    return estado?.nombre || estado?.codigo || 'Sin estado';
  };

  const getTipoGastoNombre = (tipoGastoId) => {
    if (!tipoGastoId || !tiposGastoInicialContrato) return 'Sin tipo';
    const tipo = tiposGastoInicialContrato.find(t => t.id === tipoGastoId);
    return tipo?.nombre || tipo?.codigo || 'Sin tipo';
  };

  const getActorNombre = (actorId) => {
    if (!actorId || !actoresResponsablesContrato) return 'Sin actor';
    const actor = actoresResponsablesContrato.find(a => a.id === actorId);
    return actor?.nombre || actor?.codigo || 'Sin actor';
  };

  if (!contrato) {
    return null;
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
    return parseFechaLocal(fecha)?.format('DD/MM/YYYY') || '-';
  };

  const periodoAjuste = contrato.periodoAumento || contrato.frecuenciaAjusteMeses || null;

  // Obtener el último ajuste real del historial de ajustes (filtrar solo activos y ordenar por fecha)
  const ajustesActivos = (contrato.ajustes || []).filter((a) => a.activo !== false);
  const ultimoAjusteReal = ajustesActivos.length > 0
    ? ajustesActivos.sort((a, b) => dayjs(b.fechaAjuste).valueOf() - dayjs(a.fechaAjuste).valueOf())[0]
    : null;
  const fechaUltimoAjuste = ultimoAjusteReal?.fechaAjuste || null;

  // El próximo ajuste se calcula desde la fecha del último ajuste real, o desde el inicio del contrato si no hay ajustes
  const proximoAjuste = periodoAjuste
    ? dayjs(fechaUltimoAjuste || contrato.fechaInicio).add(periodoAjuste, 'month')
    : null;

  return (
    <Box sx={{ py: 1 }}>
      <Grid container spacing={2}>
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
                  <Typography variant="caption" color="text.secondary" display="block">Monto Inicial</Typography>
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
                  <Typography variant="body2">{getMonedaNombre(contrato.monedaId)}</Typography>
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
                    <Typography variant="body2">{getMetodoAjusteNombre(contrato.metodoAjusteContratoId)}</Typography>
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
                    {fechaUltimoAjuste ? formatoFecha(fechaUltimoAjuste) : 'Nunca'}
                  </Typography>
                </Grid>
                {proximoAjuste && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Próximo Ajuste estimado</Typography>
                    {(() => {
                      const hoy = dayjs().startOf('day');
                      const mismoMesAnio = proximoAjuste.month() === hoy.month() && proximoAjuste.year() === hoy.year();
                      const yaVencido = proximoAjuste.isBefore(hoy);
                      const alerta = mismoMesAnio || yaVencido;
                      return (
                        <Typography
                          variant="body2"
                          sx={{
                            color: alerta ? (yaVencido ? 'error.main' : 'warning.main') : 'text.primary',
                            fontWeight: alerta ? 600 : 400,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5
                          }}
                        >
                          {alerta && <WarningAmberIcon sx={{ fontSize: 16 }} />}
                          {formatoFecha(proximoAjuste)}
                        </Typography>
                      );
                    })()}
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
            {/* Card Propietario */}
            {hasPermission('propietarios.ver') && (
              <Card sx={{ flex: 1 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1 }}>
                    Propietario
                  </Typography>
                  {contrato.propiedad?.propietarios && contrato.propiedad.propietarios.length > 0 ? (
                    contrato.propiedad.propietarios.map((pp, idx) => {
                      const propietario = pp.propietario || pp;
                      const email = propietario.mail || propietario.email;
                      const telefono = propietario.telefono;
                      return (
                        <Box key={propietario.id || idx} sx={{ mb: idx < contrato.propiedad.propietarios.length - 1 ? 1.5 : 0 }}>
                          {hasPermission('propietarios.ver') ? (
                            <Link
                              component={RouterLink}
                              to={`/clientes?tab=1&tipo=propietario&id=${propietario.id}`}
                              state={{ returnTo: `${location.pathname}${location.search}${location.search ? '&' : '?'}view=${contrato.id}` }}
                              onClick={onCloseView}
                              sx={{ color: 'primary.main', fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                            >
                              {propietario.razonSocial || `${propietario.nombre || ''} ${propietario.apellido || ''}`.trim() || 'Sin nombre'}
                            </Link>
                          ) : (
                            <Typography variant="body2" fontWeight={600}>
                              {propietario.razonSocial || `${propietario.nombre || ''} ${propietario.apellido || ''}`.trim() || 'Sin nombre'}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary" component="div">
                            {propietario.dni && `DNI: ${propietario.dni}`}
                            {propietario.dni && propietario.cuit && ' • '}
                            {propietario.cuit && `CUIT: ${propietario.cuit}`}
                          </Typography>
                          {email && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <EmailOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Link
                                href={`mailto:${email}`}
                                underline="hover"
                                sx={{ fontSize: '0.75rem' }}
                              >
                                {email}
                              </Link>
                            </Box>
                          )}
                          {telefono && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                              <PhoneOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Link
                                href={`tel:${telefono.replace(/\s/g, '')}`}
                                underline="hover"
                                sx={{ fontSize: '0.75rem' }}
                              >
                                {telefono}
                              </Link>
                              <Tooltip title="Enviar WhatsApp">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    const numeroLimpio = telefono.replace(/\D/g, '');
                                    window.open(`https://wa.me/${numeroLimpio}`, '_blank');
                                  }}
                                  sx={{ p: 0.25 }}
                                >
                                  <WhatsAppIcon sx={{ fontSize: 14, color: 'success.main' }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                        </Box>
                      );
                    })
                  ) : (
                    <Typography variant="body2" color="text.secondary">Sin propietario</Typography>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Card Inquilino */}
            {hasPermission('inquilinos.ver') && (
              <Card sx={{ flex: 1 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1 }}>
                    Inquilino
                  </Typography>
                  {contrato.inquilino ? (
                    (() => {
                      const email = contrato.inquilino.mail || contrato.inquilino.email;
                      const telefono = contrato.inquilino.telefono;
                      return (
                        <>
                          {hasPermission('inquilinos.ver') ? (
                            <Link
                              component={RouterLink}
                              to={`/clientes?tab=1&tipo=inquilino&id=${contrato.inquilino.id}`}
                              state={{ returnTo: `${location.pathname}${location.search}${location.search ? '&' : '?'}view=${contrato.id}` }}
                              onClick={onCloseView}
                              sx={{ color: 'primary.main', fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                            >
                              {contrato.inquilino.razonSocial ||
                                `${contrato.inquilino.nombre || ''} ${contrato.inquilino.apellido || ''}`.trim() || 'Sin nombre'}
                            </Link>
                          ) : (
                            <Typography variant="body2" fontWeight={600}>
                              {contrato.inquilino.razonSocial ||
                                `${contrato.inquilino.nombre || ''} ${contrato.inquilino.apellido || ''}`.trim() || 'Sin nombre'}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary" component="div">
                            {contrato.inquilino.dni && `DNI: ${contrato.inquilino.dni}`}
                            {contrato.inquilino.dni && contrato.inquilino.cuit && ' • '}
                            {contrato.inquilino.cuit && `CUIT: ${contrato.inquilino.cuit}`}
                          </Typography>
                          {email && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <EmailOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Link
                                href={`mailto:${email}`}
                                underline="hover"
                                sx={{ fontSize: '0.75rem' }}
                              >
                                {email}
                              </Link>
                            </Box>
                          )}
                          {telefono && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                              <PhoneOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Link
                                href={`tel:${telefono.replace(/\s/g, '')}`}
                                underline="hover"
                                sx={{ fontSize: '0.75rem' }}
                              >
                                {telefono}
                              </Link>
                              <Tooltip title="Enviar WhatsApp">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    const numeroLimpio = telefono.replace(/\D/g, '');
                                    window.open(`https://wa.me/${numeroLimpio}`, '_blank');
                                  }}
                                  sx={{ p: 0.25 }}
                                >
                                  <WhatsAppIcon sx={{ fontSize: 14, color: 'success.main' }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <Typography variant="body2" color="text.secondary">Sin inquilino</Typography>
                  )}
                </CardContent>
              </Card>
            )}
          </Box>
        </Grid>

        {/* Responsabilidades, Garantías y Gastos en una fila */}
        {hasPermission('contrato.responsabilidades.ver') && (
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
                          <TableCell padding="none"><strong>Concepto</strong></TableCell>
                          <TableCell padding="none"><strong>Quién Paga</strong></TableCell>
                          <TableCell padding="none"><strong>Cobra a</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {contrato.responsabilidades
                          .filter((r) => {
                            // Filtrar registros huérfanos: si es cargo EXPENSAS debe tener tipoExpensa
                            const codigoCargo = r.tipoCargo?.codigo?.toUpperCase();
                            if (codigoCargo === 'EXPENSAS' && !r.tipoExpensa) {
                              return false;
                            }
                            return true;
                          })
                          .map((r) => {
                            let concepto = 'Sin tipo';
                            if (r.tipoImpuesto?.nombre || r.tipoImpuesto?.codigo) {
                              concepto = r.tipoImpuesto.nombre || r.tipoImpuesto.codigo;
                            } else if (r.tipoCargo?.nombre || r.tipoCargo?.codigo) {
                              const cargoNombre = r.tipoCargo.nombre || r.tipoCargo.codigo;
                              if (r.tipoExpensa) {
                                const expensaTipo = r.tipoExpensa.nombre || (r.tipoExpensa.codigo === 'ORD' ? 'Ordinarias' : r.tipoExpensa.codigo === 'EXT' ? 'Extraordinarias' : r.tipoExpensa.codigo);
                                concepto = `${cargoNombre} ${expensaTipo}`;
                              } else {
                                concepto = cargoNombre;
                              }
                            }
                            return (
                              <TableRow key={r.id}>
                                <TableCell padding="none">{concepto}</TableCell>
                                <TableCell padding="none">{r.quienPagaProveedor?.nombre || r.quienPagaProveedor?.codigo || '-'}</TableCell>
                                <TableCell padding="none">{r.quienSoportaCosto?.nombre || r.quienSoportaCosto?.codigo || '-'}</TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="caption" color="text.secondary">Sin responsabilidades</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {hasPermission('contrato.garantias.ver') && (
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
                            <TableCell padding="none">{getTipoGarantiaNombre(g.tipoGarantiaId)}</TableCell>
                            <TableCell padding="none">
                              <Chip
                                label={getEstadoGarantiaNombre(g.estadoGarantiaId)}
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
        )}

        {hasPermission('contrato.gastos_iniciales.ver') && (
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, flex: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
                  Gastos Iniciales
                </Typography>
                {(() => {
                  // Calcular el total de costos de averiguación de garantías
                  const totalCostoAveriguacionGarantias = (contrato.garantias || []).reduce(
                    (total, g) => total + (parseFloat(g.costoAveriguacion) || 0), 0
                  );

                  // Encontrar el tipo "Averiguación de garantías"
                  const tipoAveriguacion = tiposGastoInicialContrato?.find(t => {
                    const codigoLower = t.codigo?.toLowerCase() || '';
                    return codigoLower.includes('averig') || codigoLower === 'averiguacion' || codigoLower === 'averiguacion_garantias';
                  });

                  // Filtrar gastos: excluir los que tienen importe 0 o nulo
                  // Para "Averiguación de garantías", usar el total calculado de las garantías
                  const gastosConImporte = (contrato.gastosIniciales || [])
                    .map(g => {
                      // Si es averiguación de garantías, usar el total calculado
                      if (tipoAveriguacion && g.tipoGastoInicialId === tipoAveriguacion.id) {
                        return { ...g, importeCalculado: totalCostoAveriguacionGarantias };
                      }
                      return { ...g, importeCalculado: parseFloat(g.importe) || 0 };
                    })
                    .filter(g => g.importeCalculado > 0);

                  return gastosConImporte.length > 0 ? (
                    <TableContainer>
                      <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.75rem' } }}>
                        <TableHead>
                          <TableRow>
                            <TableCell padding="none"><strong>Tipo</strong></TableCell>
                            <TableCell padding="none" align="right"><strong>Importe</strong></TableCell>
                            <TableCell padding="none"><strong>Estado</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {gastosConImporte.map((g) => (
                            <TableRow key={g.id}>
                              <TableCell padding="none">{getTipoGastoNombre(g.tipoGastoInicialId)}</TableCell>
                              <TableCell padding="none" align="right">{formatoMoneda(g.importeCalculado)}</TableCell>
                              <TableCell padding="none">
                                {(() => {
                                  const liquidadoPorContrato = contrato.gastosInicialesLiquidados === true;
                                  const liquidadoPorItem = g.itemsLiquidacion && g.itemsLiquidacion.length > 0;
                                  const liquidado = liquidadoPorContrato || liquidadoPorItem;
                                  return (
                                    <Chip
                                      label={liquidado ? 'Liquidado' : 'No liquidado'}
                                      size="small"
                                      color={liquidado ? 'success' : 'default'}
                                      sx={{ height: '20px', fontSize: '0.7rem', fontWeight: 500 }}
                                    />
                                  );
                                })()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="caption" color="text.secondary">Sin gastos iniciales</Typography>
                  );
                })()}
              </CardContent>
            </Card>
          </Grid>
        )}

        {hasPermission('contrato.ajustes.ver') && (
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
                  Historial de Ajustes
                </Typography>
                {contrato.ajustes && contrato.ajustes.filter((a) => a.activo !== false).length > 0 ? (
                  <TableContainer>
                    <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.75rem' } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="none"><strong>Fecha</strong></TableCell>
                          <TableCell padding="none" align="right"><strong>Monto anterior</strong></TableCell>
                          <TableCell padding="none" align="right"><strong>Monto nuevo</strong></TableCell>
                          <TableCell padding="none" align="right"><strong>% Aumento</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {contrato.ajustes.filter((a) => a.activo !== false).map((ajuste) => (
                          <TableRow key={ajuste.id}>
                            <TableCell padding="none">{formatoFecha(ajuste.fechaAjuste)}</TableCell>
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
        )}
      </Grid>
    </Box>
  );
}
