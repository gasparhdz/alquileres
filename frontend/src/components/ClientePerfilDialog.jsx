import { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '../contexts/AuthContext';
import RequirePermission from './RequirePermission';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Button,
  Grid,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  Alert,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  Link
} from '@mui/material';
import {
  Close as CloseIcon,
  WhatsApp as WhatsAppIcon,
  Edit as EditIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
  LocationOn as LocationIcon,
  Home as HomeIcon,
  Description as DescriptionIcon,
  AccountBalance as AccountBalanceIcon,
  Security as SecurityIcon,
  OpenInNew as OpenInNewIcon,
  PictureAsPdf as PictureAsPdfIcon,
  WarningAmber as WarningAmberIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import api from '../api';
import { generarBoletaPDF, generarLiquidacionPropietarioPDF } from '../utils/generarBoleta';
import { getReturnStateFromClientePerfil, buildReturnUrlWithModal, hasReturnPath, getReturnUrl } from '../utils/returnPath';
import { formatWhatsAppNumber } from '../utils/telefono';
import { buildDireccionLegalResumen } from '../utils/clienteDomicilioDisplay';
import MovimientosClienteDialog from './MovimientosClienteDialog';

const formatCurrency = (value) => {
  if (value == null) return '$ 0,00';
  return `$ ${parseFloat(value).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

/**
 * Calcula estilos de "semáforo" para la columna Vigencia según días hasta fechaFin.
 * - Más de 60 días: estilo por defecto.
 * - Menos de 60 días: warning (naranja) + "(Vence pronto)".
 * - Menos de 30 días o ya vencido: error (rojo).
 */
function getVencimientoStyles(fechaFin) {
  if (!fechaFin) return { color: 'text.primary', variant: 'body2', vencePronto: false, vencido: false };
  const fin = dayjs(fechaFin).startOf('day');
  const hoy = dayjs().startOf('day');
  const diasRestantes = fin.diff(hoy, 'day');
  if (diasRestantes < 0)
    return { color: '#d32f2f', variant: 'body2', vencePronto: true, vencido: true };
  if (diasRestantes < 30)
    return { color: '#d32f2f', variant: 'body2', vencePronto: true, vencido: false };
  if (diasRestantes < 60)
    return { color: '#ed6c02', variant: 'body2', vencePronto: true, vencido: false };
  return { color: 'text.primary', variant: 'body2', vencePronto: false, vencido: false };
}

export default function ClientePerfilDialog({
  open,
  onClose,
  clienteId,
  tipo, // 'inquilino' | 'propietario'
  onEdit
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [tabValue, setTabValue] = useState(0);
  const [openMovimientos, setOpenMovimientos] = useState(false);
  const { hasPermission } = usePermissions();
  const permisoEditar = tipo === 'inquilino' ? 'inquilinos.editar' : 'propietarios.editar';
  const permisoVerMovimientos = tipo === 'inquilino' ? 'movimiento.inquilinos.ver' : 'movimiento.propietarios.ver';

  // Al abrir el diálogo interno (movimientos), quitar foco del padre para evitar aria-hidden con descendiente enfocado
  useEffect(() => {
    if (openMovimientos && typeof document !== 'undefined' && document.activeElement?.blur) {
      document.activeElement.blur();
    }
  }, [openMovimientos]);

  // Fetch cliente data
  const { data: cliente, isLoading, error } = useQuery({
    queryKey: [tipo === 'inquilino' ? 'inquilino-detalle' : 'propietario-detalle', clienteId],
    queryFn: async () => {
      const endpoint = tipo === 'inquilino' ? `/inquilinos/${clienteId}` : `/propietarios/${clienteId}`;
      const response = await api.get(endpoint);
      return response.data;
    },
    enabled: open && !!clienteId
  });

  // Fetch saldo cuenta corriente
  const { data: saldoData } = useQuery({
    queryKey: ['saldo-cliente', tipo, clienteId],
    queryFn: async () => {
      if (tipo === 'inquilino' && cliente?.contratos?.length > 0) {
        // Para inquilinos, obtener saldo del primer contrato activo
        const contratoVigente = cliente.contratos.find(c => c.estado?.codigo === 'VIGENTE') || cliente.contratos[0];
        if (contratoVigente) {
          const response = await api.get(`/contratos/${contratoVigente.id}/cuenta-inquilino/saldo`);
          return { saldo: response.data?.saldo || 0, contratoId: contratoVigente.id };
        }
      } else if (tipo === 'propietario') {
        // Para propietarios: recalcular saldo con la misma lógica que getContratosConSaldoPropietario,
        // usando los movimientos globales del propietario (todas sus propiedades)
        const response = await api.get(`/clientes/${clienteId}/cuenta-propietario/movimientos`);
        const movimientos = response.data || [];

        if (movimientos.length > 0) {
          let saldo = 0;
          movimientos.forEach((mov) => {
            const importe = parseFloat(mov.importe);
            const codigo = mov.tipoMovimiento?.codigo;
            // CRÉDITO = la inmobiliaria le debe al propietario (saldo positivo)
            // DÉBITO = pago emitido / cargo al propietario (saldo negativo)
            if (codigo === 'CREDITO') {
              saldo += importe;
            } else if (codigo === 'DEBITO') {
              saldo -= importe;
            }
          });
          return { saldo };
        }
      }
      return { saldo: 0 };
    },
    enabled: open && !!clienteId && !!cliente
  });

  // Actores responsables para poder calcular totales de liquidaciones
  const { data: actoresGlobal = [] } = useQuery({
    queryKey: ['actores-responsable-contrato-global'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/actores-responsable-contrato');
      return response.data ?? [];
    },
    enabled: open
  });

  // Últimas 5 liquidaciones del cliente (un solo request al backend)
  const { data: ultimasLiquidaciones = [], isLoading: loadingLiquidaciones } = useQuery({
    queryKey: ['ultimas-liquidaciones', tipo, clienteId],
    queryFn: async () => {
      const response = await api.get(`/liquidaciones/cliente/${clienteId}?rol=${tipo}`);
      return response.data ?? [];
    },
    enabled: open && !!clienteId
  });

  useEffect(() => {
    if (open) {
      setTabValue(0);
    }
  }, [open, clienteId]);

  if (!open) return null;

  const nombre = cliente?.razonSocial ||
    `${cliente?.apellido || ''}, ${cliente?.nombre || ''}`.trim() ||
    'Sin nombre';

  const iniciales = nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const direccionCompleta = buildDireccionLegalResumen(cliente);

  const handleWhatsApp = () => {
    const numero = formatWhatsAppNumber(cliente?.telefono);
    if (numero) {
      window.open(`https://api.whatsapp.com/send?phone=${numero}`, '_blank');
    }
  };

  const handleVerCuentaCorriente = (e) => {
    e?.currentTarget?.blur?.(); // Evitar que el botón retenga foco cuando el diálogo interno recibe aria-hidden
    setOpenMovimientos(true);
  };

  const handleIrAContrato = (e, contratoId) => {
    e?.preventDefault?.();
    const returnState = getReturnStateFromClientePerfil({ tipo, clienteId });
    const fromUrl = buildReturnUrlWithModal(returnState);
    navigate(`/contratos?id=${contratoId}`, { state: { from: fromUrl } });
    onClose();
  };

  const handleIrAPropiedad = (e, propiedadId) => {
    e?.preventDefault?.();
    const state = getReturnStateFromClientePerfil({ tipo, clienteId });
    navigate(`/propiedades?verPerfil=${propiedadId}`, { state });
    onClose();
  };

  // Al cerrar: si venimos de otra pantalla (ej. detalle de propiedad), volver allí; si no, solo cerrar
  const handleClose = () => {
    if (hasReturnPath(location.state) && getReturnUrl(location.state)) {
      navigate(getReturnUrl(location.state));
    }
    onClose();
  };

  // Obtener todas las garantías de todos los contratos (solo para inquilinos)
  const garantias = tipo === 'inquilino'
    ? cliente?.contratos?.flatMap(c =>
      (c.garantias || []).map(g => ({ ...g, contrato: c }))
    ) || []
    : [];

  // Cálculo de totales (mismo criterio que en Liquidaciones.jsx)
  const calcularTotales = (liquidacion) => {
    let totalInquilino = 0;
    let alquilerBruto = 0;
    let deduccionesPropietario = 0;

    if (!liquidacion.items || liquidacion.items.length === 0) {
      return { totalInquilino: liquidacion.total || 0, totalPropietario: 0 };
    }

    liquidacion.items.forEach((item) => {
      const importe = parseFloat(item.importe || 0);
      const quienSoportaCostoId = item.quienSoportaCostoId ?? item.quienSoportaCosto?.id;
      const pagadoPorActorId = item.pagadoPorActorId ?? item.pagadoPorActor?.id;
      const tipoCargoCodigo = item.tipoCargo?.codigo || item.tipoCargoCodigo;

      const actorResponsable = actoresGlobal.find((a) => a.id === quienSoportaCostoId);
      const actorPagador = actoresGlobal.find((a) => a.id === pagadoPorActorId);

      const codigoResponsable = actorResponsable?.codigo || item.quienSoportaCosto?.codigo;
      const codigoPagadoPor = actorPagador?.codigo || item.pagadoPorActor?.codigo;

      const esInquilinoResponsable = codigoResponsable === 'INQ';
      const esPropietarioResponsable = codigoResponsable === 'PROP';
      const inquilinoPagoPorPropietario = codigoPagadoPor === 'INQ' && esPropietarioResponsable;
      const esAlquiler = tipoCargoCodigo === 'ALQUILER';
      const esHonorarios = tipoCargoCodigo === 'HONORARIOS';

      if (esInquilinoResponsable) {
        totalInquilino += importe;
      } else if (inquilinoPagoPorPropietario) {
        totalInquilino -= importe;
      }

      if (esAlquiler) {
        alquilerBruto += importe;
      } else if (esPropietarioResponsable && !esHonorarios) {
        deduccionesPropietario += importe;
      }
    });

    const porcentajeHonorarios = liquidacion.contrato?.honorariosPropietario
      ? parseFloat(liquidacion.contrato.honorariosPropietario)
      : 0;
    const honorariosInmob = alquilerBruto * (porcentajeHonorarios / 100);

    const totalPropietario = alquilerBruto - honorariosInmob - deduccionesPropietario;

    return { totalInquilino, totalPropietario };
  };

  const formatPeriodo = (periodo) => {
    if (!periodo) return '-';
    // periodo viene como 'YYYY-MM'
    const anio = periodo.substring(0, 4);
    const mes = periodo.substring(5);
    return `${mes}-${anio}`;
  };

  const handleDownloadPDF = async (id) => {
    try {
      const response = await api.get(`/liquidaciones/${id}`);
      const liquidacion = response.data;

      if (tipo === 'inquilino') {
        // Solo boleta del inquilino
        if (liquidacion.contrato?.inquilino) {
          await generarBoletaPDF(liquidacion);
        }
      } else {
        // Solo liquidación del propietario
        let liquidacionPropietarioData = null;
        if (liquidacion.contratoId) {
          try {
            const lpResponse = await api.get(
              `/contratos/${liquidacion.contratoId}/liquidaciones-propietario`
            );
            const liquidacionesProp = lpResponse.data || [];
            liquidacionPropietarioData = liquidacionesProp.find(
              (lp) => lp.periodo === liquidacion.periodo
            );
          } catch (e) {
            console.warn('No se pudo obtener liquidación propietario:', e);
          }
        }

        await generarLiquidacionPropietarioPDF(liquidacion, liquidacionPropietarioData);
      }
    } catch (error) {
      console.error('Error al generar PDF de liquidación:', error);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogContent sx={{ p: 0, minHeight: '400px', maxHeight: '65vh', overflowY: 'auto' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 300, gap: 2 }}>
            <CircularProgress />
            <Button variant="outlined" onClick={handleClose} autoFocus>Cerrar</Button>
          </Box>
        ) : error ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="error" sx={{ mb: 2 }}>Error al cargar los datos del cliente</Alert>
            <Button variant="outlined" onClick={handleClose} autoFocus>Cerrar</Button>
          </Box>
        ) : cliente ? (
          <>
            {/* ===== HEADER / TARJETA DE PRESENTACIÓN ===== */}
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
                  onClick={handleClose}
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
                  alignItems: { xs: 'stretch', sm: 'flex-start' },
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
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}
                  >
                    {iniciales}
                  </Avatar>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h5" fontWeight="bold">
                      {nombre}
                    </Typography>
                    <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                      <Chip
                        label={tipo === 'inquilino' ? 'Inquilino' : 'Propietario'}
                        size="small"
                        sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                      />
                      <Chip
                        label="Activo"
                        size="small"
                        sx={{ bgcolor: 'rgba(255,255,255,0.3)', color: 'white' }}
                      />
                      {cliente?.condicionIva?.nombre && (
                        <Chip
                          label={cliente.condicionIva.nombre}
                          size="small"
                          sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                        />
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, flexShrink: 0 }}>
                    {cliente?.telefono && (
                      <Tooltip title="Enviar WhatsApp">
                        <IconButton
                          size="small"
                          onClick={handleWhatsApp}
                          sx={{
                            bgcolor: 'white !important',
                            color: '#25D366 !important',
                            '&:hover': { bgcolor: '#f5f5f5 !important' },
                            width: 40,
                            height: 40,
                            borderRadius: 1
                          }}
                        >
                          <WhatsAppIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {onEdit && hasPermission(permisoEditar) && (
                      <Tooltip title="Editar datos">
                        <IconButton
                          size="small"
                          onClick={() => { onClose(); onEdit(cliente); }}
                          sx={{
                            bgcolor: 'white !important',
                            color: 'primary.main',
                            '&:hover': { bgcolor: '#f5f5f5 !important' },
                            width: 40,
                            height: 40,
                            borderRadius: 1
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>

                <Box sx={{ display: { xs: 'flex', sm: 'none' }, gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={tipo === 'inquilino' ? 'Inquilino' : 'Propietario'}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                  <Chip
                    label="Activo"
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.3)', color: 'white' }}
                  />
                  {cliente?.condicionIva?.nombre && (
                    <Chip
                      label={cliente.condicionIva.nombre}
                      size="small"
                      sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                    />
                  )}
                </Box>

                <Box sx={{ display: { xs: 'flex', sm: 'none' }, gap: 1 }}>
                  {cliente?.telefono && (
                    <Tooltip title="Enviar WhatsApp">
                      <IconButton
                        size="small"
                        onClick={handleWhatsApp}
                        sx={{
                          bgcolor: 'white !important',
                          color: '#25D366 !important',
                          '&:hover': { bgcolor: '#f5f5f5 !important' },
                          width: 40,
                          height: 40,
                          borderRadius: 1
                        }}
                      >
                        <WhatsAppIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {onEdit && hasPermission(permisoEditar) && (
                    <Tooltip title="Editar datos">
                      <IconButton
                        size="small"
                        onClick={() => { onClose(); onEdit(cliente); }}
                        sx={{
                          bgcolor: 'white !important',
                          color: 'primary.main',
                          '&:hover': { bgcolor: '#f5f5f5 !important' },
                          width: 40,
                          height: 40,
                          borderRadius: 1
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </Box>

            {/* ===== SECCIÓN DE DATOS DE CONTACTO ===== */}
            <Box sx={{ px: 3, py: 2, bgcolor: 'grey.50' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PhoneIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Teléfono</Typography>
                      <Typography variant="body2" fontWeight="500">
                        {cliente?.telefono ? (
                          <a
                            href={`tel:${cliente.telefono}`}
                            style={{ color: 'inherit', textDecoration: 'none' }}
                          >
                            {cliente.telefono}
                          </a>
                        ) : '-'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EmailIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Email</Typography>
                      <Typography variant="body2" fontWeight="500" sx={{ wordBreak: 'break-all' }}>
                        {cliente?.mail ? (
                          <a
                            href={`mailto:${cliente.mail}`}
                            style={{ color: 'inherit', textDecoration: 'none' }}
                          >
                            {cliente.mail}
                          </a>
                        ) : '-'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BadgeIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">DNI / CUIT</Typography>
                      <Typography variant="body2" fontWeight="500">
                        {cliente?.cuit || cliente?.dni || '-'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Dirección Legal</Typography>
                      <Typography variant="body2" fontWeight="500" sx={{ maxWidth: 200 }}>
                        {direccionCompleta}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* ===== TABS ===== */}
            <Box sx={{ px: { xs: 1, sm: 3 } }}>
              {(() => {
                // Construir pestañas visibles según permisos
                const allTabs = [
                  {
                    key: 'contratos-propiedades',
                    icon: <HomeIcon sx={{ fontSize: 18 }} />,
                    label: tipo === 'inquilino' ? 'Contratos' : 'Propiedades',
                    permiso: tipo === 'inquilino' ? 'contratos.ver' : 'propiedades.ver',
                    visible: true
                  },
                  {
                    key: 'cuenta-corriente',
                    icon: <AccountBalanceIcon sx={{ fontSize: 18 }} />,
                    label: 'Cuenta Corriente',
                    permiso: tipo === 'inquilino' ? 'movimiento.inquilinos.ver' : 'movimiento.propietarios.ver',
                    visible: true
                  },
                  {
                    key: 'liquidaciones',
                    icon: <DescriptionIcon sx={{ fontSize: 18 }} />,
                    label: 'Últimas Liquidaciones',
                    permiso: 'liquidaciones.ver',
                    visible: true
                  },
                  {
                    key: 'garantias',
                    icon: <SecurityIcon sx={{ fontSize: 18 }} />,
                    label: 'Garantías',
                    permiso: 'contrato.garantias.ver',
                    visible: tipo === 'inquilino'
                  }
                ];

                const visibleTabs = allTabs.filter(tab =>
                  tab.visible && (tab.permiso === null || hasPermission(tab.permiso))
                );

                // Asegurar que tabValue no exceda las pestañas visibles
                const safeTabValue = tabValue < visibleTabs.length ? tabValue : 0;
                const currentTabKey = visibleTabs[safeTabValue]?.key;

                return (
                  <>
                    <Tabs
                      value={safeTabValue}
                      onChange={(_, v) => setTabValue(v)}
                      variant="scrollable"
                      scrollButtons="auto"
                      allowScrollButtonsMobile
                      sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 48 }}
                    >
                      {visibleTabs.map((tab) => (
                        <Tab
                          key={tab.key}
                          icon={tab.icon}
                          iconPosition="start"
                          label={tab.label}
                          sx={{ minHeight: 48 }}
                        />
                      ))}
                    </Tabs>

                    {/* TAB: Contratos (Inquilino) / Propiedades (Propietario) */}
                    {currentTabKey === 'contratos-propiedades' && (
                      <Box sx={{ pt: 2 }}>
                        {tipo === 'inquilino' ? (
                          // INQUILINO: Mostrar contratos
                          cliente?.contratos && cliente.contratos.length > 0 ? (
                            <>
                              {/* Vista tabla: solo desktop */}
                              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                                <TableContainer component={Paper} variant="outlined">
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Propiedad</TableCell>
                                        <TableCell>Nro Contrato</TableCell>
                                        <TableCell>Estado</TableCell>
                                        <TableCell>Vigencia</TableCell>
                                        <TableCell align="right">Importe actual</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {cliente.contratos.map((contrato) => {
                                        const prop = contrato.propiedad;
                                        const direccion = prop ?
                                          `${prop.dirCalle || ''} ${prop.dirNro || ''}${prop.dirPiso ? ` ${prop.dirPiso}°` : ''}${prop.dirDepto ? ` "${prop.dirDepto}"` : ''}`.trim()
                                          : '-';
                                        return (
                                          <TableRow key={contrato.id}>
                                            <TableCell>
                                              <Typography variant="body2">{direccion}</Typography>
                                              {prop?.localidad?.nombre && (
                                                <Typography variant="caption" color="text.secondary">
                                                  {prop.localidad.nombre}
                                                </Typography>
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              {hasPermission('contratos.ver') ? (
                                                <Link
                                                  component="button"
                                                  type="button"
                                                  onClick={(e) => handleIrAContrato(e, contrato.id)}
                                                  sx={{ color: 'primary.main', cursor: 'pointer', fontWeight: 500 }}
                                                >
                                                  #{contrato.numeroContrato || contrato.id}
                                                </Link>
                                              ) : (
                                                <Typography variant="body2" fontWeight={500}>#{contrato.numeroContrato || contrato.id}</Typography>
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              <Chip
                                                label={contrato.estado?.nombre || 'Sin estado'}
                                                size="small"
                                                color={contrato.estado?.codigo === 'VIGENTE' ? 'success' : 'default'}
                                              />
                                            </TableCell>
                                            <TableCell>
                                              {contrato.fechaInicio && contrato.fechaFin ? (() => {
                                                const venc = getVencimientoStyles(contrato.fechaFin);
                                                return (
                                                  <Typography variant={venc.variant} sx={{ color: venc.color }}>
                                                    {venc.vencePronto && <WarningAmberIcon sx={{ fontSize: 14, mr: 0.25, verticalAlign: 'text-bottom' }} />}
                                                    {dayjs(contrato.fechaInicio).format('DD/MM/YY')} - {dayjs(contrato.fechaFin).format('DD/MM/YY')}
                                                    {venc.vencePronto && (
                                                      <Typography component="span" variant="caption" sx={{ color: venc.color, ml: 0.5, display: 'inline-block' }}>
                                                        {venc.vencido ? '(Vencido)' : '(Vence pronto)'}
                                                      </Typography>
                                                    )}
                                                  </Typography>
                                                );
                                              })() : '-'}
                                            </TableCell>
                                            <TableCell align="right">
                                              <Typography variant="body2" fontWeight="600">
                                                {formatCurrency(contrato.montoActual || contrato.montoInicial)}
                                              </Typography>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              </Box>
                              {/* Vista cards: solo mobile */}
                              <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                                <Grid container spacing={2}>
                                  {cliente.contratos.map((contrato) => {
                                    const prop = contrato.propiedad;
                                    const direccion = prop ?
                                      `${prop.dirCalle || ''} ${prop.dirNro || ''}${prop.dirPiso ? ` ${prop.dirPiso}°` : ''}${prop.dirDepto ? ` "${prop.dirDepto}"` : ''}`.trim()
                                      : '-';
                                    const venc = contrato.fechaInicio && contrato.fechaFin ? getVencimientoStyles(contrato.fechaFin) : null;
                                    return (
                                      <Grid item xs={12} key={contrato.id}>
                                        <Card variant="outlined">
                                          <CardContent>
                                            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                                              {direccion || '-'}
                                            </Typography>
                                            {prop?.localidad?.nombre && (
                                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                                                {prop.localidad.nombre}
                                              </Typography>
                                            )}
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mt: 1 }}>
                                              {hasPermission('contratos.ver') ? (
                                                <Link
                                                  component="button"
                                                  type="button"
                                                  onClick={(e) => handleIrAContrato(e, contrato.id)}
                                                  sx={{ color: 'primary.main', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}
                                                >
                                                  #{contrato.numeroContrato || contrato.id}
                                                </Link>
                                              ) : (
                                                <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.875rem' }}>#{contrato.numeroContrato || contrato.id}</Typography>
                                              )}
                                              <Chip
                                                label={contrato.estado?.nombre || 'Sin estado'}
                                                size="small"
                                                color={contrato.estado?.codigo === 'VIGENTE' ? 'success' : 'default'}
                                              />
                                            </Box>
                                            {contrato.fechaInicio && contrato.fechaFin && (
                                              <Typography variant="body2" sx={{ mt: 1, color: venc?.color }}>
                                                {dayjs(contrato.fechaInicio).format('DD/MM/YY')} - {dayjs(contrato.fechaFin).format('DD/MM/YY')}
                                                {venc?.vencido && ' (Vencido)'}
                                                {venc?.vencePronto && !venc?.vencido && ' (Vence pronto)'}
                                              </Typography>
                                            )}
                                            <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>
                                              Importe actual: {formatCurrency(contrato.montoActual || contrato.montoInicial)}
                                            </Typography>
                                          </CardContent>
                                        </Card>
                                      </Grid>
                                    );
                                  })}
                                </Grid>
                              </Box>
                            </>
                          ) : (
                            <Alert severity="info">No hay contratos asociados a este inquilino</Alert>
                          )
                        ) : (
                          // PROPIETARIO: Mostrar propiedades
                          cliente?.propiedades && cliente.propiedades.length > 0 ? (
                            <>
                              {/* Vista tabla: solo desktop */}
                              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                                <TableContainer component={Paper} variant="outlined">
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Dirección</TableCell>
                                        <TableCell>Localidad</TableCell>
                                        <TableCell>Estado</TableCell>
                                        <TableCell>Contrato Vigente</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {cliente.propiedades.map((rel) => {
                                        const prop = rel.propiedad || rel;
                                        const direccion = `${prop.dirCalle || ''} ${prop.dirNro || ''}${prop.dirPiso ? ` ${prop.dirPiso}°` : ''}${prop.dirDepto ? ` "${prop.dirDepto}"` : ''}`.trim();
                                        const contratoVigente = prop.contratos?.find(c => c.estado?.codigo === 'VIGENTE');
                                        const tieneContrato = prop.contratos && prop.contratos.length > 0;
                                        return (
                                          <TableRow key={prop.id}>
                                            <TableCell>
                                              {hasPermission('propiedades.ver') ? (
                                                <Link
                                                  component="button"
                                                  type="button"
                                                  onClick={(e) => handleIrAPropiedad(e, prop.id)}
                                                  sx={{ color: 'primary.main', cursor: 'pointer' }}
                                                >
                                                  <Typography variant="body2" component="span">{direccion || '-'}</Typography>
                                                </Link>
                                              ) : (
                                                <Typography variant="body2">{direccion || '-'}</Typography>
                                              )}
                                            </TableCell>
                                            <TableCell>{prop.localidad?.nombre || '-'}</TableCell>
                                            <TableCell>
                                              <Chip
                                                label={tieneContrato ? 'Alquilada' : 'Disponible'}
                                                size="small"
                                                color={tieneContrato ? 'success' : 'warning'}
                                              />
                                            </TableCell>
                                            <TableCell>
                                              {contratoVigente ? (
                                                <Box>
                                                  <Typography variant="body2">
                                                    #{contratoVigente.numeroContrato || contratoVigente.id}
                                                  </Typography>
                                                  {contratoVigente.inquilino && (
                                                    <Typography variant="caption" color="text.secondary">
                                                      {contratoVigente.inquilino.razonSocial ||
                                                        `${contratoVigente.inquilino.nombre} ${contratoVigente.inquilino.apellido}`.trim()}
                                                    </Typography>
                                                  )}
                                                </Box>
                                              ) : '-'}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              </Box>
                              {/* Vista cards: solo mobile */}
                              <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                                <Grid container spacing={2}>
                                  {cliente.propiedades.map((rel) => {
                                    const prop = rel.propiedad || rel;
                                    const direccion = `${prop.dirCalle || ''} ${prop.dirNro || ''}${prop.dirPiso ? ` ${prop.dirPiso}°` : ''}${prop.dirDepto ? ` "${prop.dirDepto}"` : ''}`.trim();
                                    const contratoVigente = prop.contratos?.find(c => c.estado?.codigo === 'VIGENTE');
                                    const tieneContrato = prop.contratos && prop.contratos.length > 0;
                                    return (
                                      <Grid item xs={12} key={prop.id}>
                                        <Card variant="outlined">
                                          <CardContent>
                                            {hasPermission('propiedades.ver') ? (
                                              <Link
                                                component="button"
                                                type="button"
                                                onClick={(e) => handleIrAPropiedad(e, prop.id)}
                                                sx={{ color: 'primary.main', cursor: 'pointer', textAlign: 'left', p: 0, display: 'block' }}
                                              >
                                                <Typography variant="subtitle2" fontWeight={600}>
                                                  {direccion || '-'}
                                                </Typography>
                                              </Link>
                                            ) : (
                                              <Typography variant="subtitle2" fontWeight={600}>
                                                {direccion || '-'}
                                              </Typography>
                                            )}
                                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                                              {prop.localidad?.nombre || '-'}
                                            </Typography>
                                            <Box sx={{ mt: 1 }}>
                                              <Chip
                                                label={tieneContrato ? 'Alquilada' : 'Disponible'}
                                                size="small"
                                                color={tieneContrato ? 'success' : 'warning'}
                                              />
                                            </Box>
                                            {contratoVigente && (
                                              <Box sx={{ mt: 1 }}>
                                                <Typography variant="body2">
                                                  Contrato #{contratoVigente.numeroContrato || contratoVigente.id}
                                                </Typography>
                                                {contratoVigente.inquilino && (
                                                  <Typography variant="caption" color="text.secondary">
                                                    {contratoVigente.inquilino.razonSocial ||
                                                      `${contratoVigente.inquilino.nombre} ${contratoVigente.inquilino.apellido}`.trim()}
                                                  </Typography>
                                                )}
                                              </Box>
                                            )}
                                          </CardContent>
                                        </Card>
                                      </Grid>
                                    );
                                  })}
                                </Grid>
                              </Box>
                            </>
                          ) : (
                            <Alert severity="info">No hay propiedades asociadas a este propietario</Alert>
                          )
                        )}
                      </Box>
                    )}

                    {/* TAB: Cuenta Corriente */}
                    {currentTabKey === 'cuenta-corriente' && (
                      <Box sx={{ pt: 2 }}>
                        <Grid container spacing={2}>
                          {/* Card de Saldo */}
                          <Grid item xs={12} md={6}>
                            <Card
                              variant="outlined"
                              sx={{
                                bgcolor: saldoData?.saldo > 0
                                  ? (tipo === 'inquilino' ? 'error.lighter' : 'success.lighter')
                                  : saldoData?.saldo < 0
                                    ? (tipo === 'inquilino' ? 'success.lighter' : 'error.lighter')
                                    : 'grey.100'
                              }}
                            >
                              <CardContent sx={{ py: { xs: 1.5, md: 2 }, px: { xs: 2, md: 3 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                                  Saldo actual
                                </Typography>
                                <Typography
                                  variant="h4"
                                  fontWeight="bold"
                                  sx={{
                                    fontSize: { xs: '1.5rem', md: '2.125rem' },
                                    lineHeight: 1.2
                                  }}
                                  color={
                                    saldoData?.saldo > 0
                                      ? (tipo === 'inquilino' ? 'error.main' : 'success.main')
                                      : saldoData?.saldo < 0
                                        ? (tipo === 'inquilino' ? 'success.main' : 'error.main')
                                        : 'text.primary'
                                  }
                                >
                                  {formatCurrency(Math.abs(saldoData?.saldo || 0))}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    mt: 0.5,
                                    color:
                                      (saldoData?.saldo ?? 0) > 0
                                        ? (tipo === 'inquilino' ? 'error.dark' : 'success.dark')
                                        : (saldoData?.saldo ?? 0) < 0
                                          ? (tipo === 'inquilino' ? 'success.dark' : 'error.dark')
                                          : 'text.secondary'
                                  }}
                                >
                                  {tipo === 'inquilino' ? (
                                    saldoData?.saldo > 0 ? 'Deuda pendiente' : saldoData?.saldo < 0 ? 'Saldo a favor' : 'Al día'
                                  ) : (
                                    saldoData?.saldo > 0 ? 'A pagar al propietario' : saldoData?.saldo < 0 ? 'Propietario debe' : 'Al día'
                                  )}
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>

                          {/* Botón de redirección */}
                          <Grid item xs={12} md={6}>
                            <Card variant="outlined" sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <CardContent sx={{ textAlign: 'center' }}>
                                <RequirePermission codigo={permisoVerMovimientos} fallback={
                                  <Typography variant="body2" color="text.secondary">No tienes permiso para ver la cuenta corriente</Typography>
                                }>
                                  <Button
                                    variant="contained"
                                    color="success"
                                    startIcon={<OpenInNewIcon />}
                                    onClick={(e) => handleVerCuentaCorriente(e)}
                                    sx={{ mb: 1 }}
                                  >
                                    Ver cuenta corriente
                                  </Button>
                                </RequirePermission>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  Ver historial de movimientos en esta pantalla
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                        </Grid>
                      </Box>
                    )}

                    {/* TAB: Últimas Liquidaciones */}
                    {currentTabKey === 'liquidaciones' && (
                      <Box sx={{ pt: 2 }}>
                        {loadingLiquidaciones ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                            <CircularProgress size={24} />
                          </Box>
                        ) : ultimasLiquidaciones.length === 0 ? (
                          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                            No hay liquidaciones generadas recientemente para este cliente.
                          </Typography>
                        ) : (
                          <>
                            {/* Vista desktop: lista compacta */}
                            <List sx={{ py: 0, display: { xs: 'none', md: 'block' } }}>
                              {ultimasLiquidaciones.map((liq) => {
                                const prop = liq.propiedad || liq.contrato?.propiedad;
                                const direccionProp =
                                  prop &&
                                  `${prop.dirCalle || ''} ${prop.dirNro || ''}${prop.dirPiso ? ` ${prop.dirPiso}°` : ''
                                    }${prop.dirDepto ? ` "${prop.dirDepto}"` : ''}`.trim();
                                const { totalInquilino, totalPropietario } = calcularTotales(liq);
                                const monto = tipo === 'inquilino' ? totalInquilino : totalPropietario;
                                return (
                                  <ListItem
                                    key={liq.id}
                                    sx={{
                                      position: 'relative',
                                      px: 0,
                                      py: 1.5,
                                      alignItems: 'flex-start',
                                      '&:not(:last-of-type)': { borderBottom: '1px solid', borderColor: 'divider' }
                                    }}
                                    secondaryAction={
                                      hasPermission('liquidaciones.ver') ? (
                                        <IconButton size="small" onClick={() => handleDownloadPDF(liq.id)} title="Descargar PDF">
                                          <PictureAsPdfIcon fontSize="small" />
                                        </IconButton>
                                      ) : null
                                    }
                                  >
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, width: '100%', pr: 5, minWidth: 0 }}>
                                      <Typography variant="body2" fontWeight={600}>
                                        {formatPeriodo(liq.periodo)}
                                      </Typography>
                                      {direccionProp && (
                                        <Typography
                                          variant="body2"
                                          color="text.secondary"
                                          sx={{ flex: 1, minWidth: 0, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                        >
                                          {direccionProp}
                                        </Typography>
                                      )}
                                      <Chip
                                        label={liq.estado?.nombre || 'Sin estado'}
                                        size="small"
                                        color={
                                          liq.estado?.codigo === 'BORRADOR'
                                            ? 'warning'
                                            : liq.estado?.codigo === 'PAGADA' || liq.estado?.codigo === 'SALDADA'
                                              ? 'default'
                                              : 'success'
                                        }
                                      />
                                      <Typography variant="body2" fontWeight={600}>
                                        {formatCurrency(monto)}
                                      </Typography>
                                    </Box>
                                  </ListItem>
                                );
                              })}
                            </List>

                            {/* Vista mobile: cards sin etiquetas, botón PDF más grande */}
                            <Grid container spacing={2} sx={{ display: { xs: 'block', md: 'none' } }}>
                              {ultimasLiquidaciones.map((liq) => {
                                const prop = liq.propiedad || liq.contrato?.propiedad;
                                const direccionProp =
                                  prop &&
                                  `${prop.dirCalle || ''} ${prop.dirNro || ''}${prop.dirPiso ? ` ${prop.dirPiso}°` : ''
                                    }${prop.dirDepto ? ` "${prop.dirDepto}"` : ''}`.trim();
                                const { totalInquilino, totalPropietario } = calcularTotales(liq);
                                const monto = tipo === 'inquilino' ? totalInquilino : totalPropietario;
                                return (
                                  <Grid item xs={12} key={liq.id}>
                                    <Card variant="outlined">
                                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                                          <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant="body2" fontWeight={600}>
                                              {formatPeriodo(liq.periodo)}
                                            </Typography>
                                            {direccionProp && (
                                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                                {direccionProp}
                                              </Typography>
                                            )}
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                                              <Chip
                                                label={liq.estado?.nombre || 'Sin estado'}
                                                size="small"
                                                color={
                                                  liq.estado?.codigo === 'BORRADOR'
                                                    ? 'warning'
                                                    : liq.estado?.codigo === 'PAGADA' || liq.estado?.codigo === 'SALDADA'
                                                      ? 'default'
                                                      : 'success'
                                                }
                                              />
                                              <Typography variant="body2" fontWeight={600}>
                                                {formatCurrency(monto)}
                                              </Typography>
                                            </Box>
                                          </Box>
                                          <RequirePermission codigo="liquidaciones.ver">
                                            <IconButton
                                              onClick={() => handleDownloadPDF(liq.id)}
                                              title="Descargar PDF"
                                              sx={{ flexShrink: 0, bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}
                                            >
                                              <PictureAsPdfIcon sx={{ fontSize: 28 }} />
                                            </IconButton>
                                          </RequirePermission>
                                        </Box>
                                      </CardContent>
                                    </Card>
                                  </Grid>
                                );
                              })}
                            </Grid>
                          </>
                        )}
                      </Box>
                    )}

                    {/* TAB: Garantías (solo Inquilinos) */}
                    {currentTabKey === 'garantias' && (
                      <Box sx={{ pt: 2 }}>
                        {garantias.length > 0 ? (
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Nombre</TableCell>
                                  <TableCell>DNI</TableCell>
                                  <TableCell>Teléfono</TableCell>
                                  <TableCell>Tipo</TableCell>
                                  <TableCell>Estado</TableCell>
                                  <TableCell>Contrato</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {garantias.map((garantia) => (
                                  <TableRow key={garantia.id}>
                                    <TableCell>
                                      <Typography variant="body2">
                                        {garantia.apellido && garantia.nombre
                                          ? `${garantia.apellido}, ${garantia.nombre}`
                                          : garantia.nombre || garantia.apellido || '-'}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>{garantia.dni || garantia.cuit || '-'}</TableCell>
                                    <TableCell>
                                      {garantia.telefono ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <Typography variant="body2">{garantia.telefono}</Typography>
                                          <IconButton
                                            size="small"
                                            component="a"
                                            href={`https://wa.me/${formatWhatsAppNumber(garantia.telefono)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            sx={{ padding: '2px', color: '#25D366' }}
                                          >
                                            <WhatsAppIcon sx={{ fontSize: 16 }} />
                                          </IconButton>
                                        </Box>
                                      ) : '-'}
                                    </TableCell>
                                    <TableCell>
                                      <Chip
                                        label={garantia.tipoGarantia?.nombre || 'Sin tipo'}
                                        size="small"
                                        variant="outlined"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Chip
                                        label={garantia.estadoGarantia?.nombre || 'Sin estado'}
                                        size="small"
                                        color={garantia.estadoGarantia?.codigo === 'VERIFICADO' ? 'success' : 'default'}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      #{garantia.contrato?.numeroContrato || garantia.contrato?.id || '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        ) : (
                          <Alert severity="info">No hay garantías registradas para este inquilino</Alert>
                        )}
                      </Box>
                    )}
                  </>
                );
              })()}
            </Box>

            {/* Espacio inferior */}
            <Box sx={{ pb: 2 }} />
          </>
        ) : null}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cerrar</Button>
      </DialogActions>

      <MovimientosClienteDialog
        open={openMovimientos}
        onClose={() => setOpenMovimientos(false)}
        clienteId={clienteId}
        tipoRol={tipo}
        nombreCliente={
          cliente?.razonSocial ||
          [cliente?.apellido, cliente?.nombre].filter(Boolean).join(', ') ||
          cliente?.nombre ||
          ''
        }
        contratoIds={cliente?.contratos?.map((c) => c.id) ?? []}
      />
      {hasReturnPath(location.state) && getReturnUrl(location.state) && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button variant="outlined" onClick={handleClose}>
            Volver
          </Button>
        </Box>
      )}
    </Dialog>
  );
}
