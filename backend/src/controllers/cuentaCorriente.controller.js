import prisma from '../db/prisma.js';
import * as cuentaCorrienteService from '../services/cuentaCorriente.service.js';

// ============================================
// COBROS (INQUILINOS)
// ============================================

/**
 * POST /api/cobros
 * Registra un movimiento en la cuenta del inquilino (cobro o cargo)
 * tipoMovimiento: 'CREDITO' = cobro/pago recibido (reduce deuda), 'DEBITO' = cargo (aumenta deuda)
 */
async function registrarCobro(req, res) {
  try {
    const { 
      contratoId, 
      concepto, 
      importe, 
      medioPagoId, 
      nroComprobante, 
      observaciones,
      fecha,
      tipoMovimiento = 'CREDITO' // Por defecto es cobro (reduce deuda)
    } = req.body;

    if (!contratoId || !concepto || !importe || !medioPagoId) {
      return res.status(400).json({ 
        error: 'Campos requeridos: contratoId, concepto, importe, medioPagoId' 
      });
    }

    // Validar tipo de movimiento
    if (!['CREDITO', 'DEBITO'].includes(tipoMovimiento)) {
      return res.status(400).json({ 
        error: 'tipoMovimiento debe ser CREDITO o DEBITO' 
      });
    }

    const userId = req.user?.id || null;
    
    const movimiento = await cuentaCorrienteService.registrarMovimientoInquilino({
      contratoId: parseInt(contratoId, 10),
      concepto,
      importe: Math.abs(parseFloat(importe)), // Siempre positivo
      medioPagoId: parseInt(medioPagoId, 10),
      nroComprobante,
      observaciones,
      fecha: fecha ? new Date(fecha) : new Date(),
      tipoMovimiento, // CREDITO = cobro, DEBITO = cargo
      userId
    });

    res.status(201).json(movimiento);
  } catch (error) {
    console.error('Error al registrar movimiento inquilino:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/contratos/:id/cuenta-inquilino/saldo
 * Obtiene el saldo actual de la cuenta del inquilino
 */
async function getSaldoInquilino(req, res) {
  try {
    const contratoId = parseInt(req.params.id, 10);
    const saldo = await cuentaCorrienteService.getSaldoInquilino(contratoId);
    res.json(saldo);
  } catch (error) {
    console.error('Error al obtener saldo inquilino:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/contratos/:id/cuenta-inquilino/movimientos
 * Obtiene el historial de movimientos de la cuenta del inquilino
 */
async function getMovimientosInquilino(req, res) {
  try {
    const contratoId = parseInt(req.params.id, 10);
    const { limit = 50, offset = 0 } = req.query;
    
    const movimientos = await cuentaCorrienteService.getMovimientosInquilino(
      contratoId, 
      { limit: parseInt(limit, 10), offset: parseInt(offset, 10) }
    );
    res.json(movimientos);
  } catch (error) {
    console.error('Error al obtener movimientos inquilino:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/contratos/:id/conciliar-liquidaciones
 * Marca como saldadas las liquidaciones emitidas del contrato (inquilino) que queden
 * cubiertas por los créditos ya registrados. Útil cuando los cobros se cargaron antes
 * de tener conciliación automática.
 */
async function conciliarLiquidacionesPendientes(req, res) {
  try {
    const contratoId = parseInt(req.params.id, 10);
    const resultado = await cuentaCorrienteService.conciliarLiquidacionesPendientes(contratoId);
    res.json(resultado);
  } catch (error) {
    console.error('Error al conciliar liquidaciones:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/cobranzas/pendientes
 * Obtiene todos los contratos con saldo deudor
 * Query params: filtro = 'todos' | 'con_deuda' | 'al_dia'
 */
async function getCobranzasPendientes(req, res) {
  try {
    const filtro = req.query.filtro || 'con_deuda';
    const contratos = await cuentaCorrienteService.getContratosInquilinoConSaldo(filtro);
    res.json(contratos);
  } catch (error) {
    console.error('Error al obtener cobranzas pendientes:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// PAGOS A PROPIETARIOS
// ============================================

/**
 * POST /api/pagos-propietario
 * Registra un movimiento en la cuenta del propietario (pago o cobro)
 * tipoMovimiento: 'DEBITO' = pago emitido (reduce lo que la inmobiliaria debe), 'CREDITO' = liquidación/deuda (aumenta lo que la inmobiliaria debe)
 */
async function registrarPagoPropietario(req, res) {
  try {
    const { 
      contratoId, 
      propiedadId,
      concepto, 
      importe, 
      medioPagoId, 
      nroComprobante, 
      observaciones,
      fecha,
      tipoMovimiento = 'DEBITO' // Por defecto es pago (reduce deuda de la inmobiliaria)
    } = req.body;

    if ((!contratoId && !propiedadId) || !concepto || !importe || !medioPagoId) {
      return res.status(400).json({ 
        error: 'Campos requeridos: (contratoId o propiedadId), concepto, importe, medioPagoId' 
      });
    }

    // Validar tipo de movimiento
    if (!['CREDITO', 'DEBITO'].includes(tipoMovimiento)) {
      return res.status(400).json({ 
        error: 'tipoMovimiento debe ser CREDITO o DEBITO' 
      });
    }

    const userId = req.user?.id || null;
    
    const movimiento = await cuentaCorrienteService.registrarMovimientoPropietario({
      contratoId: contratoId ? parseInt(contratoId, 10) : null,
      propiedadId: propiedadId ? parseInt(propiedadId, 10) : null,
      concepto,
      importe: Math.abs(parseFloat(importe)), // Siempre positivo
      medioPagoId: parseInt(medioPagoId, 10),
      nroComprobante,
      observaciones,
      fecha: fecha ? new Date(fecha) : new Date(),
      tipoMovimiento, // DEBITO = pago emitido, CREDITO = cargo/liquidación
      userId
    });

    res.status(201).json(movimiento);
  } catch (error) {
    console.error('Error al registrar movimiento propietario:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/contratos/:id/liquidacion-propietario
 * Genera una liquidación al propietario
 */
async function generarLiquidacionPropietario(req, res) {
  try {
    const contratoId = parseInt(req.params.id, 10);
    const { 
      periodo, 
      alquilerBruto, 
      honorariosInmob = 0, 
      gastosDeducibles = 0, 
      otrasRetenciones = 0,
      observaciones,
      fecha 
    } = req.body;

    if (!periodo || alquilerBruto === undefined) {
      return res.status(400).json({ 
        error: 'Campos requeridos: periodo, alquilerBruto' 
      });
    }

    const userId = req.user?.id || null;
    
    const liquidacion = await cuentaCorrienteService.generarLiquidacionPropietario({
      contratoId,
      periodo,
      alquilerBruto: parseFloat(alquilerBruto),
      honorariosInmob: parseFloat(honorariosInmob),
      gastosDeducibles: parseFloat(gastosDeducibles),
      otrasRetenciones: parseFloat(otrasRetenciones),
      observaciones,
      fecha: fecha ? new Date(fecha) : new Date(),
      userId
    });

    res.status(201).json(liquidacion);
  } catch (error) {
    console.error('Error al generar liquidación propietario:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/contratos/:id/cuenta-propietario/saldo
 * Obtiene el saldo actual de la cuenta del propietario
 */
async function getSaldoPropietario(req, res) {
  try {
    const contratoId = parseInt(req.params.id, 10);
    const saldo = await cuentaCorrienteService.getSaldoPropietario(contratoId);
    res.json(saldo);
  } catch (error) {
    console.error('Error al obtener saldo propietario:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/contratos/:id/cuenta-propietario/movimientos
 * Obtiene el historial de movimientos de la cuenta del propietario
 */
async function getMovimientosPropietario(req, res) {
  try {
    const contratoId = parseInt(req.params.id, 10);
    const { limit = 50, offset = 0 } = req.query;
    
    const movimientos = await cuentaCorrienteService.getMovimientosPropietario(
      contratoId, 
      { limit: parseInt(limit, 10), offset: parseInt(offset, 10) }
    );
    res.json(movimientos);
  } catch (error) {
    console.error('Error al obtener movimientos propietario:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/contratos/:id/liquidaciones-propietario
 * Obtiene las liquidaciones al propietario de un contrato
 */
async function getLiquidacionesPropietario(req, res) {
  try {
    const contratoId = parseInt(req.params.id, 10);
    const liquidaciones = await cuentaCorrienteService.getLiquidacionesPropietario(contratoId);
    res.json(liquidaciones);
  } catch (error) {
    console.error('Error al obtener liquidaciones propietario:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/pagos-propietario/pendientes
 * Obtiene todos los contratos con saldo a pagar al propietario
 * Query params: filtro = 'todos' | 'pendiente' | 'al_dia'
 */
async function getPagosPropietarioPendientes(req, res) {
  try {
    const filtro = req.query.filtro || 'pendiente';
    const contratos = await cuentaCorrienteService.getContratosPropietarioConSaldo(filtro);
    res.json(contratos);
  } catch (error) {
    console.error('Error al obtener pagos propietario pendientes:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// MEDIOS DE PAGO
// ============================================

/**
 * GET /api/medios-pago
 * Obtiene la lista de medios de pago disponibles
 */
async function getMediosPago(req, res) {
  try {
    const medios = await cuentaCorrienteService.getMediosPago();
    res.json(medios);
  } catch (error) {
    console.error('Error al obtener medios de pago:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/propiedades/:id/cuenta-propietario/movimientos
 * Obtiene los movimientos del propietario por propiedadId (sin contrato)
 */
async function getMovimientosPropietarioPropiedad(req, res) {
  try {
    const propiedadId = parseInt(req.params.id, 10);
    
    const movimientos = await prisma.movimientoCuentaPropietario.findMany({
      where: { 
        propiedadId,
        activo: true 
      },
      include: {
        tipoMovimiento: true,
        liquidacionPropietario: {
          select: { id: true, periodo: true, netoAPagar: true }
        },
        medioPago: true,
        propiedad: {
          select: {
            id: true,
            dirCalle: true,
            dirNro: true,
            dirPiso: true,
            dirDepto: true
          }
        }
      },
      orderBy: { fecha: 'desc' },
      take: 50
    });

    res.json(movimientos);
  } catch (error) {
    console.error('Error al obtener movimientos propietario (propiedad):', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/clientes/:id/cuenta-propietario/movimientos
 * Obtiene TODOS los movimientos de un propietario (de todas sus propiedades)
 */
async function getMovimientosPropietarioCliente(req, res) {
  try {
    const clienteId = parseInt(req.params.id, 10);
    
    // Buscar todas las propiedades donde este cliente es propietario
    const propiedadesCliente = await prisma.propiedadPropietario.findMany({
      where: { 
        propietarioId: clienteId,
        activo: true 
      },
      select: { propiedadId: true }
    });

    const propiedadIds = propiedadesCliente.map(pp => pp.propiedadId);

    if (propiedadIds.length === 0) {
      return res.json([]);
    }

    const movimientos = await prisma.movimientoCuentaPropietario.findMany({
      where: { 
        propiedadId: { in: propiedadIds },
        activo: true 
      },
      include: {
        tipoMovimiento: true,
        liquidacionPropietario: {
          select: { id: true, periodo: true, netoAPagar: true }
        },
        medioPago: true,
        propiedad: {
          select: {
            id: true,
            dirCalle: true,
            dirNro: true,
            dirPiso: true,
            dirDepto: true
          }
        }
      },
      orderBy: { fecha: 'desc' },
      take: 100
    });

    res.json(movimientos);
  } catch (error) {
    console.error('Error al obtener movimientos propietario (cliente):', error);
    res.status(500).json({ error: error.message });
  }
}

export {
  // Cobros inquilino
  registrarCobro,
  getSaldoInquilino,
  getMovimientosInquilino,
  getCobranzasPendientes,
  conciliarLiquidacionesPendientes,
  
  // Pagos propietario
  registrarPagoPropietario,
  generarLiquidacionPropietario,
  getSaldoPropietario,
  getMovimientosPropietario,
  getMovimientosPropietarioPropiedad,
  getMovimientosPropietarioCliente,
  getLiquidacionesPropietario,
  getPagosPropietarioPendientes,
  
  // Medios de pago
  getMediosPago
};
