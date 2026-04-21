import { Prisma } from '@prisma/client';
import prisma from '../db/prisma.js';
import {
  sqlSearchCliente,
  sqlOrderByApellido,
  sqlOrderByCantPropiedades,
  sqlFromClientes,
  sqlFromClientesConConteoPropiedades,
  ordenarClientesPorIds,
} from '../utils/clienteListSort.js';
import { resolveDomicilioClienteFields } from '../utils/clienteDomicilio.js';

const ROL_PROPIETARIO = 'PROPIETARIO';

async function getRolPropietarioId() {
  const rol = await prisma.rolCliente.findFirst({
    where: { codigo: ROL_PROPIETARIO, activo: true },
    select: { id: true },
  });
  return rol?.id ?? null;
}

/** IDs de clientes que tienen el rol PROPIETARIO activo (para filtrar sin usar nested relation en where) */
async function getClienteIdsConRolPropietario(rolId) {
  const rows = await prisma.clienteRol.findMany({
    where: { rolId, deletedAt: null, activo: true },
    select: { clienteId: true },
  });
  return rows.map((r) => r.clienteId);
}

export const getAllPropietarios = async (req, res) => {
  try {
    const rolId = await getRolPropietarioId();
    if (!rolId) {
      return res.status(500).json({ error: 'Rol PROPIETARIO no parametrizado' });
    }

    const { search, page = 1, limit = 50, orderBy: orderByParam, order: orderParam } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const allowedOrder = ['nombre', 'apellido', 'dni', 'cuit', 'mail', 'telefono', 'createdAt', 'cantPropiedades'];
    const orderBy = allowedOrder.includes(orderByParam) ? orderByParam : 'createdAt';
    const order = orderParam === 'asc' || orderParam === 'desc' ? orderParam : 'desc';

    const clienteIdsConRol = await getClienteIdsConRolPropietario(rolId);
    if (clienteIdsConRol.length === 0) {
      return res.json({
        data: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalPages: 0,
        },
      });
    }

    const where = {
      id: { in: clienteIdsConRol },
      deletedAt: null,
      activo: true,
      ...(search && search.trim() && {
        OR: [
          { nombre: { contains: search.trim(), mode: 'insensitive' } },
          { apellido: { contains: search.trim(), mode: 'insensitive' } },
          { razonSocial: { contains: search.trim(), mode: 'insensitive' } },
          { dni: { contains: search.trim(), mode: 'insensitive' } },
          { cuit: { contains: search.trim(), mode: 'insensitive' } },
        ],
      }),
    };

    const take = parseInt(limit, 10);
    const includePropietario = {
      tipoPersona: true,
      propiedades: {
        where: { deletedAt: null, activo: true },
        include: {
          propiedad: {
            include: {
              localidad: { include: { provincia: true } },
              provincia: true,
              tipoPropiedad: true,
            },
          },
        },
      },
    };

    const ordenarPorSql = orderBy === 'nombre' || orderBy === 'apellido' || orderBy === 'cantPropiedades';

    let clientes;
    if (ordenarPorSql) {
      const fromClause =
        orderBy === 'cantPropiedades' ? sqlFromClientesConConteoPropiedades() : sqlFromClientes();
      const orderClause =
        orderBy === 'cantPropiedades'
          ? sqlOrderByCantPropiedades(order)
          : sqlOrderByApellido(order);

      const idRows = await prisma.$queryRaw(Prisma.sql`
        SELECT c.id
        ${fromClause}
        WHERE c.id IN (${Prisma.join(clienteIdsConRol)})
          AND c.deleted_at IS NULL
          AND c.activo = true
          ${sqlSearchCliente(search)}
        ${orderClause}
        LIMIT ${take} OFFSET ${skip}
      `);
      const idsOrdenados = idRows.map((r) => r.id);
      const cargados =
        idsOrdenados.length === 0
          ? []
          : await prisma.cliente.findMany({
              where: { id: { in: idsOrdenados } },
              include: includePropietario,
            });
      clientes = ordenarClientesPorIds(cargados, idsOrdenados);
    } else {
      const orderByClause = { [orderBy]: order };
      clientes = await prisma.cliente.findMany({
        where,
        skip,
        take,
        orderBy: orderByClause,
        include: includePropietario,
      });
    }

    const total = await prisma.cliente.count({ where });

    res.json({
      data: clientes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error al obtener propietarios:', error);
    res.status(500).json({ error: 'Error al obtener propietarios' });
  }
};

export const getPropietarioById = async (req, res) => {
  try {
    const rolId = await getRolPropietarioId();
    if (!rolId) {
      return res.status(500).json({ error: 'Rol PROPIETARIO no parametrizado' });
    }

    const propietarioId = parseInt(req.params.id, 10);
    if (isNaN(propietarioId)) {
      return res.status(400).json({ error: 'ID de propietario inválido' });
    }

    const clienteIdsConRol = await getClienteIdsConRolPropietario(rolId);
    if (!clienteIdsConRol.includes(propietarioId)) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id: propietarioId, deletedAt: null, activo: true },
      include: {
        tipoPersona: true,
        localidad: { include: { provincia: true } },
        provincia: true,
        condicionIva: true,
      },
    });
    if (!cliente) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }

    const pivotes = await prisma.propiedadPropietario.findMany({
      where: { propietarioId, deletedAt: null, activo: true },
      select: { propiedadId: true },
    });
    const propiedadIds = pivotes.map((p) => p.propiedadId);

    if (propiedadIds.length === 0) {
      return res.json({ ...cliente, propiedades: [] });
    }

    const propiedadesList = await prisma.propiedad.findMany({
      where: { id: { in: propiedadIds }, deletedAt: null, activo: true },
      include: {
        localidad: true,
        provincia: true,
        tipoPropiedad: true,
      },
    });

    const [impuestosList, contratosList] = await Promise.all([
      prisma.propiedadImpuesto.findMany({
        where: { propiedadId: { in: propiedadIds }, activo: true, deletedAt: null },
      }),
      prisma.contrato.findMany({
        where: { propiedadId: { in: propiedadIds }, activo: true, deletedAt: null },
        include: { inquilino: true, estado: true },
      }),
    ]);

    const impuestosByPropId = {};
    for (const imp of impuestosList) {
      if (!impuestosByPropId[imp.propiedadId]) impuestosByPropId[imp.propiedadId] = [];
      impuestosByPropId[imp.propiedadId].push(imp);
    }

    const contratosByPropId = {};
    for (const c of contratosList) {
      if (!contratosByPropId[c.propiedadId]) contratosByPropId[c.propiedadId] = [];
      contratosByPropId[c.propiedadId].push({
        ...c,
        numeroContrato: c.nroContrato,
        inquilino: c.inquilino,
        estado: c.estado,
      });
    }

    const propiedades = propiedadesList.map((prop) => ({
      propiedadId: prop.id,
      propietarioId,
      propiedad: {
        ...prop,
        impuestos: impuestosByPropId[prop.id] ?? [],
        contratos: contratosByPropId[prop.id] ?? [],
      },
    }));

    res.json({ ...cliente, propiedades });
  } catch (error) {
    console.error('Error al obtener propietario:', error);
    const message = process.env.NODE_ENV === 'development' ? (error.message || 'Error al obtener propietario') : 'Error al obtener propietario';
    res.status(500).json({ error: message });
  }
};

