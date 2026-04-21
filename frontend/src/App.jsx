import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth, usePermissions } from './contexts/AuthContext';
import { Box, CircularProgress } from '@mui/material';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Propiedades from './pages/Propiedades';
import InformePropiedadPropietario from './pages/InformePropiedadPropietario';
import Consorcios from './pages/Consorcios';
import Contratos from './pages/Contratos';
import Liquidaciones from './pages/Liquidaciones';
import PendientesImpuestos from './pages/PendientesImpuestos';
import CuentasTributarias from './pages/CuentasTributarias';
import PagosCobranzas from './pages/PagosCobranzas';
import Configuracion from './pages/Configuracion';
import UsuariosRoles from './pages/Usuarios/UsuariosRoles';
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Mientras se verifica la autenticación, mostrar loading
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          bgcolor: 'background.default'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Solo redirigir a login si ya terminó de cargar y no hay usuario
  if (!user) {
    // Guardar la ubicación actual para redirigir después del login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

/**
 * Guard de permisos a nivel de ruta.
 * permiso: string | string[] — si es array, basta con tener AL MENOS uno (OR).
 * Si no tiene permiso, redirige al inicio.
 */
function RequirePermissionRoute({ permiso, children }) {
  const { hasPermission } = usePermissions();

  const tieneAcceso = Array.isArray(permiso)
    ? permiso.some(p => hasPermission(p))
    : hasPermission(permiso);

  if (!tieneAcceso) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Mostrar loading global mientras se verifica autenticación
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          bgcolor: 'background.default'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Obtener la ruta original a la que el usuario quería ir
  const from = location.state?.from?.pathname || '/';

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to={from} replace />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="inicio" element={<Navigate to="/" replace />} />
        <Route path="clientes" element={<RequirePermissionRoute permiso={['inquilinos.ver', 'propietarios.ver']}><Clientes /></RequirePermissionRoute>} />
        <Route path="inquilinos" element={<Navigate to="/clientes" replace />} />
        <Route path="propietarios" element={<Navigate to="/clientes" replace />} />
        <Route path="propiedades" element={<RequirePermissionRoute permiso="propiedades.ver"><Propiedades /></RequirePermissionRoute>} />
        <Route
          path="propiedades/informe-propietario"
          element={
            <RequirePermissionRoute permiso="propiedades.ver">
              <InformePropiedadPropietario />
            </RequirePermissionRoute>
          }
        />
        <Route path="consorcios" element={<RequirePermissionRoute permiso={['consorcios.ver', 'propiedades.ver']}><Consorcios /></RequirePermissionRoute>} />
        <Route path="cuentas-tributarias" element={<RequirePermissionRoute permiso="propiedad.servicios.ver"><CuentasTributarias /></RequirePermissionRoute>} />
        <Route path="contratos" element={<RequirePermissionRoute permiso="contratos.ver"><Contratos /></RequirePermissionRoute>} />
        <Route path="liquidaciones" element={<RequirePermissionRoute permiso="liquidaciones.ver"><Liquidaciones /></RequirePermissionRoute>} />
        <Route path="pagos-cobranzas" element={<RequirePermissionRoute permiso={['movimiento.inquilinos.ver', 'movimiento.propietarios.ver']}><PagosCobranzas /></RequirePermissionRoute>} />
        <Route path="pendientes-impuestos" element={<RequirePermissionRoute permiso="impuestos.ver"><PendientesImpuestos /></RequirePermissionRoute>} />
        <Route path="configuracion" element={<RequirePermissionRoute permiso="parametros.ver"><Configuracion /></RequirePermissionRoute>} />
        <Route path="usuarios" element={<RequirePermissionRoute permiso="usuarios.ver"><UsuariosRoles /></RequirePermissionRoute>} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;

