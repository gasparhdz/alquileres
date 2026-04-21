import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Card,
  CardContent,
  Stack,
  InputAdornment,
  useMediaQuery,
  useTheme,
  Divider,
  List,
  ListItem,
  ListItemText,
  SwipeableDrawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  AttachMoney,
  Payment,
  Search,
  TrendingUp,
  People,
  History,
  Close,
  AccountBalance,
  Download,
  ArrowBack
} from '@mui/icons-material';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { FaFileExcel } from 'react-icons/fa';
import api from '../api';
import RequirePermission from '../components/RequirePermission';
import { usePermissions } from '../contexts/AuthContext';
import { RegistrarCobroModal, RegistrarPagoModal } from '../components/RegistrarPagoModal';
import { buildReturnUrlWithModal, hasReturnPath } from '../utils/returnPath';

const formatCurrency = (value) => {
  if (value == null) return '$ 0,00';
  return `$ ${parseFloat(value).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

// ============================================
// EXPORTAR A EXCEL - Estado de Cuenta
// ============================================
const exportarEstadoCuenta = (movimientos, tipo, nombreEntidad, propiedad = null) => {
  if (!movimientos || movimientos.length === 0) return;

  // Función para formatear dirección de propiedad
  const formatDireccion = (prop) => {
    if (!prop) return '';
    return [prop.dirCalle, prop.dirNro, prop.dirPiso ? `${prop.dirPiso}°` : null, prop.dirDepto ? `"${prop.dirDepto}"` : null]
      .filter(Boolean).join(' ');
  };

  // Función para formatear concepto
  const formatConcepto = (mov) => {
    let concepto = mov.concepto || '';
    if (tipo === 'propietario' && mov.propiedad) {
      const direccion = formatDireccion(mov.propiedad);
      if (direccion) {
        concepto = `${concepto} - ${direccion}`;
      }
      if (!mov.contratoId && !concepto.includes('(sin contrato)')) {
        concepto = `${concepto} (sin contrato)`;
      }
    }
    return concepto;
  };

  // Ordenar y calcular saldos
  const sorted = [...movimientos].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  let saldoAcum = 0;

  const datosExcel = sorted.map(mov => {
    const importe = parseFloat(mov.importe);
    const esDebito = mov.tipoMovimiento?.codigo === 'DEBITO';

    if (tipo === 'inquilino') {
      saldoAcum += esDebito ? importe : -importe;
    } else {
      saldoAcum += mov.tipoMovimiento?.codigo === 'CREDITO' ? importe : -importe;
    }

    let montoDebe = null;
    let montoHaber = null;

    if (tipo === 'inquilino') {
      if (esDebito) {
        montoDebe = importe;
      } else {
        montoHaber = importe;
      }
    } else {
      if (esDebito) {
        montoDebe = importe;
      } else {
        montoHaber = importe;
      }
    }

    return {
      'Fecha': dayjs(mov.fecha).format('DD/MM/YYYY'),
      'Concepto': formatConcepto(mov),
      'Debe': montoDebe || 0,
      'Haber': montoHaber || 0,
      'Saldo': parseFloat(saldoAcum.toFixed(2))
    };
  });

  // Crear libro de Excel
  const ws = XLSX.utils.json_to_sheet(datosExcel);

  // Ajustar anchos de columnas
  ws['!cols'] = [
    { wch: 12 },  // Fecha
    { wch: 50 },  // Concepto
    { wch: 15 },  // Debe
    { wch: 15 },  // Haber
    { wch: 15 }   // Saldo
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Estado de Cuenta');

  // Generar nombre de archivo
  const nombreLimpio = nombreEntidad
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 30);
  const periodo = dayjs().format('MM-YYYY');
  const tipoLabel = tipo === 'inquilino' ? 'Inquilino' : 'Propietario';
  const fileName = `Estado_Cuenta_${tipoLabel}_${nombreLimpio}_${periodo}.xlsx`;

  // Descargar archivo
  XLSX.writeFile(wb, fileName);
};

// ============================================
// KPI CARD COMPONENT
// ============================================
function KpiCard({ title, value, icon, color = 'primary' }) {
  return (
    <Card
      sx={{
        flex: { xs: '1 1 100%', sm: 1 },
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 1
      }}
    >
      <CardContent sx={{ py: { xs: 1.5, sm: 2 }, px: { xs: 2, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Box sx={{ color: `${color}.main`, display: 'flex', opacity: 0.8 }}>
            {icon}
          </Box>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
        </Box>
        <Typography variant="h5" fontWeight="bold" color="text.primary" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

// ============================================
// CHIP DE ESTADO DE CUENTA
// ============================================
function EstadoCuentaChip({ saldo }) {
  const chipStyle = { fontWeight: 500, height: 22, fontSize: '0.7rem' };

  if (saldo > 0) {
    return (
      <Chip
        label="Deuda"
        size="small"
        sx={{ bgcolor: 'error.lighter', color: 'error.dark', ...chipStyle }}
      />
    );
  } else if (saldo === 0) {
    return (
      <Chip
        label="Al Día"
        size="small"
        sx={{ bgcolor: 'success.lighter', color: 'success.dark', ...chipStyle }}
      />
    );
  } else {
    return (
      <Chip
        label="A Favor"
        size="small"
        sx={{ bgcolor: 'info.lighter', color: 'info.dark', ...chipStyle }}
      />
    );
  }
}

// ============================================
// BOTTOM SHEET - HISTORIAL DE MOVIMIENTOS (Mobile)
// ============================================
function HistorialBottomSheet({ open, onClose, contrato, tipo = 'inquilino' }) {
  const propietarioId = contrato?.propietarioId ?? contrato?.propietario?.id;
  const endpoint = tipo === 'inquilino'
    ? `/contratos/${contrato?.id}/cuenta-inquilino/movimientos`
    : `/clientes/${propietarioId}/cuenta-propietario/movimientos`;

  const { data: movimientos, isLoading } = useQuery({
    queryKey: [`movimientos-${tipo}`, tipo === 'inquilino' ? contrato?.id : propietarioId],
    queryFn: () => api.get(endpoint).then(r => r.data),
    enabled: open && (tipo === 'inquilino' ? !!contrato?.id : !!propietarioId)
  });

  const movimientosConSaldo = useMemo(() => {
    if (!movimientos) return [];

    const sorted = [...movimientos].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    let saldoAcum = 0;

    return sorted.map(mov => {
      const importe = parseFloat(mov.importe);
      if (tipo === 'inquilino') {
        saldoAcum += mov.tipoMovimiento?.codigo === 'DEBITO' ? importe : -importe;
      } else {
        saldoAcum += mov.tipoMovimiento?.codigo === 'CREDITO' ? importe : -importe;
      }
      return { ...mov, saldoAcumulado: saldoAcum };
    }).reverse();
  }, [movimientos, tipo]);

  const nombreEntidad = tipo === 'inquilino'
    ? (contrato?.inquilino?.razonSocial || `${contrato?.inquilino?.apellido || ''}, ${contrato?.inquilino?.nombre || ''}`.trim())
    : (contrato?.propietario?.razonSocial || `${contrato?.propietario?.apellido || ''}, ${contrato?.propietario?.nombre || ''}`.trim());

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => { }}
      disableSwipeToOpen
      PaperProps={{
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '85vh',
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }
      }}
    >
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Handle bar */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1, flexShrink: 0 }}>
          <Box sx={{ width: 40, height: 4, bgcolor: 'grey.300', borderRadius: 2 }} />
        </Box>

        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexShrink: 0 }}>
          <Box>
            <Typography variant="h6">Historial de Movimientos</Typography>
            <Typography variant="body2" color="text.secondary">{nombreEntidad}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {movimientos && movimientos.length > 0 && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Download sx={{ fontSize: '1rem !important' }} />}
                onClick={() => exportarEstadoCuenta(movimientos, tipo, nombreEntidad)}
                sx={{ py: 0.5, px: 1.5, fontSize: '0.75rem' }}
              >
                Exportar
              </Button>
            )}
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </Box>

        <Divider sx={{ mb: 2, flexShrink: 0 }} />

        {/* Content - área con scroll */}
        {isLoading ? (
          <Box sx={{ py: 4, textAlign: 'center', flex: 1 }}>
            <CircularProgress size={32} />
          </Box>
        ) : movimientosConSaldo.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center', flex: 1 }}>
            Sin movimientos registrados
          </Typography>
        ) : (
          <List
            disablePadding
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {movimientosConSaldo.map((mov, index) => {
              const esDebito = mov.tipoMovimiento?.codigo === 'DEBITO';
              const importe = Math.abs(parseFloat(mov.importe));

              // Lógica Debe/Haber
              let montoDebe = null;
              let montoHaber = null;

              if (tipo === 'inquilino') {
                if (esDebito) {
                  montoDebe = importe;
                } else {
                  montoHaber = importe;
                }
              } else {
                if (esDebito) {
                  montoDebe = importe;
                } else {
                  montoHaber = importe;
                }
              }

              // Color del saldo
              let saldoColor = 'text.primary';
              if (tipo === 'inquilino') {
                saldoColor = mov.saldoAcumulado > 0 ? 'error.main' : mov.saldoAcumulado < 0 ? 'success.main' : 'text.primary';
              } else {
                saldoColor = mov.saldoAcumulado > 0 ? 'success.main' : mov.saldoAcumulado < 0 ? 'error.main' : 'text.primary';
              }

              return (
                <Box key={mov.id}>
                  <ListItem sx={{ px: 0, py: 1.5, display: 'block' }}>
                    {/* Fila superior: Concepto y Monto a la derecha */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5, gap: 2 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ flex: 1, minWidth: 0 }}>
                        {mov.concepto || '-'}
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        color={montoHaber ? 'success.main' : (montoDebe ? 'error.main' : 'text.primary')}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        {montoHaber ? `+ ${formatCurrency(montoHaber)}` : (montoDebe ? `- ${formatCurrency(montoDebe)}` : formatCurrency(0))}
                      </Typography>
                    </Box>
                    {/* Fila inferior: Fecha y Saldo a la derecha */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(mov.fecha).format('DD/MM/YYYY')}
                      </Typography>
                      <Typography variant="caption" fontWeight={500} color={saldoColor}>
                        Saldo: {formatCurrency(mov.saldoAcumulado)}
                      </Typography>
                    </Box>
                  </ListItem>
                  {index < movimientosConSaldo.length - 1 && <Divider />}
                </Box>
              );
            })}
          </List>
        )}
      </Box>
    </SwipeableDrawer>
  );
}

// ============================================
// HISTORIAL TABLE (Desktop) - Versión compacta
// ============================================
function HistorialTable({ movimientos, tipo = 'inquilino' }) {
  const movimientosConSaldo = useMemo(() => {
    if (!movimientos) return [];

    const sorted = [...movimientos].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    let saldoAcum = 0;

    return sorted.map(mov => {
      const importe = parseFloat(mov.importe);
      if (tipo === 'inquilino') {
        // Inquilino: DÉBITO aumenta deuda (Debe), CRÉDITO reduce deuda (Haber)
        saldoAcum += mov.tipoMovimiento?.codigo === 'DEBITO' ? importe : -importe;
      } else {
        // Propietario: CRÉDITO aumenta lo que la inmobiliaria le debe (Haber), DÉBITO lo reduce (Debe)
        saldoAcum += mov.tipoMovimiento?.codigo === 'CREDITO' ? importe : -importe;
      }
      return { ...mov, saldoAcumulado: saldoAcum };
    }).reverse();
  }, [movimientos, tipo]);

  if (!movimientosConSaldo?.length) {
    return <Typography color="text.secondary">Sin movimientos registrados</Typography>;
  }

  // Función para formatear dirección de propiedad
  const formatDireccion = (prop) => {
    if (!prop) return '';
    return [prop.dirCalle, prop.dirNro, prop.dirPiso ? `${prop.dirPiso}°` : null, prop.dirDepto ? `"${prop.dirDepto}"` : null]
      .filter(Boolean).join(' ');
  };

  // Función para formatear concepto (para propietarios: concatenar propiedad y si es sin contrato)
  const formatConcepto = (mov) => {
    let concepto = mov.concepto || '';

    if (tipo === 'propietario' && mov.propiedad) {
      const direccion = formatDireccion(mov.propiedad);
      if (direccion) {
        concepto = `${concepto} - ${direccion}`;
      }
      // Si no tiene contrato asociado y el concepto no incluye ya "(sin contrato)", agregar indicador
      if (!mov.contratoId && !concepto.includes('(sin contrato)')) {
        concepto = `${concepto} (sin contrato)`;
      }
    }

    return concepto;
  };

  return (
    <Table
      size="small"
      sx={{
        minWidth: 520,
        '& .MuiTableCell-root': { py: 0.5, fontSize: '0.8125rem' },
        '& .MuiTableCell-head': { py: 0.75, fontWeight: 600 }
      }}
    >
      <TableHead>
        <TableRow sx={{ bgcolor: 'grey.50' }}>
          <TableCell>Fecha</TableCell>
          <TableCell>Concepto</TableCell>
          <TableCell align="right" sx={{ minWidth: 110, whiteSpace: 'nowrap' }}>Debe</TableCell>
          <TableCell align="right" sx={{ minWidth: 110, whiteSpace: 'nowrap' }}>Haber</TableCell>
          <TableCell align="right" sx={{ minWidth: 110, whiteSpace: 'nowrap' }}>Saldo</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {movimientosConSaldo.map((mov) => {
          const esDebito = mov.tipoMovimiento?.codigo === 'DEBITO';
          const importe = Math.abs(parseFloat(mov.importe));

          // Lógica de Debe/Haber según tipo de cuenta
          // INQUILINO: Debe = aumenta deuda del inquilino (DÉBITO), Haber = pago recibido (CRÉDITO)
          // PROPIETARIO: Debe = pago emitido o cargo (DÉBITO), Haber = liquidación a favor (CRÉDITO)
          let montoDebe = null;
          let montoHaber = null;

          if (tipo === 'inquilino') {
            if (esDebito) {
              montoDebe = importe; // Cargo al inquilino
            } else {
              montoHaber = importe; // Pago recibido del inquilino
            }
          } else {
            // Propietario
            if (esDebito) {
              montoDebe = importe; // Pago emitido al propietario o cargo
            } else {
              montoHaber = importe; // Liquidación a favor del propietario
            }
          }

          // Color del saldo según contexto
          // Inquilino: rojo si debe (saldo > 0), verde si tiene a favor (saldo < 0)
          // Propietario: verde si la inmobiliaria le debe (saldo > 0), rojo si el propietario debe (saldo < 0)
          let saldoColor = 'text.primary';
          if (tipo === 'inquilino') {
            saldoColor = mov.saldoAcumulado > 0 ? 'error.main' : mov.saldoAcumulado < 0 ? 'success.main' : 'text.primary';
          } else {
            saldoColor = mov.saldoAcumulado > 0 ? 'success.main' : mov.saldoAcumulado < 0 ? 'error.main' : 'text.primary';
          }

          return (
            <TableRow key={mov.id} sx={{ '&:last-child td': { borderBottom: 0 } }}>
              <TableCell>{dayjs(mov.fecha).format('DD/MM/YYYY')}</TableCell>
              <TableCell sx={{ maxWidth: 280 }}>{formatConcepto(mov)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, color: montoDebe ? 'error.main' : 'text.disabled', minWidth: 110, whiteSpace: 'nowrap' }}>
                {montoDebe ? formatCurrency(montoDebe) : '-'}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, color: montoHaber ? 'success.main' : 'text.disabled', minWidth: 110, whiteSpace: 'nowrap' }}>
                {montoHaber ? formatCurrency(montoHaber) : '-'}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, color: saldoColor, minWidth: 110, whiteSpace: 'nowrap' }}>
                {formatCurrency(mov.saldoAcumulado)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ============================================
// DESKTOP: FILA EXPANDIBLE INQUILINO
// ============================================
function DesktopFilaInquilino({ contrato, onCobrar, onReintegrar }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: movimientos, isLoading: loadingMov } = useQuery({
    queryKey: ['movimientos-inquilino', contrato.id],
    queryFn: () => api.get(`/contratos/${contrato.id}/cuenta-inquilino/movimientos`).then(r => r.data),
    enabled: open
  });

  const conciliarMutation = useMutation({
    mutationFn: () => api.post(`/contratos/${contrato.id}/conciliar-liquidaciones`).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['movimientos-inquilino', contrato.id]);
      queryClient.invalidateQueries(['liquidaciones']);
      queryClient.invalidateQueries({ queryKey: ['cuenta-inquilino-saldo'] });
      queryClient.invalidateQueries(['cobranzas-pendientes']);
      const n = data?.liquidacionesSaldadas ?? 0;
      alert(n > 0 ? `Se marcaron ${n} liquidación(es) como saldadas.` : 'No había liquidaciones emitidas pendientes de conciliar.');
    },
    onError: (err) => {
      alert(err.response?.data?.error || 'Error al conciliar liquidaciones.');
    }
  });

  const inquilino = contrato.inquilino;
  const propiedad = contrato.propiedad;
  const nombreInquilino = inquilino?.razonSocial ||
    `${inquilino?.apellido || ''}, ${inquilino?.nombre || ''}`.trim() || 'Sin datos';
  const direccion = propiedad
    ? `${propiedad.dirCalle || ''} ${propiedad.dirNro || ''}${propiedad.dirPiso ? ` ${propiedad.dirPiso}°` : ''}${propiedad.dirDepto ? ` "${propiedad.dirDepto}"` : ''}`.trim() + (propiedad?.localidad?.nombre ? `, ${propiedad.localidad.nombre}` : '') || '-'
    : '-';

  const saldoDeudor = contrato.saldoDeudor || 0;
  const tieneDeuda = saldoDeudor > 0;
  const tieneAFavor = saldoDeudor < 0;

  // Función para exportar (carga movimientos si no están cargados)
  const handleExportar = async (e) => {
    e?.stopPropagation?.();
    if (movimientos && movimientos.length > 0) {
      exportarEstadoCuenta(movimientos, 'inquilino', nombreInquilino);
    } else {
      try {
        const response = await api.get(`/contratos/${contrato.id}/cuenta-inquilino/movimientos`);
        if (response.data && response.data.length > 0) {
          exportarEstadoCuenta(response.data, 'inquilino', nombreInquilino);
        }
      } catch (error) {
        console.error('Error al cargar movimientos para exportar:', error);
      }
    }
  };

  const handleRowClick = () => setOpen(true);

  return (
    <>
      <TableRow
        sx={{ '& > *': { borderBottom: 'unset' }, cursor: 'pointer' }}
        hover
        onClick={handleRowClick}
      >
        <TableCell sx={{ px: 1 }}>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            sx={{ p: 0.5 }}
            title="Ver historial"
          >
            <History fontSize="small" />
          </IconButton>
        </TableCell>
        <TableCell>{nombreInquilino}</TableCell>
        <TableCell>{direccion}</TableCell>
        <TableCell align="center">
          <EstadoCuentaChip saldo={saldoDeudor} />
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: 600 }}>
          {formatCurrency(Math.abs(saldoDeudor))}
        </TableCell>
        <TableCell align="center" sx={{ minWidth: 160 }}>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }}>
            <RequirePermission codigo="movimiento.inquilinos.crear">
              <Button 
                variant="outlined" 
                color="primary" 
                size="small" 
                startIcon={<AttachMoney sx={{ fontSize: '1rem !important' }} />} 
                onClick={(e) => { e.stopPropagation(); tieneDeuda ? onCobrar(contrato) : onReintegrar(contrato); }}
                sx={{ 
                  py: 0.25, px: 1, fontSize: '0.75rem', minWidth: 'auto',
                  borderColor: 'success.main',
                  '&:hover': { bgcolor: 'success.main', color: 'white', borderColor: 'success.main' }
                }}
              >
                Registrar
              </Button>
            </RequirePermission>
            <IconButton
              size="small"
              onClick={handleExportar}
              title="Exportar a Excel"
              sx={{ p: 0.5, color: '#217346' }}
            >
              <FaFileExcel size={18} />
            </IconButton>
          </Box>
        </TableCell>
      </TableRow>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { minWidth: 560 } }}
      >
        <DialogTitle>
          Historial de Movimientos - {nombreInquilino}
        </DialogTitle>
        <DialogContent dividers sx={{ overflowX: 'auto' }}>
          {loadingMov ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <HistorialTable movimientos={movimientos || []} tipo="inquilino" />
          )}
        </DialogContent>
        <DialogActions>
          <RequirePermission codigo="movimiento.inquilinos.crear">
            <Button
              variant="outlined"
              color="primary"
              onClick={() => conciliarMutation.mutate()}
              disabled={conciliarMutation.isPending}
            >
              {conciliarMutation.isPending ? 'Conciliando...' : 'Conciliar liquidaciones'}
            </Button>
          </RequirePermission>
          <Button onClick={() => setOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ============================================
// DESKTOP: FILA PROPIETARIO (abre modal de historial)
// ============================================
function DesktopFilaPropietario({ contrato, onPagar, onCobrar }) {
  const [open, setOpen] = useState(false);

  // Obtener el ID del propietario para buscar todos sus movimientos
  const propiedades = contrato.propiedades || [];
  const propietarioId = contrato.propietarioId || contrato.propietario?.id;

  // Cargar movimientos del propietario (todas sus propiedades) cuando se abre el modal
  const { data: movimientos, isLoading: loadingMov } = useQuery({
    queryKey: ['movimientos-propietario', 'cliente', propietarioId],
    queryFn: () => api.get(`/clientes/${propietarioId}/cuenta-propietario/movimientos`).then(r => r.data),
    enabled: open && !!propietarioId
  });

  const propietario = contrato.propietario;
  const nombrePropietario = propietario?.razonSocial ||
    `${propietario?.apellido || ''}, ${propietario?.nombre || ''}`.trim() || 'Sin propietario';

  // Mostrar lista de propiedades del propietario (dirección + localidad por propiedad)
  const propiedadesTexto = propiedades.length > 0
    ? propiedades.map(p => [p.direccion, p.localidad].filter(Boolean).join(', ')).join(' / ')
    : [contrato.propiedad?.dirCalle, contrato.propiedad?.localidad?.nombre].filter(Boolean).join(', ') || '-';

  const saldoAPagar = contrato.saldoAPagar || 0;
  const tieneAPagar = saldoAPagar > 0; // Inmobiliaria debe al propietario
  const tieneDeuda = saldoAPagar < 0;  // Propietario debe a la inmobiliaria

  // Función para exportar (carga movimientos si no están cargados)
  const handleExportar = async (event) => {
    event.stopPropagation();
    if (movimientos && movimientos.length > 0) {
      exportarEstadoCuenta(movimientos, 'propietario', nombrePropietario);
    } else if (propietarioId) {
      try {
        const response = await api.get(`/clientes/${propietarioId}/cuenta-propietario/movimientos`);
        if (response.data && response.data.length > 0) {
          exportarEstadoCuenta(response.data, 'propietario', nombrePropietario);
        }
      } catch (error) {
        console.error('Error al cargar movimientos para exportar:', error);
      }
    }
  };

  const handleRowClick = () => {
    setOpen(true);
  };

  return (
    <>
      <TableRow
        sx={{ '& > *': { borderBottom: 'unset' }, cursor: 'pointer' }}
        hover
        onClick={handleRowClick}
      >
        <TableCell sx={{ px: 1 }}>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            sx={{ p: 0.5 }}
            title="Ver historial"
          >
            <History fontSize="small" />
          </IconButton>
        </TableCell>
        <TableCell>{nombrePropietario}</TableCell>
        <TableCell sx={{ maxWidth: 280 }}>
          <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
            {propiedadesTexto}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Chip
            label={tieneAPagar ? 'A Pagar' : tieneDeuda ? 'Deuda' : 'Al día'}
            size="small"
            sx={{
              bgcolor: tieneAPagar ? 'warning.lighter' : tieneDeuda ? 'error.lighter' : 'success.lighter',
              color: tieneAPagar ? 'warning.dark' : tieneDeuda ? 'error.dark' : 'success.dark',
              fontWeight: 500,
              height: 22,
              fontSize: '0.7rem'
            }}
          />
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: 600 }}>
          {formatCurrency(Math.abs(saldoAPagar))}
        </TableCell>
        <TableCell align="center" sx={{ minWidth: 160 }}>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }}>
            <RequirePermission codigo="movimiento.propietarios.crear">
              <Button 
                variant="outlined" 
                color="primary" 
                size="small" 
                startIcon={<AttachMoney sx={{ fontSize: '1rem !important' }} />} 
                onClick={(e) => { e.stopPropagation(); tieneAPagar ? onPagar(contrato) : onCobrar(contrato); }}
                sx={{ 
                  py: 0.25, px: 1, fontSize: '0.75rem', minWidth: 'auto',
                  borderColor: 'success.main',
                  '&:hover': { bgcolor: 'success.main', color: 'white', borderColor: 'success.main' }
                }}
              >
                Registrar
              </Button>
            </RequirePermission>
            <IconButton
              size="small"
              onClick={handleExportar}
              title="Exportar a Excel"
              sx={{ p: 0.5, color: '#217346' }}
            >
              <FaFileExcel size={18} />
            </IconButton>
          </Box>
        </TableCell>
      </TableRow>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { minWidth: 560 } }}
      >
        <DialogTitle>
          Historial de Movimientos - {nombrePropietario}
        </DialogTitle>
        <DialogContent dividers sx={{ overflowX: 'auto' }}>
          {loadingMov ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <HistorialTable movimientos={movimientos || []} tipo="propietario" />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ============================================
// MOBILE: CARD INQUILINO
// ============================================
function MobileCardInquilino({ contrato, onCobrar, onReintegrar, onVerHistorial }) {
  const inquilino = contrato.inquilino;
  const propiedad = contrato.propiedad;
  const nombreInquilino = inquilino?.razonSocial ||
    `${inquilino?.apellido || ''}, ${inquilino?.nombre || ''}`.trim() || 'Sin datos';
  const direccion = propiedad
    ? `${propiedad.dirCalle || ''} ${propiedad.dirNro || ''}${propiedad.dirPiso ? ` ${propiedad.dirPiso}°` : ''}${propiedad.dirDepto ? ` "${propiedad.dirDepto}"` : ''}`.trim() + (propiedad?.localidad?.nombre ? `, ${propiedad.localidad.nombre}` : '') || '-'
    : '-';

  const saldoDeudor = contrato.saldoDeudor || 0;
  const tieneDeuda = saldoDeudor > 0;
  const tieneAFavor = saldoDeudor < 0;

  // Función para exportar
  const handleExportar = async () => {
    try {
      const response = await api.get(`/contratos/${contrato.id}/cuenta-inquilino/movimientos`);
      if (response.data && response.data.length > 0) {
        exportarEstadoCuenta(response.data, 'inquilino', nombreInquilino);
      }
    } catch (error) {
      console.error('Error al cargar movimientos para exportar:', error);
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ pb: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1, pr: 1 }}>
            {nombreInquilino}
          </Typography>
          <EstadoCuentaChip saldo={saldoDeudor} />
        </Box>

        {/* Body */}
        <Typography variant="body2" color="text.secondary">
          {direccion}
        </Typography>

        <Divider sx={{ my: 1.5 }} />

        {/* Footer */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {tieneAFavor ? 'Saldo a Favor' : 'Saldo'}
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="text.primary">
              {formatCurrency(Math.abs(saldoDeudor))}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Button
              variant="text"
              size="small"
              startIcon={<History />}
              onClick={() => onVerHistorial(contrato)}
              sx={{ color: 'text.secondary' }}
            >
              Historial
            </Button>
            <IconButton size="small" onClick={handleExportar} title="Exportar a Excel" sx={{ color: '#217346' }}>
              <FaFileExcel size={18} />
            </IconButton>
          </Box>
        </Box>

        <RequirePermission codigo="movimiento.inquilinos.crear">
          <Button
            variant="outlined"
            color="success"
            fullWidth
            startIcon={<AttachMoney />}
            onClick={() => tieneDeuda ? onCobrar(contrato) : onReintegrar(contrato)}
            sx={{
              borderColor: 'success.main',
              '&:hover': { bgcolor: 'success.main', color: 'white', borderColor: 'success.main' }
            }}
          >
            Registrar Movimiento
          </Button>
        </RequirePermission>
      </CardContent>
    </Card>
  );
}

// ============================================
// MOBILE: CARD PROPIETARIO
// ============================================
function MobileCardPropietario({ contrato, onPagar, onCobrar, onVerHistorial }) {
  const propietario = contrato.propietario;
  const propiedades = contrato.propiedades || [];
  const propietarioId = contrato.propietarioId || propietario?.id;
  const nombrePropietario = propietario?.razonSocial ||
    `${propietario?.apellido || ''}, ${propietario?.nombre || ''}`.trim() || 'Sin propietario';

  // Mostrar lista de propiedades del propietario (dirección + localidad por propiedad)
  const propiedadesTexto = propiedades.length > 0
    ? propiedades.map(p => [p.direccion, p.localidad].filter(Boolean).join(', ')).join(' / ')
    : [contrato.propiedad?.dirCalle, contrato.propiedad?.localidad?.nombre].filter(Boolean).join(', ') || '-';

  const saldoAPagar = contrato.saldoAPagar || 0;
  const tieneAPagar = saldoAPagar > 0;
  const tieneDeuda = saldoAPagar < 0;

  // Función para exportar
  const handleExportar = async () => {
    if (!propietarioId) return;
    try {
      const response = await api.get(`/clientes/${propietarioId}/cuenta-propietario/movimientos`);
      if (response.data && response.data.length > 0) {
        exportarEstadoCuenta(response.data, 'propietario', nombrePropietario);
      }
    } catch (error) {
      console.error('Error al cargar movimientos para exportar:', error);
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ pb: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1, pr: 1 }}>
            {nombrePropietario}
          </Typography>
          <Chip
            label={tieneAPagar ? 'A Pagar' : tieneDeuda ? 'Deuda' : 'Al día'}
            size="small"
            sx={{
              bgcolor: tieneAPagar ? 'warning.lighter' : tieneDeuda ? 'error.lighter' : 'success.lighter',
              color: tieneAPagar ? 'warning.dark' : tieneDeuda ? 'error.dark' : 'success.dark',
              fontWeight: 500
            }}
          />
        </Box>

        {/* Body - Propiedades */}
        <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
          {propiedadesTexto}
        </Typography>

        <Divider sx={{ my: 1.5 }} />

        {/* Footer */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {tieneDeuda ? 'Deuda' : 'Saldo a Pagar'}
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="text.primary">
              {formatCurrency(Math.abs(saldoAPagar))}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Button
              variant="text"
              size="small"
              startIcon={<History />}
              onClick={() => onVerHistorial(contrato)}
              sx={{ color: 'text.secondary' }}
            >
              Historial
            </Button>
            <IconButton size="small" onClick={handleExportar} title="Exportar a Excel" sx={{ color: '#217346' }}>
              <FaFileExcel size={18} />
            </IconButton>
          </Box>
        </Box>

        <RequirePermission codigo="movimiento.propietarios.crear">
          <Button
            variant="outlined"
            color="primary"
            fullWidth
            startIcon={<Payment />}
            onClick={() => tieneAPagar ? onPagar(contrato) : onCobrar(contrato)}
            sx={{ '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
          >
            Registrar Movimiento
          </Button>
        </RequirePermission>
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function PagosCobranzas() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const returnUrl = buildReturnUrlWithModal(location.state);
  const showVolver = hasReturnPath(location.state);

  const { hasPermission } = usePermissions();
  const puedeVerInquilinos = hasPermission('movimiento.inquilinos.ver');
  const puedeVerPropietarios = hasPermission('movimiento.propietarios.ver');

  const [tab, setTab] = useState(puedeVerInquilinos ? 0 : puedeVerPropietarios ? 1 : 0);
  const [cobroModal, setCobroModal] = useState({ open: false, contrato: null, tipoOperacion: 'cobro' });
  const [pagoModal, setPagoModal] = useState({ open: false, contrato: null, tipoOperacion: 'pago' });
  const [historialSheet, setHistorialSheet] = useState({ open: false, contrato: null, tipo: 'inquilino' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Filtros
  const [filtroInquilino, setFiltroInquilino] = useState('todos');
  const [busquedaInquilino, setBusquedaInquilino] = useState('');
  const [filtroPropietario, setFiltroPropietario] = useState('todos');
  const [busquedaPropietario, setBusquedaPropietario] = useState('');

  // Leer tab y busqueda desde URL (ej: ?tab=inquilinos&busqueda=Nombre o desde modal "Ir a cuenta corriente")
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const busquedaParam = searchParams.get('busqueda');
    if (tabParam === 'propietarios' || tabParam === '1') {
      setTab(1);
      if (busquedaParam != null && busquedaParam.trim() !== '') {
        setBusquedaPropietario(decodeURIComponent(busquedaParam).trim());
      }
    } else if (tabParam === 'inquilinos' || tabParam === '0') {
      setTab(0);
      if (busquedaParam != null && busquedaParam.trim() !== '') {
        setBusquedaInquilino(decodeURIComponent(busquedaParam).trim());
      }
    }
    if (tabParam || busquedaParam != null) {
      searchParams.delete('tab');
      searchParams.delete('busqueda');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Queries
  const { data: cobranzasData = [], isLoading: loadingCobranzas, error: errorCobranzas } = useQuery({
    queryKey: ['cobranzas-pendientes', filtroInquilino],
    queryFn: () => api.get(`/cobranzas/pendientes?filtro=${filtroInquilino}`).then(r => r.data),
    enabled: puedeVerInquilinos
  });

  const { data: pagosData = [], isLoading: loadingPagos, error: errorPagos } = useQuery({
    queryKey: ['pagos-propietario-pendientes', filtroPropietario],
    queryFn: () => api.get(`/pagos-propietario/pendientes?filtro=${filtroPropietario}`).then(r => r.data),
    enabled: puedeVerPropietarios
  });

  // Filtrar por búsqueda
  const cobranzasFiltradas = useMemo(() => {
    if (!busquedaInquilino.trim()) return cobranzasData;
    const termino = busquedaInquilino.toLowerCase();
    return cobranzasData.filter(contrato => {
      const inquilino = contrato.inquilino;
      const propiedad = contrato.propiedad;
      const nombre = (inquilino?.razonSocial || `${inquilino?.apellido || ''} ${inquilino?.nombre || ''}`).toLowerCase();
      const direccion = `${propiedad?.dirCalle || ''} ${propiedad?.dirNro || ''}`.toLowerCase();
      return nombre.includes(termino) || direccion.includes(termino);
    });
  }, [cobranzasData, busquedaInquilino]);

  const pagosFiltrados = useMemo(() => {
    if (!busquedaPropietario.trim()) return pagosData;
    const termino = busquedaPropietario.toLowerCase();
    return pagosData.filter(contrato => {
      const propietario = contrato.propietario;
      const propiedad = contrato.propiedad;
      const nombre = (propietario?.razonSocial || `${propietario?.apellido || ''} ${propietario?.nombre || ''}`).toLowerCase();
      const direccion = `${propiedad?.dirCalle || ''} ${propiedad?.dirNro || ''}`.toLowerCase();
      return nombre.includes(termino) || direccion.includes(termino);
    });
  }, [pagosData, busquedaPropietario]);

  // KPIs Inquilinos
  const totalDeudaInquilinos = useMemo(() => cobranzasData.reduce((acc, c) => acc + Math.max(0, c.saldoDeudor || 0), 0), [cobranzasData]);
  const totalAFavorInquilinos = useMemo(() => cobranzasData.reduce((acc, c) => acc + Math.abs(Math.min(0, c.saldoDeudor || 0)), 0), [cobranzasData]);
  const inquilinosEnMora = useMemo(() => cobranzasData.filter(c => c.saldoDeudor > 0).length, [cobranzasData]);

  // KPIs Propietarios
  const totalAPagarPropietarios = useMemo(() => pagosData.reduce((acc, c) => acc + Math.max(0, c.saldoAPagar || 0), 0), [pagosData]);
  const totalDeudaPropietarios = useMemo(() => pagosData.reduce((acc, c) => acc + Math.abs(Math.min(0, c.saldoAPagar || 0)), 0), [pagosData]);
  const propietariosPendientes = useMemo(() => pagosData.filter(c => c.saldoAPagar !== 0).length, [pagosData]);

  return (
    <Box sx={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {showVolver && returnUrl && (
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(returnUrl)}
          sx={{ mb: 2 }}
        >
          Volver al perfil del cliente
        </Button>
      )}
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
        Cuentas Corrientes
      </Typography>

      {/* TABS */}
      <Paper sx={{ mb: { xs: 2, md: 3 } }}>
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          variant="fullWidth"
        >
          {puedeVerInquilinos && (
            <Tab
              value={0}
              label={
                <Box display="flex" alignItems="center" gap={0.5} sx={{ flexWrap: 'nowrap' }}>
                  <People fontSize="small" />
                  <Typography variant="body2" component="span">
                    Inquilinos
                  </Typography>
                  {inquilinosEnMora > 0 && <Chip label={inquilinosEnMora} size="small" color="error" sx={{ height: 20, '& .MuiChip-label': { px: 1 } }} />}
                </Box>
              }
              sx={{ minHeight: { xs: 48, md: 64 }, px: { xs: 1, md: 2 } }}
            />
          )}
          {puedeVerPropietarios && (
            <Tab
              value={1}
              label={
                <Box display="flex" alignItems="center" gap={0.5} sx={{ flexWrap: 'nowrap' }}>
                  <AccountBalance fontSize="small" />
                  <Typography variant="body2" component="span">
                    Propietarios
                  </Typography>
                  {propietariosPendientes > 0 && <Chip label={propietariosPendientes} size="small" color="primary" sx={{ height: 20, '& .MuiChip-label': { px: 1 } }} />}
                </Box>
              }
              sx={{ minHeight: { xs: 48, md: 64 }, px: { xs: 1, md: 2 } }}
            />
          )}
        </Tabs>
      </Paper>

      {/* TAB COBRANZAS (INQUILINOS) */}
      {tab === 0 && puedeVerInquilinos && (
        <Box>
          {/* KPI Cards */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: 2 }}>
            <KpiCard title="Total a Cobrar" value={formatCurrency(totalDeudaInquilinos)} icon={<TrendingUp />} color="error" />
            <KpiCard title="Inquilinos en Mora" value={inquilinosEnMora} icon={<People />} color="warning" />
            {totalAFavorInquilinos > 0 && (
              <KpiCard title="Total a Reintegrar" value={formatCurrency(totalAFavorInquilinos)} icon={<Payment />} color="info" />
            )}
          </Stack>

          {/* Filtros fuera del Paper */}
          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.5,
            alignItems: { xs: 'stretch', sm: 'center' },
            mb: 2
          }}>
            <TextField
              size="small"
              placeholder="Buscar inquilino o propiedad..."
              value={busquedaInquilino}
              onChange={(e) => setBusquedaInquilino(e.target.value)}
              sx={{ width: { xs: '100%', sm: 280 } }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: '1.1rem' }} /></InputAdornment>
              }}
            />
            <FormControl size="small" sx={{ width: { xs: '100%', sm: 140 } }}>
              <Select
                value={filtroInquilino}
                onChange={(e) => setFiltroInquilino(e.target.value)}
                displayEmpty
              >
                <MenuItem value="con_deuda">Con Deuda</MenuItem>
                <MenuItem value="a_favor">A Favor</MenuItem>
                <MenuItem value="al_dia">Al Día</MenuItem>
                <MenuItem value="todos">Todos</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Tabla */}
          <Paper>
            {loadingCobranzas ? (
              <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={28} /></Box>
            ) : errorCobranzas ? (
              <Alert severity="error" sx={{ m: 1.5 }}>Error al cargar cobranzas: {errorCobranzas.message}</Alert>
            ) : cobranzasFiltradas.length === 0 ? (
              <Alert severity="info" sx={{ m: 1.5 }}>
                {filtroInquilino === 'con_deuda' ? 'No hay inquilinos con deuda pendiente' : filtroInquilino === 'al_dia' ? 'No hay inquilinos al día' : 'No hay datos para mostrar'}
              </Alert>
            ) : isMobile ? (
              /* MOBILE: Cards */
              <Box sx={{ p: 1.5 }}>
                {cobranzasFiltradas.map((contrato) => (
                  <MobileCardInquilino
                    key={contrato.id}
                    contrato={contrato}
                    onCobrar={(c) => setCobroModal({ open: true, contrato: c, tipoOperacion: 'cobro' })}
                    onReintegrar={(c) => setCobroModal({ open: true, contrato: c, tipoOperacion: 'reintegro' })}
                    onVerHistorial={(c) => setHistorialSheet({ open: true, contrato: c, tipo: 'inquilino' })}
                  />
                ))}
              </Box>
            ) : (
              /* DESKTOP: Table compacta */
              <TableContainer>
                <Table size="small" sx={{ '& .MuiTableCell-root': { py: '6px', fontSize: '0.8125rem' }, '& .MuiTableCell-head': { py: '8px', fontWeight: 600 } }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell width={40} sx={{ px: 1 }} />
                      <TableCell>Inquilino</TableCell>
                      <TableCell>Propiedad</TableCell>
                      <TableCell align="center">Estado</TableCell>
                      <TableCell align="right">Saldo</TableCell>
                      <TableCell align="center" width={100}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cobranzasFiltradas.map((contrato) => (
                      <DesktopFilaInquilino
                        key={contrato.id}
                        contrato={contrato}
                        onCobrar={(c) => setCobroModal({ open: true, contrato: c, tipoOperacion: 'cobro' })}
                        onReintegrar={(c) => setCobroModal({ open: true, contrato: c, tipoOperacion: 'reintegro' })}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      )}

      {/* TAB PAGOS (PROPIETARIOS) */}
      {tab === 1 && puedeVerPropietarios && (
        <Box>
          {/* KPI Cards */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: 2 }}>
            <KpiCard title="Total a Pagar" value={formatCurrency(totalAPagarPropietarios)} icon={<TrendingUp />} color="primary" />
            <KpiCard title="Propietarios Pendientes" value={propietariosPendientes} icon={<People />} color="warning" />
            {totalDeudaPropietarios > 0 && (
              <KpiCard title="Total Deuda Prop." value={formatCurrency(totalDeudaPropietarios)} icon={<TrendingUp />} color="error" />
            )}
          </Stack>

          {/* Filtros fuera del Paper */}
          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.5,
            alignItems: { xs: 'stretch', sm: 'center' },
            mb: 2
          }}>
            <TextField
              size="small"
              placeholder="Buscar propietario o propiedad..."
              value={busquedaPropietario}
              onChange={(e) => setBusquedaPropietario(e.target.value)}
              sx={{ width: { xs: '100%', sm: 280 } }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: '1.1rem' }} /></InputAdornment>
              }}
            />
            <FormControl size="small" sx={{ width: { xs: '100%', sm: 140 } }}>
              <Select
                value={filtroPropietario}
                onChange={(e) => setFiltroPropietario(e.target.value)}
                displayEmpty
              >
                <MenuItem value="pendiente">Pendiente</MenuItem>
                <MenuItem value="a_pagar">A Pagar</MenuItem>
                <MenuItem value="con_deuda">Prop. Deudor</MenuItem>
                <MenuItem value="al_dia">Pagado</MenuItem>
                <MenuItem value="todos">Todos</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Tabla */}
          <Paper>
            {loadingPagos ? (
              <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={28} /></Box>
            ) : errorPagos ? (
              <Alert severity="error" sx={{ m: 1.5 }}>Error al cargar pagos: {errorPagos.message}</Alert>
            ) : pagosFiltrados.length === 0 ? (
              <Alert severity="info" sx={{ m: 1.5 }}>
                {filtroPropietario === 'pendiente' ? 'No hay pagos pendientes a propietarios' : filtroPropietario === 'al_dia' ? 'No hay propietarios con pagos al día' : 'No hay datos para mostrar'}
              </Alert>
            ) : isMobile ? (
              /* MOBILE: Cards */
              <Box sx={{ p: 1.5 }}>
                {pagosFiltrados.map((contrato) => (
                  <MobileCardPropietario
                    key={contrato.tipo === 'propiedad' ? `prop-${contrato.propiedadId}` : contrato.id}
                    contrato={contrato}
                    onPagar={(c) => setPagoModal({ open: true, contrato: c, tipoOperacion: 'pago' })}
                    onCobrar={(c) => setPagoModal({ open: true, contrato: c, tipoOperacion: 'cobro' })}
                    onVerHistorial={(c) => setHistorialSheet({ open: true, contrato: c, tipo: 'propietario' })}
                  />
                ))}
              </Box>
            ) : (
              /* DESKTOP: Table compacta */
              <TableContainer>
                <Table size="small" sx={{ '& .MuiTableCell-root': { py: '6px', fontSize: '0.8125rem' }, '& .MuiTableCell-head': { py: '8px', fontWeight: 600 } }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell width={40} sx={{ px: 1 }} />
                      <TableCell>Propietario</TableCell>
                      <TableCell>Propiedad</TableCell>
                      <TableCell align="center">Estado</TableCell>
                      <TableCell align="right">Saldo</TableCell>
                      <TableCell align="center" width={100}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagosFiltrados.map((contrato) => (
                      <DesktopFilaPropietario
                        key={contrato.tipo === 'propiedad' ? `prop-${contrato.propiedadId}` : contrato.id}
                        contrato={contrato}
                        onPagar={(c) => setPagoModal({ open: true, contrato: c, tipoOperacion: 'pago' })}
                        onCobrar={(c) => setPagoModal({ open: true, contrato: c, tipoOperacion: 'cobro' })}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      )}

      {/* Modals */}
      <RegistrarCobroModal
        open={cobroModal.open}
        onClose={() => setCobroModal({ open: false, contrato: null, tipoOperacion: 'cobro' })}
        contrato={cobroModal.contrato}
        tipoOperacion={cobroModal.tipoOperacion}
        onSuccess={() => setSnackbar({ open: true, message: cobroModal.tipoOperacion === 'reintegro' ? 'Reintegro registrado correctamente' : 'Cobro registrado correctamente', severity: 'success' })}
      />

      <RegistrarPagoModal
        open={pagoModal.open}
        onClose={() => setPagoModal({ open: false, contrato: null, tipoOperacion: 'pago' })}
        contrato={pagoModal.contrato}
        tipoOperacion={pagoModal.tipoOperacion}
        onSuccess={() => setSnackbar({ open: true, message: pagoModal.tipoOperacion === 'cobro' ? 'Cobro registrado correctamente' : 'Pago registrado correctamente', severity: 'success' })}
      />

      {/* Bottom Sheet - Historial (Mobile) */}
      <HistorialBottomSheet
        open={historialSheet.open}
        onClose={() => setHistorialSheet({ open: false, contrato: null, tipo: 'inquilino' })}
        contrato={historialSheet.contrato}
        tipo={historialSheet.tipo}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
