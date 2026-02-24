import React, { useState, useMemo, useEffect } from 'react';
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
  IconButton,
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
  Tooltip,
  Tabs,
  Tab
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import { liquidacionApi } from '../api/liquidacion';
import api from '../api';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

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
  const [periodo, setPeriodo] = useState(() => {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  });
  const [periodoDate, setPeriodoDate] = useState(() => dayjs());
  const [tipoImpuesto, setTipoImpuesto] = useState('');
  const [search, setSearch] = useState('');
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
  
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

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

    // Filtrar por búsqueda (propiedad o inquilino)
    if (search) {
      const searchLower = search.toLowerCase();
      gruposFiltrados = gruposFiltrados.map(grupo => ({
        ...grupo,
        items: grupo.items.filter(item => {
          const propiedadMatch = item.propiedad?.toLowerCase().includes(searchLower);
          const inquilinoMatch = item.inquilino?.toLowerCase().includes(searchLower);
          return propiedadMatch || inquilinoMatch;
        })
      })).filter(grupo => grupo.items.length > 0);
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
    
    // Filtrar por búsqueda si existe
    let expensasFiltradas = expensasData;
    if (search) {
      const searchLower = search.toLowerCase();
      expensasFiltradas = expensasData.filter(expensa => {
        const propiedadMatch = expensa.propiedad?.toLowerCase().includes(searchLower);
        const inquilinoMatch = expensa.inquilino?.toLowerCase().includes(searchLower);
        return propiedadMatch || inquilinoMatch;
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

  // Mutation para completar item (nuevo endpoint)
  const completarMutation = useMutation({
    mutationFn: ({ itemId, importe, actorFacturadoId = null, quienSoportaCostoId = null, pagadoPorActorId = null, vencimiento = null }) => 
      liquidacionApi.completarImporteItem(itemId, importe, actorFacturadoId, quienSoportaCostoId, pagadoPorActorId, vencimiento),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['impuestos-pendientes']);
      queryClient.invalidateQueries(['liquidaciones']);
      // Limpiar estados editados para este item
      setImportesEditados(prev => {
        const nuevo = { ...prev };
        delete nuevo[variables.itemId];
        return nuevo;
      });
      setActoresEditados(prev => {
        const nuevo = { ...prev };
        delete nuevo[variables.itemId];
        return nuevo;
      });
      setPagadoPorEditado(prev => {
        const nuevo = { ...prev };
        delete nuevo[variables.itemId];
        return nuevo;
      });
      setQuienSoportaCostoEditado(prev => {
        const nuevo = { ...prev };
        delete nuevo[variables.itemId];
        return nuevo;
      });
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

  // Función para ejecutar todos los scrapers en secuencia
  const ejecutarScrapers = async (periodoFormato, setMensajeProgreso) => {
    const resultados = {
      assa: null,
      epe: null,
      litoralgas: null,
      siat: null,
      santafe: null
    };
    const errores = [];

    try {
      // ASSA
      try {
        setMensajeProgreso('Sincronizando con Aguas Santafesinas...');
        console.log('[Generar] Ejecutando scraper ASSA...');
        const resAssa = await api.post('/liquidaciones/impuestos/assa/autocompletar', { periodo: periodoFormato });
        resultados.assa = resAssa.data;
        console.log('[Generar] ASSA completado:', resultados.assa);
      } catch (error) {
        console.error('[Generar] Error en ASSA:', error);
        errores.push(`ASSA: ${error.response?.data?.error || error.message}`);
      }

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

      // SIAT
      try {
        setMensajeProgreso('Sincronizando con TGI...');
        console.log('[Generar] Ejecutando scraper SIAT...');
        const resSiat = await api.post('/liquidaciones/impuestos/siat/autocompletar', { periodo: periodoFormato });
        resultados.siat = resSiat.data;
        console.log('[Generar] SIAT completado:', resultados.siat);
      } catch (error) {
        console.error('[Generar] Error en SIAT:', error);
        errores.push(`SIAT: ${error.response?.data?.error || error.message}`);
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
        (data.scrapers?.assa?.actualizados || 0) +
        (data.scrapers?.epe?.actualizados || 0) +
        (data.scrapers?.litoralgas?.actualizados || 0) +
        (data.scrapers?.siat?.actualizados || 0) +
        (data.scrapers?.santafe?.actualizados || 0);

      let mensaje = `Generación completada:\n• Liquidaciones creadas/reutilizadas: ${resumen.creadas}\n• Items de impuestos creados: ${resumen.itemsCreados}\n• Errores en generación: ${resumen.errores}`;
      
      if (totalActualizados > 0) {
        mensaje += `\n\nAutocompletado de importes:\n• Total items actualizados: ${totalActualizados}`;
        if (data.scrapers?.assa?.actualizados) mensaje += `\n  - ASSA: ${data.scrapers.assa.actualizados}`;
        if (data.scrapers?.epe?.actualizados) mensaje += `\n  - EPE: ${data.scrapers.epe.actualizados}`;
        if (data.scrapers?.litoralgas?.actualizados) mensaje += `\n  - Litoralgas: ${data.scrapers.litoralgas.actualizados}`;
        if (data.scrapers?.siat?.actualizados) mensaje += `\n  - SIAT: ${data.scrapers.siat.actualizados}`;
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
      setErrorMessage(error.response?.data?.error || error.response?.data?.detalles || 'Error al generar liquidaciones de impuestos');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  // Mutation para autocompletar desde ASSA
  const autocompletarAssaMutation = useMutation({
    mutationFn: (periodoAssa) => 
      api.post('/liquidaciones/impuestos/assa/autocompletar', { periodo: periodoAssa }),
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
      
      let mensaje = `Autocompletado ASSA completado:\n• Items actualizados: ${resumen.actualizados}`;
      
      if (resumen.sinFacturaEnPeriodo.length > 0) {
        mensaje += `\n• Puntos sin factura en período: ${resumen.sinFacturaEnPeriodo.join(', ')}`;
      }
      
      if (resumen.sinMatchPunto.length > 0) {
        mensaje += `\n• Puntos en ASSA sin configurar: ${resumen.sinMatchPunto.join(', ')}`;
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
      
      setSuccessMessage(mensaje);
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al autocompletar desde ASSA');
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
      
      setSuccessMessage(mensaje);
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al autocompletar desde EPE');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const handleAutocompletarAssa = () => {
    if (!periodo) {
      setErrorMessage('Debe seleccionar un período');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    
    // Convertir YYYY-MM a MM-YYYY para el backend
    const periodoAssa = formatPeriodo(periodo);
    
    if (!/^\d{2}-\d{4}$/.test(periodoAssa)) {
      setErrorMessage('El período debe tener el formato MM-YYYY');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    
    if (window.confirm(`¿Desea autocompletar los importes de AGUA desde ASSA para el período ${periodoAssa}?`)) {
      autocompletarAssaMutation.mutate(periodoAssa);
    }
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
    
    if (window.confirm(`¿Desea autocompletar los importes de LUZ desde EPE para el período ${periodoEpe}?`)) {
      autocompletarEpeMutation.mutate(periodoEpe);
    }
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
      
      setSuccessMessage(mensaje);
      setSnackbarOpen(true);
    },
    onError: (error) => {
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
    
    if (window.confirm(`¿Desea autocompletar los importes de GAS desde Litoralgas para el período ${periodoLitoralgas}?`)) {
      autocompletarLitoralgasMutation.mutate(periodoLitoralgas);
    }
  };

  // Mutation para autocompletar desde SIAT (TGI)
  const autocompletarSiatMutation = useMutation({
    mutationFn: (periodoSiat) => 
      api.post('/liquidaciones/impuestos/siat/autocompletar', { periodo: periodoSiat }),
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
      
      let mensaje = `Autocompletado TGI (SIAT) completado:\n• Items procesados: ${resumen.totalItems}\n• Items actualizados: ${resumen.actualizados}`;
      
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
      
      setSuccessMessage(mensaje);
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al autocompletar desde SIAT');
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
    
    if (window.confirm(`¿Desea autocompletar los importes de TGI desde SIAT Rosario para el período ${periodoSiat}?`)) {
      autocompletarSiatMutation.mutate(periodoSiat);
    }
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
    // Permitir comas como separador decimal
    setImportesEditados(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const handleCompletarItem = (item) => {
    // Obtener el importe editado o usar el importe actual como valor por defecto
    let importeStr = importesEditados[item.itemId];
    if (importeStr === undefined || importeStr === '') {
      importeStr = item.importe !== null && item.importe !== undefined 
        ? String(item.importe)
        : '';
    }
    const importeNum = parseImporteFormatted(importeStr) ?? 0;
    if (importeNum === null || importeNum < 0) {
      setErrorMessage('El importe debe ser un número mayor o igual a 0');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    const pagadoPorActorId = pagadoPorEditado[item.itemId] !== undefined
      ? pagadoPorEditado[item.itemId]
      : (item.pagadoPorActorId || null);
    const quienSoportaCostoId = quienSoportaCostoEditado[item.itemId] !== undefined
      ? quienSoportaCostoEditado[item.itemId]
      : (item.quienSoportaCostoId || null);
    const payload = {
      itemId: item.itemId,
      importe: importeNum,
      pagadoPorActorId: pagadoPorActorId,
      quienSoportaCostoId: quienSoportaCostoId
    };
    if (importeNum === 0) {
      setConfirmImporteCeroPayload(payload);
      setConfirmImporteCeroOpen(true);
      return;
    }
    completarMutation.mutate(payload);
  };

  // Funciones para manejar expensas
  const handleImporteChangeExpensas = (itemId, value) => {
    // Permitir comas como separador decimal
    setImportesEditados(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const handleActorChangeExpensas = (itemId, tipo, actorId) => {
    setActoresEditados(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [tipo]: actorId ? parseInt(actorId) : null
      }
    }));
  };

  const handleCompletarItemExpensasIndividual = (expensa, tipo) => {
    const itemId = tipo === 'ORD' ? expensa.itemIdORD : expensa.itemIdEXT;
    if (!itemId) return;

    // Obtener importe
    let importeStr = tipo === 'ORD' 
      ? importesEditados[expensa.itemIdORD]
      : importesEditados[expensa.itemIdEXT];
    
    if (importeStr === undefined || importeStr === '') {
      const importeOriginal = tipo === 'ORD' ? expensa.importeORD : expensa.importeEXT;
      importeStr = importeOriginal !== null && importeOriginal !== undefined 
        ? String(importeOriginal)
        : '';
    }
    
    const importeNum = parseImporteFormatted(importeStr) ?? 0;
    if (importeNum === null || importeNum < 0) {
      setErrorMessage('El importe debe ser un número mayor o igual a 0');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    const actoresItem = actoresEditados[itemId] || {};
    const pagadoPorActorId = actoresItem.pagadoPorActorId !== undefined 
      ? actoresItem.pagadoPorActorId 
      : (tipo === 'ORD' ? expensa.pagadoPorActorIdORD : expensa.pagadoPorActorIdEXT);
    const quienSoportaCostoId = actoresItem.quienSoportaCostoId !== undefined
      ? actoresItem.quienSoportaCostoId
      : (tipo === 'ORD' ? expensa.quienSoportaCostoIdORD : expensa.quienSoportaCostoIdEXT);
    const payload = {
      itemId: itemId,
      importe: importeNum,
      pagadoPorActorId: pagadoPorActorId,
      quienSoportaCostoId: quienSoportaCostoId
    };
    if (importeNum === 0) {
      setConfirmImporteCeroPayload(payload);
      setConfirmImporteCeroOpen(true);
      return;
    }
    completarMutation.mutate(payload);
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



  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Carga de Impuestos</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setIncidenciasDialogOpen(true)}
            disabled={crearIncidenciaMutation.isPending}
          >
            Incidencias
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<PlayArrowIcon />}
            onClick={() => setGenerarDialog(true)}
            disabled={generarMutation.isPending}
            sx={{
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #047857 0%, #059669 100%)'
              }
            }}
          >
            {generarMutation.isPending ? 'Generando y sincronizando...' : 'Generar Impuestos'}
          </Button>
        </Box>
      </Box>

      {/* Filtros */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <LocalizationProvider 
                dateAdapter={AdapterDayjs} 
                adapterLocale="es"
                localeText={{
                  todayButtonLabel: 'Hoy'
                }}
              >
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
                      // Convertir a YYYY-MM para el query (backend espera YYYY-MM)
                      setPeriodo(`${year}-${month}`);
                    }
                  }}
                  format="MMMM YYYY"
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                      InputLabelProps: { shrink: true },
                      sx: {
                        '& .MuiInputBase-root': {
                          height: '36px'
                        },
                        '& .MuiInputBase-input': {
                          py: '8px'
                        }
                      }
                    },
                    actionBar: {
                      actions: ['today']
                    }
                  }}
                  sx={{
                    '& .MuiPickersDay-root.Mui-selected': {
                      backgroundColor: 'primary.main',
                      '&:hover': {
                        backgroundColor: 'primary.dark'
                      }
                    },
                    '& .MuiPickersMonth-monthButton.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.dark'
                      }
                    },
                    '& .MuiPickersYear-yearButton.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.dark'
                      }
                    },
                    '& .MuiPickersActionBar-actionButton': {
                      color: 'primary.main',
                      '&:hover': {
                        backgroundColor: 'primary.light',
                        color: 'white'
                      }
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Tipo de Impuesto</InputLabel>
                <Select
                  value={tipoImpuesto}
                  label="Tipo de Impuesto"
                  onChange={(e) => {
                    setTipoImpuesto(e.target.value);
                  }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {tiposImpuesto.map(tipo => {
                    const grupo = impuestosData?.find(g => g.tipoImpuesto?.codigo === tipo);
                    return (
                      <MenuItem key={tipo} value={tipo}>
                        {grupo?.tipoImpuesto?.nombre || tipo}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Buscar (Dirección / Inquilino)"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
                placeholder="Buscar..."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={verCompletados}
                    onChange={(e) => setVerCompletados(e.target.checked)}
                    size="small"
                  />
                }
                label="Ver completados"
                sx={{ mt: 0.5 }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs para Impuestos y Expensas */}
      <Card sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>Impuestos</span>
                {cantidadImpuestosPendientes > 0 && (
                  <Chip
                    label={cantidadImpuestosPendientes}
                    size="small"
                    color="warning"
                    sx={{
                      height: '20px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: '#ffc107',
                      color: '#856404',
                      '& .MuiChip-label': {
                        px: 0.75,
                        py: 0
                      }
                    }}
                  />
                )}
              </Box>
            }
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>Expensas</span>
                {cantidadExpensasPendientes > 0 && (
                  <Chip
                    label={cantidadExpensasPendientes}
                    size="small"
                    color="warning"
                    sx={{
                      height: '20px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: '#ffc107',
                      color: '#856404',
                      '& .MuiChip-label': {
                        px: 0.75,
                        py: 0
                      }
                    }}
                  />
                )}
              </Box>
            }
          />
        </Tabs>
      </Card>

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
          <Box sx={{ mb: 2 }}>
            {/* Calcular total de items pendientes (por estado, no por importe) */}
            {(() => {
              const totalPendientes = impuestosData.reduce((total, grupo) => {
                const items = grupo.items || [];
                const pendientes = items.filter(esItemPendiente);
                return total + pendientes.length;
              }, 0);

              if (totalPendientes > 0) {
                return (
                  <Alert 
                    severity="warning" 
                    sx={{ 
                      mb: 2,
                      backgroundColor: '#fff3cd',
                      border: '2px solid #ffc107',
                      borderRadius: '8px',
                      '& .MuiAlert-icon': {
                        fontSize: '1.5rem',
                        color: '#856404'
                      },
                      '& .MuiAlert-message': {
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: '#856404'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        ⚠️ Atención: Hay {totalPendientes} item{totalPendientes !== 1 ? 's' : ''} pendiente{totalPendientes !== 1 ? 's' : ''} de completar
                      </Typography>
                    </Box>
                  </Alert>
                );
              }
              return null;
            })()}
            {/* Mostrar grupos de impuestos */}
          {impuestosData
            .filter(grupo => {
              const codigo = grupo.tipoImpuesto?.codigo;
              return !tipoImpuesto || codigo === tipoImpuesto;
            })
            .map((grupo) => {
              const tipo = grupo.tipoImpuesto?.codigo || 'SIN_TIPO';
              const items = grupo.items || [];
              
              // Filtrar solo los items en estado PENDIENTE (no por importe 0)
              const itemsPendientes = items.filter(esItemPendiente);
              
              return (
              <Accordion
                key={tipo}
                expanded={expandedAccordions[tipo] === true}
                onChange={handleAccordionChange(tipo)}
                sx={{ 
                  mb: 0.5,
                  '&:before': { display: 'none' },
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  '&.Mui-expanded': {
                    borderRadius: '8px'
                  }
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon sx={{ fontSize: '0.9rem' }} />}
                  sx={{
                    minHeight: '28px !important',
                    maxHeight: '28px !important',
                    borderRadius: '8px',
                    '& .MuiAccordionSummary-content': {
                      my: 0,
                      alignItems: 'center',
                      minHeight: '28px !important'
                    },
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    color: 'white',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #047857 0%, #059669 100%)'
                    },
                    '&.Mui-expanded': {
                      minHeight: '28px !important',
                      maxHeight: '28px !important',
                      background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                      borderRadius: '8px 8px 0 0'
                    },
                    '& .MuiSvgIcon-root': {
                      color: 'white'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 500, fontSize: '0.875rem', color: 'white' }}>
                      {grupo.tipoImpuesto?.nombre || grupo.tipoImpuesto?.codigo || tipo}
                    </Typography>
                    <Chip
                      label={`${itemsPendientes.length} item${itemsPendientes.length !== 1 ? 's pendientes' : ' pendiente'}`}
                      size="small"
                      variant="outlined"
                      sx={{ 
                        height: '16px', 
                        fontSize: '0.6rem', 
                        '& .MuiChip-label': { px: 0.5, py: 0, color: 'white' },
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                        color: 'white'
                      }}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0, '&.MuiAccordionDetails-root': { py: 0, borderRadius: '0 0 8px 8px' } }}>
                  <TableContainer sx={{ borderRadius: '0 0 8px 8px', overflow: 'hidden', mt: 0 }}>
                    <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.1, px: 0.75, fontSize: '0.8rem' } }}>
                      <TableHead>
                        <TableRow sx={{ '& .MuiTableCell-head': { py: 0.15, px: 0.75, fontWeight: 600, fontSize: '0.75rem', backgroundColor: 'rgba(0, 0, 0, 0.04)', borderTop: 'none', '&:first-of-type': { borderTopLeftRadius: 0 }, '&:last-of-type': { borderTopRightRadius: 0 } } }}>
                          <TableCell>Propiedad</TableCell>
                          <TableCell>Inquilino</TableCell>
                          <TableCell>Período</TableCell>
                          <TableCell>Pagado por</TableCell>
                          <TableCell>Cobrar a</TableCell>
                          <TableCell>Importe Anterior</TableCell>
                          <TableCell>Importe</TableCell>
                          <TableCell align="center">Acción</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map((item) => {
                          // Obtener el valor editado del estado
                          const valorEditado = importesEditados[item.itemId];
                          const estaEnFoco = camposEnFoco[item.itemId] === true;
                          
                          // Determinar qué valor mostrar
                          let valorAMostrar = '';
                          if (estaEnFoco) {
                            // Si está en foco, mostrar el valor sin formatear para edición
                            if (valorEditado !== undefined && valorEditado !== null && valorEditado !== '') {
                              valorAMostrar = String(valorEditado);
                            } else {
                              // Si no hay valor editado, convertir el importe original a formato editable
                              const importeOriginal = item.importe !== null && item.importe !== undefined ? item.importe : 0;
                              valorAMostrar = importeOriginal.toString().replace('.', ',');
                            }
                          } else {
                            // Si no está en foco, mostrar formateado
                            if (valorEditado !== undefined && valorEditado !== null && valorEditado !== '') {
                              const valorNum = parseImporteFormatted(valorEditado);
                              if (valorNum !== null) {
                                valorAMostrar = formatNumber(valorNum);
                              } else {
                                valorAMostrar = String(valorEditado);
                              }
                            } else {
                              // Mostrar el importe original formateado
                              // Asegurar que item.importe sea un número antes de formatear
                              const importeNum = item.importe !== null && item.importe !== undefined 
                                ? (typeof item.importe === 'string' ? parseFloat(item.importe) : item.importe)
                                : null;
                              valorAMostrar = importeNum !== null && !isNaN(importeNum) ? formatNumber(importeNum) : '';
                            }
                          }
                          
                          return (
                            <TableRow key={item.itemId} hover sx={{ '& .MuiTableCell-body': { py: 0.1 } }}>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.8rem', lineHeight: 1.2 }}>
                                  {item.propiedad || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.8rem' }}>{item.inquilino || '-'}</TableCell>
                              <TableCell sx={{ fontSize: '0.8rem' }}>
                                {item.periodoRef 
                                  ? item.periodoRef.replace(/^(\d{4})-(\d{2})$/, '$2-$1')
                                  : '-'
                                }
                              </TableCell>
                              <TableCell sx={{ width: '140px', padding: '1px 4px' }}>
                                <FormControl fullWidth size="small">
                                  <Select
                                    value={pagadoPorEditado[item.itemId] !== undefined 
                                      ? pagadoPorEditado[item.itemId] 
                                      : (item.pagadoPorActorId || '')}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      setPagadoPorEditado(prev => ({
                                        ...prev,
                                        [item.itemId]: e.target.value || null
                                      }));
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                    }}
                                    displayEmpty
                                    sx={{
                                      height: '22px',
                                      fontSize: '0.75rem',
                                      '& .MuiSelect-select': {
                                        padding: '1px 4px',
                                        fontSize: '0.75rem'
                                      }
                                    }}
                                    disabled={completarMutation.isLoading}
                                  >
                                    <MenuItem value="">
                                      <em>Sin definir</em>
                                    </MenuItem>
                                    {actores.filter(a => a.activo).map(actor => (
                                      <MenuItem key={actor.id} value={actor.id}>
                                        {actor.nombre}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </TableCell>
                              <TableCell sx={{ width: '140px', padding: '1px 4px' }}>
                                <FormControl fullWidth size="small">
                                  <Select
                                    value={quienSoportaCostoEditado[item.itemId] !== undefined 
                                      ? quienSoportaCostoEditado[item.itemId] 
                                      : (item.quienSoportaCostoId || '')}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      setQuienSoportaCostoEditado(prev => ({
                                        ...prev,
                                        [item.itemId]: e.target.value || null
                                      }));
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                    }}
                                    displayEmpty
                                    sx={{
                                      height: '22px',
                                      fontSize: '0.75rem',
                                      '& .MuiSelect-select': {
                                        padding: '1px 4px',
                                        fontSize: '0.75rem'
                                      }
                                    }}
                                    disabled={completarMutation.isLoading}
                                  >
                                    <MenuItem value="">
                                      <em>Sin definir</em>
                                    </MenuItem>
                                    {actores.filter(a => a.activo && (a.id === actorInqId || a.id === actorPropId)).map(actor => (
                                      <MenuItem key={actor.id} value={actor.id}>
                                        {actor.nombre}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.8rem', textAlign: 'right' }}>
                                {item.importeAnterior !== null && item.importeAnterior !== undefined
                                  ? formatNumber(typeof item.importeAnterior === 'string' ? parseFloat(item.importeAnterior) : item.importeAnterior)
                                  : '-'}
                              </TableCell>
                              <TableCell sx={{ width: '120px', padding: '1px 4px' }}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="text"
                                  value={valorAMostrar}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    // Permitir solo números, comas y puntos
                                    const nuevoValor = e.target.value.replace(/[^\d,.-]/g, '');
                                    handleImporteChange(item.itemId, nuevoValor);
                                  }}
                                  onFocus={(e) => {
                                    e.stopPropagation();
                                    setCamposEnFoco(prev => ({ ...prev, [item.itemId]: true }));
                                    const valorActual = e.target.value;
                                    if (valorActual) {
                                      const num = parseImporteFormatted(valorActual);
                                      if (num !== null) {
                                        handleImporteChange(item.itemId, num.toString().replace('.', ','));
                                      }
                                    }
                                    setTimeout(() => {
                                      if (e.target) e.target.select();
                                    }, 0);
                                  }}
                                  onBlur={(e) => {
                                    setCamposEnFoco(prev => {
                                      const nuevo = { ...prev };
                                      delete nuevo[item.itemId];
                                      return nuevo;
                                    });
                                    const valor = e.target.value;
                                    if (valor && valor.trim() !== '') {
                                      const num = parseImporteFormatted(valor);
                                      if (num !== null) {
                                        handleImporteChange(item.itemId, num.toString().replace('.', ','));
                                      }
                                    }
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                  }}
                                  inputProps={{ 
                                    style: { 
                                      textAlign: 'right', 
                                      fontSize: '0.75rem',
                                      padding: '1px 4px'
                                    }
                                  }}
                                  sx={{
                                    width: '100%',
                                    '& .MuiOutlinedInput-root': {
                                      height: '22px',
                                      '& fieldset': {
                                        borderWidth: '1px'
                                      }
                                    },
                                    '& .MuiInputBase-input': {
                                      padding: '1px 4px',
                                      height: '22px',
                                      fontSize: '0.75rem'
                                    }
                                  }}
                                  disabled={completarMutation.isLoading}
                                />
                              </TableCell>
                              <TableCell align="center" sx={{ width: '50px', padding: '1px' }}>
                                <Tooltip title="Guardar">
                                  <span>
                                    <IconButton
                                      size="small"
                                      color="success"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCompletarItem(item);
                                      }}
                                      disabled={completarMutation.isLoading}
                                      sx={{
                                        padding: '4px',
                                        '& .MuiSvgIcon-root': { fontSize: '1.1rem' },
                                        '&:hover': {
                                          backgroundColor: 'success.light',
                                          color: 'white'
                                        }
                                      }}
                                    >
                                      {completarMutation.isLoading ? (
                                        <CircularProgress size={18} />
                                      ) : (
                                        <SaveIcon fontSize="inherit" />
                                      )}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            );
          })}
          </Box>
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
          <Box sx={{ mb: 2 }}>
            {/* Calcular total de expensas pendientes */}
            {(() => {
              const totalPendientes = propiedadesExpensas.reduce((total, propiedad) => {
                const expensasGrupo = expensasAgrupadas[propiedad] || [];
                return total + expensasGrupo.reduce((subtotal, expensa) => {
                  let pendientes = 0;
                  const ordPendiente = expensa.estadoItemORD ? expensa.estadoItemORD.codigo === 'PENDIENTE' : (expensa.importeORD === null || expensa.importeORD === undefined || expensa.importeORD === 0 || expensa.importeORD === '');
                  const extPendiente = expensa.estadoItemEXT ? expensa.estadoItemEXT.codigo === 'PENDIENTE' : (expensa.importeEXT === null || expensa.importeEXT === undefined || expensa.importeEXT === 0 || expensa.importeEXT === '');
                  if (expensa.itemIdORD && ordPendiente) pendientes++;
                  if (expensa.itemIdEXT && extPendiente) pendientes++;
                  return subtotal + pendientes;
                }, 0);
              }, 0);

              if (totalPendientes > 0) {
                return (
                  <Alert 
                    severity="warning" 
                    sx={{ 
                      mb: 2,
                      backgroundColor: '#fff3cd',
                      border: '2px solid #ffc107',
                      borderRadius: '8px',
                      '& .MuiAlert-icon': {
                        fontSize: '1.5rem',
                        color: '#856404'
                      },
                      '& .MuiAlert-message': {
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: '#856404'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        ⚠️ Atención: Hay {totalPendientes} item{totalPendientes !== 1 ? 's' : ''} de expensas pendiente{totalPendientes !== 1 ? 's' : ''} de completar
                      </Typography>
                    </Box>
                  </Alert>
                );
              }
              return null;
            })()}
            {propiedadesExpensas.map((propiedad) => {
              const expensasGrupo = expensasAgrupadas[propiedad] || [];
              if (expensasGrupo.length === 0) return null;
              
              // Tomar la primera expensa del grupo para obtener datos comunes
              const primeraExpensa = expensasGrupo[0];
              const isExpanded = expandedAccordions[propiedad] === true;
              
              return (
                <Accordion
                  key={propiedad}
                  expanded={isExpanded}
                  onChange={(e, expanded) => {
                    setExpandedAccordions(prev => ({
                      ...prev,
                      [propiedad]: expanded
                    }));
                  }}
                  sx={{ 
                    mb: 1, 
                    '&:before': { display: 'none' },
                    borderRadius: '8px',
                    overflow: 'hidden',
                    '&.Mui-expanded': {
                      borderRadius: '8px'
                    }
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon sx={{ fontSize: '0.9rem', color: 'white' }} />}
                    sx={{
                      background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                      color: 'white',
                      borderRadius: '8px',
                      '&:hover': { background: 'linear-gradient(135deg, #047857 0%, #059669 100%)' },
                      minHeight: '28px !important',
                      maxHeight: '28px !important',
                      '& .MuiAccordionSummary-content': {
                        my: 0,
                        alignItems: 'center',
                        minHeight: '28px !important'
                      },
                      '&.Mui-expanded': { 
                        minHeight: '28px !important',
                        maxHeight: '28px !important',
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                        borderRadius: '8px 8px 0 0'
                      },
                      '& .MuiSvgIcon-root': {
                        color: 'white'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', pr: 1 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1, fontSize: '0.875rem', color: 'white' }}>
                        {propiedad}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0, '&.MuiAccordionDetails-root': { py: 0, borderRadius: '0 0 8px 8px' } }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '0 0 8px 8px', overflow: 'hidden', border: 'none', boxShadow: 'none', mt: 0 }}>
                      <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.15, px: 0.75, fontSize: '0.8rem' } }}>
                        <TableHead>
                          <TableRow sx={{ '& .MuiTableCell-head': { py: 0.25, px: 0.75, fontWeight: 600, fontSize: '0.75rem', backgroundColor: 'rgba(0, 0, 0, 0.04)', borderTop: 'none', '&:first-of-type': { borderTopLeftRadius: 0 }, '&:last-of-type': { borderTopRightRadius: 0 } } }}>
                            <TableCell>Inquilino</TableCell>
                            <TableCell>Tipo</TableCell>
                            <TableCell>Período</TableCell>
                            <TableCell>Pagado por</TableCell>
                            <TableCell>Cobrar a</TableCell>
                            <TableCell>Importe Anterior</TableCell>
                            <TableCell>Importe</TableCell>
                            <TableCell align="center">Acción</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {expensasGrupo.map((expensa) => {
                    // Renderizar fila para ORD
                    const renderExpensaRow = (tipo, itemId, importe, importeAnterior, pagadoPorActorId, quienSoportaCostoId, pagadoPorActor, quienSoportaCosto, periodoRef, vencimiento) => {
                      if (!itemId) return null;

                      // Obtener el valor editado del estado
                      const valorEditado = importesEditados[itemId];
                      const estaEnFoco = camposEnFoco[itemId] === true;
                      
                      // Determinar qué valor mostrar
                      let valorAMostrar = '';
                      if (estaEnFoco) {
                        // Si está en foco, mostrar el valor sin formatear para edición
                        if (valorEditado !== undefined && valorEditado !== null && valorEditado !== '') {
                          valorAMostrar = String(valorEditado);
                        } else {
                          // Si no hay valor editado, convertir el importe original a formato editable
                          const importeOriginal = importe !== null && importe !== undefined ? importe : 0;
                          valorAMostrar = importeOriginal.toString().replace('.', ',');
                        }
                      } else {
                        if (valorEditado !== undefined && valorEditado !== null && valorEditado !== '') {
                          const valorNum = parseImporteFormatted(valorEditado);
                          valorAMostrar = valorNum !== null ? formatNumber(valorNum) : String(valorEditado);
                        } else {
                          const importeNum = importe !== null && importe !== undefined 
                            ? (typeof importe === 'string' ? parseFloat(importe) : importe)
                            : null;
                          valorAMostrar = importeNum !== null && !isNaN(importeNum) ? formatNumber(importeNum) : '';
                        }
                      }

                      const actoresItem = actoresEditados[itemId] || {};
                      const pagadoPorActorIdActual = actoresItem.pagadoPorActorId !== undefined
                        ? actoresItem.pagadoPorActorId
                        : pagadoPorActorId;
                      const quienSoportaCostoIdActual = actoresItem.quienSoportaCostoId !== undefined
                        ? actoresItem.quienSoportaCostoId
                        : quienSoportaCostoId;

                      return (
                        <TableRow key={`${itemId}-${tipo}`} hover sx={{ '& .MuiTableCell-body': { py: 0.15 } }}>
                          <TableCell sx={{ fontSize: '0.8rem' }}>{primeraExpensa.inquilino || '-'}</TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>
                            {tipo === 'ORD' ? 'Ordinarias' : 'Extraordinarias'}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>
                            {periodoRef 
                              ? periodoRef.replace(/^(\d{4})-(\d{2})$/, '$2-$1')
                              : '-'
                            }
                          </TableCell>
                          <TableCell sx={{ width: '140px', padding: '1px 4px' }}>
                            <FormControl fullWidth size="small">
                              <Select
                                value={pagadoPorActorIdActual || ''}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleActorChangeExpensas(itemId, 'pagadoPorActorId', e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                displayEmpty
                                sx={{
                                  height: '26px',
                                  fontSize: '0.75rem',
                                  '& .MuiSelect-select': {
                                    padding: '1px 4px',
                                    fontSize: '0.75rem'
                                  }
                                }}
                                disabled={completarMutation.isLoading}
                              >
                                <MenuItem value="">
                                  <em>Sin definir</em>
                                </MenuItem>
                                {actores.filter(a => a.activo).map(actor => (
                                  <MenuItem key={actor.id} value={actor.id}>
                                    {actor.nombre}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell sx={{ width: '140px', padding: '1px 4px' }}>
                            <FormControl fullWidth size="small">
                              <Select
                                value={quienSoportaCostoIdActual || ''}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleActorChangeExpensas(itemId, 'quienSoportaCostoId', e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                displayEmpty
                                sx={{
                                  height: '26px',
                                  fontSize: '0.75rem',
                                  '& .MuiSelect-select': {
                                    padding: '1px 4px',
                                    fontSize: '0.75rem'
                                  }
                                }}
                                disabled={completarMutation.isLoading}
                              >
                                <MenuItem value="">
                                  <em>Sin definir</em>
                                </MenuItem>
                                {actores.filter(a => a.activo && (a.id === actorInqId || a.id === actorPropId)).map(actor => (
                                  <MenuItem key={actor.id} value={actor.id}>
                                    {actor.nombre}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.8rem', textAlign: 'right' }}>
                            {importeAnterior !== null && importeAnterior !== undefined
                              ? formatNumber(typeof importeAnterior === 'string' ? parseFloat(importeAnterior) : importeAnterior)
                              : '-'}
                          </TableCell>
                          <TableCell sx={{ width: '120px', padding: '1px 4px' }}>
                            <TextField
                              fullWidth
                              size="small"
                              type="text"
                              value={valorAMostrar}
                              onChange={(e) => {
                                e.stopPropagation();
                                // Permitir solo números, comas y puntos
                                const nuevoValor = e.target.value.replace(/[^\d,.-]/g, '');
                                handleImporteChangeExpensas(itemId, nuevoValor);
                              }}
                              onFocus={(e) => {
                                e.stopPropagation();
                                setCamposEnFoco(prev => ({ ...prev, [itemId]: true }));
                                const valorActual = e.target.value;
                                if (valorActual) {
                                  const num = parseImporteFormatted(valorActual);
                                  if (num !== null) {
                                    handleImporteChangeExpensas(itemId, num.toString().replace('.', ','));
                                  }
                                }
                                setTimeout(() => { if (e.target) e.target.select(); }, 0);
                              }}
                              onBlur={(e) => {
                                setCamposEnFoco(prev => {
                                  const nuevo = { ...prev };
                                  delete nuevo[itemId];
                                  return nuevo;
                                });
                                const valor = e.target.value;
                                if (valor && valor.trim() !== '') {
                                  const num = parseImporteFormatted(valor);
                                  if (num !== null) {
                                    handleImporteChangeExpensas(itemId, num.toString().replace('.', ','));
                                  }
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              inputProps={{
                                style: {
                                  textAlign: 'right',
                                  fontSize: '0.75rem',
                                  padding: '2px 4px'
                                }
                              }}
                              sx={{
                                width: '100%',
                                '& .MuiOutlinedInput-root': {
                                  height: '26px',
                                  '& fieldset': { borderWidth: '1px' }
                                },
                                '& .MuiInputBase-input': {
                                  padding: '2px 4px',
                                  height: '26px',
                                  fontSize: '0.75rem'
                                }
                              }}
                              disabled={completarMutation.isLoading}
                            />
                          </TableCell>
                          <TableCell align="center" sx={{ width: '50px', padding: '1px' }}>
                            <Tooltip title="Guardar">
                              <span>
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCompletarItemExpensasIndividual(expensa, tipo);
                                  }}
                                  disabled={completarMutation.isLoading}
                                  sx={{
                                    padding: '4px',
                                    '& .MuiSvgIcon-root': { fontSize: '1.1rem' },
                                    '&:hover': {
                                      backgroundColor: 'success.light',
                                      color: 'white'
                                    }
                                  }}
                                >
                                  {completarMutation.isLoading ? (
                                    <CircularProgress size={18} />
                                  ) : (
                                    <SaveIcon fontSize="inherit" />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    };

                            return (
                              <React.Fragment key={`${expensa.propiedad}-${expensa.inquilino || 'sin-inquilino'}`}>
                                {renderExpensaRow('ORD', expensa.itemIdORD, expensa.importeORD, expensa.importeAnteriorORD, expensa.pagadoPorActorIdORD, expensa.quienSoportaCostoIdORD, expensa.pagadoPorActorORD, expensa.quienSoportaCostoORD, expensa.periodoRef, expensa.vencimientoORD)}
                                {renderExpensaRow('EXT', expensa.itemIdEXT, expensa.importeEXT, expensa.importeAnteriorEXT, expensa.pagadoPorActorIdEXT, expensa.quienSoportaCostoIdEXT, expensa.pagadoPorActorEXT, expensa.quienSoportaCostoEXT, expensa.periodoRef, expensa.vencimientoEXT)}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        )
      )}

      {/* Dialog para generar liquidaciones */}
      <Dialog
        open={generarDialog}
        onClose={() => setGenerarDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Generar Liquidaciones Automáticas</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Este proceso generará liquidaciones para todas las propiedades con impuestos asociados y sincronizará los importes y vencimientos con las oficinas virtuales correspondientes.
            </Alert>
            <LocalizationProvider 
              dateAdapter={AdapterDayjs} 
              adapterLocale="es"
              localeText={{
                todayButtonLabel: 'Hoy'
              }}
            >
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
                    // Guardar en formato MM-AAAA para mostrar al usuario
                    setPeriodoGenerar(`${month}-${year}`);
                  }
                }}
                format="MMMM YYYY"
                slotProps={{
                  textField: {
                    fullWidth: true,
                    InputLabelProps: { shrink: true },
                    helperText: "Seleccione el mes y año",
                    sx: {
                      '& .MuiInputBase-root': {
                        height: '36px'
                      },
                      '& .MuiInputBase-input': {
                        py: '8px'
                      }
                    }
                  },
                  actionBar: {
                    actions: ['today']
                  },
                  layout: {
                    sx: {
                      '& .MuiPickersLayout-root': {
                        padding: '8px 4px 4px 4px',
                        minWidth: '280px'
                      },
                      '& .MuiPickersLayout-contentWrapper': {
                        padding: 0
                      },
                      '& .MuiMonthCalendar-root': {
                        margin: 0,
                        padding: '4px 8px'
                      },
                      '& .MuiPickersMonth-monthButton': {
                        margin: '1px',
                        minWidth: '64px',
                        height: '28px',
                        fontSize: '0.75rem',
                        padding: '4px 8px'
                      },
                      '& .MuiPickersCalendarHeader-root': {
                        padding: '4px 8px',
                        marginBottom: '4px'
                      },
                      '& .MuiPickersCalendarHeader-labelContainer': {
                        marginLeft: '4px'
                      },
                      '& .MuiPickersActionBar-root': {
                        padding: '4px 8px',
                        marginTop: '4px'
                      }
                    }
                  },
                  popper: {
                    sx: {
                      '& .MuiPaper-root': {
                        minWidth: '280px',
                        maxWidth: '300px'
                      }
                    }
                  }
                }}
                sx={{
                  '& .MuiInputBase-root': {
                    fontSize: '0.875rem'
                  }
                }}
              />
            </LocalizationProvider>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerarDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleGenerar}
            disabled={generarMutation.isLoading}
            startIcon={generarMutation.isLoading ? <CircularProgress size={20} /> : <PlayArrowIcon />}
            sx={{
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #047857 0%, #059669 100%)'
              }
            }}
          >
            Generar
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
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
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
              <DatePicker
                label="Fecha del gasto"
                value={incidenciaForm.fechaGasto}
                onChange={(v) => setIncidenciaForm(f => ({ ...f, fechaGasto: v }))}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </LocalizationProvider>
            <TextField
              label="Período en que se cobrará"
              value={periodo ? periodo.replace(/^(\d{4})-(\d{2})$/, '$2-$1') : ''}
              size="small"
              fullWidth
              InputProps={{ readOnly: true }}
              helperText="Período actual de la pantalla"
            />
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
            <TextField
              label="Concepto / Descripción"
              value={incidenciaForm.concepto}
              onChange={(e) => setIncidenciaForm(f => ({ ...f, concepto: e.target.value }))}
              size="small"
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Importe"
              type="number"
              value={incidenciaForm.importe}
              onChange={(e) => setIncidenciaForm(f => ({ ...f, importe: e.target.value }))}
              size="small"
              fullWidth
              inputProps={{ min: 0, step: 0.01 }}
              required
            />
          </Box>
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

      {/* Dialog confirmar importe 0 */}
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
            ¿Está seguro que desea guardar este ítem con importe 0?
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
                await completarMutation.mutateAsync(confirmImporteCeroPayload);
                setConfirmImporteCeroOpen(false);
                setConfirmImporteCeroPayload(null);
              } catch {
                // Error ya se muestra en snackbar; el diálogo queda abierto para reintentar
              }
            }}
            disabled={completarMutation.isLoading}
            startIcon={completarMutation.isLoading ? <CircularProgress size={20} color="inherit" /> : null}
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

