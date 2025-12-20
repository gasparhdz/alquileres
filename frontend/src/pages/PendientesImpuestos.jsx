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
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import { liquidacionApi } from '../api/liquidacion';
import api from '../api';


export default function PendientesImpuestos() {
  const [periodo, setPeriodo] = useState(() => {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  });
  const [tipoImpuesto, setTipoImpuesto] = useState('');
  const [search, setSearch] = useState('');
  const [generarDialog, setGenerarDialog] = useState(false);
  const [periodoGenerar, setPeriodoGenerar] = useState(() => {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  });
  const [importesEditados, setImportesEditados] = useState({}); // Estado para almacenar importes editados por itemId
  // Estado para controlar acordeones expandidos - por defecto todos expandidos
  const [expandedAccordions, setExpandedAccordions] = useState({});
  const [tabValue, setTabValue] = useState(0); // 0 = Impuestos, 1 = Expensas
  const [actoresEditados, setActoresEditados] = useState({}); // Estado para actores editados en expensas { itemId: { actorFacturadoId, quienSoportaCostoId } }
  const [verCompletados, setVerCompletados] = useState(false); // Switch para mostrar completados
  const [camposEnFoco, setCamposEnFoco] = useState({}); // Estado para rastrear qué campos están en foco { itemId: true }
  
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  
  const queryClient = useQueryClient();

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

  // Obtener impuestos pendientes (nuevo endpoint que ya viene agrupado)
  const { data: impuestosPendientes, isLoading, refetch } = useQuery({
    queryKey: ['impuestos-pendientes', periodo, verCompletados],
    queryFn: async () => {
      return await liquidacionApi.getImpuestosPendientes(periodo || null, verCompletados);
    }
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

  // Inicializar acordeones expandidos y valores editados cuando se cargan los datos
  useEffect(() => {
    if (impuestosData && impuestosData.length > 0) {
      // Inicializar acordeones expandidos
      setExpandedAccordions(prev => {
        const newKeys = Object.keys(itemsAgrupados);
        // Solo actualizar si hay nuevos tipos que no están en el estado
        const hasNewTypes = newKeys.some(tipo => !(tipo in prev));
        
        if (hasNewTypes || Object.keys(prev).length === 0) {
          const initialExpanded = { ...prev };
          newKeys.forEach(tipo => {
            if (!(tipo in initialExpanded)) {
              initialExpanded[tipo] = true; // Por defecto expandidos
            }
          });
          return initialExpanded;
        }
        
        return prev;
      });

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

      // Inicializar acordeones expandidos para expensas
      setExpandedAccordions(prev => {
        const newKeys = propiedadesExpensas;
        const hasNewProps = newKeys.some(prop => !(prop in prev));
        
        if (hasNewProps || Object.keys(prev).length === 0) {
          const initialExpanded = { ...prev };
          newKeys.forEach(prop => {
            if (!(prop in initialExpanded)) {
              initialExpanded[prop] = true; // Por defecto expandidos
            }
          });
          return initialExpanded;
        }
        
        return prev;
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
                  actorFacturadoId: expensa.actorFacturadoIdORD || null,
                  quienSoportaCostoId: expensa.quienSoportaCostoIdORD || null
                };
                hayCambios = true;
              }
            }
            if (expensa.itemIdEXT) {
              const actoresActuales = prev[expensa.itemIdEXT];
              if (!actoresActuales) {
                nuevos[expensa.itemIdEXT] = {
                  actorFacturadoId: expensa.actorFacturadoIdEXT || null,
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
    mutationFn: ({ itemId, importe, actorFacturadoId = null, quienSoportaCostoId = null }) => 
      liquidacionApi.completarImporteItem(itemId, importe, actorFacturadoId, quienSoportaCostoId),
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

  // Mutation para generar liquidaciones de impuestos (nuevo endpoint)
  const generarMutation = useMutation({
    mutationFn: (periodoGen) => 
      liquidacionApi.generarImpuestos(periodoGen),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['impuestos-pendientes']);
      queryClient.invalidateQueries(['liquidaciones']);
      setGenerarDialog(false);
      const resumen = {
        creadas: data.creadas || 0,
        itemsCreados: data.itemsCreados || 0,
        errores: data.errores || 0
      };
      const mensaje = `Generación completada:
        • Liquidaciones creadas/reutilizadas: ${resumen.creadas}
        • Items de impuestos creados: ${resumen.itemsCreados}
        • Errores: ${resumen.errores}`;
      setSuccessMessage(mensaje);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      
      // Si no se crearon items, mostrar alerta más detallada
      if (resumen.itemsCreados === 0) {
        setTimeout(() => {
          alert(`No se crearon items de impuestos. Revisa:\n${mensaje}\n\nPosibles causas:\n- No hay contratos vigentes en el período\n- No hay impuestos activos configurados en las propiedades\n- Los impuestos no corresponden según su periodicidad\n- Ya existen items para ese período`);
        }, 1000);
      }
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || error.response?.data?.detalles || 'Error al generar liquidaciones de impuestos');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

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
    
    // Limpiar el formato: quitar puntos (separadores de miles) y convertir coma a punto
    const importeStrLimpio = importeStr.toString()
      .replace(/\./g, '') // Quitar puntos (separadores de miles)
      .replace(',', '.'); // Convertir coma decimal a punto
    
    const importeNum = importeStrLimpio !== '' 
      ? parseFloat(importeStrLimpio) 
      : 0;
    
    if (isNaN(importeNum) || importeNum < 0) {
      setErrorMessage('El importe debe ser un número mayor o igual a 0');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    
    // Usar el nuevo endpoint
    completarMutation.mutate({
      itemId: item.itemId,
      importe: importeNum
    });
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
    
    // Limpiar el formato: quitar puntos (separadores de miles) y convertir coma a punto
    const importeStrLimpio = importeStr.toString()
      .replace(/\./g, '') // Quitar puntos (separadores de miles)
      .replace(',', '.'); // Convertir coma decimal a punto
    
    const importeNum = importeStrLimpio !== '' 
      ? parseFloat(importeStrLimpio) 
      : 0;
    
    if (isNaN(importeNum) || importeNum < 0) {
      setErrorMessage('El importe debe ser un número mayor o igual a 0');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    // Obtener actores editados
    const actoresItem = actoresEditados[itemId] || {};
    const actorFacturadoId = actoresItem.actorFacturadoId !== undefined 
      ? actoresItem.actorFacturadoId 
      : (tipo === 'ORD' ? expensa.actorFacturadoIdORD : expensa.actorFacturadoIdEXT);
    const quienSoportaCostoId = actoresItem.quienSoportaCostoId !== undefined
      ? actoresItem.quienSoportaCostoId
      : (tipo === 'ORD' ? expensa.quienSoportaCostoIdORD : expensa.quienSoportaCostoIdEXT);
    
    // Usar el nuevo endpoint con actores
    completarMutation.mutate({
      itemId: itemId,
      importe: importeNum,
      actorFacturadoId: actorFacturadoId,
      quienSoportaCostoId: quienSoportaCostoId
    });
  };

  const handleAccordionChange = (tipoImpuesto) => (event, isExpanded) => {
    setExpandedAccordions(prev => ({
      ...prev,
      [tipoImpuesto]: isExpanded
    }));
  };

  const handleGenerar = () => {
    if (!periodoGenerar || !/^\d{4}-\d{2}$/.test(periodoGenerar)) {
      setErrorMessage('El período debe tener el formato YYYY-MM');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    
    generarMutation.mutate(periodoGenerar);
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return '-';
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };



  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ fontSize: '1.5rem' }}>
          Pendientes de Impuestos
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<PlayArrowIcon />}
          onClick={() => setGenerarDialog(true)}
          sx={{
            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #047857 0%, #059669 100%)'
            }
          }}
        >
          Generar Liquidaciones
        </Button>
      </Box>

      {/* Filtros */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Período"
                type="month"
                value={periodo}
                onChange={(e) => {
                  setPeriodo(e.target.value);
                }}
                InputLabelProps={{ shrink: true }}
              />
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
          <Tab label="Impuestos" />
          <Tab label="Expensas" />
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
          <Alert severity="info">
            No hay impuestos pendientes para el período seleccionado.
          </Alert>
        ) : (
          <Box sx={{ mb: 2 }}>
            {/* Mostrar grupos de impuestos */}
          {impuestosData
            .filter(grupo => {
              const codigo = grupo.tipoImpuesto?.codigo;
              return !tipoImpuesto || codigo === tipoImpuesto;
            })
            .map((grupo) => {
              const tipo = grupo.tipoImpuesto?.codigo || 'SIN_TIPO';
              const items = grupo.items || [];
              
              return (
              <Accordion
                key={tipo}
                expanded={expandedAccordions[tipo] !== false}
                onChange={handleAccordionChange(tipo)}
                sx={{ 
                  mb: 0.5,
                  '&:before': { display: 'none' },
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon sx={{ fontSize: '1.2rem' }} />}
                  sx={{
                    minHeight: '40px',
                    '& .MuiAccordionSummary-content': {
                      my: 0.5
                    },
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                    <Typography variant="body1" sx={{ flexGrow: 1, fontWeight: 500, fontSize: '0.9rem' }}>
                      {grupo.tipoImpuesto?.nombre || grupo.tipoImpuesto?.codigo || tipo}
                    </Typography>
                    <Chip
                      label={`${items.length} item${items.length !== 1 ? 's' : ''}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ height: '20px', fontSize: '0.7rem' }}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <TableContainer>
                    <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.8rem' } }}>
                      <TableHead>
                        <TableRow sx={{ '& .MuiTableCell-head': { py: 0.75, fontWeight: 600, fontSize: '0.75rem', backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}>
                          <TableCell>Propiedad</TableCell>
                          <TableCell>Inquilino</TableCell>
                          <TableCell>Período</TableCell>
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
                              // Convertir el valor editado a número y formatearlo
                              const valorNum = parseFloat(String(valorEditado).replace(/\./g, '').replace(',', '.'));
                              if (!isNaN(valorNum)) {
                                valorAMostrar = formatNumber(valorNum);
                              } else {
                                valorAMostrar = String(valorEditado);
                              }
                            } else {
                              // Mostrar el importe original formateado
                              valorAMostrar = item.importe !== null && item.importe !== undefined ? formatNumber(item.importe) : '';
                            }
                          }
                          
                          return (
                            <TableRow key={item.itemId} hover sx={{ '& .MuiTableCell-body': { py: 0.5 } }}>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.8rem', lineHeight: 1.2 }}>
                                  {item.propiedad || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.8rem' }}>{item.inquilino || '-'}</TableCell>
                              <TableCell sx={{ fontSize: '0.8rem' }}>{item.periodoRef || '-'}</TableCell>
                              <TableCell sx={{ width: '120px', padding: '2px 4px' }}>
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
                                    // Marcar que este campo está en foco
                                    setCamposEnFoco(prev => ({ ...prev, [item.itemId]: true }));
                                    // Si el valor está formateado, convertirlo a número simple
                                    const valorActual = e.target.value;
                                    if (valorActual.includes('.') && valorActual.split('.').length > 2) {
                                      // Tiene formato, convertir a número simple
                                      const num = parseFloat(valorActual.replace(/\./g, '').replace(',', '.'));
                                      if (!isNaN(num)) {
                                        const valorSimple = num.toString().replace('.', ',');
                                        handleImporteChange(item.itemId, valorSimple);
                                      }
                                    } else if (valorActual && !valorActual.includes(',')) {
                                      // Si tiene puntos pero no comas, puede ser un número con punto decimal
                                      const num = parseFloat(valorActual);
                                      if (!isNaN(num)) {
                                        const valorSimple = num.toString().replace('.', ',');
                                        handleImporteChange(item.itemId, valorSimple);
                                      }
                                    }
                                    setTimeout(() => {
                                      if (e.target) {
                                        e.target.select();
                                      }
                                    }, 0);
                                  }}
                                  onBlur={(e) => {
                                    // Quitar el foco
                                    setCamposEnFoco(prev => {
                                      const nuevo = { ...prev };
                                      delete nuevo[item.itemId];
                                      return nuevo;
                                    });
                                    // Asegurar que el valor esté guardado correctamente
                                    const valor = e.target.value;
                                    if (valor && valor.trim() !== '') {
                                      // Limpiar y normalizar el valor
                                      const valorLimpio = valor.replace(/\./g, '').replace(',', '.');
                                      const num = parseFloat(valorLimpio);
                                      if (!isNaN(num)) {
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
                                      padding: '4px 6px'
                                    }
                                  }}
                                  sx={{
                                    width: '100%',
                                    '& .MuiOutlinedInput-root': {
                                      height: '32px',
                                      '& fieldset': {
                                        borderWidth: '1px'
                                      }
                                    },
                                    '& .MuiInputBase-input': {
                                      padding: '4px 6px',
                                      height: '32px',
                                      fontSize: '0.75rem'
                                    }
                                  }}
                                  disabled={completarMutation.isLoading}
                                />
                              </TableCell>
                              <TableCell align="center" sx={{ width: '50px', padding: '2px' }}>
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
                                        padding: '2px',
                                        '& .MuiSvgIcon-root': { fontSize: '1rem' },
                                        '&:hover': {
                                          backgroundColor: 'success.light',
                                          color: 'success.contrastText'
                                        }
                                      }}
                                    >
                                      {completarMutation.isLoading ? (
                                        <CircularProgress size={16} />
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
          <Alert severity="info">
            No hay expensas pendientes para el período seleccionado.
          </Alert>
        ) : (
          <Box sx={{ mb: 2 }}>
            {propiedadesExpensas.map((propiedad) => {
              const expensasGrupo = expensasAgrupadas[propiedad] || [];
              if (expensasGrupo.length === 0) return null;
              
              // Tomar la primera expensa del grupo para obtener datos comunes
              const primeraExpensa = expensasGrupo[0];
              const isExpanded = expandedAccordions[propiedad] !== false;
              
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
                  sx={{ mb: 1, '&:before': { display: 'none' } }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      backgroundColor: 'rgba(0, 0, 0, 0.02)',
                      '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
                      minHeight: '48px',
                      '&.Mui-expanded': { minHeight: '48px' }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', pr: 2 }}>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ flexGrow: 1 }}>
                        {propiedad}
                      </Typography>
                      <Chip
                        label={`${expensasGrupo.length} ${expensasGrupo.length === 1 ? 'expensa' : 'expensas'}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ ml: 2, fontSize: '0.7rem', height: '20px' }}
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.8rem' } }}>
                        <TableHead>
                          <TableRow sx={{ '& .MuiTableCell-head': { py: 0.75, fontWeight: 600, fontSize: '0.75rem', backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}>
                            <TableCell>Inquilino</TableCell>
                            <TableCell>Tipo</TableCell>
                            <TableCell>Valor anterior</TableCell>
                            <TableCell>Importe</TableCell>
                            <TableCell>Quién pagó</TableCell>
                            <TableCell>A quién cobrar</TableCell>
                            <TableCell align="center">Acción</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {expensasGrupo.map((expensa) => {
                    // Renderizar fila para ORD
                    const renderExpensaRow = (tipo, itemId, importe, importeAnterior, actorFacturadoId, quienSoportaCostoId, actorFacturado, quienSoportaCosto) => {
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
                        // Si no está en foco, mostrar formateado
                        if (valorEditado !== undefined && valorEditado !== null && valorEditado !== '') {
                          // Convertir el valor editado a número y formatearlo
                          const valorNum = parseFloat(String(valorEditado).replace(/\./g, '').replace(',', '.'));
                          if (!isNaN(valorNum)) {
                            valorAMostrar = formatNumber(valorNum);
                          } else {
                            valorAMostrar = String(valorEditado);
                          }
                        } else {
                          // Mostrar el importe original formateado
                          valorAMostrar = importe !== null && importe !== undefined ? formatNumber(importe) : '';
                        }
                      }

                      const actoresItem = actoresEditados[itemId] || {};
                      const actorFacturadoIdActual = actoresItem.actorFacturadoId !== undefined
                        ? actoresItem.actorFacturadoId
                        : actorFacturadoId;
                      const quienSoportaCostoIdActual = actoresItem.quienSoportaCostoId !== undefined
                        ? actoresItem.quienSoportaCostoId
                        : quienSoportaCostoId;

                      return (
                        <TableRow key={`${itemId}-${tipo}`} hover sx={{ '& .MuiTableCell-body': { py: 0.5 } }}>
                          <TableCell sx={{ fontSize: '0.8rem' }}>{primeraExpensa.inquilino || '-'}</TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>
                            {tipo === 'ORD' ? 'Ordinarias' : 'Extraordinarias'}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>
                            {importeAnterior !== null && importeAnterior !== undefined
                              ? formatNumber(importeAnterior)
                              : '-'}
                          </TableCell>
                          <TableCell sx={{ width: '120px', padding: '2px 4px' }}>
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
                                // Marcar que este campo está en foco
                                setCamposEnFoco(prev => ({ ...prev, [itemId]: true }));
                                // Si el valor está formateado, convertirlo a número simple
                                const valorActual = e.target.value;
                                if (valorActual.includes('.') && valorActual.split('.').length > 2) {
                                  // Tiene formato, convertir a número simple
                                  const num = parseFloat(valorActual.replace(/\./g, '').replace(',', '.'));
                                  if (!isNaN(num)) {
                                    const valorSimple = num.toString().replace('.', ',');
                                    handleImporteChangeExpensas(itemId, valorSimple);
                                  }
                                } else if (valorActual && !valorActual.includes(',')) {
                                  // Si tiene puntos pero no comas, puede ser un número con punto decimal
                                  const num = parseFloat(valorActual);
                                  if (!isNaN(num)) {
                                    const valorSimple = num.toString().replace('.', ',');
                                    handleImporteChangeExpensas(itemId, valorSimple);
                                  }
                                }
                                setTimeout(() => {
                                  if (e.target) {
                                    e.target.select();
                                  }
                                }, 0);
                              }}
                              onBlur={(e) => {
                                // Quitar el foco
                                setCamposEnFoco(prev => {
                                  const nuevo = { ...prev };
                                  delete nuevo[itemId];
                                  return nuevo;
                                });
                                // Asegurar que el valor esté guardado correctamente
                                const valor = e.target.value;
                                if (valor && valor.trim() !== '') {
                                  // Limpiar y normalizar el valor
                                  const valorLimpio = valor.replace(/\./g, '').replace(',', '.');
                                  const num = parseFloat(valorLimpio);
                                  if (!isNaN(num)) {
                                    handleImporteChangeExpensas(itemId, num.toString().replace('.', ','));
                                  }
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              inputProps={{
                                style: {
                                  textAlign: 'right',
                                  fontSize: '0.75rem',
                                  padding: '4px 6px'
                                }
                              }}
                              sx={{
                                width: '100%',
                                '& .MuiOutlinedInput-root': {
                                  height: '32px',
                                  '& fieldset': { borderWidth: '1px' }
                                },
                                '& .MuiInputBase-input': {
                                  padding: '4px 6px',
                                  height: '32px',
                                  fontSize: '0.75rem'
                                }
                              }}
                              disabled={completarMutation.isLoading}
                            />
                          </TableCell>
                          <TableCell sx={{ width: '150px', padding: '2px 4px' }}>
                            <FormControl fullWidth size="small">
                              <Select
                                value={actorFacturadoIdActual || ''}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleActorChangeExpensas(itemId, 'actorFacturadoId', e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                sx={{ fontSize: '0.75rem', height: '32px' }}
                                disabled={completarMutation.isLoading}
                              >
                                <MenuItem value="">-</MenuItem>
                                {actores.map((actor) => (
                                  <MenuItem key={actor.id} value={actor.id}>
                                    {actor.nombre || actor.codigo}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell sx={{ width: '150px', padding: '2px 4px' }}>
                            <FormControl fullWidth size="small">
                              <Select
                                value={quienSoportaCostoIdActual || ''}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleActorChangeExpensas(itemId, 'quienSoportaCostoId', e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                sx={{ fontSize: '0.75rem', height: '32px' }}
                                disabled={completarMutation.isLoading}
                              >
                                <MenuItem value="">-</MenuItem>
                                {actores.map((actor) => (
                                  <MenuItem key={actor.id} value={actor.id}>
                                    {actor.nombre || actor.codigo}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell align="center" sx={{ width: '50px', padding: '2px' }}>
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
                                    padding: '2px',
                                    '& .MuiSvgIcon-root': { fontSize: '1rem' },
                                    '&:hover': {
                                      backgroundColor: 'success.light',
                                      color: 'success.contrastText'
                                    }
                                  }}
                                >
                                  {completarMutation.isLoading ? (
                                    <CircularProgress size={16} />
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
                                {renderExpensaRow('ORD', expensa.itemIdORD, expensa.importeORD, null, expensa.actorFacturadoIdORD, expensa.quienSoportaCostoIdORD, expensa.actorFacturadoORD, expensa.quienSoportaCostoORD)}
                                {renderExpensaRow('EXT', expensa.itemIdEXT, expensa.importeEXT, null, expensa.actorFacturadoIdEXT, expensa.quienSoportaCostoIdEXT, expensa.actorFacturadoEXT, expensa.quienSoportaCostoEXT)}
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
              Este proceso generará liquidaciones e items de impuestos para todas las propiedades con contratos vigentes del período seleccionado.
              Las liquidaciones existentes serán reutilizadas (no se duplicarán).
            </Alert>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <strong>Requisitos:</strong>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                <li>Propiedades con impuestos activos configurados (PropiedadImpuesto)</li>
                <li>Contratos vigentes asociados a las propiedades</li>
                <li>El período debe estar dentro del rango de fechas del contrato</li>
                <li>Los impuestos se generarán según su periodicidad (MENSUAL, BIMESTRAL, etc.)</li>
              </ul>
            </Alert>
            <TextField
              fullWidth
              label="Período"
              type="month"
              value={periodoGenerar}
              onChange={(e) => setPeriodoGenerar(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Formato: YYYY-MM"
            />
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

