import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  Paper
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import PeopleIcon from '@mui/icons-material/People';
import HomeIcon from '@mui/icons-material/Home';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import api from '../api';

const pulseAjustes = {
  '@keyframes pulseAjustes': {
    '0%, 100%': {
      boxShadow: '0 4px 24px rgba(13, 148, 136, 0.5), 0 0 0 0 rgba(245, 158, 11, 0.5)'
    },
    '50%': {
      boxShadow: '0 8px 32px rgba(13, 148, 136, 0.7), 0 0 0 10px rgba(245, 158, 11, 0)'
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
};

const StatCard = ({ title, value, icon, color, gradient }) => (
  <Card
    sx={{
      background: gradient || `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
      color: 'white',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: -50,
        right: -50,
        width: 150,
        height: 150,
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.1)'
      }
    }}
  >
    <CardContent sx={{ position: 'relative', zIndex: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
            {title}
          </Typography>
          <Typography variant="h3" fontWeight="bold">
            {value}
          </Typography>
        </Box>
        <Box
          sx={{
            background: 'rgba(255, 255, 255, 0.2)',
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

export default function Dashboard() {
  const { data: contratos, isLoading: loadingContratos } = useQuery({
    queryKey: ['contratos', 'activos'],
    queryFn: async () => {
      const response = await api.get('/contratos?activo=true&limit=10');
      return response.data;
    }
  });

  const { data: liquidaciones, isLoading: loadingLiquidaciones } = useQuery({
    queryKey: ['liquidaciones', 'recientes'],
    queryFn: async () => {
      const response = await api.get('/liquidaciones?limit=10');
      return response.data;
    }
  });

  const { data: inquilinos } = useQuery({
    queryKey: ['inquilinos'],
    queryFn: async () => {
      const response = await api.get('/inquilinos?limit=1');
      return response.data;
    }
  });

  const { data: propiedades } = useQuery({
    queryKey: ['propiedades'],
    queryFn: async () => {
      const response = await api.get('/propiedades?limit=1');
      return response.data;
    }
  });

  const liquidacionesPendientes = liquidaciones?.data?.filter(
    (l) => l.estado === 'borrador'
  ).length || 0;

  const { data: ajustesPendientes, isLoading: loadingAjustes } = useQuery({
    queryKey: ['dashboard', 'ajustes-pendientes'],
    queryFn: async () => {
      const res = await api.get('/dashboard/ajustes-pendientes', { params: { modo: 'todos', dias: 15 } });
      return res.data;
    }
  });

  const [openAjustesPendientes, setOpenAjustesPendientes] = useState(false);
  const navigate = useNavigate();
  const totalVencidos = ajustesPendientes?.meta?.totalVencidos ?? 0;
  const totalProximos = ajustesPendientes?.meta?.totalProximos ?? 0;
  const totalAjustesPendientes = totalVencidos + totalProximos;

  const handleActualizarAjuste = (contratoId) => {
    setOpenAjustesPendientes(false);
    navigate(`/contratos?contratoId=${contratoId}&tab=ajustes&accion=nuevo`);
  };

  const formatFecha = (f) => (f ? new Date(f).toLocaleDateString('es-AR') : '-');

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
               <Typography variant="h4" fontWeight="bold" gutterBottom>
                 Inicio
               </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Contratos Activos"
            value={contratos?.pagination?.total || 0}
            icon={<DescriptionIcon sx={{ fontSize: 32 }} />}
            gradient="linear-gradient(135deg, #059669 0%, #10b981 100%)"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            onClick={() => !loadingAjustes && totalAjustesPendientes > 0 && setOpenAjustesPendientes(true)}
            sx={{
              ...pulseAjustes,
              background: totalAjustesPendientes > 0
                ? 'linear-gradient(135deg, #0f766e 0%, #0d9488 40%, #14b8a6 100%)'
                : 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
              color: 'white',
              height: '100%',
              position: 'relative',
              overflow: 'hidden',
              cursor: loadingAjustes || totalAjustesPendientes === 0 ? 'default' : 'pointer',
              opacity: loadingAjustes || totalAjustesPendientes === 0 ? 0.85 : 1,
              boxShadow: totalAjustesPendientes > 0 ? '0 6px 28px rgba(13, 148, 136, 0.55)' : 'none',
              animation: totalAjustesPendientes > 0 ? 'pulseAjustes 2.2s ease-in-out infinite' : 'none',
              '&:hover': totalAjustesPendientes > 0 ? {
                boxShadow: '0 10px 36px rgba(13, 148, 136, 0.65)',
                transform: 'translateY(-3px)'
              } : {}
            }}
          >
            {totalAjustesPendientes > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#f59e0b',
                  boxShadow: '0 0 12px rgba(245, 158, 11, 0.8)',
                  animation: 'pulseDot 1.2s ease-in-out infinite'
                }}
              />
            )}
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Ajustes de alquiler
                    </Typography>
                    {totalAjustesPendientes > 0 && (
                      <Chip
                        label="¡Pendientes!"
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: '#f59e0b',
                          color: 'white',
                          animation: 'titilaNumero 1.8s ease-in-out infinite'
                        }}
                      />
                    )}
                  </Box>
                  <Typography
                    variant="h3"
                    fontWeight="bold"
                    sx={
                      totalAjustesPendientes > 0
                        ? { animation: 'titilaNumero 2s ease-in-out infinite' }
                        : {}
                    }
                  >
                    {loadingAjustes ? '-' : totalAjustesPendientes}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    {totalVencidos} vencidos, {totalProximos} próximos
                  </Typography>
                </Box>
                <Box sx={{ p: 1.5, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }}>
                  <TrendingUpIcon sx={{ fontSize: 32 }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Inquilinos"
            value={inquilinos?.pagination?.total || 0}
            icon={<PeopleIcon sx={{ fontSize: 32 }} />}
            gradient="linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Propiedades"
            value={propiedades?.pagination?.total || 0}
            icon={<HomeIcon sx={{ fontSize: 32 }} />}
            gradient="linear-gradient(135deg, #ea580c 0%, #f97316 100%)"
          />
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" fontWeight={600}>
                  Liquidaciones Pendientes
                </Typography>
                <Chip
                  label={`${liquidacionesPendientes} pendientes`}
                  color={liquidacionesPendientes > 0 ? 'warning' : 'success'}
                  size="small"
                />
              </Box>
              {loadingLiquidaciones ? (
                <LinearProgress />
              ) : liquidacionesPendientes > 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Tienes {liquidacionesPendientes} liquidación(es) en estado borrador que requieren atención.
                </Typography>
              ) : (
                <Typography variant="body2" color="success.main">
                  ✓ No hay liquidaciones pendientes
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={openAjustesPendientes} onClose={() => setOpenAjustesPendientes(false)} maxWidth="md" fullWidth>
        <DialogTitle>Ajustes de alquiler pendientes</DialogTitle>
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
                    <TableCell align="right"><strong>Monto actual</strong></TableCell>
                    <TableCell><strong>Próximo ajuste</strong></TableCell>
                    <TableCell><strong>Estado</strong></TableCell>
                    <TableCell align="right"><strong>Acciones</strong></TableCell>
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
                          {row.montoActual != null ? Number(row.montoActual).toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '-'}
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
          <Button onClick={() => setOpenAjustesPendientes(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

