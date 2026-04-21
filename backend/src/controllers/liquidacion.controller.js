import { Prisma } from '@prisma/client';
import puppeteer from 'puppeteer';
import prisma from '../db/prisma.js';
import { getIds } from '../services/parametrosSistema.js';
import { registrarDebitoInquilino, generarLiquidacionPropietario, generarLiquidacionPropietarioSinContrato } from '../services/cuentaCorriente.service.js';
import {
  rowToCamel,
  calcularVencimientosAutomaticos,
  correspondeGenerarPorPeriodicidad,
  importeEnBoleta,
  mesesConAjusteDebido,
  buildUpdateDataForItem,
  completarItem as completarItemService,
  reabrirItem as reabrirItemService
} from '../services/liquidacion.service.js';

const includeUltimasLiquidaciones = {
  contrato: {
    include: {
      propiedad: { include: { localidad: true, provincia: true } },
      inquilino: true
    }
  },
  propiedad: { include: { localidad: true, provincia: true } },
  estado: true,
  items: {
    where: { activo: true },
    include: {
      tipoCargo: true,
      quienSoportaCosto: true,
      pagadoPorActor: true
    }
  }
};

/** Include para listado de liquidaciones (getAllLiquidaciones). */
const includeAllLiquidaciones = {
  estado: true,
  propiedad: {
    include: {
      localidad: true,
      provincia: true
    }
  },
  contrato: {
    include: {
      inquilino: true,
      propiedad: {
        include: { localidad: true, provincia: true }
      }
    }
  },
  items: {
    where: { activo: true, deletedAt: null },
    orderBy: { id: 'asc' },
    include: {
      tipoCargo: true,
      quienSoportaCosto: true,
      pagadoPorActor: true
    }
  }
};

/** Include para detalle de una liquidación (getLiquidacionById). */
const includeLiquidacionById = {
  estado: true,
  propiedad: {
    include: {
      localidad: true,
      provincia: true,
      propietarios: {
        where: { activo: true, deletedAt: null },
        include: {
          propietario: { include: { condicionIva: true } }
        }
      }
    }
  },
  contrato: {
    include: {
      inquilino: { include: { condicionIva: true } },
      propiedad: {
        include: {
          localidad: true,
          provincia: true,
          propietarios: {
            where: { activo: true, deletedAt: null },
            include: { propietario: true }
          }
        }
      },
      responsabilidades: {
        where: { activo: true, deletedAt: null }
      }
    }
  },
  items: {
    where: { activo: true, deletedAt: null },
    orderBy: { id: 'asc' },
    include: {
      propiedadImpuesto: { include: { tipoImpuesto: true } },
      tipoCargo: true,
      tipoExpensa: true,
      actorFacturado: true,
      quienSoportaCosto: true,
      pagadoPorActor: true,
      contratoGastoInicial: { include: { tipoGastoInicial: true } }
    }
  }
};

/** Include para items de impuestos pendientes (getImpuestosPendientes). */
const includeImpuestosPendientesItems = {
  liquidacion: {
    include: {
      propiedad: {
        include: { localidad: true, provincia: true }
      },
      contrato: {
        include: { inquilino: true }
      }
    }
  },
  propiedadImpuesto: {
    include: {
      tipoImpuesto: true,
      campos: { include: { tipoCampo: true } }
    }
  },
  tipoCargo: true,
  tipoExpensa: true,
  actorFacturado: true,
  quienSoportaCosto: true,
  pagadoPorActor: true,
  estadoItem: true
};

/**
 * GET /liquidaciones/cliente/:id?rol=inquilino|propietario
 * Devuelve las últimas 5 liquidaciones del cliente (inquilino por contrato, propietario por propiedades).
 */
export const getUltimasLiquidacionesPorCliente = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const rol = (req.query.rol || '').toLowerCase();

    if (isNaN(id) || !['inquilino', 'propietario'].includes(rol)) {
      return res.status(400).json({
        error: 'Parámetros inválidos: id numérico y rol=inquilino|propietario requeridos'
      });
    }

    let liquidaciones;

    if (rol === 'inquilino') {
      liquidaciones = await prisma.liquidacion.findMany({
        where: {
          contrato: { inquilinoId: id },
          activo: true,
          deletedAt: null
        },
        include: includeUltimasLiquidaciones,
        orderBy: { id: 'desc' },
        take: 5
      });
    } else {
      const relaciones = await prisma.propiedadPropietario.findMany({
        where: { propietarioId: id },
        select: { propiedadId: true }
      });
      const propiedadIds = relaciones.map((r) => r.propiedadId);
      if (propiedadIds.length === 0) {
        return res.json([]);
      }
      liquidaciones = await prisma.liquidacion.findMany({
        where: {
          propiedadId: { in: propiedadIds },
          activo: true,
          deletedAt: null
        },
        include: includeUltimasLiquidaciones,
        orderBy: { id: 'desc' },
        take: 5
      });
    }

    return res.json(liquidaciones);
  } catch (err) {
    console.error('getUltimasLiquidacionesPorCliente:', err);
    return res.status(500).json({ error: err.message || 'Error al obtener liquidaciones del cliente' });
  }
};

/**
 * GET /liquidaciones
 * Lista liquidaciones con paginación server-side. Params: page, limit, search, periodo, estado, sortBy, sortOrder.
 */
export const getAllLiquidaciones = async (req, res) => {
  try {
    const { contratoId, propiedadId, periodo, estado, page = 1, limit = 50, search, sortBy = 'periodo', sortOrder = 'desc' } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
    const skip = (pageNum - 1) * limitNum;

    const where = {
      deletedAt: null,
      activo: true
    };
    if (contratoId) where.contratoId = parseInt(contratoId, 10);
    if (propiedadId) where.propiedadId = parseInt(propiedadId, 10);
    if (periodo) where.periodo = periodo;
    if (estado) where.estadoLiquidacionId = parseInt(estado, 10);

    const searchTrim = typeof search === 'string' ? search.trim() : '';
    if (searchTrim) {
      where.OR = [
        { propiedad: { dirCalle: { contains: searchTrim, mode: 'insensitive' } } },
        { propiedad: { dirNro: { contains: searchTrim, mode: 'insensitive' } } },
        { contrato: { inquilino: { nombre: { contains: searchTrim, mode: 'insensitive' } } } },
        { contrato: { inquilino: { apellido: { contains: searchTrim, mode: 'insensitive' } } } },
        { contrato: { inquilino: { razonSocial: { contains: searchTrim, mode: 'insensitive' } } } }
      ];
    }

    const orderField = ['periodo', 'numeracion', 'id'].includes(sortBy) ? sortBy : 'periodo';
    const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy = { [orderField]: orderDir };

    const [liquidaciones, total] = await Promise.all([
      prisma.liquidacion.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        include: includeAllLiquidaciones
      }),
      prisma.liquidacion.count({ where })
    ]);

    if (liquidaciones.length === 0) {
      return res.json({
        data: [],
        meta: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 }
      });
    }

    // Serializar Decimal y recalcular totales si difieren
    const data = liquidaciones.map((liq) => {
      const totalNum = liq.total != null ? Number(liq.total) : 0;
      const items = (liq.items || []).map((item) => ({
        ...item,
        importe: item.importe != null ? Number(item.importe) : null,
        importeAnterior: item.importeAnterior != null ? Number(item.importeAnterior) : null
      }));
      const totalCalculado = items.reduce((sum, item) => sum + (item.importe || 0), 0);
      const tieneItemsConImporte = items.some((item) => item.importe != null && item.importe !== 0);
      let totalFinal = totalNum;
      if (tieneItemsConImporte && Math.abs(totalNum - totalCalculado) > 0.01) {
        totalFinal = totalCalculado;
        prisma.liquidacion.update({
          where: { id: liq.id },
          data: { total: totalCalculado }
        }).catch((err) => console.error('Error actualizando total liquidación', liq.id, err));
      }
      return {
        ...liq,
        total: totalFinal,
        items,
        propiedad: liq.propiedad || null,
        contrato: liq.contrato ? {
          id: liq.contrato.id,
          honorariosPropietario: liq.contrato.honorariosPropietario != null ? Number(liq.contrato.honorariosPropietario) : null,
          inquilino: liq.contrato.inquilino || null,
          propiedad: liq.contrato.propiedad || null
        } : null
      };
    });

    const totalPages = Math.ceil(total / limitNum);
    res.json({
      data,
      meta: { total, page: pageNum, limit: limitNum, totalPages }
    });
  } catch (error) {
    console.error('Error al obtener liquidaciones:', error);
    res.status(500).json({ error: 'Error al obtener liquidaciones' });
  }
};

/**
 * GET /liquidaciones/:id
 * Obtiene una liquidación por ID con toda su jerarquía. Usa Prisma findUnique + include.
 */
export const getLiquidacionById = async (req, res) => {
  try {
    const { id } = req.params;
    const liquidacionId = parseInt(id, 10);

    if (isNaN(liquidacionId)) {
      return res.status(400).json({ error: 'ID de liquidación inválido' });
    }

    const liquidacion = await prisma.liquidacion.findUnique({
      where: {
        id: liquidacionId,
        deletedAt: null
      },
      include: includeLiquidacionById
    });

    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    // DTO: mismo formato que el código anterior (camelCase, contrato.propiedad.propietarios como array de { propietario })
    const contrato = liquidacion.contrato ? {
      ...liquidacion.contrato,
      inquilino: liquidacion.contrato.inquilino || null,
      propiedad: liquidacion.contrato.propiedad ? {
        ...liquidacion.contrato.propiedad,
        localidad: liquidacion.contrato.propiedad.localidad || null,
        provincia: liquidacion.contrato.propiedad.provincia || null,
        propietarios: (liquidacion.contrato.propiedad.propietarios || []).map((pp) => ({ propietario: pp.propietario || null }))
      } : null,
      responsabilidades: liquidacion.contrato.responsabilidades || []
    } : null;

    const propiedad = liquidacion.propiedad ? {
      ...liquidacion.propiedad,
      localidad: liquidacion.propiedad.localidad || null,
      provincia: liquidacion.propiedad.provincia || null,
      propietarios: (liquidacion.propiedad.propietarios || []).map((pp) => ({
        propietario: pp.propietario ? { ...pp.propietario, condicionIva: pp.propietario.condicionIva || null } : null
      }))
    } : null;

    const items = (liquidacion.items || []).map((item) => ({
      ...item,
      importe: item.importe != null ? Number(item.importe) : null,
      importeAnterior: item.importeAnterior != null ? Number(item.importeAnterior) : null,
      propiedadImpuesto: item.propiedadImpuesto ? {
        ...item.propiedadImpuesto,
        tipoImpuesto: item.propiedadImpuesto.tipoImpuesto || null
      } : null,
      tipoCargo: item.tipoCargo || null,
      tipoExpensa: item.tipoExpensa || null,
      actorFacturado: item.actorFacturado || null,
      quienSoportaCosto: item.quienSoportaCosto || null,
      pagadoPorActor: item.pagadoPorActor || null,
      contratoGastoInicial: item.contratoGastoInicial ? {
        id: item.contratoGastoInicial.id,
        tipoGastoInicial: item.contratoGastoInicial.tipoGastoInicial || null
      } : null
    }));

    res.json({
      ...liquidacion,
      total: liquidacion.total != null ? Number(liquidacion.total) : liquidacion.total,
      estado: liquidacion.estado || null,
      propiedad,
      contrato,
      items
    });
  } catch (error) {
    console.error('Error al obtener liquidación:', error);
    res.status(500).json({ error: 'Error al obtener liquidación' });
  }
};

