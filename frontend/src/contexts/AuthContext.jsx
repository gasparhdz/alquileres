import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Función para limpiar sesión (usada por logout y cuando expira la sesión)
  const clearSession = useCallback(() => {
    setUser(null);
    // Limpiar cualquier dato de usuario en localStorage (solo info no sensible)
    localStorage.removeItem('user');
  }, []);

  // Verificar autenticación al montar el componente
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Intentar obtener el usuario actual
        // Si hay cookies HttpOnly válidas, esto funcionará
        const userData = await authApi.getCurrentUser();
        setUser(userData);
        // Guardar datos del usuario (no sensibles) para UX
        localStorage.setItem('user', JSON.stringify(userData));
      } catch (error) {
        // Error al verificar autenticación
        if (error.response?.status === 401 || error.response?.status === 403) {
          // Token inválido o expirado, limpiar sesión
          clearSession();
        } else {
          // Error de red u otro, intentar usar usuario guardado como fallback
          const savedUser = localStorage.getItem('user');
          if (savedUser) {
            try {
              setUser(JSON.parse(savedUser));
              console.warn('Usando datos de usuario guardados debido a error de conexión');
            } catch (e) {
              console.error('Error al parsear usuario guardado:', e);
              clearSession();
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [clearSession]);

  // Escuchar evento de sesión expirada (disparado por el interceptor de Axios)
  useEffect(() => {
    const handleSessionExpired = () => {
      console.warn('Sesión expirada, cerrando sesión...');
      clearSession();
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, [clearSession]);

  const login = async (email, password) => {
    const response = await authApi.login(email, password);
    // El backend ya estableció las cookies HttpOnly
    // Solo guardamos la info del usuario para la UI
    setUser(response.user);
    localStorage.setItem('user', JSON.stringify(response.user));
    return response;
  };

  const logout = async () => {
    try {
      // Llamar al backend para invalidar tokens y limpiar cookies
      await authApi.logout();
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      // Siempre limpiar el estado local
      clearSession();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const usePermissions = () => {
  const { user } = useAuth();
  // Backend devuelve user.permisos como array de códigos (string) en login y GET /api/auth/me
  const permisos = Array.isArray(user?.permisos) ? user.permisos : [];
  const hasPermission = (permissionCode) => {
    if (!permissionCode) return false;
    return permisos.includes(permissionCode);
  };
  return { hasPermission, permisos };
};

