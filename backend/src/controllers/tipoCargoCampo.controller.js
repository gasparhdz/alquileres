import prisma from '../db/prisma.js';

// Obtener todos los campos de un tipo de cargo
export const getCamposByTipoCargo = async (req, res) => {
  try {
    const { tipoCargoId } = req.params;

    const campos = await prisma.tipoCargoCampo.findMany({
      where: {
        tipoCargoId: parseInt(tipoCargoId),
        deletedAt: null,
        activo: true
      },
      orderBy: {
        orden: 'asc'
      },
      include: {
        tipoCargo: {
          select: {
            id: true,
            codigo: true,
            nombre: true
          }
        }
      }
    });

    res.json(campos);
  } catch (error) {
    console.error('Error al obtener campos de tipo de cargo:', error);
    res.status(500).json({ error: 'Error al obtener campos de tipo de cargo' });
  }
};

// Obtener todos los campos (con filtro opcional de tipo de cargo)
export const getAllCampos = async (req, res) => {
  try {
    const { tipoCargoId, mostrarInactivos } = req.query;

    const where = {
      deletedAt: null
    };

    if (tipoCargoId) {
      where.tipoCargoId = parseInt(tipoCargoId);
    }

    if (mostrarInactivos !== 'true') {
      where.activo = true;
    }

    const campos = await prisma.tipoCargoCampo.findMany({
      where,
      orderBy: [
        { tipoCargoId: 'asc' },
        { orden: 'asc' }
      ],
      include: {
        tipoCargo: {
          select: {
            id: true,
            codigo: true,
            nombre: true
          }
        }
      }
    });

    res.json(campos);
  } catch (error) {
    console.error('Error al obtener campos:', error);
    res.status(500).json({ error: 'Error al obtener campos' });
  }
};

// Obtener un campo por ID
export const getCampoById = async (req, res) => {
  try {
    const { id } = req.params;

    const campo = await prisma.tipoCargoCampo.findFirst({
      where: {
        id: parseInt(id),
        deletedAt: null
      },
      include: {
        tipoCargo: {
          select: {
            id: true,
            codigo: true,
            nombre: true
          }
        }
      }
    });

    if (!campo) {
      return res.status(404).json({ error: 'Campo no encontrado' });
    }

    res.json(campo);
  } catch (error) {
    console.error('Error al obtener campo:', error);
    res.status(500).json({ error: 'Error al obtener campo' });
  }
};

// Crear un nuevo campo
export const createCampo = async (req, res) => {
  try {
    const { tipoCargoId, codigo, nombre, orden, activo = true } = req.body;

    if (!tipoCargoId || !codigo || !nombre) {
      return res.status(400).json({ error: 'tipoCargoId, codigo y nombre son requeridos' });
    }

    // Verificar que el tipo de cargo existe
    const tipoCargo = await prisma.tipoCargo.findFirst({
      where: {
        id: parseInt(tipoCargoId),
        activo: true,
        deletedAt: null
      }
    });

    if (!tipoCargo) {
      return res.status(404).json({ error: 'Tipo de cargo no encontrado' });
    }

    // Verificar que no exista otro campo con el mismo código para este tipo de cargo
    const campoExistente = await prisma.tipoCargoCampo.findFirst({
      where: {
        tipoCargoId: parseInt(tipoCargoId),
        codigo: codigo.trim(),
        deletedAt: null
      }
    });

    if (campoExistente) {
      return res.status(400).json({ error: 'Ya existe un campo con este código para este tipo de cargo' });
    }

    const campo = await prisma.tipoCargoCampo.create({
      data: {
        tipoCargoId: parseInt(tipoCargoId),
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        orden: orden !== undefined ? parseInt(orden) : 0,
        activo: Boolean(activo)
      },
      include: {
        tipoCargo: {
          select: {
            id: true,
            codigo: true,
            nombre: true
          }
        }
      }
    });

    res.status(201).json(campo);
  } catch (error) {
    console.error('Error al crear campo:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un campo con este código para este tipo de cargo' });
    }

    res.status(500).json({ error: 'Error al crear campo' });
  }
};

// Actualizar un campo
export const updateCampo = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipoCargoId, codigo, nombre, orden, activo } = req.body;

    // Verificar que el campo existe
    const campoExistente = await prisma.tipoCargoCampo.findFirst({
      where: {
        id: parseInt(id),
        deletedAt: null
      }
    });

    if (!campoExistente) {
      return res.status(404).json({ error: 'Campo no encontrado' });
    }

    // Si se cambia el código, verificar que no exista otro con el mismo código para el mismo tipo de cargo
    if (codigo && codigo.trim() !== campoExistente.codigo) {
      const otroCampo = await prisma.tipoCargoCampo.findFirst({
        where: {
          tipoCargoId: tipoCargoId ? parseInt(tipoCargoId) : campoExistente.tipoCargoId,
          codigo: codigo.trim(),
          deletedAt: null,
          id: { not: parseInt(id) }
        }
      });

      if (otroCampo) {
        return res.status(400).json({ error: 'Ya existe otro campo con este código para este tipo de cargo' });
      }
    }

    // Si se cambia el tipo de cargo, verificar que existe
    if (tipoCargoId && parseInt(tipoCargoId) !== campoExistente.tipoCargoId) {
      const tipoCargo = await prisma.tipoCargo.findFirst({
        where: {
          id: parseInt(tipoCargoId),
          activo: true,
          deletedAt: null
        }
      });

      if (!tipoCargo) {
        return res.status(404).json({ error: 'Tipo de cargo no encontrado' });
      }
    }

    const dataToUpdate = {};
    if (tipoCargoId !== undefined) dataToUpdate.tipoCargoId = parseInt(tipoCargoId);
    if (codigo !== undefined) dataToUpdate.codigo = codigo.trim();
    if (nombre !== undefined) dataToUpdate.nombre = nombre.trim();
    if (orden !== undefined) dataToUpdate.orden = parseInt(orden);
    if (activo !== undefined) dataToUpdate.activo = Boolean(activo);

    const campo = await prisma.tipoCargoCampo.update({
      where: { id: parseInt(id) },
      data: dataToUpdate,
      include: {
        tipoCargo: {
          select: {
            id: true,
            codigo: true,
            nombre: true
          }
        }
      }
    });

    res.json(campo);
  } catch (error) {
    console.error('Error al actualizar campo:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe otro campo con este código para este tipo de cargo' });
    }

    res.status(500).json({ error: 'Error al actualizar campo' });
  }
};

// Eliminar (soft delete) un campo
export const deleteCampo = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el campo existe
    const campo = await prisma.tipoCargoCampo.findFirst({
      where: {
        id: parseInt(id),
        deletedAt: null
      },
      include: {
        valores: {
          where: {
            deletedAt: null
          }
        }
      }
    });

    if (!campo) {
      return res.status(404).json({ error: 'Campo no encontrado' });
    }

    // Verificar si tiene valores asociados
    if (campo.valores && campo.valores.length > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar el campo porque tiene valores asociados. Desactívelo en su lugar.' 
      });
    }

    // Soft delete
    await prisma.tipoCargoCampo.update({
      where: { id: parseInt(id) },
      data: {
        activo: false,
        deletedAt: new Date()
      }
    });

    res.json({ message: 'Campo eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar campo:', error);
    res.status(500).json({ error: 'Error al eliminar campo' });
  }
};