export const generateLiquidacion = async (req, res) => {
  try {
    const { contratoId, periodo } = req.body;

    if (!contratoId || !periodo) {
      return res.status(400).json({ error: 'Contrato y período son requeridos' });
    }

    // Verificar que no exista ya una liquidación para ese contrato y período
    const existing = await prisma.liquidacion.findUnique({
      where: {
        contratoId_periodo: {
          contratoId,
          periodo
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Ya existe una liquidación para este contrato y período' });
    }

    // Obtener contrato con todas sus relaciones
    const contrato = await prisma.contrato.findFirst({
      where: { id: contratoId, isDeleted: false },
      include: {
        unidad: {
          include: {
            cuentas: {
              where: { isDeleted: false }
            }
          }
        },
        responsabilidades: true
      }
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Verificar que el período esté dentro de las fechas del contrato
    const periodoDate = new Date(periodo + '-01');
    if (periodoDate < new Date(contrato.fechaInicio)) {
      return res.status(400).json({ error: 'El período es anterior a la fecha de inicio del contrato' });
    }

    if (contrato.fechaFin && periodoDate > contrato.fechaFin) {
      return res.status(400).json({ error: 'El período es posterior a la fecha de fin del contrato' });
    }

    // Usar monto actual (post ajustes); si no hay, monto inicial
    const montoAlquiler = parseFloat(contrato.montoActual ?? contrato.montoInicial ?? 0);

    // Generar items basados en responsabilidades
    const items = [];
    let orden = 1;

    // Alquiler base
    const alquilerResp = contrato.responsabilidades.find(r => r.tipoCargo === 'alquiler');
    if (alquilerResp) {
      items.push({
        tipoCargo: 'alquiler',
        importe: montoAlquiler,
        quienPaga: alquilerResp.quienPaga,
        fuente: 'automatico',
        orden: orden++,
        observaciones: 'Alquiler base'
      });
    }

    // Otros conceptos según responsabilidades y cuentas tributarias
    for (const resp of contrato.responsabilidades) {
      if (resp.tipoCargo !== 'alquiler') {
        const cuenta = contrato.unidad.cuentas.find(c => c.tipoImpuesto === resp.tipoCargo);
        if (cuenta) {
          items.push({
            tipoCargo: resp.tipoCargo,
            cuentaTributariaId: cuenta.id,
            importe: 0, // Se debe completar manualmente
            quienPaga: resp.quienPaga,
            fuente: 'automatico',
            orden: orden++,
            observaciones: `Pendiente de carga`
          });
        }
      }
    }

    // Calcular total
    const total = items.reduce((sum, item) => sum + parseFloat(item.importe || 0), 0);

    // Calcular vencimientos automáticos
    const vencimientosAuto = calcularVencimientosAutomaticos(periodo);

    // Crear liquidación
    const liquidacion = await prisma.liquidacion.create({
      data: {
        contratoId,
        propiedadId: contrato.propiedadId,
        periodo,
        estadoLiquidacionId: 1, // Estado borrador por defecto
        total,
        vencimiento: vencimientosAuto.vencimiento,
        vencimiento2: vencimientosAuto.vencimiento2,
        interes2: vencimientosAuto.interes2,
        vencimiento3: vencimientosAuto.vencimiento3,
        interes3: vencimientosAuto.interes3,
        items: {
          create: items
        }
      },
      include: {
        items: {
          orderBy: { id: 'asc' }
        }
      }
    });

    res.status(201).json(liquidacion);
  } catch (error) {
    console.error('Error al generar liquidación:', error);
    res.status(500).json({ error: 'Error al generar liquidación' });
  }
};

export const createLiquidacion = async (req, res) => {
  try {
    const { contratoId, propiedadId, periodo, items, vencimiento, observaciones, estadoLiquidacionId } = req.body;

    // Validaciones básicas
    if (!propiedadId || !periodo) {
      return res.status(400).json({ error: 'Propiedad y período son requeridos' });
    }
    
    // contratoId es opcional, pero si se proporciona, debe ser válido
    if (contratoId) {
      const contrato = await prisma.contrato.findUnique({
        where: { id: contratoId }
      });
      if (!contrato) {
        return res.status(400).json({ error: 'Contrato no encontrado' });
      }
    }

    // Validar formato de período (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      return res.status(400).json({ error: 'El período debe tener el formato YYYY-MM' });
    }

    // Validar items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos un item en la liquidación' });
    }

    // Validar cada item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.tipoCargo) {
        return res.status(400).json({ error: `El item ${i + 1} debe tener un tipo de cargo` });
      }
      if (!item.quienPaga) {
        return res.status(400).json({ error: `El item ${i + 1} debe especificar quién paga` });
      }
      const importe = parseFloat(item.importe);
      if (isNaN(importe) || importe < 0) {
        return res.status(400).json({ error: `El item ${i + 1} debe tener un importe válido` });
      }
    }

    // Calcular total
    const total = items.reduce((sum, item) => {
      const importe = parseFloat(item.importe || 0);
      return sum + (isNaN(importe) ? 0 : importe);
    }, 0);

    // Preparar datos de items
    const itemsData = items.map((item, index) => ({
      tipoCargo: item.tipoCargo,
      cuentaTributariaId: item.cuentaTributariaId || null,
      periodoRef: item.periodoRef || null,
      importe: parseFloat(item.importe),
      quienPaga: item.quienPaga,
      fuente: item.fuente || 'manual',
      refExterna: item.refExterna || null,
      observaciones: item.observaciones || null,
      orden: item.orden !== undefined ? parseInt(item.orden) : index
    }));

    // Calcular vencimientos automáticos si no se proporcionan
    const vencimientosAuto = calcularVencimientosAutomaticos(periodo);
    
    // Crear liquidación
    const liquidacion = await prisma.liquidacion.create({
      data: {
        contratoId,
        propiedadId,
        periodo,
        total,
        estadoLiquidacionId: estadoLiquidacionId || 1, // Estado por defecto (borrador)
        vencimiento: vencimiento ? new Date(vencimiento) : vencimientosAuto.vencimiento,
        vencimiento2: vencimientosAuto.vencimiento2,
        interes2: vencimientosAuto.interes2,
        vencimiento3: vencimientosAuto.vencimiento3,
        interes3: vencimientosAuto.interes3,
        observaciones: observaciones || null,
        items: {
          create: itemsData
        }
      },
      include: {
        items: {
          orderBy: { id: 'asc' }
        }
      }
    });

    res.status(201).json(liquidacion);
  } catch (error) {
    console.error('Error al crear liquidación:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una liquidación para este contrato y período' });
    }

    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Referencia inválida: el contrato o unidad no existe' });
    }

    res.status(500).json({ 
      error: 'Error al crear liquidación',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const updateLiquidacion = async (req, res) => {
  try {
    const idNum = parseInt(req.params.id, 10);
    const { items, ...data } = req.body;

    const liqRows = await prisma.$queryRaw(Prisma.sql`SELECT * FROM liquidaciones WHERE id = ${idNum} AND deleted_at IS NULL`);
    const liquidacion = Array.isArray(liqRows) ? liqRows[0] : liqRows;
    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    const ids = await getIds();
    if (ids.estadoLiquidacionEmitidaId && liquidacion.estado_liquidacion_id === ids.estadoLiquidacionEmitidaId) {
      return res.status(400).json({ error: 'No se puede modificar una liquidación ya emitida' });
    }

    // Actualizar items si vienen
    if (items && Array.isArray(items)) {
      const ids = await getIds();
      await prisma.liquidacionItem.deleteMany({
        where: { liquidacionId: idNum }
      });
      const importeNum = (i) => (i != null && i !== '' ? parseFloat(i) : 0);
      await prisma.liquidacionItem.createMany({
        data: items.map((item) => ({
          liquidacionId: idNum,
          estadoItemId: item.estadoItemId ?? ids.estadoItemCompletadoId,
          propiedadImpuestoId: item.propiedadImpuestoId != null && item.propiedadImpuestoId !== '' ? parseInt(item.propiedadImpuestoId, 10) : null,
          tipoCargoId: item.tipoCargoId != null && item.tipoCargoId !== '' ? parseInt(item.tipoCargoId, 10) : null,
          tipoExpensaId: item.tipoExpensaId != null && item.tipoExpensaId !== '' ? parseInt(item.tipoExpensaId, 10) : null,
          contratoGastoInicialId: item.contratoGastoInicialId != null && item.contratoGastoInicialId !== '' ? parseInt(item.contratoGastoInicialId, 10) : null,
          actorFacturadoId: item.actorFacturadoId != null && item.actorFacturadoId !== '' ? parseInt(item.actorFacturadoId, 10) : null,
          quienSoportaCostoId: item.quienSoportaCostoId != null && item.quienSoportaCostoId !== '' ? parseInt(item.quienSoportaCostoId, 10) : null,
          pagadoPorActorId: item.pagadoPorActorId != null && item.pagadoPorActorId !== '' ? parseInt(item.pagadoPorActorId, 10) : null,
          importe: importeNum(item.importe),
          observaciones: item.observaciones || null
        }))
      });
    }

    // Calcular nuevo total (raw evita P2022)
    const allItemsRows = await prisma.$queryRaw(Prisma.sql`SELECT importe FROM liquidacion_items WHERE liquidacion_id = ${idNum} AND activo = true AND deleted_at IS NULL`);
    const allItemsList = Array.isArray(allItemsRows) ? allItemsRows : [allItemsRows].filter(Boolean);
    const total = allItemsList.reduce((sum, item) => sum + parseFloat(item.importe || 0), 0);

    // Preparar datos de actualización con manejo correcto de fechas
    const updateData = { ...data, total };
    
    // Procesar estado como entero
    if (data.estadoLiquidacionId !== undefined) {
      updateData.estadoLiquidacionId = data.estadoLiquidacionId ? parseInt(data.estadoLiquidacionId, 10) : null;
    }

    // Procesar vencimientos como fechas
    if (data.vencimiento !== undefined) {
      updateData.vencimiento = data.vencimiento ? new Date(data.vencimiento) : null;
    }
    if (data.vencimiento2 !== undefined) {
      updateData.vencimiento2 = data.vencimiento2 ? new Date(data.vencimiento2) : null;
    }
    if (data.vencimiento3 !== undefined) {
      updateData.vencimiento3 = data.vencimiento3 ? new Date(data.vencimiento3) : null;
    }
    // Procesar intereses como decimales
    if (data.interes2 !== undefined) {
      updateData.interes2 = data.interes2 !== null && data.interes2 !== '' ? parseFloat(data.interes2) : null;
    }
    if (data.interes3 !== undefined) {
      updateData.interes3 = data.interes3 !== null && data.interes3 !== '' ? parseFloat(data.interes3) : null;
    }

    // Validar: no permitir pasar a "Lista para emitir" si hay ítems incompletos (pendientes de importe)
    if (ids.estadoLiquidacionListaId && updateData.estadoLiquidacionId === ids.estadoLiquidacionListaId) {
      const itemsRows = await prisma.$queryRaw(Prisma.sql`
        SELECT id, estado_item_id, importe FROM liquidacion_items WHERE liquidacion_id = ${idNum} AND activo = true AND deleted_at IS NULL
      `);
      const itemsList = Array.isArray(itemsRows) ? itemsRows : [itemsRows].filter(Boolean);
      const pendientes = itemsList.filter(
        (it) => it.estado_item_id === ids.estadoItemPendienteId || (it.importe == null && it.estado_item_id !== ids.estadoItemCompletadoId)
      );
      if (pendientes.length > 0) {
        return res.status(400).json({
          error: 'No se puede marcar como Lista para emitir',
          detalles: `Falta cargar el importe en ${pendientes.length} ítem(s). Complete todos los importes antes de pasar a "Lista para emitir".`
        });
      }
    }

    // Actualizar liquidación con raw UPDATE para evitar P2022 (columna 'existe')
    // Si no vienen vencimientos/intereses en el body y en BD están vacíos, completar con cálculo automático por período
    const periodo = liquidacion.periodo;
    const vencimientosAuto = calcularVencimientosAutomaticos(periodo);
    const usuarioId = req.user?.id ?? null;
    const totalFinal = updateData.total !== undefined ? updateData.total : parseFloat(liquidacion.total ?? 0);
    const estadoIdFinal = updateData.estadoLiquidacionId !== undefined ? updateData.estadoLiquidacionId : liquidacion.estado_liquidacion_id;
    const vencFinal = updateData.vencimiento !== undefined ? updateData.vencimiento : (liquidacion.vencimiento ?? vencimientosAuto.vencimiento);
    const venc2Final = updateData.vencimiento2 !== undefined ? updateData.vencimiento2 : (liquidacion.vencimiento_2 ?? vencimientosAuto.vencimiento2);
    const venc3Final = updateData.vencimiento3 !== undefined ? updateData.vencimiento3 : (liquidacion.vencimiento_3 ?? vencimientosAuto.vencimiento3);
    const int2Final = updateData.interes2 !== undefined ? updateData.interes2 : (liquidacion.interes_2 ?? vencimientosAuto.interes2);
    const int3Final = updateData.interes3 !== undefined ? updateData.interes3 : (liquidacion.interes_3 ?? vencimientosAuto.interes3);
    const obsFinal = updateData.observaciones !== undefined ? updateData.observaciones : liquidacion.observaciones;
    const numFinal = updateData.numeracion !== undefined ? updateData.numeracion : liquidacion.numeracion;

    await prisma.$executeRaw(Prisma.sql`
      UPDATE liquidaciones SET
        total = ${totalFinal},
        estado_liquidacion_id = ${estadoIdFinal},
        vencimiento = ${vencFinal},
        vencimiento_2 = ${venc2Final},
        vencimiento_3 = ${venc3Final},
        interes_2 = ${int2Final},
        interes_3 = ${int3Final},
        observaciones = ${obsFinal},
        numeracion = ${numFinal},
        updated_at = NOW(),
        updated_by_id = ${usuarioId}
      WHERE id = ${idNum}
    `);
    const updatedLiqRows = await prisma.$queryRaw(Prisma.sql`SELECT * FROM liquidaciones WHERE id = ${idNum}`);
    const updatedItemsRows = await prisma.$queryRaw(Prisma.sql`SELECT * FROM liquidacion_items WHERE liquidacion_id = ${idNum} AND activo = true AND deleted_at IS NULL ORDER BY id ASC`);
    const updatedLiq = Array.isArray(updatedLiqRows) ? updatedLiqRows[0] : updatedLiqRows;
    const updatedItemsList = Array.isArray(updatedItemsRows) ? updatedItemsRows : [updatedItemsRows].filter(Boolean);
    const updated = { ...rowToCamel(updatedLiq), items: updatedItemsList.map(rowToCamel) };

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar liquidación:', error);
    res.status(500).json({ error: 'Error al actualizar liquidación' });
  }
};

export const emitirLiquidacion = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const ids = await getIds();
    if (!ids.estadoLiquidacionListaId || !ids.estadoLiquidacionEmitidaId) {
      return res.status(500).json({ error: 'Faltan estados de liquidación LISTA o EMITIDA parametrizados' });
    }

    const liqRows = await prisma.$queryRaw(Prisma.sql`SELECT * FROM liquidaciones WHERE id = ${id} AND deleted_at IS NULL`);
    const liqRow = Array.isArray(liqRows) ? liqRows[0] : liqRows;
    if (!liqRow) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }
    const liquidacion = rowToCamel(liqRow);
    const estadoRows = await prisma.$queryRaw(Prisma.sql`SELECT id, codigo, nombre FROM estados_liquidacion WHERE id = ${liqRow.estado_liquidacion_id}`);
    liquidacion.estado = estadoRows?.[0] ? rowToCamel(estadoRows[0]) : null;

    if (liquidacion.estadoLiquidacionId === ids.estadoLiquidacionEmitidaId) {
      return res.status(400).json({ error: 'La liquidación ya está emitida' });
    }

    if (liquidacion.estadoLiquidacionId !== ids.estadoLiquidacionListaId) {
      return res.status(400).json({ 
        error: 'La liquidación no está lista para emitir',
        detalles: `El estado actual es: ${liquidacion.estado?.nombre || liquidacion.estadoLiquidacionId}. Debe completar todos los ítems para pasar a "Lista para emitir".`
      });
    }

    let numeracion = liquidacion.numeracion;
    if (!numeracion) {
      const year = liquidacion.periodo.split('-')[0];
      const countRows = await prisma.$queryRaw(Prisma.sql`SELECT COUNT(*)::int as c FROM liquidaciones WHERE periodo LIKE ${year + '%'} AND numeracion IS NOT NULL`);
      const count = Array.isArray(countRows) ? countRows[0]?.c ?? 0 : countRows?.c ?? 0;
      numeracion = `LIQ-${year}-${String(count + 1).padStart(4, '0')}`;
    }

    await prisma.$executeRaw(Prisma.sql`UPDATE liquidaciones SET estado_liquidacion_id = ${ids.estadoLiquidacionEmitidaId}, numeracion = ${numeracion}, emision_at = NOW(), updated_at = NOW() WHERE id = ${id}`);
    const updatedLiqRows = await prisma.$queryRaw(Prisma.sql`SELECT * FROM liquidaciones WHERE id = ${id}`);
    const updatedItemsRows = await prisma.$queryRaw(Prisma.sql`SELECT * FROM liquidacion_items WHERE liquidacion_id = ${id} AND activo = true AND deleted_at IS NULL ORDER BY id ASC`);
    const updatedLiq = Array.isArray(updatedLiqRows) ? updatedLiqRows[0] : updatedLiqRows;
    const updatedItemsList = Array.isArray(updatedItemsRows) ? updatedItemsRows : [updatedItemsRows].filter(Boolean);
    const updated = {
      ...rowToCamel(updatedLiq),
      items: updatedItemsList.map(rowToCamel)
    };

    let liquidacionPropietario = null;

    // CASO 1: Liquidación CON contrato (tiene inquilino)
    if (updated.contratoId) {
      // Actores INQ/PROP para calcular total inquilino (los items vienen de raw sin relaciones)
      const [actorINQ, actorPROP] = await Promise.all([
        prisma.actorResponsableContrato.findFirst({ where: { codigo: 'INQ', activo: true }, select: { id: true } }),
        prisma.actorResponsableContrato.findFirst({ where: { codigo: 'PROP', activo: true }, select: { id: true } })
      ]);
      const idINQ = actorINQ?.id ?? null;
      const idPROP = actorPROP?.id ?? null;

      const totalInquilino = updated.items.reduce((sum, item) => {
        const importe = parseFloat(item.importe || 0) || 0;
        if (importe === 0) return sum;
        if (item.quienSoportaCostoId === idINQ) return sum + Math.abs(importe);
        if (item.quienSoportaCostoId === idPROP && item.pagadoPorActorId === idINQ) return sum - Math.abs(importe);
        return sum;
      }, 0);

      // Registrar DÉBITO en cuenta corriente del inquilino
      if (totalInquilino !== 0) {
        try {
          await registrarDebitoInquilino({
            contratoId: updated.contratoId,
            liquidacionId: updated.id,
            concepto: `Liquidación ${updated.periodo.substring(5)}-${updated.periodo.substring(0, 4)}`,
            importe: totalInquilino,
            fecha: new Date(),
            userId: req.user?.id || null
          });
        } catch (ccError) {
          console.warn('No se pudo registrar débito en cuenta corriente:', ccError.message);
        }
      }

      // Generar liquidación al propietario (con contrato): necesitamos contrato y tipos cargo (actores ya tenemos)
      try {
        const [contratoRow, tipoAlquiler, tipoHonorarios] = await Promise.all([
          prisma.contrato.findUnique({
            where: { id: updated.contratoId },
            select: { honorariosPropietario: true, propiedadId: true }
          }),
          prisma.tipoCargo.findFirst({ where: { codigo: 'ALQUILER', deletedAt: null }, select: { id: true } }),
          prisma.tipoCargo.findFirst({ where: { codigo: 'HONORARIOS', deletedAt: null }, select: { id: true } })
        ]);
        const idAlquiler = tipoAlquiler?.id ?? null;
        const idHonorarios = tipoHonorarios?.id ?? null;

        const itemAlquiler = idAlquiler ? updated.items.find(item => item.tipoCargoId === idAlquiler) : null;
        const alquilerBruto = itemAlquiler ? parseFloat(itemAlquiler.importe || 0) : 0;

        const porcentajeHonorarios = contratoRow?.honorariosPropietario != null ? parseFloat(contratoRow.honorariosPropietario) : 0;
        const honorariosInmob = alquilerBruto * (porcentajeHonorarios / 100);

        const itemsPropietario = updated.items.filter(item => {
          if (!idPROP || item.quienSoportaCostoId !== idPROP) return false;
          if (item.tipoCargoId === idAlquiler || item.tipoCargoId === idHonorarios) return false;
          return (parseFloat(item.importe || 0) || 0) > 0;
        });
        const gastosDeducibles = itemsPropietario.reduce((sum, item) => sum + parseFloat(item.importe || 0), 0);

        const propiedadId = updated.propiedadId ?? contratoRow?.propiedadId ?? null;

        if (alquilerBruto > 0 && propiedadId) {
          liquidacionPropietario = await generarLiquidacionPropietario({
            contratoId: updated.contratoId,
            propiedadId,
            periodo: updated.periodo,
            alquilerBruto,
            honorariosInmob,
            gastosDeducibles,
            otrasRetenciones: 0,
            observaciones: `Generada automáticamente al emitir liquidación ${numeracion}`,
            fecha: new Date(),
            userId: req.user?.id || null
          });
        }
      } catch (lpError) {
        console.warn('No se pudo generar liquidación propietario (con contrato):', lpError.message);
      }
    } 
    // CASO 2: Liquidación SIN contrato (propiedad sin inquilino)
    else if (updated.propiedadId) {
      try {
        // Calcular gastos que soporta el propietario (todos los items van al propietario)
        const itemsPropietario = updated.items.filter(item => {
          const importe = parseFloat(item.importe || 0);
          return importe > 0;
        });
        
        const gastosDeducibles = itemsPropietario.reduce((sum, item) => sum + parseFloat(item.importe || 0), 0);

        if (gastosDeducibles > 0) {
          liquidacionPropietario = await generarLiquidacionPropietarioSinContrato({
            propiedadId: updated.propiedadId,
            periodo: updated.periodo,
            gastosDeducibles,
            observaciones: `Generada automáticamente al emitir liquidación ${numeracion} (sin contrato)`,
            fecha: new Date(),
            userId: req.user?.id || null
          });
        }
      } catch (lpError) {
        console.warn('No se pudo generar liquidación propietario (sin contrato):', lpError.message);
      }
    }

    res.json({ ...updated, liquidacionPropietario });
  } catch (error) {
    console.error('Error al emitir liquidación:', error);
    res.status(500).json({ error: 'Error al emitir liquidación' });
  }
};

/**
 * Marcar liquidación como cobrada (PAGADA) y registrar el CRÉDITO en cuenta corriente del inquilino.
 * POST /liquidaciones/:id/cobrar
 * Body: { medioPagoId?: number, nroComprobante?: string }
 */
export const cobrarLiquidacion = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { medioPagoId, nroComprobante } = req.body || {};

    const ids = await getIds();
    if (!ids.estadoLiquidacionEmitidaId || !ids.estadoLiquidacionPagadaId) {
      return res.status(500).json({ error: 'Faltan estados de liquidación EMITIDA o SALDADA parametrizados' });
    }

    const liquidacion = await prisma.liquidacion.findUnique({
      where: { id },
      include: {
        items: {
          where: { activo: true, deletedAt: null },
          include: {
            quienSoportaCosto: true,
            pagadoPorActor: true
          }
        },
        estado: { select: { id: true, codigo: true, nombre: true } },
        contrato: { select: { id: true } }
      }
    });

    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }
    if (!liquidacion.contratoId) {
      return res.status(400).json({ error: 'La liquidación no tiene contrato asociado (sin inquilino)' });
    }
    if (liquidacion.estadoLiquidacionId !== ids.estadoLiquidacionEmitidaId) {
      return res.status(400).json({
        error: 'Solo se puede cobrar una liquidación en estado Emitida',
        detalles: `Estado actual: ${liquidacion.estado?.nombre || liquidacion.estadoLiquidacionId}`
      });
    }

    const totalInquilino = liquidacion.items.reduce((sum, item) => {
      const importeItem = importeEnBoleta(item);
      return sum + (importeItem !== null ? importeItem : 0);
    }, 0);

    if (totalInquilino <= 0) {
      return res.status(400).json({ error: 'El total a cobrar al inquilino es cero o negativo' });
    }

    const periodo = liquidacion.periodo || '';
    const mm = periodo.length >= 7 ? periodo.substring(5, 7) : '';
    const yyyy = periodo.length >= 4 ? periodo.substring(0, 4) : '';
    const concepto = `Pago Liquidación Período ${mm}-${yyyy}`;

    await prisma.$transaction(async (tx) => {
      await tx.liquidacion.update({
        where: { id },
        data: { estadoLiquidacionId: ids.estadoLiquidacionPagadaId }
      });
      const tipoCredito = await tx.tipoMovimiento.findUnique({
        where: { codigo: 'CREDITO' },
        select: { id: true }
      });
      if (!tipoCredito) {
        throw new Error('Tipo movimiento CREDITO no encontrado');
      }
      await tx.movimientoCuentaInquilino.create({
        data: {
          contratoId: liquidacion.contratoId,
          liquidacionId: id,
          tipoMovimientoId: tipoCredito.id,
          concepto,
          importe: totalInquilino,
          medioPagoId: medioPagoId || null,
          nroComprobante: nroComprobante || null,
          fecha: new Date(),
          createdById: req.user?.id || null
        }
      });
    });

    const updated = await prisma.liquidacion.findUnique({
      where: { id },
      include: {
        estado: { select: { id: true, codigo: true, nombre: true } },
        contrato: true,
        propiedad: true
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al cobrar liquidación:', error);
    res.status(500).json({ error: error.message || 'Error al cobrar liquidación' });
  }
};

export const deleteLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;

    const liquidacion = await prisma.liquidacion.findUnique({
      where: { id }
    });

    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    const ids = await getIds();
    if (ids.estadoLiquidacionEmitidaId && liquidacion.estadoLiquidacionId === ids.estadoLiquidacionEmitidaId) {
      return res.status(400).json({ error: 'No se puede eliminar una liquidación emitida' });
    }

    // Eliminar items primero
    await prisma.liquidacionItem.deleteMany({
      where: { liquidacionId: id }
    });

    // Eliminar liquidación
    await prisma.liquidacion.delete({
      where: { id }
    });

    res.json({ message: 'Liquidación eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar liquidación:', error);
    res.status(500).json({ error: 'Error al eliminar liquidación' });
  }
};

