import { Prisma } from '@prisma/client';
import prisma from '../db/prisma.js';
import { conciliarLiquidaciones } from './liquidacion.service.js';

// Códigos de tipo de movimiento
export const TIPO_DEBITO = 'DEBITO';
export const TIPO_CREDITO = 'CREDITO';

/**
 * Obtiene el ID del tipo de movimiento por código
 */
async function getTipoMovimientoId(codigo) {
  const tipo = await prisma.tipoMovimiento.findUnique({
    where: { codigo }
  });
  if (!tipo) {
    throw new Error(`Tipo de movimiento '${codigo}' no encontrado. Ejecutar seed de datos.`);
  }
  return tipo.id;
}

// ============================================
// CUENTA CORRIENTE INQUILINO
// ============================================

/**
 * Registra un DÉBITO en la cuenta del inquilino (aumenta deuda)
 * Se usa al emitir una liquidación
 */
async function registrarDebitoInquilino({ contratoId, liquidacionId, concepto, importe, fecha = new Date(), userId = null }) {
  const tipoMovimientoId = await getTipoMovimientoId(TIPO_DEBITO);
  
  return prisma.movimientoCuentaInquilino.create({
    data: {
      contratoId,
      tipoMovimientoId,
      liquidacionId,
      concepto,
      importe,
      fecha,
      createdById: userId
    }
  });
}

/**
 * Registra un CRÉDITO en la cuenta del inquilino (disminuye deuda)
 * Se usa al registrar un cobro/pago del inquilino
 */
async function registrarCobroInquilino({ 
  contratoId, 
  concepto, 
  importe, 
  medioPagoId = null, 
  nroComprobante = null, 
  observaciones = null,
  liquidacionId = null,
  fecha = new Date(), 
  userId = null 
}) {
  const tipoMovimientoId = await getTipoMovimientoId(TIPO_CREDITO);
  
  return prisma.movimientoCuentaInquilino.create({
    data: {
      contratoId,
      tipoMovimientoId,
      concepto,
      importe,
      medioPagoId,
      nroComprobante,
      observaciones,
      liquidacionId,
      fecha,
      createdById: userId
    }
  });
}

/**
 * Registra un movimiento manual en la cuenta del inquilino (bidireccional)
 * tipoMovimiento: 'CREDITO' = pago recibido (Haber, reduce deuda), 'DEBITO' = cargo (Debe, aumenta deuda)
 * Para CRÉDITOS ejecuta además conciliación FIFO: marca como saldadas las liquidaciones emitidas
 * que queden cubiertas por el importe del cobro (las más antiguas primero).
 */
async function registrarMovimientoInquilino({ 
  contratoId, 
  concepto, 
  importe, 
  medioPagoId, 
  nroComprobante = null, 
  observaciones = null,
  fecha = new Date(),
  tipoMovimiento = TIPO_CREDITO,
  userId = null 
}) {
  const importeAbs = Math.abs(importe);

  if (tipoMovimiento === TIPO_CREDITO) {
    const tipoMovimientoId = await getTipoMovimientoId(TIPO_CREDITO);
    return prisma.$transaction(async (tx) => {
      const movimiento = await tx.movimientoCuentaInquilino.create({
        data: {
          contratoId,
          tipoMovimientoId,
          concepto,
          importe: importeAbs,
          medioPagoId,
          nroComprobante,
          observaciones,
          fecha,
          createdById: userId
        }
      });
      await conciliarLiquidaciones(tx, contratoId, importeAbs);
      return movimiento;
    });
  }

  const tipoMovimientoId = await getTipoMovimientoId(tipoMovimiento);
  return prisma.movimientoCuentaInquilino.create({
    data: {
      contratoId,
      tipoMovimientoId,
      concepto,
      importe: importeAbs,
      medioPagoId,
      nroComprobante,
      observaciones,
      fecha,
      createdById: userId
    }
  });
}

