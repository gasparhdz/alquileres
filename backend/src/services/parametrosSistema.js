/**
 * Resuelve y cachea los IDs de parámetros/catálogos que usa la lógica de negocio.
 * Se busca por código una sola vez; después se usa solo el id (el código puede ser editado por el usuario).
 */

import prisma from '../db/prisma.js';
let cache = null;

export async function getIds() {
  if (cache) return cache;

  const [
    estadoLiquidacionBorrador,
    estadoLiquidacionLista,
    estadoLiquidacionEmitida,
    estadoLiquidacionPagada,
    estadoItemPendiente,
    estadoItemCompletado,
    estadoContratoVigente,
    actorINM,
    actorINQ,
    actorPROP,
    tipoCargoAlquiler,
    tipoCargoGastosAdmin,
    tipoCargoHonorarios
  ] = await Promise.all([
    prisma.estadoLiquidacion.findFirst({ where: { codigo: 'BORRADOR', activo: true }, select: { id: true } }),
    prisma.estadoLiquidacion.findFirst({ where: { codigo: 'LISTA', activo: true }, select: { id: true } }),
    prisma.estadoLiquidacion.findFirst({ where: { codigo: 'EMITIDA', activo: true }, select: { id: true } }),
    prisma.estadoLiquidacion.findFirst({ where: { codigo: 'SALDADA', activo: true }, select: { id: true } }),
    prisma.estadoItemLiquidacion.findFirst({ where: { codigo: 'PENDIENTE', activo: true }, select: { id: true } }),
    prisma.estadoItemLiquidacion.findFirst({ where: { codigo: 'COMPLETADO', activo: true }, select: { id: true } }),
    prisma.estadoContrato.findFirst({ where: { codigo: 'VIGENTE', activo: true }, select: { id: true } }),
    prisma.actorResponsableContrato.findFirst({ where: { codigo: 'INM', activo: true }, select: { id: true } }),
    prisma.actorResponsableContrato.findFirst({ where: { codigo: 'INQ', activo: true }, select: { id: true } }),
    prisma.actorResponsableContrato.findFirst({ where: { codigo: 'PROP', activo: true }, select: { id: true } }),
    prisma.tipoCargo.findFirst({ where: { codigo: 'ALQUILER', activo: true }, select: { id: true } }),
    prisma.tipoCargo.findFirst({ where: { codigo: 'GASTOS_ADMINISTRATIVOS', activo: true }, select: { id: true } }),
    prisma.tipoCargo.findFirst({ where: { codigo: 'HONORARIOS', activo: true }, select: { id: true } })
  ]);

  cache = {
    estadoLiquidacionBorradorId: estadoLiquidacionBorrador?.id ?? null,
    estadoContratoVigenteId: estadoContratoVigente?.id ?? null,
    estadoLiquidacionListaId: estadoLiquidacionLista?.id ?? null,
    estadoLiquidacionEmitidaId: estadoLiquidacionEmitida?.id ?? null,
    estadoLiquidacionPagadaId: estadoLiquidacionPagada?.id ?? null,
    estadoItemPendienteId: estadoItemPendiente?.id ?? null,
    estadoItemCompletadoId: estadoItemCompletado?.id ?? null,
    actorINMId: actorINM?.id ?? null,
    actorINQId: actorINQ?.id ?? null,
    actorPROPId: actorPROP?.id ?? null,
    tipoCargoAlquilerId: tipoCargoAlquiler?.id ?? null,
    tipoCargoGastosAdministrativosId: tipoCargoGastosAdmin?.id ?? null,
    tipoCargoHonorariosId: tipoCargoHonorarios?.id ?? null
  };
  return cache;
}

/** Invalida la caché (p. ej. después de cambiar parámetros en tests o migraciones). */
export function clearCache() {
  cache = null;
}