export const generatePDF = async (req, res) => {
  try {
    const { id } = req.params;

    const liquidacion = await prisma.liquidacion.findUnique({
      where: { id },
      include: {
        contrato: {
          include: {
            inquilino: true,
            unidad: {
              include: {
                propietario: true
              }
            }
          }
        },
        items: {
          orderBy: { id: 'asc' },
          include: {
            cuentaTributaria: {
              include: {
                unidad: {
                  include: {
                    propietario: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    // Obtener parámetros necesarios
    const tipoImpuestoCat = await prisma.categoria.findUnique({
      where: { codigo: 'tipo_impuesto' },
      include: { parametros: { where: { activo: true } } }
    });

    const quienPagaCat = await prisma.categoria.findUnique({
      where: { codigo: 'quien_paga' },
      include: { parametros: { where: { activo: true } } }
    });

    const condicionIvaCat = await prisma.categoria.findUnique({
      where: { codigo: 'condicion_iva' },
      include: { parametros: { where: { activo: true } } }
    });

    // Crear mapas de parámetros
    const tipoImpuestoMap = {};
    tipoImpuestoCat?.parametros.forEach(p => {
      tipoImpuestoMap[p.id] = p;
      tipoImpuestoMap[p.codigo] = p;
    });

    const quienPagaMap = {};
    quienPagaCat?.parametros.forEach(p => {
      quienPagaMap[p.id] = p;
      quienPagaMap[p.codigo] = p;
    });

    const condicionIvaMap = {};
    condicionIvaCat?.parametros.forEach(p => {
      condicionIvaMap[p.id] = p;
      condicionIvaMap[p.codigo] = p;
    });

    // Generar HTML
    const html = generateHTML(liquidacion, { tipoImpuestoMap, quienPagaMap, condicionIvaMap });

    // Generar PDF con Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    await browser.close();

    // Enviar PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="liquidacion-${liquidacion.periodo}.pdf"`);
    res.send(pdf);
  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).json({ error: 'Error al generar PDF' });
  }
};

function generateHTML(liq, { headerBase64, tipoImpuestoMap = {}, condicionIvaMap = {} }) {
  const { contrato, items } = liq;
  const { inquilino = {}, unidad = {} } = contrato || {};

  // ===== Helpers =====
  const fechaEmision = liq.emisionAt
    ? new Date(liq.emisionAt).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' })
    : new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' });

  const formatNumeracion = () => {
    if (liq.numeracion && liq.numeracion.includes('-')) return liq.numeracion;
    const y = new Date().getFullYear();
    const n = (liq.numeracion || 1).toString().padStart(4, '0');
    return `LIQ-${y}-${n}`;
  };

  const [anioStr, mesStr] = (liq.periodo || '').split('-');
  const mesNumero = parseInt(mesStr || '1', 10);
  const anioNumero = parseInt(anioStr || String(new Date().getFullYear()), 10);

  const fmt = (n) => Math.abs(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = (n) => (Number(n) < 0 ? '-' : '');

  const getParam = (map, k) => (k ? (map[k] || map[String(k)]) : null);
  const getCondicionIva = (id) => getParam(condicionIvaMap, id)?.descripcion || 'Consumidor final';

  const nombreCompleto = inquilino.razonSocial
    ? inquilino.razonSocial
    : [inquilino.apellido, inquilino.nombre].filter(Boolean).join(', ');

  const formatDni = (dni) => {
    if (!dni) return '-';
    const d = String(dni).replace(/\D/g, '');
    return d.length === 8 ? d.replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2.$3') : dni;
  };
  const formatCuit = (cuit) => {
    if (!cuit) return '-';
    const c = String(cuit).replace(/\D/g, '');
    return c.length === 11 ? c.replace(/(\d{2})(\d{8})(\d{1})/, '$1-$2-$3') : cuit;
  };

  const getConcepto = (it) => {
    // Si tenés parametrización, resolvela acá:
    const key = it?.cuentaTributaria?.tipoImpuesto ?? it?.tipoCargo;
    const p = getParam(tipoImpuestoMap, key);
    return p?.abreviatura || p?.descripcion || key || '-';
  };

  const total = (items || []).reduce((acc, it) => acc + (Number(it.importe) || 0), 0);

  // ===== Tabla de ítems =====
  const itemsHTML = (items || []).map((it) => {
    const imp = Number(it.importe) || 0;
    return `
      <tr>
        <td>${getConcepto(it)}</td>
        <td style="text-align:center;">${mesNumero}</td>
        <td style="text-align:center;">${anioNumero}</td>
        <td style="text-align:right;color:#d32f2f;font-weight:600;">${sign(imp)}$ ${fmt(imp)}</td>
      </tr>
    `;
  }).join('');

  // ===== HTML =====
  return `
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; padding: 12mm; }
  .container { width: 186mm; margin: 0 auto; }

  /* Encabezado (imagen + overlay N° / FECHA) */
  .header-wrap { position: relative; margin-bottom: 8px; }
  .header-img { width: 100%; height: auto; display: block; }
  .header-overlay { position: absolute; right: 10px; top: 10px; text-align: right; font-size: 11px; }
  .title { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
           font-weight: 700; font-size: 20px; letter-spacing: 1px; }
  .invalid { text-align: center; font-size: 10px; margin: 4px 0 6px; }
  .divider { height: 1px; background: #000; margin: 8px 0; }

  /* Filas compactas */
  .row { display: flex; justify-content: space-between; gap: 16px; margin: 6px 0; }
  .col { flex: 1; }
  .kv { display: inline-block; margin-right: 16px; }
  .lbl { font-weight: 700; }

  table { width: 100%; border-collapse: collapse; }
  .items th { text-align: left; border-bottom: 1px solid #aaa; padding: 6px 4px; }
  .items th:nth-child(2), .items th:nth-child(3) { text-align: center; }
  .items th:last-child { text-align: right; }
  .items td { padding: 6px 4px; border-bottom: 1px solid #eee; }

  .total-line { text-align: right; margin-top: 6px; font-weight: 700; }
  .pay-total { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 14px; }
  .dots { border-bottom: 1px dotted #000; display: inline-block; min-width: 120px; margin: 0 6px; transform: translateY(-2px); }
  .box { display: flex; align-items: center; gap: 6px; }
  .box .label { border: 1px solid #000; padding: 6px 10px; font-weight: 700; }
  .box .value { border: 1px solid #000; padding: 6px 14px; min-width: 120px; text-align: right; font-weight: 700; color: #d32f2f; }

  .sign { margin-top: 28px; }
  .sign .line { border-bottom: 1px solid #000; height: 14px; margin-top: 6px; }
  .footer { display: flex; justify-content: flex-end; margin-top: 18px; font-size: 10px; }
</style>
</head>
<body>
<div class="container">

  <!-- Encabezado (si pasás headerBase64 se usa la imagen del diseño) -->
  <div class="header-wrap">
    ${headerBase64 ? `<img class="header-img" src="data:image/png;base64,${headerBase64}" alt="Encabezado">` : ''}
    <div class="title">LIQUIDACION</div>
    <div class="header-overlay">
      <div>N°: ${formatNumeracion()}</div>
      <div>FECHA: ${fechaEmision}</div>
    </div>
  </div>

  <div class="invalid"><b>X</b> Documento no válido como factura</div>
  <div class="divider"></div>

  <!-- Cliente -->
  <div class="row">
    <div class="col">
      <span class="kv"><span class="lbl">Cliente:</span> ${nombreCompleto || '-'}</span>
      <span class="kv"><span class="lbl">DNI:</span> ${formatDni(inquilino.dni)}</span>
      <span class="kv"><span class="lbl">CUIT /CUIL:</span> ${formatCuit(inquilino.cuit)}</span>
      <div class="kv" style="margin-right:0"><span class="lbl">Dirección:</span> ${inquilino.direccion || '-'}</div>
    </div>
    <div class="col" style="text-align:right">
      <div class="kv"><span class="lbl">I.V.A.:</span> ${getCondicionIva(inquilino.condicionIva)}</div>
      <div class="kv"><span class="lbl">Localidad:</span> ${inquilino.localidad || '-'}</div>
    </div>
  </div>

  <div class="divider"></div>

  <!-- Contrato / Propiedad -->
  <div class="row">
    <div class="col">
      <span class="kv"><span class="lbl">Contrato N°:</span> ${contrato?.nroContrato || '-'}</span>
      <span class="kv"><span class="lbl">Inicio:</span> ${contrato?.fechaInicio ? new Date(contrato.fechaInicio).toLocaleDateString('es-AR') : '-'}</span>
      <span class="kv"><span class="lbl">Fin:</span> ${contrato?.fechaFin ? new Date(contrato.fechaFin).toLocaleDateString('es-AR') : '-'}</span>
    </div>
    <div class="col" style="text-align:right">
      <div class="kv"><span class="lbl">Propiedad Calle:</span> ${unidad?.direccion || '-'}</div>
      <div class="kv"><span class="lbl">Propiedad Localidad:</span> ${unidad?.localidad || '-'}</div>
    </div>
  </div>

  <!-- Tabla -->
  <table class="items" style="margin-top:8px">
    <thead>
      <tr>
        <th>Concepto</th>
        <th>Periodo</th>
        <th>Año</th>
        <th>Importe</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <!-- Total debajo de tabla -->
  <div class="total-line">${sign(total)}$ ${fmt(total)}</div>

  <!-- Medios de Pago + Total Recibo -->
  <div class="pay-total">
    <div>
      <b>Medios de Pago:</b> <span class="dots"></span> Efectivo <span class="dots"></span>
      <span>${sign(total)}$ ${fmt(total)}</span>
    </div>
    <div class="box">
      <div class="label">Total Recibo:</div>
      <div class="value">${sign(total)}$ ${fmt(total)}</div>
    </div>
  </div>

  <!-- Firma -->
  <div class="sign">
    <div><b>Firma y aclaración:</b></div>
    <div class="line"></div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>
      <div>Tel.: 341-3132231</div>
      <div>Mail: info@odomopropiedades.com</div>
    </div>
  </div>

</div>
</body>
</html>
  `;
}

/**
 * Genera liquidaciones automáticamente para todos los contratos vigentes del período especificado
 * Endpoint: POST /api/liquidaciones/cron/generar?periodo=YYYY-MM
 */
export const generarLiquidacionesAutomaticas = async (req, res) => {
  try {
    const { periodo } = req.query || req.body;
    
    // Si no se proporciona período, usar el mes actual
    let periodoObjetivo = periodo;
    if (!periodoObjetivo) {
      const ahora = new Date();
      periodoObjetivo = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
    }

    // Validar formato YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(periodoObjetivo)) {
      return res.status(400).json({ error: 'El período debe tener el formato YYYY-MM' });
    }

    const periodoDate = new Date(periodoObjetivo + '-01');
    if (isNaN(periodoDate.getTime())) {
      return res.status(400).json({ error: 'Período inválido' });
    }

    console.log(`[CRON] Iniciando generación automática de liquidaciones para período: ${periodoObjetivo}`);

    // Crear fecha de inicio y fin del mes del período
    const inicioMes = new Date(periodoDate.getFullYear(), periodoDate.getMonth(), 1);
    inicioMes.setHours(0, 0, 0, 0);
    const finMes = new Date(periodoDate.getFullYear(), periodoDate.getMonth() + 1, 0);
    finMes.setHours(23, 59, 59, 999);

    // PASO 1: Obtener TODAS las unidades que tengan cuentas tributarias activas
    const unidadesConCuentas = await prisma.unidad.findMany({
      where: {
        isDeleted: false,
        cuentas: {
          some: {
            isDeleted: false,
            activo: true
          }
        }
      },
      include: {
        cuentas: {
          where: {
            isDeleted: false,
            activo: true
          }
        }
      }
    });

    console.log(`[CRON] Encontradas ${unidadesConCuentas.length} unidades con cuentas tributarias activas`);

    let creadas = 0;
    let omitidas = 0;
    let errores = 0;
    let omitidosSinContrato = 0;
    let omitidosPorFecha = 0;
    let omitidosSinItems = 0;
    const erroresDetalle = [];

    // PASO 2: Para cada unidad, buscar el contrato vigente en el período
    for (const unidad of unidadesConCuentas) {
      try {
        // Buscar el contrato vigente o prorrogado que esté activo en el período
        const contratoVigente = await prisma.contrato.findFirst({
          where: {
            unidadId: unidad.id,
            isDeleted: false,
            estado: {
              in: ['vigente', 'prorrogado']
            },
            fechaInicio: {
              lte: finMes // El contrato debe haber comenzado antes o durante el mes
            },
            OR: [
              { fechaFin: null }, // Contrato sin fecha de fin
              { fechaFin: { gte: inicioMes } } // O fecha de fin posterior o igual al inicio del mes
            ]
          },
          include: {
            responsabilidades: true,
            inquilino: true
          },
          orderBy: {
            fechaInicio: 'desc' // Tomar el más reciente si hay múltiples
          }
        });

        // Si no hay contrato vigente, crear liquidación solo con items de cuentas
        // El contrato y las responsabilidades solo se usan para determinar quién paga al emitir
        if (!contratoVigente) {
          console.log(`[CRON] Unidad ${unidad.direccion} no tiene contrato vigente en período ${periodoObjetivo}, creando liquidación solo con items de cuentas`);
        }

        // Verificar idempotencia: si ya existe liquidación para esta unidad y período, omitir
        const existing = await prisma.liquidacion.findFirst({
          where: {
            unidadId: unidad.id,
            periodo: periodoObjetivo
          }
        });

        if (existing) {
          omitidas++;
          console.log(`[CRON] Skip: Ya existe liquidación para unidad ${unidad.direccion} período ${periodoObjetivo}`);
          continue;
        }

        console.log(`[CRON] Procesando unidad ${unidad.direccion}: ${contratoVigente ? `Contrato ${contratoVigente.nroContrato}, Responsabilidades=${contratoVigente.responsabilidades?.length || 0}, ` : ''}Cuentas activas=${unidad.cuentas.length}`);

        const items = [];
        let orden = 1;

        // 1. Item Alquiler (solo si hay contrato vigente y responsabilidad de alquiler)
        if (contratoVigente) {
          const alquilerResp = contratoVigente.responsabilidades.find(r => r.tipoCargo === 'alquiler');
          if (alquilerResp) {
            const montoAlquiler = parseFloat(contratoVigente.montoActual || contratoVigente.montoInicial);
            items.push({
              tipoCargo: 'alquiler',
              importe: montoAlquiler,
              quienPaga: alquilerResp.quienPaga,
              fuente: 'automatico',
              estado: 'completado', // El alquiler ya está calculado
              orden: orden++,
              observaciones: 'Alquiler calculado automáticamente'
            });
          }
        }

        // 2. Items por cada cuenta tributaria activa de la unidad
        // IMPORTANTE: Se crean items para TODAS las cuentas activas, independientemente de las responsabilidades
        // Las responsabilidades solo se usan para determinar quién paga cuando se emite la liquidación
        for (const cuenta of unidad.cuentas) {
          // Buscar el último item completado de esta cuenta/tipo para obtener importeAnterior
          const ultimoItem = await prisma.liquidacionItem.findFirst({
            where: {
              cuentaTributariaId: cuenta.id,
              tipoCargo: cuenta.tipoImpuesto,
              estado: 'completado',
              importe: { not: null }
            },
            orderBy: {
              createdAt: 'desc'
            },
            select: {
              importe: true
            }
          });

          // Buscar responsabilidad en el contrato para este tipo de impuesto (si hay contrato)
          // Si no hay responsabilidad configurada o no hay contrato, usar un valor por defecto
          // Las responsabilidades solo se usan para saber quién paga al emitir
          const resp = contratoVigente?.responsabilidades.find(r => r.tipoCargo === cuenta.tipoImpuesto);
          // Si no hay responsabilidad, usar 'paga_inq' como fallback (paga inquilino por defecto)
          const quienPaga = resp ? resp.quienPaga : 'paga_inq';

          items.push({
            tipoCargo: cuenta.tipoImpuesto,
            cuentaTributariaId: cuenta.id,
            importe: null, // Pendiente de completar
            importeAnterior: ultimoItem ? parseFloat(ultimoItem.importe) : null,
            quienPaga: quienPaga, // Usar responsabilidad del contrato, o fallback
            fuente: 'automatico',
            estado: 'pendiente',
            orden: orden++,
            observaciones: 'Pendiente de carga manual'
          });
        }

        // Si no hay items, no crear liquidación
        if (items.length === 0) {
          omitidosSinItems++;
          console.log(`[CRON] Skip sin items: Unidad ${unidad.direccion} no tiene items para crear`);
          continue;
        }

        // Calcular total inicial (solo items con importe)
        const total = items.reduce((sum, item) => {
          return sum + (item.importe ? parseFloat(item.importe) : 0);
        }, 0);

        // Determinar estado inicial
        // Si todos los items están completados → lista_para_emitir
        // Si hay items pendientes → pendiente_items
        const todosCompletados = items.every(item => item.estado === 'completado');
        const estadoInicial = todosCompletados ? 'lista_para_emitir' : 'pendiente_items';

        // Calcular vencimientos automáticos
        const vencimientosAuto = calcularVencimientosAutomaticos(periodoObjetivo);

        // Crear liquidación
        await prisma.liquidacion.create({
          data: {
            contratoId: contratoVigente?.id || null, // Opcional: puede ser null si no hay contrato
            unidadId: unidad.id,
            periodo: periodoObjetivo,
            estado: estadoInicial,
            total,
            vencimiento: vencimientosAuto.vencimiento,
            vencimiento2: vencimientosAuto.vencimiento2,
            interes2: vencimientosAuto.interes2,
            vencimiento3: vencimientosAuto.vencimiento3,
            interes3: vencimientosAuto.interes3,
            autoGenerada: true,
            items: {
              create: items
            }
          }
        });

        creadas++;
        console.log(`[CRON] Creada liquidación para unidad ${unidad.direccion} ${contratoVigente ? `(contrato ${contratoVigente.nroContrato})` : '(sin contrato)'} período ${periodoObjetivo} con ${items.length} items`);

      } catch (error) {
        errores++;
        erroresDetalle.push({
          unidadId: unidad.id,
          direccion: unidad.direccion,
          error: error.message
        });
        console.error(`[CRON] Error al crear liquidación para unidad ${unidad.direccion}:`, error);
        console.error(`[CRON] Error stack:`, error.stack);
      }
    }

    const resultado = {
      periodo: periodoObjetivo,
      resumen: {
        unidadesEncontradas: unidadesConCuentas.length,
        creadas,
        omitidas,
        omitidosSinContrato,
        omitidosPorFecha,
        omitidosSinItems,
        errores
      },
      erroresDetalle: errores > 0 ? erroresDetalle : undefined
    };

    console.log(`[CRON] Finalizada generación automática:`, resultado.resumen);
    console.log(`[CRON] Detalle: ${unidadesConCuentas.length} unidades encontradas, ${creadas} creadas, ${omitidas} omitidas (existentes), ${omitidosSinContrato} omitidas (sin contrato), ${omitidosSinItems} omitidas (sin items), ${errores} errores`);
    res.json(resultado);

  } catch (error) {
    console.error('[CRON] Error en generación automática de liquidaciones:', error);
    res.status(500).json({ 
      error: 'Error al generar liquidaciones automáticas',
      detalles: error.message
    });
  }
};

/**
 * Genera liquidaciones para todos los contratos vigentes de un período específico.
 * Endpoint: POST /api/liquidaciones/generar-periodo
 * Body: { periodo: "YYYY-MM" }
 * Refactor: Bulk loading + loop in-memory + una sola transacción de escritura (evita N+1 y timeouts).
 */
export const generarLiquidacionesPeriodo = async (req, res) => {
  try {
    const { periodo } = req.body;

    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
      return res.status(400).json({ error: 'El período es requerido y debe tener formato YYYY-MM' });
    }

    const periodoDate = new Date(periodo + '-01');
    const inicioMes = new Date(periodoDate.getFullYear(), periodoDate.getMonth(), 1);
    const finMes = new Date(periodoDate.getFullYear(), periodoDate.getMonth() + 1, 0);

    // ----- PASO 1: Cargas masivas (máximo 3–4 queries) -----
    const ids = await getIds();
    const estadoBorradorId = ids.estadoLiquidacionBorradorId;
    const estadoListaId = ids.estadoLiquidacionListaId;
    const tipoCargoAlquilerId = ids.tipoCargoAlquilerId;
    const quienPagaInquilinoId = ids.actorINQId;
    const estadoItemCompletadoId = ids.estadoItemCompletadoId;

    if (!estadoBorradorId || !estadoListaId) {
      return res.status(500).json({ error: 'Faltan parámetros de estado de liquidación (BORRADOR/LISTA)' });
    }

    const contratosVigentes = await prisma.contrato.findMany({
      where: {
        deletedAt: null,
        estado: { codigo: { in: ['vigente', 'prorrogado'] } },
        fechaInicio: { lte: finMes },
        OR: [
          { fechaFin: null },
          { fechaFin: { gte: inicioMes } }
        ]
      },
      include: {
        responsabilidades: { where: { activo: true, deletedAt: null }, include: { tipoCargo: true } },
        propiedad: true,
        inquilino: true
      }
    });

    const contratoIds = contratosVigentes.map((c) => c.id);
    if (contratoIds.length === 0) {
      return res.json({
        success: true,
        periodo,
        cantidad: 0,
        omitidas: 0,
        mensaje: 'No hay contratos vigentes en el período.'
      });
    }

    const liquidacionesExistentes = await prisma.liquidacion.findMany({
      where: {
        contratoId: { in: contratoIds },
        periodo,
        deletedAt: null
      },
      select: { contratoId: true }
    });
    const contratoIdsConLiquidacion = new Set(liquidacionesExistentes.map((l) => l.contratoId));

    const vencimientosAuto = calcularVencimientosAutomaticos(periodo);

    // ----- PASO 2: Bucle 100% en memoria (sin más SELECTs) -----
    const liquidacionesAGuardar = [];

    for (const contrato of contratosVigentes) {
      if (contratoIdsConLiquidacion.has(contrato.id)) continue;

      const items = [];

      const alquilerResp = contrato.responsabilidades?.find((r) => r.tipoCargoId === tipoCargoAlquilerId || r.tipoCargo?.codigo === 'ALQUILER');
      const montoAlquiler = alquilerResp ? parseFloat(contrato.montoActual ?? contrato.montoInicial ?? 0) : 0;
      if (montoAlquiler > 0 && tipoCargoAlquilerId && estadoItemCompletadoId) {
        items.push({
          tipoCargoId: tipoCargoAlquilerId,
          importe: montoAlquiler,
          quienSoportaCostoId: quienPagaInquilinoId,
          estadoItemId: estadoItemCompletadoId,
          observaciones: 'Alquiler del período'
        });
      }

      if (items.length === 0) continue;

      const total = items.reduce((sum, item) => sum + (parseFloat(item.importe) || 0), 0);
      const estadoInicial = items.length > 0 && items[0].importe > 0 ? estadoListaId : estadoBorradorId;

      liquidacionesAGuardar.push({
        liquidacionData: {
          contratoId: contrato.id,
          propiedadId: contrato.propiedadId,
          periodo,
          estadoLiquidacionId: estadoInicial,
          total,
          vencimiento: vencimientosAuto.vencimiento,
          vencimiento2: vencimientosAuto.vencimiento2,
          interes2: vencimientosAuto.interes2,
          vencimiento3: vencimientosAuto.vencimiento3,
          interes3: vencimientosAuto.interes3
        },
        items
      });
    }

    const omitidas = contratoIds.length - liquidacionesAGuardar.length;
    const errores = [];

    // ----- PASO 3: Una sola transacción con N creates (cada uno con items anidados) -----
    if (liquidacionesAGuardar.length > 0) {
      await prisma.$transaction(
        liquidacionesAGuardar.map(({ liquidacionData, items }) =>
          prisma.liquidacion.create({
            data: {
              ...liquidacionData,
              items: { create: items }
            }
          })
        )
      );
    }

    res.json({
      success: true,
      periodo,
      cantidad: liquidacionesAGuardar.length,
      omitidas,
      errores: errores.length > 0 ? errores : undefined,
      mensaje: `Se generaron ${liquidacionesAGuardar.length} liquidaciones para el período ${periodo}. ${omitidas} omitidas (ya existían).`
    });
  } catch (error) {
    console.error('Error al generar liquidaciones del período:', error);
    res.status(500).json({ error: error.message || 'Error al generar liquidaciones' });
  }
};

/**
 * Obtiene items pendientes para la bandeja de completar
 * Endpoint: GET /api/liquidaciones/pendientes-items
 */
export const getPendientesItems = async (req, res) => {
  try {
    const { 
      periodo, 
      tipoImpuesto, 
      search, 
      verCompletados = 'false',
      page = 1, 
      pageSize = 50 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const mostrarCompletados = verCompletados === 'true';

    // Si no se proporciona período, usar el mes actual
    let periodoFiltro = periodo;
    if (!periodoFiltro) {
      const ahora = new Date();
      periodoFiltro = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
    }

    // Construir where clause
    const where = {
      liquidacion: {
        periodo: periodoFiltro
      },
      estado: mostrarCompletados ? 'completado' : 'pendiente',
      ...(tipoImpuesto && { tipoCargo: tipoImpuesto }),
      ...(search && {
        OR: [
          {
            liquidacion: {
              unidad: {
                direccion: { contains: search, mode: 'insensitive' }
              }
            }
          },
          {
            liquidacion: {
              unidad: {
                localidad: { contains: search, mode: 'insensitive' }
              }
            }
          },
          {
            liquidacion: {
              contrato: {
                inquilino: {
                  OR: [
                    { apellido: { contains: search, mode: 'insensitive' } },
                    { nombre: { contains: search, mode: 'insensitive' } },
                    { razonSocial: { contains: search, mode: 'insensitive' } }
                  ]
                }
              }
            }
          }
        ]
      })
    };

    const [items, total] = await Promise.all([
      prisma.liquidacionItem.findMany({
        where,
        skip,
        take: parseInt(pageSize),
        include: {
          liquidacion: {
            include: {
              contrato: {
                include: {
                  inquilino: {
                    select: {
                      id: true,
                      nombre: true,
                      apellido: true,
                      razonSocial: true
                    }
                  }
                }
              },
              unidad: {
                select: {
                  id: true,
                  direccion: true,
                  localidad: true
                }
              }
            }
          },
          cuentaTributaria: {
            select: {
              id: true,
              codigo1: true,
              codigo2: true,
              usuarioEmail: true,
              usuarioPortal: true,
              password: true
            }
          }
        },
        orderBy: [
          { tipoCargo: 'asc' },
          { liquidacion: { unidad: { direccion: 'asc' } } }
        ]
      }),
      prisma.liquidacionItem.count({ where })
    ]);

    // Formatear respuesta
    const data = items.map(item => {
      const inquilino = item.liquidacion.contrato.inquilino;
      const displayInquilino = inquilino.razonSocial || 
        `${inquilino.apellido || ''}, ${inquilino.nombre || ''}`.trim() || 'Sin nombre';

      return {
        itemId: item.id,
        tipoImpuesto: item.tipoCargo,
        periodo: item.liquidacion.periodo,
        unidad: {
          direccion: item.liquidacion.unidad.direccion,
          localidad: item.liquidacion.unidad.localidad
        },
        inquilino: {
          display: displayInquilino
        },
        cuenta: item.cuentaTributaria ? {
          codigo1: item.cuentaTributaria.codigo1,
          codigo2: item.cuentaTributaria.codigo2,
          user: item.cuentaTributaria.usuarioPortal || item.cuentaTributaria.usuarioEmail,
          password: item.cuentaTributaria.password || null // Devolver password real (se oculta en frontend con toggle)
        } : null,
        importeAnterior: item.importeAnterior ? parseFloat(item.importeAnterior) : null,
        importe: item.importe ? parseFloat(item.importe) : null,
        estado: item.estado,
        observaciones: item.observaciones
      };
    });

    res.json({
      data,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });

  } catch (error) {
    console.error('Error al obtener items pendientes:', error);
    res.status(500).json({ error: 'Error al obtener items pendientes' });
  }
};

/**
 * Completa un item de liquidación
 * POST /api/liquidaciones/items/:id/completar
 */
export const completarItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { importe, observaciones } = req.body;
    const ids = await getIds();
    if (!ids.estadoItemPendienteId || !ids.estadoItemCompletadoId || !ids.estadoLiquidacionBorradorId || !ids.estadoLiquidacionListaId) {
      return res.status(500).json({ error: 'Faltan estados parametrizados (PENDIENTE, COMPLETADO, BORRADOR, LISTA)' });
    }
    const result = await completarItemService(
      parseInt(id, 10),
      { importe, observaciones },
      ids,
      req.user?.id ?? null
    );
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error al completar item:', error);
    if (error.code === 'NOT_FOUND') return res.status(404).json({ error: error.message });
    if (error.code === 'VALIDATION') return res.status(400).json({ error: error.message, estadoActual: error.estadoActual });
    return res.status(500).json({ error: 'Error al completar item' });
  }
};

/**
 * Reabre un item completado
 * POST /api/liquidaciones/items/:id/reabrir
 */
export const reabrirItem = async (req, res) => {
  try {
    const { id } = req.params;
    const ids = await getIds();
    if (!ids.estadoItemPendienteId || !ids.estadoItemCompletadoId || !ids.estadoLiquidacionBorradorId || !ids.estadoLiquidacionEmitidaId) {
      return res.status(500).json({ error: 'Faltan estados parametrizados' });
    }
    const result = await reabrirItemService(parseInt(id, 10), ids);
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error al reabrir item:', error);
    if (error.code === 'NOT_FOUND') return res.status(404).json({ error: error.message });
    if (error.code === 'VALIDATION') return res.status(400).json({ error: error.message, estadoActual: error.estadoActual });
    return res.status(500).json({ error: 'Error al reabrir item' });
  }
};

// ============================================
// LIQUIDACIÓN DE IMPUESTOS
// ============================================

/**
 * Validación fail-fast: todos los ajustes de alquiler que debían realizarse ANTES del período a liquidar
 * deben estar registrados en ContratoAjuste. El ajuste del propio mes a liquidar no bloquea: ese mes se
 * liquida con el monto actual; el monto nuevo aplica al mes siguiente (ej. ajuste 30/03 no bloquea generar marzo).
 * @returns {{ ok: true } | { ok: false, contratosBloqueantes: Array<{ contratoId: number, mensaje?: string, fechasPendientes?: string[] }> }}
 */
async function validarAjustesFailFast(periodo) {
  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    return { ok: false, contratosBloqueantes: [], error: 'Período inválido' };
  }
  const [anio, mes] = periodo.split('-').map(Number);
  const startOfPeriod = new Date(anio, mes - 1, 1);
  startOfPeriod.setHours(0, 0, 0, 0);
  const endOfPeriod = new Date(anio, mes, 0);
  endOfPeriod.setHours(23, 59, 59, 999);
  // Solo exigir ajustes cargados hasta el mes ANTERIOR al que se liquida (el ajuste del mes actual no bloquea)
  const endOfPeriodAnterior = new Date(anio, mes - 1, 0);
  endOfPeriodAnterior.setHours(23, 59, 59, 999);

  const estadoVigente = await prisma.estadoContrato.findFirst({
    where: { codigo: 'VIGENTE', deletedAt: null },
    select: { id: true }
  });
  if (!estadoVigente) return { ok: true };

  const contratosVigentesEnPeriodo = await prisma.contrato.findMany({
    where: {
      estadoContratoId: estadoVigente.id,
      frecuenciaAjusteMeses: { not: null },
      activo: true,
      deletedAt: null,
      fechaInicio: { lte: endOfPeriod },
      OR: [{ fechaFin: null }, { fechaFin: { gte: startOfPeriod } }]
    },
    select: { id: true, fechaInicio: true, frecuenciaAjusteMeses: true }
  });

  const ajustesCargadosPorContrato = await prisma.contratoAjuste.findMany({
    where: {
      contratoId: { in: contratosVigentesEnPeriodo.map((c) => c.id) },
      activo: true,
      deletedAt: null,
      fechaAjuste: { lte: endOfPeriod }
    },
    select: { contratoId: true, fechaAjuste: true }
  });

  const mesesCargadosPorContrato = new Map();
  for (const a of ajustesCargadosPorContrato) {
    const d = new Date(a.fechaAjuste);
    // Usar UTC para evitar desfase: fechaAjuste "01/12/2024" en BD (UTC) no debe verse como noviembre en servidor Argentina
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!mesesCargadosPorContrato.has(a.contratoId)) mesesCargadosPorContrato.set(a.contratoId, new Set());
    mesesCargadosPorContrato.get(a.contratoId).add(key);
  }

  const periodoYm = `${anio}-${String(mes).padStart(2, '0')}`;
  const contratosBloqueantes = [];
  for (const c of contratosVigentesEnPeriodo) {
    const mesesDebidos = mesesConAjusteDebido(c.fechaInicio, c.frecuenciaAjusteMeses, endOfPeriodAnterior);
    const mesesCargados = mesesCargadosPorContrato.get(c.id) || new Set();
    let mesesPendientes = [...mesesDebidos].filter((m) => !mesesCargados.has(m)).sort();
    // Nunca bloquear por el mes que se está liquidando: ese mes se liquida con monto actual
    mesesPendientes = mesesPendientes.filter((m) => m !== periodoYm);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[validarAjustesFailFast] Contrato', c.id, 'fechaInicio', c.fechaInicio, 'frecuencia', c.frecuenciaAjusteMeses, 'mesesDebidos', [...mesesDebidos], 'mesesCargados', [...mesesCargados], 'mesesPendientes', mesesPendientes);
    }
    if (mesesPendientes.length > 0) {
      const fechasPendientes = mesesPendientes.map((ym) => {
        const [y, mo] = ym.split('-').map(Number);
        return `01/${String(mo).padStart(2, '0')}/${y}`;
      });
      contratosBloqueantes.push({
        contratoId: c.id,
        mensaje: `El contrato #${c.id} tiene ajuste(s) de alquiler pendientes de registrar (ej. ${fechasPendientes[0]}). No se puede generar el lote hasta cargar todos los ajustes debidos.`,
        fechasPendientes
      });
    }
  }
  if (contratosBloqueantes.length > 0) {
    return { ok: false, contratosBloqueantes };
  }
  return { ok: true };
}

/**
 * Genera liquidaciones e items de impuestos para un período específico.
 * Ejecuta todo el lote dentro de una única transacción (all-or-nothing).
 * @param {string} periodo - Período en formato "YYYY-MM"
 * @param {number} usuarioId - ID del usuario que ejecuta la generación
 * @returns {Promise<{creadas: number, itemsCreados: number}>}
 */
async function generarLiquidacionesImpuestos(periodo, usuarioId = null) {
  // Validar formato de período
  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    throw new Error('El período debe tener el formato YYYY-MM');
  }

  const [anio, mes] = periodo.split('-').map(Number);
  const periodoDate = new Date(anio, mes - 1, 1);
  const startOfMonth = new Date(anio, mes - 1, 1);
  startOfMonth.setHours(0, 0, 0, 0);
  const endOfMonth = new Date(anio, mes, 0);
  endOfMonth.setHours(23, 59, 59, 999);

  console.log(`[LIQUIDACION-IMPUESTOS] Iniciando generación para período ${periodo}`);

  const ids = await getIds();
  if (!ids.estadoLiquidacionBorradorId) {
    throw new Error('No se encontró el estado BORRADOR para liquidaciones');
  }
  if (!ids.estadoItemPendienteId) {
    throw new Error('No se encontró el estado PENDIENTE para items de liquidación');
  }

  // Resolver IDs de tipos de cargo (Alquiler, Gastos Admin, Honorarios) por código.
  // No exigir activo: true para que se generen ítems aunque el tipo esté inactivo en la UI (ej. ALQUILER).
  const tiposCargoAlquilerGastosHonorarios = await prisma.tipoCargo.findMany({
    where: {
      codigo: { in: ['ALQUILER', 'GASTOS_ADMINISTRATIVOS', 'HONORARIOS'] },
      deletedAt: null
    },
    select: { id: true, codigo: true }
  });
  const tipoCargoAlquilerId = tiposCargoAlquilerGastosHonorarios.find(t => t.codigo === 'ALQUILER')?.id ?? null;
  const tipoCargoGastosAdministrativosId = tiposCargoAlquilerGastosHonorarios.find(t => t.codigo === 'GASTOS_ADMINISTRATIVOS')?.id ?? null;
  const tipoCargoHonorariosId = tiposCargoAlquilerGastosHonorarios.find(t => t.codigo === 'HONORARIOS')?.id ?? null;
  if (!tipoCargoAlquilerId) {
    console.warn('[LIQUIDACION-IMPUESTOS] No se encontró tipo de cargo ALQUILER en la base de datos. Ejecute el seed o cree el tipo en Configuración.');
  }
  if (!tipoCargoGastosAdministrativosId || !tipoCargoHonorariosId) {
    console.warn('[LIQUIDACION-IMPUESTOS] Tipos GASTOS_ADMINISTRATIVOS u HONORARIOS no encontrados. Ejecute: npx prisma db seed');
  }

  // Propiedades con impuestos/cargos activos O con contrato vigente en el período (para generar alquiler, gastos admin, honorarios)
  const propiedadesConImpuestos = await prisma.propiedad.findMany({
    where: {
      activo: true,
      deletedAt: null,
      OR: [
        {
          impuestos: {
            some: {
              activo: true,
              deletedAt: null
            }
          }
        },
        {
          cargos: {
            some: {
              activo: true,
              deletedAt: null,
              tipoCargo: {
                activo: true
              }
            }
          }
        },
        {
          contratos: {
            some: {
              activo: true,
              deletedAt: null,
              fechaInicio: { lte: endOfMonth },
              OR: [
                { fechaFin: null },
                { fechaFin: { gte: startOfMonth } }
              ]
            }
          }
        }
      ]
    },
    include: {
      impuestos: {
        where: {
          activo: true,
          deletedAt: null
        },
        include: {
          tipoImpuesto: {
            include: {
              periodicidad: true
            }
          },
          periodicidad: true,
          campos: {
            where: {
              deletedAt: null
            },
            include: {
              tipoCampo: true
            }
          }
        }
      },
      cargos: {
        where: {
          activo: true,
          deletedAt: null,
          tipoCargo: {
            activo: true
          }
        },
        include: {
          tipoCargo: {
            include: {
              periodicidad: true
            }
          },
          periodicidad: true
        }
      }
    }
  });

  console.log(`[LIQUIDACION-IMPUESTOS] Encontradas ${propiedadesConImpuestos.length} propiedades con impuestos o expensas activos`);

  // Tipos de expensa (ORD/EXT) para items de EXPENSAS
  const tiposExpensa = await prisma.tipoExpensa.findMany({
    where: { activo: true, deletedAt: null }
  });

  // Una única transacción para todo el lote: all-or-nothing
  const resultado = await prisma.$transaction(async (tx) => {
    let liquidacionesCreadas = 0;
    let itemsCreados = 0;

    for (const propiedad of propiedadesConImpuestos) {
      const propiedadId = propiedad.id;
      let itemsCreadosEnPropiedad = 0;
      let liquidacionCreada = false;

      // Buscar contratos en rango para esta propiedad (solo para determinar si hay uno VIGENTE)
      const contratosEnRango = await tx.contrato.findMany({
        where: {
          propiedadId: propiedadId,
          activo: true,
          deletedAt: null,
          fechaInicio: { lte: endOfMonth },
          OR: [
            { fechaFin: null },
            { fechaFin: { gte: startOfMonth } }
          ]
        },
        include: {
          responsabilidades: {
            where: {
              activo: true,
              deletedAt: null
            }
          },
          inquilino: true,
          gastosIniciales: {
            where: {
              activo: true,
              deletedAt: null
            },
            include: {
              tipoGastoInicial: true,
              quienPaga: true
            }
          },
          garantias: {
            where: {
              activo: true,
              deletedAt: null
            }
          }
        },
        orderBy: {
          fechaInicio: 'desc'
        }
      });

      // Contrato principal: solo si existe uno con estado VIGENTE en el período (regla de negocio)
      const contratoPrincipal =
        ids.estadoContratoVigenteId != null
          ? (contratosEnRango.find((c) => c.estadoContratoId === ids.estadoContratoVigenteId) ?? null)
          : null;
      const esContratoVigente = !!contratoPrincipal;

      /*
       * REGLAS DE NEGOCIO — Dos escenarios mutuamente excluyentes:
       *
       * ESCENARIO A — Propiedad SIN contrato vigente:
       *   - Liquidación directa al Propietario.
       *   - Items: TODOS los impuestos y cargos (PropiedadImpuesto, PropiedadCargo).
       *   - Responsable: 100% Propietario (quienSoportaCostoId = PROP).
       *   - Restricción: NO generar Alquiler, Gastos Administrativos, Honorarios ni Gastos Iniciales.
       *
       * ESCENARIO B — Propiedad CON contrato vigente (estadoContrato === VIGENTE):
       *   - Liquidación según contrato y tabla ContratoResponsabilidad.
       *   - Fijos: Alquiler (montoActual), Gastos Administrativos, Honorarios del Propietario.
       *   - Variables: Impuestos/Cargos solo si tienen fila en ContratoResponsabilidad (quién paga qué).
       *   - Gastos Iniciales: solo si es la primera liquidación del contrato y gastos_iniciales_liquidados === false;
       *     al generar, se hace update del contrato a gastos_iniciales_liquidados = true en la misma transacción.
       */

      const totalCostoAveriguacion = contratoPrincipal?.garantias?.reduce(
        (total, g) => total + (parseFloat(g.costoAveriguacion) || 0), 0
      ) || 0;

      const vencimientosAuto = calcularVencimientosAutomaticos(periodo);
      const contratoIdParaLiq = esContratoVigente && contratoPrincipal ? contratoPrincipal.id : null;

      {
        const existingLiq = await tx.$queryRaw(Prisma.sql`
          SELECT * FROM liquidaciones WHERE propiedad_id = ${propiedadId} AND periodo = ${periodo} AND deleted_at IS NULL LIMIT 1
        `);
        const existingRow = Array.isArray(existingLiq) ? existingLiq[0] : existingLiq;
        let liquidacionRow;
        if (existingRow) {
          liquidacionRow = existingRow;
          if (contratoIdParaLiq != null) {
            await tx.$executeRaw(Prisma.sql`
              UPDATE liquidaciones SET contrato_id = ${contratoIdParaLiq}, updated_at = NOW() WHERE id = ${existingRow.id}
            `);
          }
        } else {
          liquidacionCreada = true;
          const inserted = await tx.$queryRaw(Prisma.sql`
            INSERT INTO liquidaciones (propiedad_id, contrato_id, periodo, estado_liquidacion_id, total, vencimiento, auto_generada, created_at, updated_at, created_by_id)
            VALUES (${propiedadId}, ${contratoIdParaLiq}, ${periodo}, ${ids.estadoLiquidacionBorradorId}, 0, ${vencimientosAuto.vencimiento}, true, NOW(), NOW(), ${usuarioId})
            RETURNING *
          `);
          liquidacionRow = Array.isArray(inserted) ? inserted[0] : inserted;
        }
        const liquidacionId = liquidacionRow.id;

        if (!esContratoVigente) {
          // ========== ESCENARIO A: Propiedad SIN contrato vigente ==========
          // Liquidación directa al Propietario. Items: TODOS los impuestos y cargos de la propiedad.
          // Responsable de pago: 100% Propietario (quienSoportaCostoId = PROP, pagadoPorActorId = INM).
          // Restricción estricta: NO generar Alquiler, Gastos Administrativos, Honorarios ni Gastos Iniciales.
          for (const impuesto of propiedad.impuestos) {
            const periodicidad = impuesto.periodicidad || impuesto.tipoImpuesto?.periodicidad;
            let codigoPeriodicidad = periodicidad?.codigo || 'MENSUAL';
            if (codigoPeriodicidad.includes('_')) codigoPeriodicidad = codigoPeriodicidad.split('_').slice(1).join('_');
            if (!correspondeGenerarPorPeriodicidad(codigoPeriodicidad, periodo)) continue;
            const itemExistente = await tx.liquidacionItem.findFirst({
              where: {
                liquidacionId,
                propiedadImpuestoId: impuesto.id,
                activo: true,
                deletedAt: null,
                OR: [{ periodoRef: periodo }, { periodoRef: null }]
              }
            });
            if (itemExistente) continue;
            const [anioActual, mesActual] = periodo.split('-').map(Number);
            const mesAnterior = mesActual === 1 ? 12 : mesActual - 1;
            const anioAnterior = mesActual === 1 ? anioActual - 1 : anioActual;
            const periodoAnterior = `${String(mesAnterior).padStart(2, '0')}-${anioAnterior}`;
            const ultimoItemCompletado = await tx.liquidacionItem.findFirst({
              where: {
                propiedadImpuestoId: impuesto.id,
                activo: true,
                deletedAt: null,
                importe: { not: null },
                estadoItemId: ids.estadoItemCompletadoId,
                liquidacion: { propiedadId: propiedadId, periodo: periodoAnterior }
              }
            });
            const importeAnterior = ultimoItemCompletado?.importe ? parseFloat(ultimoItemCompletado.importe) : null;
            await tx.liquidacionItem.create({
              data: {
                liquidacionId,
                propiedadImpuestoId: impuesto.id,
                periodoRef: periodo,
                importe: null,
                importeAnterior,
                estadoItemId: ids.estadoItemPendienteId,
                quienSoportaCostoId: ids.actorPROPId,
                pagadoPorActorId: ids.actorINMId,
                visibleEnBoletaInquilino: false,
                afectaSaldoInquilino: false,
                createdById: usuarioId
              }
            });
            itemsCreadosEnPropiedad++;
          }
          for (const propiedadCargo of propiedad.cargos || []) {
            const codigoCargo = propiedadCargo.tipoCargo?.codigo;
            // Restricción estricta Escenario A: nunca Alquiler, Gastos Admin ni Honorarios
            if (['ALQUILER', 'GASTOS_ADMINISTRATIVOS', 'HONORARIOS'].includes(codigoCargo)) continue;
            if (codigoCargo === 'EXPENSAS') {
              const periodicidadExp = propiedadCargo.periodicidad || propiedadCargo.tipoCargo?.periodicidad;
              let codigoPeriodicidadExp = periodicidadExp?.codigo || 'MENSUAL';
              if (codigoPeriodicidadExp.includes('_')) codigoPeriodicidadExp = codigoPeriodicidadExp.split('_').slice(1).join('_');
              if (!correspondeGenerarPorPeriodicidad(codigoPeriodicidadExp, periodo)) continue;
              for (const tipoExpensa of tiposExpensa) {
                const itemExistente = await tx.liquidacionItem.findFirst({
                  where: {
                    liquidacionId,
                    tipoCargoId: propiedadCargo.tipoCargoId,
                    tipoExpensaId: tipoExpensa.id,
                    periodoRef: periodo,
                    activo: true,
                    deletedAt: null
                  }
                });
                if (itemExistente) continue;
                await tx.liquidacionItem.create({
                  data: {
                    liquidacionId,
                    tipoCargoId: propiedadCargo.tipoCargoId,
                    tipoExpensaId: tipoExpensa.id,
                    periodoRef: periodo,
                    importe: null,
                    estadoItemId: ids.estadoItemPendienteId,
                    quienSoportaCostoId: ids.actorPROPId,
                    pagadoPorActorId: ids.actorINMId,
                    visibleEnBoletaInquilino: false,
                    afectaSaldoInquilino: false,
                    createdById: usuarioId
                  }
                });
                itemsCreadosEnPropiedad++;
              }
              continue;
            }
            const periodicidadCargo = propiedadCargo.periodicidad || propiedadCargo.tipoCargo?.periodicidad;
            let codigoPeriodicidadCargo = periodicidadCargo?.codigo || 'MENSUAL';
            if (codigoPeriodicidadCargo.includes('_')) codigoPeriodicidadCargo = codigoPeriodicidadCargo.split('_').slice(1).join('_');
            if (!correspondeGenerarPorPeriodicidad(codigoPeriodicidadCargo, periodo)) continue;
            const itemExistente = await tx.liquidacionItem.findFirst({
              where: {
                liquidacionId,
                tipoCargoId: propiedadCargo.tipoCargoId,
                activo: true,
                deletedAt: null,
                OR: [{ periodoRef: periodo }, { periodoRef: null }]
              }
            });
            if (itemExistente) continue;
            await tx.liquidacionItem.create({
              data: {
                liquidacionId,
                tipoCargoId: propiedadCargo.tipoCargoId,
                periodoRef: periodo,
                importe: null,
                estadoItemId: ids.estadoItemPendienteId,
                quienSoportaCostoId: ids.actorPROPId,
                pagadoPorActorId: ids.actorINMId,
                visibleEnBoletaInquilino: false,
                afectaSaldoInquilino: false,
                createdById: usuarioId
              }
            });
            itemsCreadosEnPropiedad++;
          }
        } else {
          // ========== ESCENARIO B: Propiedad CON contrato vigente ==========
          // Liquidación según términos del contrato. Fijos: Alquiler (montoActual), Gastos Admin, Honorarios Propietario.
          // Variables: Impuestos y Cargos solo si tienen fila en ContratoResponsabilidad (motor de quién paga qué).
          // Gastos Iniciales: solo si es la primera liquidación del contrato Y gastos_iniciales_liquidados === false;
          // al generar los ítems se hace update del contrato a gastos_iniciales_liquidados = true en esta misma transacción.
          const montoAlquiler = parseFloat(contratoPrincipal.montoActual ?? contratoPrincipal.montoInicial ?? 0);
          if (tipoCargoAlquilerId) {
            const responsabilidadAlquiler = contratoPrincipal.responsabilidades?.find(r => r.tipoCargoId === tipoCargoAlquilerId) || null;
            const itemAlq = await tx.liquidacionItem.findFirst({
              where: { liquidacionId, tipoCargoId: tipoCargoAlquilerId, activo: true, deletedAt: null }
            });
            if (itemAlq) {
              await tx.liquidacionItem.update({
                where: { id: itemAlq.id },
                data: {
                  importe: montoAlquiler,
                  quienSoportaCostoId: responsabilidadAlquiler?.quienSoportaCostoId ?? ids.actorINQId,
                  pagadoPorActorId: responsabilidadAlquiler?.quienPagaProveedorId ?? ids.actorINMId
                }
              });
            } else {
              await tx.liquidacionItem.create({
                data: {
                  liquidacionId,
                  tipoCargoId: tipoCargoAlquilerId,
                  periodoRef: periodo,
                  importe: montoAlquiler,
                  estadoItemId: ids.estadoItemCompletadoId,
                  quienSoportaCostoId: responsabilidadAlquiler?.quienSoportaCostoId ?? ids.actorINQId,
                  pagadoPorActorId: responsabilidadAlquiler?.quienPagaProveedorId ?? ids.actorINMId,
                  visibleEnBoletaInquilino: true,
                  afectaSaldoInquilino: true,
                  createdById: usuarioId
                }
              });
            }
            itemsCreadosEnPropiedad++;
          }
          if (tipoCargoGastosAdministrativosId) {
            const pctGastosAdmin = contratoPrincipal.gastosAdministrativos != null ? parseFloat(contratoPrincipal.gastosAdministrativos) : null;
            if (pctGastosAdmin != null && pctGastosAdmin > 0) {
              const importeGastosAdmin = Math.round((montoAlquiler * pctGastosAdmin / 100) * 100) / 100;
              const itemGA = await tx.liquidacionItem.findFirst({
                where: { liquidacionId, tipoCargoId: tipoCargoGastosAdministrativosId, activo: true, deletedAt: null }
              });
              if (!itemGA) {
                await tx.liquidacionItem.create({
                  data: {
                    liquidacionId,
                    tipoCargoId: tipoCargoGastosAdministrativosId,
                    periodoRef: periodo,
                    importe: importeGastosAdmin,
                    estadoItemId: ids.estadoItemCompletadoId,
                    quienSoportaCostoId: ids.actorINQId,
                    pagadoPorActorId: ids.actorINMId,
                    visibleEnBoletaInquilino: true,
                    afectaSaldoInquilino: true,
                    createdById: usuarioId
                  }
                });
                itemsCreadosEnPropiedad++;
              }
            }
          }
          if (tipoCargoHonorariosId) {
            const pctHonorarios = contratoPrincipal.honorariosPropietario != null ? parseFloat(contratoPrincipal.honorariosPropietario) : null;
            if (pctHonorarios != null && pctHonorarios > 0) {
              const importeHonorarios = Math.round((montoAlquiler * pctHonorarios / 100) * 100) / 100;
              const itemHon = await tx.liquidacionItem.findFirst({
                where: { liquidacionId, tipoCargoId: tipoCargoHonorariosId, activo: true, deletedAt: null }
              });
              if (!itemHon) {
                await tx.liquidacionItem.create({
                  data: {
                    liquidacionId,
                    tipoCargoId: tipoCargoHonorariosId,
                    periodoRef: periodo,
                    importe: importeHonorarios,
                    estadoItemId: ids.estadoItemCompletadoId,
                    quienSoportaCostoId: ids.actorPROPId,
                    pagadoPorActorId: ids.actorINMId,
                    visibleEnBoletaInquilino: false,
                    afectaSaldoInquilino: false,
                    createdById: usuarioId
                  }
                });
                itemsCreadosEnPropiedad++;
              }
            }
          }
          // Variables: impuestos solo si existe fila en ContratoResponsabilidad (regla estricta)
          for (const impuesto of propiedad.impuestos) {
            const responsabilidad = contratoPrincipal.responsabilidades?.find((r) => r.tipoImpuestoId === impuesto.tipoImpuestoId) ?? null;
            if (!responsabilidad) continue;
            const periodicidad = impuesto.periodicidad || impuesto.tipoImpuesto?.periodicidad;
            let codigoPeriodicidad = periodicidad?.codigo || 'MENSUAL';
            if (codigoPeriodicidad.includes('_')) codigoPeriodicidad = codigoPeriodicidad.split('_').slice(1).join('_');
            if (!correspondeGenerarPorPeriodicidad(codigoPeriodicidad, periodo)) continue;
            const itemExistente = await tx.liquidacionItem.findFirst({
              where: {
                liquidacionId,
                propiedadImpuestoId: impuesto.id,
                activo: true,
                deletedAt: null,
                OR: [{ periodoRef: periodo }, { periodoRef: null }]
              }
            });
            if (itemExistente) continue;
            if (ids.actorINQId != null && responsabilidad.quienPagaProveedorId === ids.actorINQId && responsabilidad.quienSoportaCostoId === ids.actorINQId) continue;
            const [anioActual, mesActual] = periodo.split('-').map(Number);
            const mesAnterior = mesActual === 1 ? 12 : mesActual - 1;
            const anioAnterior = mesActual === 1 ? anioActual - 1 : anioActual;
            const periodoAnterior = `${String(mesAnterior).padStart(2, '0')}-${anioAnterior}`;
            const ultimoItemCompletado = await tx.liquidacionItem.findFirst({
              where: {
                propiedadImpuestoId: impuesto.id,
                activo: true,
                deletedAt: null,
                importe: { not: null },
                estadoItemId: ids.estadoItemCompletadoId,
                liquidacion: { propiedadId: propiedadId, periodo: periodoAnterior }
              }
            });
            const importeAnterior = ultimoItemCompletado?.importe ? parseFloat(ultimoItemCompletado.importe) : null;
            await tx.liquidacionItem.create({
              data: {
                liquidacionId,
                propiedadImpuestoId: impuesto.id,
                periodoRef: periodo,
                importe: null,
                importeAnterior,
                estadoItemId: ids.estadoItemPendienteId,
                quienSoportaCostoId: responsabilidad.quienSoportaCostoId,
                pagadoPorActorId: responsabilidad.quienPagaProveedorId,
                visibleEnBoletaInquilino: ids.actorINQId != null && responsabilidad.quienSoportaCostoId === ids.actorINQId,
                afectaSaldoInquilino: ids.actorINQId != null && responsabilidad.quienSoportaCostoId === ids.actorINQId,
                createdById: usuarioId
              }
            });
            itemsCreadosEnPropiedad++;
          }
          // Variables: cargos (excepto ALQ, GA, HON) y EXPENSAS solo si existe fila en ContratoResponsabilidad
          for (const propiedadCargo of propiedad.cargos || []) {
            const codigoCargo = propiedadCargo.tipoCargo?.codigo;
            if (['ALQUILER', 'GASTOS_ADMINISTRATIVOS', 'HONORARIOS'].includes(codigoCargo)) continue;
            if (codigoCargo === 'EXPENSAS') {
              const periodicidadExpB = propiedadCargo.periodicidad || propiedadCargo.tipoCargo?.periodicidad;
              let codigoPeriodicidadExpB = periodicidadExpB?.codigo || 'MENSUAL';
              if (codigoPeriodicidadExpB.includes('_')) codigoPeriodicidadExpB = codigoPeriodicidadExpB.split('_').slice(1).join('_');
              if (!correspondeGenerarPorPeriodicidad(codigoPeriodicidadExpB, periodo)) continue;
              for (const tipoExpensa of tiposExpensa) {
                const resp = contratoPrincipal.responsabilidades?.find(
                  r => r.tipoCargoId === propiedadCargo.tipoCargoId && (r.tipoExpensaId === tipoExpensa.id || !r.tipoExpensaId)
                ) || null;
                if (!resp) continue;
                const itemExistente = await tx.liquidacionItem.findFirst({
                  where: {
                    liquidacionId,
                    tipoCargoId: propiedadCargo.tipoCargoId,
                    tipoExpensaId: tipoExpensa.id,
                    periodoRef: periodo,
                    activo: true,
                    deletedAt: null
                  }
                });
                if (itemExistente) continue;
                if (ids.actorINQId != null && resp.quienPagaProveedorId === ids.actorINQId && resp.quienSoportaCostoId === ids.actorINQId) continue;
                await tx.liquidacionItem.create({
                  data: {
                    liquidacionId,
                    tipoCargoId: propiedadCargo.tipoCargoId,
                    tipoExpensaId: tipoExpensa.id,
                    periodoRef: periodo,
                    importe: null,
                    estadoItemId: ids.estadoItemPendienteId,
                    quienSoportaCostoId: resp.quienSoportaCostoId,
                    pagadoPorActorId: resp.quienPagaProveedorId,
                    visibleEnBoletaInquilino: ids.actorINQId != null && resp.quienSoportaCostoId === ids.actorINQId,
                    afectaSaldoInquilino: ids.actorINQId != null && resp.quienSoportaCostoId === ids.actorINQId,
                    createdById: usuarioId
                  }
                });
                itemsCreadosEnPropiedad++;
              }
              continue;
            }
            const resp = contratoPrincipal.responsabilidades?.find(
              r => r.tipoCargoId === propiedadCargo.tipoCargoId && !r.tipoExpensaId
            ) || null;
            if (!resp) continue;
            const periodicidadCargo = propiedadCargo.periodicidad || propiedadCargo.tipoCargo?.periodicidad;
            let codigoPeriodicidadCargo = periodicidadCargo?.codigo || 'MENSUAL';
            if (codigoPeriodicidadCargo.includes('_')) codigoPeriodicidadCargo = codigoPeriodicidadCargo.split('_').slice(1).join('_');
            if (!correspondeGenerarPorPeriodicidad(codigoPeriodicidadCargo, periodo)) continue;
            const itemExistente = await tx.liquidacionItem.findFirst({
              where: {
                liquidacionId,
                tipoCargoId: propiedadCargo.tipoCargoId,
                activo: true,
                deletedAt: null,
                OR: [{ periodoRef: periodo }, { periodoRef: null }]
              }
            });
            if (itemExistente) continue;
            if (ids.actorINQId != null && resp.quienPagaProveedorId === ids.actorINQId && resp.quienSoportaCostoId === ids.actorINQId) continue;
            await tx.liquidacionItem.create({
              data: {
                liquidacionId,
                tipoCargoId: propiedadCargo.tipoCargoId,
                periodoRef: periodo,
                importe: null,
                estadoItemId: ids.estadoItemPendienteId,
                quienSoportaCostoId: resp.quienSoportaCostoId,
                pagadoPorActorId: resp.quienPagaProveedorId,
                visibleEnBoletaInquilino: ids.actorINQId != null && resp.quienSoportaCostoId === ids.actorINQId,
                afectaSaldoInquilino: ids.actorINQId != null && resp.quienSoportaCostoId === ids.actorINQId,
                createdById: usuarioId
              }
            });
            itemsCreadosEnPropiedad++;
          }
          // Gastos Iniciales (one-off): solo si es la primera liquidación del contrato Y gastos_iniciales_liquidados === false
          if (
            contratoPrincipal.gastosIniciales?.length > 0 &&
            contratoPrincipal.gastosInicialesLiquidados === false
          ) {
            const liquidacionesAnterioresCount = await tx.liquidacion.count({
              where: {
                contratoId: contratoPrincipal.id,
                activo: true,
                deletedAt: null,
                periodo: { lt: periodo }
              }
            });
            const esPrimeraLiquidacion = liquidacionesAnterioresCount === 0;
            if (esPrimeraLiquidacion) {
              for (const gastoInicial of contratoPrincipal.gastosIniciales) {
                const codigoTipo = gastoInicial.tipoGastoInicial?.codigo?.toLowerCase() || '';
                const esAveriguacion = codigoTipo.includes('averig') || codigoTipo === 'averiguacion' || codigoTipo === 'averiguacion_garantias';
                const importeGasto = esAveriguacion ? totalCostoAveriguacion : (gastoInicial.importe ? parseFloat(gastoInicial.importe) : 0);
                if (importeGasto <= 0) continue;
                const itemGastoExiste = await tx.liquidacionItem.findFirst({
                  where: {
                    liquidacionId,
                    contratoGastoInicialId: gastoInicial.id,
                    activo: true,
                    deletedAt: null
                  }
                });
                if (itemGastoExiste) continue;
                const quienSoportaCostoId = gastoInicial.quienPagaId || ids.actorINQId;
                const esInquilino = quienSoportaCostoId === ids.actorINQId;
                await tx.liquidacionItem.create({
                  data: {
                    liquidacionId,
                    contratoGastoInicialId: gastoInicial.id,
                    periodoRef: periodo,
                    importe: importeGasto,
                    estadoItemId: ids.estadoItemCompletadoId,
                    quienSoportaCostoId,
                    pagadoPorActorId: ids.actorINMId,
                    visibleEnBoletaInquilino: esInquilino,
                    afectaSaldoInquilino: esInquilino,
                    observaciones: `Gasto inicial: ${gastoInicial.tipoGastoInicial?.nombre || 'Sin nombre'}`,
                    createdById: usuarioId
                  }
                });
                itemsCreadosEnPropiedad++;
              }
              // Marcar gastos iniciales como liquidados en la misma transacción (atómico)
              await tx.contrato.update({
                where: { id: contratoPrincipal.id },
                data: { gastosInicialesLiquidados: true }
              });
            }
          }
        }

        const itemsRows = await tx.$queryRaw(Prisma.sql`
          SELECT importe FROM liquidacion_items WHERE liquidacion_id = ${liquidacionId} AND activo = true AND deleted_at IS NULL
        `);
        const itemsList = Array.isArray(itemsRows) ? itemsRows : [itemsRows].filter(Boolean);
        const nuevoTotal = itemsList.reduce((sum, it) => sum + (it.importe ? parseFloat(it.importe) : 0), 0);
        await tx.$executeRaw(Prisma.sql`UPDATE liquidaciones SET total = ${nuevoTotal} WHERE id = ${liquidacionId}`);
      }

      liquidacionesCreadas += liquidacionCreada ? 1 : 0;
      itemsCreados += itemsCreadosEnPropiedad;
    }

    return { creadas: liquidacionesCreadas, itemsCreados };
  });

  console.log(`[LIQUIDACION-IMPUESTOS] Finalizada generación: ${resultado.creadas} liquidaciones, ${resultado.itemsCreados} items`);

  return {
    creadas: resultado.creadas,
    itemsCreados: resultado.itemsCreados,
    errores: 0,
    erroresDetalle: undefined
  };
}

/**
 * Endpoint: POST /liquidaciones/impuestos/generar
 * Genera liquidaciones e items de impuestos para un período
 */
export const generarImpuestos = async (req, res) => {
  try {
    const { periodo } = req.body;
    const usuarioId = req.user?.id ?? null;

    if (!periodo) {
      return res.status(400).json({ error: 'El período es requerido (formato: YYYY-MM)' });
    }
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      return res.status(400).json({ error: 'El período debe tener el formato YYYY-MM' });
    }

    const [anio, mes] = periodo.split('-').map(Number);
    const startOfPeriod = new Date(anio, mes - 1, 1);
    startOfPeriod.setHours(0, 0, 0, 0);

    // Validación fail-fast: si a algún contrato vigente le "toca" ajuste en el mes y no tiene ContratoAjuste, abortar todo el lote
    const skipValidacionAjustes = process.env.SKIP_VALIDACION_AJUSTES_IMPUESTOS === 'true' || process.env.SKIP_VALIDACION_AJUSTES_IMPUESTOS === '1';
    if (!skipValidacionAjustes) {
      const validacionAjustes = await validarAjustesFailFast(periodo);
      if (!validacionAjustes.ok) {
        const bloqueantes = validacionAjustes.contratosBloqueantes || [];
        const detalleFechas = bloqueantes.map((b) => `Contrato #${b.contratoId}: ${(b.fechasPendientes || []).join(', ')}`).join('; ');
        const mensaje = 'Hay al menos un contrato con ajuste de alquiler pendiente. No se pueden generar liquidaciones hasta cargar todos los ajustes debidos.';
        console.warn('[generarImpuestos] Bloqueado por validación de ajustes:', detalleFechas);
        return res.status(400).json({
          error: mensaje,
          detalles: detalleFechas || mensaje,
          contratosBloqueantes: bloqueantes
        });
      }
    } else {
      console.warn('[generarImpuestos] Validación de ajustes omitida (SKIP_VALIDACION_AJUSTES_IMPUESTOS=true)');
    }

    // Validar que no haya ajustes de contrato vencidos sin cargar el importe actualizado (montoActual != montoNuevo)
    const ajustesAntesDelPeriodo = await prisma.contratoAjuste.findMany({
      where: {
        fechaAjuste: { lt: startOfPeriod },
        activo: true,
        deletedAt: null
      },
      include: { contrato: { select: { id: true, montoActual: true, propiedadId: true } } },
      orderBy: { fechaAjuste: 'desc' }
    });
    const porContrato = new Map();
    for (const a of ajustesAntesDelPeriodo) {
      if (!porContrato.has(a.contratoId)) porContrato.set(a.contratoId, a);
    }
    const ajustesVencidosSinCargar = [];
    for (const a of porContrato.values()) {
      const montoActual = parseFloat(a.contrato?.montoActual ?? 0);
      const montoNuevo = parseFloat(a.montoNuevo ?? 0);
      if (Math.abs(montoActual - montoNuevo) > 0.01) {
        ajustesVencidosSinCargar.push({
          contratoId: a.contratoId,
          fechaAjuste: a.fechaAjuste,
          montoNuevo: a.montoNuevo,
          montoActual: a.contrato?.montoActual
        });
      }
    }
    if (ajustesVencidosSinCargar.length > 0) {
      const mensaje = ajustesVencidosSinCargar.length === 1
        ? `Hay un ajuste de contrato vencido (fecha de ajuste anterior al período ${periodo}) sin cargar el importe actualizado. Actualice el monto del contrato antes de generar liquidaciones.`
        : `Hay ${ajustesVencidosSinCargar.length} ajustes de contrato vencidos (fechas de ajuste anteriores al período ${periodo}) sin cargar el importe actualizado. Actualice los montos de los contratos antes de generar liquidaciones.`;
      return res.status(400).json({
        error: mensaje,
        detalles: mensaje,
        ajustesVencidos: ajustesVencidosSinCargar
      });
    }

    const resultado = await generarLiquidacionesImpuestos(periodo, usuarioId);

    res.json({
      ok: true,
      periodo,
      ...resultado
    });

  } catch (error) {
    console.error('Error al generar liquidaciones de impuestos:', error);
    res.status(500).json({
      error: 'Error al generar liquidaciones de impuestos',
      detalles: error.message
    });
  }
};

/**
 * GET /liquidaciones/impuestos-pendientes
 * Lista impuestos y expensas pendientes (o completados si verCompletados), agrupados.
 * Usa Prisma liquidacionItem.findMany + include (sin $queryRaw para la carga principal).
 */
export const getImpuestosPendientes = async (req, res) => {
  try {
    const { periodo, verCompletados = 'false' } = req.query;
    const mostrarCompletados = verCompletados === 'true';

    const ids = await getIds();
    if (!ids.estadoItemPendienteId) {
      return res.status(500).json({ error: 'No se encontró el estado PENDIENTE' });
    }

    const estadosBuscar = mostrarCompletados && ids.estadoItemCompletadoId
      ? [ids.estadoItemPendienteId, ids.estadoItemCompletadoId]
      : [ids.estadoItemPendienteId];

    const where = {
      activo: true,
      deletedAt: null,
      estadoItemId: { in: estadosBuscar },
      contratoGastoInicialId: null,
      liquidacion: { deletedAt: null },
      OR: [
        { propiedadImpuestoId: { not: null } },
        { tipoCargoId: { not: null }, tipoCargo: { codigo: { notIn: ['ALQUILER', 'GASTOS_ADMINISTRATIVOS', 'HONORARIOS'] } } }
      ]
    };
    if (periodo) {
      where.AND = [
        { OR: [ { liquidacion: { periodo } }, { periodoRef: periodo } ] }
      ];
    }

    let itemsList = await prisma.liquidacionItem.findMany({
      where,
      include: includeImpuestosPendientesItems
    });
    itemsList = itemsList.sort((a, b) => {
      const dirA = a.liquidacion?.propiedad?.dirCalle ?? '';
      const dirB = b.liquidacion?.propiedad?.dirCalle ?? '';
      return dirA.localeCompare(dirB);
    });

    if (itemsList.length === 0) {
      return res.json({ impuestos: [], expensas: [], periodo: periodo || null });
    }

    const items = itemsList.map((i) => ({
      ...i,
      importe: i.importe != null ? Number(i.importe) : null,
      importeAnterior: i.importeAnterior != null ? Number(i.importeAnterior) : null,
      liquidacion: i.liquidacion ? {
        ...i.liquidacion,
        propiedad: i.liquidacion.propiedad || null,
        contrato: i.liquidacion.contrato || null
      } : null,
      propiedadImpuesto: i.propiedadImpuesto ? {
        ...i.propiedadImpuesto,
        tipoImpuesto: i.propiedadImpuesto.tipoImpuesto || null,
        campos: (i.propiedadImpuesto.campos || []).map((c) => ({
          ...c,
          tipoCampo: c.tipoCampo || null
        }))
      } : null,
      tipoCargo: i.tipoCargo || null,
      tipoExpensa: i.tipoExpensa || null,
      actorFacturado: i.actorFacturado || null,
      quienSoportaCosto: i.quienSoportaCosto || null,
      pagadoPorActor: i.pagadoPorActor || null,
      estadoItem: i.estadoItem || null
    }));

    // Separar items en impuestos y expensas
    const impuestosItems = [];
    const expensasItems = [];

    for (const item of items) {
      if (item.propiedadImpuestoId) {
        // Es un impuesto
        impuestosItems.push(item);
      } else if (item.tipoCargoId && item.tipoCargo?.codigo === 'EXPENSAS') {
        // Es una expensa
        expensasItems.push(item);
      } else if (item.tipoCargoId) {
        // Es otro tipo de cargo (no expensas)
        impuestosItems.push(item);
      }
    }

    // Recalcular importeAnterior solo desde el período inmediatamente anterior (no usar el guardado al crear)
    // Solo cuando hay filtro por período, para no mezclar datos de distintos meses
    let importeAnteriorPorImpuesto = new Map(); // key: 'propiedadImpuestoId-propiedadId' -> importe
    if (periodo && ids.estadoItemCompletadoId) {
      const periodoActual = periodo;
      const [anioActual, mesActual] = String(periodoActual).split('-').map(Number);
      const mesAnterior = mesActual === 1 ? 12 : mesActual - 1;
      const anioAnterior = mesActual === 1 ? anioActual - 1 : anioActual;
      const periodoAnterior = `${anioAnterior}-${String(mesAnterior).padStart(2, '0')}`;
      const impuestosConPropiedad = impuestosItems
        .filter(i => i.propiedadImpuestoId && i.liquidacion?.propiedadId)
        .map(i => ({ propiedadImpuestoId: i.propiedadImpuestoId, propiedadId: i.liquidacion.propiedadId }));
      const unicos = Array.from(new Map(impuestosConPropiedad.map(o => [`${o.propiedadImpuestoId}-${o.propiedadId}`, o])).values());
      if (unicos.length > 0) {
        const orConditions = unicos.map(({ propiedadImpuestoId, propiedadId }) =>
          Prisma.sql`(li.propiedad_impuesto_id = ${propiedadImpuestoId} AND l.propiedad_id = ${propiedadId})`
        );
        const itemsAnteriores = await prisma.$queryRaw(Prisma.sql`
          SELECT li.propiedad_impuesto_id, l.propiedad_id, li.importe FROM liquidacion_items li
          INNER JOIN liquidaciones l ON l.id = li.liquidacion_id AND l.deleted_at IS NULL
          WHERE li.estado_item_id = ${ids.estadoItemCompletadoId} AND li.activo = true AND li.deleted_at IS NULL AND li.importe IS NOT NULL
          AND l.periodo = ${periodoAnterior} AND (${Prisma.join(orConditions, ' OR ')})
        `);
        const antList = Array.isArray(itemsAnteriores) ? itemsAnteriores : [itemsAnteriores].filter(Boolean);
        for (const it of antList) {
          const key = `${it.propiedad_impuesto_id}-${it.propiedad_id}`;
          importeAnteriorPorImpuesto.set(key, parseFloat(it.importe));
        }
      }
    }

    // Recalcular importeAnterior para expensas (solo período inmediatamente anterior)
    let importeAnteriorPorExpensa = new Map(); // key: 'propiedadId-ORD' | 'propiedadId-EXT'
    if (periodo && ids.estadoItemCompletadoId && expensasItems.length > 0) {
      const [anioE, mesE] = String(periodo).split('-').map(Number);
      const mesAntE = mesE === 1 ? 12 : mesE - 1;
      const anioAntE = mesE === 1 ? anioE - 1 : anioE;
      const periodoAntE = `${anioAntE}-${String(mesAntE).padStart(2, '0')}`;
      const propIdsExp = [...new Set(expensasItems.map(e => e.liquidacion?.propiedadId).filter(Boolean))];
      if (propIdsExp.length > 0) {
        const itemsExpAnt = await prisma.$queryRaw(Prisma.sql`
          SELECT l.propiedad_id, te.codigo, li.importe FROM liquidacion_items li
          INNER JOIN liquidaciones l ON l.id = li.liquidacion_id AND l.deleted_at IS NULL
          INNER JOIN tipos_cargo tc ON tc.id = li.tipo_cargo_id AND tc.codigo = 'EXPENSAS'
          LEFT JOIN tipos_expensa te ON te.id = li.tipo_expensa_id
          WHERE li.estado_item_id = ${ids.estadoItemCompletadoId} AND li.activo = true AND li.deleted_at IS NULL AND li.importe IS NOT NULL
          AND li.tipo_expensa_id IS NOT NULL AND l.periodo = ${periodoAntE} AND l.propiedad_id IN (${Prisma.join(propIdsExp)})
        `);
        const expAntList = Array.isArray(itemsExpAnt) ? itemsExpAnt : [itemsExpAnt].filter(Boolean);
        for (const it of expAntList) {
          const cod = it.codigo;
          if (cod && it.propiedad_id) importeAnteriorPorExpensa.set(`${it.propiedad_id}-${cod}`, parseFloat(it.importe));
        }
      }
    }

    // Agrupar impuestos por tipo de impuesto
    const impuestosAgrupados = new Map();

    for (const item of impuestosItems) {
      let tipoImpuesto = null;
      let codigo = null;
      let nombre = null;

      if (item.propiedadImpuesto?.tipoImpuesto) {
        // Es un impuesto de propiedad
        tipoImpuesto = item.propiedadImpuesto.tipoImpuesto;
        codigo = tipoImpuesto.codigo;
        nombre = tipoImpuesto.nombre;
      } else if (item.tipoCargo) {
        // Es un cargo (no expensas)
        codigo = item.tipoCargo.codigo;
        nombre = item.tipoCargo.nombre;
      }

      if (!codigo) continue;

      if (!impuestosAgrupados.has(codigo)) {
        impuestosAgrupados.set(codigo, {
          tipoImpuesto: {
            id: tipoImpuesto?.id || item.tipoCargo?.id || 0,
            codigo: codigo,
            nombre: nombre
          },
          items: []
        });
      }

      const propiedad = item.liquidacion?.propiedad;
      if (!propiedad) continue;

      const inquilino = item.liquidacion.contrato?.inquilino;

      // Construir dirección de la propiedad
      const direccion = [
        propiedad.dirCalle,
        propiedad.dirNro,
        propiedad.dirPiso && `Piso ${propiedad.dirPiso}`,
        propiedad.dirDepto && `Depto ${propiedad.dirDepto}`
      ].filter(Boolean).join(' ');

      const localidad = propiedad.localidad?.nombre || '';
      const provincia = propiedad.provincia?.nombre || propiedad.localidad?.provincia?.nombre || '';
      const direccionCompleta = `${direccion}${localidad ? `, ${localidad}` : ''}${provincia ? `, ${provincia}` : ''}`;

      // Construir nombre del inquilino
      const nombreInquilino = inquilino
        ? (inquilino.razonSocial || `${inquilino.apellido || ''}, ${inquilino.nombre || ''}`.trim() || 'Sin nombre')
        : 'Sin inquilino';

      // Construir datos del impuesto (campos) - solo para impuestos de propiedad
      const datosImpuesto = [];
      if (item.propiedadImpuesto?.campos) {
        for (const campo of item.propiedadImpuesto.campos) {
          if (campo.tipoCampo) {
            datosImpuesto.push({
              codigo: campo.tipoCampo.codigo,
              nombre: campo.tipoCampo.nombre,
              valor: campo.valor
            });
          }
        }
      }

      const keyAnterior = item.propiedadImpuestoId && propiedad?.id
        ? `${item.propiedadImpuestoId}-${propiedad.id}`
        : null;
      const importeAnteriorRecalc = keyAnterior ? (importeAnteriorPorImpuesto.get(keyAnterior) ?? null) : (item.importeAnterior ? parseFloat(item.importeAnterior) : null);

      impuestosAgrupados.get(codigo).items.push({
        itemId: item.id,
        propiedad: direccionCompleta,
        inquilino: nombreInquilino,
        periodoRef: item.periodoRef,
        datosImpuesto: datosImpuesto,
        importe: item.importe ? parseFloat(item.importe) : null,
        importeAnterior: importeAnteriorRecalc,
        estadoItemId: item.estadoItemId,
        estadoItem: item.estadoItem ? { id: item.estadoItem.id, codigo: item.estadoItem.codigo } : null,
        vencimiento: item.vencimiento,
        actorFacturadoId: item.actorFacturadoId,
        quienSoportaCostoId: item.quienSoportaCostoId,
        pagadoPorActorId: item.pagadoPorActorId,
        actorFacturado: item.actorFacturado ? {
          id: item.actorFacturado.id,
          codigo: item.actorFacturado.codigo,
          nombre: item.actorFacturado.nombre
        } : null,
        quienSoportaCosto: item.quienSoportaCosto ? {
          id: item.quienSoportaCosto.id,
          codigo: item.quienSoportaCosto.codigo,
          nombre: item.quienSoportaCosto.nombre
        } : null,
        pagadoPorActor: item.pagadoPorActor ? {
          id: item.pagadoPorActor.id,
          codigo: item.pagadoPorActor.codigo,
          nombre: item.pagadoPorActor.nombre
        } : null
      });
    }

    // Agrupar expensas por propiedad
    const expensasAgrupadas = new Map();

    for (const item of expensasItems) {
      const propiedad = item.liquidacion?.propiedad;
      if (!propiedad) continue;

      const propiedadId = propiedad.id;
      const inquilino = item.liquidacion.contrato?.inquilino;

      // Construir dirección de la propiedad
      const direccion = [
        propiedad.dirCalle,
        propiedad.dirNro,
        propiedad.dirPiso && `Piso ${propiedad.dirPiso}`,
        propiedad.dirDepto && `Depto ${propiedad.dirDepto}`
      ].filter(Boolean).join(' ');

      const localidad = propiedad.localidad?.nombre || '';
      const provincia = propiedad.provincia?.nombre || propiedad.localidad?.provincia?.nombre || '';
      const direccionCompleta = `${direccion}${localidad ? `, ${localidad}` : ''}${provincia ? `, ${provincia}` : ''}`;

      // Construir nombre del inquilino
      const nombreInquilino = inquilino
        ? (inquilino.razonSocial || `${inquilino.apellido || ''}, ${inquilino.nombre || ''}`.trim() || 'Sin nombre')
        : 'Sin inquilino';

      if (!expensasAgrupadas.has(propiedadId)) {
        expensasAgrupadas.set(propiedadId, {
          propiedad: direccionCompleta,
          inquilino: nombreInquilino,
          periodoRef: item.periodoRef,
          importeORD: null,
          importeEXT: null,
          importeAnteriorORD: null,
          importeAnteriorEXT: null,
          itemIdORD: null,
          itemIdEXT: null,
          estadoItemORD: null,
          estadoItemEXT: null,
          pagadoPorActorIdORD: null,
          pagadoPorActorIdEXT: null,
          quienSoportaCostoIdORD: null,
          quienSoportaCostoIdEXT: null,
          pagadoPorActorORD: null,
          pagadoPorActorEXT: null,
          quienSoportaCostoORD: null,
          quienSoportaCostoEXT: null,
          vencimientoORD: null,
          vencimientoEXT: null
        });
      }

      const expensa = expensasAgrupadas.get(propiedadId);
      const tipoExpensaCodigo = item.tipoExpensa?.codigo;

      if (tipoExpensaCodigo === 'ORD') {
        expensa.importeORD = item.importe ? parseFloat(item.importe) : null;
        expensa.importeAnteriorORD = (propiedadId && importeAnteriorPorExpensa.has(`${propiedadId}-ORD`))
          ? importeAnteriorPorExpensa.get(`${propiedadId}-ORD`)
          : (item.importeAnterior ? parseFloat(item.importeAnterior) : null);
        expensa.itemIdORD = item.id;
        expensa.estadoItemORD = item.estadoItem ? { id: item.estadoItem.id, codigo: item.estadoItem.codigo } : null;
        expensa.pagadoPorActorIdORD = item.pagadoPorActorId;
        expensa.quienSoportaCostoIdORD = item.quienSoportaCostoId;
        expensa.pagadoPorActorORD = item.pagadoPorActor ? {
          id: item.pagadoPorActor.id,
          codigo: item.pagadoPorActor.codigo,
          nombre: item.pagadoPorActor.nombre
        } : null;
        expensa.quienSoportaCostoORD = item.quienSoportaCosto ? {
          id: item.quienSoportaCosto.id,
          codigo: item.quienSoportaCosto.codigo,
          nombre: item.quienSoportaCosto.nombre
        } : null;
        expensa.vencimientoORD = item.vencimiento;
      } else if (tipoExpensaCodigo === 'EXT') {
        expensa.importeEXT = item.importe ? parseFloat(item.importe) : null;
        expensa.importeAnteriorEXT = (propiedadId && importeAnteriorPorExpensa.has(`${propiedadId}-EXT`))
          ? importeAnteriorPorExpensa.get(`${propiedadId}-EXT`)
          : (item.importeAnterior ? parseFloat(item.importeAnterior) : null);
        expensa.itemIdEXT = item.id;
        expensa.estadoItemEXT = item.estadoItem ? { id: item.estadoItem.id, codigo: item.estadoItem.codigo } : null;
        expensa.pagadoPorActorIdEXT = item.pagadoPorActorId;
        expensa.quienSoportaCostoIdEXT = item.quienSoportaCostoId;
        expensa.pagadoPorActorEXT = item.pagadoPorActor ? {
          id: item.pagadoPorActor.id,
          codigo: item.pagadoPorActor.codigo,
          nombre: item.pagadoPorActor.nombre
        } : null;
        expensa.quienSoportaCostoEXT = item.quienSoportaCosto ? {
          id: item.quienSoportaCosto.id,
          codigo: item.quienSoportaCosto.codigo,
          nombre: item.quienSoportaCosto.nombre
        } : null;
        expensa.vencimientoEXT = item.vencimiento;
      }
    }

    // Convertir Maps a Arrays y ordenar
    const impuestosResultado = Array.from(impuestosAgrupados.values()).sort((a, b) => {
      return a.tipoImpuesto.codigo.localeCompare(b.tipoImpuesto.codigo);
    });

    const expensasResultado = Array.from(expensasAgrupadas.values()).sort((a, b) => {
      return a.propiedad.localeCompare(b.propiedad);
    });

    // Retornar ambos grupos
    res.json({
      impuestos: impuestosResultado,
      expensas: expensasResultado
    });

  } catch (error) {
    console.error('Error al obtener impuestos pendientes:', error);
    res.status(500).json({
      error: 'Error al obtener impuestos pendientes',
      detalles: error.message
    });
  }
};

/**
 * Endpoint: PATCH /liquidacion-items/:id
 * Completa el importe de un item de liquidación (impuesto)
 */
export const completarImporteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { importe, actorFacturadoId, quienSoportaCostoId, pagadoPorActorId, vencimiento } = req.body;
    const usuarioId = req.user?.id || null;

    // Validar importe si se proporciona (incluye 0: guardar con importe 0 y marcar como completado)
    let importeNum = null;
    if (importe !== undefined && importe !== null && importe !== '') {
      importeNum = parseFloat(importe);
      if (isNaN(importeNum) || importeNum < 0) {
        return res.status(400).json({ error: 'El importe debe ser un número mayor o igual a 0' });
      }
    }
    // Asegurar que 0 explícito (número o string) se trate como valor válido
    if (importe === 0 || importe === '0') importeNum = 0;

    const itemIdNum = parseInt(id);
    if (isNaN(itemIdNum)) {
      return res.status(400).json({ error: 'ID de item inválido' });
    }

    // Obtener el item con raw para evitar P2022 (columna 'existe' no existe en la BD)
    const itemRows = await prisma.$queryRaw(Prisma.sql`
      SELECT * FROM liquidacion_items WHERE id = ${itemIdNum} AND deleted_at IS NULL
    `);
    const itemRow = Array.isArray(itemRows) ? itemRows[0] : itemRows;
    if (!itemRow) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }
    const item = rowToCamel(itemRow);

    if (!item.activo || item.deletedAt) {
      return res.status(400).json({ error: 'El item no está activo' });
    }

    const ids = await getIds();
    if (!ids.estadoItemCompletadoId) {
      return res.status(500).json({ error: 'No se encontró el estado COMPLETADO' });
    }

    // Preparar datos de actualización
    const updateData = {
      updatedById: usuarioId
    };

    // Si se proporciona importe, actualizar importe y estado si corresponde
    if (importeNum !== null) {
      // Nota: No modificamos importeAnterior aquí porque ese campo representa
      // el importe del mismo item en el período anterior, no el valor previo a la edición.
      // El importeAnterior se calcula al crear el item o al consultar los datos.

      updateData.importe = importeNum;
      
      // Si el item no está completado, completarlo al actualizar el importe (comparar por id)
      if (item.estadoItemId !== ids.estadoItemCompletadoId) {
        updateData.estadoItemId = ids.estadoItemCompletadoId;
        updateData.completadoAt = new Date();
        updateData.completadoById = usuarioId;
      }
      // Si ya está completado, mantener el estado pero actualizar fechas si es necesario
      else if (!item.completadoAt) {
        updateData.completadoAt = new Date();
        updateData.completadoById = usuarioId;
      }
    } else if (importe !== undefined) {
      // Si se envía importe vacío/null, permitir actualizar sin cambiar estado
      if (importe === null || importe === '') {
        updateData.importe = null;
        // Si se está limpiando el importe y el item está completado, volver a PENDIENTE
        if (item.estadoItemId === ids.estadoItemCompletadoId && ids.estadoItemPendienteId) {
          updateData.estadoItemId = ids.estadoItemPendienteId;
          updateData.completadoAt = null;
          updateData.completadoById = null;
        }
      }
    }

    // Si se proporcionan actorFacturadoId o quienSoportaCostoId, actualizarlos
    if (actorFacturadoId !== undefined && actorFacturadoId !== null && actorFacturadoId !== '') {
      updateData.actorFacturadoId = parseInt(actorFacturadoId);
    }
    if (quienSoportaCostoId !== undefined && quienSoportaCostoId !== null && quienSoportaCostoId !== '') {
      updateData.quienSoportaCostoId = parseInt(quienSoportaCostoId);
    }
    
    // Si se proporciona pagadoPorActorId, actualizarlo
    if (pagadoPorActorId !== undefined) {
      if (pagadoPorActorId !== null && pagadoPorActorId !== '') {
        updateData.pagadoPorActorId = parseInt(pagadoPorActorId);
      } else {
        // Permitir limpiar el campo si se envía null o string vacío
        updateData.pagadoPorActorId = null;
      }
    }
    
    // Si se proporciona vencimiento, actualizarlo
    if (vencimiento !== undefined) {
      if (vencimiento !== null && vencimiento !== '') {
        updateData.vencimiento = new Date(vencimiento);
      } else {
        // Permitir limpiar el campo si se envía null o string vacío
        updateData.vencimiento = null;
      }
    }

    // Actualizar el item
    const itemActualizado = await prisma.liquidacionItem.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        estadoItem: true
      }
    });

    // Recalcular total de la liquidación (raw evita P2022)
    const itemsActivosRows = await prisma.$queryRaw(Prisma.sql`SELECT importe FROM liquidacion_items WHERE liquidacion_id = ${item.liquidacionId} AND activo = true AND deleted_at IS NULL`);
    const itemsActivosList = Array.isArray(itemsActivosRows) ? itemsActivosRows : [itemsActivosRows].filter(Boolean);
    const nuevoTotal = itemsActivosList.reduce((sum, it) => sum + (it.importe ? parseFloat(it.importe) : 0), 0);

    // Actualizar total de la liquidación (raw evita P2022)
    await prisma.$executeRaw(Prisma.sql`UPDATE liquidaciones SET total = ${nuevoTotal}, updated_at = NOW(), updated_by_id = ${usuarioId} WHERE id = ${item.liquidacionId}`);

    res.json({
      ok: true,
      item: {
        id: itemActualizado.id,
        importe: itemActualizado.importe ? parseFloat(itemActualizado.importe) : null,
        importeAnterior: itemActualizado.importeAnterior ? parseFloat(itemActualizado.importeAnterior) : null,
        estadoItem: itemActualizado.estadoItem?.codigo ?? null,
        completadoAt: itemActualizado.completadoAt
      },
      liquidacion: {
        id: item.liquidacionId,
        total: nuevoTotal
      }
    });

  } catch (error) {
    console.error('Error al completar importe del item:', error);
    res.status(500).json({
      error: 'Error al completar importe del item',
      detalles: error.message
    });
  }
};

