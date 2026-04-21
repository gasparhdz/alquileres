import prisma from '../db/prisma.js';

/**
 * GET /api/roles
 * Lista todos los roles (sin borrados lógicos; opcional solo activos).
 */
export const getRoles = async (req, res) => {
  try {
    const { activos = 'true' } = req.query;
    const where = { deletedAt: null };
    if (activos === 'true') where.activo = true;

    const roles = await prisma.rol.findMany({
      where,
      include: { permisos: { include: { permiso: { select: { id: true, codigo: true, nombre: true } } } } },
      orderBy: { codigo: 'asc' }
    });
    const list = roles.map((r) => ({
      ...r,
      permisos: r.permisos.map((rp) => rp.permiso)
    }));
    res.json(list);
  } catch (error) {
    console.error('getRoles:', error);
    res.status(500).json({ error: error.message || 'Error al listar roles' });
  }
};

/**
 * GET /api/roles/:id
 */
export const getRolById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const rol = await prisma.rol.findFirst({
      where: { id, deletedAt: null },
      include: { permisos: { include: { permiso: { select: { id: true, codigo: true, nombre: true } } } } }
    });

    if (!rol) return res.status(404).json({ error: 'Rol no encontrado' });
    res.json({
      ...rol,
      permisos: rol.permisos.map((rp) => rp.permiso)
    });
  } catch (error) {
    console.error('getRolById:', error);
    res.status(500).json({ error: error.message || 'Error al obtener rol' });
  }
};

/**
 * POST /api/roles
 */
export const createRol = async (req, res) => {
  try {
    const { codigo, descripcion, permisoIds = [] } = req.body;

    if (!codigo?.trim()) {
      return res.status(400).json({ error: 'El código del rol es requerido' });
    }

    const existing = await prisma.rol.findFirst({
      where: { deletedAt: null, codigo: codigo.trim() }
    });
    if (existing) {
      return res.status(400).json({ error: 'Ya existe un rol con ese código' });
    }

    const rol = await prisma.rol.create({
      data: {
        codigo: codigo.trim(),
        descripcion: descripcion?.trim() || null,
        activo: true
      }
    });

    const validPermisoIds = Array.isArray(permisoIds) ? permisoIds.filter((pid) => Number.isInteger(pid)) : [];
    if (validPermisoIds.length > 0) {
      await prisma.rolPermiso.createMany({
        data: validPermisoIds.map((permisoId) => ({ rolId: rol.id, permisoId }))
      });
    }

    const created = await prisma.rol.findUnique({
      where: { id: rol.id },
      include: { permisos: { include: { permiso: { select: { id: true, codigo: true, nombre: true } } } } }
    });
    res.status(201).json({
      ...created,
      permisos: created.permisos.map((rp) => rp.permiso)
    });
  } catch (error) {
    console.error('createRol:', error);
    res.status(500).json({ error: error.message || 'Error al crear rol' });
  }
};

/**
 * PUT /api/roles/:id
 */
export const updateRol = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { codigo, descripcion, activo, permisoIds } = req.body;

    const existing = await prisma.rol.findFirst({
      where: { id, deletedAt: null }
    });
    if (!existing) return res.status(404).json({ error: 'Rol no encontrado' });

    const updateData = {};
    if (codigo !== undefined) updateData.codigo = codigo?.trim();
    if (descripcion !== undefined) updateData.descripcion = descripcion?.trim() || null;
    if (typeof activo === 'boolean') updateData.activo = activo;

    await prisma.rol.update({
      where: { id },
      data: updateData
    });

    if (Array.isArray(permisoIds)) {
      await prisma.rolPermiso.deleteMany({ where: { rolId: id } });
      const validPermisoIds = permisoIds.filter((pid) => Number.isInteger(pid));
      if (validPermisoIds.length > 0) {
        await prisma.rolPermiso.createMany({
          data: validPermisoIds.map((permisoId) => ({ rolId: id, permisoId }))
        });
      }
    }

    const rol = await prisma.rol.findUnique({
      where: { id },
      include: { permisos: { include: { permiso: { select: { id: true, codigo: true, nombre: true } } } } }
    });
    res.json({
      ...rol,
      permisos: rol.permisos.map((rp) => rp.permiso)
    });
  } catch (error) {
    console.error('updateRol:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar rol' });
  }
};

/**
 * DELETE /api/roles/:id
 * Soft-delete: marca activo = false.
 */
export const deleteRol = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const existing = await prisma.rol.findFirst({
      where: { id, deletedAt: null }
    });
    if (!existing) return res.status(404).json({ error: 'Rol no encontrado' });

    await prisma.rol.update({
      where: { id },
      data: { activo: false }
    });

    res.status(200).json({ message: 'Rol desactivado correctamente' });
  } catch (error) {
    console.error('deleteRol:', error);
    res.status(500).json({ error: error.message || 'Error al desactivar rol' });
  }
};
