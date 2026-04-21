import { Prisma } from '@prisma/client';
import prisma from '../db/prisma.js';

/**
 * GET /api/clientes/check-documento
 * Query: dni?, cuit?, ignorarId? (opcional, para edición)
 * Responde { exists: true/false, field?: 'dni'|'cuit' } si ya existe un cliente con ese documento en la tabla clientes.
 */
export const checkDocumento = async (req, res) => {
  try {
    const { dni, cuit, ignorarId } = req.query;
    const ignorar = ignorarId ? parseInt(ignorarId, 10) : null;

    if (!dni && !cuit) {
      return res.status(400).json({ error: 'Debe enviar dni o cuit' });
    }

    if (dni) {
      const where = {
        dni: String(dni).trim(),
        deletedAt: null,
        ...(ignorar != null && !isNaN(ignorar) ? { id: { not: ignorar } } : {}),
      };
      const existe = await prisma.cliente.findFirst({
        where,
        select: { id: true },
      });
      if (existe) {
        return res.json({ exists: true, field: 'dni' });
      }
    }

    const cuitNorm = cuit ? String(cuit).replace(/\D/g, '') : null;
    if (cuitNorm && cuitNorm.length === 11) {
      const rows = await prisma.$queryRaw`
        SELECT 1 AS ok FROM clientes
        WHERE deleted_at IS NULL
          AND REPLACE(REPLACE(COALESCE(cuit, ''), '-', ''), ' ', '') = ${cuitNorm}
          ${ignorar != null && !isNaN(ignorar) ? Prisma.sql`AND id != ${ignorar}` : Prisma.empty}
        LIMIT 1
      `;
      if (Array.isArray(rows) && rows.length > 0) {
        return res.json({ exists: true, field: 'cuit' });
      }
    }

    return res.json({ exists: false });
  } catch (error) {
    console.error('Error en check-documento:', error);
    res.status(500).json({ error: 'Error al verificar documento' });
  }
};