/**
 * Endpoint: POST /items/batch-completar
 * Completa importes de múltiples items en una sola transacción ACID.
 * Body: { items: [{ itemId, importe?, actorFacturadoId?, quienSoportaCostoId?, pagadoPorActorId?, vencimiento? }] }
 */
export const completarImportesBatch = async (req, res) => {
  try {
    const { items: itemsPayload } = req.body || {};
    const usuarioId = req.user?.id ?? null;

    if (!Array.isArray(itemsPayload) || itemsPayload.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array "items" con al menos un elemento' });
    }

    const ids = await getIds();
    if (!ids.estadoItemCompletadoId || !ids.estadoItemPendienteId) {
      return res.status(500).json({ error: 'No se encontraron estados COMPLETADO/PENDIENTE' });
    }

    const itemIds = itemsPayload
      .map((p) => (p.itemId != null ? parseInt(p.itemId, 10) : NaN))
      .filter((id) => !isNaN(id));
    if (itemIds.length === 0) {
      return res.status(400).json({ error: 'Todos los itemId son inválidos' });
    }

    const itemsDb = await prisma.liquidacionItem.findMany({
      where: { id: { in: itemIds }, activo: true, deletedAt: null },
      select: {
        id: true,
        liquidacionId: true,
        estadoItemId: true,
        completadoAt: true
      }
    });
    const itemMap = new Map(itemsDb.map((i) => [i.id, i]));

    const transacciones = [];
    const liquidacionIds = new Set();

    for (const p of itemsPayload) {
      const itemId = p.itemId != null ? parseInt(p.itemId, 10) : NaN;
      if (isNaN(itemId)) continue;

      const item = itemMap.get(itemId);
      if (!item) continue;

      const updateData = buildUpdateDataForItem(item, p, ids, usuarioId);
      if (!updateData || Object.keys(updateData).length <= 1) continue;

      transacciones.push(
        prisma.liquidacionItem.update({
          where: { id: itemId },
          data: updateData
        })
      );
      liquidacionIds.add(item.liquidacionId);
    }

    if (transacciones.length === 0) {
      return res.json({ ok: true, actualizados: 0, mensaje: 'Ningún item válido para actualizar' });
    }

    await prisma.$transaction(transacciones);

    for (const lid of liquidacionIds) {
      const itemsActivosRows = await prisma.$queryRaw(Prisma.sql`
        SELECT importe FROM liquidacion_items WHERE liquidacion_id = ${lid} AND activo = true AND deleted_at IS NULL
      `);
      const list = Array.isArray(itemsActivosRows) ? itemsActivosRows : [itemsActivosRows].filter(Boolean);
      const total = list.reduce((sum, it) => sum + (it.importe ? parseFloat(it.importe) : 0), 0);
      await prisma.$executeRaw(Prisma.sql`
        UPDATE liquidaciones SET total = ${total}, updated_at = NOW(), updated_by_id = ${usuarioId} WHERE id = ${lid}
      `);
    }

    res.json({ ok: true, actualizados: transacciones.length });
  } catch (error) {
    console.error('Error en completarImportesBatch:', error);
    res.status(500).json({
      error: 'Error al completar importes en lote',
      detalles: error.message
    });
  }
};

