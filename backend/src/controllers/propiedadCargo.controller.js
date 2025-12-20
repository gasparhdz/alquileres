import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Obtener todos los cargos de una propiedad
export const getCargosByPropiedad = async (req, res) => {
  try {
    const { propiedadId } = req.params;

    const cargos = await prisma.propiedadCargo.findMany({
      where: {
        propiedadId: parseInt(propiedadId),
        deletedAt: null,
        activo: true
      },
      include: {
        tipoCargo: true
      },
      orderBy: {
        tipoCargo: {
          nombre: 'asc'
        }
      }
    });

    res.json(cargos);
  } catch (error) {
    console.error('Error al obtener cargos de propiedad:', error);
    res.status(500).json({ error: 'Error al obtener cargos de propiedad' });
  }
};

// Crear o actualizar cargos de una propiedad
export const saveCargosPropiedad = async (req, res) => {
  try {
    const { propiedadId } = req.params;
    const { cargos } = req.body; // Array de { tipoCargoId }

    if (!Array.isArray(cargos)) {
      return res.status(400).json({ error: 'cargos debe ser un array' });
    }

    // Verificar que la propiedad existe
    const propiedad = await prisma.propiedad.findFirst({
      where: {
        id: parseInt(propiedadId),
        deletedAt: null,
        activo: true
      }
    });

    if (!propiedad) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    // Obtener cargos existentes
    const cargosExistentes = await prisma.propiedadCargo.findMany({
      where: {
        propiedadId: parseInt(propiedadId),
        deletedAt: null
      }
    });

    const tiposCargosNuevos = new Set(cargos.map(c => parseInt(c.tipoCargoId)));

    // Desactivar/eliminar cargos que ya no están en la lista
    const cargosAEliminar = cargosExistentes.filter(
      c => !tiposCargosNuevos.has(c.tipoCargoId)
    );

    if (cargosAEliminar.length > 0) {
      await prisma.propiedadCargo.updateMany({
        where: {
          id: { in: cargosAEliminar.map(c => c.id) }
        },
        data: {
          activo: false,
          deletedAt: new Date()
        }
      });
    }

    // Crear nuevos cargos
    const resultados = await Promise.all(
      cargos.map(async (cargo) => {
        const tipoCargoId = parseInt(cargo.tipoCargoId);

        // Verificar que el tipo de cargo existe
        const tipoCargo = await prisma.tipoCargo.findFirst({
          where: {
            id: tipoCargoId,
            activo: true,
            deletedAt: null
          }
        });

        if (!tipoCargo) {
          throw new Error(`Tipo de cargo ${tipoCargoId} no encontrado`);
        }

        // Buscar si ya existe
        const existente = cargosExistentes.find(
          c => c.tipoCargoId === tipoCargoId && c.deletedAt === null
        );

        if (existente) {
          // Reactivar existente
          return await prisma.propiedadCargo.update({
            where: { id: existente.id },
            data: {
              activo: true,
              deletedAt: null
            },
            include: {
              tipoCargo: true
            }
          });
        } else {
          // Crear nuevo
          return await prisma.propiedadCargo.create({
            data: {
              propiedadId: parseInt(propiedadId),
              tipoCargoId,
              activo: true
            },
            include: {
              tipoCargo: true
            }
          });
        }
      })
    );

    res.json(resultados);
  } catch (error) {
    console.error('Error al guardar cargos de propiedad:', error);
    res.status(500).json({ error: error.message || 'Error al guardar cargos de propiedad' });
  }
};

