import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllPropietarios = async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isDeleted: false,
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

    const [propietarios, total] = await Promise.all([
      prisma.propietario.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          unidades: {
            where: { isDeleted: false }
          }
        }
      }),
      prisma.propietario.count({ where })
    ]);

    res.json({
      data: propietarios,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error al obtener propietarios:', error);
    res.status(500).json({ error: 'Error al obtener propietarios' });
  }
};

export const getPropietarioById = async (req, res) => {
  try {
    const { id } = req.params;

    const propietario = await prisma.propietario.findFirst({
      where: {
        id,
        isDeleted: false
      },
      include: {
        unidades: {
          where: { isDeleted: false },
          include: {
            cuentas: {
              where: { isDeleted: false }
            },
            contratos: {
              where: { isDeleted: false },
              include: {
                inquilino: true
              }
            }
          }
        }
      }
    });

    if (!propietario) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }

    res.json(propietario);
  } catch (error) {
    console.error('Error al obtener propietario:', error);
    res.status(500).json({ error: 'Error al obtener propietario' });
  }
};

export const createPropietario = async (req, res) => {
  try {
    const data = req.body;

    // Validar que tenga DNI o CUIT
    if (!data.dni && !data.cuit) {
      return res.status(400).json({ error: 'Debe proporcionar DNI o CUIT' });
    }

    const propietario = await prisma.propietario.create({
      data
    });

    res.status(201).json(propietario);
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
    const { id } = req.params;
    const data = req.body;

    const propietario = await prisma.propietario.findFirst({
      where: { id, isDeleted: false }
    });

    if (!propietario) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }

    // Validar que tenga DNI o CUIT
    if (!data.dni && !data.cuit) {
      return res.status(400).json({ error: 'Debe proporcionar DNI o CUIT' });
    }

    // Limpiar datos: excluir campos que no se deben actualizar
    const {
      id: _id,
      createdAt,
      updatedAt,
      deletedAt,
      isDeleted,
      unidades,
      ...updateData
    } = data;

    const updated = await prisma.propietario.update({
      where: { id },
      data: updateData
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar propietario:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0];
      if (field === 'cuit') {
        return res.status(400).json({ error: 'Ya existe un propietario con este CUIT' });
      }
      return res.status(400).json({ error: 'Ya existe un propietario con estos datos (DNI/CUIT duplicado)' });
    }

    res.status(500).json({ 
      error: 'Error al actualizar propietario',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const deletePropietario = async (req, res) => {
  try {
    const { id } = req.params;

    const propietario = await prisma.propietario.findFirst({
      where: { id, isDeleted: false },
      include: {
        unidades: {
          where: { isDeleted: false }
        }
      }
    });

    if (!propietario) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }

    // Verificar que no tenga unidades activas
    if (propietario.unidades.length > 0) {
      return res.status(400).json({ error: 'No se puede eliminar un propietario con unidades asociadas' });
    }

    // Baja lógica
    await prisma.propietario.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });

    res.json({ message: 'Propietario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar propietario:', error);
    res.status(500).json({ error: 'Error al eliminar propietario' });
  }
};

