import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Enviar cookies HttpOnly en todas las peticiones
});

// Flag para evitar múltiples intentos de refresh simultáneos
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

// Interceptor de respuesta con Silent Refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Si el error es 401 y no es una petición de auth (login/refresh/logout)
    const isAuthRoute = originalRequest?.url?.includes('/auth/');
    
    if (error.response?.status === 401 && !isAuthRoute && !originalRequest._retry) {
      // Marcar que ya intentamos reintentar esta petición
      originalRequest._retry = true;
      
      if (isRefreshing) {
        // Si ya hay un refresh en progreso, encolar esta petición
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }
      
      isRefreshing = true;
      
      try {
        // Intentar renovar el token silenciosamente
        await api.post('/auth/refresh');
        
        // Refresh exitoso, procesar la cola de peticiones pendientes
        processQueue(null);
        
        // Reintentar la petición original
        return api(originalRequest);
      } catch (refreshError) {
        // El refresh token también expiró o es inválido
        processQueue(refreshError);
        
        // Disparar evento para que AuthContext limpie el estado
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
        
        // Redirigir a login si no estamos ya ahí
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;

