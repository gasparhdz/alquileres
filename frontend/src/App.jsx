import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Propiedades from './pages/Propiedades';
import Contratos from './pages/Contratos';
import Liquidaciones from './pages/Liquidaciones';
import PendientesImpuestos from './pages/PendientesImpuestos';
import CuentasTributarias from './pages/CuentasTributarias';
import Configuracion from './pages/Configuracion';
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="inquilinos" element={<Navigate to="/clientes" replace />} />
        <Route path="propietarios" element={<Navigate to="/clientes" replace />} />
        <Route path="propiedades" element={<Propiedades />} />
        <Route path="cuentas-tributarias" element={<CuentasTributarias />} />
        <Route path="contratos" element={<Contratos />} />
        <Route path="liquidaciones" element={<Liquidaciones />} />
        <Route path="pendientes-impuestos" element={<PendientesImpuestos />} />
        <Route path="configuracion" element={<Configuracion />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;

