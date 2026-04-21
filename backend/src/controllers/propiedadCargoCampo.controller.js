import prisma from '../db/prisma.js';

// Obtener todos los campos de un cargo de propiedad
export const getCamposByPropiedadCargo = async (req, res) => {
  try {
    const { propiedadCargoId } = req.params;

    const campos = await prisma.propiedadCargoCampo.findMany({
      where: {
        propiedadCargoId: parseInt(propiedadCargoId),
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
    console.error('Error al obtener campos de cargo de propiedad:', error);
    res.status(500).json({ error: 'Error al obtener campos de cargo de propiedad' });
  }
};

// Guardar campos de un cargo de propiedad
export const saveCamposPropiedadCargo = async (req, res) => {
  try {
    const { propiedadCargoId } = req.params;
    const { campos } = req.body; // Array de { tipoCampoId, valor }

    if (!Array.isArray(campos)) {
      return res.status(400).json({ error: 'campos debe ser un array' });
    }

    // Verificar que el cargo de propiedad existe
    const propiedadCargo = await prisma.propiedadCargo.findFirst({
      where: {
        id: parseInt(propiedadCargoId),
        deletedAt: null
      }
    });

    if (!propiedadCargo) {
      return res.status(404).json({ error: 'Cargo de propiedad no encontrado' });
    }

    // Obtener campos existentes
    const camposExistentes = await prisma.propiedadCargoCampo.findMany({
      where: {
        propiedadCargoId: parseInt(propiedadCargoId),
        deletedAt: null
      }
    });

    const tiposCamposNuevos = new Set(campos.map(c => parseInt(c.tipoCampoId)));

    // Eliminar campos que ya no están en la lista
    const camposAEliminar = camposExistentes.filter(
      c => !tiposCamposNuevos.has(c.tipoCampoId)
    );

    if (camposAEliminar.length > 0) {
      await prisma.propiedadCargoCampo.updateMany({
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
        const tipoCampo = await prisma.tipoCargoCampo.findFirst({
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
          return await prisma.propiedadCargoCampo.update({
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
            return await prisma.propiedadCargoCampo.create({
              data: {
                propiedadCargoId: parseInt(propiedadCargoId),
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
    console.error('Error al guardar campos de cargo de propiedad:', error);
    res.status(500).json({ error: error.message || 'Error al guardar campos de cargo de propiedad' });
  }
};

