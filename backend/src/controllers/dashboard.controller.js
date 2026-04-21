import { Prisma } from '@prisma/client';
import prisma from '../db/prisma.js';

const DIAS_PROXIMOS_DEFAULT = 15;
const DIAS_VENCIMIENTO_CONTRATOS_DEFAULT = 60;

/**
 * GET /api/dashboard/ajustes-pendientes?modo=vencidos|proximos&dias=15
 * Contratos VIGENTES con frecuenciaAjusteMeses que tienen ajuste pendiente (vencido o próximo).
 * fechaBase = COALESCE(MAX(fecha_ajuste) de ajustes activos, fecha_inicio)
 * proximaFechaAjuste = fechaBase + frecuencia_ajuste_meses months
 */
export const getAjustesPendientes = async (req, res) => {
  try {
    const modo = (req.query.modo || 'todos').toLowerCase(); // vencidos | proximos | todos
    const dias = Math.min(365, Math.max(0, parseInt(req.query.dias, 10) || DIAS_PROXIMOS_DEFAULT));

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limiteProximos = new Date(hoy);
    limiteProximos.setDate(limiteProximos.getDate() + dias);

    const raw = await prisma.$queryRaw`
      WITH base AS (
        SELECT
          c.id AS "contratoId",
          c.fecha_inicio AS "fechaInicio",
          c.frecuencia_ajuste_meses AS "frecuenciaAjusteMeses",
          COALESCE(
            (SELECT a.monto_nuevo FROM contrato_ajuste a
             WHERE a.contrato_id = c.id AND a.activo = true AND a.deleted_at IS NULL
             ORDER BY a.fecha_ajuste DESC LIMIT 1),
            c.monto_inicial
          ) AS "montoActual",
          COALESCE(
            (SELECT MAX(a.fecha_ajuste) FROM contrato_ajuste a
             WHERE a.contrato_id = c.id AND a.activo = true AND a.deleted_at IS NULL),
            c.fecha_inicio
          ) AS "fechaBase",
          (COALESCE(
            (SELECT MAX(a.fecha_ajuste) FROM contrato_ajuste a
             WHERE a.contrato_id = c.id AND a.activo = true AND a.deleted_at IS NULL),
            c.fecha_inicio
          ) + (c.frecuencia_ajuste_meses || ' months')::interval)::date AS "proximaFechaAjuste"
        FROM contratos c
        INNER JOIN estados_contrato e ON e.id = c.estado_contrato_id AND e.codigo = 'VIGENTE' AND e.activo = true
        WHERE c.activo = true
          AND c.deleted_at IS NULL
          AND c.frecuencia_ajuste_meses IS NOT NULL
      )
      SELECT
        b."contratoId",
        b."fechaInicio",
        b."frecuenciaAjusteMeses",
        b."montoActual",
        b."fechaBase",
        b."proximaFechaAjuste",
        (b."proximaFechaAjuste" - current_date) AS "diasRestantes"
      FROM base b
    `;

    const rows = raw.map((r) => ({
      contratoId: r.contratoId,
      fechaInicio: r.fechaInicio,
      frecuenciaAjusteMeses: r.frecuenciaAjusteMeses,
      montoActual: Number(r.montoActual),
      fechaBase: r.fechaBase,
      proximaFechaAjuste: r.proximaFechaAjuste,
      diasRestantes: r.diasRestantes != null ? Number(r.diasRestantes) : null
    }));

    let filtered = rows;
    if (modo === 'vencidos') {
      filtered = rows.filter((r) => r.diasRestantes != null && r.diasRestantes <= 0);
    } else if (modo === 'proximos') {
      filtered = rows.filter((r) => r.diasRestantes != null && r.diasRestantes > 0 && r.diasRestantes <= dias);
    } else if (modo === 'todos') {
      // Para alertas: solo vencidos + próximos dentro de 'dias' (ej. 15)
      filtered = rows.filter((r) => r.diasRestantes != null && r.diasRestantes <= dias);
    }

    const contratoIds = [...new Set(filtered.map((r) => r.contratoId))];
    if (contratoIds.length === 0) {
      return res.json({
        data: [],
        meta: { modo, dias, totalVencidos: 0, totalProximos: 0 }
      });
    }

    const contratos = await prisma.contrato.findMany({
      where: { id: { in: contratoIds } },
      select: {
        id: true,
        propiedad: {
          select: {
            dirCalle: true,
            dirNro: true,
            dirPiso: true,
            dirDepto: true,
            localidad: { select: { nombre: true } }
          }
        },
        inquilino: {
          select: {
            nombre: true,
            apellido: true,
            razonSocial: true
          }
        }
      }
    });

    const byId = Object.fromEntries(contratos.map((c) => [c.id, c]));
    const data = filtered.map((r) => {
      const c = byId[r.contratoId];
      const direccion = c?.propiedad
        ? [c.propiedad.dirCalle, c.propiedad.dirNro, c.propiedad.dirPiso, c.propiedad.dirDepto]
            .filter(Boolean)
            .join(' ')
        : '';
      const inquilinoNombre = c?.inquilino
        ? (c.inquilino.razonSocial || [c.inquilino.nombre, c.inquilino.apellido].filter(Boolean).join(' '))
        : '';
      return {
        contratoId: r.contratoId,
        propiedad: direccion,
        inquilino: inquilinoNombre,
        montoActual: r.montoActual,
        frecuenciaAjusteMeses: r.frecuenciaAjusteMeses,
        fechaBase: r.fechaBase,
        proximaFechaAjuste: r.proximaFechaAjuste,
        diasRestantes: r.diasRestantes,
        estado: r.diasRestantes != null && r.diasRestantes <= 0 ? 'vencido' : 'proximo'
      };
    });

    const totalVencidos = rows.filter((r) => r.diasRestantes != null && r.diasRestantes <= 0).length;
    const totalProximos = rows.filter((r) => r.diasRestantes != null && r.diasRestantes > 0 && r.diasRestantes <= dias).length;

    res.json({
      data,
      meta: { modo, dias, totalVencidos, totalProximos }
    });
  } catch (error) {
    console.error('Error al obtener ajustes pendientes:', error);
    res.status(500).json({ error: 'Error al obtener ajustes pendientes' });
  }
};

