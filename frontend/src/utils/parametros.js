import { useQuery } from '@tanstack/react-query';
import api from '../api';

/**
 * Hook para obtener un mapa de IDs a descripciones para una categoría de parámetros
 * @param {string} categoriaCodigo - Código de la categoría (ej: 'tipo_unidad', 'estado_unidad')
 * @returns {Object} - Objeto con IDs como keys y descripciones como values
 */
export const useParametrosMap = (categoriaCodigo) => {
  const { data: parametros } = useQuery({
    queryKey: ['parametros', categoriaCodigo],
    queryFn: async () => {
      const response = await api.get(`/parametros/categorias/${categoriaCodigo}/parametros`);
      return response.data;
    },
    enabled: !!categoriaCodigo,
    staleTime: 5 * 60 * 1000 // Cache por 5 minutos
  });

  // Crear mapas: ID -> descripción, código -> descripción, descripción -> descripción
  // También crear mapa inverso: ID -> código para comparaciones
  // Esto permite manejar datos existentes que puedan tener códigos o descripciones
  const parametrosMap = {};
  const idToCodigoMap = {};
  const idToAbreviaturaMap = {};
  
  if (parametros) {
    parametros.forEach((param) => {
      parametrosMap[param.id] = param.descripcion; // ID -> descripción
      parametrosMap[param.codigo] = param.descripcion; // Código -> descripción
      parametrosMap[param.descripcion] = param.descripcion; // Descripción -> descripción (para compatibilidad)
      idToCodigoMap[param.id] = param.codigo; // ID -> código
      idToAbreviaturaMap[param.id] = param.abreviatura || param.descripcion; // ID -> abreviatura (o descripción si no hay abreviatura)
    });
  }

  return { descripciones: parametrosMap, codigos: idToCodigoMap, abreviaturas: idToAbreviaturaMap };
};

/**
 * Función helper para obtener la descripción de un valor (ID, código o descripción)
 * @param {Object|string} parametrosMapOrValue - Mapa de valores o valor directo (para compatibilidad)
 * @param {string} valor - ID, código o descripción del parámetro (si parametrosMapOrValue es un mapa)
 * @returns {string} - Descripción o el valor original si no se encuentra
 */
export const getDescripcion = (parametrosMapOrValue, valor) => {
  // Compatibilidad: si solo se pasa un valor, asumir que es el mapa completo
  if (typeof parametrosMapOrValue === 'string') {
    return parametrosMapOrValue || '-';
  }
  
  const parametrosMap = parametrosMapOrValue?.descripciones || parametrosMapOrValue || {};
  const valorFinal = valor !== undefined ? valor : parametrosMapOrValue;
  
  if (!valorFinal) return '-';
  return parametrosMap[valorFinal] || valorFinal;
};

/**
 * Función helper para obtener el código de un valor (ID, código o descripción)
 * Útil para comparaciones cuando se necesita el código
 * @param {Object} parametrosData - Objeto con descripciones y codigos
 * @param {string} valor - ID, código o descripción del parámetro
 * @returns {string} - Código o el valor original si no se encuentra
 */
export const getCodigo = (parametrosData, valor) => {
  if (!valor || !parametrosData?.codigos) return valor;
  
  // Si el valor es un ID, devolver el código
  if (parametrosData.codigos[valor]) {
    return parametrosData.codigos[valor];
  }
  
  // Si el valor ya es un código, devolverlo
  // También verificar si es una descripción y buscar su código
  const parametros = Object.entries(parametrosData.descripciones || {});
  for (const [key, desc] of parametros) {
    if (desc === valor && parametrosData.codigos[key]) {
      return parametrosData.codigos[key];
    }
  }
  
  return valor;
};

/**
 * Función helper para obtener la abreviatura de un valor (ID, código o descripción)
 * @param {Object} parametrosData - Objeto con descripciones, codigos y abreviaturas
 * @param {string} valor - ID, código o descripción del parámetro
 * @returns {string} - Abreviatura, o descripción si no hay abreviatura, o el valor original si no se encuentra
 */
export const getAbreviatura = (parametrosData, valor) => {
  if (!valor) return '-';
  if (!parametrosData?.abreviaturas) return getDescripcion(parametrosData, valor);
  
  // Primero intentar buscar directamente por ID (caso más común, ya que guardamos IDs)
  if (parametrosData.abreviaturas[valor]) {
    return parametrosData.abreviaturas[valor];
  }
  
  // Si no se encontró por ID directo, buscar el ID a partir de código o descripción
  // Buscar en el mapa de códigos
  if (parametrosData.codigos) {
    const codigosEntries = Object.entries(parametrosData.codigos);
    for (const [id, codigo] of codigosEntries) {
      if (codigo === valor && parametrosData.abreviaturas[id]) {
        return parametrosData.abreviaturas[id];
      }
    }
  }
  
  // Buscar en el mapa de descripciones (las keys pueden ser ID, código o descripción)
  if (parametrosData.descripciones) {
    const descripcionesEntries = Object.entries(parametrosData.descripciones);
    for (const [key, descripcion] of descripcionesEntries) {
      // Si el valor coincide con una descripción y la key es un ID, buscar la abreviatura
      if (descripcion === valor && parametrosData.abreviaturas[key]) {
        return parametrosData.abreviaturas[key];
      }
    }
  }
  
  // Si no se encuentra abreviatura, devolver la descripción como fallback
  return getDescripcion(parametrosData, valor);
};

/**
 * Hook para obtener un parámetro específico por código dentro de una categoría
 * Útil para obtener IDs de parámetros por su código (ej: obtener ID de 'borrador')
 * @param {string} categoriaCodigo - Código de la categoría
 * @param {string} parametroCodigo - Código del parámetro
 * @returns {string|null} - ID del parámetro o null si no se encuentra
 */
export const useParametroIdByCodigo = (categoriaCodigo, parametroCodigo) => {
  const { data: parametros } = useQuery({
    queryKey: ['parametros', categoriaCodigo],
    queryFn: async () => {
      const response = await api.get(`/parametros/categorias/${categoriaCodigo}/parametros`);
      return response.data;
    },
    enabled: !!categoriaCodigo && !!parametroCodigo,
    staleTime: 5 * 60 * 1000
  });

  if (!parametros || !parametroCodigo) return null;
  
  const parametro = parametros.find((p) => p.codigo === parametroCodigo);
  return parametro?.id || null;
};

