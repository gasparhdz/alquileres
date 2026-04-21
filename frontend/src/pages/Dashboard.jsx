import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Stack,
  Divider,
  GlobalStyles,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  alpha,
  Snackbar,
  Alert
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EventIcon from '@mui/icons-material/Event';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import RefreshIcon from '@mui/icons-material/Refresh';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DraftsIcon from '@mui/icons-material/Drafts';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import api from '../api';
import { RegistrarCobroModal, RegistrarPagoModal } from '../components/RegistrarPagoModal';

const DashboardGlobalStyles = () => (
  <GlobalStyles styles={{
    '@keyframes pulseAjustes': {
      '0%, 100%': {
        boxShadow: '0 4px 24px rgba(13, 148, 136, 0.5), 0 0 0 0 rgba(245, 158, 11, 0.5)'
      },
      '50%': {
        boxShadow: '0 8px 32px rgba(13, 148, 136, 0.7), 0 0 0 10px rgba(245, 158, 11, 0)'
      }
    },
    '@keyframes pulseError': {
      '0%, 100%': {
        boxShadow: '0 4px 24px rgba(239, 68, 68, 0.3)'
      },
      '50%': {
        boxShadow: '0 8px 32px rgba(239, 68, 68, 0.5)'
      }
    },
    '@keyframes pulseWarning': {
      '0%, 100%': {
        boxShadow: '0 4px 24px rgba(245, 158, 11, 0.3)'
      },
      '50%': {
        boxShadow: '0 8px 32px rgba(245, 158, 11, 0.5)'
      }
    },
    '@keyframes titilaNumero': {
      '0%, 100%': { opacity: 1, transform: 'scale(1)' },
      '50%': { opacity: 0.92, transform: 'scale(1.06)' }
    },
    '@keyframes pulseDot': {
      '0%, 100%': { opacity: 1, transform: 'scale(1)' },
      '50%': { opacity: 0.5, transform: 'scale(1.3)' }
    }
  }} />
);

