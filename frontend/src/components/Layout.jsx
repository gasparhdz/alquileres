import { useState } from 'react';
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
  Button
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import HomeIcon from '@mui/icons-material/Home';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DescriptionIcon from '@mui/icons-material/Description';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 260;
const drawerWidthCollapsed = 72;

const menuItems = [
  { text: 'Inicio', icon: <DashboardIcon />, path: '/' },
  { text: 'Clientes', icon: <PeopleIcon />, path: '/clientes' },
  { text: 'Propiedades', icon: <HomeIcon />, path: '/propiedades' },
  { text: 'Contratos', icon: <DescriptionIcon />, path: '/contratos' },
  { text: 'Liquidaciones', icon: <ReceiptIcon />, path: '/liquidaciones' },
  { text: 'Impuestos y Cargos', icon: <CheckCircleIcon />, path: '/pendientes-impuestos' },
  { text: 'Configuración', icon: <SettingsIcon />, path: '/configuracion' }
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? saved === 'true' : true;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

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

  const drawer = (
    <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: '#ffffff', margin: 0, padding: 0 }}>
      <List sx={{ flexGrow: 1, px: desktopOpen ? 1 : 0.5, pt: 2, margin: 0 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <Tooltip title={!desktopOpen ? item.text : ''} placement="right">
              <ListItemButton
                selected={location.pathname === item.path || (item.path === '/clientes' && (location.pathname === '/inquilinos' || location.pathname === '/propietarios'))}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 8,
                  mb: 0.5,
                  justifyContent: desktopOpen ? 'flex-start' : 'center',
                  minHeight: 48,
                  px: desktopOpen ? 2 : 1,
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
                    minWidth: desktopOpen ? 40 : 0,
                    justifyContent: 'center'
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {desktopOpen && (
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
      <Box sx={{ p: desktopOpen ? 2 : 1 }}>
        {user && desktopOpen && (
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
        {user && !desktopOpen && (
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
        <Tooltip title={!desktopOpen ? 'Cerrar Sesión' : ''} placement="right">
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: 8,
              color: 'error.main',
              justifyContent: desktopOpen ? 'flex-start' : 'center',
              px: desktopOpen ? 2 : 1,
              '&:hover': {
                background: 'rgba(239, 68, 68, 0.08)'
              }
            }}
          >
            <ListItemIcon sx={{ color: 'error.main', minWidth: desktopOpen ? 40 : 0, justifyContent: 'center' }}>
              <LogoutIcon />
            </ListItemIcon>
            {desktopOpen && <ListItemText primary="Cerrar Sesión" />}
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
            <TextField
              className="search-field"
              placeholder="Buscar..."
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                </InputAdornment>
              ),
            }}
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
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth }
          }}
        >
          {drawer}
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
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: 3,
          pr: 3,
          pb: 3,
          pl: 3,
          width: { sm: desktopOpen ? `calc(100% - ${drawerWidth}px)` : `calc(100% - ${drawerWidthCollapsed}px)` },
          ml: { sm: desktopOpen ? `${drawerWidth}px` : `${drawerWidthCollapsed}px` },
          mt: '64px',
          background: '#f8fafc',
          minHeight: { xs: 'calc(100vh - 64px)', sm: 'calc(100vh - 64px)' },
          position: 'relative',
          transition: 'margin-left 0.3s ease, width 0.3s ease'
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
            mt: { xs: 8, sm: 0 }
          }
        }}
      >
        <DialogTitle>Buscar</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            placeholder="Buscar..."
            variant="outlined"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ mt: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSearchOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

