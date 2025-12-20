import { PrismaClient } from '@prisma/client';
import { syncIPCSeries } from '../services/ipc.service.js';

const prisma = new PrismaClient();

const parseDecimalInput = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numeric = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return numeric;
};

const buildWhereClause = ({ metodoAjusteContratoId, periodoDesde, periodoHasta, activo }) => {
  const where = {
    deletedAt: null
  };

  if (metodoAjusteContratoId) {
    where.metodoAjusteContratoId = parseInt(metodoAjusteContratoId);
  }

  if (periodoDesde || periodoHasta) {
    where.periodo = {};

    if (periodoDesde) {
      where.periodo.gte = periodoDesde;
    }
    if (periodoHasta) {
      where.periodo.lte = periodoHasta;
    }
  }

  if (activo !== undefined) {
    if (activo === 'true' || activo === true) {
      where.activo = true;
    } else if (activo === 'false' || activo === false) {
      where.activo = false;
    }
  }

  return where;
};

const calculateVariacion = (valorActual, valorAnterior) => {
  const anterior = parseFloat(valorAnterior);
  const actual = parseFloat(valorActual);

  if (!anterior || Number.isNaN(anterior) || anterior === 0) {
    return null;
  }

  const variacion = ((actual / anterior) - 1) * 100;
  return parseFloat(variacion.toFixed(4));
};

export const listIndices = async (req, res) => {
  try {
    const {
      metodoAjusteContratoId,
      periodoDesde,
      periodoHasta,
      activo,
      page = 1,
      limit = 50
    } = req.query;

    const where = buildWhereClause({ metodoAjusteContratoId, periodoDesde, periodoHasta, activo });
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [indices, total] = await Promise.all([
      prisma.indiceAjuste.findMany({
        where,
        orderBy: [
          { metodoAjusteContratoId: 'asc' },
          { periodo: 'desc' }
        ],
        include: {
          metodoAjuste: {
            select: {
              id: true,
              codigo: true,
              nombre: true
            }
          }
        },
        skip,
        take: parseInt(limit, 10)
      }),
      prisma.indiceAjuste.count({ where })
    ]);

    res.json({
      data: indices,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('Error al listar índices de ajuste:', error);
    res.status(500).json({ error: 'Error al listar índices de ajuste' });
  }
};

export const createIndice = async (req, res) => {
  try {
    const {
      codigo,
      descripcion,
      periodo,
      valor,
      variacion,
      fuente,
      fechaPublicacion,
      activo = true
    } = req.body;

    if (!codigo || !descripcion || !periodo || valor === undefined || !fechaPublicacion) {
      return res.status(400).json({ error: 'Código, descripción, período, valor y fecha de publicación son obligatorios' });
    }

    const existing = await prisma.indiceAjuste.findFirst({
      where: {
        codigo,
        periodo
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Ya existe un valor para este índice en el período indicado' });
    }

    const valorNumerico = parseDecimalInput(valor);
    if (valorNumerico === null) {
      return res.status(400).json({ error: 'Valor del índice inválido' });
    }

    let variacionCalculada = variacion !== undefined ? parseDecimalInput(variacion) : null;

    if (variacionCalculada === null || Number.isNaN(variacionCalculada)) {
      const periodoAnterior = await prisma.indiceAjuste.findFirst({
        where: {
          codigo,
          periodo: { lt: periodo }
        },
        orderBy: { periodo: 'desc' }
      });

      if (periodoAnterior) {
        variacionCalculada = calculateVariacion(valorNumerico, periodoAnterior.valor);
      }
    }

    const created = await prisma.indiceAjuste.create({
      data: {
        codigo,
        descripcion,
        periodo,
        valor: valorNumerico.toString(),
        variacion: variacionCalculada !== null && !Number.isNaN(variacionCalculada) ? variacionCalculada.toString() : null,
        fuente: fuente || null,
        fechaPublicacion: new Date(fechaPublicacion),
        activo: Boolean(activo),
        createdBy: req.user?.id || null,
        updatedBy: req.user?.id || null
      }
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error al crear índice de ajuste:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un valor para este índice en el período indicado' });
    }

    res.status(500).json({ error: 'Error al crear índice de ajuste' });
  }
};

export const syncIPC = async (req, res) => {
  try {
    const result = await syncIPCSeries(req.user?.id || null);
    res.json(result);
  } catch (error) {
    console.error('Error al sincronizar IPC:', error);
    res.status(500).json({ error: error.message || 'Error al sincronizar IPC' });
  }
};