/**
 * Crea un ítem de liquidación manual (incidencia).
 * POST /api/liquidaciones/incidencias
 * Body: { propiedadId, periodo, concepto, importe, tipoCargoId?, tipoImpuestoId?, fechaGasto?, pagadoPorActorId?, quienSoportaCostoId? }
 */
export const crearIncidencia = async (req, res) => {
  try {
    const {
      propiedadId,
      periodo,
      concepto,
      importe,
      tipoCargoId,
      tipoImpuestoId,
      fechaGasto,
      pagadoPorActorId,
      quienSoportaCostoId
    } = req.body;
    const usuarioId = req.user?.id ?? null;

    if (!propiedadId || !periodo) {
      return res.status(400).json({ error: 'propiedadId y periodo son requeridos' });
    }
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      return res.status(400).json({ error: 'periodo debe ser YYYY-MM' });
    }
    const importeNum = importe !== undefined && importe !== null && importe !== '' ? parseFloat(importe) : null;
    if (importeNum === null || isNaN(importeNum) || importeNum < 0) {
      return res.status(400).json({ error: 'importe debe ser un número mayor o igual a 0' });
    }

    const ids = await getIds();
    if (!ids.estadoItemCompletadoId) {
      return res.status(500).json({ error: 'No se encontró el estado COMPLETADO' });
    }

    const propiedad = await prisma.propiedad.findFirst({
      where: { id: parseInt(propiedadId), activo: true, deletedAt: null }
    });
    if (!propiedad) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    let tipoCargoFinal = null;
    let propiedadImpuestoId = null;
    if (tipoImpuestoId) {
      const propImpuesto = await prisma.propiedadImpuesto.findFirst({
        where: {
          propiedadId: parseInt(propiedadId),
          tipoImpuestoId: parseInt(tipoImpuestoId),
          activo: true,
          deletedAt: null
        }
      });
      if (!propImpuesto) {
        return res.status(400).json({ error: 'La propiedad no tiene configurado este tipo de impuesto' });
      }
      propiedadImpuestoId = propImpuesto.id;
    } else if (tipoCargoId) {
      tipoCargoFinal = await prisma.tipoCargo.findFirst({
        where: { id: parseInt(tipoCargoId), activo: true, deletedAt: null }
      });
      if (!tipoCargoFinal) {
        return res.status(400).json({ error: 'tipoCargoId no encontrado o inactivo' });
      }
    }
    if (!tipoCargoFinal && !propiedadImpuestoId) {
      tipoCargoFinal = await prisma.tipoCargo.findFirst({
        where: { codigo: 'INCIDENCIA', activo: true, deletedAt: null }
      });
      if (!tipoCargoFinal) {
        return res.status(500).json({ error: 'No se encontró el tipo de cargo INCIDENCIA. Ejecute el seed.' });
      }
    }

    let vencimientoDate = null;
    if (fechaGasto) {
      const parsed = new Date(fechaGasto);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'fechaGasto debe ser una fecha válida (YYYY-MM-DD)' });
      }
      vencimientoDate = parsed;
    }

    if (pagadoPorActorId != null && pagadoPorActorId !== '') {
      const actor = await prisma.actorResponsableContrato.findFirst({
        where: { id: parseInt(pagadoPorActorId), activo: true, deletedAt: null }
      });
      if (!actor) {
        return res.status(400).json({ error: 'pagadoPorActorId no encontrado o inactivo' });
      }
    }
    if (quienSoportaCostoId != null && quienSoportaCostoId !== '') {
      const actor = await prisma.actorResponsableContrato.findFirst({
        where: { id: parseInt(quienSoportaCostoId), activo: true, deletedAt: null }
      });
      if (!actor) {
        return res.status(400).json({ error: 'quienSoportaCostoId no encontrado o inactivo' });
      }
    }

    // Calcular vencimientos automáticos
    const vencimientosAuto = calcularVencimientosAutomaticos(periodo);

    const liquidacion = await prisma.liquidacion.upsert({
      where: {
        unique_propiedad_periodo: {
          propiedadId: parseInt(propiedadId),
          periodo
        }
      },
      create: {
        propiedadId: parseInt(propiedadId),
        periodo,
        estadoLiquidacionId: ids.estadoLiquidacionBorradorId,
        total: importeNum,
        vencimiento: vencimientosAuto.vencimiento,
        vencimiento2: vencimientosAuto.vencimiento2,
        interes2: vencimientosAuto.interes2,
        vencimiento3: vencimientosAuto.vencimiento3,
        interes3: vencimientosAuto.interes3,
        autoGenerada: false,
        createdById: usuarioId
      },
      update: {},
      include: { items: { where: { activo: true, deletedAt: null } } }
    });

    const pagadoPorId = pagadoPorActorId != null && pagadoPorActorId !== ''
      ? parseInt(pagadoPorActorId)
      : ids.actorINMId ?? null;
    const quienSoportaId = quienSoportaCostoId != null && quienSoportaCostoId !== ''
      ? parseInt(quienSoportaCostoId)
      : ids.actorINQId ?? null;
    const afectaSaldo = ids.actorINQId != null && quienSoportaId === ids.actorINQId;

    const itemData = {
      liquidacionId: liquidacion.id,
      periodoRef: periodo,
      importe: importeNum,
      vencimiento: vencimientoDate,
      observaciones: concepto && String(concepto).trim() ? String(concepto).trim() : null,
      estadoItemId: ids.estadoItemCompletadoId,
      quienSoportaCostoId: quienSoportaId,
      pagadoPorActorId: pagadoPorId,
      visibleEnBoletaInquilino: true,
      afectaSaldoInquilino: afectaSaldo,
      createdById: usuarioId
    };
    if (propiedadImpuestoId) {
      itemData.propiedadImpuestoId = propiedadImpuestoId;
      itemData.tipoCargoId = null;
    } else {
      itemData.tipoCargoId = tipoCargoFinal.id;
    }
    const item = await prisma.liquidacionItem.create({
      data: itemData
    });

    const itemsActivosRows = await prisma.$queryRaw(Prisma.sql`SELECT importe FROM liquidacion_items WHERE liquidacion_id = ${liquidacion.id} AND activo = true AND deleted_at IS NULL`);
    const itemsActivosList = Array.isArray(itemsActivosRows) ? itemsActivosRows : [itemsActivosRows].filter(Boolean);
    const nuevoTotal = itemsActivosList.reduce((sum, it) => sum + (it.importe ? parseFloat(it.importe) : 0), 0);
    await prisma.$executeRaw(Prisma.sql`UPDATE liquidaciones SET total = ${nuevoTotal}, updated_at = NOW(), updated_by_id = ${usuarioId} WHERE id = ${liquidacion.id}`);

    res.status(201).json({
      ok: true,
      item: {
        id: item.id,
        liquidacionId: liquidacion.id,
        concepto: item.observaciones,
        importe: parseFloat(item.importe)
      }
    });
  } catch (error) {
    console.error('Error al crear incidencia:', error);
    res.status(500).json({ error: 'Error al crear incidencia: ' + error.message });
  }
};

