import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapeo de nombres de modelos a sus nombres en Prisma
const MODEL_MAP = {
  'tipos-persona': 'tipoPersona',
  'provincias': 'provincia',
  'localidades': 'localidad',
  'condiciones-iva': 'condicionIva',
  'ambientes-propiedad': 'ambientePropiedad',
  'tipos-propiedad': 'tipoPropiedad',
  'estados-propiedad': 'estadoPropiedad',
  'destinos-propiedad': 'destinoPropiedad',
  'tipos-impuesto-propiedad': 'tipoImpuestoPropiedad',
  'tipos-cargo': 'tipoCargo',
  'tipos-expensa': 'tipoExpensa',
  'periodicidades-impuesto': 'periodicidadImpuesto',
  'tipos-documento-propiedad': 'tipoDocumentoPropiedad',
  'monedas': 'moneda',
  'estados-contrato': 'estadoContrato',
  'metodos-ajuste-contrato': 'metodoAjusteContrato',
  'indices-ajuste': 'indiceAjuste',
  'actores-responsable-contrato': 'actorResponsableContrato',
  'tipos-garantia-contrato': 'tipoGarantiaContrato',
  'estados-garantia-contrato': 'estadoGarantiaContrato',
  'tipos-gasto-inicial-contrato': 'tipoGastoInicialContrato',
  'estados-liquidacion': 'estadoLiquidacion',
  'estados-item-liquidacion': 'estadoItemLiquidacion'
};

// Campos especiales por modelo
const SPECIAL_FIELDS = {
  'localidad': ['provinciaId'],
  'indiceAjuste': ['metodoAjusteContratoId', 'periodo', 'valor', 'variacion', 'fuente', 'fechaPublicacion'],
  'moneda': ['simbolo'],
  'tipoDocumentoPropiedad': ['descripcion'],
  'estadoContrato': ['esFinal'],
  'estadoLiquidacion': ['esFinal'],
  'tipoImpuestoPropiedad': ['periodicidadId'],
  'tipoCargo': ['periodicidadId'],
  'tipoGastoInicialContrato': ['valorDefault', 'esPorcentaje']
};

// Campos que siempre se incluyen
const COMMON_FIELDS = ['codigo', 'nombre', 'activo'];

// Obtener todos los registros de un catálogo
export const getAllCatalogos = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { mostrarInactivos = 'false' } = req.query;
    
    const modelName = MODEL_MAP[tipo];
    if (!modelName) {
      return res.status(400).json({ error: 'Tipo de catálogo no válido' });
    }

    const where = {
      deletedAt: null
    };

    if (mostrarInactivos === 'false') {
      where.activo = true;
    }

    // Para localidades, incluir provincia
    // Para tipos de impuesto y cargo, incluir periodicidad
    const include = modelName === 'localidad' ? {
      provincia: {
        select: {
          id: true,
          nombre: true
        }
      }
    } : modelName === 'tipoImpuestoPropiedad' || modelName === 'tipoCargo' ? {
      periodicidad: {
        select: {
          id: true,
          nombre: true
        }
      }
    } : undefined;

    // Para índices de ajuste, incluir método de ajuste
    const includeIndice = modelName === 'indiceAjuste' ? {
      metodoAjuste: {
        select: {
          id: true,
          codigo: true,
          nombre: true
        }
      }
    } : undefined;

    const finalInclude = include || includeIndice;

    const registros = await prisma[modelName].findMany({
      where,
      include: finalInclude,
      orderBy: [
        { activo: 'desc' },
        { nombre: 'asc' }
      ]
    });

    res.json(registros);
  } catch (error) {
    console.error(`Error al obtener catálogo ${req.params.tipo}:`, error);
    res.status(500).json({ error: `Error al obtener catálogo ${req.params.tipo}` });
  }
};

// Obtener un registro por ID
export const getCatalogoById = async (req, res) => {
  try {
    const { tipo, id } = req.params;
    const modelName = MODEL_MAP[tipo];
    
    if (!modelName) {
      return res.status(400).json({ error: 'Tipo de catálogo no válido' });
    }

    const include = modelName === 'localidad' ? {
      provincia: true
    } : modelName === 'indiceAjuste' ? {
      metodoAjuste: true
    } : modelName === 'tipoImpuestoPropiedad' || modelName === 'tipoCargo' ? {
      periodicidad: true
    } : undefined;

    const registro = await prisma[modelName].findFirst({
      where: {
        id: parseInt(id),
        deletedAt: null
      },
      include
    });

    if (!registro) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    res.json(registro);
  } catch (error) {
    console.error(`Error al obtener registro del catálogo ${req.params.tipo}:`, error);
    res.status(500).json({ error: `Error al obtener registro` });
  }
};

