import { useState, useMemo, useEffect } from 'react';
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
  Tooltip
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import api from '../api';
import ParametroSelect from '../components/ParametroSelect';
import { useParametrosMap, getDescripcion, getAbreviatura } from '../utils/parametros';
import dayjs from 'dayjs';


export default function PendientesImpuestos() {
  const [periodo, setPeriodo] = useState(() => {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  });
  const [tipoImpuesto, setTipoImpuesto] = useState('');
  const [search, setSearch] = useState('');
  const [verCompletados, setVerCompletados] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [showPasswords, setShowPasswords] = useState({});
  const [generarDialog, setGenerarDialog] = useState(false);
  const [periodoGenerar, setPeriodoGenerar] = useState(() => {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  });
  const [importesEditados, setImportesEditados] = useState({}); // Estado para almacenar importes editados por itemId
  // Estado para controlar acordeones expandidos - por defecto todos expandidos
  const [expandedAccordions, setExpandedAccordions] = useState({});
  
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  
  const queryClient = useQueryClient();
  
  const tipoImpuestoMap = useParametrosMap('tipo_cargo');
  // estadoItemMap se obtendrá solo cuando sea necesario, para evitar el error 404

  // Función helper para obtener las columnas de código que deben mostrarse para un tipo de impuesto
  const getColumnasCodigo = useMemo(() => {
    return (tipoImpuestoCodigo) => {
      if (!tipoImpuestoMap?.lista || !tipoImpuestoCodigo) {
        return [];
      }
      
      const parametro = tipoImpuestoMap.lista.find(p => p.codigo === tipoImpuestoCodigo);
      if (!parametro) {
        // Si no se encuentra el parámetro, no mostrar columnas
        return [];
      }
      
      const columnas = [];
      // Solo agregar columnas si tienen etiquetas parametrizadas
      if (parametro.labelCodigo1 && parametro.labelCodigo1.trim() !== '') {
        columnas.push({ label: parametro.labelCodigo1, campo: 'codigo1' });
      }
      if (parametro.labelCodigo2 && parametro.labelCodigo2.trim() !== '') {
        columnas.push({ label: parametro.labelCodigo2, campo: 'codigo2' });
      }
      
      // Debug temporal
      if (columnas.length === 0 && parametro) {
        console.log('Parámetro encontrado pero sin etiquetas:', {
          codigo: parametro.codigo,
          labelCodigo1: parametro.labelCodigo1,
          labelCodigo2: parametro.labelCodigo2
        });
      }
      
      return columnas;
    };
  }, [tipoImpuestoMap?.lista]);

  // Obtener items pendientes
  const { data: pendientesData, isLoading, refetch } = useQuery({
    queryKey: ['pendientes-items', periodo, tipoImpuesto, search, verCompletados, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        periodo,
        ...(tipoImpuesto && { tipoImpuesto }),
        ...(search && { search }),
        verCompletados: verCompletados.toString(),
        page: page.toString(),
        pageSize: pageSize.toString()
      });
      const response = await api.get(`/liquidaciones/pendientes-items?${params}`);
      return response.data;
    }
  });

  // Agrupar items por tipo de impuesto
  const itemsAgrupados = useMemo(() => {
    if (!pendientesData?.data) return {};
    
    const agrupados = {};
    pendientesData.data.forEach(item => {
      const tipo = item.tipoImpuesto;
      if (!agrupados[tipo]) {
        agrupados[tipo] = [];
      }
      agrupados[tipo].push(item);
    });
    
    return agrupados;
  }, [pendientesData]);

  // Obtener lista de tipos de impuesto para tabs
  const tiposImpuesto = useMemo(() => {
    return Object.keys(itemsAgrupados).sort();
  }, [itemsAgrupados]);

  // Inicializar acordeones expandidos y valores editados cuando se cargan los datos
  useEffect(() => {
    if (pendientesData?.data && pendientesData.data.length > 0) {
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

      // Inicializar valores editados con importeAnterior para items pendientes
      setImportesEditados(prev => {
        const nuevos = { ...prev };
        let hayCambios = false;
        
        pendientesData.data.forEach(item => {
          if (item.estado === 'pendiente') {
            // Solo inicializar si no existe en el estado previo o si el valor ha cambiado
            const valorActual = prev[item.itemId];
            const valorNuevo = item.importeAnterior !== null && item.importeAnterior !== undefined
              ? item.importeAnterior.toString()
              : '';
            
            // Si no existe en el estado previo, o si el valor ha cambiado (por ejemplo, después de recargar datos)
            if (valorActual === undefined || valorActual === null) {
              nuevos[item.itemId] = valorNuevo;
              hayCambios = true;
            }
          }
        });
        
        return hayCambios ? nuevos : prev;
      });
    }
  }, [pendientesData?.data, itemsAgrupados]);

  // Mutation para completar item
  const completarMutation = useMutation({
    mutationFn: ({ itemId, importe, observaciones }) => 
      api.post(`/liquidaciones/items/${itemId}/completar`, { importe, observaciones }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['pendientes-items']);
      queryClient.invalidateQueries(['liquidaciones']);
      // Limpiar estados editados para este item
      setImportesEditados(prev => {
        const nuevo = { ...prev };
        delete nuevo[variables.itemId];
        return nuevo;
      });
      setSuccessMessage('Item completado exitosamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al completar el item');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  // Mutation para generar liquidaciones
  const generarMutation = useMutation({
    mutationFn: (periodoGen) => 
      api.post(`/liquidaciones/cron/generar?periodo=${periodoGen}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['pendientes-items']);
      queryClient.invalidateQueries(['liquidaciones']);
      setGenerarDialog(false);
      const resumen = data.data.resumen || {};
      const mensaje = `Generación completada:
        • Unidades encontradas: ${resumen.unidadesEncontradas || 0}
        • Liquidaciones creadas: ${resumen.creadas || 0}
        • Omitidas (existentes): ${resumen.omitidas || 0}
        • Omitidas (sin contrato): ${resumen.omitidosSinContrato || 0}
        • Omitidas (sin items): ${resumen.omitidosSinItems || 0}
        • Errores: ${resumen.errores || 0}`;
      setSuccessMessage(mensaje);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      
      // Si no se crearon liquidaciones, mostrar alerta más detallada
      if (resumen.creadas === 0) {
        setTimeout(() => {
          alert(`No se crearon liquidaciones. Revisa:\n${mensaje}\n\nPosibles causas:\n- Las unidades no tienen contratos vigentes en el período\n- Ya existen liquidaciones para ese período\n- Las unidades no tienen cuentas activas`);
        }, 1000);
      }
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || error.response?.data?.detalles || 'Error al generar liquidaciones');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const handleImporteChange = (itemId, value) => {
    setImportesEditados(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const handleCompletarItem = (item) => {
    // Obtener el importe editado o usar el importe anterior como valor por defecto
    const importeStr = importesEditados[item.itemId];
    const importeNum = importeStr !== undefined && importeStr !== '' 
      ? parseFloat(importeStr) 
      : (item.importeAnterior ? parseFloat(item.importeAnterior) : 0);
    
    if (isNaN(importeNum) || importeNum < 0) {
      setErrorMessage('El importe debe ser un número mayor o igual a 0');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    
    // Enviar observaciones vacías ya que no hay campo en la UI
    completarMutation.mutate({
      itemId: item.itemId,
      importe: importeNum,
      observaciones: ''
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

  const togglePassword = (itemId) => {
    setShowPasswords(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
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
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                fullWidth
                size="small"
                label="Período"
                type="month"
                value={periodo}
                onChange={(e) => {
                  setPeriodo(e.target.value);
                  setPage(1);
                }}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Tipo de Impuesto</InputLabel>
                <Select
                  value={tipoImpuesto}
                  label="Tipo de Impuesto"
                  onChange={(e) => {
                    setTipoImpuesto(e.target.value);
                    setPage(1);
                  }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {tiposImpuesto.map(tipo => (
                    <MenuItem key={tipo} value={tipo}>
                      {getDescripcion(tipoImpuestoMap, tipo) || tipo}
                    </MenuItem>
                  ))}
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
                  setPage(1);
                }}
                placeholder="Buscar..."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Switch
                  size="small"
                  checked={verCompletados}
                  onChange={(e) => {
                    setVerCompletados(e.target.checked);
                    setPage(1);
                  }}
                />
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                  Ver completados
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Acordeones por tipo de impuesto */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : !pendientesData?.data || pendientesData.data.length === 0 ? (
        <Alert severity="info">
          No hay items {verCompletados ? 'completados' : 'pendientes'} para el período seleccionado.
        </Alert>
      ) : (
        <Box sx={{ mb: 2 }}>
          {/* Filtrar items según tipoImpuesto seleccionado */}
          {Object.entries(itemsAgrupados)
            .filter(([tipo]) => !tipoImpuesto || tipo === tipoImpuesto)
            .map(([tipo, items]) => (
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
                      {getDescripcion(tipoImpuestoMap, tipo) || tipo}
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
                          {(() => {
                            const columnas = getColumnasCodigo(tipo);
                            return columnas.map((col, idx) => (
                              <TableCell key={idx}>{col.label}</TableCell>
                            ));
                          })()}
                          <TableCell>Usuario</TableCell>
                          <TableCell>Contraseña</TableCell>
                          <TableCell>Importe Anterior</TableCell>
                          <TableCell>Importe Nuevo</TableCell>
                          <TableCell align="center">Acción</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map((item) => {
                          // Para items pendientes, permitir edición inline
                          // Priorizar siempre el estado local (importesEditados) si existe
                          // Si no existe en el estado local, usar importeAnterior como valor inicial
                          // Si no hay importeAnterior, dejar vacío para que el usuario lo ingrese
                          const importeEditado = item.estado === 'pendiente'
                            ? (importesEditados[item.itemId] !== undefined && importesEditados[item.itemId] !== null
                                ? String(importesEditados[item.itemId]) 
                                : (item.importeAnterior !== null && item.importeAnterior !== undefined 
                                    ? String(item.importeAnterior)
                                    : ''))
                            : (item.importe !== null && item.importe !== undefined 
                                ? String(item.importe)
                                : '');
                          
                          const columnasCodigo = getColumnasCodigo(tipo);
                          
                          return (
                            <TableRow key={item.itemId} hover sx={{ '& .MuiTableCell-body': { py: 0.5 } }}>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.8rem', lineHeight: 1.2 }}>
                                  {item.unidad.direccion}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', lineHeight: 1.2 }}>
                                  {item.unidad.localidad}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.8rem' }}>{item.inquilino.display}</TableCell>
                              {columnasCodigo.map((col, idx) => (
                                <TableCell key={idx} sx={{ fontSize: '0.8rem' }}>
                                  {item.cuenta?.[col.campo] || '-'}
                                </TableCell>
                              ))}
                              <TableCell sx={{ fontSize: '0.8rem' }}>{item.cuenta?.user || '-'}</TableCell>
                              <TableCell>
                                {item.cuenta?.password ? (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                      {showPasswords[item.itemId] ? item.cuenta.password : '*****'}
                                    </Typography>
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        togglePassword(item.itemId);
                                      }}
                                      sx={{ padding: '1px', ml: 0.25, '& .MuiSvgIcon-root': { fontSize: '0.9rem' } }}
                                    >
                                      {showPasswords[item.itemId] ? (
                                        <VisibilityOff fontSize="inherit" />
                                      ) : (
                                        <Visibility fontSize="inherit" />
                                      )}
                                    </IconButton>
                                  </Box>
                                ) : (
                                  <Typography sx={{ fontSize: '0.8rem' }}>-</Typography>
                                )}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.8rem' }}>
                                {item.importeAnterior ? formatNumber(item.importeAnterior) : '-'}
                              </TableCell>
                              <TableCell sx={{ width: '120px', padding: '2px 4px' }}>
                                {item.estado === 'pendiente' ? (
                                  <TextField
                                    fullWidth
                                    size="small"
                                    type="number"
                                    value={importeEditado}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const nuevoValor = e.target.value;
                                      handleImporteChange(item.itemId, nuevoValor);
                                    }}
                                    onFocus={(e) => {
                                      e.stopPropagation();
                                      setTimeout(() => {
                                        if (e.target) {
                                          e.target.select();
                                        }
                                      }, 0);
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                        e.stopPropagation();
                                      }
                                    }}
                                    inputProps={{ 
                                      min: 0, 
                                      step: 0.01,
                                      style: { 
                                        textAlign: 'right', 
                                        fontSize: '0.75rem',
                                        MozAppearance: 'textfield',
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
                                      },
                                      '& input[type=number]::-webkit-inner-spin-button': {
                                        WebkitAppearance: 'none',
                                        margin: 0
                                      },
                                      '& input[type=number]::-webkit-outer-spin-button': {
                                        WebkitAppearance: 'none',
                                        margin: 0
                                      }
                                    }}
                                    disabled={completarMutation.isLoading}
                                  />
                                ) : item.estado === 'completado' && item.importe !== null && item.importe !== undefined ? (
                                  <Typography variant="body2" sx={{ textAlign: 'right', fontSize: '0.75rem' }}>
                                    {formatNumber(item.importe)}
                                  </Typography>
                                ) : (
                                  <Typography sx={{ fontSize: '0.8rem' }}>-</Typography>
                                )}
                              </TableCell>
                              <TableCell align="center" sx={{ width: '50px', padding: '2px' }}>
                                {item.estado === 'pendiente' ? (
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
                                ) : (
                                  <Chip
                                    label="✓"
                                    color="success"
                                    size="small"
                                    sx={{ 
                                      minWidth: '24px', 
                                      height: '18px',
                                      fontSize: '0.7rem',
                                      '& .MuiChip-label': { px: 0.5 }
                                    }}
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            ))}
          
          {/* Paginación */}
          {pendientesData.pagination && pendientesData.pagination.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={pendientesData.pagination.totalPages}
                page={page}
                onChange={(e, newPage) => setPage(newPage)}
                color="primary"
              />
            </Box>
          )}
        </Box>
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
              Este proceso generará liquidaciones y items para todos los contratos con estado "vigente" o "prorrogado" del período seleccionado.
              Las liquidaciones existentes serán omitidas.
            </Alert>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <strong>Requisitos:</strong>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                <li>Propiedades (unidades) con cuentas tributarias activas</li>
                <li>Contratos vigentes o prorrogados asociados a las propiedades</li>
                <li>El período debe estar dentro del rango de fechas del contrato</li>
                <li>Si una unidad no tiene contrato vigente, no se creará liquidación</li>
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

