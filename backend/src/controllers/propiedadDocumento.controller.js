import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Obtener todos los documentos de una propiedad
export const getDocumentosByUnidad = async (req, res) => {
  try {
    const { unidadId } = req.params;

    const documentos = await prisma.propiedadDocumento.findMany({
      where: {
        unidadId
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    res.json(documentos);
  } catch (error) {
    console.error('Error al obtener documentos por unidad:', error);
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
};

// Crear o actualizar documentos de una propiedad
export const upsertDocumentosUnidad = async (req, res) => {
  try {
    const { unidadId } = req.params;
    const { documentos } = req.body; // Array de { tipoDocumentoId, necesario, recibido }

    console.log(`Guardando ${documentos.length} documentos para propiedad ${unidadId}`);

    if (!documentos) {
      console.error('No se recibió el campo documentos en el body');
      return res.status(400).json({ error: 'El campo documentos es requerido' });
    }

    if (!Array.isArray(documentos)) {
      console.error('documentos no es un array:', typeof documentos, documentos);
      return res.status(400).json({ error: 'documentos debe ser un array' });
    }

    if (documentos.length === 0) {
      console.warn('Se recibió un array vacío de documentos');
      return res.json([]);
    }

    // Verificar que la unidad existe
    const unidad = await prisma.unidad.findUnique({
      where: { id: unidadId }
    });

    if (!unidad || unidad.isDeleted) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    // Primero, obtener todos los parámetros de documentación para validar
    const parametrosDocumentacion = await prisma.parametro.findMany({
      where: {
        categoria: {
          codigo: 'documentacion'
        }
      },
      include: {
        categoria: true
      }
    });

    const parametrosMap = new Map(parametrosDocumentacion.map(p => [p.id, p]));

    // Procesar cada documento
    const resultados = [];
    const documentosOmitidos = [];
    
    for (const doc of documentos) {
      // Verificar que el parámetro existe y es de la categoría documentacion
      const parametro = parametrosMap.get(doc.tipoDocumentoId);

      if (!parametro) {
        console.warn(`Parámetro de documento no encontrado: ${doc.tipoDocumentoId}`);
        documentosOmitidos.push(doc.tipoDocumentoId);
        continue; // Saltar este documento en lugar de fallar
      }

      // Buscar si existe o crear/actualizar documento
      try {
        // Primero verificar si existe
        const documentoExistente = await prisma.propiedadDocumento.findFirst({
          where: {
            unidadId: unidadId,
            tipoDocumentoId: doc.tipoDocumentoId
          }
        });
        
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
            }
          });
        } else {
          // Crear nuevo documento
          resultado = await prisma.propiedadDocumento.create({
            data: {
              unidadId,
              tipoDocumentoId: doc.tipoDocumentoId,
              necesario: Boolean(doc.necesario),
              recibido: Boolean(doc.recibido)
            }
          });
        }
        
        resultados.push(resultado);
      } catch (error) {
        console.error(`Error al guardar documento ${doc.tipoDocumentoId}:`, error.message);
        throw new Error(`Error al guardar documento ${doc.tipoDocumentoId}: ${error.message}`);
      }
    }

    if (resultados.length === 0 && documentosOmitidos.length === documentos.length) {
      return res.status(400).json({ 
        error: 'No se pudo guardar ningún documento. Verificar que los tipos de documento existen en la categoría "documentacion".'
      });
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


