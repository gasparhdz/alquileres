import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Determina el estado de la propiedad basándose en los contratos asociados
 * Reglas:
 * - Si hay un contrato vigente, prorrogado o renovado → 'alquilada'
 * - Si solo hay borradores o pendientes de firma → 'no_disponible'
 * - Si todos están vencidos, rescindidos, anulados o finalizados → 'disponible'
 * @param {string} unidadId - ID de la propiedad
 * @returns {Promise<string|null>} - Código del estado de la propiedad o null si no se puede determinar
 */
async function determinarEstadoPropiedad(propiedadId) {
  try {
    // Obtener todos los contratos no eliminados de la propiedad
    const contratos = await prisma.contrato.findMany({
      where: {
        propiedadId: propiedadId,
        deletedAt: null,
        activo: true
      },
      select: {
        estado: {
          select: {
            codigo: true
          }
        },
        fechaFin: true
      },
      orderBy: {
        fechaInicio: 'desc'
      }
    });

    if (!contratos || contratos.length === 0) {
      // Si no hay contratos, la propiedad está disponible
      return 'disponible';
    }

    // Estados que hacen que la propiedad esté alquilada (incluye estados intermedios donde el contrato sigue activo)
    const estadosAlquilada = ['VIGENTE', 'PRORROGADO', 'RENOVADO', 'SUSPENDIDO', 'EN_MORA'];
    
    // Estados que hacen que la propiedad esté no disponible (pero no alquilada aún)
    const estadosNoDisponible = ['BORRADOR', 'PENDIENTE_FIRMA'];
    
    // Estados que hacen que la propiedad esté disponible (contrato finalizado)
    const estadosDisponible = ['VENCIDO', 'RESCINDIDO', 'ANULADO', 'FINALIZADO'];

    // Prioridad 1: Si hay algún contrato que haga que la propiedad esté alquilada
    const tieneContratoAlquilada = contratos.some(c => estadosAlquilada.includes(c.estado?.codigo));
    if (tieneContratoAlquilada) {
      return 'alquilada';
    }

    // Prioridad 2: Si hay algún contrato que haga que la propiedad esté no disponible
    const tieneContratoNoDisponible = contratos.some(c => estadosNoDisponible.includes(c.estado?.codigo));
    if (tieneContratoNoDisponible) {
      return 'no_disponible';
    }

    // Prioridad 3: Si todos los contratos están en estados que liberan la propiedad
    const todosDisponibles = contratos.every(c => estadosDisponible.includes(c.estado?.codigo));
    if (todosDisponibles) {
      return 'disponible';
    }

    // Por defecto: si no hay contratos activos, la propiedad está disponible
    return 'disponible';
  } catch (error) {
    console.error('Error al determinar estado de propiedad:', error);
    return null;
  }
}

/**
 * Actualiza el estado de la propiedad basándose en sus contratos
 * @param {string} unidadId - ID de la propiedad
 */
async function actualizarEstadoPropiedad(propiedadId) {
  try {
    const nuevoEstado = await determinarEstadoPropiedad(propiedadId);
    
    if (nuevoEstado) {
      // Buscar el estado correspondiente en el catálogo
      const estadoPropiedad = await prisma.estadoPropiedad.findFirst({
        where: { codigo: nuevoEstado.toUpperCase() }
      });
      
      if (estadoPropiedad) {
        await prisma.propiedad.update({
          where: { id: propiedadId },
          data: { estadoPropiedadId: estadoPropiedad.id }
        });
        console.log(`Estado de propiedad ${propiedadId} actualizado a: ${nuevoEstado}`);
      }
    }
  } catch (error) {
    console.error('Error al actualizar estado de propiedad:', error);
    // No lanzar el error para no interrumpir la operación principal
  }
}