/**
 * Obtiene el saldo actual de la cuenta del inquilino
 * Saldo = Suma(DEBITOS) - Suma(CREDITOS)
 * Positivo = Deuda del inquilino
 * Negativo = Saldo a favor del inquilino
 */
async function getSaldoInquilino(contratoId) {
  const movimientos = await prisma.movimientoCuentaInquilino.findMany({
    where: { 
      contratoId,
      activo: true 
    },
    include: {
      tipoMovimiento: true
    }
  });

  let saldo = 0;
  for (const mov of movimientos) {
    const importe = parseFloat(mov.importe);
    if (mov.tipoMovimiento.codigo === TIPO_DEBITO) {
      saldo += importe;
    } else if (mov.tipoMovimiento.codigo === TIPO_CREDITO) {
      saldo -= importe;
    }
  }
  
  const totalDebitos = movimientos.filter(m => m.tipoMovimiento.codigo === TIPO_DEBITO).reduce((acc, m) => acc + parseFloat(m.importe), 0);
  const totalCreditos = movimientos.filter(m => m.tipoMovimiento.codigo === TIPO_CREDITO).reduce((acc, m) => acc + parseFloat(m.importe), 0);

  return {
    contratoId,
    saldo,
    totalDebitos,
    totalCreditos,
    cantidadMovimientos: movimientos.length
  };
}

/**
 * Ejecuta la conciliación FIFO de liquidaciones emitidas para un contrato de inquilino,
 * usando el total de créditos ya registrados en la cuenta. Útil cuando los cobros se
 * registraron antes de existir la conciliación automática.
 */
async function conciliarLiquidacionesPendientes(contratoId) {
  const { totalCreditos } = await getSaldoInquilino(contratoId);
  if (totalCreditos <= 0) {
    return { liquidacionesSaldadas: 0, montoAplicado: 0 };
  }
  return prisma.$transaction(async (tx) => {
    return conciliarLiquidaciones(tx, contratoId, totalCreditos);
  });
}

/**
 * Obtiene el historial de movimientos de la cuenta del inquilino
 */
async function getMovimientosInquilino(contratoId, { limit = 50, offset = 0 } = {}) {
  return prisma.movimientoCuentaInquilino.findMany({
    where: { 
      contratoId,
      activo: true 
    },
    include: {
      tipoMovimiento: true,
      liquidacion: {
        select: { id: true, periodo: true, total: true }
      },
      medioPago: true
    },
    orderBy: { fecha: 'desc' },
    take: limit,
    skip: offset
  });
}

/**
 * Obtiene todos los contratos vigentes con saldo deudor (agregación en DB, sin full table scan).
 */
async function getContratosConSaldoDeudor() {
  const saldosRows = await prisma.$queryRaw(Prisma.sql`
    SELECT c.id AS "contratoId",
           COALESCE(SUM(CASE WHEN tm.codigo = 'DEBITO' THEN m.importe::numeric ELSE -(m.importe::numeric) END), 0) AS "saldoDeudor"
    FROM contratos c
    INNER JOIN estados_contrato ec ON ec.id = c.estado_contrato_id AND ec.codigo = 'VIGENTE'
    LEFT JOIN movimientos_cuenta_inquilino m ON m.contrato_id = c.id AND m.activo = true AND m.deleted_at IS NULL
    LEFT JOIN tipos_movimiento tm ON tm.id = m.tipo_movimiento_id
    WHERE c.activo = true AND c.deleted_at IS NULL
    GROUP BY c.id
  `);
  const saldosList = Array.isArray(saldosRows) ? saldosRows : [saldosRows].filter(Boolean);
  const contratoIds = saldosList.map((r) => r.contratoId).filter(Boolean);

  if (contratoIds.length === 0) {
    return [];
  }

  const contratos = await prisma.contrato.findMany({
    where: { id: { in: contratoIds } },
    include: {
      inquilino: true,
      propiedad: { include: { localidad: true } }
    }
  });

  const saldoByContratoId = new Map(saldosList.map((r) => [r.contratoId, Number(r.saldoDeudor)]));

  return contratos.map((c) => ({
    ...c,
    saldoDeudor: saldoByContratoId.get(c.id) ?? 0
  }));
}

