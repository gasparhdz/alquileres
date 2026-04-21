import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
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
  TableSortLabel,
  TablePagination,
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
  Collapse,
  Tabs,
  Tab,
  Divider,
  Snackbar,
  Checkbox,
  InputAdornment,
  CircularProgress,
  Tooltip,
  Pagination,
  alpha,
  Stack
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HomeIcon from '@mui/icons-material/Home';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SearchIcon from '@mui/icons-material/Search';
import SendIcon from '@mui/icons-material/Send';
import PaymentIcon from '@mui/icons-material/Payment';
import PaidIcon from '@mui/icons-material/Paid';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PersonIcon from '@mui/icons-material/Person';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import api from '../api';
import { usePermissions } from '../contexts/AuthContext';
import ParametroSelect from '../components/ParametroSelect';
import ConfirmDialog from '../components/ConfirmDialog';
import RequirePermission from '../components/RequirePermission';
import { LiquidacionRow } from '../components/LiquidacionRow';
import { LiquidacionViewDialog } from '../components/liquidaciones/LiquidacionViewDialog';
import { LiquidacionEditDialog } from '../components/liquidaciones/LiquidacionEditDialog';
import CobrarLiquidacionDialog from '../components/liquidaciones/CobrarLiquidacionDialog';
import { RegistrarCobroModal } from '../components/liquidaciones/RegistrarCobroModal';
import { RegistrarPagoModal } from '../components/liquidaciones/RegistrarPagoModal';
import { useDebounce } from '../hooks/useDebounce';
import { useParametrosMap, getDescripcion, getAbreviatura } from '../utils/parametros';
import { generarBoletaPDF, generarLiquidacionPropietarioPDF } from '../utils/generarBoleta';
import dayjs from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// Función helper para formatear período de YYYY-MM a MM-AAAA
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

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

// Orden predefinido de items de liquidación
const ORDEN_ITEMS_LIQUIDACION = [
  // Gastos iniciales (van primero, en el orden especificado)
  'GASTO_INICIAL_DEPOSITO',
  'GASTO_INICIAL_SELLADO',
  'GASTO_INICIAL_AVERIGUACION',
  'GASTO_INICIAL_HONORARIOS',
  'GASTO_INICIAL_OTRO',
  // Items regulares
  'ALQUILER',
  'GASTOS_ADMINISTRATIVOS',
  'SEGURO',
  'TGI',
  'AGUA',
  'GAS',
  'API',
  'EXPENSAS',
  'LUZ'
];

// Función para obtener el código de un item (cargo o impuesto o gasto inicial)
const getItemCodigoForSort = (item) => {
  // Para gastos iniciales del contrato
  if (item.contratoGastoInicial?.tipoGastoInicial?.codigo) {
    return 'GASTO_INICIAL_' + item.contratoGastoInicial.tipoGastoInicial.codigo;
  }
  if (item.esGastoInicial && item.tipoGastoInicialCodigo) {
    return 'GASTO_INICIAL_' + item.tipoGastoInicialCodigo;
  }
  // Para items del API (con relaciones cargadas)
  if (item.propiedadImpuesto?.tipoImpuesto?.codigo) {
    return item.propiedadImpuesto.tipoImpuesto.codigo;
  }
  // Para items normalizados del formulario de edición
  if (item.tipoImpuestoCodigo) {
    return item.tipoImpuestoCodigo;
  }
  if (item.tipoCargo?.codigo) {
    return item.tipoCargo.codigo;
  }
  // Para items normalizados que tienen el nombre del impuesto
  if (item.esImpuesto && item.tipoImpuestoNombre) {
    // Tratar de mapear el nombre al código
    const nombreToCode = {
      'TGI': 'TGI',
      'Agua': 'AGUA',
      'Gas': 'GAS',
      'Api': 'API',
      'Luz': 'LUZ',
      'AGUA': 'AGUA',
      'GAS': 'GAS',
      'API': 'API',
      'LUZ': 'LUZ'
    };
    return nombreToCode[item.tipoImpuestoNombre] || item.tipoImpuestoNombre.toUpperCase();
  }
  if (item.tipoCargoCodigo) {
    return item.tipoCargoCodigo;
  }
  return '';
};

// Función para ordenar items de liquidación según el orden predefinido
const ordenarItemsLiquidacionFn = (items) => {
  return [...items].sort((a, b) => {
    const codigoA = getItemCodigoForSort(a);
    const codigoB = getItemCodigoForSort(b);
    const indexA = ORDEN_ITEMS_LIQUIDACION.indexOf(codigoA);
    const indexB = ORDEN_ITEMS_LIQUIDACION.indexOf(codigoB);
    // Si no está en la lista, ponerlo al final
    const posA = indexA === -1 ? 999 : indexA;
    const posB = indexB === -1 ? 999 : indexB;
    return posA - posB;
  });
};

// Total a cobrar al inquilino (misma lógica que backend: INQ cargo +, PROP+INQ pago -)
function totalInquilinoFromItems(items) {
  if (!items?.length) return 0;
  return items.reduce((sum, item) => {
    const imp = item.importe != null ? parseFloat(item.importe) : 0;
    if (isNaN(imp) || imp === 0) return sum;
    const soporta = item.quienSoportaCosto?.codigo;
    const pagado = item.pagadoPorActor?.codigo;
    if (soporta === 'INQ') return sum + Math.abs(imp);
    if (soporta === 'PROP' && pagado === 'INQ') return sum - Math.abs(imp);
    return sum;
  }, 0);
}

