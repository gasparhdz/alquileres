import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Chip,
  TextField,
  InputAdornment,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Autocomplete,
  CircularProgress,
  Paper
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import HomeIcon from '@mui/icons-material/Home';
import DescriptionIcon from '@mui/icons-material/Description';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PaymentsIcon from '@mui/icons-material/Payments';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import ApartmentIcon from '@mui/icons-material/Apartment';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import DomainIcon from '@mui/icons-material/Domain';
import { useAuth, usePermissions } from '../contexts/AuthContext';
import api from '../api';

const drawerWidth = 260;
const drawerWidthCollapsed = 72;

// Íconos y colores por tipo de resultado de búsqueda
const searchResultConfig = {
  propiedad: { icon: <HomeIcon fontSize="small" />, color: '#2563eb', label: 'Propiedad' },
  inquilino: { icon: <PersonIcon fontSize="small" />, color: '#059669', label: 'Inquilino' },
  propietario: { icon: <ApartmentIcon fontSize="small" />, color: '#d97706', label: 'Propietario' },
  contrato: { icon: <DescriptionIcon fontSize="small" />, color: '#7c3aed', label: 'Contrato' },
  cliente: { icon: <PeopleIcon fontSize="small" />, color: '#6b7280', label: 'Cliente' }
};

const menuItems = [
  { text: 'Inicio', icon: <DashboardIcon />, path: '/', permiso: null },
  { text: 'Clientes', icon: <PeopleIcon />, path: '/clientes', permiso: ['inquilinos.ver', 'propietarios.ver'] },
  { text: 'Propiedades', icon: <HomeIcon />, path: '/propiedades', permiso: 'propiedades.ver' },
  { text: 'Consorcios', icon: <DomainIcon />, path: '/consorcios', permiso: ['consorcios.ver', 'propiedades.ver'] },
  { text: 'Contratos', icon: <DescriptionIcon />, path: '/contratos', permiso: 'contratos.ver' },
  { text: 'Impuestos e Incidencias', icon: <CheckCircleIcon />, path: '/pendientes-impuestos', permiso: 'impuestos.ver' },
  { text: 'Liquidaciones', icon: <ReceiptIcon />, path: '/liquidaciones', permiso: 'liquidaciones.ver' },
  { text: 'Cuentas Corrientes', icon: <PaymentsIcon />, path: '/pagos-cobranzas', permiso: ['movimiento.inquilinos.ver', 'movimiento.propietarios.ver'] },
  { text: 'Configuración', icon: <SettingsIcon />, path: '/configuracion', permiso: 'parametros.ver' },
  { text: 'Usuarios y Permisos', icon: <ManageAccountsIcon />, path: '/usuarios', permiso: 'usuarios.ver' }
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? saved === 'true' : true;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchInputValue, setSearchInputValue] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();

  // Filtrar items del menú según permisos
  const visibleMenuItems = menuItems.filter(item => {
    if (!item.permiso) return true; // Sin permiso requerido → siempre visible
    if (Array.isArray(item.permiso)) return item.permiso.some(p => hasPermission(p)); // OR lógico
    return hasPermission(item.permiso);
  });

  // Debounce para la búsqueda
  useEffect(() => {
    if (searchInputValue.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await api.get(`/search?q=${encodeURIComponent(searchInputValue)}`);
        setSearchResults(response.data || []);
      } catch (error) {
        console.error('Error en búsqueda:', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchInputValue]);

  // Atajo de teclado Ctrl+K para abrir el buscador
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        // En móvil abre el dialog, en desktop enfoca el input
        const isMobile = window.innerWidth < 600;
        if (isMobile) {
          setSearchOpen(true);
        } else {
          const searchInput = document.querySelector('.MuiAutocomplete-input');
          if (searchInput) {
            searchInput.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSelect = (event, value) => {
    if (value && value.url) {
      navigate(value.url);
      setSearchInputValue('');
      setSearchResults([]);
      setSearchOpen(false);
    }
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDesktopDrawerToggle = () => {
    const newState = !desktopOpen;
    setDesktopOpen(newState);
    localStorage.setItem('sidebarOpen', newState.toString());
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const renderDrawerContent = (isCollapsed) => (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#ffffff', margin: 0, padding: 0 }}>
      <List sx={{ flexGrow: 1, px: !isCollapsed ? 1 : 0.5, pt: 2, margin: 0 }}>
        {visibleMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <Tooltip title={isCollapsed ? item.text : ''} placement="right">
              <ListItemButton
                selected={location.pathname === item.path || (item.path === '/clientes' && (location.pathname === '/inquilinos' || location.pathname === '/propietarios'))}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 8,
                  mb: 0.5,
                  justifyContent: !isCollapsed ? 'flex-start' : 'center',
                  minHeight: 48,
                  px: !isCollapsed ? 2 : 1,
                  '&.Mui-selected': {
                    background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%)'
                    }
                  }
                }}
              >
                <ListItemIcon
                  sx={{
                    color: (location.pathname === item.path || (item.path === '/clientes' && (location.pathname === '/inquilinos' || location.pathname === '/propietarios'))) ? '#059669' : 'inherit',
                    minWidth: !isCollapsed ? 40 : 0,
                    justifyContent: 'center'
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!isCollapsed && (
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontWeight: (location.pathname === item.path || (item.path === '/clientes' && (location.pathname === '/inquilinos' || location.pathname === '/propietarios'))) ? 600 : 400
                    }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: !isCollapsed ? 2 : 1 }}>
        {user && !isCollapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, px: 1 }}>
            <Avatar
              sx={{
                bgcolor: 'primary.main',
                width: 40,
                height: 40,
                mr: 1.5
              }}
            >
              <AccountCircleIcon />
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {user.nombre}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {user.email}
              </Typography>
            </Box>
          </Box>
        )}
        {user && isCollapsed && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Tooltip title={user.nombre} placement="right">
              <Avatar
                sx={{
                  bgcolor: 'primary.main',
                  width: 40,
                  height: 40
                }}
              >
                <AccountCircleIcon />
              </Avatar>
            </Tooltip>
          </Box>
        )}
        <Tooltip title={isCollapsed ? 'Cerrar Sesión' : ''} placement="right">
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: 8,
              color: 'error.main',
              justifyContent: !isCollapsed ? 'flex-start' : 'center',
              px: !isCollapsed ? 2 : 1,
              '&:hover': {
                background: 'rgba(239, 68, 68, 0.08)'
              }
            }}
          >
            <ListItemIcon sx={{ color: 'error.main', minWidth: !isCollapsed ? 40 : 0, justifyContent: 'center' }}>
              <LogoutIcon />
            </ListItemIcon>
            {!isCollapsed && <ListItemText primary="Cerrar Sesión" />}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: '100%',
          ml: 0
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            edge="start"
            onClick={handleDesktopDrawerToggle}
            sx={{ mr: 2, display: { xs: 'none', sm: 'flex' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600, mr: { xs: 1, sm: 3 } }}>
            Sistema de Alquileres
          </Typography>
          <Box sx={{ flexGrow: 1, display: { xs: 'none', sm: 'flex' }, justifyContent: 'center' }}>
            <Autocomplete
              freeSolo
              options={searchResults}
              loading={searchLoading}
              inputValue={searchInputValue}
              onInputChange={(event, newValue) => setSearchInputValue(newValue)}
              onChange={handleSearchSelect}
              getOptionLabel={(option) => typeof option === 'string' ? option : option.titulo || ''}
              isOptionEqualToValue={(option, value) => option.id === value.id && option.tipo === value.tipo}
              filterOptions={(x) => x}
              noOptionsText={searchInputValue.length < 2 ? "Escribí al menos 2 caracteres..." : "Sin resultados"}
              loadingText="Buscando..."
              PaperComponent={({ children, ...props }) => (
                <Paper {...props} sx={{ mt: 1, borderRadius: 2, boxShadow: 3 }}>
                  {children}
                </Paper>
              )}
              renderOption={(props, option) => {
                const config = searchResultConfig[option.tipo] || searchResultConfig.cliente;
                return (
                  <Box
                    component="li"
                    {...props}
                    key={`${option.tipo}-${option.id}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 1.5,
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: 1,
                        bgcolor: `${config.color}15`,
                        color: config.color
                      }}
                    >
                      {config.icon}
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {option.titulo}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {option.subtitulo}
                        {option.estado && (
                          <Chip
                            label={option.estado}
                            size="small"
                            sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
                          />
                        )}
                      </Typography>
                    </Box>
                    <Chip
                      label={config.label}
                      size="small"
                      sx={{
                        bgcolor: `${config.color}15`,
                        color: config.color,
                        fontWeight: 500,
                        fontSize: '0.7rem',
                        height: 22
                      }}
                    />
                  </Box>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Buscar propiedades, clientes, contratos... (Ctrl+K)"
                  variant="outlined"
                  size="small"
                  sx={{
                    width: '100%',
                    maxWidth: 500,
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      },
                      '&.Mui-focused': {
                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      },
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.7)',
                      },
                      '& input::placeholder': {
                        color: 'rgba(255, 255, 255, 0.7)',
                        opacity: 1,
                      }
                    }
                  }}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <>
                        {searchLoading && <CircularProgress color="inherit" size={18} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              sx={{ width: '100%', maxWidth: 500 }}
            />
          </Box>
          <IconButton
            color="inherit"
            onClick={() => setSearchOpen(true)}
            sx={{ display: { xs: 'flex', sm: 'none' }, mr: 1 }}
          >
            <SearchIcon />
          </IconButton>
          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
              <Chip
                label={user.nombre}
                size="small"
                sx={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontWeight: 500
                }}
              />
            </Box>
          )}
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{
          width: { sm: desktopOpen ? drawerWidth : drawerWidthCollapsed },
          flexShrink: { sm: 0 },
          position: { sm: 'fixed' },
          left: { sm: 0 },
          top: { sm: '64px' },
          height: { sm: 'calc(100vh - 64px)' },
          zIndex: { sm: 1000 },
          transition: 'width 0.3s ease'
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, height: '100vh', top: 0 }
          }}
        >
          {renderDrawerContent(false)}
        </Drawer>
        <Drawer
          variant="permanent"
          open={desktopOpen}
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: desktopOpen ? drawerWidth : drawerWidthCollapsed,
              top: '64px',
              height: 'calc(100vh - 64px)',
              borderRight: '1px solid #e2e8f0',
              position: 'fixed',
              margin: 0,
              padding: 0,
              transition: 'width 0.3s ease',
              overflowX: 'hidden'
            }
          }}
        >
          {renderDrawerContent(!desktopOpen)}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { xs: '100%', sm: desktopOpen ? `calc(100% - ${drawerWidth}px)` : `calc(100% - ${drawerWidthCollapsed}px)` },
          ml: { xs: 0, sm: desktopOpen ? `${drawerWidth}px` : `${drawerWidthCollapsed}px` },
          mt: '64px',
          background: '#f8fafc',
          minHeight: 'calc(100vh - 64px)',
          position: 'relative',
          transition: 'margin-left 0.3s ease, width 0.3s ease',
          overflowX: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        <Outlet />
      </Box>

      {/* Dialog de búsqueda para mobile */}
      <Dialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            mt: { xs: 2, sm: 0 },
            mx: 2,
            width: 'calc(100% - 32px)'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>Buscar</DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Autocomplete
            freeSolo
            options={searchResults}
            loading={searchLoading}
            inputValue={searchInputValue}
            onInputChange={(event, newValue) => setSearchInputValue(newValue)}
            onChange={handleSearchSelect}
            getOptionLabel={(option) => typeof option === 'string' ? option : option.titulo || ''}
            isOptionEqualToValue={(option, value) => option.id === value.id && option.tipo === value.tipo}
            filterOptions={(x) => x}
            noOptionsText={searchInputValue.length < 2 ? "Escribí al menos 2 caracteres..." : "Sin resultados"}
            loadingText="Buscando..."
            renderOption={(props, option) => {
              const config = searchResultConfig[option.tipo] || searchResultConfig.cliente;
              return (
                <Box
                  component="li"
                  {...props}
                  key={`${option.tipo}-${option.id}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 1.5
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 36,
                      height: 36,
                      borderRadius: 1,
                      bgcolor: `${config.color}15`,
                      color: config.color
                    }}
                  >
                    {config.icon}
                  </Box>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {option.titulo}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {option.subtitulo}
                    </Typography>
                  </Box>
                  <Chip
                    label={config.label}
                    size="small"
                    sx={{
                      bgcolor: `${config.color}15`,
                      color: config.color,
                      fontWeight: 500,
                      fontSize: '0.65rem',
                      height: 20
                    }}
                  />
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                fullWidth
                placeholder="Buscar propiedades, clientes, contratos..."
                variant="outlined"
                size="small"
                sx={{ mt: 1 }}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <>
                      {searchLoading && <CircularProgress size={18} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSearchOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

