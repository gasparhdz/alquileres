import prisma from '../db/prisma.js';

function trimOpt(s) {
  if (s == null) return null;
  const t = String(s).trim();
  return t === '' ? null : t;
}

export const listConsorcios = async (req, res) => {
  try {
    const { search, page = '1', limit = '100' } = req.query;
    const take = Math.min(parseInt(limit, 10) || 100, 500);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const where = {
      deletedAt: null,
      activo: true,
      ...(search && {
        OR: [
          { nombre: { contains: search, mode: 'insensitive' } },
          { nombreAdministracion: { contains: search, mode: 'insensitive' } },
          { cuitConsorcio: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.consorcio.findMany({
        where,
        orderBy: { nombre: 'asc' },
        skip,
        take,
      }),
      prisma.consorcio.count({ where }),
    ]);

    res.json({
      data,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    });
  } catch (e) {
    console.error('listConsorcios:', e);
    res.status(500).json({ error: 'Error al listar consorcios' });
  }
};

export const getConsorcioById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const row = await prisma.consorcio.findFirst({
      where: { id, deletedAt: null, activo: true },
    });
    if (!row) return res.status(404).json({ error: 'Consorcio no encontrado' });
    res.json(row);
  } catch (e) {
    console.error('getConsorcioById:', e);
    res.status(500).json({ error: 'Error al obtener consorcio' });
  }
};

export const createConsorcio = async (req, res) => {
  try {
    const b = req.body || {};
    const nombre = trimOpt(b.nombre);
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del consorcio es obligatorio' });
    }

    const created = await prisma.consorcio.create({
      data: {
        nombre,
        cuitConsorcio: trimOpt(b.cuitConsorcio),
        direccionConsorcio: trimOpt(b.direccionConsorcio),
        nombreAdministracion: trimOpt(b.nombreAdministracion),
        direccionAdministracion: trimOpt(b.direccionAdministracion),
        nombreReferente: trimOpt(b.nombreReferente),
        telefonoAdministracion: trimOpt(b.telefonoAdministracion),
        mailAdministracion: trimOpt(b.mailAdministracion),
        notas: trimOpt(b.notas),
        activo: true,
      },
    });
    res.status(201).json(created);
  } catch (e) {
    console.error('createConsorcio:', e);
    res.status(500).json({ error: 'Error al crear consorcio' });
  }
};

export const updateConsorcio = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const existente = await prisma.consorcio.findFirst({
      where: { id, deletedAt: null, activo: true },
    });
    if (!existente) return res.status(404).json({ error: 'Consorcio no encontrado' });

    const b = req.body || {};
    const nombre = trimOpt(b.nombre) ?? existente.nombre;
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del consorcio es obligatorio' });
    }

    const updated = await prisma.consorcio.update({
      where: { id },
      data: {
        nombre,
        cuitConsorcio: b.cuitConsorcio !== undefined ? trimOpt(b.cuitConsorcio) : existente.cuitConsorcio,
        direccionConsorcio: b.direccionConsorcio !== undefined ? trimOpt(b.direccionConsorcio) : existente.direccionConsorcio,
        nombreAdministracion:
          b.nombreAdministracion !== undefined ? trimOpt(b.nombreAdministracion) : existente.nombreAdministracion,
        direccionAdministracion:
          b.direccionAdministracion !== undefined ? trimOpt(b.direccionAdministracion) : existente.direccionAdministracion,
        nombreReferente: b.nombreReferente !== undefined ? trimOpt(b.nombreReferente) : existente.nombreReferente,
        telefonoAdministracion:
          b.telefonoAdministracion !== undefined ? trimOpt(b.telefonoAdministracion) : existente.telefonoAdministracion,
        mailAdministracion: b.mailAdministracion !== undefined ? trimOpt(b.mailAdministracion) : existente.mailAdministracion,
        notas: b.notas !== undefined ? trimOpt(b.notas) : existente.notas,
      },
    });
    res.json(updated);
  } catch (e) {
    console.error('updateConsorcio:', e);
    res.status(500).json({ error: 'Error al actualizar consorcio' });
  }
};

export const deleteConsorcio = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const existente = await prisma.consorcio.findFirst({
      where: { id, deletedAt: null, activo: true },
    });
    if (!existente) return res.status(404).json({ error: 'Consorcio no encontrado' });

    await prisma.consorcio.update({
      where: { id },
      data: {
        activo: false,
        deletedAt: new Date(),
      },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('deleteConsorcio:', e);
    res.status(500).json({ error: 'Error al eliminar consorcio' });
  }
};
