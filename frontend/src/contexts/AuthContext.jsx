import { createContext, useContext, useState, useEffect } from 'react';
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

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const user = await authApi.getCurrentUser();
          setUser(user);
          // Guardar información del usuario en localStorage como respaldo
          localStorage.setItem('user', JSON.stringify(user));
        } catch (error) {
          // Solo eliminar el token si es un error 401 (no autorizado) o 403 (prohibido)
          if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          } else {
            // Para errores de red u otros, intentar usar el usuario guardado en localStorage
            const savedUser = localStorage.getItem('user');
            if (savedUser) {
              try {
                setUser(JSON.parse(savedUser));
                console.warn('Usando datos de usuario guardados debido a error de conexión');
              } catch (e) {
                console.error('Error al parsear usuario guardado:', e);
              }
            }
          }
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    const response = await authApi.login(email, password);
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    setUser(response.user);
    return response;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

