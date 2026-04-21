import prisma from '../db/prisma.js';

export const getAllCuentasTributarias = async (req, res) => {
  try {
    const { unidadId, tipoImpuesto, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isDeleted: false,
      ...(unidadId && { unidadId }),
      ...(tipoImpuesto && { tipoImpuesto })
    };

    const [cuentas, total] = await Promise.all([
      prisma.cuentaTributaria.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          unidad: {
            include: {
              propietario: {
                select: {
                  id: true,
                  nombre: true,
                  apellido: true,
                  razonSocial: true
                }
              }
            }
          }
        }
      }),
      prisma.cuentaTributaria.count({ where })
    ]);

    // Ordenar por dirección de unidad si no hay filtros
    if (!unidadId && !tipoImpuesto) {
      cuentas.sort((a, b) => {
        const dirA = `${a.unidad.direccion} ${a.unidad.localidad}`.toLowerCase();
        const dirB = `${b.unidad.direccion} ${b.unidad.localidad}`.toLowerCase();
        return dirA.localeCompare(dirB);
      });
    }

    res.json({
      data: cuentas,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error al obtener cuentas tributarias:', error);
    res.status(500).json({ error: 'Error al obtener cuentas tributarias' });
  }
};

export const getCuentasByUnidad = async (req, res) => {
  try {
    const { unidadId } = req.params;

    const cuentas = await prisma.cuentaTributaria.findMany({
      where: {
        unidadId,
        isDeleted: false
      },
      orderBy: { tipoImpuesto: 'asc' }
    });

    res.json(cuentas);
  } catch (error) {
    console.error('Error al obtener cuentas por unidad:', error);
    res.status(500).json({ error: 'Error al obtener cuentas tributarias' });
  }
};

export const getCuentaTributariaById = async (req, res) => {
  try {
    const { id } = req.params;

    const cuenta = await prisma.cuentaTributaria.findFirst({
      where: {
        id,
        isDeleted: false
      },
      include: {
        unidad: {
          include: {
            propietario: true
          }
        }
      }
    });

    if (!cuenta) {
      return res.status(404).json({ error: 'Cuenta tributaria no encontrada' });
    }

    res.json(cuenta);
  } catch (error) {
    console.error('Error al obtener cuenta tributaria:', error);
    res.status(500).json({ error: 'Error al obtener cuenta tributaria' });
  }
};

export const createCuentaTributaria = async (req, res) => {
  try {
    const data = req.body;

    if (!data.unidadId || !data.tipoImpuesto) {
      return res.status(400).json({ error: 'Unidad y tipo de impuesto son requeridos' });
    }

    // Verificar que la unidad existe
    const unidad = await prisma.unidad.findFirst({
      where: { id: data.unidadId, isDeleted: false }
    });

    if (!unidad) {
      return res.status(404).json({ error: 'Unidad no encontrada' });
    }

    // Limpiar campos vacíos (convertir '' a null)
    if (data.codigo1 === '') data.codigo1 = null;
    if (data.codigo2 === '') data.codigo2 = null;
    if (data.periodicidad === '') data.periodicidad = null;
    if (data.usuarioEmail === '') data.usuarioEmail = null;
    if (data.password === '') data.password = null;
    if (data.observaciones === '') data.observaciones = null;

    // Verificar si existe una cuenta activa con la misma unidad y tipo de impuesto
    const cuentaActiva = await prisma.cuentaTributaria.findFirst({
      where: {
        unidadId: data.unidadId,
        tipoImpuesto: data.tipoImpuesto,
        isDeleted: false
      }
    });

    if (cuentaActiva) {
      return res.status(400).json({ error: 'Ya existe una cuenta tributaria activa de este tipo para esta unidad' });
    }

    // Verificar si existe una cuenta eliminada (soft delete) con la misma unidad y tipo de impuesto
    const cuentaEliminada = await prisma.cuentaTributaria.findFirst({
      where: {
        unidadId: data.unidadId,
        tipoImpuesto: data.tipoImpuesto,
        isDeleted: true
      }
    });

    // Si existe una cuenta eliminada, reactivarla y actualizarla
    if (cuentaEliminada) {
      const cuenta = await prisma.cuentaTributaria.update({
        where: { id: cuentaEliminada.id },
        data: {
          ...data,
          isDeleted: false,
          deletedAt: null
        },
        include: {
          unidad: {
            include: {
              propietario: {
                select: {
                  id: true,
                  nombre: true,
                  apellido: true,
                  razonSocial: true
                }
              }
            }
          }
        }
      });

      return res.status(200).json(cuenta);
    }

    // Si no existe una cuenta eliminada, crear una nueva
    const cuenta = await prisma.cuentaTributaria.create({
      data,
      include: {
        unidad: {
          include: {
            propietario: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                razonSocial: true
              }
            }
          }
        }
      }
    });

    res.status(201).json(cuenta);
  } catch (error) {
    console.error('Error al crear cuenta tributaria:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una cuenta tributaria activa de este tipo para esta unidad' });
    }

    res.status(500).json({ error: 'Error al crear cuenta tributaria' });
  }
};

export const updateCuentaTributaria = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: _, createdAt, updatedAt, deletedAt, isDeleted, unidad, items, ...data } = req.body;

    // Verificar que la cuenta existe y no está eliminada
    const cuenta = await prisma.cuentaTributaria.findUnique({
      where: { id }
    });

    if (!cuenta || cuenta.isDeleted) {
      return res.status(404).json({ error: 'Cuenta tributaria no encontrada' });
    }

    // Validar que unidad existe si se está actualizando
    if (data.unidadId) {
      const unidad = await prisma.unidad.findUnique({
        where: { id: data.unidadId }
      });
      if (!unidad || unidad.isDeleted) {
        return res.status(404).json({ error: 'Unidad no encontrada' });
      }
    }

    // Limpiar campos vacíos
    if (data.codigo1 === '') data.codigo1 = null;
    if (data.codigo2 === '') data.codigo2 = null;
    if (data.periodicidad === '') data.periodicidad = null;
    if (data.usuarioEmail === '') data.usuarioEmail = null;
    if (data.password === '') data.password = null;
    if (data.observaciones === '') data.observaciones = null;

    const updated = await prisma.cuentaTributaria.update({
      where: { id },
      data,
      include: {
        unidad: {
          include: {
            propietario: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                razonSocial: true
              }
            }
          }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar cuenta tributaria:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una cuenta tributaria de este tipo para esta unidad' });
    }

    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Referencia inválida: la unidad no existe' });
    }

    res.status(500).json({ error: 'Error al actualizar cuenta tributaria' });
  }
};

export const deleteCuentaTributaria = async (req, res) => {
  try {
    const { id } = req.params;

    const cuenta = await prisma.cuentaTributaria.findFirst({
      where: { id, isDeleted: false }
    });

    if (!cuenta) {
      return res.status(404).json({ error: 'Cuenta tributaria no encontrada' });
    }

    // Baja lógica
    await prisma.cuentaTributaria.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });

    res.json({ message: 'Cuenta tributaria eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar cuenta tributaria:', error);
    res.status(500).json({ error: 'Error al eliminar cuenta tributaria' });
  }
};

