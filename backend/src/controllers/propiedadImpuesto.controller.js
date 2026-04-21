import prisma from '../db/prisma.js';

const titularInclude = {
  titularPropietario: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      razonSocial: true,
      tipoPersonaId: true,
    },
  },
};

/**
 * @param {number} propiedadId
 * @param {object} imp cuerpo del ítem (titularModo, ids, textos)
 */
async function resolverTitularImpuesto(propiedadId, imp) {
  const modo = imp.titularModo;
  if (modo === 'PROPIETARIO') {
    const raw = imp.titularPropietarioId;
    const pid = raw != null && raw !== '' ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(pid)) {
      throw new Error('Titular: seleccione un propietario o use modo «Otro».');
    }
    const vinculo = await prisma.propiedadPropietario.findFirst({
      where: {
        propiedadId: parseInt(propiedadId, 10),
        propietarioId: pid,
        activo: true,
        deletedAt: null,
      },
    });
    if (!vinculo) {
      throw new Error('El titular debe ser un propietario activo de esta propiedad.');
    }
    return {
      titularModo: 'PROPIETARIO',
      titularPropietarioId: pid,
      titularOtroNombre: null,
      titularOtroApellido: null,
    };
  }
  if (modo === 'OTRO') {
    const n = imp.titularOtroNombre != null ? String(imp.titularOtroNombre).trim() : '';
    const a = imp.titularOtroApellido != null ? String(imp.titularOtroApellido).trim() : '';
    return {
      titularModo: 'OTRO',
      titularPropietarioId: null,
      titularOtroNombre: n || null,
      titularOtroApellido: a || null,
    };
  }
  return {
    titularModo: null,
    titularPropietarioId: null,
    titularOtroNombre: null,
    titularOtroApellido: null,
  };
}

// Obtener todos los impuestos de una propiedad
export const getImpuestosByPropiedad = async (req, res) => {
  try {
    const { propiedadId } = req.params;

    const impuestos = await prisma.propiedadImpuesto.findMany({
      where: {
        propiedadId: parseInt(propiedadId),
        deletedAt: null,
        activo: true,
      },
      include: {
        tipoImpuesto: true,
        periodicidad: true,
        ...titularInclude,
      },
      orderBy: {
        tipoImpuesto: {
          nombre: 'asc',
        },
      },
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
    const { impuestos } = req.body; // Array de { tipoImpuestoId, periodicidadId, titular... }

    if (!Array.isArray(impuestos)) {
      return res.status(400).json({ error: 'impuestos debe ser un array' });
    }

    // Verificar que la propiedad existe
    const propiedad = await prisma.propiedad.findFirst({
      where: {
        id: parseInt(propiedadId),
        deletedAt: null,
        activo: true,
      },
    });

    if (!propiedad) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    const pidInt = parseInt(propiedadId, 10);

    // Obtener impuestos existentes
    const impuestosExistentes = await prisma.propiedadImpuesto.findMany({
      where: {
        propiedadId: pidInt,
        deletedAt: null,
      },
    });

    const tiposImpuestosNuevos = new Set(impuestos.map((i) => parseInt(i.tipoImpuestoId)));

    // Desactivar/eliminar impuestos que ya no están en la lista
    const impuestosAEliminar = impuestosExistentes.filter(
      (i) => !tiposImpuestosNuevos.has(i.tipoImpuestoId),
    );

    if (impuestosAEliminar.length > 0) {
      await prisma.propiedadImpuesto.updateMany({
        where: {
          id: { in: impuestosAEliminar.map((i) => i.id) },
        },
        data: {
          activo: false,
          deletedAt: new Date(),
        },
      });
    }

    // Crear o actualizar impuestos
    const resultados = [];
    for (const imp of impuestos) {
      const tipoImpuestoId = parseInt(imp.tipoImpuestoId);
      const periodicidadId = imp.periodicidadId ? parseInt(imp.periodicidadId) : null;

      const tipoImpuesto = await prisma.tipoImpuestoPropiedad.findFirst({
        where: {
          id: tipoImpuestoId,
          activo: true,
          deletedAt: null,
        },
      });

      if (!tipoImpuesto) {
        throw new Error(`Tipo de impuesto ${tipoImpuestoId} no encontrado`);
      }

      const titularData = await resolverTitularImpuesto(pidInt, imp);

      const existente = impuestosExistentes.find(
        (i) => i.tipoImpuestoId === tipoImpuestoId && i.deletedAt === null,
      );

      if (existente) {
        const updated = await prisma.propiedadImpuesto.update({
          where: { id: existente.id },
          data: {
            periodicidadId,
            activo: true,
            deletedAt: null,
            ...titularData,
          },
          include: {
            tipoImpuesto: true,
            periodicidad: true,
            ...titularInclude,
          },
        });
        resultados.push(updated);
      } else {
        const created = await prisma.propiedadImpuesto.create({
          data: {
            propiedadId: pidInt,
            tipoImpuestoId,
            periodicidadId,
            activo: true,
            ...titularData,
          },
          include: {
            tipoImpuesto: true,
            periodicidad: true,
            ...titularInclude,
          },
        });
        resultados.push(created);
      }
    }

    res.json(resultados);
  } catch (error) {
    console.error('Error al guardar impuestos de propiedad:', error);
    const msg = error.message || 'Error al guardar impuestos de propiedad';
    const status = /titular|propietario|Tipo de impuesto/i.test(msg) ? 400 : 500;
    res.status(status).json({ error: msg });
  }
};
