import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllPropietarios = async (req, res) => {
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

    const [propietarios, total] = await Promise.all([
      prisma.propietario.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          tipoPersona: true,
          propiedades: {
            where: {
              deletedAt: null,
              activo: true
            },
            include: {
              propiedad: {
                include: {
                  localidad: {
                    include: {
                      provincia: true
                    }
                  },
                  provincia: true,
                  tipoPropiedad: true
                }
              }
            }
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
    const propietarioId = parseInt(id);

    if (isNaN(propietarioId)) {
      return res.status(400).json({ error: 'ID de propietario inválido' });
    }

    const propietario = await prisma.propietario.findFirst({
      where: {
        id: propietarioId,
        deletedAt: null,
        activo: true
      },
      include: {
        tipoPersona: true,
        propiedades: {
          where: {
            deletedAt: null,
            activo: true
          },
          include: {
            propiedad: {
              include: {
                localidad: {
                  include: {
                    provincia: true
                  }
                },
                provincia: true,
                tipoPropiedad: true,
                impuestos: {
                  where: {
                    deletedAt: null,
                    activo: true
                  }
                },
                contratos: {
                  where: {
                    deletedAt: null,
                    activo: true
                  },
                  include: {
                    inquilino: true
                  }
                }
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
    const propietarioId = parseInt(id);
    const data = req.body;

    if (isNaN(propietarioId)) {
      return res.status(400).json({ error: 'ID de propietario inválido' });
    }

    const propietario = await prisma.propietario.findFirst({
      where: { id: propietarioId, deletedAt: null, activo: true }
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
      activo,
      propiedades,
      ...updateData
    } = data;

    const updated = await prisma.propietario.update({
      where: { id: propietarioId },
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
    const propietarioId = parseInt(id);

    if (isNaN(propietarioId)) {
      return res.status(400).json({ error: 'ID de propietario inválido' });
    }

    const propietario = await prisma.propietario.findFirst({
      where: { id: propietarioId, deletedAt: null, activo: true },
      include: {
        propiedades: {
          where: {
            deletedAt: null,
            activo: true
          }
        }
      }
    });

    if (!propietario) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }

    // Verificar que no tenga propiedades activas
    if (propietario.propiedades.length > 0) {
      return res.status(400).json({ error: 'No se puede eliminar un propietario con propiedades asociadas' });
    }

    // Baja lógica
    await prisma.propietario.update({
      where: { id: propietarioId },
      data: {
        activo: false,
        deletedAt: new Date()
      }
    });

    res.json({ message: 'Propietario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar propietario:', error);
    res.status(500).json({ error: 'Error al eliminar propietario' });
  }
};

// Asociar propiedades a un propietario
export const asociarPropiedades = async (req, res) => {
  try {
    const { id } = req.params;
    const { propiedadIds } = req.body;

    // Verificar que el propietario existe
    const propietario = await prisma.propietario.findFirst({
      where: { id: parseInt(id), deletedAt: null, activo: true }
    });

    if (!propietario) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }

    // Verificar que las propiedades existen
    if (propiedadIds && propiedadIds.length > 0) {
      const propiedades = await prisma.propiedad.findMany({
        where: {
          id: { in: propiedadIds.map(id => parseInt(id)) },
          deletedAt: null,
          activo: true
        }
      });

      if (propiedades.length !== propiedadIds.length) {
        return res.status(404).json({ error: 'Una o más propiedades no encontradas' });
      }

      // Crear o actualizar asociaciones
      await prisma.$transaction(
        propiedadIds.map(propiedadId =>
          prisma.propiedadPropietario.upsert({
            where: {
              propiedadId_propietarioId: {
                propiedadId: parseInt(propiedadId),
                propietarioId: parseInt(id)
              }
            },
            update: {
              activo: true,
              deletedAt: null
            },
            create: {
              propiedadId: parseInt(propiedadId),
              propietarioId: parseInt(id),
              activo: true
            }
          })
        )
      );
    }

    // Obtener el propietario actualizado con sus propiedades
    const propietarioActualizado = await prisma.propietario.findFirst({
      where: { id: parseInt(id) },
      include: {
        propiedades: {
          where: { activo: true },
          include: {
            propiedad: {
              include: {
                localidad: {
                  include: { provincia: true }
                },
                provincia: true,
                tipoPropiedad: true
              }
            }
          }
        }
      }
    });

    res.json(propietarioActualizado);
  } catch (error) {
    console.error('Error al asociar propiedades:', error);
    res.status(500).json({ error: 'Error al asociar propiedades' });
  }
};

// Desasociar una propiedad de un propietario
export const desasociarPropiedad = async (req, res) => {
  try {
    const { id, propiedadId } = req.params;

    // Verificar que la asociación existe
    const asociacion = await prisma.propiedadPropietario.findUnique({
      where: {
        propiedadId_propietarioId: {
          propiedadId: parseInt(propiedadId),
          propietarioId: parseInt(id)
        }
      }
    });

    if (!asociacion) {
      return res.status(404).json({ error: 'Asociación no encontrada' });
    }

    // Soft delete de la asociación
    await prisma.propiedadPropietario.update({
      where: {
        propiedadId_propietarioId: {
          propiedadId: parseInt(propiedadId),
          propietarioId: parseInt(id)
        }
      },
      data: {
        activo: false,
        deletedAt: new Date()
      }
    });

    res.json({ message: 'Propiedad desasociada exitosamente' });
  } catch (error) {
    console.error('Error al desasociar propiedad:', error);
    res.status(500).json({ error: 'Error al desasociar propiedad' });
  }
};

