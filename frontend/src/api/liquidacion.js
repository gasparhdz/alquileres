import api from './index';

export const liquidacionApi = {
  // Obtener todas las liquidaciones
  getAll: async (params = {}) => {
    const response = await api.get('/liquidaciones', { params });
    return response.data;
  },

  // Obtener liquidación por ID
  getById: async (id) => {
    const response = await api.get(`/liquidaciones/${id}`);
    return response.data;
  },

  // Crear liquidación
  create: async (data) => {
    const response = await api.post('/liquidaciones', data);
    return response.data;
  },

  // Actualizar liquidación
  update: async (id, data) => {
    const response = await api.put(`/liquidaciones/${id}`, data);
    return response.data;
  },

  // Eliminar liquidación
  delete: async (id) => {
    const response = await api.delete(`/liquidaciones/${id}`);
    return response.data;
  },

  // Generar liquidación automática
  generate: async (data) => {
    const response = await api.post('/liquidaciones/generar', data);
    return response.data;
  },

  // Obtener impuestos pendientes (nuevo endpoint)
  getImpuestosPendientes: async (periodo = null, verCompletados = false) => {
    const params = {};
    if (periodo) params.periodo = periodo;
    if (verCompletados) params.verCompletados = 'true';
    const response = await api.get('/liquidaciones/impuestos-pendientes', { params });
    return response.data;
  },

  // Generar liquidaciones de impuestos (nuevo endpoint)
  generarImpuestos: async (periodo) => {
    const response = await api.post('/liquidaciones/impuestos/generar', { periodo });
    return response.data;
  },

  // Completar importe de un item (nuevo endpoint)
  completarImporteItem: async (itemId, importe, actorFacturadoId = null, quienSoportaCostoId = null) => {
    const data = { importe };
    if (actorFacturadoId !== null) data.actorFacturadoId = actorFacturadoId;
    if (quienSoportaCostoId !== null) data.quienSoportaCostoId = quienSoportaCostoId;
    const response = await api.patch(`/liquidaciones/liquidacion-items/${itemId}`, data);
    return response.data;
  },

  // Obtener items pendientes (endpoint antiguo - mantener por compatibilidad)
  getPendientesItems: async (params = {}) => {
    const response = await api.get('/liquidaciones/pendientes-items', { params });
    return response.data;
  },

  // Completar item (endpoint antiguo - mantener por compatibilidad)
  completarItem: async (itemId, data) => {
    const response = await api.post(`/liquidaciones/items/${itemId}/completar`, data);
    return response.data;
  }
};

