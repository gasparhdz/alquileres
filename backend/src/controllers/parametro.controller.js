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