/**
 * Obtiene todos los contratos con su saldo de inquilino (incluye al día y a favor)
 * @param {string} filtro - 'todos', 'con_deuda', 'al_dia'
 */
async function getContratosInquilinoConSaldo(filtro = 'todos') {
  const contratos = await getContratosConSaldoDeudor();

  switch (filtro) {
    case 'con_deuda':
      return contratos.filter(c => c.saldoDeudor > 0);
    case 'a_favor':
      return contratos.filter(c => c.saldoDeudor < 0);
    case 'al_dia':
      return contratos.filter(c => c.saldoDeudor === 0);
    case 'todos':
    default:
      return contratos;
  }
}

// ============================================
// CUENTA CORRIENTE PROPIETARIO
// ============================================

/**
 * Genera la liquidación al propietario y registra el CRÉDITO correspondiente
 * (La inmobiliaria le debe al propietario)
 */
async function generarLiquidacionPropietario({ 
  contratoId,
  propiedadId = null,
  periodo, 
  alquilerBruto, 
  honorariosInmob = 0, 
  gastosDeducibles = 0, 
  otrasRetenciones = 0,
  observaciones = null,
  fecha = new Date(),
  userId = null 
}) {
  const netoAPagar = alquilerBruto - honorariosInmob - gastosDeducibles - otrasRetenciones;

  return prisma.$transaction(async (tx) => {
    // Crear la liquidación al propietario
    const liquidacionProp = await tx.liquidacionPropietario.create({
      data: {
        contratoId,
        propiedadId,
        periodo,
        fecha,
        alquilerBruto,
        honorariosInmob,
        gastosDeducibles,
        otrasRetenciones,
        netoAPagar,
        observaciones,
        createdById: userId
      }
    });

    // Registrar el CRÉDITO en la cuenta del propietario
    const tipoMovimientoId = await getTipoMovimientoId(TIPO_CREDITO);
    
    await tx.movimientoCuentaPropietario.create({
      data: {
        contratoId,
        propiedadId,
        tipoMovimientoId,
        liquidacionPropietarioId: liquidacionProp.id,
        concepto: `Liquidación ${periodo.substring(5)}-${periodo.substring(0, 4)}`,
        importe: netoAPagar,
        fecha,
        createdById: userId
      }
    });

    return liquidacionProp;
  });
}

/**
 * Genera la liquidación al propietario para propiedades SIN contrato vigente
 * Usa propiedadId en lugar de contratoId
 * Como no hay alquiler, los gastos generan una deuda del propietario hacia la inmobiliaria
 */
async function generarLiquidacionPropietarioSinContrato({ 
  propiedadId, 
  periodo, 
  gastosDeducibles = 0, 
  observaciones = null,
  fecha = new Date(),
  userId = null 
}) {
  // Para propiedades sin contrato, el neto es negativo (el propietario debe los gastos)
  const netoAPagar = -gastosDeducibles;

  return prisma.$transaction(async (tx) => {
    // Crear la liquidación al propietario (sin contratoId)
    const liquidacionProp = await tx.liquidacionPropietario.create({
      data: {
        propiedadId,
        periodo,
        fecha,
        alquilerBruto: 0,
        honorariosInmob: 0,
        gastosDeducibles,
        otrasRetenciones: 0,
        netoAPagar,
        observaciones,
        createdById: userId
      }
    });

    // Registrar el movimiento en cuenta del propietario (por propiedadId)
    // Como el propietario DEBE los gastos a la inmobiliaria, es un DÉBITO (aumenta lo que el propietario debe)
    const tipoMovimientoId = await getTipoMovimientoId(TIPO_DEBITO);
    
    await tx.movimientoCuentaPropietario.create({
      data: {
        propiedadId,
        tipoMovimientoId,
        liquidacionPropietarioId: liquidacionProp.id,
        concepto: `Liquidación ${periodo.substring(5)}-${periodo.substring(0, 4)}`,
        importe: gastosDeducibles, // Importe positivo, el tipo DÉBITO indica que el propietario debe
        fecha,
        createdById: userId
      }
    });

    return liquidacionProp;
  });
}