/**
 * GET /api/dashboard/contratos-por-vencer?dias=60
 * Contratos VIGENTES que vencen en los próximos X días
 */
export const getContratosPorVencer = async (req, res) => {
  try {
    const dias = Math.min(365, Math.max(0, parseInt(req.query.dias, 10) || DIAS_VENCIMIENTO_CONTRATOS_DEFAULT));
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + dias);

    // Primero obtener el ID del estado VIGENTE
    const estadoVigente = await prisma.estadoContrato.findFirst({
      where: { codigo: 'VIGENTE', activo: true }
    });

    if (!estadoVigente) {
      return res.json({ data: [], meta: { total: 0, dias } });
    }

    const contratos = await prisma.contrato.findMany({
      where: {
        activo: true,
        deletedAt: null,
        estadoContratoId: estadoVigente.id,
        fechaFin: {
          gte: hoy,
          lte: limite
        }
      },
      select: {
        id: true,
        nroContrato: true,
        fechaFin: true,
        propiedad: {
          select: {
            id: true,
            dirCalle: true,
            dirNro: true,
            dirPiso: true,
            dirDepto: true
          }
        },
        inquilino: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            razonSocial: true
          }
        }
      },
      orderBy: { fechaFin: 'asc' }
    });

    const data = contratos.map(c => {
      const direccion = c.propiedad 
        ? [c.propiedad.dirCalle, c.propiedad.dirNro, c.propiedad.dirPiso ? `${c.propiedad.dirPiso}°` : null, c.propiedad.dirDepto ? `"${c.propiedad.dirDepto}"` : null]
            .filter(Boolean)
            .join(' ')
        : '-';
      const inquilino = c.inquilino 
        ? (c.inquilino.razonSocial || `${c.inquilino.apellido}, ${c.inquilino.nombre}`.trim())
        : '-';
      const diasRestantes = Math.ceil((new Date(c.fechaFin) - hoy) / (1000 * 60 * 60 * 24));
      
      return {
        contratoId: c.id,
        nroContrato: c.nroContrato,
        propiedad: direccion,
        inquilino,
        fechaFin: c.fechaFin,
        diasRestantes
      };
    });

    res.json({
      data,
      meta: { total: data.length, dias }
    });
  } catch (error) {
    console.error('Error al obtener contratos por vencer:', error);
    res.status(500).json({ error: 'Error al obtener contratos por vencer' });
  }
};

