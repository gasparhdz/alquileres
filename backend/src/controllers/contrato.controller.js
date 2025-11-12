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
async function determinarEstadoPropiedad(unidadId) {
  try {
    // Obtener todos los contratos no eliminados de la propiedad
    const contratos = await prisma.contrato.findMany({
      where: {
        unidadId: unidadId,
        isDeleted: false
      },
      select: {
        estado: true,
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
    const estadosAlquilada = ['vigente', 'prorrogado', 'renovado', 'suspendido', 'en_mora'];
    
    // Estados que hacen que la propiedad esté no disponible (pero no alquilada aún)
    const estadosNoDisponible = ['borrador', 'pendiente_de_firma'];
    
    // Estados que hacen que la propiedad esté disponible (contrato finalizado)
    const estadosDisponible = ['vencido', 'rescindido', 'anulado', 'finalizado'];

    // Prioridad 1: Si hay algún contrato que haga que la propiedad esté alquilada
    const tieneContratoAlquilada = contratos.some(c => estadosAlquilada.includes(c.estado));
    if (tieneContratoAlquilada) {
      return 'alquilada';
    }

    // Prioridad 2: Si hay algún contrato que haga que la propiedad esté no disponible
    const tieneContratoNoDisponible = contratos.some(c => estadosNoDisponible.includes(c.estado));
    if (tieneContratoNoDisponible) {
      return 'no_disponible';
    }

    // Prioridad 3: Si todos los contratos están en estados que liberan la propiedad
    const todosDisponibles = contratos.every(c => estadosDisponible.includes(c.estado));
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
async function actualizarEstadoPropiedad(unidadId) {
  try {
    const nuevoEstado = await determinarEstadoPropiedad(unidadId);
    
    if (nuevoEstado) {
      await prisma.unidad.update({
        where: { id: unidadId },
        data: { estado: nuevoEstado }
      });
      console.log(`Estado de propiedad ${unidadId} actualizado a: ${nuevoEstado}`);
    }
  } catch (error) {
    console.error('Error al actualizar estado de propiedad:', error);
    // No lanzar el error para no interrumpir la operación principal
  }
}

// Contratos principales
export const getAllContratos = async (req, res) => {
  try {
    const { search, unidadId, inquilinoId, activo, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const now = new Date();

    const where = {
      isDeleted: false,
      ...(unidadId && { unidadId }),
      ...(inquilinoId && { inquilinoId }),
      ...(activo === 'true' && {
        OR: [
          { fechaFin: null },
          { fechaFin: { gte: now } }
        ]
      }),
      ...(search && {
        OR: [
          { nroContrato: { contains: search, mode: 'insensitive' } },
          { unidad: { direccion: { contains: search, mode: 'insensitive' } } },
          { inquilino: { nombre: { contains: search, mode: 'insensitive' } } },
          { inquilino: { apellido: { contains: search, mode: 'insensitive' } } }
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
          unidad: {
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
          },
          inquilino: true
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
    res.status(500).json({ error: 'Error al obtener contratos' });
  }
};

export const getContratoById = async (req, res) => {
  try {
    const { id } = req.params;

    const contrato = await prisma.contrato.findUnique({
      where: { id },
      include: {
        unidad: {
          include: {
            propietario: true,
            cuentas: true
          }
        },
        inquilino: true,
        responsabilidades: true,
        garantias: true,
        gastosIniciales: true,
        ajustes: {
          orderBy: { fechaAjuste: 'desc' }
        },
        liquidaciones: {
          orderBy: { periodo: 'desc' },
          include: {
            items: true
          }
        },
        prorrogaDe: true,
        renovadoPor: true,
        renovacionDe: true
      }
    });

    if (!contrato || contrato.isDeleted) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Filtrar cuentas eliminadas manualmente
    if (contrato.unidad && contrato.unidad.cuentas) {
      contrato.unidad.cuentas = contrato.unidad.cuentas.filter(cuenta => !cuenta.isDeleted);
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

    if (!data.unidadId || !data.inquilinoId || !data.fechaInicio || !data.montoInicial) {
      return res.status(400).json({ error: 'Unidad, inquilino, fecha de inicio y monto inicial son requeridos' });
    }

    // Verificar que la unidad y el inquilino existen
    const [unidad, inquilino] = await Promise.all([
      prisma.unidad.findUnique({ where: { id: data.unidadId } }),
      prisma.inquilino.findUnique({ where: { id: data.inquilinoId } })
    ]);

    if (!unidad || unidad.isDeleted) {
      return res.status(404).json({ error: 'Unidad no encontrada' });
    }
    if (!inquilino || inquilino.isDeleted) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }

    // Generar número de contrato consecutivo si no se proporciona
    let nroContrato = data.nroContrato;
    if (!nroContrato || nroContrato.trim() === '') {
      const añoActual = new Date().getFullYear();
      const prefijo = `CONT-${añoActual}-`;
      
      // Buscar todos los contratos del año actual con el formato CONT-YYYY-NNNN
      const contratosAñoActual = await prisma.contrato.findMany({
        where: {
          nroContrato: {
            startsWith: prefijo
          },
          isDeleted: false
        },
        select: {
          nroContrato: true
        }
      });

      // Encontrar el número más alto
      let siguienteNumero = 1;
      if (contratosAñoActual.length > 0) {
        const numeros = contratosAñoActual
          .map(c => {
            const partes = c.nroContrato.split('-');
            if (partes.length === 3 && partes[2]) {
              return parseInt(partes[2], 10);
            }
            return 0;
          })
          .filter(n => !isNaN(n) && n > 0);
        
        if (numeros.length > 0) {
          siguienteNumero = Math.max(...numeros) + 1;
        }
      }

      // Formato: CONT-YYYY-NNNN
      nroContrato = `${prefijo}${siguienteNumero.toString().padStart(4, '0')}`;
    }

    // Construir objeto de datos explícitamente para evitar campos no deseados
    const contratoData = {
        unidadId: data.unidadId,
        inquilinoId: data.inquilinoId,
        nroContrato: nroContrato,
        fechaInicio: data.fechaInicio ? new Date(data.fechaInicio) : new Date(),
        fechaFin: data.fechaFin ? new Date(data.fechaFin) : null,
        duracionMeses: data.duracionMeses ? parseInt(data.duracionMeses, 10) : null,
        montoInicial: parseFloat(data.montoInicial),
        montoActual: data.montoActual ? parseFloat(data.montoActual) : parseFloat(data.montoInicial),
        ultimoAjusteAt: data.ultimoAjusteAt ? new Date(data.ultimoAjusteAt) : null,
        indiceAumento: data.indiceAumento || null,
        periodoAumento: data.periodoAumento ? parseInt(data.periodoAumento, 10) : null,
        gastosAdministrativos: data.gastosAdministrativos ? parseFloat(data.gastosAdministrativos) : null,
        honorariosPropietario: data.honorariosPropietario ? parseFloat(data.honorariosPropietario) : null,
        metodoAjuste: data.metodoAjuste || null,
        frecuenciaAjusteMeses: data.frecuenciaAjusteMeses ? parseInt(data.frecuenciaAjusteMeses, 10) : null,
        registradoAfip: data.registradoAfip !== undefined ? Boolean(data.registradoAfip) : false,
        moneda: data.moneda || 'ARS',
        estado: data.estado || 'borrador'
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
      data: contratoData,
      include: {
        unidad: {
          include: { propietario: true }
        },
        inquilino: true
      }
    });

    // Actualizar el estado de la propiedad basándose en los contratos
    await actualizarEstadoPropiedad(data.unidadId);

    res.status(201).json(contrato);
  } catch (error) {
    console.error('Error al crear contrato:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un contrato con estos datos' });
    }

    res.status(500).json({ error: 'Error al crear contrato' });
  }
};

export const updateContrato = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Usar findUnique en lugar de findFirst para evitar problemas con campos que no existen
    const contrato = await prisma.contrato.findUnique({
      where: { id }
    });

    if (!contrato || contrato.isDeleted) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Verificar que unidad e inquilino existen si se están actualizando
    if (data.unidadId) {
      const unidad = await prisma.unidad.findUnique({
        where: { id: data.unidadId }
      });
      if (!unidad || unidad.isDeleted) {
        return res.status(400).json({ error: 'Unidad no encontrada' });
      }
    }

    if (data.inquilinoId) {
      const inquilino = await prisma.inquilino.findUnique({
        where: { id: data.inquilinoId }
      });
      if (!inquilino || inquilino.isDeleted) {
        return res.status(400).json({ error: 'Inquilino no encontrado' });
      }
    }

    // Construir objeto de actualización con solo los campos permitidos
    const updateData = {};
    
    // Campos de relación usando connect (Prisma requiere esta sintaxis en update)
    // Solo conectar si el ID es válido (no null, no undefined, no string vacío)
    if (data.unidadId !== undefined && data.unidadId !== null && data.unidadId !== '') {
      updateData.unidad = { connect: { id: data.unidadId } };
    }
    if (data.inquilinoId !== undefined && data.inquilinoId !== null && data.inquilinoId !== '') {
      updateData.inquilino = { connect: { id: data.inquilinoId } };
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
    if (data.registradoAfip !== undefined) updateData.registradoAfip = Boolean(data.registradoAfip);
    if (data.moneda !== undefined) updateData.moneda = data.moneda || null;
    if (data.metodoAjuste !== undefined) updateData.metodoAjuste = data.metodoAjuste || null;
    if (data.indiceAumento !== undefined) updateData.indiceAumento = data.indiceAumento || null;
    
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

    // Obtener el contrato antes de actualizar para conocer la unidadId y el estado anterior
    const contratoAnterior = await prisma.contrato.findUnique({
      where: { id },
      select: { unidadId: true, estado: true }
    });

    const updated = await prisma.contrato.update({
      where: { id },
      data: updateData,
      include: {
        unidad: {
          include: { propietario: true }
        },
        inquilino: true
      }
    });

    // Determinar si se debe actualizar el estado de la propiedad
    const estadoCambio = contratoAnterior?.estado !== updateData.estado;
    const unidadCambio = updateData.unidad?.connect?.id && 
                         contratoAnterior?.unidadId && 
                         updateData.unidad.connect.id !== contratoAnterior.unidadId;

    // Actualizar el estado de la propiedad si:
    // 1. Cambió el estado del contrato, o
    // 2. Cambió la unidad asociada, o
    // 3. Se actualizó cualquier campo que afecte el estado (siempre actualizar por seguridad)
    const unidadIdParaActualizar = updateData.unidad?.connect?.id || contratoAnterior?.unidadId || updated.unidadId;
    if (unidadIdParaActualizar && (estadoCambio || unidadCambio || updateData.estado !== undefined)) {
      await actualizarEstadoPropiedad(unidadIdParaActualizar);
    }

    // Si cambió la unidad, también actualizar el estado de la unidad anterior
    if (unidadCambio && contratoAnterior?.unidadId) {
      await actualizarEstadoPropiedad(contratoAnterior.unidadId);
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

    const contrato = await prisma.contrato.findFirst({
      where: { id, isDeleted: false }
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const responsabilidad = await prisma.contratoResponsabilidad.create({
      data: {
        ...data,
        contratoId: id
      }
    });

    res.status(201).json(responsabilidad);
  } catch (error) {
    console.error('Error al crear responsabilidad:', error);
    res.status(500).json({ error: 'Error al crear responsabilidad' });
  }
};

export const updateResponsabilidad = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const responsabilidad = await prisma.contratoResponsabilidad.findUnique({
      where: { id }
    });

    if (!responsabilidad) {
      return res.status(404).json({ error: 'Responsabilidad no encontrada' });
    }

    const updated = await prisma.contratoResponsabilidad.update({
      where: { id },
      data
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar responsabilidad:', error);
    res.status(500).json({ error: 'Error al actualizar responsabilidad' });
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

// Garantías
export const addGarantia = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const contrato = await prisma.contrato.findFirst({
      where: { id, isDeleted: false }
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const garantia = await prisma.garantia.create({
      data: {
        ...data,
        contratoId: id
      }
    });

    res.status(201).json(garantia);
  } catch (error) {
    console.error('Error al crear garantía:', error);
    res.status(500).json({ error: 'Error al crear garantía' });
  }
};

export const updateGarantia = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const garantia = await prisma.garantia.findUnique({
      where: { id }
    });

    if (!garantia) {
      return res.status(404).json({ error: 'Garantía no encontrada' });
    }

    const updated = await prisma.garantia.update({
      where: { id },
      data
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar garantía:', error);
    res.status(500).json({ error: 'Error al actualizar garantía' });
  }
};

export const deleteGarantia = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.garantia.delete({
      where: { id }
    });

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
      where: { id, isDeleted: false }
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const gasto = await prisma.contratoGastoInicial.create({
      data: {
        ...data,
        contratoId: id,
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

    const gasto = await prisma.contratoGastoInicial.findUnique({
      where: { id }
    });

    if (!gasto) {
      return res.status(404).json({ error: 'Gasto inicial no encontrado' });
    }

    const updated = await prisma.contratoGastoInicial.update({
      where: { id },
      data: {
        ...data,
        importe: data.importe ? parseFloat(data.importe) : undefined,
        valorCalculo: data.valorCalculo !== undefined 
          ? (data.valorCalculo !== null && data.valorCalculo !== '' ? parseFloat(data.valorCalculo) : null)
          : undefined
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar gasto inicial:', error);
    res.status(500).json({ error: 'Error al actualizar gasto inicial' });
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