export const createPropietario = async (req, res) => {
  try {
    const data = req.body;
    const userId = req.user?.id ?? null;

    if (!data.dni && !data.cuit) {
      return res.status(400).json({ error: 'Debe proporcionar DNI o CUIT' });
    }

    const rolId = await getRolPropietarioId();
    if (!rolId) {
      return res.status(500).json({ error: 'Rol PROPIETARIO no parametrizado' });
    }

    const domicilio = resolveDomicilioClienteFields(data);
    if (domicilio.error) {
      return res.status(400).json({ error: domicilio.error });
    }

    const payload = {
      nombre: data.nombre?.trim() || null,
      apellido: data.apellido?.trim() || null,
      razonSocial: data.razonSocial?.trim() || null,
      dni: data.dni?.trim() || null,
      cuit: data.cuit?.trim() || null,
      mail: data.mail?.trim() || null,
      telefono: data.telefono?.trim() || null,
      dirCalle: data.dirCalle?.trim() || null,
      dirNro: data.dirNro?.trim() || null,
      dirPiso: data.dirPiso?.trim() || null,
      dirDepto: data.dirDepto?.trim() || null,
      ...domicilio.fields,
      tipoPersonaId: data.tipoPersonaId ? parseInt(data.tipoPersonaId, 10) : null,
      condicionIvaId: data.condicionIvaId ? parseInt(data.condicionIvaId, 10) : null,
      activo: true,
      createdById: userId,
      updatedById: userId,
    };

    const cliente = await prisma.$transaction(async (tx) => {
      const byDni = payload.dni ? await tx.cliente.findFirst({ where: { dni: payload.dni, deletedAt: null }, select: { id: true } }) : null;
      const byCuit = payload.cuit ? await tx.cliente.findFirst({ where: { cuit: payload.cuit, deletedAt: null }, select: { id: true } }) : null;
      const existente = byDni ?? byCuit;

      if (existente) {
        const pivot = await tx.clienteRol.findUnique({
          where: { clienteId_rolId: { clienteId: existente.id, rolId } },
        });
        if (pivot) {
          if (pivot.deletedAt) {
            await tx.clienteRol.update({
              where: { clienteId_rolId: { clienteId: existente.id, rolId } },
              data: { deletedAt: null, activo: true, updatedById: userId },
            });
          }
          return tx.cliente.findUniqueOrThrow({
            where: { id: existente.id },
            include: { tipoPersona: true, localidad: true, provincia: true, condicionIva: true },
          });
        }
        await tx.clienteRol.create({
          data: {
            clienteId: existente.id,
            rolId,
            activo: true,
            createdById: userId,
            updatedById: userId,
          },
        });
        return tx.cliente.findUniqueOrThrow({
          where: { id: existente.id },
          include: { tipoPersona: true, localidad: true, provincia: true, condicionIva: true },
        });
      }

      const nuevo = await tx.cliente.create({
        data: payload,
        include: { tipoPersona: true, localidad: true, provincia: true, condicionIva: true },
      });
      await tx.clienteRol.create({
        data: {
          clienteId: nuevo.id,
          rolId,
          activo: true,
          createdById: userId,
          updatedById: userId,
        },
      });
      return nuevo;
    });

    res.status(201).json(cliente);
  } catch (error) {
    console.error('Error al crear propietario:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un propietario con estos datos (DNI/CUIT duplicado)' });
    }
    res.status(500).json({ error: 'Error al crear propietario' });
  }
};

