import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inquilinos from './pages/Inquilinos';
import Propietarios from './pages/Propietarios';
import Unidades from './pages/Unidades';
import Contratos from './pages/Contratos';
import Liquidaciones from './pages/Liquidaciones';
import CuentasTributarias from './pages/CuentasTributarias';
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Cargando...</div>;
  }

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
        <Route path="inquilinos" element={<Inquilinos />} />
        <Route path="propietarios" element={<Propietarios />} />
        <Route path="unidades" element={<Unidades />} />
        <Route path="cuentas-tributarias" element={<CuentasTributarias />} />
        <Route path="contratos" element={<Contratos />} />
        <Route path="liquidaciones" element={<Liquidaciones />} />
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

