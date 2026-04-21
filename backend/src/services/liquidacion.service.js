/**
 * Capa de servicio para lógica de negocio de liquidaciones.
 * Funciones puras (cálculos, reglas) y lógica que usa BD sin req/res.
 * El controller solo orquesta: parse req → llamar servicio → res.json/catch.
 */

import { Prisma } from '@prisma/client';
import prisma from '../db/prisma.js';
import { getIds } from './parametrosSistema.js';

// ============================================
// HELPERS PUROS (sin BD)
// ============================================

/** Convierte snake_case a camelCase (para filas de $queryRaw). */
export function rowToCamel(row) {
  if (row == null) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    let camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    camel = camel.replace(/_(\d)/g, (_, d) => d);
    out[camel] = v;
  }
  return out;
}

/**
 * N-ésimo día hábil del mes (lun–vie).
 * @param {number} year - Año
 * @param {number} month - Mes (1-12)
 * @param {number} nthBusinessDay
 * @returns {Date}
 */
export function getNthBusinessDay(year, month, nthBusinessDay) {
  let businessDayCount = 0;
  let day = 1;
  while (businessDayCount < nthBusinessDay) {
    const date = new Date(year, month - 1, day);
    if (date.getDay() >= 1 && date.getDay() <= 5) {
      businessDayCount++;
      if (businessDayCount === nthBusinessDay) return date;
    }
    day++;
    if (day > 31) break;
  }
  return new Date(year, month, 0);
}

/**
 * Vencimientos automáticos para un período YYYY-MM.
 * @param {string} periodo
 * @returns {{ vencimiento: Date, vencimiento2: Date, interes2: number, vencimiento3: Date, interes3: number }}
 */
export function calcularVencimientosAutomaticos(periodo) {
  const [year, month] = periodo.split('-').map(Number);
  return {
    vencimiento: getNthBusinessDay(year, month, 10),
    vencimiento2: getNthBusinessDay(year, month, 15),
    interes2: 2.5,
    vencimiento3: getNthBusinessDay(year, month, 20),
    interes3: 2.5
  };
}

/**
 * Indica si un período corresponde según la periodicidad del impuesto.
 * @param {string} codigoPeriodicidad - MENSUAL, BIMESTRAL, TRIMESTRAL, etc.
 * @param {string} periodo - YYYY-MM
 * @returns {boolean}
 */
export function correspondeGenerarPorPeriodicidad(codigoPeriodicidad, periodo) {
  if (!codigoPeriodicidad || !periodo) return false;
  const [, mes] = periodo.split('-').map(Number);
  const m = mes;
  switch (String(codigoPeriodicidad).toUpperCase()) {
    case 'MENSUAL': return true;
    case 'BIMESTRAL': return m % 2 === 0;
    case 'TRIMESTRAL': return m % 3 === 0;
    case 'CUATRIMESTRAL': return m % 4 === 0;
    case 'SEMESTRAL': return m === 6 || m === 12;
    case 'ANUAL': return m === 1;
    default: return true;
  }
}

/**
 * Importe a mostrar en boleta inquilino (positivo = cargo, negativo = crédito).
 * @param {Object} item - con importe, quienSoportaCosto?.codigo, pagadoPorActor?.codigo
 * @returns {number|null}
 */
export function importeEnBoleta(item) {
  const importe = item.importe ? parseFloat(item.importe) : 0;
  if (isNaN(importe) || importe === 0) return null;
  const soporta = item.quienSoportaCosto?.codigo;
  const pagado = item.pagadoPorActor?.codigo;
  if (soporta === 'INQ') return Math.abs(importe);
  if (soporta === 'PROP' && pagado === 'INQ') return -Math.abs(importe);
  return null;
}

/**
 * Meses (YYYY-MM) en que el contrato tiene ajuste debido (fechaInicio + N*frecuencia hasta endOfPeriod).
 * @param {Date|string} fechaInicio
 * @param {number} frecuenciaMeses
 * @param {Date|string} endOfPeriod
 * @returns {Set<string>}
 */
