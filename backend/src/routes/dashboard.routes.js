import express from 'express';
import { 
  getAjustesPendientes, 
  getContratosPorVencer, 
  getCobranzaCritica,
  getLiquidacionesPendientes,
  getPropiedadesVacantes,
  getPagosPropietariosPendientes
} from '../controllers/dashboard.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/ajustes-pendientes', getAjustesPendientes);
router.get('/contratos-por-vencer', getContratosPorVencer);
router.get('/cobranza-critica', getCobranzaCritica);
router.get('/liquidaciones-pendientes', getLiquidacionesPendientes);
router.get('/propiedades-vacantes', getPropiedadesVacantes);
router.get('/pagos-propietarios-pendientes', getPagosPropietariosPendientes);

export default router;