export default function Liquidaciones() {
  const { hasPermission } = usePermissions();
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedLiquidacion, setSelectedLiquidacion] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [confirmarEmitir, setConfirmarEmitir] = useState(false);
  const [liquidacionAEliminar, setLiquidacionAEliminar] = useState(null);

  // Estado para modal de cobro/pago
  const [cobroModal, setCobroModal] = useState({ open: false, liquidacion: null, contrato: null });
  const [pagoModal, setPagoModal] = useState({ open: false, liquidacion: null, contrato: null });
  // Modal "Marcar como Pagada" (registra cobro y pasa liquidación a estado Cobrada)
  const [cobrarLiquidacionModal, setCobrarLiquidacionModal] = useState({ open: false, liquidacion: null });

  // Estados para filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState(dayjs().format('YYYY-MM'));
  const [filtroEstado, setFiltroEstado] = useState('todas');

  // Estados para ordenamiento
  const [orderBy, setOrderBy] = useState('periodo');
  const [order, setOrder] = useState('desc');

  // Estados para paginación (índice 0-based en UI; backend recibe page 1-based)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const debouncedSearch = useDebounce(busqueda, 400);

  // Estados para selección masiva
  const [selectedIds, setSelectedIds] = useState([]);
  // Expandir card en vista mobile (una a la vez)
  const [expandedMobileId, setExpandedMobileId] = useState(null);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Abrir modal de detalle si la URL tiene ?id= (ej. desde Dashboard "Ver detalle")
  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl) {
      const id = idFromUrl.trim();
      if (id) {
        setSelectedLiquidacion(id);
        setViewOpen(true);
      }
    }
  }, [searchParams]);

  // Mapas de parámetros para mostrar descripciones
  const estadoLiquidacionMap = useParametrosMap('estado_liquidacion');
  const tipoCargoMap = useParametrosMap('tipo_cargo');
  const tipoImpuestoMap = useParametrosMap('tipo_impuesto');
  const quienPagaMap = useParametrosMap('quien_paga');

  // IDs de estados y tipos de cargo (comparar por id; código es editable por el usuario)
  const estadoBorradorId = estadoLiquidacionMap?.lista?.find((p) => p.codigo === 'BORRADOR')?.id;
  const estadoListaId = estadoLiquidacionMap?.lista?.find((p) => p.codigo === 'LISTA')?.id;
  const estadoEmitidaId = estadoLiquidacionMap?.lista?.find((p) => p.codigo === 'EMITIDA')?.id;
  const estadoPagadaId = estadoLiquidacionMap?.lista?.find((p) => p.codigo === 'SALDADA')?.id;
  const tipoCargoExpensasId = tipoCargoMap?.lista?.find((p) => p.codigo === 'EXPENSAS')?.id;
  const tipoCargoGastosInicialesId = tipoCargoMap?.lista?.find((p) => p.codigo === 'GASTOS_INICIALES')?.id;
  const tipoCargoAlquilerId = tipoCargoMap?.lista?.find((p) => p.codigo === 'ALQUILER')?.id;

  // Función para obtener el color del Chip según el estado
  const getEstadoChipColor = (estadoId) => {
    if (estadoId === estadoBorradorId) return 'default';
    if (estadoId === estadoListaId) return 'info';
    if (estadoId === estadoEmitidaId) return 'primary';
    if (estadoId === estadoPagadaId) return 'success';
    return 'default';
  };

  // Cargar actores para calcular totales
  const { data: actoresGlobal = [] } = useQuery({
    queryKey: ['actores-responsable-contrato-global'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/actores-responsable-contrato');
      return response.data ?? [];
    }
  });

  // Función para calcular totales separados (Inquilino y Propietario)
  // Total Inquilino = suma de items que soporta el inquilino - créditos (lo que pagó el inquilino por el propietario)
  // Total Propietario = Alquiler - Honorarios - Gastos que soporta el propietario (neto a pagar)
  const calcularTotales = (liquidacion) => {
    let totalInquilino = 0;
    let alquilerBruto = 0;
    let deduccionesPropietario = 0; // Gastos que soporta el propietario (sin honorarios)

    if (!liquidacion.items || liquidacion.items.length === 0) {
      return { totalInquilino: liquidacion.total || 0, totalPropietario: 0 };
    }

    liquidacion.items.forEach(item => {
      const importe = parseFloat(item.importe || 0);
      const quienSoportaCostoId = item.quienSoportaCostoId ?? item.quienSoportaCosto?.id;
      const pagadoPorActorId = item.pagadoPorActorId ?? item.pagadoPorActor?.id;
      const tipoCargoCodigo = item.tipoCargo?.codigo || item.tipoCargoCodigo;

      const actorResponsable = actoresGlobal.find(a => a.id === quienSoportaCostoId);
      const actorPagador = actoresGlobal.find(a => a.id === pagadoPorActorId);

      const codigoResponsable = actorResponsable?.codigo || item.quienSoportaCosto?.codigo;
      const codigoPagadoPor = actorPagador?.codigo || item.pagadoPorActor?.codigo;

      const esInquilinoResponsable = codigoResponsable === 'INQ';
      const esPropietarioResponsable = codigoResponsable === 'PROP';
      const inquilinoPagoPorPropietario = codigoPagadoPor === 'INQ' && esPropietarioResponsable;
      const esAlquiler = tipoCargoCodigo === 'ALQUILER';
      const esHonorarios = tipoCargoCodigo === 'HONORARIOS';

      // Calcular total inquilino
      if (esInquilinoResponsable) {
        totalInquilino += importe;
      } else if (inquilinoPagoPorPropietario) {
        // Inquilino pagó algo que soporta el propietario = crédito para inquilino
        totalInquilino -= importe;
      }

      // Calcular neto propietario
      if (esAlquiler) {
        alquilerBruto += importe;
      } else if (esPropietarioResponsable && !esHonorarios) {
        // Gastos que soporta el propietario (se deducen del alquiler), excepto honorarios que se calculan aparte
        deduccionesPropietario += importe;
      }
    });

    // Calcular honorarios como porcentaje del alquiler
    const porcentajeHonorarios = liquidacion.contrato?.honorariosPropietario
      ? parseFloat(liquidacion.contrato.honorariosPropietario)
      : 0;
    const honorariosInmob = alquilerBruto * (porcentajeHonorarios / 100);

    // El neto del propietario es el alquiler menos honorarios menos otras deducciones
    const totalPropietario = alquilerBruto - honorariosInmob - deduccionesPropietario;

    return { totalInquilino, totalPropietario };
  };

  const estadoIdForApi =
    filtroEstado === 'borrador' ? estadoBorradorId :
      filtroEstado === 'lista' ? estadoListaId :
        filtroEstado === 'emitida' ? estadoEmitidaId :
          filtroEstado === 'pagada' ? estadoPagadaId : null;

  const { data, isLoading, refetch } = useQuery({
    queryKey: [
      'liquidaciones',
      page + 1,
      rowsPerPage,
      debouncedSearch,
      filtroPeriodo,
      filtroEstado,
      estadoIdForApi,
      orderBy,
      order
    ],
    queryFn: async () => {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        sortBy: orderBy,
        sortOrder: order
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (filtroPeriodo) params.periodo = filtroPeriodo;
      if (estadoIdForApi != null) params.estado = estadoIdForApi;
      const response = await api.get('/liquidaciones', { params });
      return response.data;
    }
  });

  const liquidacionesPagina = data?.data ?? [];
  const meta = data?.meta ?? data?.pagination ?? { total: 0, totalPages: 0 };

  const { data: liquidacionDetalle, isLoading: isLoadingDetalle } = useQuery({
    queryKey: ['liquidacion', selectedLiquidacion],
    queryFn: async () => {
      if (!selectedLiquidacion) return null;
      const response = await api.get(`/liquidaciones/${selectedLiquidacion}`);
      return response.data;
    },
    enabled: !!selectedLiquidacion
  });

  const emitirMutation = useMutation({
    mutationFn: (id) => api.put(`/liquidaciones/${id}/emitir`),
    onSuccess: () => {
      setConfirmarEmitir(false);
      queryClient.invalidateQueries(['liquidaciones']);
      queryClient.invalidateQueries(['liquidacion', selectedLiquidacion]);
      setSuccessMessage('Liquidación emitida exitosamente');
      setSnackbarOpen(true);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/liquidaciones/${id}`),
    onSuccess: () => {
      setLiquidacionAEliminar(null);
      queryClient.invalidateQueries(['liquidaciones']);
      setSuccessMessage('Liquidación eliminada exitosamente');
      setSnackbarOpen(true);
    }
  });

  const { data: mediosPago = [] } = useQuery({
    queryKey: ['medios-pago'],
    queryFn: () => api.get('/medios-pago').then((r) => r.data),
    enabled: cobrarLiquidacionModal.open
  });

  const cobrarLiquidacionMutation = useMutation({
    mutationFn: ({ id, medioPagoId, nroComprobante }) =>
      api.post(`/liquidaciones/${id}/cobrar`, { medioPagoId: medioPagoId || undefined, nroComprobante: nroComprobante || undefined }),
    onSuccess: () => {
      setCobrarLiquidacionModal({ open: false, liquidacion: null });
      queryClient.invalidateQueries(['liquidaciones']);
      setSuccessMessage('Cobro registrado. La liquidación pasó a estado Cobrada.');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (err) => {
      setSuccessMessage(err.response?.data?.error || 'Error al registrar cobro');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  // Handlers de ordenamiento (el backend ordena por sortBy/sortOrder; aquí solo actualizamos estado para el próximo request)
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filtroPeriodo, filtroEstado]);

  // Handlers de paginación (cambian estado y provocan nuevo request vía queryKey)
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Reset page cuando cambian los filtros
  useEffect(() => {
    setPage(0);
  }, [busqueda, filtroPeriodo, filtroEstado]);

  // Liquidaciones que pueden ser seleccionadas (Borrador o Lista para Emitir)
  const liquidacionesSeleccionables = liquidacionesPagina.filter(
    liq => liq.estado?.id === estadoListaId || liq.estado?.id === estadoBorradorId
  );
  const todosSeleccionados = liquidacionesSeleccionables.length > 0 &&
    liquidacionesSeleccionables.every(liq => selectedIds.includes(liq.id));
  const algunosSeleccionados = selectedIds.length > 0 && !todosSeleccionados;

  // Obtener las liquidaciones seleccionadas y sus estados
  const liquidacionesSeleccionadasData = liquidacionesPagina.filter(liq => selectedIds.includes(liq.id));
  const seleccionadasBorrador = liquidacionesSeleccionadasData.filter(liq => liq.estado?.id === estadoBorradorId);
  const seleccionadasLista = liquidacionesSeleccionadasData.filter(liq => liq.estado?.id === estadoListaId);

  // Determinar el tipo de acción masiva disponible
  const todasSonBorrador = selectedIds.length > 0 && seleccionadasBorrador.length === selectedIds.length;
  const todasSonLista = selectedIds.length > 0 && seleccionadasLista.length === selectedIds.length;
  const seleccionMixta = selectedIds.length > 0 && !todasSonBorrador && !todasSonLista;

  // Handlers de selección
  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedIds(liquidacionesSeleccionables.map(liq => liq.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Estado de loading para acciones masivas
  const [accionMasivaLoading, setAccionMasivaLoading] = useState(false);

  // Marcar una sola liquidación como "Lista para Emitir" (desde el modal de detalle)
  const handleMarcarComoLista = async (liquidacionOrId) => {
    const id = typeof liquidacionOrId === 'object' ? liquidacionOrId?.id : liquidacionOrId;
    if (!id) return;
    try {
      await api.put(`/liquidaciones/${id}`, { estadoLiquidacionId: estadoListaId });
      queryClient.invalidateQueries(['liquidaciones']);
      queryClient.invalidateQueries(['liquidacion', id]);
      setSuccessMessage('Liquidación marcada como Lista para Emitir');
      setSnackbarOpen(true);
    } catch (error) {
      const msg = error.response?.data?.error || error.message || 'Error al actualizar';
      setSuccessMessage(msg);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // Marcar borradores como "Lista para Emitir"
  const handleMarcarComoListas = async () => {
    if (seleccionadasBorrador.length === 0) return;

    setAccionMasivaLoading(true);
    let exitosos = 0;
    const mensajesError = [];

    for (const liq of seleccionadasBorrador) {
      try {
        const res = await api.request({
          method: 'put',
          url: `/liquidaciones/${liq.id}`,
          data: { estadoLiquidacionId: estadoListaId },
          validateStatus: () => true
        });
        if (res.status >= 200 && res.status < 300) {
          exitosos++;
        } else {
          const detalle = res.data?.detalles || res.data?.error || `Error ${res.status}`;
          mensajesError.push({ detalle, id: liq.id });
        }
      } catch (error) {
        const detalle = error.response?.data?.detalles || error.response?.data?.error || error.message;
        mensajesError.push({ detalle, id: liq.id });
        console.error(`Error al actualizar liquidación ${liq.id}:`, error);
      }
    }

    setAccionMasivaLoading(false);
    setSelectedIds([]);
    queryClient.invalidateQueries(['liquidaciones']);

    if (mensajesError.length === 0) {
      setSuccessMessage(`${exitosos} liquidación(es) marcada(s) como Lista para Emitir`);
      setSnackbarSeverity('success');
    } else {
      const textoUnico = mensajesError[0]?.detalle?.includes('Falta cargar el importe')
        ? mensajesError[0].detalle
        : mensajesError.map((m) => m.detalle).join('. ');
      setSuccessMessage(
        exitosos > 0
          ? `${exitosos} actualizada(s). ${textoUnico}`
          : textoUnico
      );
      setSnackbarSeverity('warning');
    }
    setSnackbarOpen(true);
  };

  // Emitir masivo (solo para "Lista para Emitir")
  const handleEmitirMasivo = async () => {
    if (seleccionadasLista.length === 0) return;

    setAccionMasivaLoading(true);
    let exitosos = 0;
    let errores = 0;

    for (const liq of seleccionadasLista) {
      try {
        await api.put(`/liquidaciones/${liq.id}/emitir`);
        exitosos++;
      } catch (error) {
        console.error(`Error al emitir liquidación ${liq.id}:`, error);
        errores++;
      }
    }

    setAccionMasivaLoading(false);
    setSelectedIds([]);
    queryClient.invalidateQueries(['liquidaciones']);

    if (errores === 0) {
      setSuccessMessage(`${exitosos} liquidación(es) emitida(s) exitosamente`);
      setSnackbarSeverity('success');
    } else {
      setSuccessMessage(`${exitosos} emitida(s), ${errores} con error`);
      setSnackbarSeverity('warning');
    }
    setSnackbarOpen(true);
  };

  const handleEmitir = () => {
    setConfirmarEmitir(true);
  };

  const handleEmitirBoleta = async (liquidacion) => {
    try {
      let liquidacionPropietarioData = null;

      // Si la liquidación está en estado "Lista para emitir", primero emitirla
      if (liquidacion?.estado?.codigo === 'LISTA') {
        const emitirResponse = await api.put(`/liquidaciones/${liquidacion.id}/emitir`);
        liquidacionPropietarioData = emitirResponse.data?.liquidacionPropietario;

        // Refrescar los datos
        queryClient.invalidateQueries(['liquidaciones']);
        queryClient.invalidateQueries(['liquidacion', liquidacion.id]);
        setSuccessMessage('Liquidación emitida correctamente');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
      }

      // Obtener la liquidación completa con todos los datos para el PDF
      const response = await api.get(`/liquidaciones/${liquidacion.id}`);
      const liquidacionCompleta = response.data;

      // Verificar si hay inquilino (contrato vigente)
      const tieneInquilino = liquidacionCompleta.contrato?.inquilino;

      // Solo generar PDF de boleta al inquilino si hay contrato con inquilino
      if (tieneInquilino) {
        await generarBoletaPDF(liquidacionCompleta);
      }

      // Generar el PDF de la liquidación al propietario SIEMPRE
      // Intentar obtener datos adicionales de liquidación propietario si hay contrato
      if (liquidacionCompleta.contratoId && !liquidacionPropietarioData) {
        try {
          const lpResponse = await api.get(`/contratos/${liquidacionCompleta.contratoId}/liquidaciones-propietario`);
          const liquidacionesProp = lpResponse.data || [];
          liquidacionPropietarioData = liquidacionesProp.find(lp => lp.periodo === liquidacionCompleta.periodo);
        } catch (e) {
          console.warn('No se pudo obtener liquidación propietario:', e);
        }
      }

      // Generar PDF de liquidación propietario (siempre)
      try {
        await generarLiquidacionPropietarioPDF(liquidacionCompleta, liquidacionPropietarioData);
      } catch (pdfError) {
        console.error('Error al generar PDF de liquidación propietario:', pdfError);
      }
    } catch (error) {
      console.error('Error al emitir boleta:', error);
      setSuccessMessage(`Error: ${error.response?.data?.error || error.message}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleDownloadPDF = async (id) => {
    try {
      // Obtener los datos completos de la liquidación
      const response = await api.get(`/liquidaciones/${id}`);
      const liquidacion = response.data;

      // Verificar si hay inquilino (contrato vigente)
      const tieneInquilino = liquidacion.contrato?.inquilino;

      // Solo generar PDF de boleta al inquilino si hay contrato con inquilino
      if (tieneInquilino) {
        await generarBoletaPDF(liquidacion);
      }

      // Generar el PDF de la liquidación al propietario SIEMPRE
      let liquidacionPropietarioData = null;
      if (liquidacion.contratoId) {
        try {
          const lpResponse = await api.get(`/contratos/${liquidacion.contratoId}/liquidaciones-propietario`);
          const liquidacionesProp = lpResponse.data || [];
          liquidacionPropietarioData = liquidacionesProp.find(lp => lp.periodo === liquidacion.periodo);
        } catch (e) {
          console.warn('No se pudo obtener liquidación propietario:', e);
        }
      }

      // Generar PDF de liquidación propietario (siempre)
      await generarLiquidacionPropietarioPDF(liquidacion, liquidacionPropietarioData);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      setSuccessMessage(`Error al generar PDF: ${error.message}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // Función para generar solo la boleta del inquilino
  const generarBoletaInquilinoPDF = async (id) => {
    try {
      const response = await api.get(`/liquidaciones/${id}`);
      const liquidacion = response.data;

      if (liquidacion.contrato?.inquilino) {
        await generarBoletaPDF(liquidacion);
      } else {
        setSuccessMessage('Esta liquidación no tiene inquilino asociado');
        setSnackbarSeverity('warning');
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('Error al generar boleta PDF:', error);
      setSuccessMessage(`Error al generar PDF: ${error.message}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // Función para generar solo la liquidación del propietario
  const generarLiquidacionPropietarioPDFHandler = async (id) => {
    try {
      const response = await api.get(`/liquidaciones/${id}`);
      const liquidacion = response.data;

      let liquidacionPropietarioData = null;
      if (liquidacion.contratoId) {
        try {
          const lpResponse = await api.get(`/contratos/${liquidacion.contratoId}/liquidaciones-propietario`);
          const liquidacionesProp = lpResponse.data || [];
          liquidacionPropietarioData = liquidacionesProp.find(lp => lp.periodo === liquidacion.periodo);
        } catch (e) {
          console.warn('No se pudo obtener liquidación propietario:', e);
        }
      }

      await generarLiquidacionPropietarioPDF(liquidacion, liquidacionPropietarioData);
    } catch (error) {
      console.error('Error al generar liquidación PDF:', error);
      setSuccessMessage(`Error al generar PDF: ${error.message}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleView = (liquidacionId) => {
    setSelectedLiquidacion(liquidacionId);
    setViewOpen(true);
  };

  // Función para abrir modal de cobro/pago desde una liquidación
  // tipo puede ser 'inquilino', 'propietario', o undefined (auto-detectar)
  const handlePagoLiquidacion = async (liquidacionId, tipo) => {
    try {
      const response = await api.get(`/liquidaciones/${liquidacionId}`);
      const liquidacion = response.data;

      const items = liquidacion.items || [];
      const { totalInquilino, totalPropietario } = calcularTotales(liquidacion);

      // Si se especifica tipo, usar ese; si no, auto-detectar
      const abrirInquilino = tipo === 'inquilino' || (!tipo && liquidacion.contrato);
      const abrirPropietario = tipo === 'propietario' || (!tipo && !liquidacion.contrato);

      if (abrirInquilino && liquidacion.contrato) {
        const contratoParaModal = {
          ...liquidacion.contrato,
          saldoDeudor: totalInquilino,
          propiedad: liquidacion.propiedad || liquidacion.contrato.propiedad
        };

        setCobroModal({
          open: true,
          liquidacion: liquidacion,
          contrato: contratoParaModal,
          importePreset: totalInquilino,
          conceptoPreset: `Cobro Liquidación ${formatPeriodo(liquidacion.periodo)}`
        });
      } else if (abrirPropietario) {
        const propiedad = liquidacion.propiedad || liquidacion.contrato?.propiedad;
        const propietarioRelacion = propiedad?.propietarios?.[0];
        const propietario = propietarioRelacion?.propietario;

        const contratoParaModal = {
          tipo: 'propiedad',
          propiedadId: propiedad?.id,
          saldoAPagar: totalPropietario,
          propiedad: propiedad,
          propietario: propietario
        };

        setPagoModal({
          open: true,
          liquidacion: liquidacion,
          contrato: contratoParaModal,
          importePreset: totalPropietario,
          conceptoPreset: `Pago Liquidación ${formatPeriodo(liquidacion.periodo)}`
        });
      }
    } catch (error) {
      console.error('Error al preparar cobro/pago:', error);
      setSuccessMessage(`Error: ${error.message}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleEdit = (liquidacionId) => {
    setSelectedLiquidacion(liquidacionId);
    setEditOpen(true);
  };

  const handleMarcarComoPagada = async (liquidacion) => {
    const contratoId = liquidacion.contratoId ?? liquidacion.contrato?.id;
    if (!contratoId || !liquidacion.contrato) {
      setSuccessMessage('No hay contrato asociado a esta liquidación');
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
      return;
    }
    try {
      const saldoRes = await api.get(`/contratos/${contratoId}/cuenta-inquilino/saldo`);
      const saldo = saldoRes.data?.saldo ?? 0;
      const { totalInquilino } = calcularTotales(liquidacion);
      const contratoParaModal = {
        ...liquidacion.contrato,
        saldoDeudor: saldo,
        propiedad: liquidacion.propiedad || liquidacion.contrato?.propiedad
      };
      setCobroModal({
        open: true,
        liquidacion,
        contrato: contratoParaModal,
        importePreset: totalInquilino,
        conceptoPreset: `Cobro Liquidación ${formatPeriodo(liquidacion.periodo)}`
      });
    } catch (error) {
      console.error('Error al obtener saldo:', error);
      setSuccessMessage('No se pudo cargar el saldo de la cuenta');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // Función para enviar liquidación por WhatsApp
  // tipo: 'inquilino' o 'propietario'
  const handleWhatsAppClick = (liquidacion, tipo = 'inquilino') => {
    const propiedad = liquidacion.propiedad;
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Período formateado (ej: "Marzo 2026")
    let periodoFormateado = liquidacion.periodo || '';
    if (/^\d{4}-\d{2}$/.test(periodoFormateado)) {
      const [year, month] = periodoFormateado.split('-');
      periodoFormateado = `${meses[parseInt(month, 10) - 1]} ${year}`;
    }

    // Dirección de la propiedad
    const direccion = propiedad ?
      [propiedad.dirCalle, propiedad.dirNro, propiedad.dirPiso ? `${propiedad.dirPiso}°` : null, propiedad.dirDepto ? `"${propiedad.dirDepto}"` : null]
        .filter(Boolean).join(' ') : '';

    let nombre, telefono, total, mensaje;

    if (tipo === 'inquilino') {
      const inquilino = liquidacion.contrato?.inquilino;
      nombre = inquilino?.razonSocial ||
        `${inquilino?.nombre || ''} ${inquilino?.apellido || ''}`.trim() ||
        'Estimado/a';
      telefono = inquilino?.telefono || '';

      // Calcular total inquilino
      const totalInquilino = liquidacion.items?.reduce((sum, item) => {
        const quienPaga = item.quienPaga?.codigo;
        if (quienPaga === 'INQ' || quienPaga === 'INQUILINO') {
          return sum + parseFloat(item.importe || 0);
        }
        return sum;
      }, 0) || liquidacion.total || 0;

      total = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalInquilino);
      mensaje = `Hola ${nombre}! Te enviamos el resumen de la liquidación de *${periodoFormateado}* correspondiente a *${direccion}*. El total a abonar es de *${total}*. Por cualquier consulta estamos a disposición. Saludos!`;
    } else {
      // Propietario
      const propietarioData = propiedad?.propietarios?.[0]?.propietario || liquidacion.contrato?.propiedad?.propietarios?.[0]?.propietario;
      nombre = propietarioData?.razonSocial ||
        `${propietarioData?.nombre || ''} ${propietarioData?.apellido || ''}`.trim() ||
        'Estimado/a';
      telefono = propietarioData?.telefono || '';

      // Calcular total propietario
      const itemAlquiler = liquidacion.items?.find(item => item.tipoCargo?.codigo === 'ALQUILER');
      const alquilerBruto = itemAlquiler ? parseFloat(itemAlquiler.importe || 0) : 0;
      const porcentajeHonorarios = liquidacion.contrato?.honorariosPropietario ? parseFloat(liquidacion.contrato.honorariosPropietario) : 0;
      const honorariosInmob = alquilerBruto * (porcentajeHonorarios / 100);
      const gastosPropietario = liquidacion.items?.reduce((sum, item) => {
        const quienSoporta = item.quienSoportaCosto?.codigo;
        if ((quienSoporta === 'PROP' || quienSoporta === 'PROPIETARIO') && item.tipoCargo?.codigo !== 'ALQUILER') {
          return sum + parseFloat(item.importe || 0);
        }
        return sum;
      }, 0) || 0;
      const totalPropietario = alquilerBruto - honorariosInmob - gastosPropietario;

      total = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalPropietario);
      mensaje = `Hola ${nombre}! Te enviamos la liquidación de *${periodoFormateado}* correspondiente a *${direccion}*. El neto a percibir es de *${total}*. Por cualquier consulta estamos a disposición. Saludos!`;
    }

    // Codificar mensaje para URL
    const textoCodificado = encodeURIComponent(mensaje);

    // Limpiar número de teléfono (quitar espacios, guiones, paréntesis)
    telefono = telefono.replace(/[\s\-\(\)\.]/g, '');

    // Si el teléfono no empieza con +, agregar código de Argentina
    if (telefono && !telefono.startsWith('+')) {
      if (telefono.startsWith('0')) {
        telefono = telefono.substring(1);
      }
      telefono = `54${telefono}`;
    } else if (telefono.startsWith('+')) {
      telefono = telefono.substring(1);
    }

    // Construir URL de WhatsApp
    let url;
    if (telefono) {
      url = `https://api.whatsapp.com/send?phone=${telefono}&text=${textoCodificado}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${textoCodificado}`;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Box>
      <ConfirmDialog
        open={confirmarEmitir}
        onClose={() => setConfirmarEmitir(false)}
        title="Emitir liquidación"
        message="¿Está seguro de emitir esta liquidación? Una vez emitida no se podrá modificar."
        confirmLabel="Emitir"
        confirmColor="primary"
        loading={emitirMutation.isPending}
        onConfirm={() => {
          if (selectedLiquidacion) emitirMutation.mutate(selectedLiquidacion);
        }}
      />
      <ConfirmDialog
        open={!!liquidacionAEliminar}
        onClose={() => setLiquidacionAEliminar(null)}
        title="Eliminar liquidación"
        message="¿Está seguro de eliminar esta liquidación?"
        confirmLabel="Eliminar"
        confirmColor="error"
        loading={deleteMutation.isPending}
        onConfirm={() => liquidacionAEliminar && deleteMutation.mutate(liquidacionAEliminar.id)}
      />
      {/* Header */}
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
        Liquidaciones
      </Typography>

      {/* Filtros y Acciones - Responsive */}
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
          {/* Búsqueda */}
          <TextField
            placeholder="Buscar por Inquilino o Propiedad..."
            size="small"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            sx={{ width: { xs: '100%', sm: 280 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />

          {/* Filtro por Período */}
          <DatePicker
            label="Período"
            views={['month', 'year']}
            openTo="month"
            value={filtroPeriodo ? dayjs(filtroPeriodo) : null}
            onChange={(newValue) => {
              if (newValue) {
                setFiltroPeriodo(newValue.format('YYYY-MM'));
              } else {
                setFiltroPeriodo('');
              }
            }}
            format="MMMM YYYY"
            slotProps={{
              textField: {
                size: 'small',
                sx: { width: { xs: '100%', sm: 180 } }
              },
              actionBar: {
                actions: ['clear', 'today']
              }
            }}
          />

          {/* Filtro por Estado */}
          <FormControl size="small" sx={{ width: { xs: '100%', sm: 180 } }}>
            <InputLabel>Estado</InputLabel>
            <Select
              value={filtroEstado}
              label="Estado"
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <MenuItem value="todas">Todas</MenuItem>
              <MenuItem value="borrador">Borrador</MenuItem>
              <MenuItem value="lista">Lista para Emitir</MenuItem>
              <MenuItem value="emitida">Emitida</MenuItem>
              <MenuItem value="pagada">Cobrada</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Botón Dinámico basado en selección */}
        {selectedIds.length === 0 ? (
          hasPermission('liquidaciones.editar') ? (
            <Button variant="contained" disabled sx={{ height: 36, width: { xs: '100%', md: 'auto' } }}>
              Seleccionar Liquidaciones
            </Button>
          ) : null
        ) : todasSonBorrador ? (
          <RequirePermission codigo="liquidaciones.editar">
            <Button
              variant="contained"
              color="info"
              startIcon={accionMasivaLoading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
              onClick={handleMarcarComoListas}
              disabled={accionMasivaLoading}
              sx={{ height: 36, width: { xs: '100%', md: 'auto' } }}
            >
              {accionMasivaLoading ? 'Procesando...' : `Marcar (${selectedIds.length}) como Listas`}
            </Button>
          </RequirePermission>
        ) : todasSonLista ? (
          <RequirePermission codigo="liquidaciones.editar">
            <Button
              variant="contained"
              color="success"
              startIcon={accionMasivaLoading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
              onClick={handleEmitirMasivo}
              disabled={accionMasivaLoading}
              sx={{ height: 36, width: { xs: '100%', md: 'auto' } }}
            >
              {accionMasivaLoading ? 'Emitiendo...' : `Emitir Boletas (${selectedIds.length})`}
            </Button>
          </RequirePermission>
        ) : (
          <Button variant="contained" disabled sx={{ height: 36, width: { xs: '100%', md: 'auto' } }}>
            Seleccionar unificadas
          </Button>
        )}
      </Box>

      {/* Vista de tabla para desktop con filas colapsables */}
      <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table size="small" sx={{
          '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.875rem' },
          '& .MuiTableCell-head': { py: 0.5, px: 1 },
          '& .MuiTableSortLabel-root': { fontSize: '0.875rem' }
        }}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell padding="checkbox">
                {hasPermission('liquidaciones.editar') && (
                  <Checkbox
                    indeterminate={algunosSeleccionados}
                    checked={todosSeleccionados}
                    onChange={handleSelectAll}
                    disabled={liquidacionesSeleccionables.length === 0}
                  />
                )}
              </TableCell>
              <TableCell sortDirection={orderBy === 'periodo' ? order : false}>
                <TableSortLabel
                  active={orderBy === 'periodo'}
                  direction={orderBy === 'periodo' ? order : 'asc'}
                  onClick={() => handleRequestSort('periodo')}
                >
                  Período
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'numeracion' ? order : false}>
                <TableSortLabel
                  active={orderBy === 'numeracion'}
                  direction={orderBy === 'numeracion' ? order : 'asc'}
                  onClick={() => handleRequestSort('numeracion')}
                >
                  Nro.
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'propiedad' ? order : false}>
                <TableSortLabel
                  active={orderBy === 'propiedad'}
                  direction={orderBy === 'propiedad' ? order : 'asc'}
                  onClick={() => handleRequestSort('propiedad')}
                >
                  Propiedad
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'estado' ? order : false}>
                <TableSortLabel
                  active={orderBy === 'estado'}
                  direction={orderBy === 'estado' ? order : 'asc'}
                  onClick={() => handleRequestSort('estado')}
                >
                  Estado
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sortDirection={orderBy === 'totalInquilino' ? order : false}>
                <TableSortLabel
                  active={orderBy === 'totalInquilino'}
                  direction={orderBy === 'totalInquilino' ? order : 'asc'}
                  onClick={() => handleRequestSort('totalInquilino')}
                >
                  Total Inquilino
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sortDirection={orderBy === 'totalPropietario' ? order : false}>
                <TableSortLabel
                  active={orderBy === 'totalPropietario'}
                  direction={orderBy === 'totalPropietario' ? order : 'asc'}
                  onClick={() => handleRequestSort('totalPropietario')}
                >
                  Total Propietario
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {liquidacionesPagina.map((liquidacion) => (
              <LiquidacionRow
                key={liquidacion.id}
                liquidacion={liquidacion}
                calcularTotales={calcularTotales}
                getEstadoChipColor={getEstadoChipColor}
                estadoBorradorId={estadoBorradorId}
                estadoListaId={estadoListaId}
                estadoEmitidaId={estadoEmitidaId}
                estadoPagadaId={estadoPagadaId}
                selectedIds={selectedIds}
                handleSelectOne={handleSelectOne}
                handleView={handleView}
                handleEdit={handleEdit}
                handleEmitirBoleta={handleEmitirBoleta}
                handleDownloadPDF={handleDownloadPDF}
                handlePagoLiquidacion={handlePagoLiquidacion}
                handleMarcarComoPagada={handleMarcarComoPagada}
                setLiquidacionAEliminar={setLiquidacionAEliminar}
                generarBoletaInquilinoPDF={generarBoletaInquilinoPDF}
                generarLiquidacionPropietarioPDFHandler={generarLiquidacionPropietarioPDFHandler}
                handleWhatsAppClick={handleWhatsAppClick}
              />
            ))}
            {liquidacionesPagina.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No se encontraron liquidaciones para los filtros seleccionados
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={meta.total ?? 0}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Filas por página:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      </TableContainer>

      {/* Vista de cards para mobile */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {/* Master Checkbox para mobile */}
        {hasPermission('liquidaciones.editar') && liquidacionesSeleccionables.length > 0 && (
          <Paper sx={{ p: 1.5, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
              indeterminate={algunosSeleccionados}
              checked={todosSeleccionados}
              onChange={handleSelectAll}
              size="small"
            />
            <Typography variant="body2" color="text.secondary">
              {todosSeleccionados
                ? `Todas seleccionadas (${liquidacionesSeleccionables.length})`
                : algunosSeleccionados
                  ? `${selectedIds.length} de ${liquidacionesSeleccionables.length} seleccionadas`
                  : `Seleccionar todas (${liquidacionesSeleccionables.length})`
              }
            </Typography>
          </Paper>
        )}

        <Grid container spacing={2}>
          {liquidacionesPagina.map((liquidacion) => {
            const propiedad = liquidacion.propiedad || liquidacion.contrato?.propiedad;
            const inquilino = liquidacion.contrato?.inquilino;
            const direccionPropiedad = propiedad
              ? `${propiedad.dirCalle || ''} ${propiedad.dirNro || ''}${propiedad.dirPiso ? ` ${propiedad.dirPiso}°` : ''}${propiedad.dirDepto ? ` "${propiedad.dirDepto}"` : ''}`.trim()
              : '-';
            const nombreInquilino = inquilino
              ? (inquilino.razonSocial || `${inquilino.apellido || ''}, ${inquilino.nombre || ''}`.trim())
              : '-';

            // Calcular totales separados
            const { totalInquilino, totalPropietario } = calcularTotales(liquidacion);

            const estadoId = liquidacion.estado?.id;
            const esSeleccionable = estadoId === estadoListaId || estadoId === estadoBorradorId;
            const estaSeleccionada = selectedIds.includes(liquidacion.id);
            const propietarioData = propiedad?.propietarios?.[0]?.propietario;
            const nombrePropietario = propietarioData
              ? (propietarioData.razonSocial || `${propietarioData.apellido || ''}, ${propietarioData.nombre || ''}`.trim())
              : 'Sin propietario';
            const tieneInquilino = !!inquilino && !!liquidacion.contratoId;
            const esEmitida = estadoId === estadoEmitidaId;
            const esPagada = estadoId === estadoPagadaId;
            const tooltipRegistrarPropietario = totalPropietario < 0 ? 'Registrar Cobro' : 'Registrar Pago';
            const expanded = expandedMobileId === liquidacion.id;

            return (
              <Grid item xs={12} key={liquidacion.id}>
                <Card sx={{
                  ...(estaSeleccionada && {
                    borderColor: 'primary.main',
                    borderWidth: 2,
                    borderStyle: 'solid',
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04)
                  })
                }}>
                  <CardContent sx={{ pb: '12px !important' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {hasPermission('liquidaciones.editar') && esSeleccionable && (
                          <Checkbox
                            checked={estaSeleccionada}
                            onChange={() => handleSelectOne(liquidacion.id)}
                            size="small"
                          />
                        )}
                        <Box>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {formatPeriodo(liquidacion.periodo)} {liquidacion.numeracion && `#${liquidacion.numeracion}`}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {nombreInquilino}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip
                        label={liquidacion.estado?.nombre || liquidacion.estado?.codigo || '-'}
                        color={getEstadoChipColor(estadoId)}
                        size="small"
                      />
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HomeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">{direccionPropiedad}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, py: 0.25, borderRadius: 1, bgcolor: 'rgba(25, 118, 210, 0.08)' }}>
                          <Typography variant="caption" color="text.secondary">Total Inq.:</Typography>
                          <Typography variant="body2" fontWeight={600} color="text.primary">
                            {inquilino ? `$${totalInquilino.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, py: 0.25, borderRadius: 1, bgcolor: 'rgba(46, 125, 50, 0.08)' }}>
                          <Typography variant="caption" color="text.secondary">Total Prop.:</Typography>
                          <Typography variant="body2" fontWeight={600} color="text.primary">
                            {`$${totalPropietario.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    <Box
                      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, cursor: 'pointer' }}
                      onClick={() => setExpandedMobileId((prev) => (prev === liquidacion.id ? null : liquidacion.id))}
                    >
                      <Typography variant="body2" color="primary" fontWeight={500}>
                        {expanded ? 'Ocultar detalle' : 'Ver detalle'}
                      </Typography>
                      <IconButton size="small" sx={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>
                        <ExpandMoreIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <Tooltip title="Ver detalle">
                        <IconButton size="small" onClick={() => handleView(liquidacion.id)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {(estadoId === estadoBorradorId || estadoId === estadoListaId) && (
                        <RequirePermission codigo="liquidaciones.editar">
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => handleEdit(liquidacion.id)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </RequirePermission>
                      )}
                      {estadoId === estadoListaId && (
                        <RequirePermission codigo="liquidaciones.editar">
                          <Tooltip title="Emitir boleta">
                            <IconButton size="small" color="primary" onClick={() => handleEmitirBoleta(liquidacion)}>
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </RequirePermission>
                      )}
                      {estadoId === estadoBorradorId && (
                        <RequirePermission codigo="liquidaciones.eliminar">
                          <Tooltip title="Eliminar">
                            <IconButton size="small" color="error" onClick={() => setLiquidacionAEliminar(liquidacion)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </RequirePermission>
                      )}
                    </Box>
                  </CardContent>
                  <Collapse in={expanded} timeout="auto" unmountOnExit>
                    <Box sx={{ px: 2, pb: 2, pt: 0 }}>
                      <Grid container spacing={2}>
                        {tieneInquilino && (
                          <Grid item xs={12}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                                <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
                                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                                    <PersonIcon color="primary" fontSize="small" />
                                    <Typography variant="subtitle2" fontWeight={600}>Inquilino</Typography>
                                  </Stack>
                                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>{nombreInquilino}</Typography>
                                  <Typography variant="body2" fontWeight={600}>
                                    Total a Cobrar: ${totalInquilino.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </Typography>
                                </Box>
                                {(esEmitida || esPagada) && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                    <Tooltip title="Descargar boleta PDF">
                                      <IconButton size="small" color="primary" onClick={() => generarBoletaInquilinoPDF(liquidacion.id)}>
                                        <PictureAsPdfIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Enviar por WhatsApp">
                                      <IconButton size="small" onClick={() => handleWhatsAppClick(liquidacion, 'inquilino')} sx={{ color: '#25D366', '&:hover': { bgcolor: 'rgba(37, 211, 102, 0.12)' } }}>
                                        <WhatsAppIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    {esEmitida && handleMarcarComoPagada && (
                                      <RequirePermission codigo="movimiento.inquilinos.crear">
                                        <Tooltip title="Registrar Cobro">
                                          <IconButton size="small" color="success" onClick={() => handleMarcarComoPagada(liquidacion)}>
                                            <PaidIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                      </RequirePermission>
                                    )}
                                  </Box>
                                )}
                              </Box>
                            </Paper>
                          </Grid>
                        )}
                        <Grid item xs={12}>
                          <Paper variant="outlined" sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                              <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                                  <AccountBalanceWalletIcon color="warning" fontSize="small" />
                                  <Typography variant="subtitle2" fontWeight={600}>Propietario</Typography>
                                </Stack>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>{nombrePropietario}</Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  Total a Pagar: ${totalPropietario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </Typography>
                              </Box>
                              {(esEmitida || esPagada) && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                  <Tooltip title="Descargar liquidación PDF">
                                    <IconButton size="small" color="primary" onClick={() => generarLiquidacionPropietarioPDFHandler(liquidacion.id)}>
                                      <PictureAsPdfIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Enviar por WhatsApp">
                                    <IconButton size="small" onClick={() => handleWhatsAppClick(liquidacion, 'propietario')} sx={{ color: '#25D366', '&:hover': { bgcolor: 'rgba(37, 211, 102, 0.12)' } }}>
                                      <WhatsAppIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <RequirePermission codigo="movimiento.propietarios.crear">
                                    <Tooltip title={tooltipRegistrarPropietario}>
                                      <IconButton size="small" color="warning" onClick={() => handlePagoLiquidacion(liquidacion.id, 'propietario')}>
                                        <PaidIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </RequirePermission>
                                </Box>
                              )}
                            </Box>
                          </Paper>
                        </Grid>
                      </Grid>
                    </Box>
                  </Collapse>
                </Card>
              </Grid>
            );
          })}
          {liquidacionesPagina.length === 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  No se encontraron liquidaciones para los filtros seleccionados
                </Typography>
              </Paper>
            </Grid>
          )}
        </Grid>

        {/* Paginación para mobile (server-side) */}
        {(meta.totalPages ?? 0) > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Pagination
              count={meta.totalPages ?? 0}
              page={page + 1}
              onChange={(e, newPage) => setPage(newPage - 1)}
              color="primary"
              size="small"
            />
          </Box>
        )}
      </Box>

      {/* Dialog de edición */}
      <LiquidacionEditDialog open={editOpen} onClose={() => setEditOpen(false)}>
        {liquidacionDetalle && (
          <LiquidacionEditForm liquidacion={liquidacionDetalle} onClose={() => setEditOpen(false)} />
        )}
      </LiquidacionEditDialog>

      {/* Dialog de vista detallada */}
      <LiquidacionViewDialog
        open={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setSelectedLiquidacion(null);
          if (location.state?.from === 'dashboard') {
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete('id');
              return next;
            });
            navigate('/', { replace: true, state: {} });
          }
        }}
        liquidacion={liquidacionDetalle}
        onEmitirBoleta={handleEmitirBoleta}
        onMarcarComoLista={handleMarcarComoLista}
        onDownloadPDF={() => handleDownloadPDF(selectedLiquidacion)}
        onRegistrarCobro={(liq) => {
          setViewOpen(false);
          handleMarcarComoPagada?.(liq);
        }}
        onRegistrarPagoPropietario={(id) => {
          setViewOpen(false);
          handlePagoLiquidacion(id);
        }}
        onOpenEdit={() => {
          setViewOpen(false);
          setEditOpen(true);
        }}
      >
        {isLoadingDetalle ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>Cargando...</Box>
        ) : liquidacionDetalle ? (
          <LiquidacionDetalle
            liquidacion={liquidacionDetalle}
            onEmitir={handleEmitir}
            onDownloadPDF={() => handleDownloadPDF(selectedLiquidacion)}
          />
        ) : (
          <Box sx={{ p: 2 }}>No se pudo cargar la liquidación</Box>
        )}
      </LiquidacionViewDialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>

      {/* Modales de lógica financiera (cobro / pago) */}
      <CobrarLiquidacionDialog
        open={cobrarLiquidacionModal.open}
        liquidacion={cobrarLiquidacionModal.liquidacion}
        mediosPago={mediosPago}
        onClose={() => setCobrarLiquidacionModal({ open: false, liquidacion: null })}
        onConfirm={(payload) => cobrarLiquidacionMutation.mutate(payload)}
        loading={cobrarLiquidacionMutation.isPending}
      />
      <RegistrarCobroModal
        open={cobroModal.open}
        onClose={() => setCobroModal({ open: false, liquidacion: null, contrato: null })}
        contrato={cobroModal.contrato}
        importePreset={cobroModal.importePreset}
        conceptoPreset={cobroModal.conceptoPreset}
        onSuccess={() => {
          setSuccessMessage('Cobro registrado correctamente');
          setSnackbarSeverity('success');
          setSnackbarOpen(true);
          queryClient.invalidateQueries(['liquidaciones']);
        }}
      />
      <RegistrarPagoModal
        open={pagoModal.open}
        onClose={() => setPagoModal({ open: false, liquidacion: null, contrato: null })}
        contrato={pagoModal.contrato}
        importePreset={pagoModal.importePreset}
        conceptoPreset={pagoModal.conceptoPreset}
        onSuccess={() => {
          setSuccessMessage('Pago registrado correctamente');
          setSnackbarSeverity('success');
          setSnackbarOpen(true);
          queryClient.invalidateQueries(['liquidaciones']);
        }}
      />
    </Box>
  );
}

// Componente de formulario de liquidación manual
function LiquidacionForm({ onClose }) {
  // Obtener mes/año actual en formato YYYY-MM
  const mesActual = dayjs().format('YYYY-MM');

  const [formData, setFormData] = useState({
    contratoId: '',
    propiedadId: '',
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
    queryKey: ['cuentasTributarias', formData.propiedadId],
    queryFn: async () => {
      if (!formData.propiedadId) return [];
      const response = await api.get(`/cuentas/propiedad/${formData.propiedadId}`);
      return response.data || [];
    },
    enabled: !!formData.propiedadId
  });

  // Efecto para cargar items automáticamente cuando cambia el contrato
  useEffect(() => {
    // Solo cargar items si tenemos contrato cargado
    if (!contratoDetalle?.id || !contratoDetalle?.propiedadId) {
      return;
    }

    const contratoIdActual = contratoDetalle.id;
    const propiedadIdActual = contratoDetalle.propiedadId;

    // Solo ejecutar si cambió el contrato
    if (contratoIdActual !== contratoIdRef.current) {
      contratoIdRef.current = contratoIdActual;
      itemsCargadosRef.current = false;

      // Actualizar propiedadId inmediatamente
      setFormData((prev) => ({
        ...prev,
        propiedadId: propiedadIdActual,
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
      propiedadId: contrato.propiedadId,
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
                    propiedadId: '',
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
                    {contrato.propiedad ? `${contrato.propiedad.dirCalle} ${contrato.propiedad.dirNro}` : '-'}
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
            <DatePicker
              label="Vencimiento"
              value={formData.vencimiento ? dayjs(formData.vencimiento) : null}
              onChange={(newValue) => setFormData({ ...formData, vencimiento: newValue ? newValue.format('YYYY-MM-DD') : '' })}
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
                          ? 'No hay cuentas tributarias asociadas a esta propiedad. Agregue cuentas tributarias en la sección de Propiedades.'
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
                          inputProps={{
                            style: { MozAppearance: 'textfield' },
                            onWheel: (e) => e.target.blur(),
                            step: '0.01',
                            min: '0'
                          }}
                          sx={{
                            width: '100%',
                            '& input[type=number]::-webkit-outer-spin-button': {
                              WebkitAppearance: 'none',
                              margin: 0
                            },
                            '& input[type=number]::-webkit-inner-spin-button': {
                              WebkitAppearance: 'none',
                              margin: 0
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="0.00"
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

// Normalizar ítems de la API al formato del formulario de edición.
// Ítems pueden ser: impuestos (propiedadImpuesto.tipoImpuesto), cargos (tipoCargo), Expensas con Ordinarias/Extraordinarias (tipoExpensa), o gastos iniciales (contratoGastoInicial).
function normalizarItemsEdicion(apiItems) {
  if (!apiItems || !apiItems.length) return [];
  const normalized = apiItems.map((item) => {
    const esImpuesto = !!(item.propiedadImpuestoId || item.propiedadImpuesto);
    const esGastoInicial = !!(item.contratoGastoInicialId || item.contratoGastoInicial);
    const tipoImpuesto = item.propiedadImpuesto?.tipoImpuesto;
    const tipoImpuestoNombre = tipoImpuesto ? (tipoImpuesto.nombre || tipoImpuesto.codigo || 'Impuesto') : '';
    const tipoImpuestoCodigo = tipoImpuesto?.codigo || '';
    const tipoCargo = item.tipoCargoId ?? item.tipoCargo?.id ?? '';
    const tipoCargoNombre = item.tipoCargo ? (item.tipoCargo.nombre || item.tipoCargo.codigo || '') : '';
    const tipoCargoCodigo = item.tipoCargo?.codigo || '';
    const tipoExpensa = item.tipoExpensa;
    const tipoExpensaId = item.tipoExpensaId ?? item.tipoExpensa?.id ?? null;
    const tipoExpensaNombre = tipoExpensa ? (tipoExpensa.nombre || (tipoExpensa.codigo === 'ORD' ? 'Ordinarias' : tipoExpensa.codigo === 'EXT' ? 'Extraordinarias' : tipoExpensa.codigo)) : '';
    // Gastos iniciales
    const tipoGastoInicial = item.contratoGastoInicial?.tipoGastoInicial;
    const tipoGastoInicialNombre = tipoGastoInicial ? (tipoGastoInicial.nombre || tipoGastoInicial.codigo || 'Gasto inicial') : '';
    const tipoGastoInicialCodigo = tipoGastoInicial?.codigo || '';
    return {
      id: item.id,
      estadoItemId: item.estadoItemId,
      propiedadImpuestoId: item.propiedadImpuestoId ?? item.propiedadImpuesto?.id ?? null,
      contratoGastoInicialId: item.contratoGastoInicialId ?? item.contratoGastoInicial?.id ?? null,
      esImpuesto,
      esGastoInicial,
      tipoImpuestoNombre: esImpuesto ? tipoImpuestoNombre : '',
      tipoImpuestoCodigo,
      tipoGastoInicialNombre: esGastoInicial ? tipoGastoInicialNombre : '',
      tipoGastoInicialCodigo,
      tipoCargo,
      tipoCargoNombre,
      tipoCargoCodigo,
      tipoExpensaId,
      tipoExpensaNombre,
      quienPaga: item.quienSoportaCostoId ?? item.quienSoportaCosto?.id ?? '',
      quienSoportaCostoCodigo: item.quienSoportaCosto?.codigo || '',
      pagadoPorActorId: item.pagadoPorActorId ?? item.pagadoPorActor?.id ?? '',
      pagadoPorActorCodigo: item.pagadoPorActor?.codigo || '',
      importe: item.importe != null ? Number(item.importe).toFixed(2) : '',
      observaciones: item.observaciones || '',
      orden: item.orden ?? 0
    };
  });
  // Ordenar según el orden predefinido
  return ordenarItemsLiquidacionFn(normalized);
}

// Helper para formatear valor de interés (API puede devolver número o string)
const formatInteresForForm = (v) => {
  if (v == null || v === '') return '';
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? '' : String(n);
};

// Componente de edición de liquidación
function LiquidacionEditForm({ liquidacion, onClose }) {
  const [items, setItems] = useState(() => normalizarItemsEdicion(liquidacion?.items));
  const [formData, setFormData] = useState({
    estadoLiquidacionId: liquidacion?.estadoLiquidacionId || liquidacion?.estado?.id || '',
    vencimiento: liquidacion?.vencimiento ? dayjs(liquidacion.vencimiento).format('YYYY-MM-DD') : '',
    vencimiento2: liquidacion?.vencimiento2 ? dayjs(liquidacion.vencimiento2).format('YYYY-MM-DD') : '',
    interes2: formatInteresForForm(liquidacion?.interes2),
    vencimiento3: liquidacion?.vencimiento3 ? dayjs(liquidacion.vencimiento3).format('YYYY-MM-DD') : '',
    interes3: formatInteresForForm(liquidacion?.interes3),
    observaciones: liquidacion?.observaciones || ''
  });

  // Sincronizar formulario cuando llega o se actualiza la liquidación (p. ej. después del GET o tras marcar "Lista")
  useEffect(() => {
    if (!liquidacion) return;
    setFormData({
      estadoLiquidacionId: liquidacion.estadoLiquidacionId || liquidacion.estado?.id || '',
      vencimiento: liquidacion.vencimiento ? dayjs(liquidacion.vencimiento).format('YYYY-MM-DD') : '',
      vencimiento2: liquidacion.vencimiento2 ? dayjs(liquidacion.vencimiento2).format('YYYY-MM-DD') : '',
      interes2: formatInteresForForm(liquidacion.interes2),
      vencimiento3: liquidacion.vencimiento3 ? dayjs(liquidacion.vencimiento3).format('YYYY-MM-DD') : '',
      interes3: formatInteresForForm(liquidacion.interes3),
      observaciones: liquidacion.observaciones || ''
    });
    setItems(normalizarItemsEdicion(liquidacion.items));
  }, [liquidacion?.id, liquidacion?.vencimiento, liquidacion?.vencimiento2, liquidacion?.vencimiento3, liquidacion?.interes2, liquidacion?.interes3, liquidacion?.estadoLiquidacionId, liquidacion?.observaciones]);

  const estadoLiquidacionMap = useParametrosMap('estado_liquidacion');

  // Determinar si tiene contrato vigente
  const tieneContratoVigente = liquidacion?.contrato && liquidacion.contrato.id;

  // Determinar si la liquidación está emitida (no editable)
  const isEmitida = liquidacion?.estado?.codigo === 'EMITIDA';
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [nuevoItemDialogOpen, setNuevoItemDialogOpen] = useState(false);
  const [nuevoItemForm, setNuevoItemForm] = useState({
    conceptoTipo: '',
    fechaGasto: null,
    pagadoPorActorId: '',
    quienSoportaCostoId: '',
    concepto: '',
    importe: ''
  });
  const queryClient = useQueryClient();
  const tipoCargoMap = useParametrosMap('tipo_cargo');
  const tipoCargoExpensasId = tipoCargoMap?.lista?.find((p) => p.codigo === 'EXPENSAS')?.id ?? null;
  const { data: tiposExpensa = [] } = useQuery({
    queryKey: ['catalogos-abm', 'tipos-expensa'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-expensa?mostrarInactivos=false');
      return response.data ?? [];
    }
  });

  // Cargar tipos de cargo e impuesto para el selector
  const { data: tiposCargoList = [] } = useQuery({
    queryKey: ['tipos-cargo-activos'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-cargo?mostrarInactivos=false');
      return response.data ?? [];
    }
  });

  const { data: tiposImpuestoList = [] } = useQuery({
    queryKey: ['tipos-impuesto-propiedad-activos'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-impuesto-propiedad?mostrarInactivos=false');
      return response.data ?? [];
    }
  });

  // Cargar tipos de gasto inicial
  const { data: tiposGastoInicialList = [] } = useQuery({
    queryKey: ['tipos-gasto-inicial-contrato-activos'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-gasto-inicial-contrato?mostrarInactivos=false');
      return response.data ?? [];
    }
  });

  // Cargar actores responsables
  const { data: actores = [] } = useQuery({
    queryKey: ['actores-responsable-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/actores-responsable-contrato');
      return response.data ?? [];
    }
  });

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
    },
    onError: (error) => {
      console.error('Error al actualizar liquidación:', error);
      setSuccessMessage(`Error: ${error.response?.data?.error || error.message}`);
      setSnackbarOpen(true);
    }
  });

  const handleAddItem = () => {
    setNuevoItemForm({
      conceptoTipo: '',
      fechaGasto: null,
      pagadoPorActorId: '',
      quienSoportaCostoId: '',
      concepto: '',
      importe: ''
    });
    setNuevoItemDialogOpen(true);
  };

  const [editingItemIndex, setEditingItemIndex] = useState(null);

  const handleConfirmAddItem = () => {
    // Determinar tipo de cargo, impuesto o gasto inicial
    let tipoCargoId = null;
    let propiedadImpuestoId = null;
    let conceptoNombre = 'Item';
    let tipoImpuestoId = null;
    let esGastoInicial = false;
    let tipoGastoInicialCodigo = '';
    let tipoGastoInicialNombre = '';

    if (nuevoItemForm.conceptoTipo) {
      if (nuevoItemForm.conceptoTipo.startsWith('gasto-')) {
        const tipoGastoId = parseInt(nuevoItemForm.conceptoTipo.replace('gasto-', ''));
        const tipoGasto = tiposGastoInicialList.find(tg => tg.id === tipoGastoId);
        conceptoNombre = tipoGasto?.nombre || tipoGasto?.codigo || 'Gasto Inicial';
        esGastoInicial = true;
        tipoGastoInicialCodigo = tipoGasto?.codigo || '';
        tipoGastoInicialNombre = tipoGasto?.nombre || tipoGasto?.codigo || 'Gasto Inicial';
      } else if (nuevoItemForm.conceptoTipo.startsWith('cargo-')) {
        tipoCargoId = parseInt(nuevoItemForm.conceptoTipo.replace('cargo-', ''));
        const tipoCargo = tiposCargoList.find(tc => tc.id === tipoCargoId);
        conceptoNombre = tipoCargo?.nombre || tipoCargo?.codigo || 'Cargo';
      } else if (nuevoItemForm.conceptoTipo.startsWith('impuesto-')) {
        tipoImpuestoId = parseInt(nuevoItemForm.conceptoTipo.replace('impuesto-', ''));
        const tipoImpuesto = tiposImpuestoList.find(ti => ti.id === tipoImpuestoId);
        conceptoNombre = tipoImpuesto?.nombre || tipoImpuesto?.codigo || 'Impuesto';
      }
    }

    const nuevoItem = {
      tipoCargo: tipoCargoId || '',
      tipoCargoNombre: conceptoNombre,
      propiedadImpuestoId: propiedadImpuestoId,
      importe: nuevoItemForm.importe || '0',
      quienPaga: nuevoItemForm.quienSoportaCostoId || '',
      pagadoPorActorId: nuevoItemForm.pagadoPorActorId || '',
      observaciones: nuevoItemForm.concepto || '',
      fechaGasto: nuevoItemForm.fechaGasto || null,
      orden: items.length,
      esImpuesto: !!tipoImpuestoId,
      esGastoInicial: esGastoInicial,
      tipoGastoInicialCodigo: tipoGastoInicialCodigo,
      tipoGastoInicialNombre: tipoGastoInicialNombre
    };

    if (editingItemIndex !== null) {
      // Editando item existente
      const newItems = [...items];
      newItems[editingItemIndex] = { ...newItems[editingItemIndex], ...nuevoItem, orden: newItems[editingItemIndex].orden };
      setItems(newItems);
    } else {
      // Agregando nuevo item
      setItems([...items, nuevoItem]);
    }
    setNuevoItemDialogOpen(false);
    setEditingItemIndex(null);
  };

  const handleEditItem = (index) => {
    const item = items[index];

    // Determinar el conceptoTipo basado en el item
    let conceptoTipo = '';
    if (item.esGastoInicial) {
      // Buscar el tipo de gasto inicial por código
      const tipoGasto = tiposGastoInicialList.find(tg => tg.codigo === item.tipoGastoInicialCodigo);
      if (tipoGasto) {
        conceptoTipo = `gasto-${tipoGasto.id}`;
      }
    } else if (item.esImpuesto) {
      // Buscar el tipo de impuesto por código
      const tipoImpuesto = tiposImpuestoList.find(ti => ti.codigo === item.tipoImpuestoCodigo);
      if (tipoImpuesto) {
        conceptoTipo = `impuesto-${tipoImpuesto.id}`;
      }
    } else if (item.tipoCargo) {
      conceptoTipo = `cargo-${item.tipoCargo}`;
    }

    setNuevoItemForm({
      conceptoTipo: conceptoTipo,
      fechaGasto: item.fechaGasto || '',
      pagadoPorActorId: item.pagadoPorActorId || '',
      quienSoportaCostoId: item.quienPaga || '',
      concepto: item.observaciones || '',
      importe: item.importe || ''
    });
    setEditingItemIndex(index);
    setNuevoItemDialogOpen(true);
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
        estadoLiquidacionId: formData.estadoLiquidacionId ? Number(formData.estadoLiquidacionId) : null,
        vencimiento: formData.vencimiento || null,
        vencimiento2: formData.vencimiento2 || null,
        interes2: formData.interes2 !== '' ? parseFloat(formData.interes2) : null,
        vencimiento3: formData.vencimiento3 || null,
        interes3: formData.interes3 !== '' ? parseFloat(formData.interes3) : null,
        observaciones: formData.observaciones || null,
        items: items.map((item, index) => ({
          id: item.id || null,
          propiedadImpuestoId: item.propiedadImpuestoId ?? null,
          tipoCargoId: item.esImpuesto || item.esGastoInicial ? null : (item.tipoCargo ? Number(item.tipoCargo) : null),
          tipoExpensaId: item.tipoExpensaId ?? null,
          contratoGastoInicialId: item.contratoGastoInicialId ?? null,
          actorFacturadoId: item.quienPaga ? Number(item.quienPaga) : null,
          pagadoPorActorId: item.pagadoPorActorId ? Number(item.pagadoPorActorId) : null,
          quienSoportaCostoId: item.quienPaga ? Number(item.quienPaga) : null,
          importe: parseFloat(item.importe || 0),
          observaciones: item.observaciones || null,
          estadoItemId: item.estadoItemId || null,
          orden: index
        })),
        total
      }
    });
  };

  // Calcular totales con intereses
  const totalBase = items.reduce((sum, item) => sum + parseFloat(item.importe || 0), 0);
  const interes2Num = parseFloat(formData.interes2) || 0;
  const interes3Num = parseFloat(formData.interes3) || 0;
  const totalConInteres2 = totalBase * (1 + interes2Num / 100);
  const totalConInteres3 = totalConInteres2 * (1 + interes3Num / 100); // Interés sobre el 2do vto

  const formatMoney = (value) => value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <form onSubmit={handleSubmit}>
      <Box sx={{ mt: 1 }}>
        {/* Estado */}
        <Box sx={{ mb: 2 }}>
          <FormControl sx={{ minWidth: 180 }} size="small" disabled={isEmitida}>
            <InputLabel>Estado</InputLabel>
            <Select
              value={formData.estadoLiquidacionId}
              label="Estado"
              onChange={(e) => setFormData({ ...formData, estadoLiquidacionId: e.target.value })}
            >
              {estadoLiquidacionMap?.lista?.map((estado) => (
                <MenuItem key={estado.id} value={estado.id}>
                  {estado.nombre || estado.codigo}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Bloque de Vencimientos y Recargos */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
          <Divider textAlign="left" sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight="medium">
              Vencimientos y Recargos
            </Typography>
          </Divider>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            {/* 1er Vencimiento */}
            <DatePicker
              label="1er Vto"
              disabled={isEmitida}
              value={formData.vencimiento ? dayjs(formData.vencimiento) : null}
              onChange={(newValue) => setFormData({ ...formData, vencimiento: newValue ? newValue.format('YYYY-MM-DD') : '' })}
              slotProps={{
                textField: {
                  size: 'small',
                  sx: { flex: 2, minWidth: 130 }
                }
              }}
            />
            <TextField
              label="Importe"
              size="small"
              disabled
              value={`$${formatMoney(totalBase)}`}
              sx={{ flex: 2, minWidth: 100 }}
            />

            {/* 2do Vencimiento */}
            <DatePicker
              label="2do Vto"
              disabled={isEmitida}
              value={formData.vencimiento2 ? dayjs(formData.vencimiento2) : null}
              onChange={(newValue) => setFormData({ ...formData, vencimiento2: newValue ? newValue.format('YYYY-MM-DD') : '' })}
              slotProps={{
                textField: {
                  size: 'small',
                  sx: { flex: 2, minWidth: 130 }
                }
              }}
            />
            <TextField
              label="Int %"
              type="number"
              size="small"
              disabled={isEmitida}
              value={formData.interes2}
              onChange={(e) => setFormData({ ...formData, interes2: e.target.value })}
              inputProps={{ step: '0.1', min: '0' }}
              sx={{ flex: 1, minWidth: 55, maxWidth: 70, '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { display: 'none' }, '& input[type=number]': { MozAppearance: 'textfield' } }}
            />
            <TextField
              label="Importe"
              size="small"
              disabled
              value={`$${formatMoney(totalConInteres2)}`}
              sx={{ flex: 2, minWidth: 100 }}
            />

            {/* 3er Vencimiento */}
            <DatePicker
              label="3er Vto"
              disabled={isEmitida}
              value={formData.vencimiento3 ? dayjs(formData.vencimiento3) : null}
              onChange={(newValue) => setFormData({ ...formData, vencimiento3: newValue ? newValue.format('YYYY-MM-DD') : '' })}
              slotProps={{
                textField: {
                  size: 'small',
                  sx: { flex: 2, minWidth: 130 }
                }
              }}
            />
            <TextField
              label="Int %"
              type="number"
              size="small"
              disabled={isEmitida}
              value={formData.interes3}
              onChange={(e) => setFormData({ ...formData, interes3: e.target.value })}
              inputProps={{ step: '0.1', min: '0' }}
              sx={{ flex: 1, minWidth: 55, maxWidth: 70, '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { display: 'none' }, '& input[type=number]': { MozAppearance: 'textfield' } }}
            />
            <TextField
              label="Importe"
              size="small"
              disabled
              value={`$${formatMoney(totalConInteres3)}`}
              sx={{ flex: 2, minWidth: 100 }}
            />
          </Box>
        </Paper>

        {/* Observaciones */}
        <TextField
          label="Observaciones"
          multiline
          minRows={2}
          fullWidth
          disabled={isEmitida}
          value={formData.observaciones}
          onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
          sx={{ mb: 2 }}
        />

        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold">Items</Typography>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={handleAddItem} disabled={isEmitida}>
              Agregar Item
            </Button>
          </Box>

          <TableContainer>
            <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.75rem' } }}>
              <TableHead>
                <TableRow>
                  <TableCell padding="none"><strong>Concepto</strong></TableCell>
                  {tieneContratoVigente && (
                    <TableCell padding="none" align="right" sx={{ bgcolor: 'rgba(25, 118, 210, 0.04)' }}><strong>Inquilino</strong></TableCell>
                  )}
                  <TableCell padding="none" align="right" sx={{ bgcolor: 'rgba(46, 125, 50, 0.04)' }}><strong>Propietario</strong></TableCell>
                  <TableCell padding="none"><strong>Observaciones</strong></TableCell>
                  <TableCell padding="none" width={70}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  // Filtrar items (no mostrar Expensas Extraordinarias con importe 0)
                  const itemsFiltrados = items.filter((item) => {
                    if (item.tipoExpensaNombre === 'Extraordinarias' || item.tipoCargoCodigo === 'EXPENSAS' && item.tipoExpensaNombre === 'Extraordinarias') {
                      const importe = parseFloat(item.importe) || 0;
                      if (importe === 0) return false;
                    }
                    return true;
                  });
                  // Ordenar items
                  const itemsOrdenados = ordenarItemsLiquidacionFn(itemsFiltrados);
                  let totalInquilino = 0;
                  let totalPropietario = 0;

                  const formatoMonedaLocal = (valor) => {
                    if (valor == null) return '-';
                    return `$${parseFloat(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  };

                  const filas = itemsOrdenados.map((item) => {
                    // Obtener el concepto
                    let concepto = '-';
                    if (item.esGastoInicial) {
                      concepto = item.tipoGastoInicialNombre || 'Gasto inicial';
                    } else if (item.esImpuesto) {
                      concepto = item.tipoImpuestoNombre || 'Impuesto';
                    } else if (item.tipoCargoNombre) {
                      concepto = item.tipoExpensaNombre ? `${item.tipoCargoNombre} ${item.tipoExpensaNombre}` : item.tipoCargoNombre;
                    } else {
                      concepto = 'Incidencia';
                    }

                    // Buscar el actor responsable (quienPaga es el quienSoportaCosto)
                    const quienPagaId = item.quienPaga ? parseInt(item.quienPaga) : null;
                    const actorResponsable = quienPagaId ? actores.find(a => a.id === quienPagaId) : null;
                    const codigoResponsable = actorResponsable?.codigo || item.quienSoportaCostoCodigo;

                    // También considerar pagadoPorActorId para el caso de reintegros
                    const pagadoPorId = item.pagadoPorActorId ? parseInt(item.pagadoPorActorId) : null;
                    const actorPagador = pagadoPorId ? actores.find(a => a.id === pagadoPorId) : null;
                    const codigoPagadoPor = actorPagador?.codigo;

                    const importeNum = parseFloat(item.importe) || 0;
                    const esInquilinoResponsable = codigoResponsable === 'INQ';
                    const esPropietarioResponsable = codigoResponsable === 'PROP';
                    const inquilinoPagoPorPropietario = esPropietarioResponsable && codigoPagadoPor === 'INQ';

                    let importeInquilino = '-';
                    let importePropietario = '-';

                    if (esInquilinoResponsable) {
                      importeInquilino = formatoMonedaLocal(importeNum);
                      totalInquilino += importeNum;
                    } else if (inquilinoPagoPorPropietario) {
                      importeInquilino = formatoMonedaLocal(-importeNum);
                      importePropietario = formatoMonedaLocal(importeNum);
                      totalInquilino -= importeNum;
                      totalPropietario += importeNum;
                    } else if (esPropietarioResponsable) {
                      importePropietario = formatoMonedaLocal(importeNum);
                      totalPropietario += importeNum;
                    }

                    // Encontrar el índice original para editar/eliminar
                    const originalIndex = items.findIndex(i => i === item);

                    const esNegativoInq = importeInquilino.startsWith('-') || importeInquilino.startsWith('$-');

                    return (
                      <TableRow key={originalIndex}>
                        <TableCell padding="none">{concepto}</TableCell>
                        {tieneContratoVigente && (
                          <TableCell padding="none" align="right" sx={{ bgcolor: 'rgba(25, 118, 210, 0.04)', ...(esNegativoInq && { color: 'error.main', fontWeight: 500 }) }}>{importeInquilino}</TableCell>
                        )}
                        <TableCell padding="none" align="right" sx={{ bgcolor: 'rgba(46, 125, 50, 0.04)' }}>{importePropietario}</TableCell>
                        <TableCell padding="none">{item.observaciones || '-'}</TableCell>
                        <TableCell padding="none" align="right">
                          <IconButton size="small" sx={{ p: 0.25 }} onClick={() => handleEditItem(originalIndex)} disabled={isEmitida}>
                            <EditIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                          <IconButton size="small" sx={{ p: 0.25 }} color="error" onClick={() => handleRemoveItem(originalIndex)} disabled={isEmitida}>
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  });

                  return [
                    ...filas,
                    <TableRow key="total" sx={{ bgcolor: 'rgba(0, 0, 0, 0.02)' }}>
                      <TableCell padding="none"><strong>TOTAL</strong></TableCell>
                      {tieneContratoVigente && (
                        <TableCell padding="none" align="right" sx={{ bgcolor: 'rgba(25, 118, 210, 0.08)', ...(totalInquilino < 0 && { color: 'error.main' }) }}><strong>{formatoMonedaLocal(totalInquilino)}</strong></TableCell>
                      )}
                      <TableCell padding="none" align="right" sx={{ bgcolor: 'rgba(46, 125, 50, 0.08)' }}><strong>{formatoMonedaLocal(totalPropietario)}</strong></TableCell>
                      <TableCell padding="none" />
                      <TableCell padding="none" />
                    </TableRow>
                  ];
                })()}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
      <DialogActions>
        <Button onClick={onClose} disabled={updateMutation.isPending}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={updateMutation.isPending || isEmitida}>
          {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
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

      {/* Dialog para agregar nuevo item */}
      <Dialog
        open={nuevoItemDialogOpen}
        onClose={() => { setNuevoItemDialogOpen(false); setEditingItemIndex(null); }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle>{editingItemIndex !== null ? 'Editar Item' : 'Nuevo Item'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel shrink>Concepto</InputLabel>
              <Select
                value={nuevoItemForm.conceptoTipo}
                label="Concepto"
                onChange={(e) => setNuevoItemForm(f => ({ ...f, conceptoTipo: e.target.value }))}
                displayEmpty
                notched
                renderValue={(value) => {
                  if (!value) return <em style={{ color: '#999' }}>Seleccione un concepto</em>;
                  // Buscar el nombre del concepto seleccionado
                  if (value.startsWith('gasto-')) {
                    const id = parseInt(value.replace('gasto-', ''));
                    const tipo = tiposGastoInicialList.find(t => t.id === id);
                    return tipo?.nombre || tipo?.codigo || value;
                  }
                  if (value.startsWith('cargo-')) {
                    const id = parseInt(value.replace('cargo-', ''));
                    const tipo = tiposCargoList.find(t => t.id === id);
                    return tipo?.nombre || tipo?.codigo || value;
                  }
                  if (value.startsWith('impuesto-')) {
                    const id = parseInt(value.replace('impuesto-', ''));
                    const tipo = tiposImpuestoList.find(t => t.id === id);
                    return tipo?.nombre || tipo?.codigo || value;
                  }
                  return value;
                }}
              >
                {tiposGastoInicialList.length > 0 && (
                  <MenuItem disabled sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', opacity: 1 }}>— Gastos Iniciales —</MenuItem>
                )}
                {tiposGastoInicialList.map((tg) => (
                  <MenuItem key={`gasto-${tg.id}`} value={`gasto-${tg.id}`}>
                    {tg.nombre || tg.codigo || `Gasto ${tg.id}`}
                  </MenuItem>
                ))}
                {tiposCargoList.length > 0 && (
                  <MenuItem disabled sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', opacity: 1 }}>— Cargos —</MenuItem>
                )}
                {tiposCargoList.map((tc) => (
                  <MenuItem key={`cargo-${tc.id}`} value={`cargo-${tc.id}`}>
                    {tc.nombre || tc.codigo || `Tipo ${tc.id}`}
                  </MenuItem>
                ))}
                {tiposImpuestoList.length > 0 && (
                  <MenuItem disabled sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', opacity: 1 }}>— Impuestos —</MenuItem>
                )}
                {tiposImpuestoList.map((ti) => (
                  <MenuItem key={`impuesto-${ti.id}`} value={`impuesto-${ti.id}`}>
                    {ti.nombre || ti.codigo || `Impuesto ${ti.id}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <DatePicker
              label="Fecha del gasto"
              value={nuevoItemForm.fechaGasto ? dayjs(nuevoItemForm.fechaGasto) : null}
              onChange={(newValue) => setNuevoItemForm(f => ({ ...f, fechaGasto: newValue ? newValue.format('YYYY-MM-DD') : '' }))}
              slotProps={{
                textField: {
                  size: 'small',
                  fullWidth: true
                }
              }}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Pagado por</InputLabel>
              <Select
                value={nuevoItemForm.pagadoPorActorId}
                label="Pagado por"
                onChange={(e) => setNuevoItemForm(f => ({ ...f, pagadoPorActorId: e.target.value }))}
              >
                <MenuItem value="">Sin definir</MenuItem>
                {actores.filter(a => a.activo).map((actor) => (
                  <MenuItem key={actor.id} value={actor.id}>
                    {actor.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Cobrar a</InputLabel>
              <Select
                value={nuevoItemForm.quienSoportaCostoId}
                label="Cobrar a"
                onChange={(e) => setNuevoItemForm(f => ({ ...f, quienSoportaCostoId: e.target.value }))}
              >
                <MenuItem value="">Sin definir</MenuItem>
                {actores.filter(a => a.activo).map((actor) => (
                  <MenuItem key={actor.id} value={actor.id}>
                    {actor.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Observaciones"
              value={nuevoItemForm.concepto}
              onChange={(e) => setNuevoItemForm(f => ({ ...f, concepto: e.target.value }))}
              size="small"
              fullWidth
            />
            <TextField
              label="Importe"
              type="number"
              value={nuevoItemForm.importe}
              onChange={(e) => setNuevoItemForm(f => ({ ...f, importe: e.target.value }))}
              size="small"
              fullWidth
              inputProps={{ min: 0, step: 0.01 }}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setNuevoItemDialogOpen(false); setEditingItemIndex(null); }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmAddItem}
            disabled={!nuevoItemForm.importe}
          >
            {editingItemIndex !== null ? 'Guardar' : 'Agregar'}
          </Button>
        </DialogActions>
      </Dialog>
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

  const estadoEmitidaId = estadoLiquidacionMap?.lista?.find((p) => p.codigo === 'EMITIDA')?.id;
  const estadoPagadaId = estadoLiquidacionMap?.lista?.find((p) => p.codigo === 'SALDADA')?.id;
  const tipoCargoExpensasId = tipoCargoMap?.lista?.find((p) => p.codigo === 'EXPENSAS')?.id;
  const tipoCargoGastosInicialesId = tipoCargoMap?.lista?.find((p) => p.codigo === 'GASTOS_INICIALES')?.id;
  const tipoCargoAlquilerId = tipoCargoMap?.lista?.find((p) => p.codigo === 'ALQUILER')?.id;

  // Función para enviar liquidación por WhatsApp (local a este componente)
  const handleWhatsAppClickDetalle = (tipo = 'inquilino') => {
    if (!liquidacion) return;
    const propiedadLocal = liquidacion.propiedad || liquidacion.contrato?.propiedad;
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    let periodoFormateado = liquidacion.periodo || '';
    if (/^\d{4}-\d{2}$/.test(periodoFormateado)) {
      const [year, month] = periodoFormateado.split('-');
      periodoFormateado = `${meses[parseInt(month, 10) - 1]} ${year}`;
    }

    const direccion = propiedadLocal ?
      [propiedadLocal.dirCalle, propiedadLocal.dirNro, propiedadLocal.dirPiso ? `${propiedadLocal.dirPiso}°` : null, propiedadLocal.dirDepto ? `"${propiedadLocal.dirDepto}"` : null]
        .filter(Boolean).join(' ') : '';

    let nombre, telefono, total, mensaje;

    if (tipo === 'inquilino') {
      const inquilino = liquidacion.contrato?.inquilino;
      nombre = inquilino?.razonSocial ||
        `${inquilino?.nombre || ''} ${inquilino?.apellido || ''}`.trim() ||
        'Estimado/a';
      telefono = inquilino?.telefono || '';

      const totalInquilino = liquidacion.items?.reduce((sum, item) => {
        const quienPaga = item.quienPaga?.codigo;
        if (quienPaga === 'INQ' || quienPaga === 'INQUILINO') {
          return sum + parseFloat(item.importe || 0);
        }
        return sum;
      }, 0) || liquidacion.total || 0;

      total = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalInquilino);
      mensaje = `Hola ${nombre}! Te enviamos el resumen de la liquidación de *${periodoFormateado}* correspondiente a *${direccion}*. El total a abonar es de *${total}*. Por cualquier consulta estamos a disposición. Saludos!`;
    } else {
      const propietarioData = propiedadLocal?.propietarios?.[0]?.propietario || liquidacion.contrato?.propiedad?.propietarios?.[0]?.propietario;
      nombre = propietarioData?.razonSocial ||
        `${propietarioData?.nombre || ''} ${propietarioData?.apellido || ''}`.trim() ||
        'Estimado/a';
      telefono = propietarioData?.telefono || '';

      const itemAlquiler = liquidacion.items?.find(item => item.tipoCargo?.codigo === 'ALQUILER');
      const alquilerBruto = itemAlquiler ? parseFloat(itemAlquiler.importe || 0) : 0;
      const porcentajeHonorarios = liquidacion.contrato?.honorariosPropietario ? parseFloat(liquidacion.contrato.honorariosPropietario) : 0;
      const honorariosInmob = alquilerBruto * (porcentajeHonorarios / 100);
      const gastosPropietario = liquidacion.items?.reduce((sum, item) => {
        const quienSoporta = item.quienSoportaCosto?.codigo;
        if ((quienSoporta === 'PROP' || quienSoporta === 'PROPIETARIO') && item.tipoCargo?.codigo !== 'ALQUILER') {
          return sum + parseFloat(item.importe || 0);
        }
        return sum;
      }, 0) || 0;
      const totalPropietario = alquilerBruto - honorariosInmob - gastosPropietario;

      total = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalPropietario);
      mensaje = `Hola ${nombre}! Te enviamos la liquidación de *${periodoFormateado}* correspondiente a *${direccion}*. El neto a percibir es de *${total}*. Por cualquier consulta estamos a disposición. Saludos!`;
    }

    const textoCodificado = encodeURIComponent(mensaje);
    telefono = telefono.replace(/[\s\-\(\)\.]/g, '');

    if (telefono && !telefono.startsWith('+')) {
      if (telefono.startsWith('0')) {
        telefono = telefono.substring(1);
      }
      telefono = `54${telefono}`;
    } else if (telefono.startsWith('+')) {
      telefono = telefono.substring(1);
    }

    let url;
    if (telefono) {
      url = `https://api.whatsapp.com/send?phone=${telefono}&text=${textoCodificado}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${textoCodificado}`;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!liquidacion) {
    console.log('LiquidacionDetalle: liquidacion es null o undefined');
    return <Box sx={{ p: 2 }}>Cargando liquidación...</Box>;
  }


  // Determinar si tiene contrato vigente
  const tieneContratoVigente = liquidacion.contrato && liquidacion.contrato.id;

  // Obtener la propiedad (siempre debería estar en liquidacion.propiedad, pero por compatibilidad también buscamos en contrato)
  const propiedad = liquidacion.propiedad || liquidacion.contrato?.propiedad;

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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" component="div">
                  {tieneContratoVigente && (
                    <>Contrato Nro. {liquidacion.contrato?.nroContrato ?? '-'} - </>
                  )}
                  {propiedad ? (
                    <>
                      {propiedad.dirCalle} {propiedad.dirNro}
                      {propiedad.dirPiso ? ` Piso ${propiedad.dirPiso}` : ''}
                      {propiedad.dirDepto ? ` Dto ${propiedad.dirDepto}` : ''}
                      {propiedad.localidad?.nombre && `, ${propiedad.localidad.nombre}`}
                      {propiedad.provincia?.nombre && `, ${propiedad.provincia.nombre}`}
                    </>
                  ) : (
                    'Sin propiedad'
                  )}
                  {' - '}
                  Período {liquidacion.periodo ? formatPeriodo(liquidacion.periodo) : '-'}
                </Typography>
                <Chip
                  label={liquidacion.estado?.nombre || liquidacion.estado?.codigo || '-'}
                  size="small"
                  sx={{
                    bgcolor: liquidacion.estado?.id === estadoEmitidaId
                      ? 'success.main'
                      : liquidacion.estado?.id === estadoPagadaId
                        ? 'info.main'
                        : 'rgba(255, 255, 255, 0.2)',
                    color: 'white'
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Cards de información: Contrato (solo si hay), Propietarios, Inquilino (solo si hay contrato) */}
        {tieneContratoVigente && (
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, flex: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
                  Detalle Contrato
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {liquidacion.contrato.propiedad && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">Propiedad</Typography>
                      <Typography variant="body2">
                        {liquidacion.contrato.propiedad.dirCalle} {liquidacion.contrato.propiedad.dirNro}
                        {liquidacion.contrato.propiedad.dirPiso && ` Piso ${liquidacion.contrato.propiedad.dirPiso}`}
                        {liquidacion.contrato.propiedad.dirDepto && ` Dto ${liquidacion.contrato.propiedad.dirDepto}`}
                        {liquidacion.contrato.propiedad.localidad?.nombre && `, ${liquidacion.contrato.propiedad.localidad.nombre}`}
                        {liquidacion.contrato.propiedad.provincia?.nombre && `, ${liquidacion.contrato.propiedad.provincia.nombre}`}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {liquidacion.contrato.fechaInicio && (
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary" display="block">Fecha Inicio</Typography>
                        <Typography variant="body2">{formatoFecha(liquidacion.contrato.fechaInicio)}</Typography>
                      </Box>
                    )}
                    {liquidacion.contrato.fechaFin && (
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary" display="block">Fecha Fin</Typography>
                        <Typography variant="body2">{formatoFecha(liquidacion.contrato.fechaFin)}</Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" display="block">Monto Inicial</Typography>
                      <Typography variant="body2" fontWeight="medium">{formatoMoneda(liquidacion.contrato.montoInicial)}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" display="block">Monto Actual</Typography>
                      <Typography variant="body2" fontWeight="medium">{formatoMoneda(liquidacion.contrato.montoActual)}</Typography>
                    </Box>
                  </Box>
                  {liquidacion.emisionAt && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">Emisión</Typography>
                      <Typography variant="body2">{dayjs(liquidacion.emisionAt).format('DD/MM/YYYY HH:mm')}</Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Card Propietarios - siempre se muestra */}
        <Grid item xs={12} md={tieneContratoVigente ? 4 : 12}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, flex: 1, overflow: 'auto' }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
                Propietarios
              </Typography>
              {(() => {
                const propietarios = propiedad?.propietarios?.map((p) => p.propietario) ?? [];
                const esEmitidaOPagada = liquidacion.estado?.id === estadoEmitidaId || liquidacion.estado?.id === estadoPagadaId;
                return propietarios.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {propietarios.map((persona, idx) => (
                      <Box key={persona.id || idx} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography variant="body2" fontWeight="medium">
                          {persona.razonSocial || `${persona.nombre || ''} ${persona.apellido || ''}`.trim() || '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {persona.cuit ? `CUIT: ${persona.cuit}` : persona.dni ? `DNI: ${persona.dni}` : '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Condición IVA: {persona.condicionIva?.nombre || persona.condicionIva?.descripcion || '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Email: {persona.mail || persona.email || '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Teléfono: {persona.telefono || '-'}
                        </Typography>
                      </Box>
                    ))}
                    {esEmitidaOPagada && (
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                        <Tooltip title="Enviar por WhatsApp">
                          <IconButton
                            size="small"
                            onClick={() => handleWhatsAppClickDetalle('propietario')}
                            sx={{ color: '#25D366', '&:hover': { bgcolor: 'rgba(37, 211, 102, 0.12)' } }}
                          >
                            <WhatsAppIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">Sin propietarios</Typography>
                );
              })()}
            </CardContent>
          </Card>
        </Grid>

        {/* Card Inquilino - solo si hay contrato vigente */}
        {tieneContratoVigente && (
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, flex: 1, overflow: 'auto' }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mb: 1.5 }}>
                  Inquilino
                </Typography>
                {liquidacion.contrato?.inquilino ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="body2" fontWeight="medium">
                      {liquidacion.contrato.inquilino.razonSocial || `${liquidacion.contrato.inquilino.nombre || ''} ${liquidacion.contrato.inquilino.apellido || ''}`.trim() || '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {liquidacion.contrato.inquilino.cuit ? `CUIT: ${liquidacion.contrato.inquilino.cuit}` : liquidacion.contrato.inquilino.dni ? `DNI: ${liquidacion.contrato.inquilino.dni}` : '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Condición IVA: {liquidacion.contrato.inquilino.condicionIva?.nombre || liquidacion.contrato.inquilino.condicionIva?.descripcion || '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Email: {liquidacion.contrato.inquilino.mail || liquidacion.contrato.inquilino.email || '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Teléfono: {liquidacion.contrato.inquilino.telefono || '-'}
                    </Typography>
                    {(liquidacion.estado?.id === estadoEmitidaId || liquidacion.estado?.id === estadoPagadaId) && (
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                        <Tooltip title="Enviar por WhatsApp">
                          <IconButton
                            size="small"
                            onClick={() => handleWhatsAppClickDetalle('inquilino')}
                            sx={{ color: '#25D366', '&:hover': { bgcolor: 'rgba(37, 211, 102, 0.12)' } }}
                          >
                            <WhatsAppIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">Sin inquilino</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

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
                        {tieneContratoVigente && (
                          <TableCell padding="none" align="right" sx={{ bgcolor: 'rgba(25, 118, 210, 0.04)' }}><strong>Inquilino</strong></TableCell>
                        )}
                        <TableCell padding="none" align="right" sx={{ bgcolor: 'rgba(46, 125, 50, 0.04)' }}><strong>Propietario</strong></TableCell>
                        <TableCell padding="none"><strong>Observaciones</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(() => {
                        // No liquidar ítems donde quien soporta el costo y quien paga son la misma parte (ej. inquilino paga expensas y le corresponden)
                        const itemsFiltrados = liquidacion.items.filter((item) => {
                          if (item.quienSoportaCostoId === item.pagadoPorActorId) return false;
                          // No mostrar Expensas Extraordinarias con importe 0
                          if (item.tipoExpensa?.codigo === 'EXT') {
                            const importe = item.importe != null ? parseFloat(item.importe) : 0;
                            if (importe === 0) return false;
                          }
                          return true;
                        });
                        // Ordenar items según el orden predefinido
                        const itemsALiquidar = ordenarItemsLiquidacionFn(itemsFiltrados);
                        let totalInquilino = 0;
                        let totalPropietario = 0;
                        const filas = itemsALiquidar.map((item) => {
                          // Obtener el concepto (priorizar relación tipoCargo del API para que Alquiler y otros inactivos muestren nombre)
                          let concepto;
                          if (item.contratoGastoInicial?.tipoGastoInicial) {
                            // Es un gasto inicial del contrato
                            concepto = item.contratoGastoInicial.tipoGastoInicial.nombre || item.contratoGastoInicial.tipoGastoInicial.codigo || 'Gasto inicial';
                          } else if (item.propiedadImpuesto?.tipoImpuesto) {
                            concepto = getAbreviatura(tipoImpuestoMap, item.propiedadImpuesto.tipoImpuesto.id);
                          } else if (item.tipoCargo?.id === tipoCargoExpensasId && item.tipoExpensa) {
                            concepto = `Expensas ${item.tipoExpensa.nombre || (item.tipoExpensa.codigo === 'ORD' ? 'Ordinarias' : 'Extraordinarias')}`;
                          } else {
                            concepto = (item.tipoCargo?.nombre || item.tipoCargo?.codigo) || getDescripcion(tipoCargoMap, item.tipoCargo?.id || item.tipoCargoId) || '-';
                          }
                          const codigoResponsable = item.quienSoportaCosto?.codigo;
                          const codigoPagadoPor = item.pagadoPorActor?.codigo;
                          const importeNum = item.importe != null ? parseFloat(item.importe) : 0;
                          const esInquilinoResponsable = codigoResponsable === 'INQ';
                          const esPropietarioResponsable = codigoResponsable === 'PROP';
                          // Inquilino pagó algo que corresponde al propietario → restar al inquilino (reintegro) y sumar al propietario
                          const inquilinoPagoPorPropietario = esPropietarioResponsable && codigoPagadoPor === 'INQ';
                          let importeInquilino = '-';
                          let importePropietario = '-';
                          if (esInquilinoResponsable) {
                            importeInquilino = formatoMoneda(item.importe);
                            totalInquilino += importeNum;
                          } else if (inquilinoPagoPorPropietario) {
                            importeInquilino = formatoMoneda(-importeNum);
                            importePropietario = formatoMoneda(item.importe);
                            totalInquilino -= importeNum;
                            totalPropietario += importeNum;
                          } else if (esPropietarioResponsable) {
                            importePropietario = formatoMoneda(item.importe);
                            totalPropietario += importeNum;
                          }
                          const esNegativoInquilino = inquilinoPagoPorPropietario;
                          return (
                            <TableRow key={item.id}>
                              <TableCell padding="none">{concepto}</TableCell>
                              {tieneContratoVigente && (
                                <TableCell padding="none" align="right" sx={{ bgcolor: 'rgba(25, 118, 210, 0.04)', ...(esNegativoInquilino && { color: 'error.main', fontWeight: 500 }) }}>{importeInquilino}</TableCell>
                              )}
                              <TableCell padding="none" align="right" sx={{ bgcolor: 'rgba(46, 125, 50, 0.04)' }}>{importePropietario}</TableCell>
                              <TableCell padding="none">{item.observaciones || '-'}</TableCell>
                            </TableRow>
                          );
                        });
                        return [
                          ...filas,
                          <TableRow key="total" sx={{ bgcolor: 'rgba(0, 0, 0, 0.02)' }}>
                            <TableCell padding="none"><strong>TOTAL</strong></TableCell>
                            {tieneContratoVigente && (
                              <TableCell padding="none" align="right" sx={{ bgcolor: 'rgba(25, 118, 210, 0.08)', ...(totalInquilino < 0 && { color: 'error.main' }) }}><strong>{formatoMoneda(totalInquilino)}</strong></TableCell>
                            )}
                            <TableCell padding="none" align="right" sx={{ bgcolor: 'rgba(46, 125, 50, 0.08)' }}><strong>{formatoMoneda(totalPropietario)}</strong></TableCell>
                            <TableCell padding="none" />
                          </TableRow>
                        ];
                      })()}
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
