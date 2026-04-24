import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  TextField,
  Alert,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Snackbar,
  Switch,
  FormControlLabel,
  InputAdornment,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  Pagination,
  Tabs,
  Tab,
  Fab
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SyncIcon from '@mui/icons-material/Sync';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { liquidacionApi } from '../api/liquidacion';
import api from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import RequirePermission from '../components/RequirePermission';
import TablaImpuestos from '../components/Pendientes/TablaImpuestos';
import TablaExpensas from '../components/Pendientes/TablaExpensas';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

const AGUAS_DESHABILITADO_MSG = 'El autocompletado de Aguas Santafesinas esta temporalmente deshabilitado.';

// Función helper para convertir MM-AAAA a YYYY-MM (para enviar al backend)
const periodoToBackend = (periodo) => {
  if (!periodo) return null;
  // Si está en formato MM-AAAA, convertir a YYYY-MM
  if (/^\d{2}-\d{4}$/.test(periodo)) {
    return periodo.replace(/^(\d{2})-(\d{4})$/, '$2-$1');
  }
  // Si ya está en formato YYYY-MM, devolverlo tal cual
  if (/^\d{4}-\d{2}$/.test(periodo)) {
    return periodo;
  }
  return periodo;
};

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

// Parsea importe en formato es-AR (punto miles, coma decimal) o número simple
const parseImporteFormatted = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  if (!str) return null;
  if (str.includes(',')) {
    const [intPart, decPart = ''] = str.split(',');
    const integer = intPart.replace(/\./g, '');
    const cleaned = decPart ? `${integer}.${decPart}` : integer;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return parseFloat(str) || null;
};

