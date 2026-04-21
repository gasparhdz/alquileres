import api from './index';

export const authApi = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data; // Solo retorna { user }, los tokens están en cookies HttpOnly
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  refresh: async () => {
    const response = await api.post('/auth/refresh');
    return response.data;
  },

  register: async (nombre, email, password) => {
    const response = await api.post('/auth/register', { nombre, email, password });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  }
};

