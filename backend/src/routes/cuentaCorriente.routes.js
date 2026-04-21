import express from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import * as cuentaCorrienteController from '../controllers/cuentaCorriente.controller.js';

const router = express.Router();
router.use(authenticateToken);

// ============================================
// MEDIOS DE PAGO (catálogo auxiliar, no necesita permiso específico)
// ============================================
router.get('/medios-pago', cuentaCorrienteController.getMediosPago);

// ============================================
// COBROS (INQUILINOS)
// ============================================
router.post('/cobros', requirePermission('movimiento.inquilinos.crear'), cuentaCorrienteController.registrarCobro);
router.get('/cobranzas/pendientes', requirePermission('movimiento.inquilinos.ver'), cuentaCorrienteController.getCobranzasPendientes);

// ============================================
// PAGOS A PROPIETARIOS
// ============================================
router.post('/pagos-propietario', requirePermission('movimiento.propietarios.crear'), cuentaCorrienteController.registrarPagoPropietario);
router.get('/pagos-propietario/pendientes', requirePermission('movimiento.propietarios.ver'), cuentaCorrienteController.getPagosPropietarioPendientes);

// ============================================
// CUENTA CORRIENTE POR CONTRATO
// ============================================
// Inquilino
router.get('/contratos/:id/cuenta-inquilino/saldo', requirePermission('movimiento.inquilinos.ver'), cuentaCorrienteController.getSaldoInquilino);
router.get('/contratos/:id/cuenta-inquilino/movimientos', requirePermission('movimiento.inquilinos.ver'), cuentaCorrienteController.getMovimientosInquilino);
router.post('/contratos/:id/conciliar-liquidaciones', requirePermission('movimiento.inquilinos.crear'), cuentaCorrienteController.conciliarLiquidacionesPendientes);

// Propietario (por contrato)
router.get('/contratos/:id/cuenta-propietario/saldo', requirePermission('movimiento.propietarios.ver'), cuentaCorrienteController.getSaldoPropietario);
router.get('/contratos/:id/cuenta-propietario/movimientos', requirePermission('movimiento.propietarios.ver'), cuentaCorrienteController.getMovimientosPropietario);
router.get('/contratos/:id/liquidaciones-propietario', requirePermission('movimiento.propietarios.ver'), cuentaCorrienteController.getLiquidacionesPropietario);
router.post('/contratos/:id/liquidacion-propietario', requirePermission('movimiento.propietarios.crear'), cuentaCorrienteController.generarLiquidacionPropietario);

// ============================================
// CUENTA CORRIENTE POR PROPIEDAD (sin contrato)
// ============================================
router.get('/propiedades/:id/cuenta-propietario/movimientos', requirePermission('movimiento.propietarios.ver'), cuentaCorrienteController.getMovimientosPropietarioPropiedad);

// ============================================
// CUENTA CORRIENTE POR CLIENTE (propietario - todas sus propiedades)
// ============================================
router.get('/clientes/:id/cuenta-propietario/movimientos', requirePermission('movimiento.propietarios.ver'), cuentaCorrienteController.getMovimientosPropietarioCliente);

export default router;