const ActionCard = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  iconColor = 'primary.main',
  onClick, 
  isLoading,
  isUrgent = false,
  pulseType = 'error',
  chipLabel = null,
  chipColor = 'warning'
}) => {
  const getPulseAnimation = () => {
    if (!isUrgent || value <= 0) return 'none';
    switch (pulseType) {
      case 'ajustes': return 'pulseAjustes 2.2s ease-in-out infinite';
      case 'error': return 'pulseError 2s ease-in-out infinite';
      case 'warning': return 'pulseWarning 2s ease-in-out infinite';
      default: return 'none';
    }
  };

  const getDotColor = () => {
    switch (pulseType) {
      case 'ajustes': return '#f59e0b';
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#ef4444';
    }
  };

  return (
    <Card
      onClick={!isLoading && value > 0 ? onClick : undefined}
      sx={{
        height: '100%',
        cursor: !isLoading && value > 0 && onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        boxShadow: isUrgent && value > 0 
          ? pulseType === 'ajustes' 
            ? '0 6px 28px rgba(13, 148, 136, 0.55)' 
            : '0 4px 16px rgba(0, 0, 0, 0.12)'
          : '0 2px 8px rgba(0, 0, 0, 0.08)',
        border: '1px solid',
        borderColor: 'divider',
        animation: getPulseAnimation(),
        '&:hover': value > 0 && onClick ? {
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
          transform: 'translateY(-3px)'
        } : {}
      }}
    >
      <CardContent sx={{ position: 'relative' }}>
        {isUrgent && value > 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: getDotColor(),
              boxShadow: `0 0 12px ${getDotColor()}80`,
              animation: 'pulseDot 1.2s ease-in-out infinite'
            }}
          />
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                {title}
              </Typography>
              {chipLabel && isUrgent && value > 0 && (
                <Chip
                  label={chipLabel}
                  size="small"
                  color={chipColor}
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    animation: 'titilaNumero 1.8s ease-in-out infinite'
                  }}
                />
              )}
            </Box>
            <Typography 
              variant="h3" 
              fontWeight="bold" 
              color="text.primary"
              sx={isUrgent && value > 0 ? { animation: 'titilaNumero 2s ease-in-out infinite' } : {}}
            >
              {isLoading ? '-' : value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              bgcolor: 'rgba(0,0,0,0.04)',
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();

  // Ajustes de alquiler pendientes
  const { data: ajustesPendientes, isLoading: loadingAjustes } = useQuery({
    queryKey: ['dashboard', 'ajustes-pendientes'],
    queryFn: async () => {
      const res = await api.get('/dashboard/ajustes-pendientes', { params: { modo: 'todos', dias: 15 } });
      return res.data;
    }
  });

  // Contratos por vencer (60 días)
  const { data: contratosPorVencer, isLoading: loadingVencimientos } = useQuery({
    queryKey: ['dashboard', 'contratos-por-vencer'],
    queryFn: async () => {
      const res = await api.get('/dashboard/contratos-por-vencer', { params: { dias: 60 } });
      return res.data;
    }
  });

  // Cobranza crítica (inquilinos en mora)
  const { data: cobranzaCritica, isLoading: loadingCobranza } = useQuery({
    queryKey: ['dashboard', 'cobranza-critica'],
    queryFn: async () => {
      const res = await api.get('/dashboard/cobranza-critica');
      return res.data;
    }
  });

  // Liquidaciones pendientes (listas para emitir)
  const { data: liquidacionesPendientes, isLoading: loadingLiquidaciones } = useQuery({
    queryKey: ['dashboard', 'liquidaciones-pendientes'],
    queryFn: async () => {
      const res = await api.get('/dashboard/liquidaciones-pendientes');
      return res.data;
    }
  });

  // Propiedades vacantes (sin contrato vigente)
  const { data: propiedadesVacantes, isLoading: loadingVacantes } = useQuery({
    queryKey: ['dashboard', 'propiedades-vacantes'],
    queryFn: async () => {
      const res = await api.get('/dashboard/propiedades-vacantes');
      return res.data;
    }
  });

  // Pagos a propietarios pendientes
  const { data: pagosPropietarios, isLoading: loadingPagosProp } = useQuery({
    queryKey: ['dashboard', 'pagos-propietarios-pendientes'],
    queryFn: async () => {
      const res = await api.get('/dashboard/pagos-propietarios-pendientes');
      return res.data;
    }
  });

  // Estados para modales
  const [openAjustes, setOpenAjustes] = useState(false);
  const [openVencimientos, setOpenVencimientos] = useState(false);
  const [openCobranza, setOpenCobranza] = useState(false);
  const [openVacantes, setOpenVacantes] = useState(false);
  
  // Estado para modal de registrar cobro y pago
  const [cobroModal, setCobroModal] = useState({ open: false, contrato: null });
  const [pagoModal, setPagoModal] = useState({ open: false, contrato: null });
  const [openPagosPropietarios, setOpenPagosPropietarios] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const queryClient = useQueryClient();

  // Abrir modal automáticamente si viene de otra página (ej: ?modal=vacantes)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const modal = searchParams.get('modal');
    if (modal === 'vacantes') {
      setOpenVacantes(true);
      searchParams.delete('modal');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Cálculos
  const totalAjustesPendientes = (ajustesPendientes?.meta?.totalVencidos ?? 0) + (ajustesPendientes?.meta?.totalProximos ?? 0);
  const totalVencidos = ajustesPendientes?.meta?.totalVencidos ?? 0;
  const totalProximos = ajustesPendientes?.meta?.totalProximos ?? 0;
  const totalContratosPorVencer = contratosPorVencer?.meta?.total ?? 0;
  const totalInquilinosMora = cobranzaCritica?.meta?.totalInquilinos ?? 0;
  const totalDeuda = cobranzaCritica?.meta?.totalDeuda ?? 0;
  const totalPropiedadesVacantes = propiedadesVacantes?.meta?.total ?? 0;
  const totalPagosPropietarios = pagosPropietarios?.meta?.total ?? 0;
  const totalSaldoPropietarios = pagosPropietarios?.meta?.totalSaldo ?? 0;

  // Liquidaciones pendientes por categoría
  const liquidacionesFaltanItems = liquidacionesPendientes?.faltanItems ?? { data: [], total: 0 };
  const liquidacionesBorradores = liquidacionesPendientes?.borradores ?? { data: [], total: 0 };
  const liquidacionesListas = liquidacionesPendientes?.listas ?? { data: [], total: 0 };
  const totalLiquidacionesPendientes = liquidacionesPendientes?.meta?.totalGeneral ?? 0;

  // Estado para acordeones expandidos
  const [expandedAccordion, setExpandedAccordion] = useState(null);
  const handleAccordionChange = (panel) => (event, isExpanded) => {
    setExpandedAccordion(isExpanded ? panel : null);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  const formatFecha = (f) => (f ? new Date(f).toLocaleDateString('es-AR') : '-');

  // Período: mostrar MM-AAAA (el backend puede enviar YYYY-MM)
  const formatPeriodo = (p) => {
    if (!p) return '-';
    if (/^\d{4}-\d{2}$/.test(p)) return p.replace(/^(\d{4})-(\d{2})$/, '$2-$1');
    return p;
  };

  const handleActualizarAjuste = (contratoId) => {
    setOpenAjustes(false);
    navigate(`/contratos?contratoId=${contratoId}&tab=ajustes&accion=nuevo`, { state: { from: '/' } });
  };

  const handleVerContrato = (contratoId) => {
    setOpenVencimientos(false);
    navigate(`/contratos?contratoId=${contratoId}`);
  };

  const handleVerCobranza = (row) => {
    // Construir objeto contrato con la estructura que espera RegistrarCobroModal
    const contratoParaCobro = {
      id: row.contratoId,
      inquilino: {
        // Parsear el nombre del inquilino que viene como string "Apellido, Nombre" o "Razon Social"
        razonSocial: row.inquilino.includes(',') ? null : row.inquilino,
        apellido: row.inquilino.includes(',') ? row.inquilino.split(',')[0]?.trim() : null,
        nombre: row.inquilino.includes(',') ? row.inquilino.split(',')[1]?.trim() : null
      },
      saldoDeudor: row.saldo
    };
    setCobroModal({ open: true, contrato: contratoParaCobro });
  };

  const handlePagarPropietario = (row) => {
    // Construir objeto contrato con la estructura que espera RegistrarPagoModal
    // Para propietarios agrupados, usar la primera propiedad como referencia
    const primeraPropiedadId = row.propiedades?.[0]?.id || row.propiedadId;
    const contratoParaPago = {
      id: row.contratoId,
      propiedadId: primeraPropiedadId,
      propietarioId: row.propietarioId,
      tipo: row.tipo || 'propiedad', // 'propietario' o 'propiedad'
      propietario: {
        // Parsear el nombre del propietario que viene como string "Apellido, Nombre" o "Razon Social"
        razonSocial: row.propietario.includes(',') ? null : row.propietario,
        apellido: row.propietario.includes(',') ? row.propietario.split(',')[0]?.trim() : null,
        nombre: row.propietario.includes(',') ? row.propietario.split(',')[1]?.trim() : null
      },
      saldoAPagar: row.saldo,
      propiedades: row.propiedades
    };
    setPagoModal({ open: true, contrato: contratoParaPago });
  };

  const handleVerLiquidacion = (liquidacionId) => {
    navigate(`/liquidaciones?id=${liquidacionId}`, { state: { from: 'dashboard' } });
  };

  const handleEmitirLiquidacion = (liquidacionId) => {
    navigate(`/liquidaciones?id=${liquidacionId}&accion=emitir`);
  };

  return (
    <Box>
      <DashboardGlobalStyles />
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" fontWeight="bold">
          Panel de Control
        </Typography>
      </Box>

      {/* KPIs - Tarjetas de Acción */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Ajustes de Alquiler - Con animación especial verde/teal */}
        <Grid item xs={12} sm={6} md={3}>
          <ActionCard
            title="Ajustes de Alquiler"
            value={totalAjustesPendientes}
            subtitle={`${totalVencidos} vencidos, ${totalProximos} próximos`}
            icon={<TrendingUpIcon sx={{ fontSize: 28, color: '#0d9488' }} />}
            onClick={() => setOpenAjustes(true)}
            isLoading={loadingAjustes}
            isUrgent={totalAjustesPendientes > 0}
            pulseType="ajustes"
            chipLabel="¡Pendientes!"
            chipColor="warning"
          />
        </Grid>

        {/* Propiedades Disponibles */}
        <Grid item xs={12} sm={6} md={3}>
          <ActionCard
            title="Propiedades Disponibles"
            value={totalPropiedadesVacantes}
            subtitle="Listas para comercializar"
            icon={<HomeWorkIcon sx={{ fontSize: 28, color: totalPropiedadesVacantes > 0 ? '#f59e0b' : '#22c55e' }} />}
            onClick={() => setOpenVacantes(true)}
            isLoading={loadingVacantes}
            isUrgent={false}
          />
        </Grid>

        {/* Cobros Pendientes */}
        <Grid item xs={12} sm={6} md={3}>
          <ActionCard
            title="Cobros Pendientes"
            value={totalInquilinosMora}
            subtitle={totalDeuda > 0 ? `Total: ${formatCurrency(totalDeuda)}` : 'Sin deudas pendientes'}
            icon={<WarningAmberIcon sx={{ fontSize: 28, color: totalInquilinosMora > 0 ? '#ef4444' : '#22c55e' }} />}
            onClick={() => setOpenCobranza(true)}
            isLoading={loadingCobranza}
            isUrgent={totalInquilinosMora > 0}
            pulseType="error"
          />
        </Grid>

        {/* Pagos a Propietarios Pendientes */}
        <Grid item xs={12} sm={6} md={3}>
          <ActionCard
            title="Pagos a Propietarios Pendientes"
            value={totalPagosPropietarios}
            subtitle={totalSaldoPropietarios > 0 ? `Total: ${formatCurrency(totalSaldoPropietarios)}` : 'Pendientes de transferencia'}
            icon={<AccountBalanceWalletIcon sx={{ fontSize: 28, color: totalPagosPropietarios > 0 ? '#f59e0b' : '#22c55e' }} />}
            onClick={() => setOpenPagosPropietarios(true)}
            isLoading={loadingPagosProp}
            isUrgent={totalPagosPropietarios > 0}
            pulseType="warning"
          />
        </Grid>
      </Grid>

      {/* Panel Inferior - Listas de Acción Rápida */}
      <Grid container spacing={3}>
        {/* Lista A: Próximos a Vencer */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  Contratos por Vencer
                </Typography>
                <Chip
                  label={`${totalContratosPorVencer} contratos`}
                  color={totalContratosPorVencer > 0 ? 'error' : 'success'}
                  size="small"
                />
              </Box>
              
              {loadingVencimientos ? (
                <LinearProgress />
              ) : contratosPorVencer?.data?.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Propiedad</strong></TableCell>
                        <TableCell><strong>Inquilino</strong></TableCell>
                        <TableCell align="center"><strong>Vence en</strong></TableCell>
                        <TableCell align="right"><strong>Acción</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {contratosPorVencer.data.slice(0, 5).map((row) => (
                        <TableRow key={row.contratoId} hover>
                          <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.propiedad}
                          </TableCell>
                          <TableCell sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.inquilino}
                          </TableCell>
                          <TableCell align="center">
                            <Chip 
                              label={`${row.diasRestantes} días`}
                              size="small"
                              color={row.diasRestantes <= 15 ? 'error' : row.diasRestantes <= 30 ? 'warning' : 'default'}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Ver contrato">
                              <IconButton size="small" onClick={() => handleVerContrato(row.contratoId)}>
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="success.main">
                    ✓ No hay contratos por vencer en los próximos 60 días
                  </Typography>
                </Box>
              )}
              
              {contratosPorVencer?.data?.length > 5 && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Button size="small" onClick={() => setOpenVencimientos(true)}>
                    Ver todos ({totalContratosPorVencer})
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Lista B: Liquidaciones Pendientes de Acción */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
            <CardContent sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  Liquidaciones Pendientes de Acción
                </Typography>
                <Chip
                  label={`${totalLiquidacionesPendientes} total`}
                  color={totalLiquidacionesPendientes > 0 ? 'warning' : 'success'}
                  size="small"
                />
              </Box>
              
              {loadingLiquidaciones ? (
                <LinearProgress />
              ) : totalLiquidacionesPendientes > 0 ? (
                <Box sx={{ mx: -2 }}>
                  {/* Acordeón ROJO: Faltan completar importes */}
                  <Accordion 
                    expanded={expandedAccordion === 'faltanItems'} 
                    onChange={handleAccordionChange('faltanItems')}
                    disabled={liquidacionesFaltanItems.total === 0}
                    disableGutters
                    elevation={0}
                    sx={{
                      '&:before': { display: 'none' },
                      bgcolor: 'transparent',
                      opacity: liquidacionesFaltanItems.total === 0 ? 0.5 : 1
                    }}
                  >
                    <AccordionSummary 
                      expandIcon={<ExpandMoreIcon />}
                      sx={{ 
                        bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
                        borderLeft: '4px solid',
                        borderColor: 'error.main',
                        minHeight: 48,
                        '& .MuiAccordionSummary-content': { my: 1 }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                        <ErrorOutlineIcon sx={{ color: 'error.main', fontSize: 20 }} />
                        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                          Faltan completar importes
                        </Typography>
                        <Chip 
                          label={liquidacionesFaltanItems.total}
                          size="small"
                          color="error"
                          sx={{ fontWeight: 700, minWidth: 32 }}
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ py: 0.5 }}><strong>Período</strong></TableCell>
                              <TableCell sx={{ py: 0.5 }}><strong>Propiedad</strong></TableCell>
                              <TableCell align="right" sx={{ py: 0.5 }}><strong>Acción</strong></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {liquidacionesFaltanItems.data.slice(0, 5).map((row) => (
                              <TableRow key={row.id} hover>
                                <TableCell sx={{ py: 0.5 }}>{formatPeriodo(row.periodo)}</TableCell>
                                <TableCell sx={{ py: 0.5, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {row.propiedad}
                                </TableCell>
                                <TableCell align="right" sx={{ py: 0.5 }}>
                                  <Tooltip title="Completar importes">
                                    <IconButton
                                      size="small"
                                      onClick={() => navigate(`/pendientes-impuestos?periodo=${encodeURIComponent(row.periodo)}&search=${encodeURIComponent(row.propiedad || '')}`)}
                                    >
                                      <EditIcon fontSize="small" color="error" />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      {liquidacionesFaltanItems.total > 5 && (
                        <Box sx={{ py: 1, textAlign: 'center' }}>
                          <Button size="small" onClick={() => navigate('/liquidaciones?estado=borrador')}>
                            Ver todas ({liquidacionesFaltanItems.total})
                          </Button>
                        </Box>
                      )}
                    </AccordionDetails>
                  </Accordion>

                  {/* Acordeón NARANJA: Borradores por revisar */}
                  <Accordion 
                    expanded={expandedAccordion === 'borradores'} 
                    onChange={handleAccordionChange('borradores')}
                    disabled={liquidacionesBorradores.total === 0}
                    disableGutters
                    elevation={0}
                    sx={{
                      '&:before': { display: 'none' },
                      bgcolor: 'transparent',
                      opacity: liquidacionesBorradores.total === 0 ? 0.5 : 1
                    }}
                  >
                    <AccordionSummary 
                      expandIcon={<ExpandMoreIcon />}
                      sx={{ 
                        bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08),
                        borderLeft: '4px solid',
                        borderColor: 'warning.main',
                        minHeight: 48,
                        '& .MuiAccordionSummary-content': { my: 1 }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                        <DraftsIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                          En Borrador - Revisar
                        </Typography>
                        <Chip 
                          label={liquidacionesBorradores.total}
                          size="small"
                          color="warning"
                          sx={{ fontWeight: 700, minWidth: 32 }}
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ py: 0.5 }}><strong>Período</strong></TableCell>
                              <TableCell sx={{ py: 0.5 }}><strong>Propiedad</strong></TableCell>
                              <TableCell align="right" sx={{ py: 0.5 }}><strong>Total</strong></TableCell>
                              <TableCell align="right" sx={{ py: 0.5 }}><strong>Acción</strong></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {liquidacionesBorradores.data.slice(0, 5).map((row) => (
                              <TableRow key={row.id} hover>
                                <TableCell sx={{ py: 0.5 }}>{formatPeriodo(row.periodo)}</TableCell>
                                <TableCell sx={{ py: 0.5, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {row.propiedad}
                                </TableCell>
                                <TableCell align="right" sx={{ py: 0.5, fontWeight: 600 }}>
                                  {formatCurrency(row.total)}
                                </TableCell>
                                <TableCell align="right" sx={{ py: 0.5 }}>
                                  <Tooltip title="Revisar liquidación">
                                    <IconButton size="small" onClick={() => handleVerLiquidacion(row.id)}>
                                      <VisibilityIcon fontSize="small" color="warning" />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      {liquidacionesBorradores.total > 5 && (
                        <Box sx={{ py: 1, textAlign: 'center' }}>
                          <Button size="small" onClick={() => navigate('/liquidaciones?estado=borrador')}>
                            Ver todas ({liquidacionesBorradores.total})
                          </Button>
                        </Box>
                      )}
                    </AccordionDetails>
                  </Accordion>

                  {/* Acordeón VERDE: Listas para emitir */}
                  <Accordion 
                    expanded={expandedAccordion === 'listas'} 
                    onChange={handleAccordionChange('listas')}
                    disabled={liquidacionesListas.total === 0}
                    disableGutters
                    elevation={0}
                    sx={{
                      '&:before': { display: 'none' },
                      bgcolor: 'transparent',
                      opacity: liquidacionesListas.total === 0 ? 0.5 : 1
                    }}
                  >
                    <AccordionSummary 
                      expandIcon={<ExpandMoreIcon />}
                      sx={{ 
                        bgcolor: (theme) => alpha(theme.palette.success.main, 0.08),
                        borderLeft: '4px solid',
                        borderColor: 'success.main',
                        minHeight: 48,
                        '& .MuiAccordionSummary-content': { my: 1 }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                        <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: 20 }} />
                        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                          Listas para Emitir
                        </Typography>
                        <Chip 
                          label={liquidacionesListas.total}
                          size="small"
                          color="success"
                          sx={{ fontWeight: 700, minWidth: 32 }}
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ py: 0.5 }}><strong>Período</strong></TableCell>
                              <TableCell sx={{ py: 0.5 }}><strong>Propiedad</strong></TableCell>
                              <TableCell align="right" sx={{ py: 0.5 }}><strong>Total</strong></TableCell>
                              <TableCell align="right" sx={{ py: 0.5 }}><strong>Acción</strong></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {liquidacionesListas.data.slice(0, 5).map((row) => (
                              <TableRow key={row.id} hover>
                                <TableCell sx={{ py: 0.5 }}>{formatPeriodo(row.periodo)}</TableCell>
                                <TableCell sx={{ py: 0.5, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {row.propiedad}
                                </TableCell>
                                <TableCell align="right" sx={{ py: 0.5, fontWeight: 600 }}>
                                  {formatCurrency(row.total)}
                                </TableCell>
                                <TableCell align="right" sx={{ py: 0.5 }}>
                                  <Tooltip title="Ver detalle">
                                    <IconButton size="small" onClick={() => handleVerLiquidacion(row.id)}>
                                      <SendIcon fontSize="small" color="success" />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      {liquidacionesListas.total > 5 && (
                        <Box sx={{ py: 1, textAlign: 'center' }}>
                          <Button size="small" onClick={() => navigate('/liquidaciones?estado=lista')}>
                            Ver todas ({liquidacionesListas.total})
                          </Button>
                        </Box>
                      )}
                    </AccordionDetails>
                  </Accordion>
                </Box>
              ) : (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="success.main">
                    ✓ No hay liquidaciones pendientes de acción
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Modal: Ajustes Pendientes */}
      <Dialog open={openAjustes} onClose={() => setOpenAjustes(false)} maxWidth="md" fullWidth>
        <DialogTitle>Ajustes de Alquiler Pendientes</DialogTitle>
        <DialogContent>
          {loadingAjustes ? (
            <LinearProgress />
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Propiedad</strong></TableCell>
                    <TableCell><strong>Inquilino</strong></TableCell>
                    <TableCell align="right"><strong>Monto Actual</strong></TableCell>
                    <TableCell><strong>Próximo Ajuste</strong></TableCell>
                    <TableCell><strong>Estado</strong></TableCell>
                    <TableCell align="right"><strong>Acción</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(!ajustesPendientes?.data || ajustesPendientes.data.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">No hay ajustes pendientes</TableCell>
                    </TableRow>
                  ) : (
                    ajustesPendientes.data.map((row) => (
                      <TableRow key={row.contratoId}>
                        <TableCell>{row.propiedad || '-'}</TableCell>
                        <TableCell>{row.inquilino || '-'}</TableCell>
                        <TableCell align="right">
                          {row.montoActual != null ? formatCurrency(row.montoActual) : '-'}
                        </TableCell>
                        <TableCell>{formatFecha(row.proximaFechaAjuste)}</TableCell>
                        <TableCell>
                          <Chip
                            label={row.estado === 'vencido' ? 'Vencido' : 'Próximo'}
                            size="small"
                            color={row.estado === 'vencido' ? 'error' : 'warning'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" variant="outlined" onClick={() => handleActualizarAjuste(row.contratoId)}>
                            Actualizar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAjustes(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Contratos por Vencer */}
      <Dialog open={openVencimientos} onClose={() => setOpenVencimientos(false)} maxWidth="md" fullWidth>
        <DialogTitle>Contratos por Vencer (próximos 60 días)</DialogTitle>
        <DialogContent>
          {loadingVencimientos ? (
            <LinearProgress />
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Propiedad</strong></TableCell>
                    <TableCell><strong>Inquilino</strong></TableCell>
                    <TableCell><strong>Fecha Fin</strong></TableCell>
                    <TableCell align="center"><strong>Días Restantes</strong></TableCell>
                    <TableCell align="right"><strong>Acción</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(!contratosPorVencer?.data || contratosPorVencer.data.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">No hay contratos por vencer</TableCell>
                    </TableRow>
                  ) : (
                    contratosPorVencer.data.map((row) => (
                      <TableRow key={row.contratoId}>
                        <TableCell>{row.propiedad}</TableCell>
                        <TableCell>{row.inquilino}</TableCell>
                        <TableCell>{formatFecha(row.fechaFin)}</TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={`${row.diasRestantes} días`}
                            size="small"
                            color={row.diasRestantes <= 15 ? 'error' : row.diasRestantes <= 30 ? 'warning' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" variant="outlined" onClick={() => handleVerContrato(row.contratoId)}>
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenVencimientos(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Cobros Pendientes */}
      <Dialog open={openCobranza} onClose={() => setOpenCobranza(false)} maxWidth="md" fullWidth>
        <DialogTitle>Inquilinos en Mora</DialogTitle>
        <DialogContent>
          {loadingCobranza ? (
            <LinearProgress />
          ) : (
            <>
              {totalDeuda > 0 && (
                <Box sx={{ mb: 2, p: 2, bgcolor: 'error.50', borderRadius: 1, border: '1px solid', borderColor: 'error.200' }}>
                  <Typography variant="h6" color="error.main" fontWeight={600}>
                    Total Deuda: {formatCurrency(totalDeuda)}
                  </Typography>
                </Box>
              )}
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Propiedad</strong></TableCell>
                      <TableCell><strong>Inquilino</strong></TableCell>
                      <TableCell align="right"><strong>Saldo Deudor</strong></TableCell>
                      <TableCell align="right"><strong>Acción</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(!cobranzaCritica?.data || cobranzaCritica.data.length === 0) ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">No hay inquilinos en mora</TableCell>
                      </TableRow>
                    ) : (
                      cobranzaCritica.data.map((row) => (
                        <TableRow key={row.contratoId}>
                          <TableCell>{row.propiedad}</TableCell>
                          <TableCell>{row.inquilino}</TableCell>
                          <TableCell align="right" sx={{ color: 'error.main', fontWeight: 600 }}>
                            {formatCurrency(row.saldo)}
                          </TableCell>
                          <TableCell align="right">
                            <Button size="small" variant="outlined" color="error" onClick={() => handleVerCobranza(row)}>
                              Cobrar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCobranza(false)}>Cerrar</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setOpenCobranza(false);
              navigate('/pagos-cobranzas?tab=inquilinos');
            }}
          >
            Ver en Cuentas Corrientes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Propiedades Vacantes */}
      <Dialog open={openVacantes} onClose={() => setOpenVacantes(false)} maxWidth="md" fullWidth>
        <DialogTitle>Propiedades Disponibles</DialogTitle>
        <DialogContent>
          {loadingVacantes ? (
            <LinearProgress />
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Dirección</strong></TableCell>
                    <TableCell><strong>Propietario</strong></TableCell>
                    <TableCell><strong>Estado</strong></TableCell>
                    <TableCell align="right"><strong>Acción</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(!propiedadesVacantes?.data || propiedadesVacantes.data.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">No hay propiedades disponibles</TableCell>
                    </TableRow>
                  ) : (
                    propiedadesVacantes.data.map((prop) => (
                      <TableRow key={prop.id}>
                        <TableCell>{prop.direccion}</TableCell>
                        <TableCell>{prop.propietario}</TableCell>
                        <TableCell>{prop.estado === 'Vacante' ? 'Disponible' : (prop.estado || 'Sin estado')}</TableCell>
                        <TableCell align="right">
                          <Button 
                            size="small" 
                            variant="outlined" 
                            color="primary" 
                            onClick={() => {
                              setOpenVacantes(false);
                              navigate(`/propiedades?verPerfil=${prop.id}&from=dashboard&modal=vacantes`);
                            }}
                          >
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenVacantes(false)}>Cerrar</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setOpenVacantes(false);
              navigate('/propiedades?estado=disponible');
            }}
          >
            Ver todas en Propiedades
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Registrar Cobro */}
      <RegistrarCobroModal
        open={cobroModal.open}
        onClose={() => setCobroModal({ open: false, contrato: null })}
        contrato={cobroModal.contrato}
        tipoOperacion="cobro"
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'cobranza-critica'] });
          setSnackbar({ open: true, message: 'Cobro registrado correctamente', severity: 'success' });
        }}
      />

      {/* Modal: Pagos a Propietarios Pendientes */}
      <Dialog open={openPagosPropietarios} onClose={() => setOpenPagosPropietarios(false)} maxWidth="md" fullWidth>
        <DialogTitle>Pagos a Propietarios Pendientes</DialogTitle>
        <DialogContent>
          {loadingPagosProp ? (
            <LinearProgress />
          ) : (
            <>
              {totalSaldoPropietarios > 0 && (
                <Box sx={{ mb: 2, p: 2, bgcolor: 'warning.50', borderRadius: 1, border: '1px solid', borderColor: 'warning.200' }}>
                  <Typography variant="h6" color="warning.main" fontWeight={600}>
                    Total a Pagar: {formatCurrency(totalSaldoPropietarios)}
                  </Typography>
                </Box>
              )}
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Propietario</strong></TableCell>
                      <TableCell><strong>Propiedades</strong></TableCell>
                      <TableCell align="right"><strong>Saldo a Pagar</strong></TableCell>
                      <TableCell align="right"><strong>Acción</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(!pagosPropietarios?.data || pagosPropietarios.data.length === 0) ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">No hay pagos pendientes a propietarios</TableCell>
                      </TableRow>
                    ) : (
                      pagosPropietarios.data.map((row, idx) => (
                        <TableRow key={`${row.tipo}-${row.propietarioId || row.propiedadId}-${idx}`}>
                          <TableCell>{row.propietario}</TableCell>
                          <TableCell>
                            {row.propiedades && row.propiedades.length > 1 ? (
                              <Box>
                                <Typography variant="body2">{row.propiedades.length} propiedades</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {row.propiedades.map(p => p.direccion).join(', ')}
                                </Typography>
                              </Box>
                            ) : (
                              row.propiedad
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 600 }}>
                            {formatCurrency(row.saldo)}
                          </TableCell>
                          <TableCell align="right">
                            <Button size="small" variant="outlined" color="warning" onClick={() => handlePagarPropietario(row)}>
                              Registrar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPagosPropietarios(false)}>Cerrar</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setOpenPagosPropietarios(false);
              navigate('/pagos-cobranzas?tab=propietarios');
            }}
          >
            Ver en Cuentas Corrientes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Registrar Pago a Propietario */}
      <RegistrarPagoModal
        open={pagoModal.open}
        onClose={() => setPagoModal({ open: false, contrato: null })}
        contrato={pagoModal.contrato}
        tipoOperacion="pago"
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'pagos-propietarios-pendientes'] });
          setSnackbar({ open: true, message: 'Pago registrado correctamente', severity: 'success' });
        }}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