export const updatePropietario = async (req, res) => {
  try {
    const propietarioId = parseInt(req.params.id, 10);
    const data = req.body;
    const userId = req.user?.id ?? null;

    if (isNaN(propietarioId)) {
      return res.status(400).json({ error: 'ID de propietario inválido' });
    }

    const rolId = await getRolPropietarioId();
    if (!rolId) {
      return res.status(500).json({ error: 'Rol PROPIETARIO no parametrizado' });
    }

    const clienteIdsConRol = await getClienteIdsConRolPropietario(rolId);
    if (!clienteIdsConRol.includes(propietarioId)) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }

    if (data.dni === '' && data.cuit === '') {
      return res.status(400).json({ error: 'Debe proporcionar DNI o CUIT' });
    }

    const domicilio = resolveDomicilioClienteFields(data);
    if (domicilio.error) {
      return res.status(400).json({ error: domicilio.error });
    }

    const updateData = {
      nombre: data.nombre !== undefined ? (data.nombre?.trim() || null) : undefined,
      apellido: data.apellido !== undefined ? (data.apellido?.trim() || null) : undefined,
      razonSocial: data.razonSocial !== undefined ? (data.razonSocial?.trim() || null) : undefined,
      dni: data.dni !== undefined ? (data.dni?.trim() || null) : undefined,
      cuit: data.cuit !== undefined ? (data.cuit?.trim() || null) : undefined,
      mail: data.mail !== undefined ? (data.mail?.trim() || null) : undefined,
      telefono: data.telefono !== undefined ? (data.telefono?.trim() || null) : undefined,
      dirCalle: data.dirCalle !== undefined ? (data.dirCalle?.trim() || null) : undefined,
      dirNro: data.dirNro !== undefined ? (data.dirNro?.trim() || null) : undefined,
      dirPiso: data.dirPiso !== undefined ? (data.dirPiso?.trim() || null) : undefined,
      dirDepto: data.dirDepto !== undefined ? (data.dirDepto?.trim() || null) : undefined,
      paisCodigo: domicilio.fields.paisCodigo,
      provinciaExtranjera: domicilio.fields.provinciaExtranjera,
      localidadExtranjera: domicilio.fields.localidadExtranjera,
      localidadId: domicilio.fields.localidadId,
      provinciaId: domicilio.fields.provinciaId,
      tipoPersonaId: data.tipoPersonaId !== undefined ? (data.tipoPersonaId ? parseInt(data.tipoPersonaId, 10) : null) : undefined,
      condicionIvaId: data.condicionIvaId !== undefined ? (data.condicionIvaId ? parseInt(data.condicionIvaId, 10) : null) : undefined,
      updatedById: userId,
    };

    const filtered = Object.fromEntries(Object.entries(updateData).filter(([, v]) => v !== undefined));

    const updated = await prisma.cliente.update({
      where: { id: propietarioId },
      data: filtered,
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar propietario:', error);
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0];
      if (field === 'cuit') {
        return res.status(400).json({ error: 'Ya existe un propietario con este CUIT' });
      }
      return res.status(400).json({ error: 'Ya existe un propietario con estos datos (DNI/CUIT duplicado)' });
    }
    res.status(500).json({
      error: 'Error al actualizar propietario',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deletePropietario = async (req, res) => {
  try {
    const propietarioId = parseInt(req.params.id, 10);
    const userId = req.user?.id ?? null;

    if (isNaN(propietarioId)) {
      return res.status(400).json({ error: 'ID de propietario inválido' });
    }

    const rolId = await getRolPropietarioId();
    if (!rolId) {
      return res.status(500).json({ error: 'Rol PROPIETARIO no parametrizado' });
    }

    const clienteIdsConRol = await getClienteIdsConRolPropietario(rolId);
    if (!clienteIdsConRol.includes(propietarioId)) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }

    const cliente = await prisma.cliente.findFirst({
      where: { id: propietarioId, deletedAt: null, activo: true },
      include: {
        propiedades: {
          where: { deletedAt: null, activo: true },
        },
      },
    });

    if (!cliente) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }

    if (cliente.propiedades.length > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar un propietario que tenga propiedades asociadas.',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.clienteRol.update({
        where: { clienteId_rolId: { clienteId: propietarioId, rolId } },
        data: { activo: false, deletedAt: new Date(), deletedById: userId, updatedById: userId },
      });

      const otrosRolesActivos = await tx.clienteRol.count({
        where: {
          clienteId: propietarioId,
          activo: true,
          deletedAt: null,
        },
      });

      if (otrosRolesActivos === 0) {
        await tx.cliente.update({
          where: { id: propietarioId },
          data: { activo: false, deletedAt: new Date(), deletedById: userId, updatedById: userId },
        });
      }
    });

    res.json({ message: 'Propietario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar propietario:', error);
    res.status(500).json({ error: 'Error al eliminar propietario' });
  }
};