export function mesesConAjusteDebido(fechaInicio, frecuenciaMeses, endOfPeriod) {
  const meses = new Set();
  if (!frecuenciaMeses || frecuenciaMeses < 1) return meses;
  const inicio = new Date(fechaInicio);
  inicio.setHours(0, 0, 0, 0);
  const end = new Date(endOfPeriod);
  end.setHours(23, 59, 59, 999);
  let n = 1;
  const maxIter = 1200;
  while (n < maxIter) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth() + n * frecuenciaMeses, inicio.getDate());
    if (d > end) break;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    meses.add(`${y}-${m}`);
    n++;
  }
  return meses;
}

/**
 * Objeto de actualización para un item (completar/actualizar importe y actores).
 * @param {object} item - de BD (estadoItemId, completadoAt, liquidacionId)
 * @param {object} payload - { importe, actorFacturadoId, quienSoportaCostoId, pagadoPorActorId, vencimiento }
 * @param {object} ids - getIds(): estadoItemCompletadoId, estadoItemPendienteId
 * @param {number|null} usuarioId
 * @returns {object|null} - data para update o null
 */
export function buildUpdateDataForItem(item, payload, ids, usuarioId) {
  const { importe, actorFacturadoId, quienSoportaCostoId, pagadoPorActorId, vencimiento } = payload || {};
  let importeNum = null;
  if (importe !== undefined && importe !== null && importe !== '') {
    importeNum = parseFloat(importe);
    if (isNaN(importeNum) || importeNum < 0) return null;
  }
  if (importe === 0 || importe === '0') importeNum = 0;

  const updateData = { updatedById: usuarioId };
  if (importeNum !== null) {
    updateData.importe = importeNum;
    if (item.estadoItemId !== ids.estadoItemCompletadoId) {
      updateData.estadoItemId = ids.estadoItemCompletadoId;
      updateData.completadoAt = new Date();
      updateData.completadoById = usuarioId;
    } else if (!item.completadoAt) {
      updateData.completadoAt = new Date();
      updateData.completadoById = usuarioId;
    }
  } else if (importe !== undefined && (importe === null || importe === '')) {
    updateData.importe = null;
    if (item.estadoItemId === ids.estadoItemCompletadoId && ids.estadoItemPendienteId) {
      updateData.estadoItemId = ids.estadoItemPendienteId;
      updateData.completadoAt = null;
      updateData.completadoById = null;
    }
  }
  if (actorFacturadoId !== undefined && actorFacturadoId != null && actorFacturadoId !== '') {
    updateData.actorFacturadoId = parseInt(actorFacturadoId);
  }
  if (quienSoportaCostoId !== undefined && quienSoportaCostoId != null && quienSoportaCostoId !== '') {
    updateData.quienSoportaCostoId = parseInt(quienSoportaCostoId);
  }
  if (pagadoPorActorId !== undefined) {
    updateData.pagadoPorActorId = pagadoPorActorId != null && pagadoPorActorId !== '' ? parseInt(pagadoPorActorId) : null;
  }
  if (vencimiento !== undefined) {
    updateData.vencimiento = vencimiento != null && vencimiento !== '' ? new Date(vencimiento) : null;
  }
  return updateData;
}

// ============================================
// LÓGICA DE NEGOCIO CON BD (sin req/res)
// ============================================

/**
 * Completa un item de liquidación (importe + estado COMPLETADO).
 * Recalcula total de la liquidación y, si todos los ítems están completados, pasa a LISTA.
 * @param {number} itemId
 * @param {{ importe: number, observaciones?: string }} payload
 * @param {object} ids - getIds(): estadoItemPendienteId, estadoItemCompletadoId, estadoLiquidacionBorradorId, estadoLiquidacionListaId
 * @param {number|null} usuarioId
 * @returns {Promise<{ item: object, liquidacionEstado: string }>}
 * @throws Error con .code 'NOT_FOUND' o 'VALIDATION'
 */