/**
 * Endpoint: GET /liquidaciones/boleta-inquilino
 * Obtiene la boleta del inquilino (neto a pagar) para un contrato y período
 * Aplica las reglas A-F para determinar qué items incluir y con qué signo
 */
export const getBoletaInquilino = async (req, res) => {
  try {
    const { contratoId, propiedadId, periodo } = req.query;

    if (!periodo) {
      return res.status(400).json({ error: 'El período es requerido' });
    }

    if (!contratoId && !propiedadId) {
      return res.status(400).json({ error: 'Debe proporcionar contratoId o propiedadId' });
    }

    // Validar formato de período
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      return res.status(400).json({ error: 'El período debe tener el formato YYYY-MM' });
    }

    // Construir where clause
    const whereClause = {
      activo: true,
      deletedAt: null,
      OR: [
        { liquidacion: { periodo: periodo } },
        { periodoRef: periodo }
      ]
    };

    // Agregar filtro por contrato o propiedad
    if (contratoId) {
      whereClause.liquidacion = {
        ...whereClause.liquidacion,
        contratoId: parseInt(contratoId)
      };
    } else if (propiedadId) {
      whereClause.liquidacion = {
        ...whereClause.liquidacion,
        propiedadId: parseInt(propiedadId)
      };
    }

    // Obtener todos los items de liquidación para el período
    const items = await prisma.liquidacionItem.findMany({
      where: whereClause,
      include: {
        liquidacion: {
          include: {
            contrato: {
              include: {
                inquilino: true
              }
            },
            propiedad: {
              include: {
                localidad: {
                  include: {
                    provincia: true
                  }
                },
                provincia: true
              }
            }
          }
        },
        propiedadImpuesto: {
          include: {
            tipoImpuesto: true
          }
        },
        tipoCargo: true,
        tipoExpensa: true,
        pagadoPorActor: true,
        quienSoportaCosto: true,
        estadoItem: true
      },
      orderBy: [
        { id: 'asc' }
      ]
    });

    if (items.length === 0) {
      return res.json({
        periodo,
        contratoId: contratoId ? parseInt(contratoId) : null,
        propiedadId: propiedadId ? parseInt(propiedadId) : null,
        items: [],
        total: 0,
        totalCargos: 0,
        totalCreditos: 0,
        advertencias: ['No se encontraron items para el período especificado']
      });
    }

    // Obtener información del contrato/propiedad
    const liquidacion = items[0]?.liquidacion;
    const contrato = liquidacion?.contrato;
    const propiedad = liquidacion?.propiedad;
    const inquilino = contrato?.inquilino;

    // Si hay contrato pero no está VIGENTE, no generar boleta al inquilino (propiedad no alquilada aún)
    const ids = await getIds();
    if (contrato && ids.estadoContratoVigenteId != null && contrato.estadoContratoId !== ids.estadoContratoVigenteId) {
      return res.json({
        periodo,
        contratoId: contratoId ? parseInt(contratoId) : null,
        propiedadId: propiedadId ? parseInt(propiedadId) : null,
        items: [],
        total: 0,
        totalCargos: 0,
        totalCreditos: 0,
        advertencias: ['La boleta al inquilino no aplica: el contrato no está vigente (solo se genera para contratos en estado VIGENTE).']
      });
    }

    // Procesar items aplicando reglas A-F
    const itemsBoleta = [];
    let totalCargos = 0;
    let totalCreditos = 0;
    const advertencias = [];

    for (const item of items) {
      // Verificar si aplica en boleta
      if (!aplicaEnBoletaInquilino(item)) {
        continue;
      }

      // Calcular importe en boleta
      const importeBoleta = importeEnBoleta(item);
      if (importeBoleta === null) {
        continue;
      }

      // Determinar concepto
      let concepto = '';
      if (item.propiedadImpuesto?.tipoImpuesto) {
        concepto = item.propiedadImpuesto.tipoImpuesto.nombre || item.propiedadImpuesto.tipoImpuesto.codigo;
      } else if (item.tipoCargo) {
        concepto = item.tipoCargo.nombre || item.tipoCargo.codigo;
        if (item.tipoExpensa) {
          concepto += ` - ${item.tipoExpensa.nombre || item.tipoExpensa.codigo}`;
        }
      } else {
        concepto = 'Item sin clasificar';
      }

      // Agregar item a la boleta
      itemsBoleta.push({
        id: item.id,
        concepto,
        importe: Math.abs(parseFloat(item.importe || 0)),
        importeBoleta: importeBoleta,
        esCredito: importeBoleta < 0,
        pagadoPor: item.pagadoPorActor ? {
          id: item.pagadoPorActor.id,
          codigo: item.pagadoPorActor.codigo,
          nombre: item.pagadoPorActor.nombre
        } : null,
        quienSoportaCosto: item.quienSoportaCosto ? {
          id: item.quienSoportaCosto.id,
          codigo: item.quienSoportaCosto.codigo,
          nombre: item.quienSoportaCosto.nombre
        } : null,
        vencimiento: item.vencimiento,
        refExterna: item.refExterna,
        observaciones: item.observaciones
      });

      // Acumular totales
      if (importeBoleta > 0) {
        totalCargos += importeBoleta;
      } else {
        totalCreditos += Math.abs(importeBoleta);
      }
    }

    // Verificar items sin pagadoPorActorId
    const itemsSinPagador = items.filter(item => !item.pagadoPorActorId);
    if (itemsSinPagador.length > 0) {
      advertencias.push(`${itemsSinPagador.length} item(s) sin "Pagado por" definido - no incluidos en boleta`);
    }

    // Calcular total neto
    const total = totalCargos - totalCreditos;

    res.json({
      periodo,
      contratoId: contratoId ? parseInt(contratoId) : null,
      propiedadId: propiedadId ? parseInt(propiedadId) : null,
      contrato: contrato ? {
        id: contrato.id,
        numero: contrato.numero
      } : null,
      propiedad: propiedad ? {
        id: propiedad.id,
        direccion: [
          propiedad.dirCalle,
          propiedad.dirNro,
          propiedad.dirPiso && `Piso ${propiedad.dirPiso}`,
          propiedad.dirDepto && `Depto ${propiedad.dirDepto}`
        ].filter(Boolean).join(' '),
        localidad: propiedad.localidad?.nombre || '',
        provincia: propiedad.provincia?.nombre || propiedad.localidad?.provincia?.nombre || ''
      } : null,
      inquilino: inquilino ? {
        id: inquilino.id,
        nombre: inquilino.razonSocial || `${inquilino.apellido || ''}, ${inquilino.nombre || ''}`.trim(),
        dni: inquilino.dni,
        cuit: inquilino.cuit
      } : null,
      items: itemsBoleta,
      total: parseFloat(total.toFixed(2)),
      totalCargos: parseFloat(totalCargos.toFixed(2)),
      totalCreditos: parseFloat(totalCreditos.toFixed(2)),
      advertencias: advertencias.length > 0 ? advertencias : null
    });

  } catch (error) {
    console.error('Error al obtener boleta del inquilino:', error);
    res.status(500).json({
      error: 'Error al obtener boleta del inquilino',
      detalles: error.message
    });
  }
};
