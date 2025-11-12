import { useQuery } from '@tanstack/react-query';
import {
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Chip
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PeopleIcon from '@mui/icons-material/People';
import HomeIcon from '@mui/icons-material/Home';
import api from '../api';

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

  const { data: unidades } = useQuery({
    queryKey: ['unidades'],
    queryFn: async () => {
      const response = await api.get('/unidades?limit=1');
      return response.data;
    }
  });

  const liquidacionesPendientes = liquidaciones?.data?.filter(
    (l) => l.estado === 'borrador'
  ).length || 0;

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
          <StatCard
            title="Liquidaciones"
            value={liquidaciones?.pagination?.total || 0}
            icon={<ReceiptIcon sx={{ fontSize: 32 }} />}
            gradient="linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)"
          />
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
            value={unidades?.pagination?.total || 0}
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
    </Box>
  );
}

