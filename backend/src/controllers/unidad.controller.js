import { PrismaClient } from '@prisma/client';

// Singleton pattern para asegurar que prisma siempre esté inicializado
let prismaInstance = null;

const getPrisma = () => {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
};

const prisma = getPrisma();

export const getAllUnidades = async (req, res) => {
  try {
    // Validar que prisma esté inicializado
    if (!prisma || !prisma.unidad) {
      console.error('Prisma client no está inicializado correctamente');
      return res.status(500).json({ error: 'Error de configuración del servidor' });
    }

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

    if (!data.direccion || !data.localidad) {
      return res.status(400).json({ error: 'Dirección y localidad son requeridos' });
    }

    // Verificar que el propietario existe si se proporciona
    if (data.propietarioId) {
      const propietario = await prisma.propietario.findFirst({
        where: { id: data.propietarioId, isDeleted: false }
      });

      if (!propietario) {
        return res.status(404).json({ error: 'Propietario no encontrado' });
      }
    }

    // Si no hay propietario, establecer a null
    const unidadData = {
      ...data,
      propietarioId: data.propietarioId || null
    };

    // Limpiar campos que pueden venir como cadena vacía y convertirlos a null
    if (unidadData.ambientes === '') unidadData.ambientes = null;
    if (unidadData.descripcion === '') unidadData.descripcion = null;
    if (unidadData.codigoInterno === '') unidadData.codigoInterno = null;
    if (unidadData.tipo === '') unidadData.tipo = null;
    if (unidadData.estado === '') unidadData.estado = null;
    const unidad = await prisma.unidad.create({
      data: unidadData,
      include: {
        propietario: true
      }
    });

    res.status(201).json(unidad);
  } catch (error) {
    console.error('Error al crear unidad:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una propiedad con esta dirección y localidad para este propietario' });
    }

    res.status(500).json({ error: 'Error al crear propiedad' });
  }
};

export const updateUnidad = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validar campos requeridos
    if (!req.body.direccion || !req.body.localidad) {
      return res.status(400).json({ error: 'Dirección y localidad son requeridos' });
    }

    // Verificar que la unidad existe y no está eliminada
    const unidad = await prisma.unidad.findUnique({
      where: { id }
    });

    if (!unidad || unidad.isDeleted) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    // Verificar que el propietario existe si se proporciona
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

    // Si propietarioId es una cadena vacía, establecer a null
    if (updateData.propietarioId === '' || updateData.propietarioId === undefined) {
      updateData.propietarioId = null;
    }

    // Limpiar campos que pueden venir como cadena vacía y convertirlos a null
    if (updateData.ambientes === '') updateData.ambientes = null;
    if (updateData.descripcion === '') updateData.descripcion = null;
    if (updateData.codigoInterno === '') updateData.codigoInterno = null;
    if (updateData.tipo === '') updateData.tipo = null;
    if (updateData.estado === '') updateData.estado = null;

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
    console.error('Error details:', JSON.stringify({
      message: error.message,
      code: error.code,
      meta: error.meta
    }, null, 2));
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una propiedad con esta dirección y localidad para este propietario' });
    }

    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'El propietario especificado no es válido' });
    }

    if (error.code === 'P2022') {
      return res.status(500).json({ 
        error: 'Error de esquema de base de datos',
        message: 'La base de datos no coincide con el esquema. Por favor, ejecuta las migraciones y regenera el cliente de Prisma.',
        details: error.meta
      });
    }

    res.status(500).json({ 
      error: 'Error al actualizar unidad',
      message: error.message,
      code: error.code,
      meta: error.meta
    });
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


