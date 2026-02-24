import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DIAS_PROXIMOS_DEFAULT = 15;

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
