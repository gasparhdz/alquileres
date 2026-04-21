import { Prisma } from '@prisma/client';
import prisma from '../db/prisma.js';
import {
  sqlSearchCliente,
  sqlOrderByApellido,
  sqlFromClientes,
  ordenarClientesPorIds,
} from '../utils/clienteListSort.js';
import { resolveDomicilioClienteFields } from '../utils/clienteDomicilio.js';

const ROL_INQUILINO = 'INQUILINO';

async function getRolInquilinoId() {
  const rol = await prisma.rolCliente.findFirst({
    where: { codigo: ROL_INQUILINO, activo: true },
    select: { id: true },
  });
  return rol?.id ?? null;
}

/** IDs de clientes que tienen el rol INQUILINO activo (para filtrar sin usar nested relation en where) */
async function getClienteIdsConRolInquilino(rolId) {
  const rows = await prisma.clienteRol.findMany({
    where: { rolId, deletedAt: null, activo: true },
    select: { clienteId: true },
  });
  return rows.map((r) => r.clienteId);
}

export const getAllInquilinos = async (req, res) => {
  try {
    const rolId = await getRolInquilinoId();
    if (!rolId) {
      return res.status(500).json({ error: 'Rol INQUILINO no parametrizado' });
    }

    const { search, page = 1, limit = 50, orderBy: orderByParam, order: orderParam } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const allowedOrder = ['nombre', 'apellido', 'dni', 'cuit', 'mail', 'telefono', 'createdAt'];
    const orderBy = allowedOrder.includes(orderByParam) ? orderByParam : 'createdAt';
    const order = orderParam === 'asc' || orderParam === 'desc' ? orderParam : 'desc';

    const clienteIdsConRol = await getClienteIdsConRolInquilino(rolId);
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
    const ordenarPorSql = orderBy === 'nombre' || orderBy === 'apellido';

    let clientes;
    if (ordenarPorSql) {
      const orderClause = sqlOrderByApellido(order);
      const idRows = await prisma.$queryRaw(Prisma.sql`
        SELECT c.id
        ${sqlFromClientes()}
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
            });
      clientes = ordenarClientesPorIds(cargados, idsOrdenados);
    } else {
      clientes = await prisma.cliente.findMany({
        where,
        skip,
        take,
        orderBy: { [orderBy]: order },
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
    console.error('Error al obtener inquilinos:', error);
    res.status(500).json({ error: 'Error al obtener inquilinos' });
  }
};

export const getInquilinoById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const rolId = await getRolInquilinoId();
    if (!rolId) {
      return res.status(500).json({ error: 'Rol INQUILINO no parametrizado' });
    }

    const pivot = await prisma.clienteRol.findUnique({
      where: { clienteId_rolId: { clienteId: id, rolId } },
    });
    if (!pivot || pivot.deletedAt != null || !pivot.activo) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id, deletedAt: null, activo: true },
      include: {
        tipoPersona: true,
        localidad: { include: { provincia: true } },
        provincia: true,
        condicionIva: true,
      },
    });
    if (!cliente) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }

    const contratos = await prisma.contrato.findMany({
      where: { inquilinoId: id, deletedAt: null, activo: true },
      include: {
        propiedad: { include: { localidad: true } },
        estado: true,
      },
    });

    if (contratos.length === 0) {
      cliente.contratos = [];
      return res.json(cliente);
    }

    const contratoIds = contratos.map((c) => c.id);
    const garantias = await prisma.contratoGarantia.findMany({
      where: { contratoId: { in: contratoIds }, activo: true, deletedAt: null },
      include: { tipoGarantia: true, estadoGarantia: true },
    });

    const garantiasByContratoId = {};
    for (const g of garantias) {
      if (!garantiasByContratoId[g.contratoId]) garantiasByContratoId[g.contratoId] = [];
      garantiasByContratoId[g.contratoId].push(g);
    }

    cliente.contratos = contratos.map((c) => ({
      ...c,
      numeroContrato: c.nroContrato,
      propiedad: c.propiedad,
      estado: c.estado,
      garantias: garantiasByContratoId[c.id] ?? [],
    }));

    res.json(cliente);
  } catch (error) {
    console.error('Error al obtener inquilino:', error);
    res.status(500).json({ error: 'Error al obtener inquilino' });
  }
};

export const createInquilino = async (req, res) => {
  try {
    const data = req.body;
    const userId = req.user?.id ?? null;

    if (!data.dni && !data.cuit) {
      return res.status(400).json({ error: 'Debe proporcionar DNI o CUIT' });
    }

    const rolId = await getRolInquilinoId();
    if (!rolId) {
      return res.status(500).json({ error: 'Rol INQUILINO no parametrizado' });
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

      return tx.cliente.create({
        data: {
          ...payload,
          roles: {
            create: [
              {
                rolId,
                activo: true,
                createdById: userId,
                updatedById: userId,
              },
            ],
          },
        },
        include: { tipoPersona: true, localidad: true, provincia: true, condicionIva: true },
      });
    });

    res.status(201).json(cliente);
  } catch (error) {
    console.error('Error al crear inquilino:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un inquilino con estos datos (DNI/CUIT duplicado)' });
    }
    res.status(500).json({ error: 'Error al crear inquilino' });
  }
};

export const updateInquilino = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = req.body;
    const userId = req.user?.id ?? null;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const rolId = await getRolInquilinoId();
    if (!rolId) {
      return res.status(500).json({ error: 'Rol INQUILINO no parametrizado' });
    }

    const clienteIdsConRol = await getClienteIdsConRolInquilino(rolId);
    if (!clienteIdsConRol.includes(id)) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
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
      where: { id },
      data: filtered,
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar inquilino:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un inquilino con estos datos (DNI/CUIT duplicado)' });
    }
    res.status(500).json({ error: 'Error al actualizar inquilino', details: error.message });
  }
};

export const deleteInquilino = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = req.user?.id ?? null;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const rolId = await getRolInquilinoId();
    if (!rolId) {
      return res.status(500).json({ error: 'Rol INQUILINO no parametrizado' });
    }

    const pivot = await prisma.clienteRol.findUnique({
      where: { clienteId_rolId: { clienteId: id, rolId } },
    });

    if (!pivot) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }

    const contratosActivos = await prisma.contrato.count({
      where: {
        inquilinoId: id,
        deletedAt: null,
        OR: [
          { estadoContratoId: null },
          { estado: { codigo: { notIn: ['FINALIZADO', 'RESCINDIDO'] } } },
        ],
      },
    });

    if (contratosActivos > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar este Inquilino porque posee contratos asociados en el sistema.',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.clienteRol.update({
        where: { clienteId_rolId: { clienteId: id, rolId } },
        data: { activo: false, deletedAt: new Date(), deletedById: userId, updatedById: userId },
      });

      const otrosRolesActivos = await tx.clienteRol.count({
        where: {
          clienteId: id,
          activo: true,
          deletedAt: null,
        },
      });

      if (otrosRolesActivos === 0) {
        await tx.cliente.update({
          where: { id },
          data: { activo: false, deletedAt: new Date(), deletedById: userId, updatedById: userId },
        });
      }
    });

    res.json({ message: 'Inquilino eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar inquilino:', error);
    res.status(500).json({ error: 'Error al eliminar inquilino' });
  }
};
