import { AjusteOrigen, PrismaClient } from '@prisma/client';

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

const monthsBetween = (fromDate, toDate) => {
  const from = new Date(fromDate);
  const to = new Date(toDate);

  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
};

const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const formatPeriodo = (date) => {
  const target = new Date(date);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
};

const toFixedDecimal = (value, decimals) => {
  return parseFloat(Number(value).toFixed(decimals));
};

const createAjusteTransaction = async ({
  contrato,
  fechaAjuste,
  indiceUsado,
  valorIndice,
  montoAnterior,
  montoNuevo,
  porcentajeAumento,
  origen,
  observaciones
}) => {
  return prisma.$transaction(async (tx) => {
    const ajuste = await tx.contratoAjuste.create({
      data: {
        contratoId: contrato.id,
        fechaAjuste,
        indiceUsado,
        valorIndice: valorIndice.toString(),
        montoAnterior: montoAnterior.toString(),
        montoNuevo: montoNuevo.toString(),
        porcentajeAumento: porcentajeAumento.toString(),
        origen,
        observaciones: observaciones || null
      }
    });

    await tx.contrato.update({
      where: { id: contrato.id },
      data: {
        montoActual: montoNuevo.toString(),
        ultimoAjusteAt: fechaAjuste,
        indiceAumento: indiceUsado || contrato.indiceAumento || null
      }
    });

    return ajuste;
  });
};

const getContratoWithConfig = async (id) => {
  const contrato = await prisma.contrato.findFirst({
    where: { id, isDeleted: false },
    include: {
      unidad: {
        select: { direccion: true, localidad: true }
      },
      inquilino: {
        select: { nombre: true, apellido: true, razonSocial: true }
      }
    }
  });

  if (!contrato) {
    return null;
  }

  const periodoAjuste = contrato.periodoAumento || contrato.frecuenciaAjusteMeses;

  return {
    ...contrato,
    periodoAjuste
  };
};

export const getContratoAjustes = async (req, res) => {
  try {
    const { id } = req.params;

    const ajustes = await prisma.contratoAjuste.findMany({
      where: { contratoId: id },
      orderBy: { fechaAjuste: 'desc' }
    });

    res.json(ajustes);
  } catch (error) {
    console.error('Error al obtener ajustes del contrato:', error);
    res.status(500).json({ error: 'Error al obtener ajustes del contrato' });
  }
};

export const generarAjusteAutomatico = async (req, res) => {
  try {
    const { id } = req.params;

    const contrato = await getContratoWithConfig(id);

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    if (!contrato.periodoAjuste) {
      return res.status(400).json({ error: 'El contrato no tiene configurado el período de ajuste' });
    }

    if (!contrato.indiceAumento) {
      return res.status(400).json({ error: 'El contrato no tiene configurado el índice de ajuste' });
    }

    const referencia = contrato.ultimoAjusteAt ? new Date(contrato.ultimoAjusteAt) : new Date(contrato.fechaInicio);
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

    const indice = await prisma.indiceAjuste.findFirst({
      where: {
        codigo: contrato.indiceAumento,
        periodo: periodoIndice,
        activo: true
      }
    });

    if (!indice) {
      return res.status(404).json({ error: `No se encontró el índice ${contrato.indiceAumento} para el período ${periodoIndice}` });
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
      indiceUsado: contrato.indiceAumento,
      valorIndice,
      montoAnterior,
      montoNuevo,
      porcentajeAumento,
      origen: AjusteOrigen.automatico,
      observaciones: `Ajuste automático aplicado utilizando índice ${contrato.indiceAumento} del período ${periodoIndice}`
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
      indiceUsado,
      valorIndice: valorIndiceParsed,
      montoAnterior,
      montoNuevo: montoNuevoCalculado,
      porcentajeAumento: porcentajeCalculado,
      origen: AjusteOrigen.manual,
      observaciones: observaciones || null
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
    limite.setDate(limite.getDate() + dias);

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