/**
 * GET /api/dashboard/cobranza-critica
 * Inquilinos con deuda > 0 (en mora)
 */
export const getCobranzaCritica = async (req, res) => {
  try {
    // Obtener IDs de tipos de movimiento
    const tipoDebito = await prisma.tipoMovimiento.findFirst({ where: { codigo: 'DEBITO' } });
    const tipoCredito = await prisma.tipoMovimiento.findFirst({ where: { codigo: 'CREDITO' } });
    
    const tipoDebitoId = tipoDebito?.id || 0;
    const tipoCreditoId = tipoCredito?.id || 0;

    // Saldo = SUM(débitos) - SUM(créditos)
    // Positivo = deuda del inquilino
    const contratosConDeuda = await prisma.$queryRaw`
      SELECT 
        c.id AS "contratoId",
        c.nro_contrato AS "nroContrato",
        COALESCE(
          SUM(CASE WHEN m.tipo_movimiento_id = ${tipoDebitoId} THEN m.importe ELSE 0 END) -
          SUM(CASE WHEN m.tipo_movimiento_id = ${tipoCreditoId} THEN m.importe ELSE 0 END),
          0
        ) AS "saldo"
      FROM contratos c
      INNER JOIN estados_contrato e ON e.id = c.estado_contrato_id AND e.codigo = 'VIGENTE' AND e.activo = true
      LEFT JOIN movimientos_cuenta_inquilino m ON m.contrato_id = c.id AND m.activo = true
      WHERE c.activo = true AND c.deleted_at IS NULL
      GROUP BY c.id, c.nro_contrato
      HAVING COALESCE(
        SUM(CASE WHEN m.tipo_movimiento_id = ${tipoDebitoId} THEN m.importe ELSE 0 END) -
        SUM(CASE WHEN m.tipo_movimiento_id = ${tipoCreditoId} THEN m.importe ELSE 0 END),
        0
      ) > 0
    `;

    const contratoIds = contratosConDeuda.map(c => c.contratoId);
    
    let contratosData = [];
    if (contratoIds.length > 0) {
      contratosData = await prisma.contrato.findMany({
        where: { id: { in: contratoIds } },
        select: {
          id: true,
          nroContrato: true,
          propiedad: {
            select: {
              dirCalle: true,
              dirNro: true,
              dirPiso: true,
              dirDepto: true
            }
          },
          inquilino: {
            select: {
              nombre: true,
              apellido: true,
              razonSocial: true
            }
          }
        }
      });
    }

    const byId = Object.fromEntries(contratosData.map(c => [c.id, c]));
    
    const data = contratosConDeuda.map(row => {
      const c = byId[row.contratoId];
      const direccion = c?.propiedad 
        ? [c.propiedad.dirCalle, c.propiedad.dirNro, c.propiedad.dirPiso ? `${c.propiedad.dirPiso}°` : null, c.propiedad.dirDepto ? `"${c.propiedad.dirDepto}"` : null]
            .filter(Boolean)
            .join(' ')
        : '-';
      const inquilino = c?.inquilino 
        ? (c.inquilino.razonSocial || `${c.inquilino.apellido}, ${c.inquilino.nombre}`.trim())
        : '-';
      
      return {
        contratoId: row.contratoId,
        nroContrato: row.nroContrato,
        propiedad: direccion,
        inquilino,
        saldo: Number(row.saldo)
      };
    });

    const totalDeuda = data.reduce((sum, d) => sum + d.saldo, 0);

    res.json({
      data,
      meta: { 
        totalInquilinos: data.length,
        totalDeuda
      }
    });
  } catch (error) {
    console.error('Error al obtener cobranza crítica:', error);
    res.status(500).json({ error: 'Error al obtener cobranza crítica' });
  }
};

