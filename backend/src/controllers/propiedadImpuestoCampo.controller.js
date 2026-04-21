import prisma from '../db/prisma.js';

// Obtener todos los campos de un impuesto de propiedad
export const getCamposByPropiedadImpuesto = async (req, res) => {
  try {
    const { propiedadImpuestoId } = req.params;

    const campos = await prisma.propiedadImpuestoCampo.findMany({
      where: {
        propiedadImpuestoId: parseInt(propiedadImpuestoId),
        deletedAt: null
      },
      include: {
        tipoCampo: true
      },
      orderBy: {
        tipoCampo: {
          orden: 'asc'
        }
      }
    });

    res.json(campos);
  } catch (error) {
    console.error('Error al obtener campos de impuesto de propiedad:', error);
    res.status(500).json({ error: 'Error al obtener campos de impuesto de propiedad' });
  }
};

// Guardar campos de un impuesto de propiedad
export const saveCamposPropiedadImpuesto = async (req, res) => {
  try {
    const { propiedadImpuestoId } = req.params;
    const { campos } = req.body; // Array de { tipoCampoId, valor }

    if (!Array.isArray(campos)) {
      return res.status(400).json({ error: 'campos debe ser un array' });
    }

    // Verificar que el impuesto de propiedad existe
    const propiedadImpuesto = await prisma.propiedadImpuesto.findFirst({
      where: {
        id: parseInt(propiedadImpuestoId),
        deletedAt: null
      }
    });

    if (!propiedadImpuesto) {
      return res.status(404).json({ error: 'Impuesto de propiedad no encontrado' });
    }

    // Obtener campos existentes
    const camposExistentes = await prisma.propiedadImpuestoCampo.findMany({
      where: {
        propiedadImpuestoId: parseInt(propiedadImpuestoId),
        deletedAt: null
      }
    });

    const tiposCamposNuevos = new Set(campos.map(c => parseInt(c.tipoCampoId)));

    // Eliminar campos que ya no están en la lista
    const camposAEliminar = camposExistentes.filter(
      c => !tiposCamposNuevos.has(c.tipoCampoId)
    );

    if (camposAEliminar.length > 0) {
      await prisma.propiedadImpuestoCampo.updateMany({
        where: {
          id: { in: camposAEliminar.map(c => c.id) }
        },
        data: {
          deletedAt: new Date()
        }
      });
    }

    // Crear o actualizar campos
    const resultados = await Promise.all(
      campos.map(async (campo) => {
        const tipoCampoId = parseInt(campo.tipoCampoId);
        const valor = campo.valor?.trim() || '';

        // Verificar que el tipo de campo existe
        const tipoCampo = await prisma.tipoImpuestoPropiedadCampo.findFirst({
          where: {
            id: tipoCampoId,
            activo: true,
            deletedAt: null
          }
        });

        if (!tipoCampo) {
          throw new Error(`Tipo de campo ${tipoCampoId} no encontrado`);
        }

        // Buscar si ya existe
        const existente = camposExistentes.find(
          c => c.tipoCampoId === tipoCampoId && c.deletedAt === null
        );

        if (existente) {
          // Actualizar existente
          return await prisma.propiedadImpuestoCampo.update({
            where: { id: existente.id },
            data: {
              valor
            },
            include: {
              tipoCampo: true
            }
          });
        } else {
          // Crear nuevo (solo si tiene valor)
          if (valor) {
            return await prisma.propiedadImpuestoCampo.create({
              data: {
                propiedadImpuestoId: parseInt(propiedadImpuestoId),
                tipoCampoId,
                valor
              },
              include: {
                tipoCampo: true
              }
            });
          }
          return null;
        }
      })
    );

    res.json(resultados.filter(r => r !== null));
  } catch (error) {
    console.error('Error al guardar campos de impuesto de propiedad:', error);
    res.status(500).json({ error: error.message || 'Error al guardar campos de impuesto de propiedad' });
  }
};

