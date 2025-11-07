import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Contratos principales
export const getAllContratos = async (req, res) => {
  try {
    const { search, unidadId, inquilinoId, activo, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const now = new Date();

    const where = {
      isDeleted: false,
      ...(unidadId && { unidadId }),
      ...(inquilinoId && { inquilinoId }),
      ...(activo === 'true' && {
        OR: [
          { fechaFin: null },
          { fechaFin: { gte: now } }
        ]
      }),
      ...(search && {
        OR: [
          { nroContrato: { contains: search, mode: 'insensitive' } },
          { unidad: { direccion: { contains: search, mode: 'insensitive' } } },
          { inquilino: { nombre: { contains: search, mode: 'insensitive' } } },
          { inquilino: { apellido: { contains: search, mode: 'insensitive' } } }
        ]
      })
    };

    const [contratos, total] = await Promise.all([
      prisma.contrato.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { fechaInicio: 'desc' },
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
          },
          inquilino: true
        }
      }),
      prisma.contrato.count({ where })
    ]);

    res.json({
      data: contratos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error al obtener contratos:', error);
    res.status(500).json({ error: 'Error al obtener contratos' });
  }
};

export const getContratoById = async (req, res) => {
  try {
    const { id } = req.params;

    const contrato = await prisma.contrato.findFirst({
      where: {
        id,
        isDeleted: false
      },
      include: {
        unidad: {
          include: {
            propietario: true,
            cuentas: {
              where: { isDeleted: false }
            }
          }
        },
        inquilino: true,
        responsabilidades: true,
        garantias: true,
        gastosIniciales: true,
        liquidaciones: {
          orderBy: { periodo: 'desc' },
          include: {
            items: true
          }
        }
      }
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    res.json(contrato);
  } catch (error) {
    console.error('Error al obtener contrato:', error);
    res.status(500).json({ error: 'Error al obtener contrato' });
  }
};

export const getContratosByUnidad = async (req, res) => {
  try {
    const { unidadId } = req.params;

    const contratos = await prisma.contrato.findMany({
      where: {
        unidadId,
        isDeleted: false
      },
      include: {
        inquilino: true,
        responsabilidades: true
      },
      orderBy: { fechaInicio: 'desc' }
    });

    res.json(contratos);
  } catch (error) {
    console.error('Error al obtener contratos por unidad:', error);
    res.status(500).json({ error: 'Error al obtener contratos' });
  }
};

export const getContratosByInquilino = async (req, res) => {
  try {
    const { inquilinoId } = req.params;

    const contratos = await prisma.contrato.findMany({
      where: {
        inquilinoId,
        isDeleted: false
      },
      include: {
        unidad: {
          include: {
            propietario: true
          }
        }
      },
      orderBy: { fechaInicio: 'desc' }
    });

    res.json(contratos);
  } catch (error) {
    console.error('Error al obtener contratos por inquilino:', error);
    res.status(500).json({ error: 'Error al obtener contratos' });
  }
};

export const createContrato = async (req, res) => {
  try {
    const data = req.body;

    if (!data.unidadId || !data.inquilinoId || !data.fechaInicio || !data.montoInicial) {
      return res.status(400).json({ error: 'Unidad, inquilino, fecha de inicio y monto inicial son requeridos' });
    }

    // Verificar que la unidad y el inquilino existen
    const [unidad, inquilino] = await Promise.all([
      prisma.unidad.findFirst({ where: { id: data.unidadId, isDeleted: false } }),
      prisma.inquilino.findFirst({ where: { id: data.inquilinoId, isDeleted: false } })
    ]);

    if (!unidad) {
      return res.status(404).json({ error: 'Unidad no encontrada' });
    }
    if (!inquilino) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }

    const contrato = await prisma.contrato.create({
      data: {
        ...data,
        montoInicial: parseFloat(data.montoInicial),
        gastosAdministrativos: data.gastosAdministrativos ? parseFloat(data.gastosAdministrativos) : null,
        topeAjuste: data.topeAjuste ? parseFloat(data.topeAjuste) : null
      },
      include: {
        unidad: {
          include: { propietario: true }
        },
        inquilino: true
      }
    });

    res.status(201).json(contrato);
  } catch (error) {
    console.error('Error al crear contrato:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un contrato con estos datos' });
    }

    res.status(500).json({ error: 'Error al crear contrato' });
  }
};