/**
 * GET /api/dashboard/liquidaciones-pendientes
 * Liquidaciones agrupadas por estado de acción:
 * - faltanItems: Liquidaciones con ítems pendientes de cargar importe
 * - borradores: Liquidaciones en estado BORRADOR (pendientes de validación)
 * - listas: Liquidaciones en estado LISTA (listas para emitir)
 */
export const getLiquidacionesPendientes = async (req, res) => {
  try {
    // Obtener IDs de estados
    const [estadoBorrador, estadoLista, estadoItemPendiente] = await Promise.all([
      prisma.estadoLiquidacion.findFirst({ where: { codigo: 'BORRADOR' } }),
      prisma.estadoLiquidacion.findFirst({ where: { codigo: 'LISTA' } }),
      prisma.estadoItemLiquidacion.findFirst({ where: { codigo: 'PENDIENTE' } })
    ]);

    const selectFields = {
      id: true,
      periodo: true,
      total: true,
      estadoLiquidacionId: true,
      contrato: {
        select: {
          id: true,
          inquilino: {
            select: { nombre: true, apellido: true, razonSocial: true }
          },
          propiedad: {
            select: { id: true, dirCalle: true, dirNro: true, dirPiso: true, dirDepto: true }
          }
        }
      },
      propiedad: {
        select: { id: true, dirCalle: true, dirNro: true, dirPiso: true, dirDepto: true }
      },
      items: {
        select: { 
          id: true, 
          importe: true, 
          estadoItemId: true,
          tipoCargo: {
            select: { codigo: true }
          }
        }
      }
    };

    // Obtener todas las liquidaciones no emitidas (BORRADOR + LISTA)
    const todasLiquidaciones = await prisma.liquidacion.findMany({
      where: {
        activo: true,
        deletedAt: null,
        estadoLiquidacionId: {
          in: [estadoBorrador?.id, estadoLista?.id].filter(Boolean)
        }
      },
      select: selectFields,
      orderBy: { periodo: 'desc' }
    });

    const mapLiquidacion = (l) => {
      const prop = l.propiedad || l.contrato?.propiedad;
      const direccion = prop 
        ? [prop.dirCalle, prop.dirNro, prop.dirPiso ? `${prop.dirPiso}°` : null, prop.dirDepto ? `"${prop.dirDepto}"` : null]
            .filter(Boolean)
            .join(' ')
        : '-';
      const inquilino = l.contrato?.inquilino 
        ? (l.contrato.inquilino.razonSocial || `${l.contrato.inquilino.apellido}, ${l.contrato.inquilino.nombre}`.trim())
        : 'Sin inquilino';
      
      return {
        id: l.id,
        periodo: l.periodo,
        propiedad: direccion,
        inquilino,
        total: l.total ? Number(l.total) : 0
      };
    };

    // Clasificar liquidaciones
    const faltanItems = [];
    const borradores = [];
    const listas = [];

    for (const liq of todasLiquidaciones) {
      // El estado de la liquidación es el criterio principal
      // - LISTA: ya fue validada, va directo a "listas" (sin importar estado de ítems)
      // - BORRADOR: puede tener ítems pendientes o estar lista para revisar
      
      if (liq.estadoLiquidacionId === estadoLista?.id) {
        // Ya está validada y lista para emitir
        listas.push(mapLiquidacion(liq));
      } else if (liq.estadoLiquidacionId === estadoBorrador?.id) {
        // Es borrador - verificar si tiene ítems pendientes de cargar
        // Excluir ALQUILER, GASTOS_ADMINISTRATIVOS y HONORARIOS ya que se autocompletan desde el contrato
        const tiposAutocompletados = ['ALQUILER', 'GASTOS_ADMINISTRATIVOS', 'HONORARIOS'];
        const itemsPendientes = liq.items.filter(item => 
          item.estadoItemId === estadoItemPendiente?.id &&
          !tiposAutocompletados.includes(item.tipoCargo?.codigo)
        );
        const tieneItemsPendientes = itemsPendientes.length > 0;
        
        if (tieneItemsPendientes) {
          faltanItems.push(mapLiquidacion(liq));
        } else {
          // Borrador con todos los ítems cargados, listo para revisar
          borradores.push(mapLiquidacion(liq));
        }
      }
    }

    res.json({
      faltanItems: {
        data: faltanItems.slice(0, 10),
        total: faltanItems.length
      },
      borradores: {
        data: borradores.slice(0, 10),
        total: borradores.length
      },
      listas: {
        data: listas.slice(0, 10),
        total: listas.length
      },
      meta: {
        totalGeneral: faltanItems.length + borradores.length + listas.length
      }
    });
  } catch (error) {
    console.error('Error al obtener liquidaciones pendientes:', error);
    res.status(500).json({ error: 'Error al obtener liquidaciones pendientes' });
  }
};

