import prisma from '../db/prisma.js';

// Obtener todos los campos de un tipo de impuesto
export const getCamposByTipoImpuesto = async (req, res) => {
  try {
    const { tipoImpuestoId } = req.params;

    const campos = await prisma.tipoImpuestoPropiedadCampo.findMany({
      where: {
        tipoImpuestoId: parseInt(tipoImpuestoId),
        deletedAt: null,
        activo: true
      },
      orderBy: {
        orden: 'asc'
      },
      include: {
        tipoImpuesto: {
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
    console.error('Error al obtener campos de tipo de impuesto:', error);
    res.status(500).json({ error: 'Error al obtener campos de tipo de impuesto' });
  }
};

// Obtener todos los campos (con filtro opcional de tipo de impuesto)
export const getAllCampos = async (req, res) => {
  try {
    const { tipoImpuestoId, mostrarInactivos } = req.query;

    const where = {
      deletedAt: null
    };

    if (tipoImpuestoId) {
      where.tipoImpuestoId = parseInt(tipoImpuestoId);
    }

    if (mostrarInactivos !== 'true') {
      where.activo = true;
    }

    const campos = await prisma.tipoImpuestoPropiedadCampo.findMany({
      where,
      orderBy: [
        { tipoImpuestoId: 'asc' },
        { orden: 'asc' }
      ],
      include: {
        tipoImpuesto: {
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

    const campo = await prisma.tipoImpuestoPropiedadCampo.findFirst({
      where: {
        id: parseInt(id),
        deletedAt: null
      },
      include: {
        tipoImpuesto: {
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
    const { tipoImpuestoId, codigo, nombre, orden, activo = true } = req.body;

    if (!tipoImpuestoId || !codigo || !nombre) {
      return res.status(400).json({ error: 'tipoImpuestoId, codigo y nombre son requeridos' });
    }

    // Verificar que el tipo de impuesto existe
    const tipoImpuesto = await prisma.tipoImpuestoPropiedad.findFirst({
      where: {
        id: parseInt(tipoImpuestoId),
        activo: true,
        deletedAt: null
      }
    });

    if (!tipoImpuesto) {
      return res.status(404).json({ error: 'Tipo de impuesto no encontrado' });
    }

    // Verificar que no exista otro campo con el mismo código para este tipo de impuesto
    const campoExistente = await prisma.tipoImpuestoPropiedadCampo.findFirst({
      where: {
        tipoImpuestoId: parseInt(tipoImpuestoId),
        codigo: codigo.trim(),
        deletedAt: null
      }
    });

    if (campoExistente) {
      return res.status(400).json({ error: 'Ya existe un campo con este código para este tipo de impuesto' });
    }

    const campo = await prisma.tipoImpuestoPropiedadCampo.create({
      data: {
        tipoImpuestoId: parseInt(tipoImpuestoId),
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        orden: orden !== undefined ? parseInt(orden) : 0,
        activo: Boolean(activo)
      },
      include: {
        tipoImpuesto: {
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
      return res.status(400).json({ error: 'Ya existe un campo con este código para este tipo de impuesto' });
    }

    res.status(500).json({ error: 'Error al crear campo' });
  }
};

// Actualizar un campo
export const updateCampo = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipoImpuestoId, codigo, nombre, orden, activo } = req.body;

    // Verificar que el campo existe
    const campoExistente = await prisma.tipoImpuestoPropiedadCampo.findFirst({
      where: {
        id: parseInt(id),
        deletedAt: null
      }
    });

    if (!campoExistente) {
      return res.status(404).json({ error: 'Campo no encontrado' });
    }

    // Si se cambia el código, verificar que no exista otro con el mismo código para el mismo tipo de impuesto
    if (codigo && codigo.trim() !== campoExistente.codigo) {
      const otroCampo = await prisma.tipoImpuestoPropiedadCampo.findFirst({
        where: {
          tipoImpuestoId: tipoImpuestoId ? parseInt(tipoImpuestoId) : campoExistente.tipoImpuestoId,
          codigo: codigo.trim(),
          deletedAt: null,
          id: { not: parseInt(id) }
        }
      });

      if (otroCampo) {
        return res.status(400).json({ error: 'Ya existe otro campo con este código para este tipo de impuesto' });
      }
    }

    // Si se cambia el tipo de impuesto, verificar que existe
    if (tipoImpuestoId && parseInt(tipoImpuestoId) !== campoExistente.tipoImpuestoId) {
      const tipoImpuesto = await prisma.tipoImpuestoPropiedad.findFirst({
        where: {
          id: parseInt(tipoImpuestoId),
          activo: true,
          deletedAt: null
        }
      });

      if (!tipoImpuesto) {
        return res.status(404).json({ error: 'Tipo de impuesto no encontrado' });
      }
    }

    const dataToUpdate = {};
    if (tipoImpuestoId !== undefined) dataToUpdate.tipoImpuestoId = parseInt(tipoImpuestoId);
    if (codigo !== undefined) dataToUpdate.codigo = codigo.trim();
    if (nombre !== undefined) dataToUpdate.nombre = nombre.trim();
    if (orden !== undefined) dataToUpdate.orden = parseInt(orden);
    if (activo !== undefined) dataToUpdate.activo = Boolean(activo);

    const campo = await prisma.tipoImpuestoPropiedadCampo.update({
      where: { id: parseInt(id) },
      data: dataToUpdate,
      include: {
        tipoImpuesto: {
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
      return res.status(400).json({ error: 'Ya existe otro campo con este código para este tipo de impuesto' });
    }

    res.status(500).json({ error: 'Error al actualizar campo' });
  }
};

// Eliminar (soft delete) un campo
export const deleteCampo = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el campo existe
    const campo = await prisma.tipoImpuestoPropiedadCampo.findFirst({
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
    await prisma.tipoImpuestoPropiedadCampo.update({
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

