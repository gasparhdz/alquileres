import prisma from '../db/prisma.js';

/**
 * Reglas de ajuste y recálculo (documentación):
 * - Alta: montoAnterior = Contrato.montoActual, porcentajeAumento = ((montoNuevo - montoAnterior) / montoAnterior) * 100.
 *   Se persiste ContratoAjuste y se actualiza Contrato.montoActual = montoNuevo en la misma transacción.
 * - Edición/Anulación: Contrato.montoActual se recalcula con recomputeContratoMontoActual() al último
 *   ajuste activo por fechaAjuste; si no hay ajustes activos, se usa Contrato.montoInicial.
 */

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

const monthsBetween = (fromDate, toDate) => {
  const from = new Date(fromDate);
  const to = new Date(toDate);

  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
};

const addMonths = (date, months) => {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
};

const formatPeriodo = (date) => {
  const target = new Date(date);
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}`;
};

const toFixedDecimal = (value, decimals) => {
  return parseFloat(Number(value).toFixed(decimals));
};

/** Fecha base + N meses (regla de negocio para próxima fecha de ajuste) */
function computeNextAdjustmentDate(fechaBase, frecuenciaMeses) {
  if (!fechaBase || frecuenciaMeses == null) return null;
  return addMonths(new Date(fechaBase), Number(frecuenciaMeses));
}

/**
 * Recalcula Contrato.montoActual según el último ajuste activo por fechaAjuste.
 * Si no hay ajustes activos, usa montoInicial.
 * @param {number} contratoId
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx] - opcional, para usar dentro de una transacción
 */
async function recomputeContratoMontoActual(contratoId, tx = prisma) {
  const ultimo = await tx.contratoAjuste.findFirst({
    where: { contratoId: Number(contratoId), activo: true, deletedAt: null },
    orderBy: { fechaAjuste: 'desc' }
  });
  const contrato = await tx.contrato.findUnique({
    where: { id: Number(contratoId) },
    select: { montoInicial: true }
  });
  if (!contrato) return;
  const montoActual = ultimo ? Number(ultimo.montoNuevo) : Number(contrato.montoInicial);
  await tx.contrato.update({
    where: { id: Number(contratoId) },
    data: { montoActual }
  });
}

const createAjusteTransaction = async ({
  contrato,
  fechaAjuste,
  montoAnterior,
  montoNuevo,
  porcentajeAumento,
  createdById = null
}) => {
  return prisma.$transaction(async (tx) => {
    const ajuste = await tx.contratoAjuste.create({
      data: {
        contratoId: contrato.id,
        fechaAjuste,
        montoAnterior,
        montoNuevo,
        porcentajeAumento,
        createdById
      }
    });

    await tx.contrato.update({
      where: { id: contrato.id },
      data: {
        montoActual: montoNuevo
      }
    });

    return ajuste;
  });
};

const getContratoWithConfig = async (id) => {
  const contrato = await prisma.contrato.findFirst({
    where: { id: Number(id), activo: true, deletedAt: null },
    include: {
      propiedad: {
        select: { dirCalle: true, dirNro: true, dirPiso: true, dirDepto: true }
      },
      inquilino: {
        select: { nombre: true, apellido: true, razonSocial: true }
      },
      estado: {
        select: { codigo: true, nombre: true }
      }
    }
  });

  if (!contrato) {
    return null;
  }

  const periodoAjuste = contrato.frecuenciaAjusteMeses;

  return {
    ...contrato,
    periodoAjuste
  };
};

export const getContratoAjustes = async (req, res) => {
  try {
    const { id } = req.params;
    const contratoId = parseInt(id, 10);
    if (Number.isNaN(contratoId)) {
      return res.status(400).json({ error: 'ID de contrato inválido' });
    }

    const ajustes = await prisma.contratoAjuste.findMany({
      where: { contratoId, activo: true, deletedAt: null },
      orderBy: { fechaAjuste: 'desc' }
    });

    res.json(ajustes);
  } catch (error) {
    console.error('Error al obtener ajustes del contrato:', error);
    res.status(500).json({ error: 'Error al obtener ajustes del contrato' });
  }
};

/**
 * POST /api/contratos/:id/ajustes
 * Crea ajuste manual: montoAnterior = contrato.montoActual, porcentajeAumento calculado.
 * Actualiza Contrato.montoActual en la misma transacción.
 * Solo permitido si el contrato está en estado VIGENTE.
 */
export const createAjuste = async (req, res) => {
  try {
    const { id } = req.params;
    const contratoId = parseInt(id, 10);
    if (Number.isNaN(contratoId)) {
      return res.status(400).json({ error: 'ID de contrato inválido' });
    }

    const { fechaAjuste: fechaAjusteBody, montoNuevo: montoNuevoBody } = req.body;
    const montoNuevo = parseDecimalInput(montoNuevoBody);
    if (montoNuevo === null || montoNuevo <= 0) {
      return res.status(400).json({ error: 'montoNuevo es obligatorio y debe ser mayor a 0' });
    }

    const contrato = await prisma.contrato.findFirst({
      where: { id: contratoId, activo: true, deletedAt: null },
      include: { estado: true }
    });
    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Validar que el contrato esté en estado VIGENTE para poder cargar ajustes
    if (!contrato.estado || contrato.estado.codigo !== 'VIGENTE') {
      return res.status(400).json({
        error: 'Solo se pueden cargar ajustes en contratos con estado Vigente'
      });
    }

    // montoAnterior = último ajuste activo por fechaAjuste (no por id), o montoInicial si no hay
    const ultimoAjuste = await prisma.contratoAjuste.findFirst({
      where: { contratoId, activo: true, deletedAt: null },
      orderBy: { fechaAjuste: 'desc' }
    });
    const montoAnterior = ultimoAjuste
      ? Number(ultimoAjuste.montoNuevo)
      : Number(contrato.montoActual ?? contrato.montoInicial);
    const fechaAjuste = fechaAjusteBody ? new Date(fechaAjusteBody) : new Date();
    const fechaInicio = new Date(contrato.fechaInicio);
    if (fechaAjuste < fechaInicio) {
      return res.status(400).json({ error: 'La fecha de ajuste no puede ser anterior a la fecha de inicio del contrato' });
    }
    if (contrato.fechaFin) {
      const fechaFin = new Date(contrato.fechaFin);
      if (fechaAjuste > fechaFin) {
        return res.status(400).json({ error: 'La fecha de ajuste no puede ser posterior a la fecha de fin del contrato' });
      }
    }

    const porcentajeAumento = montoAnterior === 0
      ? 0
      : toFixedDecimal(((montoNuevo - montoAnterior) / montoAnterior) * 100, 4);
    const userId = req.user?.id ?? req.user?.userId ?? null;

    const ajuste = await createAjusteTransaction({
      contrato: { id: contratoId },
      fechaAjuste,
      montoAnterior,
      montoNuevo,
      porcentajeAumento,
      createdById: userId
    });

    res.status(201).json(ajuste);
  } catch (error) {
    console.error('Error al crear ajuste:', error);
    res.status(500).json({ error: 'Error al crear ajuste' });
  }
};

/**
 * PUT /api/contratos/:id/ajustes/:ajusteId
 * Edita ajuste; recalcula porcentaje si cambian montos; recalcula Contrato.montoActual al último ajuste activo.
 */
export const updateAjuste = async (req, res) => {
  try {
    const { id, ajusteId } = req.params;
    const contratoId = parseInt(id, 10);
    const ajusteIdNum = parseInt(ajusteId, 10);
    if (Number.isNaN(contratoId) || Number.isNaN(ajusteIdNum)) {
      return res.status(400).json({ error: 'IDs inválidos' });
    }

    const { fechaAjuste: fechaBody, montoAnterior: maBody, montoNuevo: mnBody } = req.body;
    const ajuste = await prisma.contratoAjuste.findFirst({
      where: { id: ajusteIdNum, contratoId, activo: true, deletedAt: null }
    });
    if (!ajuste) {
      return res.status(404).json({ error: 'Ajuste no encontrado' });
    }

    const contrato = await prisma.contrato.findFirst({
      where: { id: contratoId, activo: true, deletedAt: null }
    });
    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    let montoAnterior = maBody !== undefined ? parseDecimalInput(maBody) : Number(ajuste.montoAnterior);
    let montoNuevo = mnBody !== undefined ? parseDecimalInput(mnBody) : Number(ajuste.montoNuevo);
    if (montoNuevo !== null && montoNuevo <= 0) {
      return res.status(400).json({ error: 'montoNuevo debe ser mayor a 0' });
    }
    if (montoAnterior === null) montoAnterior = Number(ajuste.montoAnterior);
    if (montoNuevo === null) montoNuevo = Number(ajuste.montoNuevo);
    const porcentajeAumento = montoAnterior === 0
      ? 0
      : toFixedDecimal(((montoNuevo - montoAnterior) / montoAnterior) * 100, 4);

    const fechaAjuste = fechaBody ? new Date(fechaBody) : new Date(ajuste.fechaAjuste);
    const userId = req.user?.id ?? req.user?.userId ?? null;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.contratoAjuste.update({
        where: { id: ajusteIdNum },
        data: {
          fechaAjuste,
          montoAnterior,
          montoNuevo,
          porcentajeAumento,
          updatedById: userId
        }
      });
      await recomputeContratoMontoActual(contratoId, tx);
      return tx.contratoAjuste.findUnique({ where: { id: ajusteIdNum } });
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar ajuste:', error);
    res.status(500).json({ error: 'Error al actualizar ajuste' });
  }
};

/**
 * GET /api/contratos/:id/ajustes/:ajusteId
 * Detalle de un ajuste (incluye anulados para historial).
 */
export const getAjusteById = async (req, res) => {
  try {
    const { id, ajusteId } = req.params;
    const contratoId = parseInt(id, 10);
    const ajusteIdNum = parseInt(ajusteId, 10);
    if (Number.isNaN(contratoId) || Number.isNaN(ajusteIdNum)) {
      return res.status(400).json({ error: 'IDs inválidos' });
    }

    const ajuste = await prisma.contratoAjuste.findFirst({
      where: { id: ajusteIdNum, contratoId }
    });
    if (!ajuste) {
      return res.status(404).json({ error: 'Ajuste no encontrado' });
    }

    res.json(ajuste);
  } catch (error) {
    console.error('Error al obtener ajuste:', error);
    res.status(500).json({ error: 'Error al obtener ajuste' });
  }
};

/**
 * DELETE /api/contratos/:id/ajustes/:ajusteId
 * Anula ajuste (soft: activo=false, deletedAt, deletedById) y recalcula Contrato.montoActual.
 */
export const deleteAjuste = async (req, res) => {
  try {
    const { id, ajusteId } = req.params;
    const contratoId = parseInt(id, 10);
    const ajusteIdNum = parseInt(ajusteId, 10);
    if (Number.isNaN(contratoId) || Number.isNaN(ajusteIdNum)) {
      return res.status(400).json({ error: 'IDs inválidos' });
    }

    const ajuste = await prisma.contratoAjuste.findFirst({
      where: { id: ajusteIdNum, contratoId, activo: true, deletedAt: null }
    });
    if (!ajuste) {
      return res.status(404).json({ error: 'Ajuste no encontrado' });
    }

    const now = new Date();
    const userId = req.user?.id ?? req.user?.userId ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.contratoAjuste.update({
        where: { id: ajusteIdNum },
        data: {
          activo: false,
          deletedAt: now,
          deletedById: userId
        }
      });
      await recomputeContratoMontoActual(contratoId, tx);
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error al anular ajuste:', error);
    res.status(500).json({ error: 'Error al anular ajuste' });
  }
};

export const generarAjusteAutomatico = async (req, res) => {
  try {
    const { id } = req.params;

    const contrato = await getContratoWithConfig(id);

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Validar que el contrato esté en estado VIGENTE para poder cargar ajustes
    if (!contrato.estado || contrato.estado.codigo !== 'VIGENTE') {
      return res.status(400).json({
        error: 'Solo se pueden cargar ajustes en contratos con estado Vigente'
      });
    }

    if (!contrato.periodoAjuste) {
      return res.status(400).json({ error: 'El contrato no tiene configurado el período de ajuste' });
    }

    // Obtener el método de ajuste del contrato
    if (!contrato.metodoAjusteContratoId) {
      return res.status(400).json({ error: 'El contrato no tiene configurado el método de ajuste' });
    }

    // Obtener el último ajuste si existe
    const ultimoAjuste = await prisma.contratoAjuste.findFirst({
      where: { contratoId: contrato.id },
      orderBy: { fechaAjuste: 'desc' }
    });
    const referencia = ultimoAjuste ? new Date(ultimoAjuste.fechaAjuste) : new Date(contrato.fechaInicio);
    const hoy = new Date();
    const mesesTranscurridos = monthsBetween(referencia, hoy);

    if (mesesTranscurridos < contrato.periodoAjuste) {
      const proximo = addMonths(referencia, contrato.periodoAjuste);
      return res.status(200).json({
        message: 'El ajuste no corresponde aún',
        nextAdjustmentAt: proximo
      });
    }

    const periodoIndice = formatPeriodo(hoy);

    // Obtener el método de ajuste
    const metodoAjuste = await prisma.metodoAjusteContrato.findUnique({
      where: { id: contrato.metodoAjusteContratoId }
    });

    if (!metodoAjuste) {
      return res.status(404).json({ error: 'No se encontró el método de ajuste configurado' });
    }

    const indice = await prisma.indiceAjuste.findFirst({
      where: {
        metodoAjusteContratoId: contrato.metodoAjusteContratoId,
        periodo: periodoIndice,
        activo: true
      }
    });

    if (!indice) {
      return res.status(404).json({ error: `No se encontró el índice para el método ${metodoAjuste.codigo} en el período ${periodoIndice}` });
    }

    const valorIndice = parseDecimalInput(indice.valor);
    if (valorIndice === null) {
      return res.status(400).json({ error: 'El valor del índice es inválido' });
    }

    const montoAnterior = parseDecimalInput(contrato.montoActual ?? contrato.montoInicial);
    const montoNuevo = toFixedDecimal(montoAnterior * valorIndice, 2);
    const porcentajeAumento = toFixedDecimal(((montoNuevo / montoAnterior) - 1) * 100, 4);
    const fechaAjuste = hoy;

    const ajuste = await createAjusteTransaction({
      contrato,
      fechaAjuste,
      montoAnterior,
      montoNuevo,
      porcentajeAumento
    });

    res.status(201).json(ajuste);
  } catch (error) {
    console.error('Error al generar ajuste automático:', error);
    res.status(500).json({ error: 'Error al generar ajuste automático' });
  }
};

export const registrarAjusteManual = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fechaAjuste,
      indiceUsado,
      valorIndice,
      montoNuevo,
      porcentajeAumento,
      observaciones
    } = req.body;

    if (!fechaAjuste || !indiceUsado || valorIndice === undefined) {
      return res.status(400).json({ error: 'Fecha de ajuste, índice usado y valor del índice son obligatorios' });
    }

    const contrato = await getContratoWithConfig(id);

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Validar que el contrato esté en estado VIGENTE para poder cargar ajustes
    if (!contrato.estado || contrato.estado.codigo !== 'VIGENTE') {
      return res.status(400).json({
        error: 'Solo se pueden cargar ajustes en contratos con estado Vigente'
      });
    }

    const valorIndiceParsed = parseDecimalInput(valorIndice);
    if (valorIndiceParsed === null) {
      return res.status(400).json({ error: 'Valor del índice inválido' });
    }

    const montoAnterior = parseDecimalInput(contrato.montoActual ?? contrato.montoInicial);
    if (montoAnterior === null) {
      return res.status(400).json({ error: 'El contrato no tiene un monto anterior válido' });
    }

    let montoNuevoCalculado = parseDecimalInput(montoNuevo);
    let porcentajeCalculado = parseDecimalInput(porcentajeAumento);

    if (montoNuevoCalculado === null && porcentajeCalculado === null) {
      return res.status(400).json({ error: 'Debe indicar el monto nuevo o el porcentaje de aumento' });
    }

    if (porcentajeCalculado === null && montoNuevoCalculado !== null) {
      porcentajeCalculado = toFixedDecimal(((montoNuevoCalculado / montoAnterior) - 1) * 100, 4);
    }

    if (montoNuevoCalculado === null && porcentajeCalculado !== null) {
      montoNuevoCalculado = toFixedDecimal(montoAnterior * (1 + porcentajeCalculado / 100), 2);
    }

    const ajuste = await createAjusteTransaction({
      contrato,
      fechaAjuste: new Date(fechaAjuste),
      montoAnterior,
      montoNuevo: montoNuevoCalculado,
      porcentajeAumento: porcentajeCalculado
    });

    res.status(201).json(ajuste);
  } catch (error) {
    console.error('Error al registrar ajuste manual:', error);
    res.status(500).json({ error: 'Error al registrar ajuste manual' });
  }
};

export const getAjustesProximos = async (req, res) => {
  try {
    const dias = req.query.dias ? parseInt(req.query.dias, 10) : 30;
    const hoy = new Date();
    const limite = new Date(hoy);
    limite.setUTCDate(limite.getUTCDate() + dias);

    const contratos = await prisma.contrato.findMany({
      where: {
        isDeleted: false,
        OR: [
          { periodoAumento: { not: null } },
          { frecuenciaAjusteMeses: { not: null } }
        ]
      },
      select: {
        id: true,
        nroContrato: true,
        fechaInicio: true,
        ultimoAjusteAt: true,
        periodoAumento: true,
        frecuenciaAjusteMeses: true,
        indiceAumento: true,
        montoActual: true,
        inquilino: {
          select: {
            nombre: true,
            apellido: true,
            razonSocial: true
          }
        },
        unidad: {
          select: {
            direccion: true,
            localidad: true
          }
        }
      }
    });

    const proximos = contratos
      .map((contrato) => {
        const periodo = contrato.periodoAumento || contrato.frecuenciaAjusteMeses;
        if (!periodo) {
          return null;
        }

        const referencia = contrato.ultimoAjusteAt ? new Date(contrato.ultimoAjusteAt) : new Date(contrato.fechaInicio);
        const proximo = addMonths(referencia, periodo);

        const diasRestantes = Math.ceil((proximo - hoy) / (1000 * 60 * 60 * 24));

        return {
          contratoId: contrato.id,
          nroContrato: contrato.nroContrato,
          indice: contrato.indiceAumento,
          montoActual: contrato.montoActual,
          fechaUltimoAjuste: contrato.ultimoAjusteAt,
          fechaProximoAjuste: proximo,
          diasRestantes,
          inquilino: contrato.inquilino,
          unidad: contrato.unidad
        };
      })
      .filter((item) => item !== null && item.fechaProximoAjuste <= limite)
      .sort((a, b) => a.fechaProximoAjuste - b.fechaProximoAjuste);

    res.json({ data: proximos, meta: { dias } });
  } catch (error) {
    console.error('Error al obtener ajustes próximos:', error);
    res.status(500).json({ error: 'Error al obtener ajustes próximos' });
  }
};

// Calcular ajustes proyectados por cuatrimestres
export const calcularAjustesProyectados = async (req, res) => {
  try {
    const { id } = req.params;
    const { fechaInicio, fechaFin, indiceAumento, periodoAumento, montoActual } = req.body;

    // Obtener contrato si se proporciona ID
    let contrato = null;
    if (id) {
      contrato = await getContratoWithConfig(id);
      if (!contrato) {
        return res.status(404).json({ error: 'Contrato no encontrado' });
      }
    }

    // Usar datos del contrato o los proporcionados en el body
    const fechaInicioContrato = fechaInicio ? new Date(fechaInicio) : new Date(contrato.fechaInicio);
    const fechaFinContrato = fechaFin ? new Date(fechaFin) : (contrato.fechaFin ? new Date(contrato.fechaFin) : null);
    const codigoIndice = indiceAumento || contrato?.indiceAumento;
    const periodoMeses = periodoAumento || contrato?.periodoAumento || contrato?.frecuenciaAjusteMeses;
    const montoInicial = montoActual ? parseDecimalInput(montoActual) : parseDecimalInput(contrato?.montoActual || contrato?.montoInicial);

    if (!codigoIndice) {
      return res.status(400).json({ error: 'El índice de ajuste es requerido' });
    }

    if (!periodoMeses) {
      return res.status(400).json({ error: 'El período de ajuste es requerido' });
    }

    if (montoInicial === null) {
      return res.status(400).json({ error: 'El monto inicial es requerido' });
    }

    // Calcular cuatrimestres (períodos de 4 meses)
    const cuatrimestres = [];
    const fechaLimite = fechaFinContrato || addMonths(new Date(), 24); // Por defecto, calcular 2 años hacia adelante
    let fechaActual = new Date(fechaInicioContrato);
    let montoActualCalculado = montoInicial;
    let cuatrimestreNumero = 1;

    while (fechaActual < fechaLimite && cuatrimestres.length < 10) { // Máximo 10 cuatrimestres
      const fechaInicioCuatrimestre = new Date(fechaActual);
      const fechaFinCuatrimestre = addMonths(fechaActual, 4);

      // Obtener valores del índice para cada mes del cuatrimestre
      const meses = [];
      let valorIndiceAnterior = null;
      let valorIndiceInicioCuatrimestre = null;
      let montoAlInicioCuatrimestre = montoActualCalculado;

      for (let mes = 0; mes < 4; mes++) {
        const fechaMes = addMonths(fechaActual, mes);
        const periodoMes = formatPeriodo(fechaMes);

        // Buscar valor del índice para este período
        const indice = await prisma.indiceAjuste.findFirst({
          where: {
            codigo: codigoIndice,
            periodo: periodoMes,
            activo: true
          },
          orderBy: { periodo: 'desc' }
        });

        if (indice) {
          const valorIndice = parseDecimalInput(indice.valor);

          // Guardar el primer valor del cuatrimestre
          if (valorIndiceInicioCuatrimestre === null) {
            valorIndiceInicioCuatrimestre = valorIndice;
          }

          // Calcular variación respecto al mes anterior
          let porcentajeMesAnterior = 0;
          if (valorIndiceAnterior !== null && valorIndiceAnterior !== 0) {
            porcentajeMesAnterior = ((valorIndice / valorIndiceAnterior) - 1) * 100;
          }

          // Calcular acumulado desde el inicio del cuatrimestre
          let acumulado = 0;
          if (valorIndiceInicioCuatrimestre !== null && valorIndiceInicioCuatrimestre !== 0) {
            acumulado = ((valorIndice / valorIndiceInicioCuatrimestre) - 1) * 100;
          }

          meses.push({
            fecha: fechaMes.toISOString().split('T')[0],
            valorIndice: valorIndice,
            porcentajeMesAnterior: toFixedDecimal(porcentajeMesAnterior, 2),
            acumulado: toFixedDecimal(acumulado, 2)
          });

          valorIndiceAnterior = valorIndice;
        } else {
          // Si no hay índice, buscar el último valor conocido antes de este período
          const ultimoIndiceConocido = await prisma.indiceAjuste.findFirst({
            where: {
              codigo: codigoIndice,
              periodo: { lte: periodoMes },
              activo: true
            },
            orderBy: { periodo: 'desc' }
          });

          const valorIndice = ultimoIndiceConocido ? parseDecimalInput(ultimoIndiceConocido.valor) : (valorIndiceAnterior || 0);

          // Guardar el primer valor del cuatrimestre si es el primer mes
          if (valorIndiceInicioCuatrimestre === null && valorIndice > 0) {
            valorIndiceInicioCuatrimestre = valorIndice;
          }

          // Calcular variación respecto al mes anterior
          let porcentajeMesAnterior = 0;
          if (valorIndiceAnterior !== null && valorIndiceAnterior !== 0 && valorIndice !== valorIndiceAnterior) {
            porcentajeMesAnterior = ((valorIndice / valorIndiceAnterior) - 1) * 100;
          }

          // Calcular acumulado desde el inicio del cuatrimestre
          let acumulado = 0;
          if (valorIndiceInicioCuatrimestre !== null && valorIndiceInicioCuatrimestre !== 0) {
            acumulado = ((valorIndice / valorIndiceInicioCuatrimestre) - 1) * 100;
          }

          meses.push({
            fecha: fechaMes.toISOString().split('T')[0],
            valorIndice: valorIndice,
            porcentajeMesAnterior: toFixedDecimal(porcentajeMesAnterior, 2),
            acumulado: toFixedDecimal(acumulado, 2)
          });

          if (valorIndice > 0) {
            valorIndiceAnterior = valorIndice;
          }
        }
      }

      // Calcular aumento del cuatrimestre usando el acumulado del último mes
      const ultimoMes = meses[meses.length - 1];
      let aumentoCuatrimestre = 0;

      // Si hay meses con datos, usar el acumulado del último mes
      if (meses.length > 0 && ultimoMes.acumulado !== undefined) {
        aumentoCuatrimestre = ultimoMes.acumulado;
      } else if (meses.length > 0 && ultimoMes.valorIndice && meses[0].valorIndice && meses[0].valorIndice > 0) {
        // Fallback: calcular comparando último con primero
        aumentoCuatrimestre = ((ultimoMes.valorIndice / meses[0].valorIndice) - 1) * 100;
      }

      // Calcular nuevo monto después del cuatrimestre
      const nuevoMonto = toFixedDecimal(montoAlInicioCuatrimestre * (1 + aumentoCuatrimestre / 100), 2);
      montoActualCalculado = nuevoMonto;

      cuatrimestres.push({
        numero: cuatrimestreNumero++,
        fechaInicio: fechaInicioCuatrimestre.toISOString().split('T')[0],
        aumento: toFixedDecimal(aumentoCuatrimestre, 2),
        valor: nuevoMonto,
        meses: meses
      });

      // Avanzar al siguiente cuatrimestre
      fechaActual = fechaFinCuatrimestre;
    }

    res.json({
      fechaInicio: fechaInicioContrato.toISOString().split('T')[0],
      indiceAumento: codigoIndice,
      periodoAumento: periodoMeses,
      montoInicial: montoInicial,
      cuatrimestres: cuatrimestres
    });
  } catch (error) {
    console.error('Error al calcular ajustes proyectados:', error);
    res.status(500).json({ error: 'Error al calcular ajustes proyectados', message: error.message });
  }
};