export async function completarItem(itemId, payload, ids, usuarioId) {
  const idNum = parseInt(itemId, 10);
  if (isNaN(idNum)) {
    const err = new Error('ID de item inválido');
    err.code = 'VALIDATION';
    throw err;
  }
  const { importe, observaciones } = payload || {};
  const importeNum = parseFloat(importe);
  if (isNaN(importeNum) || importeNum < 0) {
    const err = new Error('El importe debe ser un número mayor o igual a 0');
    err.code = 'VALIDATION';
    throw err;
  }

  const itemRows = await prisma.$queryRaw(Prisma.sql`SELECT * FROM liquidacion_items WHERE id = ${idNum} AND activo = true AND deleted_at IS NULL`);
  const itemRow = Array.isArray(itemRows) ? itemRows[0] : itemRows;
  if (!itemRow) {
    const err = new Error('Item no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const item = { ...rowToCamel(itemRow), liquidacionId: itemRow.liquidacion_id };
  const liqRows = await prisma.$queryRaw(Prisma.sql`SELECT id, estado_liquidacion_id FROM liquidaciones WHERE id = ${itemRow.liquidacion_id}`);
  const liqRow = Array.isArray(liqRows) ? liqRows[0] : liqRows;
  item.liquidacion = liqRow ? { id: liqRow.id, estadoLiquidacionId: liqRow.estado_liquidacion_id } : null;

  if (item.estadoItemId !== ids.estadoItemPendienteId) {
    const err = new Error('El item ya está completado o no aplica');
    err.code = 'VALIDATION';
    err.estadoActual = item.estadoItemId;
    throw err;
  }

  const itemActualizado = await prisma.liquidacionItem.update({
    where: { id: idNum },
    data: {
      importe: importeNum,
      estadoItemId: ids.estadoItemCompletadoId,
      completadoAt: new Date(),
      completadoById: usuarioId,
      observaciones: observaciones != null ? observaciones : undefined
    }
  });

  const todosItemsRows = await prisma.$queryRaw(Prisma.sql`SELECT id, importe, estado_item_id FROM liquidacion_items WHERE liquidacion_id = ${item.liquidacionId} AND activo = true AND deleted_at IS NULL`);
  const todosItemsList = Array.isArray(todosItemsRows) ? todosItemsRows : [todosItemsRows].filter(Boolean);
  const nuevoTotal = todosItemsList.reduce((sum, it) => sum + (it.importe ? parseFloat(it.importe) : 0), 0);
  const todosCompletados = todosItemsList.length > 0 && todosItemsList.every(it => it.estado_item_id === ids.estadoItemCompletadoId);
  const nuevoEstadoLiquidacionId = todosCompletados ? ids.estadoLiquidacionListaId : ids.estadoLiquidacionBorradorId;
  await prisma.$executeRaw(Prisma.sql`UPDATE liquidaciones SET total = ${nuevoTotal}, estado_liquidacion_id = ${nuevoEstadoLiquidacionId}, updated_at = NOW() WHERE id = ${item.liquidacionId}`);

  return {
    item: itemActualizado,
    liquidacionEstado: todosCompletados ? 'LISTA' : 'BORRADOR'
  };
}

/**
 * Reabre un item completado (vuelve a PENDIENTE, importe null).
 * No permite reabrir si la liquidación está emitida.
 * @param {number} itemId
 * @param {object} ids - getIds(): estadoItemPendienteId, estadoItemCompletadoId, estadoLiquidacionBorradorId, estadoLiquidacionEmitidaId
 * @returns {Promise<{ item: object }>}
 * @throws Error con .code 'NOT_FOUND' o 'VALIDATION'
 */
export async function reabrirItem(itemId, ids) {
  const idNum = parseInt(itemId, 10);
  if (isNaN(idNum)) {
    const err = new Error('ID de item inválido');
    err.code = 'VALIDATION';
    throw err;
  }

  const itemRows = await prisma.$queryRaw(Prisma.sql`SELECT * FROM liquidacion_items WHERE id = ${idNum} AND activo = true AND deleted_at IS NULL`);
  const itemRow = Array.isArray(itemRows) ? itemRows[0] : itemRows;
  if (!itemRow) {
    const err = new Error('Item no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const item = rowToCamel(itemRow);
  item.liquidacionId = itemRow.liquidacion_id;
  const liqRows = await prisma.$queryRaw(Prisma.sql`SELECT id, estado_liquidacion_id FROM liquidaciones WHERE id = ${itemRow.liquidacion_id}`);
  const liqRow = Array.isArray(liqRows) ? liqRows[0] : liqRows;
  item.liquidacion = liqRow ? { id: liqRow.id, estadoLiquidacionId: liqRow.estado_liquidacion_id } : null;

  if (item.estadoItemId !== ids.estadoItemCompletadoId) {
    const err = new Error('Solo se pueden reabrir items completados');
    err.code = 'VALIDATION';
    err.estadoActual = item.estadoItemId;
    throw err;
  }
  if (item.liquidacion && item.liquidacion.estadoLiquidacionId === ids.estadoLiquidacionEmitidaId) {
    const err = new Error('No se puede reabrir un item de una liquidación ya emitida');
    err.code = 'VALIDATION';
    throw err;
  }

  const itemActualizado = await prisma.liquidacionItem.update({
    where: { id: idNum },
    data: {
      estadoItemId: ids.estadoItemPendienteId,
      importe: null,
      completadoAt: null,
      completadoById: null
    }
  });

  const todosItemsRows = await prisma.$queryRaw(Prisma.sql`SELECT importe FROM liquidacion_items WHERE liquidacion_id = ${item.liquidacionId} AND activo = true AND deleted_at IS NULL`);
  const todosItemsList = Array.isArray(todosItemsRows) ? todosItemsRows : [todosItemsRows].filter(Boolean);
  const nuevoTotal = todosItemsList.reduce((sum, it) => sum + (it.importe ? parseFloat(it.importe) : 0), 0);
  await prisma.$executeRaw(Prisma.sql`UPDATE liquidaciones SET total = ${nuevoTotal}, estado_liquidacion_id = ${ids.estadoLiquidacionBorradorId}, updated_at = NOW() WHERE id = ${item.liquidacionId}`);

  return { item: itemActualizado };
}

// ============================================
// CONCILIACIÓN FIFO (cobros genéricos → liquidaciones emitidas)
// ============================================

/**
 * Marca como SALDADAS las liquidaciones emitidas del contrato que queden cubiertas
 * por el monto ingresado, en orden FIFO (por vencimiento/período más antiguo primero).
 * Pensado para ejecutarse tras registrar un cobro genérico (CRÉDITO) en la cuenta del inquilino.
 *
 * @param {object} tx - Cliente de transacción de Prisma (prisma en caso de uso fuera de transacción)
 * @param {number} contratoId - Contrato del inquilino
 * @param {number} montoNuevo - Importe del cobro recién registrado a aplicar
 * @returns {{ liquidacionesSaldadas: number, montoAplicado: number }}
 */
export async function conciliarLiquidaciones(tx, contratoId, montoNuevo) {
  const ids = await getIds();
  const estadoEmitidaId = ids.estadoLiquidacionEmitidaId;
  const estadoSaldadaId = ids.estadoLiquidacionPagadaId;

  if (!estadoEmitidaId || !estadoSaldadaId) {
    return { liquidacionesSaldadas: 0, montoAplicado: 0 };
  }

  const liquidaciones = await tx.liquidacion.findMany({
    where: {
      contratoId,
      estadoLiquidacionId: estadoEmitidaId,
      activo: true,
      deletedAt: null
    },
    orderBy: [
      { vencimiento: 'asc' },
      { periodo: 'asc' }
    ],
    select: { id: true, total: true }
  });

  const toNum = (v) => {
    if (v == null) return 0;
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v?.toNumber === 'function') return v.toNumber();
    const n = parseFloat(String(v));
    return Number.isNaN(n) ? 0 : n;
  };

  const EPS = 0.01; // tolerancia por redondeo
  let saldoDisponible = toNum(montoNuevo);
  let liquidacionesSaldadas = 0;
  let montoAplicado = 0;

  for (const liq of liquidaciones) {
    if (saldoDisponible < EPS) break;
    const totalLiq = toNum(liq.total);
    if (totalLiq < EPS) continue;
    if (saldoDisponible >= totalLiq - EPS) {
      await tx.liquidacion.update({
        where: { id: liq.id },
        data: { estadoLiquidacionId: estadoSaldadaId }
      });
      saldoDisponible -= totalLiq;
      liquidacionesSaldadas += 1;
      montoAplicado += totalLiq;
    } else {
      break;
    }
  }

  return { liquidacionesSaldadas, montoAplicado };
}
