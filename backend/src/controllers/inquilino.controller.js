import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllInquilinos = async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      deletedAt: null,
      activo: true,
      ...(search && {
        OR: [
          { nombre: { contains: search, mode: 'insensitive' } },
          { apellido: { contains: search, mode: 'insensitive' } },
          { razonSocial: { contains: search, mode: 'insensitive' } },
          { dni: { contains: search, mode: 'insensitive' } },
          { cuit: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    const [inquilinos, total] = await Promise.all([
      prisma.inquilino.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.inquilino.count({ where })
    ]);

    res.json({
      data: inquilinos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error al obtener inquilinos:', error);
    res.status(500).json({ error: 'Error al obtener inquilinos' });
  }
};

export const getInquilinoById = async (req, res) => {
  try {
    const { id } = req.params;

    const inquilino = await prisma.inquilino.findFirst({
      where: {
        id,
        deletedAt: null,
      activo: true
      },
      include: {
        contratos: {
          where: { deletedAt: null, activo: true },
          include: {
            unidad: {
              include: {
                propietario: true
              }
            }
          }
        }
      }
    });

    if (!inquilino) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }

    res.json(inquilino);
  } catch (error) {
    console.error('Error al obtener inquilino:', error);
    res.status(500).json({ error: 'Error al obtener inquilino' });
  }
};

export const createInquilino = async (req, res) => {
  try {
    const data = req.body;

    // Validar que tenga DNI o CUIT
    if (!data.dni && !data.cuit) {
      return res.status(400).json({ error: 'Debe proporcionar DNI o CUIT' });
    }

    const inquilino = await prisma.inquilino.create({
      data
    });

    res.status(201).json(inquilino);
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
    const { id } = req.params;
    const data = req.body;

    // Verificar que el inquilino existe y no está eliminado
    const inquilino = await prisma.inquilino.findFirst({
      where: { 
        id: parseInt(id), 
        deletedAt: null,
        activo: true
      }
    });

    if (!inquilino) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }

    // Filtrar solo los campos editables y preparar datos
    const {
      id: _id,
      createdAt,
      updatedAt,
      deletedAt,
      activo,
      ...updateData
    } = data;

    // Preparar datos de actualización con validación y conversión de tipos
    const inquilinoUpdateData = {
      nombre: updateData.nombre?.trim() || null,
      apellido: updateData.apellido?.trim() || null,
      razonSocial: updateData.razonSocial?.trim() || null,
      dni: updateData.dni?.trim() || null,
      cuit: updateData.cuit?.trim() || null,
      mail: updateData.mail?.trim() || null,
      telefono: updateData.telefono?.trim() || null,
      dirCalle: updateData.dirCalle?.trim() || null,
      dirNro: updateData.dirNro?.trim() || null,
      dirPiso: updateData.dirPiso?.trim() || null,
      dirDepto: updateData.dirDepto?.trim() || null,
      localidadId: updateData.localidadId ? parseInt(updateData.localidadId) : null,
      provinciaId: updateData.provinciaId ? parseInt(updateData.provinciaId) : null,
      tipoPersonaId: updateData.tipoPersonaId ? parseInt(updateData.tipoPersonaId) : null,
      condicionIvaId: updateData.condicionIvaId ? parseInt(updateData.condicionIvaId) : null
    };

    const updated = await prisma.inquilino.update({
      where: { id: parseInt(id) },
      data: inquilinoUpdateData
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar inquilino:', error);
    console.error('Error details:', error.message);
    console.error('Data received:', req.body);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un inquilino con estos datos (DNI/CUIT duplicado)' });
    }

    res.status(500).json({ error: 'Error al actualizar inquilino', details: error.message });
  }
};

export const deleteInquilino = async (req, res) => {
  try {
    const { id } = req.params;

    const inquilino = await prisma.inquilino.findFirst({
      where: { 
        id: parseInt(id), 
        deletedAt: null,
        activo: true
      }
    });

    if (!inquilino) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }

    // Baja lógica
    await prisma.inquilino.update({
      where: { id: parseInt(id) },
      data: {
        activo: false,
        deletedAt: new Date()
      }
    });

    res.json({ message: 'Inquilino eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar inquilino:', error);
    res.status(500).json({ error: 'Error al eliminar inquilino' });
  }
};