export default function PendientesImpuestos() {
  const [searchParams] = useSearchParams();

  const [periodo, setPeriodo] = useState(() => {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  });
  const [periodoDate, setPeriodoDate] = useState(() => dayjs());
  const [tipoImpuesto, setTipoImpuesto] = useState('');
  const [search, setSearch] = useState('');

  // Inicializar periodo y search desde la URL si existen
  useEffect(() => {
    const p = searchParams.get('periodo');
    const s = searchParams.get('search');
    if (p) {
      setPeriodo(p);
      setPeriodoDate(dayjs(p + '-01').isValid() ? dayjs(p + '-01') : dayjs());
    }
    if (s != null && s !== '') {
      setSearch(decodeURIComponent(s));
    }
  }, [searchParams]);
  const [generarDialog, setGenerarDialog] = useState(false);
  const [periodoGenerar, setPeriodoGenerar] = useState(() => {
    const ahora = new Date();
    const month = String(ahora.getMonth() + 1).padStart(2, '0');
    const year = ahora.getFullYear();
    return `${month}-${year}`; // MM-AAAA
  });
  const [periodoGenerarDate, setPeriodoGenerarDate] = useState(() => dayjs());
  const [importesEditados, setImportesEditados] = useState({}); // Estado para almacenar importes editados por itemId
  // Estado para controlar acordeones expandidos - por defecto todos colapsados
  const [expandedAccordions, setExpandedAccordions] = useState({});
  const [tabValue, setTabValue] = useState(0); // 0 = Impuestos, 1 = Expensas
  const [actoresEditados, setActoresEditados] = useState({}); // Estado para actores editados en expensas { itemId: { actorFacturadoId, quienSoportaCostoId } }
  const [pagadoPorEditado, setPagadoPorEditado] = useState({}); // Estado para "Pagado por" editado { itemId: pagadoPorActorId }
  const [quienSoportaCostoEditado, setQuienSoportaCostoEditado] = useState({}); // Estado para "Cobrar a" editado { itemId: quienSoportaCostoId }
  const [verCompletados, setVerCompletados] = useState(false); // Switch para mostrar completados
  const [camposEnFoco, setCamposEnFoco] = useState({}); // Estado para rastrear qué campos están en foco { itemId: true }

  // Cambios pendientes de guardar (batch). Forma: { [itemId]: { importe?, pagadoPorActorId?, quienSoportaCostoId?, actorFacturadoId?, vencimiento? } }
  const [cambiosPendientes, setCambiosPendientes] = useState({});
  // Estados para UI (errores de validación, etc.)
  const [itemsSaving, setItemsSaving] = useState({}); // solo durante batch save
  const [itemsError, setItemsError] = useState({}); // { itemId: true } - items con error
  const [valoresOriginales, setValoresOriginales] = useState({}); // { itemId: valor } - valores al entrar en focus

  // Refs para navegación por teclado entre inputs
  const importeInputRefs = useRef({});

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [confirmarAutocompletar, setConfirmarAutocompletar] = useState(null); // { tipo: 'aguas'|'epe'|'litoralgas'|'siat', periodo: string }

  const [incidenciasDialogOpen, setIncidenciasDialogOpen] = useState(false);
  const [incidenciaForm, setIncidenciaForm] = useState({
    propiedadId: '',
    conceptoTipo: '', // '' | 'cargo-{id}' | 'impuesto-{id}'
    fechaGasto: null,
    pagadoPorActorId: '',
    quienSoportaCostoId: '',
    concepto: '',
    importe: ''
  });

  const queryClient = useQueryClient();

  const { data: propiedadesResponse } = useQuery({
    queryKey: ['propiedades-list'],
    queryFn: async () => {
      const response = await api.get('/propiedades?limit=500');
      return response.data;
    },
    enabled: incidenciasDialogOpen
  });
  const propiedadesList = useMemo(() => {
    const data = propiedadesResponse?.data ?? propiedadesResponse;
    return Array.isArray(data) ? data : [];
  }, [propiedadesResponse]);

  const { data: tiposCargoResponse } = useQuery({
    queryKey: ['catalogos-abm', 'tipos-cargo-incidencias'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-cargo?mostrarInactivos=false');
      return response.data;
    },
    enabled: incidenciasDialogOpen
  });
  const tiposCargoList = useMemo(() => {
    const data = tiposCargoResponse?.data ?? tiposCargoResponse;
    return Array.isArray(data) ? data : [];
  }, [tiposCargoResponse]);

  const { data: tiposImpuestoResponse } = useQuery({
    queryKey: ['catalogos-abm', 'tipos-impuesto-incidencias'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-impuesto-propiedad?mostrarInactivos=false');
      return response.data;
    },
    enabled: incidenciasDialogOpen
  });
  const tiposImpuestoList = useMemo(() => {
    const data = tiposImpuestoResponse?.data ?? tiposImpuestoResponse;
    return Array.isArray(data) ? data : [];
  }, [tiposImpuestoResponse]);

  // Obtener actores responsables
  const { data: actoresResponse } = useQuery({
    queryKey: ['actores-responsable-contrato'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/actores-responsable-contrato');
      return Array.isArray(response.data) ? response.data : (response.data?.data || []);
    }
  });

  const actores = useMemo(() => {
    if (!actoresResponse) return [];
    return Array.isArray(actoresResponse)
      ? actoresResponse.filter(a => a.activo === true)
      : [];
  }, [actoresResponse]);

  // IDs de actores INQ/PROP para filtrar por id (código es editable por el usuario)
  const actorInqId = actores?.find((a) => a.codigo === 'INQ')?.id;
  const actorPropId = actores?.find((a) => a.codigo === 'PROP')?.id;

  // Obtener impuestos pendientes (nuevo endpoint que ya viene agrupado)
  const { data: impuestosPendientes, isLoading, refetch } = useQuery({
    queryKey: ['impuestos-pendientes', periodo, verCompletados],
    queryFn: async () => {
      return await liquidacionApi.getImpuestosPendientes(periodo || null, verCompletados);
    }
  });

  // Consultar items completados cuando no hay pendientes (para mostrar mensaje apropiado)
  const { data: impuestosCompletados } = useQuery({
    queryKey: ['impuestos-completados', periodo],
    queryFn: async () => {
      if (!periodo) return null;
      return await liquidacionApi.getImpuestosPendientes(periodo || null, true);
    },
    enabled: !!periodo && (!impuestosPendientes || !impuestosPendientes.impuestos || impuestosPendientes.impuestos.length === 0)
  });

  // Extraer impuestos y expensas de la respuesta
  const impuestosData = useMemo(() => {
    if (!impuestosPendientes) return [];
    return impuestosPendientes.impuestos || impuestosPendientes || [];
  }, [impuestosPendientes]);

  const expensasData = useMemo(() => {
    if (!impuestosPendientes) return [];
    return impuestosPendientes.expensas || [];
  }, [impuestosPendientes]);

  // Verificar si hay items completados cuando no hay pendientes
  const hayItemsCompletados = useMemo(() => {
    if (!impuestosCompletados) return false;
    const impuestos = impuestosCompletados.impuestos || [];
    const expensas = impuestosCompletados.expensas || [];

    // Verificar si hay items completados en impuestos
    const totalItemsImpuestos = impuestos.reduce((total, grupo) => total + (grupo.items || []).length, 0);
    const totalItemsExpensas = expensas.length;

    return totalItemsImpuestos > 0 || totalItemsExpensas > 0;
  }, [impuestosCompletados]);

  // Verificar si hay expensas completadas cuando no hay pendientes
  const hayExpensasCompletadas = useMemo(() => {
    if (!impuestosCompletados) return false;
    const expensas = impuestosCompletados.expensas || [];
    return expensas.length > 0;
  }, [impuestosCompletados]);

  // Un item es pendiente por su estado (estadoItem.codigo === 'PENDIENTE'), no por importe 0
  const esItemPendiente = (item) => {
    if (item.estadoItem?.codigo !== undefined) return item.estadoItem.codigo === 'PENDIENTE';
    const importe = item.importe;
    return importe === null || importe === undefined || importe === 0 || importe === '';
  };

  // Calcular cantidad de items pendientes de impuestos (por estado, no por importe)
  const cantidadImpuestosPendientes = useMemo(() => {
    if (!impuestosData || !Array.isArray(impuestosData)) return 0;
    return impuestosData.reduce((total, grupo) => {
      const items = grupo.items || [];
      const pendientes = items.filter(esItemPendiente);
      return total + pendientes.length;
    }, 0);
  }, [impuestosData]);

  // Calcular cantidad de items pendientes de expensas (por estado)
  const cantidadExpensasPendientes = useMemo(() => {
    if (!expensasData || !Array.isArray(expensasData)) return 0;
    return expensasData.reduce((total, expensa) => {
      let pendientes = 0;
      const ordPendiente = expensa.estadoItemORD ? expensa.estadoItemORD.codigo === 'PENDIENTE' : (expensa.importeORD === null || expensa.importeORD === undefined || expensa.importeORD === 0 || expensa.importeORD === '');
      const extPendiente = expensa.estadoItemEXT ? expensa.estadoItemEXT.codigo === 'PENDIENTE' : (expensa.importeEXT === null || expensa.importeEXT === undefined || expensa.importeEXT === 0 || expensa.importeEXT === '');
      if (expensa.itemIdORD && ordPendiente) pendientes++;
      if (expensa.itemIdEXT && extPendiente) pendientes++;
      return total + pendientes;
    }, 0);
  }, [expensasData]);

  // Auto-expandir accordions que tienen items pendientes
  useEffect(() => {
    if (!impuestosData || !Array.isArray(impuestosData)) return;

    const nuevosExpandidos = {};
    impuestosData.forEach(grupo => {
      const tipo = grupo.tipoImpuesto?.codigo || 'SIN_TIPO';
      const items = grupo.items || [];
      const tienePendientes = items.some(esItemPendiente);
      // Solo auto-expandir si tiene pendientes, mantener colapsado si no
      nuevosExpandidos[tipo] = tienePendientes;
    });

    setExpandedAccordions(prev => {
      // Solo actualizar si es la primera carga o cambió el período
      const keys = Object.keys(nuevosExpandidos);
      const prevKeys = Object.keys(prev);
      if (prevKeys.length === 0 || keys.some(k => prev[k] === undefined)) {
        return { ...prev, ...nuevosExpandidos };
      }
      return prev;
    });
  }, [impuestosData, periodo]);

  // Auto-expandir accordions de expensas que tienen items pendientes
  useEffect(() => {
    if (!expensasData || !Array.isArray(expensasData)) return;

    // Agrupar por propiedad para verificar pendientes
    const expensasPorPropiedad = {};
    expensasData.forEach(expensa => {
      const propiedadKey = expensa.propiedad || 'SIN_PROPIEDAD';
      if (!expensasPorPropiedad[propiedadKey]) {
        expensasPorPropiedad[propiedadKey] = [];
      }
      expensasPorPropiedad[propiedadKey].push(expensa);
    });

    const nuevosExpandidos = {};
    Object.entries(expensasPorPropiedad).forEach(([propiedad, expensas]) => {
      const tienePendientes = expensas.some(expensa => {
        const ordPendiente = expensa.estadoItemORD
          ? expensa.estadoItemORD.codigo === 'PENDIENTE'
          : (expensa.importeORD === null || expensa.importeORD === undefined || expensa.importeORD === 0 || expensa.importeORD === '');
        const extPendiente = expensa.estadoItemEXT
          ? expensa.estadoItemEXT.codigo === 'PENDIENTE'
          : (expensa.importeEXT === null || expensa.importeEXT === undefined || expensa.importeEXT === 0 || expensa.importeEXT === '');
        return (expensa.itemIdORD && ordPendiente) || (expensa.itemIdEXT && extPendiente);
      });
      nuevosExpandidos[propiedad] = tienePendientes;
    });

    setExpandedAccordions(prev => {
      const keys = Object.keys(nuevosExpandidos);
      const prevKeys = Object.keys(prev);
      if (prevKeys.length === 0 || keys.some(k => prev[k] === undefined)) {
        return { ...prev, ...nuevosExpandidos };
      }
      return prev;
    });
  }, [expensasData, periodo]);

  // Filtrar y procesar datos de impuestos según filtros
  const itemsAgrupados = useMemo(() => {
    if (!impuestosData || !Array.isArray(impuestosData)) return {};

    // Filtrar por tipo de impuesto si está seleccionado
    let gruposFiltrados = impuestosData;
    if (tipoImpuesto) {
      gruposFiltrados = gruposFiltrados.filter(
        grupo => grupo.tipoImpuesto?.codigo === tipoImpuesto
      );
    }

    // Filtrar por búsqueda (propiedad o inquilino), tolerando valores nulos
    const searchTrimmed = (search || '').trim();
    if (searchTrimmed) {
      const searchLower = searchTrimmed.toLowerCase();
      gruposFiltrados = gruposFiltrados.map(grupo => ({
        ...grupo,
        items: (grupo.items || []).filter(item => {
          const propiedadStr = (item.propiedad ?? '').toString().toLowerCase();
          const inquilinoStr = (item.inquilino ?? '').toString().toLowerCase();
          return propiedadStr.includes(searchLower) || inquilinoStr.includes(searchLower);
        })
      })).filter(grupo => (grupo.items || []).length > 0);
    }

    // Convertir a objeto para mantener compatibilidad con el código existente
    const agrupados = {};
    gruposFiltrados.forEach(grupo => {
      const codigo = grupo.tipoImpuesto?.codigo || 'SIN_TIPO';
      agrupados[codigo] = grupo.items || [];
    });

    return agrupados;
  }, [impuestosData, tipoImpuesto, search]);

  // Agrupar expensas por propiedad
  const expensasAgrupadas = useMemo(() => {
    if (!expensasData || !Array.isArray(expensasData)) return {};

    // Filtrar por búsqueda si existe, tolerando valores nulos
    let expensasFiltradas = expensasData;
    const searchTrimmedExp = (search || '').trim();
    if (searchTrimmedExp) {
      const searchLower = searchTrimmedExp.toLowerCase();
      expensasFiltradas = expensasData.filter(expensa => {
        const propiedadStr = (expensa.propiedad ?? '').toString().toLowerCase();
        const inquilinoStr = (expensa.inquilino ?? '').toString().toLowerCase();
        return propiedadStr.includes(searchLower) || inquilinoStr.includes(searchLower);
      });
    }

    // Agrupar por propiedad
    const agrupadas = {};
    expensasFiltradas.forEach(expensa => {
      const propiedadKey = expensa.propiedad || 'SIN_PROPIEDAD';
      if (!agrupadas[propiedadKey]) {
        agrupadas[propiedadKey] = [];
      }
      agrupadas[propiedadKey].push(expensa);
    });

    return agrupadas;
  }, [expensasData, search]);

  // Lista de propiedades para iterar
  const propiedadesExpensas = useMemo(() => {
    return Object.keys(expensasAgrupadas).sort();
  }, [expensasAgrupadas]);

  // Obtener lista de tipos de impuesto para el filtro
  const tiposImpuesto = useMemo(() => {
    if (!impuestosData || !Array.isArray(impuestosData)) return [];
    return impuestosData
      .map(grupo => grupo.tipoImpuesto?.codigo)
      .filter(Boolean)
      .sort();
  }, [impuestosData]);

  // Colapsar acordeones solo cuando el usuario cambia período o "Ver completados" (no al refetch tras guardar)
  useEffect(() => {
    setExpandedAccordions({});
  }, [periodo, verCompletados]);

  // Cuando hay búsqueda, auto-expandir los acordeones que tienen resultados para que se vean visualmente
  useEffect(() => {
    const searchTrimmed = (search || '').trim();
    if (!searchTrimmed) return;

    setExpandedAccordions(prev => {
      const next = { ...prev };
      Object.keys(itemsAgrupados).forEach(k => { next[k] = true; });
      Object.keys(expensasAgrupadas).forEach(k => { next[k] = true; });
      return next;
    });
  }, [search, itemsAgrupados, expensasAgrupadas]);

  // Inicializar valores editados cuando se cargan los datos
  useEffect(() => {
    if (impuestosData && impuestosData.length > 0) {

      // Inicializar valores editados con importe para items pendientes
      setImportesEditados(prev => {
        const nuevos = { ...prev };
        let hayCambios = false;

        impuestosData.forEach(grupo => {
          (grupo.items || []).forEach(item => {
            // Todos los items del nuevo endpoint están pendientes
            const valorActual = prev[item.itemId];
            const valorNuevo = item.importe !== null && item.importe !== undefined
              ? item.importe.toString()
              : '';

            // Si no existe en el estado previo, inicializar
            if (valorActual === undefined || valorActual === null) {
              nuevos[item.itemId] = valorNuevo;
              hayCambios = true;
            }
          });
        });

        // También inicializar expensas
        Object.values(expensasAgrupadas).forEach(expensasGrupo => {
          expensasGrupo.forEach(expensa => {
            if (expensa.itemIdORD) {
              const valorActualORD = prev[expensa.itemIdORD];
              const valorNuevoORD = expensa.importeORD !== null && expensa.importeORD !== undefined
                ? expensa.importeORD.toString()
                : '';
              if (valorActualORD === undefined || valorActualORD === null) {
                nuevos[expensa.itemIdORD] = valorNuevoORD;
                hayCambios = true;
              }
            }
            if (expensa.itemIdEXT) {
              const valorActualEXT = prev[expensa.itemIdEXT];
              const valorNuevoEXT = expensa.importeEXT !== null && expensa.importeEXT !== undefined
                ? expensa.importeEXT.toString()
                : '';
              if (valorActualEXT === undefined || valorActualEXT === null) {
                nuevos[expensa.itemIdEXT] = valorNuevoEXT;
                hayCambios = true;
              }
            }
          });
        });

        return hayCambios ? nuevos : prev;
      });


      // Inicializar actores editados en expensas
      setActoresEditados(prev => {
        const nuevos = { ...prev };
        let hayCambios = false;

        Object.values(expensasAgrupadas).forEach(expensasGrupo => {
          expensasGrupo.forEach(expensa => {
            if (expensa.itemIdORD) {
              const actoresActuales = prev[expensa.itemIdORD];
              if (!actoresActuales) {
                nuevos[expensa.itemIdORD] = {
                  pagadoPorActorId: expensa.pagadoPorActorIdORD || null,
                  quienSoportaCostoId: expensa.quienSoportaCostoIdORD || null
                };
                hayCambios = true;
              }
            }
            if (expensa.itemIdEXT) {
              const actoresActuales = prev[expensa.itemIdEXT];
              if (!actoresActuales) {
                nuevos[expensa.itemIdEXT] = {
                  pagadoPorActorId: expensa.pagadoPorActorIdEXT || null,
                  quienSoportaCostoId: expensa.quienSoportaCostoIdEXT || null
                };
                hayCambios = true;
              }
            }
          });
        });

        return hayCambios ? nuevos : prev;
      });
    }
  }, [impuestosData, expensasAgrupadas, itemsAgrupados, propiedadesExpensas]);

  // Mutation para completar un solo item (usado por el diálogo de confirmar importe 0)
  const completarMutation = useMutation({
    mutationFn: ({ itemId, importe, actorFacturadoId = null, quienSoportaCostoId = null, pagadoPorActorId = null, vencimiento = null }) =>
      liquidacionApi.completarImporteItem(itemId, importe, actorFacturadoId, quienSoportaCostoId, pagadoPorActorId, vencimiento),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['impuestos-pendientes']);
      queryClient.invalidateQueries(['liquidaciones']);
      setImportesEditados(prev => { const n = { ...prev }; delete n[variables.itemId]; return n; });
      setActoresEditados(prev => { const n = { ...prev }; delete n[variables.itemId]; return n; });
      setPagadoPorEditado(prev => { const n = { ...prev }; delete n[variables.itemId]; return n; });
      setQuienSoportaCostoEditado(prev => { const n = { ...prev }; delete n[variables.itemId]; return n; });
      setCambiosPendientes(prev => { const n = { ...prev }; delete n[variables.itemId]; return n; });
      setSuccessMessage('Importe completado exitosamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || error.response?.data?.detalles || 'Error al completar el importe');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  /** Construye el array de ítems para el endpoint batch desde cambiosPendientes. */
  const buildBatchPayload = () => {
    return Object.entries(cambiosPendientes)
      .map(([id, c]) => {
        const itemId = parseInt(id, 10);
        if (isNaN(itemId)) return null;
        const importeVal = c.importe !== undefined && c.importe !== null && c.importe !== ''
          ? (typeof c.importe === 'string' ? parseImporteFormatted(c.importe) : c.importe)
          : (c.importe === '' || c.importe === null ? 0 : undefined);
        return {
          itemId,
          ...(importeVal !== undefined && { importe: importeVal ?? 0 }),
          ...(c.pagadoPorActorId !== undefined && { pagadoPorActorId: c.pagadoPorActorId || null }),
          ...(c.quienSoportaCostoId !== undefined && { quienSoportaCostoId: c.quienSoportaCostoId || null }),
          ...(c.actorFacturadoId !== undefined && { actorFacturadoId: c.actorFacturadoId || null }),
          ...(c.vencimiento !== undefined && { vencimiento: c.vencimiento || null })
        };
      })
      .filter(Boolean)
      .filter(item => Object.keys(item).length > 1); // al menos itemId + un campo
  };

  const batchMutation = useMutation({
    mutationFn: (items) => liquidacionApi.completarImportesBatch(items),
    onSuccess: (data, itemsEnviados) => {
      queryClient.invalidateQueries(['impuestos-pendientes']);
      queryClient.invalidateQueries(['liquidaciones']);
      const ids = (itemsEnviados || []).map(i => i.itemId);
      setCambiosPendientes(prev => {
        const n = { ...prev };
        ids.forEach(id => delete n[id]);
        return n;
      });
      setImportesEditados(prev => { const n = { ...prev }; ids.forEach(id => delete n[id]); return n; });
      setActoresEditados(prev => { const n = { ...prev }; ids.forEach(id => delete n[id]); return n; });
      setPagadoPorEditado(prev => { const n = { ...prev }; ids.forEach(id => delete n[id]); return n; });
      setQuienSoportaCostoEditado(prev => { const n = { ...prev }; ids.forEach(id => delete n[id]); return n; });
      setSuccessMessage(data?.actualizados ? `Se guardaron ${data.actualizados} ítem(s) correctamente.` : 'Cambios guardados.');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || error.response?.data?.detalles || 'Error al guardar en lote');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const handleGuardarCambiosMultiples = () => {
    const payload = buildBatchPayload();
    if (payload.length === 0) return;
    const conCero = payload.filter(p => p.importe === 0);
    if (conCero.length > 0) {
      setConfirmImporteCeroPayload({ batch: true, items: payload });
      setConfirmImporteCeroOpen(true);
      return;
    }
    batchMutation.mutate(payload);
  };

  // Función para ejecutar todos los scrapers en secuencia
  const ejecutarScrapers = async (periodoFormato, setMensajeProgreso) => {
    const resultados = {
      aguas: null,
      epe: null,
      litoralgas: null,
      siat: null,
      santafe: null
    };
    const errores = [];

    try {
      resultados.aguas = {
        actualizados: 0,
        deshabilitado: true
      };
      errores.push(`Aguas Santafesinas: ${AGUAS_DESHABILITADO_MSG}`);

      // EPE
      try {
        setMensajeProgreso('Sincronizando con E.P.E. ...');
        console.log('[Generar] Ejecutando scraper EPE...');
        const resEpe = await api.post('/liquidaciones/impuestos/epe/autocompletar', { periodo: periodoFormato });
        resultados.epe = resEpe.data;
        console.log('[Generar] EPE completado:', resultados.epe);
      } catch (error) {
        console.error('[Generar] Error en EPE:', error);
        const msg = error.response?.data?.error || error.response?.data?.detalle || error.message || 'Error desconocido';
        errores.push(`EPE: ${msg} (puede ser mantenimiento del sitio; puede completar Luz manualmente después)`);
      }

      // Litoralgas
      try {
        setMensajeProgreso('Sincronizando con  Litoral Gas...');
        console.log('[Generar] Ejecutando scraper Litoralgas...');
        const resLitoralgas = await api.post('/liquidaciones/impuestos/litoralgas/autocompletar', { periodo: periodoFormato });
        resultados.litoralgas = resLitoralgas.data;
        console.log('[Generar] Litoralgas completado:', resultados.litoralgas);
      } catch (error) {
        console.error('[Generar] Error en Litoralgas:', error);
        errores.push(`Litoralgas: ${error.response?.data?.error || error.message}`);
      }

      // TGI
      try {
        setMensajeProgreso('Sincronizando con TGI...');
        console.log('[Generar] Ejecutando scraper TGI...');
        const resTgi = await api.post('/liquidaciones/impuestos/tgi/autocompletar', { periodo: periodoFormato });
        resultados.siat = resTgi.data;
        console.log('[Generar] TGI completado:', resultados.siat);
      } catch (error) {
        console.error('[Generar] Error en TGI:', error);
        errores.push(`TGI: ${error.response?.data?.error || error.message}`);
      }

      // API (Santa Fe e-in-boletas). Solo períodos 02, 04, 06 de 2026.
      try {
        setMensajeProgreso('Sincronizando con API...');
        console.log('[Generar] Ejecutando scraper API...');
        const resSantafe = await api.post('/liquidaciones/impuestos/santafe-ein-boletas/autocompletar', { periodo: periodoFormato });
        resultados.santafe = resSantafe.data;
        console.log('[Generar] API completado:', resultados.santafe);
      } catch (error) {
        console.error('[Generar] Error en API:', error);
        errores.push(`API: ${error.response?.data?.error || error.message}`);
      }

      setMensajeProgreso('Finalizando...');
      return { resultados, errores };
    } catch (error) {
      console.error('[Generar] Error general en scrapers:', error);
      errores.push(`Error general: ${error.message}`);
      return { resultados, errores };
    }
  };

  // Mutation para generar liquidaciones de impuestos (nuevo endpoint)
  const generarMutation = useMutation({
    mutationFn: async (periodoGen) => {
      // Primero generar los items
      setMensajeProgreso('Generando impuestos...');
      const data = await liquidacionApi.generarImpuestos(periodoGen);

      // Convertir período a formato MM-YYYY para los scrapers
      const periodoFormato = formatPeriodo(periodoGen);

      // Luego ejecutar los scrapers
      const { resultados, errores } = await ejecutarScrapers(periodoFormato, setMensajeProgreso);

      return { ...data, scrapers: resultados, erroresScrapers: errores };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['impuestos-pendientes']);
      queryClient.invalidateQueries(['liquidaciones']);
      setGenerarDialog(false);
      setProgresoDialog(false);

      const resumen = {
        creadas: data.creadas || 0,
        itemsCreados: data.itemsCreados || 0,
        errores: data.errores || 0
      };

      // Resumen de scrapers
      const totalActualizados =
        (data.scrapers?.aguas?.actualizados || 0) +
        (data.scrapers?.epe?.actualizados || 0) +
        (data.scrapers?.litoralgas?.actualizados || 0) +
        (data.scrapers?.siat?.actualizados || 0) +
        (data.scrapers?.santafe?.actualizados || 0);

      let mensaje = `Generación completada:\n• Liquidaciones creadas/reutilizadas: ${resumen.creadas}\n• Items de impuestos creados: ${resumen.itemsCreados}\n• Errores en generación: ${resumen.errores}`;

      if (totalActualizados > 0) {
        mensaje += `\n\nAutocompletado de importes:\n• Total items actualizados: ${totalActualizados}`;
        if (data.scrapers?.aguas?.actualizados) mensaje += `\n  - Aguas Santafesinas: ${data.scrapers.aguas.actualizados}`;
        if (data.scrapers?.epe?.actualizados) mensaje += `\n  - EPE: ${data.scrapers.epe.actualizados}`;
        if (data.scrapers?.litoralgas?.actualizados) mensaje += `\n  - Litoralgas: ${data.scrapers.litoralgas.actualizados}`;
        if (data.scrapers?.siat?.actualizados) mensaje += `\n  - TGI: ${data.scrapers.siat.actualizados}`;
        if (data.scrapers?.santafe?.actualizados) mensaje += `\n  - API: ${data.scrapers.santafe.actualizados}`;
      }

      // Si no se crearon items y no hay errores, es porque ya están todos generados
      if (resumen.itemsCreados === 0 && resumen.errores === 0) {
        setSuccessMessage('No se generaron items porque no hay pendientes para el período seleccionado. Todas las propiedades ya tienen sus liquidaciones e items generados.');
        setSnackbarSeverity('info');
      } else if (data.erroresScrapers && data.erroresScrapers.length > 0) {
        mensaje += `\n\nAlgunos proveedores no pudieron sincronizar (ej. sitio en mantenimiento):\n${data.erroresScrapers.map(e => `• ${e}`).join('\n')}`;
        mensaje += '\n\nLa generación se completó correctamente; puede completar esos importes manualmente después.';
        setSuccessMessage(mensaje);
        setSnackbarSeverity('warning');
      } else {
        setSuccessMessage(mensaje);
        setSnackbarSeverity('success');
      }

      setSnackbarOpen(true);
    },
    onError: (error) => {
      setProgresoDialog(false);
      const data = error.response?.data || {};
      const detalle = data.detalles || data.error;
      const bloqueantes = data.contratosBloqueantes;
      const ajustesVencidos = data.ajustesVencidos;
      let msg = detalle || 'Error al generar liquidaciones de impuestos';
      if (bloqueantes?.length) msg += ` (${bloqueantes.length} contrato(s) con fechas pendientes)`;
      if (ajustesVencidos?.length) msg += ` (${ajustesVencidos.length} ajuste(s) vencidos sin cargar monto)`;
      setErrorMessage(msg);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  // Mutation para autocompletar desde Aguas Santafesinas
  const autocompletarAguasMutation = useMutation({
    mutationFn: (periodoAguas) =>
      api.post('/liquidaciones/impuestos/aguas/autocompletar', { periodo: periodoAguas }),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['impuestos-pendientes']);
      queryClient.invalidateQueries(['liquidaciones']);

      const resumen = {
        actualizados: data.data?.actualizados || 0,
        sinFacturaEnPeriodo: data.data?.sinFacturaEnPeriodo || [],
        sinMatchPunto: data.data?.sinMatchPunto || [],
        warnings: data.data?.warnings || [],
        errores: data.data?.errores || []
      };

      let mensaje = `Autocompletado Aguas Santafesinas completado:\n• Items actualizados: ${resumen.actualizados}`;

      if (resumen.sinFacturaEnPeriodo.length > 0) {
        mensaje += `\n• Puntos sin factura en período: ${resumen.sinFacturaEnPeriodo.join(', ')}`;
      }

      if (resumen.sinMatchPunto.length > 0) {
        mensaje += `\n• Puntos en Aguas Santafesinas sin configurar: ${resumen.sinMatchPunto.join(', ')}`;
      }

      if (resumen.warnings.length > 0) {
        mensaje += `\n• Advertencias: ${resumen.warnings.join('; ')}`;
      }

      if (resumen.errores.length > 0) {
        mensaje += `\n• Errores: ${resumen.errores.join('; ')}`;
        setSnackbarSeverity('warning');
      } else {
        setSnackbarSeverity('success');
      }

      setConfirmarAutocompletar(null);
      setSuccessMessage(mensaje);
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setConfirmarAutocompletar(null);
      setErrorMessage(error.response?.data?.error || AGUAS_DESHABILITADO_MSG);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  // Mutation para autocompletar desde EPE
  const autocompletarEpeMutation = useMutation({
    mutationFn: (periodoEpe) =>
      api.post('/liquidaciones/impuestos/epe/autocompletar', { periodo: periodoEpe }),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['impuestos-pendientes']);
      queryClient.invalidateQueries(['liquidaciones']);

      const resumen = {
        actualizados: data.data?.actualizados || 0,
        sinFacturaEnPeriodo: data.data?.sinFacturaEnPeriodo || [],
        sinMatchNroCliente: data.data?.sinMatchNroCliente || [],
        warnings: data.data?.warnings || [],
        errores: data.data?.errores || []
      };

      let mensaje = `Autocompletado EPE completado:\n• Items actualizados: ${resumen.actualizados}`;

      if (resumen.sinFacturaEnPeriodo.length > 0) {
        mensaje += `\n• Clientes sin factura en período: ${resumen.sinFacturaEnPeriodo.join(', ')}`;
      }

      if (resumen.sinMatchNroCliente.length > 0) {
        mensaje += `\n• Clientes en EPE sin configurar: ${resumen.sinMatchNroCliente.join(', ')}`;
      }

      if (resumen.warnings.length > 0) {
        mensaje += `\n• Advertencias: ${resumen.warnings.join('; ')}`;
      }

      if (resumen.errores.length > 0) {
        mensaje += `\n• Errores: ${resumen.errores.join('; ')}`;
        setSnackbarSeverity('warning');
      } else {
        setSnackbarSeverity('success');
      }

      setConfirmarAutocompletar(null);
      setSuccessMessage(mensaje);
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setConfirmarAutocompletar(null);
      setErrorMessage(error.response?.data?.error || 'Error al autocompletar desde EPE');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const handleAutocompletarAguas = () => {
    setErrorMessage(AGUAS_DESHABILITADO_MSG);
    setSnackbarSeverity('info');
    setSnackbarOpen(true);
    return;

    if (!periodo) {
      setErrorMessage('Debe seleccionar un período');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    // Convertir YYYY-MM a MM-YYYY para el backend
    const periodoAguas = formatPeriodo(periodo);

    if (!/^\d{2}-\d{4}$/.test(periodoAguas)) {
      setErrorMessage('El período debe tener el formato MM-YYYY');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    setConfirmarAutocompletar({ tipo: 'aguas', periodo: periodoAguas });
  };

  const handleAutocompletarEpe = () => {
    if (!periodo) {
      setErrorMessage('Debe seleccionar un período');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    // Convertir YYYY-MM a MM-YYYY para el backend
    const periodoEpe = formatPeriodo(periodo);

    if (!/^\d{2}-\d{4}$/.test(periodoEpe)) {
      setErrorMessage('El período debe tener el formato MM-YYYY');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    setConfirmarAutocompletar({ tipo: 'epe', periodo: periodoEpe });
  };

  // Mutation para autocompletar desde Litoralgas
  const autocompletarLitoralgasMutation = useMutation({
    mutationFn: (periodoLitoralgas) =>
      api.post('/liquidaciones/impuestos/litoralgas/autocompletar', { periodo: periodoLitoralgas }),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['impuestos-pendientes']);
      queryClient.invalidateQueries(['liquidaciones']);

      const resumen = {
        actualizados: data.data?.actualizados || 0,
        sinFacturaEnPeriodo: data.data?.sinFacturaEnPeriodo || [],
        sinMatchNroCli: data.data?.sinMatchNroCli || [],
        warnings: data.data?.warnings || [],
        errores: data.data?.errores || []
      };

      let mensaje = `Autocompletado Litoralgas completado:\n• Items actualizados: ${resumen.actualizados}`;

      if (resumen.sinFacturaEnPeriodo.length > 0) {
        mensaje += `\n• Clientes sin factura en período: ${resumen.sinFacturaEnPeriodo.join(', ')}`;
      }

      if (resumen.sinMatchNroCli.length > 0) {
        mensaje += `\n• Clientes en Litoralgas sin configurar: ${resumen.sinMatchNroCli.join(', ')}`;
      }

      if (resumen.warnings.length > 0) {
        mensaje += `\n• Advertencias: ${resumen.warnings.join('; ')}`;
      }

      if (resumen.errores.length > 0) {
        mensaje += `\n• Errores: ${resumen.errores.join('; ')}`;
        setSnackbarSeverity('warning');
      } else {
        setSnackbarSeverity('success');
      }

      setConfirmarAutocompletar(null);
      setSuccessMessage(mensaje);
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setConfirmarAutocompletar(null);
      setErrorMessage(error.response?.data?.error || 'Error al autocompletar desde Litoralgas');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const handleAutocompletarLitoralgas = () => {
    if (!periodo) {
      setErrorMessage('Debe seleccionar un período');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    // Convertir YYYY-MM a MM-YYYY para el backend
    const periodoLitoralgas = formatPeriodo(periodo);

    if (!/^\d{2}-\d{4}$/.test(periodoLitoralgas)) {
      setErrorMessage('El período debe tener el formato MM-YYYY');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    setConfirmarAutocompletar({ tipo: 'litoralgas', periodo: periodoLitoralgas });
  };

  // Mutation para autocompletar desde TGI
  const autocompletarSiatMutation = useMutation({
    mutationFn: (periodoSiat) =>
      api.post('/liquidaciones/impuestos/tgi/autocompletar', { periodo: periodoSiat }),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['impuestos-pendientes']);
      queryClient.invalidateQueries(['liquidaciones']);

      const resumen = {
        totalItems: data.data?.totalItems || 0,
        actualizados: data.data?.actualizados || 0,
        sinCredencialesPropiedad: data.data?.sinCredencialesPropiedad || [],
        sinLiqEnPeriodo: data.data?.sinLiqEnPeriodo || [],
        warnings: data.data?.warnings || [],
        errores: data.data?.errores || []
      };

      let mensaje = `Autocompletado TGI completado:\n• Items procesados: ${resumen.totalItems}\n• Items actualizados: ${resumen.actualizados}`;

      if (resumen.sinCredencialesPropiedad.length > 0) {
        mensaje += `\n• Propiedades sin credenciales (CTA/COD_GES): ${resumen.sinCredencialesPropiedad.join(', ')}`;
      }

      if (resumen.sinLiqEnPeriodo.length > 0) {
        mensaje += `\n• Propiedades sin liquidación en período: ${resumen.sinLiqEnPeriodo.join(', ')}`;
      }

      if (resumen.warnings.length > 0) {
        mensaje += `\n• Advertencias: ${resumen.warnings.join('; ')}`;
      }

      if (resumen.errores.length > 0) {
        mensaje += `\n• Errores: ${resumen.errores.map(e => `Propiedad ${e.propiedadImpuestoId}: ${e.mensaje}`).join('; ')}`;
        setSnackbarSeverity('warning');
      } else {
        setSnackbarSeverity('success');
      }

      setConfirmarAutocompletar(null);
      setSuccessMessage(mensaje);
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setConfirmarAutocompletar(null);
      setErrorMessage(error.response?.data?.error || 'Error al autocompletar TGI');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const handleAutocompletarSiat = () => {
    if (!periodo) {
      setErrorMessage('Debe seleccionar un período');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    // Convertir YYYY-MM a MM-YYYY para el backend
    const periodoSiat = formatPeriodo(periodo);

    if (!/^\d{2}-\d{4}$/.test(periodoSiat)) {
      setErrorMessage('El período debe tener el formato MM-YYYY');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    setConfirmarAutocompletar({ tipo: 'siat', periodo: periodoSiat });
  };

  const incidenciaFormReset = {
    propiedadId: '',
    conceptoTipo: '',
    fechaGasto: null,
    pagadoPorActorId: '',
    quienSoportaCostoId: '',
    concepto: '',
    importe: ''
  };

  const crearIncidenciaMutation = useMutation({
    mutationFn: ({ propiedadId, periodo, payload }) =>
      liquidacionApi.crearIncidencia(propiedadId, periodo, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['impuestos-pendientes']);
      queryClient.invalidateQueries(['liquidaciones']);
      setIncidenciasDialogOpen(false);
      setIncidenciaForm(incidenciaFormReset);
      setSuccessMessage('Incidencia cargada correctamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al cargar la incidencia');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const handleSubmitIncidencia = () => {
    const propiedadId = incidenciaForm.propiedadId ? parseInt(incidenciaForm.propiedadId, 10) : null;
    if (!propiedadId || !periodo) {
      setErrorMessage('Seleccione una propiedad y un período');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    const importeNum = parseImporteFormatted(incidenciaForm.importe);
    if (importeNum === null || importeNum < 0) {
      setErrorMessage('El importe debe ser un número mayor o igual a 0');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    const fechaGastoStr = incidenciaForm.fechaGasto
      ? (dayjs.isDayjs(incidenciaForm.fechaGasto) ? incidenciaForm.fechaGasto.format('YYYY-MM-DD') : incidenciaForm.fechaGasto)
      : undefined;
    const conceptoTipo = incidenciaForm.conceptoTipo || '';
    const tipoCargoId = conceptoTipo.startsWith('cargo-') ? conceptoTipo.slice(6) : undefined;
    const tipoImpuestoId = conceptoTipo.startsWith('impuesto-') ? conceptoTipo.slice(9) : undefined;
    crearIncidenciaMutation.mutate({
      propiedadId,
      periodo,
      payload: {
        concepto: incidenciaForm.concepto || '',
        importe: importeNum,
        tipoCargoId,
        tipoImpuestoId,
        fechaGasto: fechaGastoStr,
        pagadoPorActorId: incidenciaForm.pagadoPorActorId || undefined,
        quienSoportaCostoId: incidenciaForm.quienSoportaCostoId || undefined
      }
    });
  };

  const handleImporteChange = (itemId, value) => {
    setImportesEditados(prev => ({ ...prev, [itemId]: value }));
    setCambiosPendientes(prev => ({ ...prev, [itemId]: { ...prev[itemId], importe: value } }));
    if (itemsError[itemId]) {
      setItemsError(prev => {
        const nuevo = { ...prev };
        delete nuevo[itemId];
        return nuevo;
      });
    }
  };

  // Auto-guardado inteligente para un item
  const autoGuardarItem = async (item, options = {}) => {
    const { skipIfUnchanged = true, confirmZero = true, overrideActores = {} } = options;
    const itemId = item.itemId;

    // Obtener valores actuales
    let importeStr = importesEditados[itemId];
    if (importeStr === undefined || importeStr === '') {
      importeStr = item.importe !== null && item.importe !== undefined
        ? String(item.importe)
        : '0';
    }
    const importeNum = parseImporteFormatted(importeStr) ?? 0;

    // Validar
    if (importeNum === null || importeNum < 0) {
      setItemsError(prev => ({ ...prev, [itemId]: true }));
      return false;
    }

    // Usar override si se proporciona, sino tomar del estado editado, sino del item original
    const pagadoPorActorId = overrideActores.pagadoPorActorId !== undefined
      ? overrideActores.pagadoPorActorId
      : (pagadoPorEditado[itemId] !== undefined
        ? pagadoPorEditado[itemId]
        : (item.pagadoPorActorId || null));
    const quienSoportaCostoId = overrideActores.quienSoportaCostoId !== undefined
      ? overrideActores.quienSoportaCostoId
      : (quienSoportaCostoEditado[itemId] !== undefined
        ? quienSoportaCostoEditado[itemId]
        : (item.quienSoportaCostoId || null));

    // Verificar si hay cambios (comparar con valores originales del item)
    const importeOriginal = parseFloat(item.importe) || 0;
    const pagadoPorOriginal = item.pagadoPorActorId || null;
    const quienSoportaOriginal = item.quienSoportaCostoId || null;

    if (skipIfUnchanged &&
      importeNum === importeOriginal &&
      pagadoPorActorId === pagadoPorOriginal &&
      quienSoportaCostoId === quienSoportaOriginal) {
      return true; // No hay cambios, no guardar
    }

    const payload = {
      itemId: itemId,
      importe: importeNum,
      pagadoPorActorId: pagadoPorActorId,
      quienSoportaCostoId: quienSoportaCostoId
    };

    // Si el importe es 0 y confirmZero es true, mostrar confirmación
    if (importeNum === 0 && confirmZero) {
      setConfirmImporteCeroPayload(payload);
      setConfirmImporteCeroOpen(true);
      return false;
    }

    // Marcar como guardando
    setItemsSaving(prev => ({ ...prev, [itemId]: true }));
    setItemsError(prev => {
      const nuevo = { ...prev };
      delete nuevo[itemId];
      return nuevo;
    });

    try {
      await api.patch(`/liquidaciones/liquidacion-items/${itemId}`, {
        importe: importeNum,
        pagadoPorActorId,
        quienSoportaCostoId
      });

      // Éxito - limpiar estado de guardando
      setItemsSaving(prev => {
        const nuevo = { ...prev };
        delete nuevo[itemId];
        return nuevo;
      });

      // Refrescar datos
      queryClient.invalidateQueries(['impuestos-pendientes']);
      return true;
    } catch (error) {
      console.error('Error al auto-guardar item:', error);
      setItemsSaving(prev => {
        const nuevo = { ...prev };
        delete nuevo[itemId];
        return nuevo;
      });
      setItemsError(prev => ({ ...prev, [itemId]: true }));
      return false;
    }
  };

  // Función legacy para compatibilidad (usada por el diálogo de confirmación de importe 0)
  const handleCompletarItem = (item) => {
    autoGuardarItem(item, { skipIfUnchanged: false, confirmZero: true });
  };

  // Funciones para manejar expensas
  const handleImporteChangeExpensas = (itemId, value) => {
    setImportesEditados(prev => ({ ...prev, [itemId]: value }));
    setCambiosPendientes(prev => ({ ...prev, [itemId]: { ...prev[itemId], importe: value } }));
  };

  const handleActorChangeExpensas = (itemId, tipo, actorId) => {
    const val = actorId ? parseInt(actorId) : null;
    setActoresEditados(prev => ({ ...prev, [itemId]: { ...prev[itemId], [tipo]: val } }));
    setCambiosPendientes(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        ...(tipo === 'pagadoPorActorId' && { pagadoPorActorId: val }),
        ...(tipo === 'quienSoportaCostoId' && { quienSoportaCostoId: val })
      }
    }));
  };

  // Auto-guardado para expensas
  const autoGuardarExpensa = async (expensa, tipo, options = {}) => {
    const { skipIfUnchanged = true, confirmZero = true, overrideActores = {} } = options;
    const itemId = tipo === 'ORD' ? expensa.itemIdORD : expensa.itemIdEXT;
    if (!itemId) return false;

    // Obtener importe
    let importeStr = importesEditados[itemId];
    if (importeStr === undefined || importeStr === '') {
      const importeOriginal = tipo === 'ORD' ? expensa.importeORD : expensa.importeEXT;
      importeStr = importeOriginal !== null && importeOriginal !== undefined
        ? String(importeOriginal)
        : '0';
    }

    const importeNum = parseImporteFormatted(importeStr) ?? 0;
    if (importeNum === null || importeNum < 0) {
      setItemsError(prev => ({ ...prev, [itemId]: true }));
      return false;
    }

    const actoresItem = actoresEditados[itemId] || {};
    const pagadoPorActorId = overrideActores.pagadoPorActorId !== undefined
      ? overrideActores.pagadoPorActorId
      : (actoresItem.pagadoPorActorId !== undefined
        ? actoresItem.pagadoPorActorId
        : (tipo === 'ORD' ? expensa.pagadoPorActorIdORD : expensa.pagadoPorActorIdEXT));
    const quienSoportaCostoId = overrideActores.quienSoportaCostoId !== undefined
      ? overrideActores.quienSoportaCostoId
      : (actoresItem.quienSoportaCostoId !== undefined
        ? actoresItem.quienSoportaCostoId
        : (tipo === 'ORD' ? expensa.quienSoportaCostoIdORD : expensa.quienSoportaCostoIdEXT));

    // Verificar si hay cambios
    const importeOriginal = parseFloat(tipo === 'ORD' ? expensa.importeORD : expensa.importeEXT) || 0;
    const pagadoPorOriginal = (tipo === 'ORD' ? expensa.pagadoPorActorIdORD : expensa.pagadoPorActorIdEXT) || null;
    const quienSoportaOriginal = (tipo === 'ORD' ? expensa.quienSoportaCostoIdORD : expensa.quienSoportaCostoIdEXT) || null;

    if (skipIfUnchanged &&
      importeNum === importeOriginal &&
      pagadoPorActorId === pagadoPorOriginal &&
      quienSoportaCostoId === quienSoportaOriginal) {
      return true;
    }

    const payload = {
      itemId: itemId,
      importe: importeNum,
      pagadoPorActorId: pagadoPorActorId,
      quienSoportaCostoId: quienSoportaCostoId
    };

    if (importeNum === 0 && confirmZero) {
      setConfirmImporteCeroPayload(payload);
      setConfirmImporteCeroOpen(true);
      return false;
    }

    // Marcar como guardando
    setItemsSaving(prev => ({ ...prev, [itemId]: true }));
    setItemsError(prev => {
      const nuevo = { ...prev };
      delete nuevo[itemId];
      return nuevo;
    });

    try {
      await api.patch(`/liquidaciones/liquidacion-items/${itemId}`, {
        importe: importeNum,
        pagadoPorActorId,
        quienSoportaCostoId
      });

      setItemsSaving(prev => {
        const nuevo = { ...prev };
        delete nuevo[itemId];
        return nuevo;
      });

      queryClient.invalidateQueries(['impuestos-pendientes']);
      return true;
    } catch (error) {
      console.error('Error al auto-guardar expensa:', error);
      setItemsSaving(prev => {
        const nuevo = { ...prev };
        delete nuevo[itemId];
        return nuevo;
      });
      setItemsError(prev => ({ ...prev, [itemId]: true }));
      return false;
    }
  };

  // Función legacy para compatibilidad
  const handleCompletarItemExpensasIndividual = (expensa, tipo) => {
    autoGuardarExpensa(expensa, tipo, { skipIfUnchanged: false, confirmZero: true });
  };

  const handleAccordionChange = (tipoImpuesto) => (event, isExpanded) => {
    setExpandedAccordions(prev => ({
      ...prev,
      [tipoImpuesto]: isExpanded
    }));
  };

  const [progresoDialog, setProgresoDialog] = useState(false);
  const [mensajeProgreso, setMensajeProgreso] = useState('');
  const [confirmImporteCeroOpen, setConfirmImporteCeroOpen] = useState(false);
  const [confirmImporteCeroPayload, setConfirmImporteCeroPayload] = useState(null);

  const handleGenerar = async () => {
    // Validar formato MM-AAAA o YYYY-MM
    if (!periodoGenerar || (!/^\d{2}-\d{4}$/.test(periodoGenerar) && !/^\d{4}-\d{2}$/.test(periodoGenerar))) {
      setErrorMessage('El período debe tener el formato MM-AAAA (ej: 11-2025)');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    // Convertir a YYYY-MM para enviar al backend
    const periodoBackend = periodoToBackend(periodoGenerar);

    // Validar si ya hay items generados para este período
    try {
      setMensajeProgreso('Verificando items pendientes...');
      setProgresoDialog(true);
      setGenerarDialog(false);

      // Consultar si hay items pendientes para este período
      const response = await liquidacionApi.getImpuestosPendientes(periodoBackend, false);
      const impuestosData = response.impuestos || [];
      const expensasData = response.expensas || [];

      // Verificar si hay items pendientes
      let hayPendientes = false;

      // Verificar impuestos (por estado)
      for (const grupo of impuestosData) {
        const items = grupo.items || [];
        const pendientes = items.filter(esItemPendiente);
        if (pendientes.length > 0) {
          hayPendientes = true;
          break;
        }
      }

      // Verificar expensas si no hay pendientes en impuestos (por estado)
      if (!hayPendientes) {
        for (const expensa of expensasData) {
          const ordPendiente = expensa.estadoItemORD ? expensa.estadoItemORD.codigo === 'PENDIENTE' : (expensa.importeORD === null || expensa.importeORD === undefined || expensa.importeORD === 0 || expensa.importeORD === '');
          const extPendiente = expensa.estadoItemEXT ? expensa.estadoItemEXT.codigo === 'PENDIENTE' : (expensa.importeEXT === null || expensa.importeEXT === undefined || expensa.importeEXT === 0 || expensa.importeEXT === '');
          if ((expensa.itemIdORD && ordPendiente) || (expensa.itemIdEXT && extPendiente)) {
            hayPendientes = true;
            break;
          }
        }
      }

      // Si no hay items pendientes, verificar si hay items generados
      if (!hayPendientes) {
        // Contar total de items (completados y pendientes)
        const totalItems = impuestosData.reduce((total, grupo) => total + (grupo.items || []).length, 0) +
          expensasData.length;

        if (totalItems === 0) {
          // No hay items generados, proceder con la generación
          setMensajeProgreso('Generando impuestos...');
          generarMutation.mutate(periodoBackend);
        } else {
          // Ya hay items generados pero todos están completos
          setProgresoDialog(false);
          setSuccessMessage('No se generaron items porque no hay pendientes para el período seleccionado. Todas las propiedades ya tienen sus liquidaciones e items generados.');
          setSnackbarSeverity('info');
          setSnackbarOpen(true);
        }
      } else {
        // Hay items pendientes, proceder con la generación
        setMensajeProgreso('Generando impuestos...');
        generarMutation.mutate(periodoBackend);
      }
    } catch (error) {
      // Si hay error en la validación, proceder con la generación de todas formas
      console.error('Error al validar items pendientes:', error);
      setMensajeProgreso('Generando impuestos...');
      generarMutation.mutate(periodoBackend);
    }
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return '-';
    // Asegurar que sea un número (convertir string a número si es necesario)
    const numValue = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(numValue)) return '-';
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  };



  const autocompletarTitles = { aguas: 'Autocompletado de AGUA no disponible', epe: 'Autocompletar LUZ (EPE)', litoralgas: 'Autocompletar GAS (Litoralgas)', siat: 'Autocompletar TGI' };
  const autocompletarMessages = {
    aguas: (p) => `¿Desea autocompletar los importes de AGUA desde Aguas Santafesinas para el período ${p}?`,
    epe: (p) => `¿Desea autocompletar los importes de LUZ desde EPE para el período ${p}?`,
    litoralgas: (p) => `¿Desea autocompletar los importes de GAS desde Litoralgas para el período ${p}?`,
    siat: (p) => `¿Desea autocompletar los importes de TGI desde SIAT Rosario para el período ${p}?`
  };
  autocompletarMessages.aguas = () => AGUAS_DESHABILITADO_MSG;

  return (
    <Box sx={{ maxWidth: '100%', overflowX: 'hidden' }}>
      <ConfirmDialog
        open={!!confirmarAutocompletar}
        onClose={() => setConfirmarAutocompletar(null)}
        title={confirmarAutocompletar ? autocompletarTitles[confirmarAutocompletar.tipo] : ''}
        message={confirmarAutocompletar ? autocompletarMessages[confirmarAutocompletar.tipo]?.(confirmarAutocompletar.periodo) : ''}
        confirmLabel="Autocompletar"
        confirmColor="primary"
        loading={autocompletarAguasMutation.isPending || autocompletarEpeMutation.isPending || autocompletarLitoralgasMutation.isPending || autocompletarSiatMutation.isPending}
        onConfirm={() => {
          if (!confirmarAutocompletar) return;
          const { tipo, periodo } = confirmarAutocompletar;
          if (tipo === 'aguas') {
            setConfirmarAutocompletar(null);
            setErrorMessage(AGUAS_DESHABILITADO_MSG);
            setSnackbarSeverity('info');
            setSnackbarOpen(true);
          }
          else if (tipo === 'epe') autocompletarEpeMutation.mutate(periodo);
          else if (tipo === 'litoralgas') autocompletarLitoralgasMutation.mutate(periodo);
          else if (tipo === 'siat') autocompletarSiatMutation.mutate(periodo);
        }}
      />
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
        Carga de Impuestos
      </Typography>

      {/* TABS - Mismo estilo que Clientes */}
      <Paper sx={{ mb: { xs: 2, md: 3 } }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          aria-label="tabs de impuestos"
          variant="fullWidth"
        >
          <Tab
            label={
              <Box display="flex" alignItems="center" gap={0.5} sx={{ flexWrap: 'nowrap' }}>
                <ReceiptLongIcon fontSize="small" />
                <Typography variant="body2" component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Impuestos
                </Typography>
                <Typography variant="body2" component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  Imp.
                </Typography>
                {cantidadImpuestosPendientes > 0 && (
                  <Chip
                    label={cantidadImpuestosPendientes}
                    size="small"
                    color="warning"
                    sx={{ height: 20, '& .MuiChip-label': { px: 1 } }}
                  />
                )}
              </Box>
            }
            id="impuestos-tab-0"
            aria-controls="impuestos-tabpanel-0"
            sx={{ minHeight: { xs: 48, md: 64 }, px: { xs: 1, md: 2 } }}
          />
          <Tab
            label={
              <Box display="flex" alignItems="center" gap={0.5} sx={{ flexWrap: 'nowrap' }}>
                <HomeWorkIcon fontSize="small" />
                <Typography variant="body2" component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Expensas
                </Typography>
                <Typography variant="body2" component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  Exp.
                </Typography>
                {cantidadExpensasPendientes > 0 && (
                  <Chip
                    label={cantidadExpensasPendientes}
                    size="small"
                    color="warning"
                    sx={{ height: 20, '& .MuiChip-label': { px: 1 } }}
                  />
                )}
              </Box>
            }
            id="impuestos-tab-1"
            aria-controls="impuestos-tabpanel-1"
            sx={{ minHeight: { xs: 48, md: 64 }, px: { xs: 1, md: 2 } }}
          />
        </Tabs>
      </Paper>

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
          <TextField
            size="small"
            placeholder="Buscar por dirección o inquilino..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            sx={{ width: { xs: '100%', sm: 280 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />
          <DatePicker
            label="Período"
            views={['month', 'year']}
            openTo="month"
            value={periodoDate}
            onChange={(newValue) => {
              if (newValue) {
                setPeriodoDate(newValue);
                const year = newValue.year();
                const month = String(newValue.month() + 1).padStart(2, '0');
                setPeriodo(`${year}-${month}`);
              }
            }}
            format="MMMM YYYY"
            slotProps={{
              textField: {
                size: 'small',
                sx: { width: { xs: '100%', sm: 180 } }
              },
              actionBar: {
                actions: ['today']
              }
            }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={verCompletados}
                onChange={(e) => setVerCompletados(e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="body2">Ver completados</Typography>}
            sx={{ ml: 0 }}
          />
        </Box>
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1,
          width: { xs: '100%', md: 'auto' }
        }}>
          <RequirePermission codigo="impuestos.crear">
            <Button
              variant="outlined"
              size="small"
              onClick={() => setIncidenciasDialogOpen(true)}
              disabled={crearIncidenciaMutation.isPending}
              sx={{ height: 36, width: { xs: '100%', md: 'auto' } }}
            >
              Cargar Incidencia
            </Button>
          </RequirePermission>
          <RequirePermission codigo="impuestos.crear">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setGenerarDialog(true)}
              disabled={generarMutation.isPending}
              sx={{ height: 36, py: 0, px: 1.5, fontSize: '0.875rem', '& .MuiButton-startIcon': { marginRight: 0.5 }, width: { xs: '100%', md: 'auto' } }}
            >
              {generarMutation.isPending ? 'Generando...' : 'Generar Impuestos'}
            </Button>
          </RequirePermission>
          {Object.keys(cambiosPendientes).length > 0 && (
            <RequirePermission codigo="impuestos.editar">
              <Button
                variant="contained"
                color="secondary"
                startIcon={batchMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                onClick={handleGuardarCambiosMultiples}
                disabled={batchMutation.isPending}
                sx={{
                  height: 36,
                  py: 0,
                  px: 1.5,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  boxShadow: 2,
                  width: { xs: '100%', md: 'auto' }
                }}
              >
                {batchMutation.isPending ? 'Guardando...' : `Guardar Cambios (${Object.keys(cambiosPendientes).length})`}
              </Button>
            </RequirePermission>
          )}
        </Box>
      </Box>

      {/* Contenido según tab seleccionado */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : tabValue === 0 ? (
        // Tab de Impuestos
        (!impuestosData || impuestosData.length === 0) ? (
          hayItemsCompletados ? (
            <Alert severity="success" sx={{
              backgroundColor: '#d1fae5',
              border: '1px solid #10b981',
              '& .MuiAlert-icon': {
                color: '#059669'
              }
            }}>
              Todos los impuestos del período seleccionado ya fueron completados.
            </Alert>
          ) : (
            <Alert severity="info">
              Todavía no se generaron los impuestos para el período seleccionado. Utilice el botón "Generar Impuestos del Período" para crearlos.
            </Alert>
          )
        ) : (
          <TablaImpuestos
            impuestosData={impuestosData}
            tipoImpuesto={tipoImpuesto}
            expandedAccordions={expandedAccordions}
            onAccordionChange={handleAccordionChange}
            verCompletados={verCompletados}
            esItemPendiente={esItemPendiente}
            parseImporteFormatted={parseImporteFormatted}
            importesEditados={importesEditados}
            camposEnFoco={camposEnFoco}
            itemsError={itemsError}
            itemsSaving={itemsSaving}
            pagadoPorEditado={pagadoPorEditado}
            quienSoportaCostoEditado={quienSoportaCostoEditado}
            actores={actores}
            actorInqId={actorInqId}
            actorPropId={actorPropId}
            onImporteChange={handleImporteChange}
            onPagadoPorChange={(itemId, v) => {
              setPagadoPorEditado(prev => ({ ...prev, [itemId]: v }));
              setCambiosPendientes(prev => ({ ...prev, [itemId]: { ...prev[itemId], pagadoPorActorId: v } }));
            }}
            onQuienSoportaChange={(itemId, v) => {
              setQuienSoportaCostoEditado(prev => ({ ...prev, [itemId]: v }));
              setCambiosPendientes(prev => ({ ...prev, [itemId]: { ...prev[itemId], quienSoportaCostoId: v } }));
            }}
            onImporteFocus={(itemId, item, _itemIndex, _items, e) => {
              setCamposEnFoco(prev => ({ ...prev, [itemId]: true }));
              setValoresOriginales(prev => ({ ...prev, [itemId]: item.importe != null ? parseFloat(item.importe) : 0 }));
              if (e?.target?.value) {
                const num = parseImporteFormatted(e.target.value);
                if (num !== null) handleImporteChange(itemId, num.toString().replace('.', ','));
              }
              setTimeout(() => { if (e?.target) e.target.select(); }, 0);
            }}
            onImporteBlur={(e, itemId, _item, itemIndex, items) => {
              const wasEnterPressed = e.target.dataset.enterPressed === 'true';
              e.target.dataset.enterPressed = 'false';
              setCamposEnFoco(prev => { const n = { ...prev }; delete n[itemId]; return n; });
              const valor = e.target.value.trim();
              if (valor !== '' || wasEnterPressed) {
                setCambiosPendientes(prev => ({ ...prev, [itemId]: { ...prev[itemId], importe: valor || '' } }));
              }
              if (wasEnterPressed) {
                setTimeout(() => {
                  const nextIndex = itemIndex + 1;
                  if (nextIndex < items.length) {
                    const nextInput = importeInputRefs.current[items[nextIndex].itemId];
                    if (nextInput) nextInput.focus();
                  }
                }, 50);
              }
            }}
            importeInputRefs={importeInputRefs}
          />
        )
      ) : (
        // Tab de Expensas
        (propiedadesExpensas.length === 0) ? (
          hayExpensasCompletadas ? (
            <Alert severity="success" sx={{
              backgroundColor: '#d1fae5',
              border: '1px solid #10b981',
              '& .MuiAlert-icon': {
                color: '#059669'
              }
            }}>
              Todas las expensas del período seleccionado ya fueron completadas.
            </Alert>
          ) : (
            <Alert severity="info">
              Todavía no se generaron las expensas para el período seleccionado. Utilice el botón "Generar Impuestos del Período" para crearlas.
            </Alert>
          )
        ) : (
          <TablaExpensas
            expensasAgrupadas={expensasAgrupadas}
            propiedadesExpensas={propiedadesExpensas}
            expandedAccordions={expandedAccordions}
            onAccordionChange={(propiedad, expanded) => setExpandedAccordions(prev => ({ ...prev, [propiedad]: expanded }))}
            verCompletados={verCompletados}
            parseImporteFormatted={parseImporteFormatted}
            importesEditados={importesEditados}
            camposEnFoco={camposEnFoco}
            itemsError={itemsError}
            itemsSaving={itemsSaving}
            actoresEditados={actoresEditados}
            actores={actores}
            actorInqId={actorInqId}
            actorPropId={actorPropId}
            onImporteChange={handleImporteChangeExpensas}
            onActorChange={handleActorChangeExpensas}
            onImporteFocus={(itemId, importe, e) => {
              setCamposEnFoco(prev => ({ ...prev, [itemId]: true }));
              setValoresOriginales(prev => ({ ...prev, [itemId]: importe != null ? parseFloat(importe) : 0 }));
              if (e?.target?.value) {
                const num = parseImporteFormatted(e.target.value);
                if (num !== null) handleImporteChangeExpensas(itemId, num.toString().replace('.', ','));
              }
              setTimeout(() => { if (e?.target) e.target.select(); }, 0);
            }}
            onImporteBlur={(e, itemId, tipo, expensa, expensasGrupo) => {
              const wasEnterPressed = e.target.dataset.enterPressed === 'true';
              e.target.dataset.enterPressed = 'false';
              setCamposEnFoco(prev => { const n = { ...prev }; delete n[itemId]; return n; });
              const valor = e.target.value.trim();
              if (valor !== '' || wasEnterPressed) {
                setCambiosPendientes(prev => ({ ...prev, [itemId]: { ...prev[itemId], importe: valor || '' } }));
              }
              if (wasEnterPressed) {
                setTimeout(() => {
                  let nextItemId = null;
                  if (tipo === 'ORD' && expensa.itemIdEXT) nextItemId = expensa.itemIdEXT;
                  else {
                    const currentIndex = expensasGrupo.findIndex(ee => ee.itemIdORD === itemId || ee.itemIdEXT === itemId);
                    if (currentIndex >= 0 && currentIndex < expensasGrupo.length - 1) {
                      const nextExpensa = expensasGrupo[currentIndex + 1];
                      nextItemId = nextExpensa.itemIdORD || nextExpensa.itemIdEXT;
                    }
                  }
                  if (nextItemId && importeInputRefs.current[nextItemId]) importeInputRefs.current[nextItemId].focus();
                }, 50);
              }
            }}
            onClearItemError={(itemId) => setItemsError(prev => { const n = { ...prev }; delete n[itemId]; return n; })}
            importeInputRefs={importeInputRefs}
          />
        )
      )}

      {/* Dialog para sincronizar impuestos y servicios */}
      <Dialog
        open={generarDialog}
        onClose={() => setGenerarDialog(false)}
        closeAfterTransition={false}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Sincronizar Impuestos y Servicios</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Este proceso buscará y registrará los comprobantes de impuestos y servicios pendientes para todas las propiedades, sincronizando los importes y vencimientos con las oficinas virtuales correspondientes.
            </Alert>
            <DatePicker
              label="Período"
              views={['month', 'year']}
              openTo="month"
              value={periodoGenerarDate}
              onChange={(newValue) => {
                if (newValue) {
                  setPeriodoGenerarDate(newValue);
                  const year = newValue.year();
                  const month = String(newValue.month() + 1).padStart(2, '0');
                  setPeriodoGenerar(`${month}-${year}`);
                }
              }}
              format="MMMM YYYY"
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                  helperText: "Seleccione el mes y año"
                },
                actionBar: {
                  actions: ['today']
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerarDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleGenerar}
            disabled={generarMutation.isLoading}
            startIcon={generarMutation.isLoading ? <CircularProgress size={20} /> : <SyncIcon />}
            sx={{
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #047857 0%, #059669 100%)'
              }
            }}
          >
            Sincronizar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Incidencias */}
      <Dialog
        open={incidenciasDialogOpen}
        onClose={() => !crearIncidenciaMutation.isPending && setIncidenciasDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle>Nueva Incidencia</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            {/* Fila 1: Propiedad */}
            <Grid item xs={12}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Propiedad</InputLabel>
                <Select
                  value={incidenciaForm.propiedadId}
                  label="Propiedad"
                  onChange={(e) => setIncidenciaForm(f => ({ ...f, propiedadId: e.target.value }))}
                >
                  <MenuItem value="">Seleccione una propiedad</MenuItem>
                  {propiedadesList.map((p) => {
                    const direccion = `${p.dirCalle || ''} ${p.dirNro || ''}${p.dirPiso ? `, Piso ${p.dirPiso}` : ''}${p.dirDepto ? `, Depto ${p.dirDepto}` : ''}`.trim() || p.direccion || p.nombre || `Propiedad ${p.id}`;
                    return (
                      <MenuItem key={p.id} value={p.id}>
                        {direccion}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>

            {/* Fila 2: Concepto y Fecha del gasto */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Concepto</InputLabel>
                <Select
                  value={incidenciaForm.conceptoTipo}
                  label="Concepto"
                  onChange={(e) => setIncidenciaForm(f => ({ ...f, conceptoTipo: e.target.value }))}
                >
                  <MenuItem value="">Incidencia (por defecto)</MenuItem>
                  {tiposCargoList.length > 0 && (
                    <MenuItem disabled sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>Cargos</MenuItem>
                  )}
                  {tiposCargoList.map((tc) => (
                    <MenuItem key={`cargo-${tc.id}`} value={`cargo-${tc.id}`}>
                      {tc.nombre || tc.codigo || `Tipo ${tc.id}`}
                    </MenuItem>
                  ))}
                  {tiposImpuestoList.length > 0 && (
                    <MenuItem disabled sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>Impuestos</MenuItem>
                  )}
                  {tiposImpuestoList.map((ti) => (
                    <MenuItem key={`impuesto-${ti.id}`} value={`impuesto-${ti.id}`}>
                      {ti.nombre || ti.codigo || `Impuesto ${ti.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Fecha del gasto"
                value={incidenciaForm.fechaGasto}
                onChange={(v) => setIncidenciaForm(f => ({ ...f, fechaGasto: v }))}
                slotProps={{
                  textField: { size: 'small', fullWidth: true },
                  actionBar: { actions: ['clear', 'today'] }
                }}
              />
            </Grid>

            {/* Fila 3: Pagado por y Cobrar a */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Pagado por</InputLabel>
                <Select
                  value={incidenciaForm.pagadoPorActorId}
                  label="Pagado por"
                  onChange={(e) => setIncidenciaForm(f => ({ ...f, pagadoPorActorId: e.target.value }))}
                >
                  <MenuItem value="">Sin definir</MenuItem>
                  {actores.filter(a => a.activo).map((actor) => (
                    <MenuItem key={actor.id} value={actor.id}>
                      {actor.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Cobrar a</InputLabel>
                <Select
                  value={incidenciaForm.quienSoportaCostoId}
                  label="Cobrar a"
                  onChange={(e) => setIncidenciaForm(f => ({ ...f, quienSoportaCostoId: e.target.value }))}
                >
                  <MenuItem value="">Sin definir</MenuItem>
                  {actores.filter(a => a.activo).map((actor) => (
                    <MenuItem key={actor.id} value={actor.id}>
                      {actor.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Fila 4: Período e Importe */}
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Período en que se cobrará"
                views={['month', 'year']}
                openTo="month"
                value={periodo ? dayjs(periodo) : null}
                onChange={() => { }}
                readOnly
                format="MMMM YYYY"
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    helperText: "Período actual de la pantalla",
                    InputProps: { readOnly: true }
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Importe"
                type="number"
                value={incidenciaForm.importe}
                onChange={(e) => setIncidenciaForm(f => ({ ...f, importe: e.target.value }))}
                size="small"
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
                required
              />
            </Grid>

            {/* Fila 5: Observaciones */}
            <Grid item xs={12}>
              <TextField
                label="Observaciones"
                value={incidenciaForm.concepto}
                onChange={(e) => setIncidenciaForm(f => ({ ...f, concepto: e.target.value }))}
                size="small"
                fullWidth
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIncidenciasDialogOpen(false)} disabled={crearIncidenciaMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitIncidencia}
            disabled={crearIncidenciaMutation.isPending || !incidenciaForm.propiedadId}
            startIcon={crearIncidenciaMutation.isPending ? <CircularProgress size={20} /> : null}
          >
            {crearIncidenciaMutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de progreso */}
      <Dialog
        open={progresoDialog}
        closeAfterTransition={false}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px'
          }
        }}
      >
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={60} sx={{ mb: 3, color: '#059669' }} />
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
            Procesando...
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {mensajeProgreso || 'Por favor espere, esto puede tardar varios minutos...'}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary', fontStyle: 'italic' }}>
            No cierre esta ventana hasta que el proceso finalice
          </Typography>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmar importe 0 (single o batch) */}
      <Dialog
        open={confirmImporteCeroOpen}
        onClose={() => { setConfirmImporteCeroOpen(false); setConfirmImporteCeroPayload(null); }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle>Confirmar importe</DialogTitle>
        <DialogContent>
          <Typography sx={{ pt: 0.5 }}>
            {confirmImporteCeroPayload?.batch && confirmImporteCeroPayload?.items?.length > 1
              ? `Hay ${confirmImporteCeroPayload.items.length} ítems con importe 0. ¿Desea guardar todos?`
              : '¿Está seguro que desea guardar este ítem con importe 0?'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setConfirmImporteCeroOpen(false); setConfirmImporteCeroPayload(null); }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!confirmImporteCeroPayload) return;
              try {
                if (confirmImporteCeroPayload.batch && Array.isArray(confirmImporteCeroPayload.items)) {
                  await batchMutation.mutateAsync(confirmImporteCeroPayload.items);
                } else {
                  await completarMutation.mutateAsync(confirmImporteCeroPayload);
                }
                setConfirmImporteCeroOpen(false);
                setConfirmImporteCeroPayload(null);
              } catch {
                // Error ya se muestra en snackbar
              }
            }}
            disabled={completarMutation.isLoading || batchMutation.isPending}
            startIcon={(completarMutation.isLoading || batchMutation.isPending) ? <CircularProgress size={20} color="inherit" /> : null}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {successMessage || errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
