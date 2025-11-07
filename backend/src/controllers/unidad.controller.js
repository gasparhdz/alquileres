import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllUnidades = async (req, res) => {
  try {
    const { search, propietarioId, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isDeleted: false,
      ...(search && {
        OR: [
          { direccion: { contains: search, mode: 'insensitive' } },
          { localidad: { contains: search, mode: 'insensitive' } },
          { codigoInterno: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(propietarioId && { propietarioId })
    };

    const [unidades, total] = await Promise.all([
      prisma.unidad.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          propietario: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              razonSocial: true
            }
          },
          _count: {
            select: {
              contratos: {
                where: { isDeleted: false }
              },
              cuentas: {
                where: { isDeleted: false }
              }
            }
          }
        }
      }),
      prisma.unidad.count({ where })
    ]);

    res.json({
      data: unidades,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error al obtener unidades:', error);
    res.status(500).json({ error: 'Error al obtener unidades' });
  }
};

export const getUnidadById = async (req, res) => {
  try {
    const { id } = req.params;

    const unidad = await prisma.unidad.findFirst({
      where: {
        id,
        isDeleted: false
      },
      include: {
        propietario: true,
        cuentas: {
          where: { isDeleted: false }
        },
        contratos: {
          where: { isDeleted: false },
          include: {
            inquilino: true,
            responsabilidades: true,
            garantias: true,
            gastosIniciales: true
          },
          orderBy: { fechaInicio: 'desc' }
        }
      }
    });

    if (!unidad) {
      return res.status(404).json({ error: 'Unidad no encontrada' });
    }

    res.json(unidad);
  } catch (error) {
    console.error('Error al obtener unidad:', error);
    res.status(500).json({ error: 'Error al obtener unidad' });
  }
};

export const createUnidad = async (req, res) => {
  try {
    const data = req.body;

    if (!data.direccion || !data.localidad || !data.propietarioId) {
      return res.status(400).json({ error: 'Dirección, localidad y propietario son requeridos' });
    }

    // Verificar que el propietario existe
    const propietario = await prisma.propietario.findFirst({
      where: { id: data.propietarioId, isDeleted: false }
    });

    if (!propietario) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }

    const unidad = await prisma.unidad.create({
      data,
      include: {
        propietario: true
      }
    });

    res.status(201).json(unidad);
  } catch (error) {
    console.error('Error al crear unidad:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una unidad con esta dirección y localidad para este propietario' });
    }

    res.status(500).json({ error: 'Error al crear unidad' });
  }
};

export const updateUnidad = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validar campos requeridos
    if (!req.body.direccion || !req.body.localidad || !req.body.propietarioId) {
      return res.status(400).json({ error: 'Dirección, localidad y propietario son requeridos' });
    }

    const unidad = await prisma.unidad.findFirst({
      where: { id, isDeleted: false }
    });

    if (!unidad) {
      return res.status(404).json({ error: 'Unidad no encontrada' });
    }

    // Verificar que el propietario existe
    if (req.body.propietarioId) {
      const propietario = await prisma.propietario.findFirst({
        where: { id: req.body.propietarioId, isDeleted: false }
      });

      if (!propietario) {
        return res.status(404).json({ error: 'Propietario no encontrado' });
      }
    }

    // Filtrar solo los campos editables, excluyendo campos read-only
    const {
      id: _id,
      createdAt,
      updatedAt,
      deletedAt,
      isDeleted,
      propietario,
      contratos,
      cuentas,
      _count,
      ...updateData
    } = req.body;

    const updated = await prisma.unidad.update({
      where: { id },
      data: updateData,
      include: {
        propietario: true
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar unidad:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una unidad con estos datos' });
    }

    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'El propietario especificado no es válido' });
    }

    res.status(500).json({ error: 'Error al actualizar unidad' });
  }
};

export const deleteUnidad = async (req, res) => {
  try {
    const { id } = req.params;

    const unidad = await prisma.unidad.findFirst({
      where: { id, isDeleted: false },
      include: {
        contratos: {
          where: { isDeleted: false }
        }
      }
    });

    if (!unidad) {
      return res.status(404).json({ error: 'Unidad no encontrada' });
    }

    // Verificar que no tenga contratos activos
    if (unidad.contratos.length > 0) {
      return res.status(400).json({ error: 'No se puede eliminar una unidad con contratos asociados' });
    }

    // Baja lógica
    await prisma.unidad.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });

    res.json({ message: 'Unidad eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar unidad:', error);
    res.status(500).json({ error: 'Error al eliminar unidad' });
  }
};

