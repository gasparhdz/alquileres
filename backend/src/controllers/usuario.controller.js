import bcrypt from 'bcrypt';
import prisma from '../db/prisma.js';

const SALT_ROUNDS = 10;

/**
 * GET /api/usuarios
 * Lista todos los usuarios (sin borrados lógicos; opcional filtrar por activos).
 */
export const getUsuarios = async (req, res) => {
  try {
    const { activos = 'true' } = req.query;
    const where = { deletedAt: null };
    if (activos === 'true') where.activo = true;

    const usuarios = await prisma.usuario.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        nombreUsuario: true,
        email: true,
        telefono: true,
        activo: true,
        createdAt: true,
        roles: { include: { rol: { select: { id: true, codigo: true, descripcion: true } } } }
      },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }]
    });

    const list = usuarios.map((u) => ({
      ...u,
      roles: u.roles.map((ur) => ur.rol)
    }));
    res.json(list);
  } catch (error) {
    console.error('getUsuarios:', error);
    res.status(500).json({ error: error.message || 'Error al listar usuarios' });
  }
};

/**
 * GET /api/usuarios/:id
 */
export const getUsuarioById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const usuario = await prisma.usuario.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        nombreUsuario: true,
        email: true,
        telefono: true,
        activo: true,
        createdAt: true,
        roles: { include: { rol: { select: { id: true, codigo: true, descripcion: true } } } }
      }
    });

    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({
      ...usuario,
      roles: usuario.roles.map((ur) => ur.rol)
    });
  } catch (error) {
    console.error('getUsuarioById:', error);
    res.status(500).json({ error: error.message || 'Error al obtener usuario' });
  }
};

/**
 * POST /api/usuarios
 * Crea usuario con password hasheada y roles.
 */
export const createUsuario = async (req, res) => {
  try {
    const { nombre, apellido, nombreUsuario, email, telefono, password, rolIds = [] } = req.body;

    if (!nombreUsuario?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Nombre de usuario, email y contraseña son requeridos' });
    }

    const existing = await prisma.usuario.findFirst({
      where: {
        deletedAt: null,
        OR: [{ nombreUsuario: nombreUsuario.trim() }, { email: email.trim() }]
      }
    });
    if (existing) {
      return res.status(400).json({
        error: existing.nombreUsuario === nombreUsuario.trim() ? 'El nombre de usuario ya existe' : 'El email ya está registrado'
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const usuario = await prisma.usuario.create({
      data: {
        nombre: nombre?.trim() || null,
        apellido: apellido?.trim() || null,
        nombreUsuario: nombreUsuario.trim(),
        email: email.trim(),
        telefono: telefono?.trim() || null,
        passwordHash,
        activo: true
      }
    });

    if (Array.isArray(rolIds) && rolIds.length > 0) {
      await prisma.usuarioRol.createMany({
        data: rolIds.filter((rid) => Number.isInteger(rid)).map((rolId) => ({ usuarioId: usuario.id, rolId }))
      });
    }

    const created = await prisma.usuario.findUnique({
      where: { id: usuario.id },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        nombreUsuario: true,
        email: true,
        telefono: true,
        activo: true,
        createdAt: true,
        roles: { include: { rol: { select: { id: true, codigo: true, descripcion: true } } } }
      }
    });

    res.status(201).json({
      ...created,
      roles: created.roles.map((ur) => ur.rol)
    });
  } catch (error) {
    console.error('createUsuario:', error);
    res.status(500).json({ error: error.message || 'Error al crear usuario' });
  }
};

/**
 * PUT /api/usuarios/:id
 * Actualiza datos y roles (password opcional).
 */
export const updateUsuario = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { nombre, apellido, nombreUsuario, email, telefono, password, activo, rolIds } = req.body;

    const existing = await prisma.usuario.findFirst({
      where: { id, deletedAt: null }
    });
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });

    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre?.trim() || null;
    if (apellido !== undefined) updateData.apellido = apellido?.trim() || null;
    if (nombreUsuario !== undefined) updateData.nombreUsuario = nombreUsuario?.trim();
    if (email !== undefined) updateData.email = email?.trim();
    if (telefono !== undefined) updateData.telefono = telefono?.trim() || null;
    if (typeof activo === 'boolean') updateData.activo = activo;

    if (password && String(password).trim()) {
      updateData.passwordHash = await bcrypt.hash(String(password).trim(), SALT_ROUNDS);
    }

    await prisma.usuario.update({
      where: { id },
      data: updateData
    });

    if (Array.isArray(rolIds)) {
      await prisma.usuarioRol.deleteMany({ where: { usuarioId: id } });
      const validRolIds = rolIds.filter((rid) => Number.isInteger(rid));
      if (validRolIds.length > 0) {
        await prisma.usuarioRol.createMany({
          data: validRolIds.map((rolId) => ({ usuarioId: id, rolId }))
        });
      }
    }

    const updated = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        nombreUsuario: true,
        email: true,
        telefono: true,
        activo: true,
        createdAt: true,
        roles: { include: { rol: { select: { id: true, codigo: true, descripcion: true } } } }
      }
    });

    res.json({ ...updated, roles: updated.roles.map((ur) => ur.rol) });
  } catch (error) {
    console.error('updateUsuario:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar usuario' });
  }
};

/**
 * DELETE /api/usuarios/:id
 * Soft-delete: marca activo = false.
 */
export const deleteUsuario = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const existing = await prisma.usuario.findFirst({
      where: { id, deletedAt: null }
    });
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });

    await prisma.usuario.update({
      where: { id },
      data: { activo: false }
    });

    res.status(200).json({ message: 'Usuario desactivado correctamente' });
  } catch (error) {
    console.error('deleteUsuario:', error);
    res.status(500).json({ error: error.message || 'Error al desactivar usuario' });
  }
};
