import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Obtener todos los impuestos de una propiedad
export const getImpuestosByPropiedad = async (req, res) => {
  try {
    const { propiedadId } = req.params;

    const impuestos = await prisma.propiedadImpuesto.findMany({
      where: {
        propiedadId: parseInt(propiedadId),
        deletedAt: null,
        activo: true
      },
      include: {
        tipoImpuesto: true,
        periodicidad: true
      },
      orderBy: {
        tipoImpuesto: {
          nombre: 'asc'
        }
      }
    });

    res.json(impuestos);
  } catch (error) {
    console.error('Error al obtener impuestos de propiedad:', error);
    res.status(500).json({ error: 'Error al obtener impuestos de propiedad' });
  }
};

// Crear o actualizar impuestos de una propiedad
export const saveImpuestosPropiedad = async (req, res) => {
  try {
    const { propiedadId } = req.params;
    const { impuestos } = req.body; // Array de { tipoImpuestoId, periodicidadId }

    if (!Array.isArray(impuestos)) {
      return res.status(400).json({ error: 'impuestos debe ser un array' });
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

    // Obtener impuestos existentes
    const impuestosExistentes = await prisma.propiedadImpuesto.findMany({
      where: {
        propiedadId: parseInt(propiedadId),
        deletedAt: null
      }
    });

    const idsExistentes = new Set(impuestosExistentes.map(i => i.id));
    const tiposImpuestosNuevos = new Set(impuestos.map(i => parseInt(i.tipoImpuestoId)));

    // Desactivar/eliminar impuestos que ya no están en la lista
    const impuestosAEliminar = impuestosExistentes.filter(
      i => !tiposImpuestosNuevos.has(i.tipoImpuestoId)
    );

    if (impuestosAEliminar.length > 0) {
      await prisma.propiedadImpuesto.updateMany({
        where: {
          id: { in: impuestosAEliminar.map(i => i.id) }
        },
        data: {
          activo: false,
          deletedAt: new Date()
        }
      });
    }

    // Crear o actualizar impuestos
    const resultados = await Promise.all(
      impuestos.map(async (imp) => {
        const tipoImpuestoId = parseInt(imp.tipoImpuestoId);
        const periodicidadId = imp.periodicidadId ? parseInt(imp.periodicidadId) : null;

        // Verificar que el tipo de impuesto existe
        const tipoImpuesto = await prisma.tipoImpuestoPropiedad.findFirst({
          where: {
            id: tipoImpuestoId,
            activo: true,
            deletedAt: null
          }
        });

        if (!tipoImpuesto) {
          throw new Error(`Tipo de impuesto ${tipoImpuestoId} no encontrado`);
        }

        // Buscar si ya existe
        const existente = impuestosExistentes.find(
          i => i.tipoImpuestoId === tipoImpuestoId && i.deletedAt === null
        );

        if (existente) {
          // Actualizar existente
          return await prisma.propiedadImpuesto.update({
            where: { id: existente.id },
            data: {
              periodicidadId,
              activo: true,
              deletedAt: null
            },
            include: {
              tipoImpuesto: true,
              periodicidad: true
            }
          });
        } else {
          // Crear nuevo
          return await prisma.propiedadImpuesto.create({
            data: {
              propiedadId: parseInt(propiedadId),
              tipoImpuestoId,
              periodicidadId,
              activo: true
            },
            include: {
              tipoImpuesto: true,
              periodicidad: true
            }
          });
        }
      })
    );

    res.json(resultados);
  } catch (error) {
    console.error('Error al guardar impuestos de propiedad:', error);
    res.status(500).json({ error: error.message || 'Error al guardar impuestos de propiedad' });
  }
};