export const asociarPropiedades = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { propiedadIds } = req.body;

    const rolId = await getRolPropietarioId();
    if (!rolId) {
      return res.status(500).json({ error: 'Rol PROPIETARIO no parametrizado' });
    }

    const clienteIdsConRol = await getClienteIdsConRolPropietario(rolId);
    if (!clienteIdsConRol.includes(id)) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }

    if (propiedadIds && propiedadIds.length > 0) {
      const ids = propiedadIds.map((pid) => parseInt(pid, 10)).filter((n) => !isNaN(n));
      const propiedades = await prisma.propiedad.findMany({
        where: { id: { in: ids }, deletedAt: null, activo: true },
      });

      if (propiedades.length !== ids.length) {
        return res.status(404).json({ error: 'Una o más propiedades no encontradas' });
      }

      await prisma.$transaction(
        ids.map((propiedadId) =>
          prisma.propiedadPropietario.upsert({
            where: {
              propiedadId_propietarioId: {
                propiedadId,
                propietarioId: id,
              },
            },
            update: { activo: true, deletedAt: null },
            create: {
              propiedadId,
              propietarioId: id,
              activo: true,
            },
          })
        )
      );
    }

    const propietarioActualizado = await prisma.cliente.findFirst({
      where: { id },
      include: {
        propiedades: {
          where: { activo: true },
          include: {
            propiedad: {
              include: {
                localidad: { include: { provincia: true } },
                provincia: true,
                tipoPropiedad: true,
              },
            },
          },
        },
      },
    });

    res.json(propietarioActualizado);
  } catch (error) {
    console.error('Error al asociar propiedades:', error);
    res.status(500).json({ error: 'Error al asociar propiedades' });
  }
};

export const desasociarPropiedad = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const propiedadId = parseInt(req.params.propiedadId, 10);

    const asociacion = await prisma.propiedadPropietario.findUnique({
      where: {
        propiedadId_propietarioId: {
          propiedadId,
          propietarioId: id,
        },
      },
    });

    if (!asociacion) {
      return res.status(404).json({ error: 'Asociación no encontrada' });
    }

    const userId = req.user?.id ?? null;

    await prisma.propiedadPropietario.update({
      where: {
        propiedadId_propietarioId: {
          propiedadId,
          propietarioId: id,
        },
      },
      data: {
        activo: false,
        deletedAt: new Date(),
        deletedById: userId,
        updatedById: userId,
      },
    });

    res.json({ message: 'Propiedad desasociada exitosamente' });
  } catch (error) {
    console.error('Error al desasociar propiedad:', error);
    res.status(500).json({ error: 'Error al desasociar propiedad' });
  }
};
