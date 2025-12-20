import express from 'express';
import {
  getAllLiquidaciones,
  getLiquidacionById,
  createLiquidacion,
  updateLiquidacion,
  deleteLiquidacion,
  generateLiquidacion,
  emitirLiquidacion,
  generatePDF,
  generarLiquidacionesAutomaticas,
  getPendientesItems,
  completarItem,
  reabrirItem,
  generarImpuestos,
  getImpuestosPendientes,
  completarImporteItem
} from '../controllers/liquidacion.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAllLiquidaciones);
router.get('/pendientes-items', getPendientesItems);
router.get('/impuestos-pendientes', getImpuestosPendientes);
router.post('/cron/generar', generarLiquidacionesAutomaticas);
router.post('/impuestos/generar', generarImpuestos);
router.patch('/liquidacion-items/:id', completarImporteItem);
router.get('/:id', getLiquidacionById);
router.post('/', createLiquidacion);
router.post('/generar', generateLiquidacion);
router.post('/items/:id/completar', completarItem);
router.post('/items/:id/reabrir', reabrirItem);
router.put('/:id', updateLiquidacion);
router.put('/:id/emitir', emitirLiquidacion);
router.delete('/:id', deleteLiquidacion);
router.get('/:id/pdf', generatePDF);

export default router;

