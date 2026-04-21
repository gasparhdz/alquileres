import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { 
  Box, 
  Tabs, 
  Tab, 
  Paper, 
  Typography, 
  Chip
} from '@mui/material';
import { 
  Person as PersonIcon, 
  HomeWork as HomeWorkIcon 
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { usePermissions } from '../contexts/AuthContext';
import Inquilinos from './Inquilinos';
import Propietarios from './Propietarios';
import api from '../api';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`clientes-tabpanel-${index}`}
      aria-labelledby={`clientes-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

export default function Clientes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const puedeVerInquilinos = hasPermission('inquilinos.ver');
  const puedeVerPropietarios = hasPermission('propietarios.ver');

  const tabFromUrl = searchParams.get('tab');
  const [tabValue, setTabValue] = useState(tabFromUrl ? parseInt(tabFromUrl) : 0);
  
  // Estado para señalar a Propietarios que debe reabrir el diálogo
  const [triggerReabrirPropietario, setTriggerReabrirPropietario] = useState(0);

  // Estado para abrir perfil desde búsqueda global
  const [abrirPerfilInquilino, setAbrirPerfilInquilino] = useState(null);
  const [abrirPerfilPropietario, setAbrirPerfilPropietario] = useState(null);

  // Deep link y Return Path: /clientes?tab=0&tipo=propietario&id=X (búsqueda global o volver desde Propiedades/Contratos)
  // Si venimos de otra pantalla (returnTo en state), NO limpiamos la URL para no perder location.state al cerrar el perfil
  useEffect(() => {
    const tipo = searchParams.get('tipo');
    const id = searchParams.get('id');

    if (tipo && id) {
      const clienteId = parseInt(id, 10);
      if (!isNaN(clienteId)) {
        if (tipo === 'inquilino') {
          setTabValue(1);
          setAbrirPerfilInquilino(clienteId);
        } else if (tipo === 'propietario') {
          setTabValue(0);
          setAbrirPerfilPropietario(clienteId);
        }
      }
      // Solo limpiar tipo e id si NO hay return path; así al cerrar el perfil se conserva state y se puede volver
      if (!location.state?.returnTo) {
        searchParams.delete('tipo');
        searchParams.delete('id');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, setSearchParams, location.state]);

  // Queries para obtener contadores (solo si el usuario tiene permiso)
  const { data: propietariosData } = useQuery({
    queryKey: ['propietarios'],
    queryFn: async () => {
      const response = await api.get('/propietarios');
      return response.data;
    },
    enabled: puedeVerPropietarios
  });

  const { data: inquilinosData } = useQuery({
    queryKey: ['inquilinos'],
    queryFn: async () => {
      const response = await api.get('/inquilinos');
      return response.data;
    },
    enabled: puedeVerInquilinos
  });

  const cantPropietarios = propietariosData?.data?.length || 0;
  const cantInquilinos = inquilinosData?.data?.length || 0;

  useEffect(() => {
    if (tabFromUrl !== null) {
      const tabNum = parseInt(tabFromUrl);
      if (!isNaN(tabNum) && tabNum !== tabValue) {
        setTabValue(tabNum);
      }
    }
  }, [tabFromUrl]);

  // Detectar retorno desde Propiedades para reabrir el diálogo de Propietarios
  const returnFromProp = searchParams.get('returnFromProp');
  
  useEffect(() => {
    if (returnFromProp) {
      const propietarioEnEdicion = sessionStorage.getItem('propietarioEnEdicion');
      const propietarioIdParaAsociar = sessionStorage.getItem('propietarioIdParaAsociar');
      
      if (propietarioEnEdicion && propietarioIdParaAsociar) {
        // Limpiar el parámetro de la URL sin recargar
        searchParams.delete('returnFromProp');
        setSearchParams(searchParams, { replace: true });
        // Disparar el trigger para que Propietarios reabra el diálogo
        setTriggerReabrirPropietario(prev => prev + 1);
      }
    }
  }, [returnFromProp]);
  
  // Callback para que Propietarios notifique que procesó el trigger
  const onPropietarioReopened = useCallback(() => {
    // No necesitamos hacer nada aquí, el trigger ya se consumió
  }, []);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    searchParams.set('tab', newValue.toString());
    setSearchParams(searchParams, { replace: true });
  };

  const mostrarTabs = puedeVerInquilinos && puedeVerPropietarios;

  return (
    <Box sx={{ maxWidth: '100%', overflowX: 'hidden' }}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
        Clientes
      </Typography>

      {!puedeVerInquilinos && !puedeVerPropietarios ? (
        <Typography color="text.secondary">
          No tiene permisos para ver esta sección.
        </Typography>
      ) : mostrarTabs ? (
        <>
          {/* TABS */}
          <Paper sx={{ mb: { xs: 2, md: 3 } }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              aria-label="tabs de clientes"
              variant="fullWidth"
            >
              <Tab 
                label={
                  <Box display="flex" alignItems="center" gap={0.5} sx={{ flexWrap: 'nowrap' }}>
                    <HomeWorkIcon fontSize="small" />
                    <Typography variant="body2" component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                      Propietarios
                    </Typography>
                    <Typography variant="body2" component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                      Propietarios
                    </Typography>
                    {cantPropietarios > 0 && (
                      <Chip 
                        label={cantPropietarios} 
                        size="small" 
                        color="primary" 
                        sx={{ height: 20, '& .MuiChip-label': { px: 1 } }} 
                      />
                    )}
                  </Box>
                }
                id="clientes-tab-0" 
                aria-controls="clientes-tabpanel-0"
                sx={{ minHeight: { xs: 48, md: 64 }, px: { xs: 1, md: 2 } }}
              />
              <Tab 
                label={
                  <Box display="flex" alignItems="center" gap={0.5} sx={{ flexWrap: 'nowrap' }}>
                    <PersonIcon fontSize="small" />
                    <Typography variant="body2" component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                      Inquilinos
                    </Typography>
                    <Typography variant="body2" component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                      Inquilinos
                    </Typography>
                    {cantInquilinos > 0 && (
                      <Chip 
                        label={cantInquilinos} 
                        size="small" 
                        color="error"
                        sx={{ height: 20, '& .MuiChip-label': { px: 1 } }} 
                      />
                    )}
                  </Box>
                }
                id="clientes-tab-1" 
                aria-controls="clientes-tabpanel-1"
                sx={{ minHeight: { xs: 48, md: 64 }, px: { xs: 1, md: 2 } }}
              />
            </Tabs>
          </Paper>

          <TabPanel value={tabValue} index={0}>
            <Propietarios 
              triggerReabrirDialogo={triggerReabrirPropietario}
              onDialogoReabierto={onPropietarioReopened}
              abrirPerfilId={abrirPerfilPropietario}
              onPerfilAbierto={() => setAbrirPerfilPropietario(null)}
            />
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            <Inquilinos 
              abrirPerfilId={abrirPerfilInquilino}
              onPerfilAbierto={() => setAbrirPerfilInquilino(null)}
            />
          </TabPanel>
        </>
      ) : puedeVerPropietarios ? (
        <Propietarios 
          triggerReabrirDialogo={triggerReabrirPropietario}
          onDialogoReabierto={onPropietarioReopened}
          abrirPerfilId={abrirPerfilPropietario}
          onPerfilAbierto={() => setAbrirPerfilPropietario(null)}
        />
      ) : (
        <Inquilinos 
          abrirPerfilId={abrirPerfilInquilino}
          onPerfilAbierto={() => setAbrirPerfilInquilino(null)}
        />
      )}
    </Box>
  );
}