/**
 * Registra un pago al propietario (DÉBITO - disminuye la deuda de la inmobiliaria)
 * Acepta contratoId O propiedadId (para propiedades sin contrato)
 */
async function registrarPagoPropietario({ 
  contratoId = null,
  propiedadId = null,
  concepto, 
  importe, 
  medioPagoId, 
  nroComprobante = null, 
  observaciones = null,
  fecha = new Date(), 
  userId = null 
}) {
  if (!contratoId && !propiedadId) {
    throw new Error('Se requiere contratoId o propiedadId');
  }
  
  const tipoMovimientoId = await getTipoMovimientoId(TIPO_DEBITO);
  
  const data = {
    tipoMovimientoId,
    concepto,
    importe,
    medioPagoId,
    nroComprobante,
    observaciones,
    fecha,
    createdById: userId
  };
  
  if (contratoId) {
    data.contratoId = contratoId;
  } else {
    data.propiedadId = propiedadId;
  }
  
  return prisma.movimientoCuentaPropietario.create({ data });
}

/**
 * Registra un movimiento manual en la cuenta del propietario (bidireccional)
 * tipoMovimiento: 'DEBITO' = pago emitido (Debe, reduce lo que la inmobiliaria debe), 
 *                 'CREDITO' = liquidación/cargo (Haber, aumenta lo que la inmobiliaria debe)
 * Acepta contratoId O propiedadId (para propiedades sin contrato)
 */
async function registrarMovimientoPropietario({ 
  contratoId = null,
  propiedadId = null,
  concepto, 
  importe, 
  medioPagoId, 
  nroComprobante = null, 
  observaciones = null,
  fecha = new Date(),
  tipoMovimiento = TIPO_DEBITO,
  userId = null 
}) {
  if (!contratoId && !propiedadId) {
    throw new Error('Se requiere contratoId o propiedadId');
  }
  
  const tipoMovimientoId = await getTipoMovimientoId(tipoMovimiento);
  
  const data = {
    tipoMovimientoId,
    concepto,
    importe: Math.abs(importe), // Siempre positivo
    medioPagoId,
    nroComprobante,
    observaciones,
    fecha,
    createdById: userId
  };
  
  // Siempre incluir propiedadId si está disponible
  if (propiedadId) {
    data.propiedadId = propiedadId;
  }
  if (contratoId) {
    data.contratoId = contratoId;
  }
  
  return prisma.movimientoCuentaPropietario.create({ data });
}

/**
 * Obtiene el saldo de la cuenta del propietario
 * Saldo = Suma(CREDITOS) - Suma(DEBITOS)
 * Positivo = La inmobiliaria le debe al propietario
 * Negativo = El propietario le debe a la inmobiliaria (raro, sobrepago)
 */
async function getSaldoPropietario(contratoId) {
  const movimientos = await prisma.movimientoCuentaPropietario.findMany({
    where: { 
      contratoId,
      activo: true 
    },
    include: {
      tipoMovimiento: true
    }
  });

  let saldo = 0;
  for (const mov of movimientos) {
    const importe = parseFloat(mov.importe);
    if (mov.tipoMovimiento.codigo === TIPO_CREDITO) {
      saldo += importe;
    } else if (mov.tipoMovimiento.codigo === TIPO_DEBITO) {
      saldo -= importe;
    }
  }
  
  return {
    contratoId,
    saldo,
    totalCreditos: movimientos.filter(m => m.tipoMovimiento.codigo === TIPO_CREDITO).reduce((acc, m) => acc + parseFloat(m.importe), 0),
    totalDebitos: movimientos.filter(m => m.tipoMovimiento.codigo === TIPO_DEBITO).reduce((acc, m) => acc + parseFloat(m.importe), 0),
    cantidadMovimientos: movimientos.length
  };
}