// Crear un nuevo registro
export const createCatalogo = async (req, res) => {
  try {
    const { tipo } = req.params;
    const data = req.body;
    const modelName = MODEL_MAP[tipo];
    
    if (!modelName) {
      return res.status(400).json({ error: 'Tipo de catálogo no válido' });
    }

    // Validaciones básicas
    if (!data.nombre || data.nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    // Preparar datos según el modelo
    const createData = {
      nombre: data.nombre.trim(),
      activo: data.activo !== undefined ? Boolean(data.activo) : true
    };

    // Agregar código si existe y no es null (algunos modelos lo tienen como opcional)
    // Para provincia, codigo es opcional
    if (data.codigo !== undefined && data.codigo !== null && data.codigo !== '') {
      createData.codigo = data.codigo.trim();
    } else if (modelName === 'provincia') {
      // Provincia puede no tener código
      createData.codigo = null;
    }

    // Agregar campos especiales
    const specialFields = SPECIAL_FIELDS[modelName] || [];
    for (const field of specialFields) {
      if (data[field] !== undefined) {
        if (field === 'provinciaId' || field === 'metodoAjusteContratoId' || field === 'periodicidadId') {
          if (data[field] !== null && data[field] !== '') {
            createData[field] = parseInt(data[field]);
          } else {
            createData[field] = null;
          }
        } else if (field === 'valor' || field === 'variacion' || field === 'valorDefault') {
          if (data[field] !== null && data[field] !== '') {
            const parsed = parseFloat(data[field]);
            createData[field] = isNaN(parsed) ? null : parsed;
          } else {
            createData[field] = null;
          }
        } else if (field === 'fechaPublicacion') {
          if (data[field] !== null && data[field] !== '') {
            createData[field] = new Date(data[field]);
          } else {
            createData[field] = null;
          }
        } else if (field === 'esFinal' || field === 'esPorcentaje') {
          createData[field] = Boolean(data[field]);
        } else {
          if (data[field] !== null && data[field] !== '') {
            createData[field] = data[field].trim ? data[field].trim() : data[field];
          } else {
            createData[field] = null;
          }
          }
      }
    }

    const nuevoRegistro = await prisma[modelName].create({
      data: createData,
      include: modelName === 'localidad' ? { provincia: true } : 
               modelName === 'indiceAjuste' ? { metodoAjuste: true } :
               modelName === 'tipoImpuestoPropiedad' || modelName === 'tipoCargo' ? { periodicidad: true } : undefined
    });

    res.status(201).json(nuevoRegistro);
  } catch (error) {
    console.error(`Error al crear registro en catálogo ${req.params.tipo}:`, error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un registro con este código' });
    }

    res.status(500).json({ error: `Error al crear registro` });
  }
};

// Actualizar un registro
export const updateCatalogo = async (req, res) => {
  try {
    const { tipo, id } = req.params;
    const data = req.body;
    const modelName = MODEL_MAP[tipo];
    
    if (!modelName) {
      return res.status(400).json({ error: 'Tipo de catálogo no válido' });
    }

    // Verificar que existe
    const registroExistente = await prisma[modelName].findFirst({
      where: {
        id: parseInt(id),
        deletedAt: null
      }
    });

    if (!registroExistente) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    // Preparar datos de actualización
    const updateData = {};

    if (data.nombre !== undefined) {
      updateData.nombre = data.nombre.trim();
    }

    if (data.activo !== undefined) {
      updateData.activo = Boolean(data.activo);
    }

    if (data.codigo !== undefined && data.codigo !== null && data.codigo !== '') {
      updateData.codigo = data.codigo.trim();
    }

    // Agregar campos especiales
    const specialFields = SPECIAL_FIELDS[modelName] || [];
    for (const field of specialFields) {
      if (data[field] !== undefined) {
        if (field === 'provinciaId' || field === 'metodoAjusteContratoId' || field === 'periodicidadId') {
          if (data[field] === null || data[field] === '') {
            updateData[field] = null;
          } else {
            updateData[field] = parseInt(data[field]);
          }
        } else if (field === 'valor' || field === 'variacion' || field === 'valorDefault') {
          if (data[field] === null || data[field] === '') {
            updateData[field] = null;
          } else {
            const parsed = parseFloat(data[field]);
            updateData[field] = isNaN(parsed) ? null : parsed;
          }
        } else if (field === 'fechaPublicacion') {
          if (data[field] === null || data[field] === '') {
            updateData[field] = null;
          } else {
            updateData[field] = new Date(data[field]);
          }
        } else if (field === 'esFinal' || field === 'esPorcentaje') {
          updateData[field] = Boolean(data[field]);
        } else {
          if (data[field] === null || data[field] === '') {
            updateData[field] = null;
          } else {
            updateData[field] = data[field].trim ? data[field].trim() : data[field];
          }
        }
      }
    }

    const registroActualizado = await prisma[modelName].update({
      where: { id: parseInt(id) },
      data: updateData,
      include: modelName === 'localidad' ? { provincia: true } : 
               modelName === 'indiceAjuste' ? { metodoAjuste: true } :
               modelName === 'tipoImpuestoPropiedad' || modelName === 'tipoCargo' ? { periodicidad: true } : undefined
    });

    res.json(registroActualizado);
  } catch (error) {
    console.error(`Error al actualizar registro en catálogo ${req.params.tipo}:`, error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un registro con este código' });
    }

    res.status(500).json({ error: `Error al actualizar registro` });
  }
};

// Eliminar un registro (soft delete)
export const deleteCatalogo = async (req, res) => {
  try {
    const { tipo, id } = req.params;
    const modelName = MODEL_MAP[tipo];
    
    if (!modelName) {
      return res.status(400).json({ error: 'Tipo de catálogo no válido' });
    }

    // Verificar que existe
    const registroExistente = await prisma[modelName].findFirst({
      where: {
        id: parseInt(id),
        deletedAt: null
      }
    });

    if (!registroExistente) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    // Soft delete
    await prisma[modelName].update({
      where: { id: parseInt(id) },
      data: {
        activo: false,
        deletedAt: new Date()
      }
    });

    res.json({ message: 'Registro eliminado exitosamente' });
  } catch (error) {
    console.error(`Error al eliminar registro del catálogo ${req.params.tipo}:`, error);
    res.status(500).json({ error: `Error al eliminar registro` });
  }
};

