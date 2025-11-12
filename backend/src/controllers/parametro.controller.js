import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllCategorias = async (req, res) => {
  try {
    const categorias = await prisma.categoria.findMany({
      include: {
        _count: {
          select: {
            parametros: true
          }
        }
      },
      orderBy: { codigo: 'asc' }
    });

    res.json(categorias);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

export const getCategoriaById = async (req, res) => {
  try {
    const { id } = req.params;

    const categoria = await prisma.categoria.findUnique({
      where: { id },
      include: {
        parametros: {
          where: { activo: true },
          orderBy: { orden: 'asc' }
        }
      }
    });

    if (!categoria) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json(categoria);
  } catch (error) {
    console.error('Error al obtener categoría:', error);
    res.status(500).json({ error: 'Error al obtener categoría' });
  }
};

export const getParametrosByCategoria = async (req, res) => {
  try {
    const { codigo } = req.params;

    const categoria = await prisma.categoria.findUnique({
      where: { codigo }
    });

    if (!categoria) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const parametros = await prisma.parametro.findMany({
      where: {
        categoriaId: categoria.id,
        activo: true
      },
      orderBy: { orden: 'asc' }
    });

    res.json(parametros);
  } catch (error) {
    console.error('Error al obtener parámetros:', error);
    res.status(500).json({ error: 'Error al obtener parámetros' });
  }
};

export const getAllParametros = async (req, res) => {
  try {
    const { categoriaCodigo, activo } = req.query;

    const where = {
      ...(categoriaCodigo && {
        categoria: {
          codigo: categoriaCodigo
        }
      }),
      ...(activo !== undefined && { activo: activo === 'true' })
    };

    const parametros = await prisma.parametro.findMany({
      where,
      include: {
        categoria: true
      },
      orderBy: [
        { categoria: { codigo: 'asc' } },
        { orden: 'asc' }
      ]
    });

    res.json(parametros);
  } catch (error) {
    console.error('Error al obtener parámetros:', error);
    res.status(500).json({ error: 'Error al obtener parámetros' });
  }
};

export const createParametro = async (req, res) => {
  try {
    const {
      categoriaCodigo,
      codigo,
      descripcion,
      abreviatura,
      labelCodigo1,
      labelCodigo2,
      periodicidadPorDefecto,
      orden,
      activo = true
    } = req.body;

    if (!categoriaCodigo || !codigo || !descripcion) {
      return res.status(400).json({ error: 'Categoría, código y descripción son requeridos' });
    }

    const categoria = await prisma.categoria.findFirst({
      where: { codigo: categoriaCodigo }
    });

    if (!categoria) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const created = await prisma.parametro.create({
      data: {
        categoriaId: categoria.id,
        codigo: codigo.trim(),
        descripcion: descripcion.trim(),
        abreviatura: abreviatura ? abreviatura.trim() : null,
        labelCodigo1: labelCodigo1 ? labelCodigo1.trim() : null,
        labelCodigo2: labelCodigo2 ? labelCodigo2.trim() : null,
        periodicidadPorDefecto: periodicidadPorDefecto || null,
        orden: orden !== undefined && orden !== null && orden !== '' ? parseInt(orden, 10) : 0,
        activo: Boolean(activo)
      }
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error al crear parámetro:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un parámetro con ese código en la categoría seleccionada' });
    }

    res.status(500).json({ error: 'Error al crear parámetro' });
  }
};

export const updateParametro = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      categoriaCodigo,
      codigo,
      descripcion,
      abreviatura,
      labelCodigo1,
      labelCodigo2,
      periodicidadPorDefecto,
      orden,
      activo
    } = req.body;

    const parametro = await prisma.parametro.findUnique({
      where: { id }
    });

    if (!parametro) {
      return res.status(404).json({ error: 'Parámetro no encontrado' });
    }

    let categoriaId;
    if (categoriaCodigo) {
      const categoria = await prisma.categoria.findFirst({
        where: { codigo: categoriaCodigo }
      });

      if (!categoria) {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }

      categoriaId = categoria.id;
    }

    const updated = await prisma.parametro.update({
      where: { id },
      data: {
        ...(categoriaId && { categoriaId }),
        ...(codigo !== undefined && { codigo: codigo.trim() }),
        ...(descripcion !== undefined && { descripcion: descripcion.trim() }),
        ...(abreviatura !== undefined && { abreviatura: abreviatura ? abreviatura.trim() : null }),
        ...(labelCodigo1 !== undefined && { labelCodigo1: labelCodigo1 ? labelCodigo1.trim() : null }),
        ...(labelCodigo2 !== undefined && { labelCodigo2: labelCodigo2 ? labelCodigo2.trim() : null }),
        ...(periodicidadPorDefecto !== undefined && { periodicidadPorDefecto: periodicidadPorDefecto || null }),
        ...(orden !== undefined && orden !== null && orden !== '' && {
          orden: parseInt(orden, 10)
        }),
        ...(orden === '' && { orden: 0 }),
        ...(activo !== undefined && { activo: Boolean(activo) })
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar parámetro:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un parámetro con ese código en la categoría seleccionada' });
    }

    res.status(500).json({ error: 'Error al actualizar parámetro' });
  }
};

export const deleteParametro = async (req, res) => {
  try {
    const { id } = req.params;

    const parametro = await prisma.parametro.findUnique({
      where: { id }
    });

    if (!parametro) {
      return res.status(404).json({ error: 'Parámetro no encontrado' });
    }

    await prisma.parametro.update({
      where: { id },
      data: { activo: false }
    });

    res.json({ message: 'Parámetro desactivado correctamente' });
  } catch (error) {
    console.error('Error al desactivar parámetro:', error);
    res.status(500).json({ error: 'Error al desactivar parámetro' });
  }
};