/**
 * Obtiene el historial de movimientos de la cuenta del propietario
 */
async function getMovimientosPropietario(contratoId, { limit = 50, offset = 0 } = {}) {
  return prisma.movimientoCuentaPropietario.findMany({
    where: { 
      contratoId,
      activo: true 
    },
    include: {
      tipoMovimiento: true,
      liquidacionPropietario: {
        select: { id: true, periodo: true, netoAPagar: true }
      },
      medioPago: true
    },
    orderBy: { fecha: 'desc' },
    take: limit,
    skip: offset
  });
}

/**
 * Obtiene saldos de propietarios AGRUPADOS POR PROPIETARIO (agregación en DB, sin full table scan).
 * La deuda es con la persona, no con cada propiedad individual.
 */
async function getContratosConSaldoPropietario() {
  const [saldosRows, distinctRows] = await Promise.all([
    prisma.$queryRaw(Prisma.sql`
      SELECT pp.propietario_id AS "propietarioId",
             SUM(CASE WHEN tm.codigo = 'CREDITO' THEN m.importe::numeric ELSE -(m.importe::numeric) END) AS "saldoAPagar"
      FROM movimientos_cuenta_propietario m
      INNER JOIN tipos_movimiento tm ON tm.id = m.tipo_movimiento_id
      INNER JOIN (SELECT propiedad_id, MIN(propietario_id) AS propietario_id FROM propiedad_propietario WHERE activo = true AND deleted_at IS NULL GROUP BY propiedad_id) pp ON pp.propiedad_id = m.propiedad_id
      WHERE m.activo = true AND m.deleted_at IS NULL AND m.propiedad_id IS NOT NULL
      GROUP BY pp.propietario_id
    `),
    prisma.$queryRaw(Prisma.sql`
      SELECT pp.propietario_id AS "propietarioId", m.propiedad_id AS "propiedadId", m.contrato_id AS "contratoId"
      FROM movimientos_cuenta_propietario m
      INNER JOIN (SELECT propiedad_id, MIN(propietario_id) AS propietario_id FROM propiedad_propietario WHERE activo = true AND deleted_at IS NULL GROUP BY propiedad_id) pp ON pp.propiedad_id = m.propiedad_id
      WHERE m.activo = true AND m.deleted_at IS NULL AND m.propiedad_id IS NOT NULL
      GROUP BY pp.propietario_id, m.propiedad_id, m.contrato_id
    `)
  ]);

  const saldosList = Array.isArray(saldosRows) ? saldosRows : [saldosRows].filter(Boolean);
  const distinctList = Array.isArray(distinctRows) ? distinctRows : [distinctRows].filter(Boolean);

  const propietarioIds = [...new Set(saldosList.map((r) => r.propietarioId).filter(Boolean))];
  const propiedadIds = [...new Set(distinctList.map((r) => r.propiedadId).filter(Boolean))];

  if (propietarioIds.length === 0) {
    return [];
  }

  const [clientes, propiedades] = await Promise.all([
    prisma.cliente.findMany({
      where: { id: { in: propietarioIds } }
    }),
    propiedadIds.length > 0
      ? prisma.propiedad.findMany({
          where: { id: { in: propiedadIds } },
          include: { localidad: true }
        })
      : Promise.resolve([])
  ]);

  const clienteById = new Map(clientes.map((c) => [c.id, c]));
  const propiedadById = new Map(propiedades.map((p) => [p.id, p]));

  const saldoByPropietarioId = new Map(saldosList.map((r) => [r.propietarioId, Number(r.saldoAPagar)]));

  const propiedadesByPropietarioId = new Map();
  for (const row of distinctList) {
    const pid = row.propietarioId;
    if (!pid || row.propiedadId == null) continue;
    if (!propiedadesByPropietarioId.has(pid)) {
      propiedadesByPropietarioId.set(pid, new Map());
    }
    const byProp = propiedadesByPropietarioId.get(pid);
    if (byProp.has(row.propiedadId)) continue;
    const prop = propiedadById.get(row.propiedadId);
    const direccion = prop
      ? [prop.dirCalle, prop.dirNro, prop.dirPiso ? `${prop.dirPiso}°` : null, prop.dirDepto ? `"${prop.dirDepto}"` : null]
          .filter(Boolean)
          .join(' ')
      : '-';
    const localidad = prop?.localidad?.nombre ?? '-';
    byProp.set(row.propiedadId, {
      id: row.propiedadId,
      direccion,
      localidad,
      contratoId: row.contratoId
    });
  }

  const resultado = [];
  for (const propietarioId of propietarioIds) {
    const propietario = clienteById.get(propietarioId);
    const propiedadesArray = Array.from((propiedadesByPropietarioId.get(propietarioId) || new Map()).values());

    resultado.push({
      id: `propietario-${propietarioId}`,
      tipo: 'propietario',
      propietarioId,
      propietario: propietario ?? null,
      saldoAPagar: saldoByPropietarioId.get(propietarioId) ?? 0,
      propiedades: propiedadesArray,
      propiedadId: propiedadesArray[0]?.id ?? null,
      propiedad: propiedadesArray[0]
        ? {
            id: propiedadesArray[0].id,
            dirCalle: propiedadesArray[0].direccion,
            localidad: { nombre: propiedadesArray[0].localidad }
          }
        : null,
      inquilino: null
    });
  }

  return resultado;
}