export const updateContrato = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const contrato = await prisma.contrato.findFirst({
      where: { id, isDeleted: false }
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const updated = await prisma.contrato.update({
      where: { id },
      data: {
        ...data,
        montoInicial: data.montoInicial ? parseFloat(data.montoInicial) : undefined,
        gastosAdministrativos: data.gastosAdministrativos !== undefined ? parseFloat(data.gastosAdministrativos) : undefined,
        topeAjuste: data.topeAjuste !== undefined ? parseFloat(data.topeAjuste) : undefined
      },
      include: {
        unidad: {
          include: { propietario: true }
        },
        inquilino: true
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar contrato:', error);
    res.status(500).json({ error: 'Error al actualizar contrato' });
  }
};

export const deleteContrato = async (req, res) => {
  try {
    const { id } = req.params;

    const contrato = await prisma.contrato.findFirst({
      where: { id, isDeleted: false },
      include: {
        liquidaciones: true
      }
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Verificar que no tenga liquidaciones
    if (contrato.liquidaciones.length > 0) {
      return res.status(400).json({ error: 'No se puede eliminar un contrato con liquidaciones asociadas' });
    }

    // Baja lógica
    await prisma.contrato.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });

    res.json({ message: 'Contrato eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar contrato:', error);
    res.status(500).json({ error: 'Error al eliminar contrato' });
  }
};

// Responsabilidades
export const addResponsabilidad = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const contrato = await prisma.contrato.findFirst({
      where: { id, isDeleted: false }
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const responsabilidad = await prisma.contratoResponsabilidad.create({
      data: {
        ...data,
        contratoId: id
      }
    });

    res.status(201).json(responsabilidad);
  } catch (error) {
    console.error('Error al crear responsabilidad:', error);
    res.status(500).json({ error: 'Error al crear responsabilidad' });
  }
};

export const updateResponsabilidad = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const responsabilidad = await prisma.contratoResponsabilidad.findUnique({
      where: { id }
    });

    if (!responsabilidad) {
      return res.status(404).json({ error: 'Responsabilidad no encontrada' });
    }

    const updated = await prisma.contratoResponsabilidad.update({
      where: { id },
      data
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar responsabilidad:', error);
    res.status(500).json({ error: 'Error al actualizar responsabilidad' });
  }
};

export const deleteResponsabilidad = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.contratoResponsabilidad.delete({
      where: { id }
    });

    res.json({ message: 'Responsabilidad eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar responsabilidad:', error);
    res.status(500).json({ error: 'Error al eliminar responsabilidad' });
  }
};

// Garantías
export const addGarantia = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const contrato = await prisma.contrato.findFirst({
      where: { id, isDeleted: false }
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const garantia = await prisma.garantia.create({
      data: {
        ...data,
        contratoId: id
      }
    });

    res.status(201).json(garantia);
  } catch (error) {
    console.error('Error al crear garantía:', error);
    res.status(500).json({ error: 'Error al crear garantía' });
  }
};

export const updateGarantia = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const garantia = await prisma.garantia.findUnique({
      where: { id }
    });

    if (!garantia) {
      return res.status(404).json({ error: 'Garantía no encontrada' });
    }

    const updated = await prisma.garantia.update({
      where: { id },
      data
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar garantía:', error);
    res.status(500).json({ error: 'Error al actualizar garantía' });
  }
};

export const deleteGarantia = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.garantia.delete({
      where: { id }
    });

    res.json({ message: 'Garantía eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar garantía:', error);
    res.status(500).json({ error: 'Error al eliminar garantía' });
  }
};

// Gastos iniciales
export const addGastoInicial = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const contrato = await prisma.contrato.findFirst({
      where: { id, isDeleted: false }
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const gasto = await prisma.contratoGastoInicial.create({
      data: {
        ...data,
        contratoId: id,
        importe: parseFloat(data.importe)
      }
    });

    res.status(201).json(gasto);
  } catch (error) {
    console.error('Error al crear gasto inicial:', error);
    res.status(500).json({ error: 'Error al crear gasto inicial' });
  }
};

export const updateGastoInicial = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const gasto = await prisma.contratoGastoInicial.findUnique({
      where: { id }
    });

    if (!gasto) {
      return res.status(404).json({ error: 'Gasto inicial no encontrado' });
    }

    const updated = await prisma.contratoGastoInicial.update({
      where: { id },
      data: {
        ...data,
        importe: data.importe ? parseFloat(data.importe) : undefined
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar gasto inicial:', error);
    res.status(500).json({ error: 'Error al actualizar gasto inicial' });
  }
};

export const deleteGastoInicial = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.contratoGastoInicial.delete({
      where: { id }
    });

    res.json({ message: 'Gasto inicial eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar gasto inicial:', error);
    res.status(500).json({ error: 'Error al eliminar gasto inicial' });
  }
};