/**
 * GET /api/dashboard/propiedades-vacantes
 * Propiedades activas que NO están alquiladas (sin contrato vigente)
 */
export const getPropiedadesVacantes = async (req, res) => {
  try {
    // Obtener el ID del estado "Alquilada" para excluirlo
    const estadoAlquilada = await prisma.estadoPropiedad.findFirst({
      where: { 
        OR: [
          { codigo: 'ALQ' },
          { codigo: 'ALQUILADA' }
        ]
      }
    });

    // Obtener el ID del estado de contrato "Vigente"
    const estadoVigente = await prisma.estadoContrato.findFirst({
      where: { codigo: 'VIGENTE' }
    });

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Propiedades activas que no tienen contrato vigente
    const propiedadesVacantes = await prisma.propiedad.findMany({
      where: {
        activo: true,
        deletedAt: null,
        // Excluir propiedades que tienen un contrato vigente activo
        NOT: {
          contratos: {
            some: {
              activo: true,
              deletedAt: null,
              ...(estadoVigente && { estadoContratoId: estadoVigente.id }),
              fechaInicio: { lte: hoy },
              OR: [
                { fechaFin: null },
                { fechaFin: { gte: hoy } }
              ]
            }
          }
        }
      },
      select: {
        id: true,
        dirCalle: true,
        dirNro: true,
        dirPiso: true,
        dirDepto: true,
        estadoPropiedad: {
          select: { nombre: true }
        },
        propietarios: {
          where: { activo: true, deletedAt: null },
          select: {
            propietario: {
              select: { nombre: true, apellido: true, razonSocial: true }
            }
          },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });

    const data = propiedadesVacantes.map(p => {
      const direccion = [p.dirCalle, p.dirNro, p.dirPiso ? `${p.dirPiso}°` : null, p.dirDepto ? `"${p.dirDepto}"` : null]
        .filter(Boolean)
        .join(' ');
      const propietario = p.propietarios?.[0]?.propietario;
      const nombrePropietario = propietario 
        ? (propietario.razonSocial || `${propietario.apellido}, ${propietario.nombre}`.trim())
        : '-';
      
      return {
        id: p.id,
        direccion,
        estado: p.estadoPropiedad?.nombre || 'Sin estado',
        propietario: nombrePropietario
      };
    });

    // Contar total
    const totalCount = await prisma.propiedad.count({
      where: {
        activo: true,
        deletedAt: null,
        NOT: {
          contratos: {
            some: {
              activo: true,
              deletedAt: null,
              ...(estadoVigente && { estadoContratoId: estadoVigente.id }),
              fechaInicio: { lte: hoy },
              OR: [
                { fechaFin: null },
                { fechaFin: { gte: hoy } }
              ]
            }
          }
        }
      }
    });

    res.json({
      data,
      meta: { total: totalCount }
    });
  } catch (error) {
    console.error('Error al obtener propiedades vacantes:', error);
    res.status(500).json({ error: 'Error al obtener propiedades vacantes' });
  }
};

/**
 * GET /api/dashboard/pagos-propietarios-pendientes
 * Propietarios con saldo a favor (la inmobiliaria les debe dinero).
 * Agregación en BD con $queryRaw (CRÉDITO suma, DÉBITO resta); sin full table scan en memoria.
 * Contrato de salida: { data: [ { propietarioId, propiedadId, tipo, propiedad, propietario, saldo, propiedades } ], meta: { total, totalSaldo } }
 */
export const getPagosPropietariosPendientes = async (req, res) => {
  try {
    const tipoDebito = await prisma.tipoMovimiento.findFirst({ where: { codigo: 'DEBITO' } });
    const tipoCredito = await prisma.tipoMovimiento.findFirst({ where: { codigo: 'CREDITO' } });
    const tipoDebitoId = tipoDebito?.id ?? 0;
    const tipoCreditoId = tipoCredito?.id ?? 0;

    const [top10Rows, metaRows] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        SELECT pp.propietario_id AS "propietarioId",
               (SUM(CASE WHEN m.tipo_movimiento_id = ${tipoCreditoId} THEN m.importe::numeric ELSE 0 END) -
                SUM(CASE WHEN m.tipo_movimiento_id = ${tipoDebitoId} THEN m.importe::numeric ELSE 0 END)) AS saldo
        FROM movimientos_cuenta_propietario m
        INNER JOIN (SELECT propiedad_id, MIN(propietario_id) AS propietario_id FROM propiedad_propietario WHERE activo = true AND deleted_at IS NULL GROUP BY propiedad_id) pp ON pp.propiedad_id = m.propiedad_id
        WHERE m.activo = true AND m.deleted_at IS NULL AND m.propiedad_id IS NOT NULL
        GROUP BY pp.propietario_id
        HAVING (SUM(CASE WHEN m.tipo_movimiento_id = ${tipoCreditoId} THEN m.importe::numeric ELSE 0 END) -
                SUM(CASE WHEN m.tipo_movimiento_id = ${tipoDebitoId} THEN m.importe::numeric ELSE 0 END)) > 0
        ORDER BY saldo DESC
        LIMIT 10
      `),
      prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*)::int AS total,
               COALESCE(SUM(saldo), 0)::numeric AS "totalSaldo"
        FROM (
          SELECT pp.propietario_id,
                 (SUM(CASE WHEN m.tipo_movimiento_id = ${tipoCreditoId} THEN m.importe::numeric ELSE 0 END) -
                  SUM(CASE WHEN m.tipo_movimiento_id = ${tipoDebitoId} THEN m.importe::numeric ELSE 0 END)) AS saldo
          FROM movimientos_cuenta_propietario m
          INNER JOIN (SELECT propiedad_id, MIN(propietario_id) AS propietario_id FROM propiedad_propietario WHERE activo = true AND deleted_at IS NULL GROUP BY propiedad_id) pp ON pp.propiedad_id = m.propiedad_id
          WHERE m.activo = true AND m.deleted_at IS NULL AND m.propiedad_id IS NOT NULL
          GROUP BY pp.propietario_id
          HAVING (SUM(CASE WHEN m.tipo_movimiento_id = ${tipoCreditoId} THEN m.importe::numeric ELSE 0 END) -
                  SUM(CASE WHEN m.tipo_movimiento_id = ${tipoDebitoId} THEN m.importe::numeric ELSE 0 END)) > 0
        ) sub
      `)
    ]);

    const top10 = Array.isArray(top10Rows) ? top10Rows : [top10Rows].filter(Boolean);
    const propietarioIds = top10.map((r) => r.propietarioId).filter(Boolean);

    if (propietarioIds.length === 0) {
      const meta = Array.isArray(metaRows) ? metaRows[0] : metaRows;
      return res.json({
        data: [],
        meta: {
          total: meta?.total ?? 0,
          totalSaldo: Number(meta?.totalSaldo ?? 0)
        }
      });
    }

    const distinctPropiedad = await prisma.$queryRaw(Prisma.sql`
      SELECT DISTINCT pp.propietario_id AS "propietarioId", m.propiedad_id AS "propiedadId"
      FROM movimientos_cuenta_propietario m
      INNER JOIN (SELECT propiedad_id, MIN(propietario_id) AS propietario_id FROM propiedad_propietario WHERE activo = true AND deleted_at IS NULL GROUP BY propiedad_id) pp ON pp.propiedad_id = m.propiedad_id
      WHERE m.activo = true AND m.deleted_at IS NULL AND m.propiedad_id IS NOT NULL
        AND pp.propietario_id IN (${Prisma.join(propietarioIds)})
    `);

    const distinctList = Array.isArray(distinctPropiedad) ? distinctPropiedad : [distinctPropiedad].filter(Boolean);
    const propiedadIds = [...new Set(distinctList.map((r) => r.propiedadId).filter(Boolean))];

    const [clientes, propiedades] = await Promise.all([
      prisma.cliente.findMany({
        where: { id: { in: propietarioIds } },
        select: { id: true, nombre: true, apellido: true, razonSocial: true }
      }),
      propiedadIds.length > 0
        ? prisma.propiedad.findMany({
            where: { id: { in: propiedadIds } },
            select: { id: true, dirCalle: true, dirNro: true, dirPiso: true, dirDepto: true }
          })
        : Promise.resolve([])
    ]);

    const clienteById = new Map(clientes.map((c) => [c.id, c]));
    const propiedadById = new Map(propiedades.map((p) => [p.id, p]));

    const propiedadesByPropietarioId = new Map();
    for (const row of distinctList) {
      const pid = row.propietarioId;
      if (pid == null || row.propiedadId == null) continue;
      if (!propiedadesByPropietarioId.has(pid)) propiedadesByPropietarioId.set(pid, []);
      const prop = propiedadById.get(row.propiedadId);
      const direccion = prop
        ? [prop.dirCalle, prop.dirNro, prop.dirPiso ? `${prop.dirPiso}°` : null, prop.dirDepto ? `"${prop.dirDepto}"` : null]
            .filter(Boolean)
            .join(' ')
        : '-';
      propiedadesByPropietarioId.get(pid).push({ id: row.propiedadId, direccion });
    }

    const propiedadesArray = (pid) => propiedadesByPropietarioId.get(pid) ?? [];
    const data = top10.map((row) => {
      const pid = row.propietarioId;
      const saldo = Number(row.saldo);
      const arr = propiedadesArray(pid);
      const cliente = clienteById.get(pid);
      const nombrePropietario = cliente
        ? (cliente.razonSocial || `${cliente.apellido ?? ''}, ${cliente.nombre ?? ''}`.trim())
        : '-';
      return {
        propietarioId: pid,
        propiedadId: arr[0]?.id ?? null,
        tipo: 'propietario',
        propiedad: arr.length > 1 ? `${arr.length} propiedades` : arr[0]?.direccion ?? '-',
        propietario: nombrePropietario,
        saldo,
        propiedades: arr
      };
    });

    const metaRow = Array.isArray(metaRows) ? metaRows[0] : metaRows;
    res.json({
      data,
      meta: {
        total: metaRow?.total ?? 0,
        totalSaldo: Number(metaRow?.totalSaldo ?? 0)
      }
    });
  } catch (error) {
    console.error('Error al obtener pagos a propietarios pendientes:', error);
    res.status(500).json({ error: 'Error al obtener pagos a propietarios pendientes' });
  }
};
