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
  completarImporteItem: async (itemId, importe, actorFacturadoId = null, quienSoportaCostoId = null, pagadoPorActorId = null, vencimiento = null) => {
    const data = {};
    // Incluir importe siempre que venga (incluido 0) para que el backend marque como completado
    if (importe !== undefined && importe !== null) data.importe = Number(importe);
    if (actorFacturadoId !== null && actorFacturadoId !== undefined) data.actorFacturadoId = actorFacturadoId;
    if (quienSoportaCostoId !== null && quienSoportaCostoId !== undefined) data.quienSoportaCostoId = quienSoportaCostoId;
    if (pagadoPorActorId !== null && pagadoPorActorId !== undefined) data.pagadoPorActorId = pagadoPorActorId;
    if (vencimiento !== null && vencimiento !== undefined) data.vencimiento = vencimiento;
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
  },

  // Crear ítem manual (incidencia). payload: { concepto, importe, tipoCargoId?, tipoImpuestoId?, fechaGasto?, pagadoPorActorId?, quienSoportaCostoId? }
  crearIncidencia: async (propiedadId, periodo, payload) => {
    const body = {
      propiedadId,
      periodo,
      concepto: payload.concepto ?? '',
      importe: Number(payload.importe)
    };
    if (payload.tipoCargoId != null && payload.tipoCargoId !== '') body.tipoCargoId = payload.tipoCargoId;
    if (payload.tipoImpuestoId != null && payload.tipoImpuestoId !== '') body.tipoImpuestoId = payload.tipoImpuestoId;
    if (payload.fechaGasto) body.fechaGasto = payload.fechaGasto;
    if (payload.pagadoPorActorId != null && payload.pagadoPorActorId !== '') body.pagadoPorActorId = payload.pagadoPorActorId;
    if (payload.quienSoportaCostoId != null && payload.quienSoportaCostoId !== '') body.quienSoportaCostoId = payload.quienSoportaCostoId;
    const response = await api.post('/liquidaciones/incidencias', body);
    return response.data;
  }
};

