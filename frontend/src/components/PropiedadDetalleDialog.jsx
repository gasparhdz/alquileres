import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { usePermissions } from '../contexts/AuthContext';
import RequirePermission from './RequirePermission';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Chip,
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
  Link,
  IconButton,
  CircularProgress,
  Alert,
  Tooltip,
  Avatar
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import EditIcon from '@mui/icons-material/Edit';
import MapIcon from '@mui/icons-material/Map';
import BuildIcon from '@mui/icons-material/Build';
import PersonIcon from '@mui/icons-material/Person';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import ApartmentIcon from '@mui/icons-material/Apartment';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArticleIcon from '@mui/icons-material/Article';
import dayjs from 'dayjs';
import api from '../api';
import { getReturnStateFromPropiedad } from '../utils/returnPath';
import { formatTitularPropiedadImpuesto } from '../utils/formatClienteNombre';

const formatCurrency = (value) => {
  if (value == null) return '—';
  return `$ ${parseFloat(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function getVencimientoStyles(fechaFin) {
  if (!fechaFin) return { color: 'text.primary', vencePronto: false, vencido: false };
  const fin = dayjs(fechaFin).startOf('day');
  const hoy = dayjs().startOf('day');
  const diasRestantes = fin.diff(hoy, 'day');
  if (diasRestantes < 0) return { color: '#d32f2f', vencePronto: true, vencido: true };
  if (diasRestantes < 30) return { color: '#d32f2f', vencePronto: true, vencido: false };
  if (diasRestantes < 60) return { color: '#ed6c02', vencePronto: true, vencido: false };
  return { color: 'text.primary', vencePronto: false, vencido: false };
}

function getEstadoChipProps(estadoNombre) {
  if (!estadoNombre) return { color: 'default', label: '—' };
  const label = estadoNombre === 'Vacante' ? 'Disponible' : estadoNombre;
  const n = (estadoNombre || '').toLowerCase();
  if (n.includes('no disponible')) return { color: 'default', label };
  if (n.includes('disponible') || n.includes('vacante') || n.includes('libre')) return { color: 'success', label };
  if (n.includes('alquilada') || n.includes('ocupada')) return { color: 'info', label };
  if (n.includes('reservada')) return { color: 'warning', label };
  if (n.includes('mantenimiento')) return { color: 'error', label };
  return { color: 'default', label };
}



export default function PropiedadDetalleDialog({ open, onClose, propiedadId, onEdit, onNuevoContrato, initialTab }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [tabValue, setTabValue] = useState(0);
  const { hasPermission } = usePermissions();

  // Restaurar la pestaña al volver desde detalle de contrato (tabProp en la URL)
  useEffect(() => {
    if (open && initialTab != null && initialTab >= 0) {
      setTabValue(initialTab);
    }
  }, [open, initialTab]);

  const { data: propiedad, isLoading, error } = useQuery({
    queryKey: ['propiedad-detalle', propiedadId],
    queryFn: () => api.get(`/propiedades/${propiedadId}`).then((r) => r.data),
    enabled: open && !!propiedadId
  });

  const direccionCompleta = propiedad
    ? `${propiedad.dirCalle || ''} ${propiedad.dirNro || ''}${propiedad.dirPiso ? `, Piso ${propiedad.dirPiso}` : ''}${propiedad.dirDepto ? `, Depto ${propiedad.dirDepto}` : ''}`.trim()
    : '';
  const localidadCp = propiedad
    ? [propiedad.localidad?.nombre, propiedad.localidad?.codigoPostal].filter(Boolean).join(' / ') || '—'
    : '—';
  const contratoVigente = propiedad?.contratos?.find((c) => c.estado?.codigo === 'VIGENTE') || null;
  const estadoNombre = propiedad?.estadoPropiedad?.nombre || '—';
  const estadoChip = getEstadoChipProps(estadoNombre);
  const mapaUrl =
    direccionCompleta &&
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccionCompleta + (propiedad?.localidad?.nombre ? ', ' + propiedad.localidad.nombre : ''))}`;

  const handleCerrar = () => {
    setTabValue(0);
    onClose();
  };

  const handleEditar = () => {
    handleCerrar();
    onEdit?.(propiedad);
  };

  const handleNuevoContrato = () => {
    handleCerrar();
    onNuevoContrato?.(propiedad);
  };

  const handleInformePropietario = () => {
    if (!propiedad?.id) return;
    handleCerrar();
    navigate(`/propiedades/informe-propietario?propiedadId=${propiedad.id}`, {
      state: { returnTo: `${location.pathname}${location.search || ''}` }
    });
  };

  const propietario = propiedad?.propietarios?.[0]?.propietario;

  return (
    <Dialog
      open={open}
      onClose={handleCerrar}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: '70vh' } }}
    >
      <DialogContent sx={{ p: 0, minHeight: '400px', maxHeight: '65vh', overflowY: 'auto' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 300, gap: 2 }}>
            <CircularProgress />
            <Button variant="outlined" onClick={handleCerrar} autoFocus>Cerrar</Button>
          </Box>
        ) : error ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="error" sx={{ mb: 2 }}>Error al cargar la propiedad.</Alert>
            <Button variant="outlined" onClick={handleCerrar} autoFocus>Cerrar</Button>
          </Box>
        ) : propiedad ? (
          <>
            {/* ===== HEADER / TARJETA DE PRESENTACIÓN (igual que Clientes: scroll con el contenido) ===== */}
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
                  onClick={handleCerrar}
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
                    <HomeIcon sx={{ fontSize: 32, color: 'white' }} />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h5" fontWeight="bold" sx={{ color: 'white' }}>
                      {direccionCompleta || '—'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mt: 0.25 }}>
                      {localidadCp}
                    </Typography>
                    <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                      <Chip
                        label={estadoChip.label}
                        size="small"
                        color={estadoChip.color}
                        sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', fontWeight: 600 }}
                        variant="outlined"
                      />
                      {propiedad?.tipoPropiedad?.nombre && (
                        <Chip
                          label={propiedad.tipoPropiedad.nombre}
                          size="small"
                          sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 500 }}
                        />
                      )}
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, flexShrink: 0, alignItems: 'center' }}>
                  <RequirePermission codigo="propiedades.ver">
                    <Tooltip title="Informe para propietario (imprimir / PDF)">
                      <IconButton
                        size="small"
                        onClick={handleInformePropietario}
                        sx={{
                          bgcolor: 'white !important',
                          color: 'primary.main',
                          '&:hover': { bgcolor: 'grey.100 !important' },
                          width: 40,
                          height: 40,
                          borderRadius: 1
                        }}
                      >
                        <ArticleIcon />
                      </IconButton>
                    </Tooltip>
                  </RequirePermission>
                  <RequirePermission codigo="propiedades.editar">
                    <Tooltip title="Editar propiedad">
                      <IconButton
                        size="small"
                        onClick={handleEditar}
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
                  {mapaUrl && (
                    <Tooltip title="Ver en mapa">
                      <IconButton
                        size="small"
                        component="a"
                        href={mapaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          bgcolor: 'white !important',
                          color: 'primary.main',
                          '&:hover': { bgcolor: 'grey.100 !important' },
                          width: 40,
                          height: 40,
                          borderRadius: 1
                        }}
                      >
                        <MapIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  <RequirePermission codigo="impuestos.crear">
                    <Tooltip title="Registrar incidencia">
                      <IconButton
                        size="small"
                        sx={{
                          bgcolor: 'white !important',
                          color: 'primary.main',
                          '&:hover': { bgcolor: 'grey.100 !important' },
                          width: 40,
                          height: 40,
                          borderRadius: 1
                        }}
                      >
                        <BuildIcon />
                      </IconButton>
                    </Tooltip>
                  </RequirePermission>
                </Box>
              </Box>
              <Box sx={{ display: { xs: 'flex', sm: 'none' }, px: 3, pb: 2, pt: 0, gap: 1, flexWrap: 'wrap' }}>
                <RequirePermission codigo="propiedades.ver">
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<ArticleIcon />}
                    onClick={handleInformePropietario}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.95)',
                      color: 'primary.main',
                      '&:hover': { bgcolor: 'white' },
                      textTransform: 'none',
                      fontWeight: 600
                    }}
                  >
                    Informe propietario
                  </Button>
                </RequirePermission>
              </Box>
            </Box>

            {/* ===== SECCIÓN DE DATOS (igual que Clientes: con padding) ===== */}
            <Box sx={{ px: 3, py: 2 }}>
              {/* Grid de datos base: Propietario - Tipo Propiedad - Ambientes */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      <PersonIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                      Propietario
                    </Typography>
                    {propietario ? (
                      hasPermission('propietarios.ver') ? (
                        <Link
                          component={RouterLink}
                          to={{
                            pathname: '/clientes',
                            search: `?tab=0&tipo=propietario&id=${propietario.id}`,
                          }}
                          state={getReturnStateFromPropiedad(location, propiedad.id, 'propiedades', tabValue)}
                          onClick={handleCerrar}
                          sx={{ color: 'primary.main', fontWeight: 600 }}
                        >
                          {propietario.razonSocial || `${propietario.apellido || ''}, ${propietario.nombre || ''}`.trim() || '—'}
                        </Link>
                      ) : (
                        <Typography variant="body1" fontWeight={600}>
                          {propietario.razonSocial || `${propietario.apellido || ''}, ${propietario.nombre || ''}`.trim() || '—'}
                        </Typography>
                      )
                    ) : (
                      <Typography variant="body1" fontWeight={600}>
                        —
                      </Typography>
                    )}
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      <ApartmentIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                      Tipo de Propiedad
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {propiedad.tipoPropiedad?.nombre || '—'}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      <MeetingRoomIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                      Superficie y ambientes
                    </Typography>
                    <Typography variant="body1" fontWeight={600} component="div">
                      {propiedad.superficieM2 != null && propiedad.superficieM2 !== ''
                        ? `${Number(propiedad.superficieM2)} m²`
                        : '—'}{' '}
                      <Box component="span" sx={{ color: 'text.secondary', mx: 0.5 }}>
                        ·
                      </Box>{' '}
                      {propiedad.ambientes?.nombre || '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      Impuestos (inmobiliaria):{' '}
                      {propiedad.administraImpuestosInmobiliaria ? 'Administra' : 'No administra'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {(() => {
                const allTabs = [
                  { key: 'estado-comercial', label: 'Estado Comercial', permiso: 'contratos.ver' },
                  { key: 'impuestos-servicios', label: 'Impuestos y Servicios', permiso: 'propiedad.servicios.ver' },
                  { key: 'historial-contratos', label: 'Historial de Contratos', permiso: 'contratos.ver' },
                  { key: 'mantenimiento', label: 'Mantenimiento / Incidencias', permiso: 'impuestos.ver' }
                ];

                const visibleTabs = allTabs.filter(tab => hasPermission(tab.permiso));
                const safeTabValue = tabValue < visibleTabs.length ? tabValue : 0;
                const currentTabKey = visibleTabs[safeTabValue]?.key;

                return (
                  <>
                    <Tabs value={safeTabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
                      {visibleTabs.map((tab) => (
                        <Tab key={tab.key} label={tab.label} />
                      ))}
                    </Tabs>

                    {/* Tab: Estado Comercial */}
                    {currentTabKey === 'estado-comercial' && (
                      <Box sx={{ pt: 2 }}>
                        {contratoVigente ? (
                          <Box>
                            <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
                              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                Contrato vigente
                              </Typography>
                              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                                {hasPermission('contratos.ver') ? (
                                  <Link
                                    component={RouterLink}
                                    to={{
                                      pathname: '/contratos',
                                      search: `?id=${contratoVigente.id}`,
                                    }}
                                    state={getReturnStateFromPropiedad(location, propiedad.id, 'propiedades', tabValue)}
                                    onClick={handleCerrar}
                                    sx={{ color: 'primary.main' }}
                                  >
                                    Contrato #{contratoVigente.nroContrato || contratoVigente.id}
                                  </Link>
                                ) : (
                                  <>Contrato #{contratoVigente.nroContrato || contratoVigente.id}</>
                                )}
                              </Typography>
                              <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                  <Typography variant="caption" color="text.secondary">
                                    Inquilino
                                  </Typography>
                                  {contratoVigente.inquilino ? (
                                    <Typography variant="body1" fontWeight={600}>
                                      {hasPermission('inquilinos.ver') ? (
                                        <Link
                                          component={RouterLink}
                                          to={{
                                            pathname: '/clientes',
                                            search: `?tab=1&tipo=inquilino&id=${contratoVigente.inquilino.id}`,
                                          }}
                                          state={getReturnStateFromPropiedad(location, propiedad.id, 'propiedades', tabValue)}
                                          onClick={handleCerrar}
                                          sx={{ color: 'primary.main' }}
                                        >
                                          {contratoVigente.inquilino.razonSocial ||
                                            `${contratoVigente.inquilino.apellido || ''}, ${contratoVigente.inquilino.nombre || ''}`.trim()}
                                        </Link>
                                      ) : (
                                        <>{contratoVigente.inquilino.razonSocial ||
                                          `${contratoVigente.inquilino.apellido || ''}, ${contratoVigente.inquilino.nombre || ''}`.trim()}</>
                                      )}
                                    </Typography>
                                  ) : (
                                    <Typography variant="body1">—</Typography>
                                  )}
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <Typography variant="caption" color="text.secondary">
                                    Vigencia
                                  </Typography>
                                  {contratoVigente.fechaInicio && contratoVigente.fechaFin ? (() => {
                                    const v = getVencimientoStyles(contratoVigente.fechaFin);
                                    return (
                                      <Typography variant="body1" sx={{ color: v.color }}>
                                        {v.vencePronto && <WarningAmberIcon sx={{ fontSize: 14, mr: 0.25, verticalAlign: 'text-bottom' }} />}
                                        {dayjs(contratoVigente.fechaInicio).format('DD/MM/YY')} - {dayjs(contratoVigente.fechaFin).format('DD/MM/YY')}
                                        {v.vencePronto && (
                                          <Typography component="span" variant="caption" sx={{ color: v.color, ml: 0.5 }}>
                                            {v.vencido ? '(Vencido)' : '(Vence pronto)'}
                                          </Typography>
                                        )}
                                      </Typography>
                                    );
                                  })() : (
                                    <Typography variant="body1">—</Typography>
                                  )}
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <Typography variant="caption" color="text.secondary">
                                    Importe Actual
                                  </Typography>
                                  <Typography variant="body1" fontWeight={700}>
                                    {formatCurrency(contratoVigente.montoActual || contratoVigente.montoInicial)}
                                  </Typography>
                                </Grid>
                              </Grid>
                            </Paper>
                          </Box>
                        ) : (
                          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                            <Typography color="text.secondary" sx={{ mb: 2 }}>
                              Propiedad actualmente sin contrato activo.
                            </Typography>
                            <RequirePermission codigo="contratos.crear">
                              <Button
                                variant="contained"
                                size="large"
                                startIcon={<AddIcon />}
                                onClick={handleNuevoContrato}
                              >
                                Nuevo Contrato
                              </Button>
                            </RequirePermission>
                          </Paper>
                        )}
                      </Box>
                    )}

                    {/* Tab: Impuestos y Servicios */}
                    {currentTabKey === 'impuestos-servicios' && (
                      <Box sx={{ pt: 2 }}>
                        {(() => {
                          const cargosSinAlquiler = (propiedad.cargos || []).filter(
                            (c) => (c.tipoCargo?.codigo || '').toUpperCase() !== 'ALQUILER'
                          );
                          const hayImpuestos = (propiedad.impuestos?.length ?? 0) > 0;
                          const hayCargosServicio = cargosSinAlquiler.length > 0;
                          const hayItems = hayImpuestos || hayCargosServicio;
                          return (
                            <>
                              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                                <TableContainer component={Paper} variant="outlined">
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                                        <TableCell><strong>Servicio</strong></TableCell>
                                        <TableCell><strong>Titular</strong></TableCell>
                                        <TableCell><strong>Cuenta / Medidor</strong></TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {hayImpuestos && propiedad.impuestos.map((imp) => {
                                        const camposStr = (imp.campos || [])
                                          .map((c) => {
                                            const name = c.tipoCampo?.nombre || c.tipoCampo?.codigo || 'Valor';
                                            return `${name}: ${c.valor || '—'}`;
                                          })
                                          .join(' · ') || '—';
                                        const titularStr = formatTitularPropiedadImpuesto(imp) || '—';
                                        return (
                                          <TableRow key={`imp-${imp.id}`}>
                                            <TableCell>{imp.tipoImpuesto?.nombre || imp.tipoImpuesto?.codigo || '—'}</TableCell>
                                            <TableCell>{titularStr}</TableCell>
                                            <TableCell>{camposStr}</TableCell>
                                          </TableRow>
                                        );
                                      })}
                                      {hayCargosServicio && cargosSinAlquiler.map((cargo) => {
                                        const camposStr = (cargo.campos || [])
                                          .map((c) => {
                                            const name = c.tipoCampo?.nombre || c.tipoCampo?.codigo || 'Valor';
                                            return `${name}: ${c.valor || '—'}`;
                                          })
                                          .join(' · ') || '—';
                                        return (
                                          <TableRow key={`cargo-${cargo.id}`}>
                                            <TableCell>{cargo.tipoCargo?.nombre || cargo.tipoCargo?.codigo || '—'}</TableCell>
                                            <TableCell>—</TableCell>
                                            <TableCell>{camposStr || '—'}</TableCell>
                                          </TableRow>
                                        );
                                      })}
                                      {!hayItems && (
                                        <TableRow>
                                          <TableCell colSpan={3} align="center" sx={{ color: 'text.secondary' }}>
                                            No hay impuestos/servicios cargados.
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              </Box>
                              <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
                                {hayItems ? (
                                  <>
                                    {propiedad.impuestos?.map((imp) => {
                                      const camposStr = (imp.campos || [])
                                        .map((c) => {
                                          const name = c.tipoCampo?.nombre || c.tipoCampo?.codigo || 'Valor';
                                          return `${name}: ${c.valor || '—'}`;
                                        })
                                        .join(' · ') || '—';
                                      const titularStr = formatTitularPropiedadImpuesto(imp) || '—';
                                      return (
                                        <Card key={`imp-${imp.id}`} variant="outlined" sx={{ p: 2 }}>
                                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>{imp.tipoImpuesto?.nombre || imp.tipoImpuesto?.codigo || '—'}</Typography>
                                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                            Titular: {titularStr}
                                          </Typography>
                                          <Typography variant="body2">{camposStr}</Typography>
                                        </Card>
                                      );
                                    })}
                                    {cargosSinAlquiler.map((cargo) => {
                                      const camposStr = (cargo.campos || [])
                                        .map((c) => {
                                          const name = c.tipoCampo?.nombre || c.tipoCampo?.codigo || 'Valor';
                                          return `${name}: ${c.valor || '—'}`;
                                        })
                                        .join(' · ') || '—';
                                        return (
                                        <Card key={`cargo-${cargo.id}`} variant="outlined" sx={{ p: 2 }}>
                                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>{cargo.tipoCargo?.nombre || cargo.tipoCargo?.codigo || '—'}</Typography>
                                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Titular: —</Typography>
                                          <Typography variant="body2">{camposStr || '—'}</Typography>
                                        </Card>
                                      );
                                    })}
                                  </>
                                ) : (
                                  <Typography color="text.secondary">No hay impuestos/servicios cargados.</Typography>
                                )}
                              </Box>
                            </>
                          );
                        })()}
                      </Box>
                    )}

                    {/* Tab: Historial de Contratos */}
                    {currentTabKey === 'historial-contratos' && (
                      <Box sx={{ pt: 2 }}>
                        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ bgcolor: 'grey.50' }}>
                                  <TableCell><strong>Nro</strong></TableCell>
                                  <TableCell><strong>Inquilino</strong></TableCell>
                                  <TableCell><strong>Período</strong></TableCell>
                                  <TableCell><strong>Estado</strong></TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {propiedad.contratos?.length > 0 ? (
                                  propiedad.contratos.map((c) => (
                                    <TableRow key={c.id}>
                                      <TableCell>
                                        {hasPermission('contratos.ver') ? (
                                          <Link
                                            component={RouterLink}
                                            to={{
                                              pathname: '/contratos',
                                              search: `?id=${c.id}`,
                                            }}
                                            state={getReturnStateFromPropiedad(location, propiedad.id, 'propiedades', tabValue)}
                                            onClick={handleCerrar}
                                            sx={{ color: 'primary.main', fontWeight: 600 }}
                                          >
                                            #{c.nroContrato || c.id}
                                          </Link>
                                        ) : (
                                          <Typography variant="body2" fontWeight={600}>#{c.nroContrato || c.id}</Typography>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {c.inquilino
                                          ? c.inquilino.razonSocial || `${c.inquilino.apellido || ''}, ${c.inquilino.nombre || ''}`.trim()
                                          : '—'}
                                      </TableCell>
                                      <TableCell>
                                        {c.fechaInicio && c.fechaFin
                                          ? `${dayjs(c.fechaInicio).format('DD/MM/YY')} - ${dayjs(c.fechaFin).format('DD/MM/YY')}`
                                          : '—'}
                                      </TableCell>
                                      <TableCell>
                                        <Chip label={c.estado?.nombre || '—'} size="small" color={c.estado?.codigo === 'VIGENTE' ? 'success' : 'default'} />
                                      </TableCell>
                                    </TableRow>
                                  ))
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary' }}>
                                      No hay contratos en el historial.
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                        <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
                          {propiedad.contratos?.length > 0 ? (
                            propiedad.contratos.map((c) => (
                              <Card key={c.id} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                  {hasPermission('contratos.ver') ? (
                                    <Link
                                      component={RouterLink}
                                      to={{ pathname: '/contratos', search: `?id=${c.id}` }}
                                      state={getReturnStateFromPropiedad(location, propiedad.id, 'propiedades', tabValue)}
                                      onClick={handleCerrar}
                                      sx={{ color: 'primary.main', fontWeight: 600 }}
                                    >
                                      Nro #{c.nroContrato || c.id}
                                    </Link>
                                  ) : (
                                    <>Nro #{c.nroContrato || c.id}</>
                                  )}
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 0.5 }}>
                                  Inquilino: {c.inquilino
                                    ? c.inquilino.razonSocial || `${c.inquilino.apellido || ''}, ${c.inquilino.nombre || ''}`.trim()
                                    : '—'}
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                  Vigencia: {c.fechaInicio && c.fechaFin
                                    ? `${dayjs(c.fechaInicio).format('DD/MM/YY')} - ${dayjs(c.fechaFin).format('DD/MM/YY')}`
                                    : '—'}
                                </Typography>
                                <Chip label={c.estado?.nombre || '—'} size="small" color={c.estado?.codigo === 'VIGENTE' ? 'success' : 'default'} />
                              </Card>
                            ))
                          ) : (
                            <Typography color="text.secondary">No hay contratos en el historial.</Typography>
                          )}
                        </Box>
                      </Box>
                    )}

                    {/* Tab: Mantenimiento / Incidencias */}
                    {currentTabKey === 'mantenimiento' && (
                      <Box sx={{ pt: 2 }}>
                        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                          <Typography color="text.secondary">
                            Próximamente: lista de incidencias y tickets de mantenimiento para esta propiedad.
                          </Typography>
                        </Paper>
                      </Box>
                    )}
                  </>
                );
              })()}

              <Box sx={{ pb: 2 }} />
            </Box>
          </>
        ) : null}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCerrar}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
