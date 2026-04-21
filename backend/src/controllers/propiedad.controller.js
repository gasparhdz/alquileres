import { Prisma } from '@prisma/client';
import prisma from '../db/prisma.js';

function parseSuperficieM2(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return new Prisma.Decimal(n.toFixed(2));
}

export const getAllPropiedades = async (req, res) => {
  try {
    const { search, propietarioId, estado, page = 1, limit = 50, orderBy = 'direccion', order = 'asc' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const dir = (order === 'asc' ? 'asc' : 'desc');

    const where = {
      deletedAt: null,
      activo: true,
      ...(search && {
        OR: [
          { dirCalle: { contains: search, mode: 'insensitive' } },
          { codigoInterno: { contains: search, mode: 'insensitive' } },
          { descripcion: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(propietarioId && {
        propietarios: {
          some: {
            propietarioId: parseInt(propietarioId),
            activo: true
          }
        }
      }),
      ...(estado && { estadoPropiedadId: parseInt(estado) })
    };

    const orderByClause = (() => {
      switch (orderBy) {
        case 'localidad':
          return { localidad: { nombre: dir } };
        case 'tipo':
          return { tipoPropiedad: { nombre: dir } };
        case 'estado':
          return { estadoPropiedad: { nombre: dir } };
        case 'propietarios':
          return { createdAt: dir };
        case 'direccion':
        default:
          return { dirCalle: dir };
      }
    })();

    const [propiedades, total] = await Promise.all([
      prisma.propiedad.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: orderByClause,
        include: {
          localidad: {
            include: {
              provincia: true
            }
          },
          provincia: true,
          tipoPropiedad: true,
          estadoPropiedad: true,
          destino: true,
          ambientes: true,
          consorcio: true,
          propietarios: {
            where: { activo: true },
            include: {
              propietario: {
                select: {
                  id: true,
                  nombre: true,
                  apellido: true,
                  razonSocial: true,
                  tipoPersona: true
                }
              }
            }
          },
          _count: {
            select: {
              contratos: {
                where: { deletedAt: null, activo: true }
              },
              impuestos: {
                where: { deletedAt: null, activo: true }
              }
            }
          }
        }
      }),
      prisma.propiedad.count({ where })
    ]);

    res.json({
      data: propiedades,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error al obtener propiedades:', error);
    res.status(500).json({ error: 'Error al obtener propiedades' });
  }
};

export const getPropiedadById = async (req, res) => {
  try {
    const propiedadId = parseInt(req.params.id, 10);
    if (isNaN(propiedadId)) {
      return res.status(400).json({ error: 'ID de propiedad inválido' });
    }

    // Paso A: entidad base con relaciones directas
    let propiedad = await prisma.propiedad.findUnique({
      where: { id: propiedadId, deletedAt: null, activo: true },
      include: {
        localidad: { include: { provincia: true } },
        provincia: true,
        tipoPropiedad: true,
        estadoPropiedad: true,
        destino: true,
        ambientes: true,
        consorcio: true,
        propietarios: {
          where: { activo: true },
          include: {
            propietario: { include: { tipoPersona: true } }
          }
        }
      }
    });
    if (!propiedad) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    // Paso B: impuestos
    const impuestos = await prisma.propiedadImpuesto.findMany({
      where: { propiedadId, activo: true, deletedAt: null },
      include: {
        tipoImpuesto: true,
        periodicidad: true,
        campos: { include: { tipoCampo: true } },
        titularPropietario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            razonSocial: true,
            tipoPersonaId: true,
          },
        },
      },
    });
    propiedad = { ...propiedad, impuestos };

    // Paso B2: cargos (expensas, seguro, etc.)
    const cargos = await prisma.propiedadCargo.findMany({
      where: { propiedadId, activo: true, deletedAt: null },
      include: {
        tipoCargo: true,
        periodicidad: true,
        campos: { include: { tipoCampo: true } }
      }
    });
    propiedad = { ...propiedad, cargos };

    // Paso C: historial de contratos (límite 20)
    const contratos = await prisma.contrato.findMany({
      where: { propiedadId, activo: true, deletedAt: null },
      orderBy: { fechaInicio: 'desc' },
      take: 20,
      include: {
        inquilino: true,
        estado: true,
        metodoAjuste: true,
        garantias: { include: { tipoGarantia: true } }
      }
    });
    propiedad = { ...propiedad, contratos };

    // Paso D: documentos
    const documentos = await prisma.propiedadDocumento.findMany({
      where: { propiedadId, activo: true, deletedAt: null },
      include: { tipoDocumento: true }
    });
    propiedad = { ...propiedad, documentos };

    const seguros = await prisma.propiedadSeguro.findMany({
      where: { propiedadId, activo: true, deletedAt: null },
      orderBy: { fechaFin: 'desc' },
    });
    propiedad = { ...propiedad, seguros };

    return res.json(propiedad);
  } catch (error) {
    console.error('Error al obtener propiedad:', error);
    res.status(500).json({ error: 'Error al obtener propiedad' });
  }
};

export const createPropiedad = async (req, res) => {
  try {
    const data = req.body;

    // Validar campos requeridos
    if (!data.dirCalle || !data.dirNro) {
      return res.status(400).json({ error: 'Calle y número son requeridos' });
    }

    // Validar que al menos haya una localidad o provincia
    if (!data.localidadId && !data.provinciaId) {
      return res.status(400).json({ error: 'Debe proporcionar al menos localidad o provincia' });
    }

    // Preparar datos de la propiedad
    const propiedadData = {
      dirCalle: data.dirCalle.trim(),
      dirNro: data.dirNro.trim(),
      dirPiso: data.dirPiso?.trim() || null,
      dirDepto: data.dirDepto?.trim() || null,
      localidadId: data.localidadId ? parseInt(data.localidadId) : null,
      provinciaId: data.provinciaId ? parseInt(data.provinciaId) : null,
      codigoInterno: data.codigoInterno?.trim() || null,
      descripcion: data.descripcion?.trim() || null,
      tipoPropiedadId: data.tipoPropiedadId ? parseInt(data.tipoPropiedadId) : null,
      estadoPropiedadId: data.estadoPropiedadId ? parseInt(data.estadoPropiedadId) : null,
      destinoId: data.destinoId ? parseInt(data.destinoId) : null,
      ambientesId: data.ambientesId ? parseInt(data.ambientesId) : null,
      superficieM2: parseSuperficieM2(data.superficieM2),
      administraImpuestosInmobiliaria: data.administraImpuestosInmobiliaria === true,
    };

    if (data.consorcioId !== undefined && data.consorcioId !== null && data.consorcioId !== '') {
      const cid = parseInt(data.consorcioId, 10);
      if (isNaN(cid)) {
        return res.status(400).json({ error: 'consorcioId inválido' });
      }
      const cons = await prisma.consorcio.findFirst({
        where: { id: cid, deletedAt: null, activo: true },
      });
      if (!cons) {
        return res.status(400).json({ error: 'Consorcio no encontrado' });
      }
      propiedadData.consorcioId = cid;
    }

    // Verificar que los propietarios (clientes con rol) existen si se proporcionan
    const propietarioIds = data.propietarioIds || [];
    if (propietarioIds.length > 0) {
      const propietarios = await prisma.cliente.findMany({
        where: {
          id: { in: propietarioIds.map(id => parseInt(id)) },
          deletedAt: null,
          activo: true,
          roles: {
            some: {
              rol: { codigo: 'PROPIETARIO', activo: true },
              deletedAt: null,
              activo: true
            }
          }
        }
      });

      if (propietarios.length !== propietarioIds.length) {
        return res.status(404).json({ error: 'Uno o más propietarios no encontrados' });
      }
    }

    // Crear propiedad con propietarios en una transacción
    const propiedad = await prisma.$transaction(async (tx) => {
      const nuevaPropiedad = await tx.propiedad.create({
        data: propiedadData,
        include: {
          localidad: {
            include: {
              provincia: true
            }
          },
          provincia: true,
          tipoPropiedad: true,
          estadoPropiedad: true,
          destino: true,
          ambientes: true,
          consorcio: true,
        }
      });

      // Crear relaciones con propietarios
      if (propietarioIds.length > 0) {
        await tx.propiedadPropietario.createMany({
          data: propietarioIds.map(propietarioId => ({
            propiedadId: nuevaPropiedad.id,
            propietarioId: parseInt(propietarioId),
            activo: true
          }))
        });
      }

      // Obtener la propiedad completa con propietarios
      return await tx.propiedad.findUnique({
        where: { id: nuevaPropiedad.id },
        include: {
          localidad: {
            include: {
              provincia: true
            }
          },
          provincia: true,
          tipoPropiedad: true,
          estadoPropiedad: true,
          destino: true,
          ambientes: true,
          consorcio: true,
          propietarios: {
            where: { activo: true },
            include: {
              propietario: {
                select: {
                  id: true,
                  nombre: true,
                  apellido: true,
                  razonSocial: true,
                  tipoPersona: true
                }
              }
            }
          }
        }
      });
    });

    res.status(201).json(propiedad);
  } catch (error) {
    console.error('Error al crear propiedad:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una propiedad con esta dirección' });
    }

    res.status(500).json({ error: 'Error al crear propiedad' });
  }
};

export const updatePropiedad = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    // Validar campos requeridos
    if (!data.dirCalle || !data.dirNro) {
      return res.status(400).json({ error: 'Calle y número son requeridos' });
    }

    // Verificar que la propiedad existe y no está eliminada
    const propiedad = await prisma.propiedad.findFirst({
      where: {
        id: parseInt(id),
        deletedAt: null,
        activo: true
      }
    });

    if (!propiedad) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    // Filtrar solo los campos editables
    const {
      id: _id,
      createdAt,
      updatedAt,
      deletedAt,
      activo,
      propietarios,
      propietarioIds,
      ...updateData
    } = data;

    // Preparar datos de actualización
    const propiedadUpdateData = {
      dirCalle: updateData.dirCalle?.trim() || propiedad.dirCalle,
      dirNro: updateData.dirNro?.trim() || propiedad.dirNro,
      dirPiso: updateData.dirPiso?.trim() || null,
      dirDepto: updateData.dirDepto?.trim() || null,
      localidadId: updateData.localidadId ? parseInt(updateData.localidadId) : null,
      provinciaId: updateData.provinciaId ? parseInt(updateData.provinciaId) : null,
      codigoInterno: updateData.codigoInterno?.trim() || null,
      descripcion: updateData.descripcion?.trim() || null,
      tipoPropiedadId: updateData.tipoPropiedadId ? parseInt(updateData.tipoPropiedadId) : null,
      estadoPropiedadId: updateData.estadoPropiedadId ? parseInt(updateData.estadoPropiedadId) : null,
      destinoId: updateData.destinoId ? parseInt(updateData.destinoId) : null,
      ambientesId: updateData.ambientesId ? parseInt(updateData.ambientesId) : null,
      superficieM2:
        updateData.superficieM2 !== undefined
          ? parseSuperficieM2(updateData.superficieM2)
          : propiedad.superficieM2,
      administraImpuestosInmobiliaria:
        updateData.administraImpuestosInmobiliaria !== undefined
          ? Boolean(updateData.administraImpuestosInmobiliaria)
          : propiedad.administraImpuestosInmobiliaria,
    };

    if (updateData.consorcioId !== undefined) {
      if (updateData.consorcioId === null || updateData.consorcioId === '') {
        propiedadUpdateData.consorcioId = null;
      } else {
        const cid = parseInt(updateData.consorcioId, 10);
        if (isNaN(cid)) {
          return res.status(400).json({ error: 'consorcioId inválido' });
        }
        const cons = await prisma.consorcio.findFirst({
          where: { id: cid, deletedAt: null, activo: true },
        });
        if (!cons) {
          return res.status(400).json({ error: 'Consorcio no encontrado' });
        }
        propiedadUpdateData.consorcioId = cid;
      }
    } else {
      propiedadUpdateData.consorcioId = propiedad.consorcioId;
    }

    // Actualizar propiedad y propietarios en una transacción
    const updated = await prisma.$transaction(async (tx) => {
      // Actualizar propiedad
      const propiedadActualizada = await tx.propiedad.update({
        where: { id: parseInt(id) },
        data: propiedadUpdateData
      });

      // Actualizar relaciones con propietarios si se proporcionan
      if (propietarioIds !== undefined) {
        // Desactivar todas las relaciones existentes
        await tx.propiedadPropietario.updateMany({
          where: {
            propiedadId: parseInt(id)
          },
          data: {
            activo: false
          }
        });

        // Crear nuevas relaciones activas
        if (propietarioIds.length > 0) {
          // Verificar que los propietarios (clientes con rol PROPIETARIO) existen
          const propietarios = await tx.cliente.findMany({
            where: {
              id: { in: propietarioIds.map(pid => parseInt(pid)) },
              deletedAt: null,
              activo: true,
              roles: {
                some: {
                  rol: { codigo: 'PROPIETARIO', activo: true },
                  deletedAt: null,
                  activo: true
                }
              }
            }
          });

          if (propietarios.length !== propietarioIds.length) {
            throw new Error('Uno o más propietarios no encontrados');
          }

          // Crear o reactivar relaciones
          for (const propietarioId of propietarioIds) {
            const propietarioIdInt = parseInt(propietarioId);
            
            // Verificar si ya existe la relación
            const relacionExistente = await tx.propiedadPropietario.findUnique({
              where: {
                propiedadId_propietarioId: {
                  propiedadId: parseInt(id),
                  propietarioId: propietarioIdInt
                }
              }
            });

            if (relacionExistente) {
              // Reactivar si existe
              await tx.propiedadPropietario.update({
                where: {
                  propiedadId_propietarioId: {
                    propiedadId: parseInt(id),
                    propietarioId: propietarioIdInt
                  }
                },
                data: {
                  activo: true
                }
              });
            } else {
              // Crear nueva relación
              await tx.propiedadPropietario.create({
                data: {
                  propiedadId: parseInt(id),
                  propietarioId: propietarioIdInt,
                  activo: true
                }
              });
            }
          }
        }
      }

      // Obtener la propiedad completa con todas las relaciones
      return await tx.propiedad.findUnique({
        where: { id: parseInt(id) },
        include: {
          localidad: {
            include: {
              provincia: true
            }
          },
          provincia: true,
          tipoPropiedad: true,
          estadoPropiedad: true,
          destino: true,
          ambientes: true,
          consorcio: true,
          propietarios: {
            where: { activo: true },
            include: {
              propietario: {
                select: {
                  id: true,
                  nombre: true,
                  apellido: true,
                  razonSocial: true,
                  tipoPersona: true
                }
              }
            }
          }
        }
      });
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar propiedad:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una propiedad con esta dirección' });
    }

    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Uno de los valores de referencia no es válido' });
    }

    res.status(500).json({ 
      error: 'Error al actualizar propiedad',
      message: error.message
    });
  }
};

export const deletePropiedad = async (req, res) => {
  try {
    const { id } = req.params;

    const propiedad = await prisma.propiedad.findFirst({
      where: {
        id: parseInt(id),
        deletedAt: null,
        activo: true
      },
      include: {
        contratos: {
          where: { deletedAt: null, activo: true }
        }
      }
    });

    if (!propiedad) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    // Verificar que no tenga contratos activos
    if (propiedad.contratos.length > 0) {
      return res.status(400).json({ error: 'No se puede eliminar una propiedad con contratos asociados' });
    }

    // Baja lógica
    await prisma.propiedad.update({
      where: { id: parseInt(id) },
      data: {
        activo: false,
        deletedAt: new Date()
      }
    });

    res.json({ message: 'Propiedad eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar propiedad:', error);
    res.status(500).json({ error: 'Error al eliminar propiedad' });
  }
};

