import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Obtener todos los documentos de una propiedad
export const getDocumentosByPropiedad = async (req, res) => {
  try {
    const { propiedadId } = req.params;

    const documentos = await prisma.propiedadDocumento.findMany({
      where: {
        propiedadId: parseInt(propiedadId),
        deletedAt: null
      },
      include: {
        tipoDocumento: {
          select: {
            id: true,
            codigo: true,
            nombre: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    res.json(documentos);
  } catch (error) {
    console.error('Error al obtener documentos por propiedad:', error);
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
};

// Crear o actualizar documentos de una propiedad
export const upsertDocumentosPropiedad = async (req, res) => {
  try {
    const { propiedadId } = req.params;
    const { documentos } = req.body; // Array de { tipoDocumentoPropiedadId, necesario, recibido }

    if (!documentos) {
      return res.status(400).json({ error: 'El campo documentos es requerido' });
    }

    if (!Array.isArray(documentos)) {
      return res.status(400).json({ error: 'documentos debe ser un array' });
    }

    if (documentos.length === 0) {
      return res.json([]);
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

    // Obtener todos los tipos de documento para validar
    const tiposDocumento = await prisma.tipoDocumentoPropiedad.findMany({
      where: {
        activo: true,
        deletedAt: null
      }
    });

    const tiposDocumentoMap = new Map(tiposDocumento.map(t => [t.id, t]));

    // Obtener documentos existentes
    const documentosExistentes = await prisma.propiedadDocumento.findMany({
      where: {
        propiedadId: parseInt(propiedadId),
        deletedAt: null
      }
    });

    const tiposDocumentosNuevos = new Set(documentos.map(d => parseInt(d.tipoDocumentoPropiedadId)));

    // Eliminar documentos que ya no están en la lista (soft delete)
    const documentosAEliminar = documentosExistentes.filter(
      d => !tiposDocumentosNuevos.has(d.tipoDocumentoPropiedadId)
    );

    if (documentosAEliminar.length > 0) {
      await prisma.propiedadDocumento.updateMany({
        where: {
          id: { in: documentosAEliminar.map(d => d.id) }
        },
        data: {
          deletedAt: new Date()
        }
      });
    }

    // Procesar cada documento
    const resultados = [];
    
    for (const doc of documentos) {
      const tipoDocumentoPropiedadId = parseInt(doc.tipoDocumentoPropiedadId);
      
      // Verificar que el tipo de documento existe
      const tipoDocumento = tiposDocumentoMap.get(tipoDocumentoPropiedadId);
      if (!tipoDocumento) {
        console.warn(`Tipo de documento no encontrado: ${tipoDocumentoPropiedadId}`);
        continue;
      }

      // Buscar si existe
      const documentoExistente = documentosExistentes.find(
        d => d.tipoDocumentoPropiedadId === tipoDocumentoPropiedadId && d.deletedAt === null
      );
      
      let resultado;
      if (documentoExistente) {
        // Actualizar documento existente
        resultado = await prisma.propiedadDocumento.update({
          where: {
            id: documentoExistente.id
          },
          data: {
            necesario: Boolean(doc.necesario),
            recibido: Boolean(doc.recibido)
          },
          include: {
            tipoDocumento: {
              select: {
                id: true,
                codigo: true,
                nombre: true
              }
            }
          }
        });
      } else {
        // Crear nuevo documento
        resultado = await prisma.propiedadDocumento.create({
          data: {
            propiedadId: parseInt(propiedadId),
            tipoDocumentoPropiedadId,
            necesario: Boolean(doc.necesario),
            recibido: Boolean(doc.recibido)
          },
          include: {
            tipoDocumento: {
              select: {
                id: true,
                codigo: true,
                nombre: true
              }
            }
          }
        });
      }
      
      resultados.push(resultado);
    }
    
    res.json(resultados);
  } catch (error) {
    console.error('Error al guardar documentos:', error);
    res.status(500).json({ 
      error: 'Error al guardar documentos',
      message: error.message 
    });
  }
};

// Eliminar un documento de una propiedad
export const deleteDocumento = async (req, res) => {
  try {
    const { id } = req.params;

    const documento = await prisma.propiedadDocumento.findUnique({
      where: { id }
    });

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    await prisma.propiedadDocumento.delete({
      where: { id }
    });

    res.json({ message: 'Documento eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar documento:', error);
    res.status(500).json({ error: 'Error al eliminar documento' });
  }
};