/**
 * Obtiene todos los contratos con su saldo de propietario (incluye al día)
 * @param {string} filtro - 'todos', 'pendiente', 'al_dia'
 */
async function getContratosPropietarioConSaldo(filtro = 'todos') {
  const contratos = await getContratosConSaldoPropietario();

  switch (filtro) {
    case 'pendiente':
      return contratos.filter(c => c.saldoAPagar !== 0);
    case 'a_pagar':
      return contratos.filter(c => c.saldoAPagar > 0);
    case 'con_deuda':
      return contratos.filter(c => c.saldoAPagar < 0);
    case 'al_dia':
      return contratos.filter(c => c.saldoAPagar === 0);
    case 'todos':
    default:
      return contratos;
  }
}

/**
 * Obtiene las liquidaciones al propietario de un contrato
 */
async function getLiquidacionesPropietario(contratoId) {
  return prisma.liquidacionPropietario.findMany({
    where: {
      contratoId,
      activo: true
    },
    orderBy: { periodo: 'desc' }
  });
}

// ============================================
// MEDIOS DE PAGO
// ============================================

async function getMediosPago() {
  return prisma.medioPago.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' }
  });
}

export {
  // Inquilino
  registrarDebitoInquilino,
  registrarCobroInquilino,
  registrarMovimientoInquilino, // Nueva: movimiento bidireccional
  getSaldoInquilino,
  getMovimientosInquilino,
  getContratosConSaldoDeudor,
  getContratosInquilinoConSaldo,
  conciliarLiquidacionesPendientes,
  
  // Propietario
  generarLiquidacionPropietario,
  generarLiquidacionPropietarioSinContrato,
  registrarPagoPropietario,
  registrarMovimientoPropietario, // Nueva: movimiento bidireccional
  getSaldoPropietario,
  getMovimientosPropietario,
  getContratosPropietarioConSaldo,
  getContratosConSaldoPropietario,
  getLiquidacionesPropietario,
  
  // Auxiliares
  getMediosPago,
  getTipoMovimientoId
};