// Contratos principales
export const getAllContratos = async (req, res) => {
  try {
    const { search, propiedadId, inquilinoId, activo, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const now = new Date();

    const where = {
      deletedAt: null,
      activo: true,
      ...(propiedadId && { propiedadId: parseInt(propiedadId) }),
      ...(inquilinoId && { inquilinoId: parseInt(inquilinoId) }),
      ...(activo === 'true' && {
        OR: [
          { fechaFin: null },
          { fechaFin: { gte: now } }
        ]
      }),
      ...(search && {
        OR: [
          { nroContrato: { contains: search, mode: 'insensitive' } },
          { propiedad: { dirCalle: { contains: search, mode: 'insensitive' } } },
          { inquilino: { nombre: { contains: search, mode: 'insensitive' } } },
          { inquilino: { apellido: { contains: search, mode: 'insensitive' } } },
          { inquilino: { razonSocial: { contains: search, mode: 'insensitive' } } }
        ]
      })
    };

    const [contratos, total] = await Promise.all([
      prisma.contrato.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { fechaInicio: 'desc' },
        include: {
          propiedad: {
            include: {
              localidad: {
                include: {
                  provincia: true
                }
              },
              provincia: true,
              propietarios: {
                where: {
                  deletedAt: null,
                  activo: true
                },
                include: {
                  propietario: {
                    select: {
                      id: true,
                      nombre: true,
                      apellido: true,
                      razonSocial: true
                    }
                  }
                }
              }
            }
          },
          inquilino: true,
          estado: true,
          moneda: true,
          metodoAjuste: true
        }
      }),
      prisma.contrato.count({ where })
    ]);

    res.json({
      data: contratos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error al obtener contratos:', error);
    res.status(500).json({ error: 'Error al obtener contratos', details: error.message });
  }
};

export const getContratoById = async (req, res) => {
  try {
    const { id } = req.params;
    const contratoId = parseInt(id);

    if (isNaN(contratoId)) {
      return res.status(400).json({ error: 'ID de contrato inválido' });
    }

    const contrato = await prisma.contrato.findUnique({
      where: { id: contratoId },
      include: {
        propiedad: {
          include: {
            propietarios: {
              include: {
                propietario: true
              }
            },
            localidad: {
              include: {
                provincia: true
              }
            },
            provincia: true,
            tipoPropiedad: true,
            estadoPropiedad: true,
            destino: true,
            ambientes: true
          }
        },
        inquilino: true,
        moneda: true,
        estado: true,
        metodoAjuste: true,
        responsabilidades: {
          include: {
            tipoImpuesto: true,
            tipoCargo: true,
            quienPagaProveedor: true,
            quienSoportaCosto: true
          }
        },
        garantias: {
          include: {
            tipoGarantia: true,
            estadoGarantia: true
          }
        },
        gastosIniciales: {
          include: {
            tipoGastoInicial: true,
            quienPaga: true
          }
        },
        ajustes: {
          orderBy: { fechaAjuste: 'desc' }
        },
        liquidaciones: {
          orderBy: { periodo: 'desc' },
          include: {
            items: true
          }
        }
      }
    });

    if (!contrato || contrato.deletedAt || !contrato.activo) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    res.json(contrato);
  } catch (error) {
    console.error('Error al obtener contrato:', error);
    res.status(500).json({ error: 'Error al obtener contrato' });
  }
};

export const getContratosByUnidad = async (req, res) => {
  try {
    const { unidadId } = req.params;

    const contratos = await prisma.contrato.findMany({
      where: {
        unidadId,
        isDeleted: false
      },
      include: {
        inquilino: true,
        responsabilidades: true
      },
      orderBy: { fechaInicio: 'desc' }
    });

    res.json(contratos);
  } catch (error) {
    console.error('Error al obtener contratos por unidad:', error);
    res.status(500).json({ error: 'Error al obtener contratos' });
  }
};

export const getContratosByInquilino = async (req, res) => {
  try {
    const { inquilinoId } = req.params;

    const contratos = await prisma.contrato.findMany({
      where: {
        inquilinoId,
        isDeleted: false
      },
      include: {
        unidad: {
          include: {
            propietario: true
          }
        }
      },
      orderBy: { fechaInicio: 'desc' }
    });

    res.json(contratos);
  } catch (error) {
    console.error('Error al obtener contratos por inquilino:', error);
    res.status(500).json({ error: 'Error al obtener contratos' });
  }
};

export const createContrato = async (req, res) => {
  try {
    const data = req.body;

    if (!data.propiedadId || !data.inquilinoId || !data.fechaInicio || !data.montoInicial) {
      return res.status(400).json({ error: 'Propiedad, inquilino, fecha de inicio y monto inicial son requeridos' });
    }

    // Verificar que la propiedad y el inquilino existen
    const [propiedad, inquilino] = await Promise.all([
      prisma.propiedad.findUnique({ where: { id: data.propiedadId } }),
      prisma.inquilino.findUnique({ where: { id: data.inquilinoId } })
    ]);

    if (!propiedad || propiedad.deletedAt || !propiedad.activo) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }
    if (!inquilino || inquilino.deletedAt || !inquilino.activo) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }

    // Generar número de contrato consecutivo si no se proporciona
    let nroContrato = data.nroContrato;
    if (!nroContrato || nroContrato.trim() === '') {
      // Buscar todos los contratos activos para obtener el número más alto
      const todosLosContratos = await prisma.contrato.findMany({
        where: {
          deletedAt: null,
          activo: true
        },
        select: {
          nroContrato: true
        }
      });

      // Extraer números de los contratos (pueden venir en formato antiguo CONT-YYYY-NNNN o solo número)
      let siguienteNumero = 1;
      if (todosLosContratos.length > 0) {
        const numeros = todosLosContratos
          .map(c => {
            if (!c.nroContrato) return 0;
            
            // Si es solo número, parsearlo directamente
            const numeroDirecto = parseInt(c.nroContrato, 10);
            if (!isNaN(numeroDirecto) && numeroDirecto > 0) {
              return numeroDirecto;
            }
            
            // Si tiene formato antiguo CONT-YYYY-NNNN, extraer el número
            const partes = c.nroContrato.split('-');
            if (partes.length === 3 && partes[2]) {
              const numeroDelFormato = parseInt(partes[2], 10);
              if (!isNaN(numeroDelFormato) && numeroDelFormato > 0) {
                return numeroDelFormato;
              }
            }
            
            return 0;
          })
          .filter(n => !isNaN(n) && n > 0);
        
        if (numeros.length > 0) {
          siguienteNumero = Math.max(...numeros) + 1;
        }
      }

      // Formato: solo número (1, 2, 3, etc.)
      nroContrato = siguienteNumero.toString();
    }

    // Construir objeto de datos explícitamente para evitar campos no deseados
    const montoInicial = parseFloat(data.montoInicial);
    const montoActual = data.montoActual ? parseFloat(data.montoActual) : montoInicial;
    
    const contratoData = {
        propiedadId: data.propiedadId,
        inquilinoId: data.inquilinoId,
        nroContrato: nroContrato,
        fechaInicio: data.fechaInicio ? new Date(data.fechaInicio) : new Date(),
        fechaFin: data.fechaFin ? new Date(data.fechaFin) : null,
        duracionMeses: data.duracionMeses ? parseInt(data.duracionMeses, 10) : null,
        montoInicial: montoInicial,
        montoActual: montoActual, // Requerido, usar montoInicial si no viene
        gastosAdministrativos: data.gastosAdministrativos ? parseFloat(data.gastosAdministrativos) : null,
        honorariosPropietario: data.honorariosPropietario ? parseFloat(data.honorariosPropietario) : null,
        frecuenciaAjusteMeses: data.frecuenciaAjusteMeses ? parseInt(data.frecuenciaAjusteMeses, 10) : null,
        metodoAjusteContratoId: data.metodoAjusteContratoId ? parseInt(data.metodoAjusteContratoId, 10) : null,
        monedaId: data.monedaId ? parseInt(data.monedaId, 10) : null,
        estadoContratoId: data.estadoContratoId ? parseInt(data.estadoContratoId, 10) : null
    };
    
    // Solo agregar campos nuevos si están presentes en data y existen en el schema
    if (data.hasOwnProperty('fechaFirma')) {
      contratoData.fechaFirma = data.fechaFirma ? new Date(data.fechaFirma) : null;
    }
    if (data.hasOwnProperty('rescisionAt')) {
      contratoData.rescisionAt = data.rescisionAt ? new Date(data.rescisionAt) : null;
    }
    if (data.hasOwnProperty('motivoRescisionId')) {
      contratoData.motivoRescisionId = data.motivoRescisionId || null;
    }
    if (data.hasOwnProperty('prorrogaHasta')) {
      contratoData.prorrogaHasta = data.prorrogaHasta ? new Date(data.prorrogaHasta) : null;
    }
    if (data.hasOwnProperty('prorrogaDeId')) {
      contratoData.prorrogaDeId = data.prorrogaDeId || null;
    }
    if (data.hasOwnProperty('renovadoPorId')) {
      contratoData.renovadoPorId = data.renovadoPorId || null;
    }
    if (data.hasOwnProperty('renovacionDeId')) {
      contratoData.renovacionDeId = data.renovacionDeId || null;
    }
    if (data.hasOwnProperty('suspendidoDesde')) {
      contratoData.suspendidoDesde = data.suspendidoDesde ? new Date(data.suspendidoDesde) : null;
    }
    if (data.hasOwnProperty('suspendidoHasta')) {
      contratoData.suspendidoHasta = data.suspendidoHasta ? new Date(data.suspendidoHasta) : null;
    }
    if (data.hasOwnProperty('motivoSuspensionId')) {
      contratoData.motivoSuspensionId = data.motivoSuspensionId || null;
    }
    if (data.hasOwnProperty('enMora')) {
      contratoData.enMora = Boolean(data.enMora);
    }

    const contrato = await prisma.contrato.create({
      data: contratoData
    });

    res.status(201).json(contrato);
  } catch (error) {
    console.error('Error al crear contrato:', error);
    console.error('Error details:', error.message);
    console.error('Data received:', req.body);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un contrato con estos datos' });
    }

    res.status(500).json({ 
      error: 'Error al crear contrato',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const updateContrato = async (req, res) => {
  const updateData = {}; // Definir fuera del try para que esté disponible en el catch
  try {
    const { id } = req.params;
    const contratoId = parseInt(id);
    const data = req.body;

    if (isNaN(contratoId)) {
      return res.status(400).json({ error: 'ID de contrato inválido' });
    }

    // Usar findUnique en lugar de findFirst para evitar problemas con campos que no existen
    const contrato = await prisma.contrato.findUnique({
      where: { id: contratoId }
    });

    if (!contrato || contrato.deletedAt || !contrato.activo) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Verificar que propiedad e inquilino existen si se están actualizando
    if (data.propiedadId) {
      const propiedad = await prisma.propiedad.findUnique({
        where: { id: parseInt(data.propiedadId) }
      });
      if (!propiedad || propiedad.deletedAt || !propiedad.activo) {
        return res.status(400).json({ error: 'Propiedad no encontrada' });
      }
    }

    if (data.inquilinoId) {
      const inquilino = await prisma.inquilino.findUnique({
        where: { id: parseInt(data.inquilinoId) }
      });
      if (!inquilino || inquilino.deletedAt || !inquilino.activo) {
        return res.status(400).json({ error: 'Inquilino no encontrado' });
      }
    }

    // Construir objeto de actualización con solo los campos permitidos
    // updateData ya está definido fuera del try
    
    // Campos de relación usando IDs directos (según el nuevo schema)
    if (data.propiedadId !== undefined && data.propiedadId !== null && data.propiedadId !== '') {
      updateData.propiedadId = parseInt(data.propiedadId);
    }
    if (data.inquilinoId !== undefined && data.inquilinoId !== null && data.inquilinoId !== '') {
      updateData.inquilinoId = parseInt(data.inquilinoId);
    }
    if (data.monedaId !== undefined && data.monedaId !== null && data.monedaId !== '') {
      updateData.monedaId = parseInt(data.monedaId);
    }
    if (data.estadoContratoId !== undefined && data.estadoContratoId !== null && data.estadoContratoId !== '') {
      updateData.estadoContratoId = parseInt(data.estadoContratoId);
    }
    if (data.metodoAjusteContratoId !== undefined && data.metodoAjusteContratoId !== null && data.metodoAjusteContratoId !== '') {
      updateData.metodoAjusteContratoId = parseInt(data.metodoAjusteContratoId);
    }
    
    // Campos escalares
    if (data.fechaInicio !== undefined && data.fechaInicio !== null) {
      updateData.fechaInicio = data.fechaInicio instanceof Date ? data.fechaInicio : new Date(data.fechaInicio);
    }
    if (data.fechaFin !== undefined) {
      updateData.fechaFin = data.fechaFin ? (data.fechaFin instanceof Date ? data.fechaFin : new Date(data.fechaFin)) : null;
    }
    if (data.duracionMeses !== undefined) {
      updateData.duracionMeses = data.duracionMeses !== null && data.duracionMeses !== '' ? parseInt(data.duracionMeses, 10) : null;
    }
    if (data.frecuenciaAjusteMeses !== undefined) {
      updateData.frecuenciaAjusteMeses = data.frecuenciaAjusteMeses !== null && data.frecuenciaAjusteMeses !== '' ? parseInt(data.frecuenciaAjusteMeses, 10) : null;
    }
    
    // Campos numéricos requeridos (montoInicial y montoActual no pueden ser null)
    if (data.montoInicial !== undefined && data.montoInicial !== null && data.montoInicial !== '') {
      const parsed = parseFloat(data.montoInicial);
      if (!isNaN(parsed) && parsed >= 0) {
        updateData.montoInicial = parsed;
      }
    }
    
    if (data.montoActual !== undefined && data.montoActual !== null && data.montoActual !== '') {
      const parsed = parseFloat(data.montoActual);
      if (!isNaN(parsed) && parsed >= 0) {
        updateData.montoActual = parsed;
      }
    }
    
    if (data.gastosAdministrativos !== undefined) {
      if (data.gastosAdministrativos !== null && data.gastosAdministrativos !== '') {
        const parsed = parseFloat(data.gastosAdministrativos);
        if (!isNaN(parsed)) {
          updateData.gastosAdministrativos = parsed;
        }
      } else {
        updateData.gastosAdministrativos = null;
      }
    }
    
    if (data.honorariosPropietario !== undefined) {
      if (data.honorariosPropietario !== null && data.honorariosPropietario !== '') {
        const parsed = parseFloat(data.honorariosPropietario);
        if (!isNaN(parsed)) {
          updateData.honorariosPropietario = parsed;
        }
      } else {
        updateData.honorariosPropietario = null;
      }
    }
    
    if (data.periodoAumento !== undefined) {
      if (data.periodoAumento !== null && data.periodoAumento !== '') {
        const parsed = parseInt(data.periodoAumento, 10);
        if (!isNaN(parsed)) {
          updateData.periodoAumento = parsed;
        }
      } else {
        updateData.periodoAumento = null;
      }
    }
    
    if (data.ultimoAjusteAt !== undefined) {
      updateData.ultimoAjusteAt = data.ultimoAjusteAt ? (data.ultimoAjusteAt instanceof Date ? data.ultimoAjusteAt : new Date(data.ultimoAjusteAt)) : null;
    }
    
    if (data.estado !== undefined) {
      updateData.estado = data.estado || null;
    }
    
    // Campos para gestión de estados avanzados
    // NOTA: Estos campos solo se procesan si están presentes en data
    // y solo se agregan a updateData si realmente se envían desde el frontend
    // Si la migración no se ha aplicado, Prisma fallará al intentar actualizar campos que no existen
    // Por ahora, solo procesamos estos campos si están explícitamente en data
    
    // Solo agregar campos nuevos si están explícitamente en data (no undefined)
    // Esto evita intentar actualizar campos que no existen en la BD todavía
    if (data.hasOwnProperty('fechaFirma')) {
      updateData.fechaFirma = data.fechaFirma ? (data.fechaFirma instanceof Date ? data.fechaFirma : new Date(data.fechaFirma)) : null;
    }
    if (data.hasOwnProperty('rescisionAt')) {
      updateData.rescisionAt = data.rescisionAt ? (data.rescisionAt instanceof Date ? data.rescisionAt : new Date(data.rescisionAt)) : null;
    }
    if (data.hasOwnProperty('motivoRescisionId')) {
      updateData.motivoRescisionId = data.motivoRescisionId || null;
    }
    if (data.hasOwnProperty('prorrogaHasta')) {
      updateData.prorrogaHasta = data.prorrogaHasta ? (data.prorrogaHasta instanceof Date ? data.prorrogaHasta : new Date(data.prorrogaHasta)) : null;
    }
    if (data.hasOwnProperty('prorrogaDeId')) {
      updateData.prorrogaDeId = data.prorrogaDeId || null;
    }
    if (data.hasOwnProperty('renovadoPorId')) {
      updateData.renovadoPorId = data.renovadoPorId || null;
    }
    if (data.hasOwnProperty('renovacionDeId')) {
      updateData.renovacionDeId = data.renovacionDeId || null;
    }
    if (data.hasOwnProperty('suspendidoDesde')) {
      updateData.suspendidoDesde = data.suspendidoDesde ? (data.suspendidoDesde instanceof Date ? data.suspendidoDesde : new Date(data.suspendidoDesde)) : null;
    }
    if (data.hasOwnProperty('suspendidoHasta')) {
      updateData.suspendidoHasta = data.suspendidoHasta ? (data.suspendidoHasta instanceof Date ? data.suspendidoHasta : new Date(data.suspendidoHasta)) : null;
    }
    if (data.hasOwnProperty('motivoSuspensionId')) {
      updateData.motivoSuspensionId = data.motivoSuspensionId || null;
    }
    if (data.hasOwnProperty('enMora')) {
      updateData.enMora = Boolean(data.enMora);
    }

    // Obtener el contrato antes de actualizar para conocer la propiedadId y el estado anterior
    const contratoAnterior = await prisma.contrato.findUnique({
      where: { id: contratoId },
      select: { propiedadId: true, estadoContratoId: true }
    });

    const updated = await prisma.contrato.update({
      where: { id: contratoId },
      data: updateData
    });

    // Determinar si se debe actualizar el estado de la propiedad
    const estadoCambio = contratoAnterior?.estadoContratoId !== updateData.estadoContratoId;
    const propiedadCambio = updateData.propiedadId && 
                         contratoAnterior?.propiedadId && 
                         updateData.propiedadId !== contratoAnterior.propiedadId;

    // Actualizar el estado de la propiedad si:
    // 1. Cambió el estado del contrato, o
    // 2. Cambió la propiedad asociada, o
    // 3. Se actualizó cualquier campo que afecte el estado (siempre actualizar por seguridad)
    const propiedadIdParaActualizar = updateData.propiedadId || contratoAnterior?.propiedadId || updated.propiedadId;
    if (propiedadIdParaActualizar && (estadoCambio || propiedadCambio || updateData.estadoContratoId !== undefined)) {
      try {
        await actualizarEstadoPropiedad(propiedadIdParaActualizar);
      } catch (error) {
        console.error('Error al actualizar estado de propiedad:', error);
        // No fallar la actualización del contrato si falla la actualización del estado
      }
    }

    // Si cambió la propiedad, también actualizar el estado de la propiedad anterior
    if (propiedadCambio && contratoAnterior?.propiedadId) {
      try {
        await actualizarEstadoPropiedad(contratoAnterior.propiedadId);
      } catch (error) {
        console.error('Error al actualizar estado de propiedad anterior:', error);
        // No fallar la actualización del contrato si falla la actualización del estado
      }
    }

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar contrato:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error meta:', error.meta);
    console.error('UpdateData que se intentó enviar:', JSON.stringify(updateData, null, 2));
    
    if (error.code === 'P2022') {
      return res.status(500).json({ 
        error: 'Error de esquema de base de datos', 
        message: 'El cliente de Prisma necesita ser regenerado. Por favor, detén el servidor y ejecuta: npx prisma generate --schema prisma/schema.prisma',
        code: error.code,
        detalles: error.meta
      });
    }
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    
    // Si el error menciona campos que no existen, puede ser que la migración no se haya aplicado
    // o que el cliente de Prisma no esté sincronizado
    if (error.message && (
      error.message.includes('Unknown argument') || 
      error.message.includes('does not exist') ||
      error.message.includes('Unknown column') ||
      error.message.includes('Unknown field') ||
      error.message.includes('Invalid value') ||
      error.message.includes('Argument')
    )) {
      return res.status(500).json({ 
        error: 'Error de esquema de base de datos', 
        message: 'El cliente de Prisma necesita ser regenerado o la migración no se aplicó correctamente. Por favor, detén el servidor y ejecuta: npx prisma generate --schema prisma/schema.prisma',
        detalles: error.message,
        meta: error.meta,
        code: error.code
      });
    }
    
    res.status(500).json({ 
      error: 'Error al actualizar contrato', 
      message: error.message,
      code: error.code,
      detalles: error.meta,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const deleteContrato = async (req, res) => {
  try {
    const { id } = req.params;

    const contrato = await prisma.contrato.findUnique({
      where: { id },
      include: {
        liquidaciones: true
      }
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    if (contrato.isDeleted) {
      return res.status(404).json({ error: 'El contrato ya ha sido eliminado' });
    }

    // Verificar que no tenga liquidaciones
    if (contrato.liquidaciones && contrato.liquidaciones.length > 0) {
      const cantidadLiquidaciones = contrato.liquidaciones.length;
      return res.status(400).json({ 
        error: `No se puede eliminar un contrato con liquidaciones asociadas`,
        detalles: `El contrato tiene ${cantidadLiquidaciones} liquidación(es) asociada(s)`
      });
    }

    // Obtener unidadId antes de eliminar
    const unidadId = contrato.unidadId;

    // Baja lógica
    await prisma.contrato.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });

    // Actualizar el estado de la propiedad después de eliminar el contrato
    if (unidadId) {
      await actualizarEstadoPropiedad(unidadId);
    }

    res.json({ message: 'Contrato eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar contrato:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    // Mejorar el manejo de errores
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    
    res.status(500).json({ 
      error: 'Error al eliminar contrato',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Responsabilidades
export const addResponsabilidad = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const contratoId = parseInt(id);
    if (isNaN(contratoId)) {
      return res.status(400).json({ error: 'ID de contrato inválido' });
    }

    const contrato = await prisma.contrato.findFirst({
      where: { 
        id: contratoId, 
        deletedAt: null, 
        activo: true 
      }
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Validar que tenga al menos tipoImpuestoId o tipoCargoId
    if (!data.tipoImpuestoId && !data.tipoCargoId) {
      return res.status(400).json({ error: 'Debe proporcionar tipoImpuestoId o tipoCargoId' });
    }

    // Preparar datos asegurando que los IDs sean números
    const responsabilidadData = {
      contratoId: contratoId,
      tipoImpuestoId: data.tipoImpuestoId ? parseInt(data.tipoImpuestoId) : null,
      tipoCargoId: data.tipoCargoId ? parseInt(data.tipoCargoId) : null,
      quienPagaProveedorId: data.quienPagaProveedorId ? parseInt(data.quienPagaProveedorId) : undefined,
      quienSoportaCostoId: data.quienSoportaCostoId ? parseInt(data.quienSoportaCostoId) : undefined,
      ...(data.titular !== undefined && { titular: data.titular })
    };

    const responsabilidad = await prisma.contratoResponsabilidad.create({
      data: responsabilidadData,
      include: {
        tipoImpuesto: true,
        tipoCargo: true,
        quienPagaProveedor: true,
        quienSoportaCosto: true
      }
    });

    res.status(201).json(responsabilidad);
  } catch (error) {
    console.error('Error al crear responsabilidad:', error);
    res.status(500).json({ error: 'Error al crear responsabilidad', details: error.message });
  }
};

export const updateResponsabilidad = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const responsabilidadId = parseInt(id);
    if (isNaN(responsabilidadId)) {
      return res.status(400).json({ error: 'ID de responsabilidad inválido' });
    }

    const responsabilidad = await prisma.contratoResponsabilidad.findUnique({
      where: { id: responsabilidadId }
    });

    if (!responsabilidad) {
      return res.status(404).json({ error: 'Responsabilidad no encontrada' });
    }

    // Preparar datos asegurando que los IDs sean números
    const updateData = {};
    if (data.tipoImpuestoId !== undefined) {
      updateData.tipoImpuestoId = data.tipoImpuestoId ? parseInt(data.tipoImpuestoId) : null;
    }
    if (data.tipoCargoId !== undefined) {
      updateData.tipoCargoId = data.tipoCargoId ? parseInt(data.tipoCargoId) : null;
    }
    if (data.quienPagaProveedorId !== undefined) {
      updateData.quienPagaProveedorId = data.quienPagaProveedorId ? parseInt(data.quienPagaProveedorId) : null;
    }
    if (data.quienSoportaCostoId !== undefined) {
      updateData.quienSoportaCostoId = data.quienSoportaCostoId ? parseInt(data.quienSoportaCostoId) : null;
    }
    if (data.titular !== undefined) {
      updateData.titular = data.titular;
    }

    const updated = await prisma.contratoResponsabilidad.update({
      where: { id: responsabilidadId },
      data: updateData,
      include: {
        tipoImpuesto: true,
        tipoCargo: true,
        quienPagaProveedor: true,
        quienSoportaCosto: true
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar responsabilidad:', error);
    res.status(500).json({ error: 'Error al actualizar responsabilidad', details: error.message });
  }
};

export const deleteResponsabilidad = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.contratoResponsabilidad.delete({
      where: { id }
    });

    res.json({ message: 'Responsabilidad eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar responsabilidad:', error);
    res.status(500).json({ error: 'Error al eliminar responsabilidad' });
  }
};

// Helper para actualizar el gasto inicial de averiguación de garantías
const actualizarGastoAveriguacionGarantias = async (contratoId) => {
  try {
    console.log(`[actualizarGastoAveriguacionGarantias] Iniciando para contratoId: ${contratoId}`);
    
    // Calcular el total de costos de averiguación de todas las garantías del contrato
    const garantias = await prisma.contratoGarantia.findMany({
      where: {
        contratoId: contratoId,
        activo: true
      },
      select: {
        costoAveriguacion: true
      }
    });

    console.log(`[actualizarGastoAveriguacionGarantias] Encontradas ${garantias.length} garantías activas`);

    // Sumar todos los costos de averiguación
    const totalAveriguacion = garantias.reduce((sum, garantia) => {
      const costo = garantia.costoAveriguacion ? parseFloat(garantia.costoAveriguacion) : 0;
      console.log(`[actualizarGastoAveriguacionGarantias] Costo: ${costo}, Suma acumulada: ${sum + costo}`);
      return sum + costo;
    }, 0);

    console.log(`[actualizarGastoAveriguacionGarantias] Total calculado: ${totalAveriguacion}`);

    // Buscar el tipo de gasto inicial con código "AVERIG" o "AVERIGUACION"
    let tipoGastoAverig = await prisma.tipoGastoInicialContrato.findFirst({
      where: {
        codigo: 'AVERIG',
        activo: true
      }
    });

    // Si no se encuentra con "AVERIG", intentar con "AVERIGUACION"
    if (!tipoGastoAverig) {
      tipoGastoAverig = await prisma.tipoGastoInicialContrato.findFirst({
        where: {
          codigo: 'AVERIGUACION',
          activo: true
        }
      });
    }

    // Si aún no se encuentra, buscar por nombre que contenga "averiguacion"
    if (!tipoGastoAverig) {
      tipoGastoAverig = await prisma.tipoGastoInicialContrato.findFirst({
        where: {
          activo: true,
          OR: [
            { nombre: { contains: 'averiguacion', mode: 'insensitive' } },
            { nombre: { contains: 'averig', mode: 'insensitive' } }
          ]
        }
      });
    }

    if (!tipoGastoAverig) {
      console.error('[actualizarGastoAveriguacionGarantias] No se encontró el tipo de gasto inicial AVERIG/AVERIGUACION');
      // Listar todos los tipos de gasto para debug
      const todosLosTipos = await prisma.tipoGastoInicialContrato.findMany({
        where: { activo: true },
        select: { id: true, codigo: true, nombre: true }
      });
      console.log('[actualizarGastoAveriguacionGarantias] Tipos de gasto disponibles:', todosLosTipos);
      return;
    }

    console.log(`[actualizarGastoAveriguacionGarantias] Tipo de gasto encontrado: ${tipoGastoAverig.codigo} - ${tipoGastoAverig.nombre} (ID: ${tipoGastoAverig.id})`);

    // Buscar el gasto inicial existente de tipo AVERIG para este contrato
    const gastoAverigExistente = await prisma.contratoGastoInicial.findFirst({
      where: {
        contratoId: contratoId,
        tipoGastoInicialId: tipoGastoAverig.id
      }
    });

    // Buscar un actor responsable por defecto (INQUILINO)
    let quienPagaId = null;
    const actorDefault = await prisma.actorResponsableContrato.findFirst({
      where: {
        activo: true,
        deletedAt: null,
        codigo: 'INQ'
      }
    });
    if (actorDefault) {
      quienPagaId = actorDefault.id;
    } else {
      // Si no existe INQ, buscar cualquier actor activo
      const actorCualquiera = await prisma.actorResponsableContrato.findFirst({
        where: {
          activo: true,
          deletedAt: null
        }
      });
      if (actorCualquiera) {
        quienPagaId = actorCualquiera.id;
      }
    }

    if (gastoAverigExistente) {
      // Actualizar el gasto existente
      console.log(`[actualizarGastoAveriguacionGarantias] Actualizando gasto existente ID: ${gastoAverigExistente.id} con total: ${totalAveriguacion}`);
      await prisma.contratoGastoInicial.update({
        where: { id: gastoAverigExistente.id },
        data: {
          importe: totalAveriguacion,
          valorCalculo: totalAveriguacion
        }
      });
      console.log(`[actualizarGastoAveriguacionGarantias] Gasto actualizado exitosamente`);
    } else if (totalAveriguacion > 0) {
      // Crear el gasto inicial solo si hay un total mayor a 0
      console.log(`[actualizarGastoAveriguacionGarantias] Creando nuevo gasto con total: ${totalAveriguacion}, quienPagaId: ${quienPagaId}`);
      const nuevoGasto = await prisma.contratoGastoInicial.create({
        data: {
          contratoId: contratoId,
          tipoGastoInicialId: tipoGastoAverig.id,
          importe: totalAveriguacion,
          valorCalculo: totalAveriguacion,
          quienPagaId: quienPagaId
        }
      });
      console.log(`[actualizarGastoAveriguacionGarantias] Gasto creado exitosamente con ID: ${nuevoGasto.id}`);
    } else if (gastoAverigExistente && totalAveriguacion === 0) {
      // Si el total es 0, eliminar el gasto inicial (opcional, o dejarlo en 0)
      // Por ahora lo dejamos en 0 en lugar de eliminarlo
      console.log(`[actualizarGastoAveriguacionGarantias] Actualizando gasto a 0 (ID: ${gastoAverigExistente.id})`);
      await prisma.contratoGastoInicial.update({
        where: { id: gastoAverigExistente.id },
        data: {
          importe: 0,
          valorCalculo: 0
        }
      });
    } else {
      console.log(`[actualizarGastoAveriguacionGarantias] No hay gasto existente y total es 0, no se crea nada`);
    }
  } catch (error) {
    console.error('[actualizarGastoAveriguacionGarantias] Error al actualizar gasto de averiguación de garantías:', error);
    console.error('[actualizarGastoAveriguacionGarantias] Stack:', error.stack);
    // No lanzar el error para no interrumpir el flujo principal
  }
};

// Garantías
export const addGarantia = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const contratoId = parseInt(id);
    if (isNaN(contratoId)) {
      return res.status(400).json({ error: 'ID de contrato inválido' });
    }

    const contrato = await prisma.contrato.findFirst({
      where: { 
        id: contratoId, 
        deletedAt: null, 
        activo: true 
      }
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Preparar datos asegurando que los IDs sean números y el costo sea decimal
    const garantiaData = {
      contratoId: contratoId,
      tipoGarantiaId: data.tipoGarantiaId ? parseInt(data.tipoGarantiaId) : null,
      estadoGarantiaId: data.estadoGarantiaId ? parseInt(data.estadoGarantiaId) : null,
      apellido: data.apellido || null,
      nombre: data.nombre || null,
      dni: data.dni || null,
      cuit: data.cuit || null,
      telefono: data.telefono || null,
      mail: data.mail || null,
      direccion: data.direccion || null,
      costoAveriguacion: data.costoAveriguacion ? parseFloat(data.costoAveriguacion) : null
    };

    const garantia = await prisma.contratoGarantia.create({
      data: garantiaData,
      include: {
        tipoGarantia: true,
        estadoGarantia: true
      }
    });

    console.log(`[addGarantia] Garantía creada con ID: ${garantia.id}, costoAveriguacion: ${garantia.costoAveriguacion}`);

    // Actualizar el gasto inicial de averiguación de garantías
    console.log(`[addGarantia] Llamando a actualizarGastoAveriguacionGarantias para contratoId: ${contratoId}`);
    await actualizarGastoAveriguacionGarantias(contratoId);
    console.log(`[addGarantia] actualizarGastoAveriguacionGarantias completado`);

    res.status(201).json(garantia);
  } catch (error) {
    console.error('Error al crear garantía:', error);
    res.status(500).json({ error: 'Error al crear garantía', details: error.message });
  }
};

export const updateGarantia = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const garantiaId = parseInt(id);
    if (isNaN(garantiaId)) {
      return res.status(400).json({ error: 'ID de garantía inválido' });
    }

    const garantia = await prisma.contratoGarantia.findUnique({
      where: { id: garantiaId }
    });

    if (!garantia) {
      return res.status(404).json({ error: 'Garantía no encontrada' });
    }

    // Preparar datos asegurando que los IDs sean números y el costo sea decimal
    const updateData = {};
    if (data.tipoGarantiaId !== undefined) {
      updateData.tipoGarantiaId = data.tipoGarantiaId ? parseInt(data.tipoGarantiaId) : null;
    }
    if (data.estadoGarantiaId !== undefined) {
      updateData.estadoGarantiaId = data.estadoGarantiaId ? parseInt(data.estadoGarantiaId) : null;
    }
    if (data.apellido !== undefined) updateData.apellido = data.apellido || null;
    if (data.nombre !== undefined) updateData.nombre = data.nombre || null;
    if (data.dni !== undefined) updateData.dni = data.dni || null;
    if (data.cuit !== undefined) updateData.cuit = data.cuit || null;
    if (data.telefono !== undefined) updateData.telefono = data.telefono || null;
    if (data.mail !== undefined) updateData.mail = data.mail || null;
    if (data.direccion !== undefined) updateData.direccion = data.direccion || null;
    if (data.costoAveriguacion !== undefined) {
      updateData.costoAveriguacion = data.costoAveriguacion ? parseFloat(data.costoAveriguacion) : null;
    }

    const updated = await prisma.contratoGarantia.update({
      where: { id: garantiaId },
      data: updateData,
      include: {
        tipoGarantia: true,
        estadoGarantia: true
      }
    });

    // Actualizar el gasto inicial de averiguación de garantías
    await actualizarGastoAveriguacionGarantias(updated.contratoId);

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar garantía:', error);
    res.status(500).json({ error: 'Error al actualizar garantía', details: error.message });
  }
};

export const deleteGarantia = async (req, res) => {
  try {
    const { id } = req.params;

    const garantiaId = parseInt(id);
    if (isNaN(garantiaId)) {
      return res.status(400).json({ error: 'ID de garantía inválido' });
    }

    // Obtener la garantía antes de eliminarla para tener el contratoId
    const garantia = await prisma.contratoGarantia.findUnique({
      where: { id: garantiaId },
      select: { contratoId: true }
    });

    if (!garantia) {
      return res.status(404).json({ error: 'Garantía no encontrada' });
    }

    await prisma.contratoGarantia.delete({
      where: { id: garantiaId }
    });

    // Actualizar el gasto inicial de averiguación de garantías
    await actualizarGastoAveriguacionGarantias(garantia.contratoId);

    res.json({ message: 'Garantía eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar garantía:', error);
    res.status(500).json({ error: 'Error al eliminar garantía' });
  }
};

// Gastos iniciales
export const addGastoInicial = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const contrato = await prisma.contrato.findFirst({
      where: { id: parseInt(id), deletedAt: null, activo: true }
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Validar que tipoGastoInicialId esté presente
    if (!data.tipoGastoInicialId) {
      return res.status(400).json({ error: 'tipoGastoInicialId es requerido' });
    }

    // Validar que quienPagaId esté presente o usar un valor por defecto
    let quienPagaId = data.quienPagaId ? parseInt(data.quienPagaId) : null;
    
    if (!quienPagaId) {
      // Buscar un valor por defecto (por ejemplo, "INQUILINO" o el primer actor disponible)
      const actorDefault = await prisma.actorResponsableContrato.findFirst({
        where: { 
          activo: true,
          deletedAt: null,
          codigo: 'INQ' // O el código que corresponda
        }
      });
      
      if (!actorDefault) {
        // Si no existe "INQ", buscar cualquier actor activo
        const actorCualquiera = await prisma.actorResponsableContrato.findFirst({
          where: { 
            activo: true,
            deletedAt: null
          }
        });
        
        if (!actorCualquiera) {
          return res.status(400).json({ error: 'quienPagaId es requerido y no se encontró un valor por defecto' });
        }
        
        quienPagaId = actorCualquiera.id;
      } else {
        quienPagaId = actorDefault.id;
      }
    }

    const gasto = await prisma.contratoGastoInicial.create({
      data: {
        contratoId: parseInt(id),
        tipoGastoInicialId: parseInt(data.tipoGastoInicialId),
        quienPagaId: quienPagaId,
        importe: parseFloat(data.importe),
        valorCalculo: data.valorCalculo ? parseFloat(data.valorCalculo) : null
      }
    });

    res.status(201).json(gasto);
  } catch (error) {
    console.error('Error al crear gasto inicial:', error);
    res.status(500).json({ error: 'Error al crear gasto inicial' });
  }
};

export const updateGastoInicial = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Convertir id a entero
    const gastoId = parseInt(id);
    if (isNaN(gastoId)) {
      return res.status(400).json({ error: 'ID de gasto inicial inválido' });
    }

    const gasto = await prisma.contratoGastoInicial.findUnique({
      where: { id: gastoId }
    });

    if (!gasto) {
      return res.status(404).json({ error: 'Gasto inicial no encontrado' });
    }

    const updateData = {};
    if (data.tipoGastoInicialId !== undefined) {
      updateData.tipoGastoInicialId = parseInt(data.tipoGastoInicialId);
    }
    // Si se envía quienPagaId, actualizarlo (incluso si es null)
    if (data.quienPagaId !== undefined) {
      updateData.quienPagaId = data.quienPagaId !== null && data.quienPagaId !== '' 
        ? parseInt(data.quienPagaId) 
        : null;
    }
    if (data.importe !== undefined) {
      updateData.importe = parseFloat(data.importe);
    }
    if (data.valorCalculo !== undefined) {
      updateData.valorCalculo = data.valorCalculo !== null && data.valorCalculo !== '' ? parseFloat(data.valorCalculo) : null;
    }

    // Validar que hay datos para actualizar
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    const updated = await prisma.contratoGastoInicial.update({
      where: { id: gastoId },
      data: updateData
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar gasto inicial:', error);
    res.status(500).json({ 
      error: 'Error al actualizar gasto inicial', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
};

export const deleteGastoInicial = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.contratoGastoInicial.delete({
      where: { id }
    });

    res.json({ message: 'Gasto inicial eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar gasto inicial:', error);
    res.status(500).json({ error: 'Error al eliminar gasto inicial' });
  }
};

