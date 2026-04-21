import prisma from '../db/prisma.js';

/**
 * GET /api/permisos
 * Lista todos los permisos (sin borrados lógicos; opcional solo activos).
 */
export const getPermisos = async (req, res) => {
  try {
    const { activos = 'true' } = req.query;
    const where = { deletedAt: null };
    if (activos === 'true') where.activo = true;

    const permisos = await prisma.permiso.findMany({
      where,
      orderBy: { codigo: 'asc' }
    });
    res.json(permisos);
  } catch (error) {
    console.error('getPermisos:', error);
    res.status(500).json({ error: error.message || 'Error al listar permisos' });
  }
};

/**
 * GET /api/permisos/:id
 */
export const getPermisoById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const permiso = await prisma.permiso.findFirst({
      where: { id, deletedAt: null }
    });

    if (!permiso) return res.status(404).json({ error: 'Permiso no encontrado' });
    res.json(permiso);
  } catch (error) {
    console.error('getPermisoById:', error);
    res.status(500).json({ error: error.message || 'Error al obtener permiso' });
  }
};

/**
 * POST /api/permisos
 */
export const createPermiso = async (req, res) => {
  try {
    const { codigo, nombre, descripcion } = req.body;

    if (!codigo?.trim()) return res.status(400).json({ error: 'El código es requerido' });
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });

    const existing = await prisma.permiso.findFirst({
      where: { deletedAt: null, codigo: codigo.trim() }
    });
    if (existing) return res.status(400).json({ error: 'Ya existe un permiso con ese código' });

    const permiso = await prisma.permiso.create({
      data: {
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        activo: true
      }
    });
    res.status(201).json(permiso);
  } catch (error) {
    console.error('createPermiso:', error);
    res.status(500).json({ error: error.message || 'Error al crear permiso' });
  }
};

/**
 * PUT /api/permisos/:id
 */
export const updatePermiso = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { codigo, nombre, descripcion, activo } = req.body;

    const existing = await prisma.permiso.findFirst({
      where: { id, deletedAt: null }
    });
    if (!existing) return res.status(404).json({ error: 'Permiso no encontrado' });

    const updateData = {};
    if (codigo !== undefined) updateData.codigo = codigo?.trim();
    if (nombre !== undefined) updateData.nombre = nombre?.trim();
    if (descripcion !== undefined) updateData.descripcion = descripcion?.trim() || null;
    if (typeof activo === 'boolean') updateData.activo = activo;

    const permiso = await prisma.permiso.update({
      where: { id },
      data: updateData
    });
    res.json(permiso);
  } catch (error) {
    console.error('updatePermiso:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar permiso' });
  }
};

/**
 * DELETE /api/permisos/:id
 * Soft-delete: marca deletedAt.
 */
export const deletePermiso = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const existing = await prisma.permiso.findFirst({
      where: { id, deletedAt: null }
    });
    if (!existing) return res.status(404).json({ error: 'Permiso no encontrado' });

    await prisma.permiso.update({
      where: { id },
      data: { deletedAt: new Date(), activo: false }
    });

    res.status(200).json({ message: 'Permiso eliminado correctamente' });
  } catch (error) {
    console.error('deletePermiso:', error);
    res.status(500).json({ error: error.message || 'Error al eliminar permiso' });
  }
};
