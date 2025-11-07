import express from 'express';
import {
  getAllLiquidaciones,
  getLiquidacionById,
  createLiquidacion,
  updateLiquidacion,
  deleteLiquidacion,
  generateLiquidacion,
  emitirLiquidacion,
  generatePDF
} from '../controllers/liquidacion.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAllLiquidaciones);
router.get('/:id', getLiquidacionById);
router.post('/', createLiquidacion);
router.post('/generar', generateLiquidacion);
router.put('/:id', updateLiquidacion);
router.put('/:id/emitir', emitirLiquidacion);
router.delete('/:id', deleteLiquidacion);
router.get('/:id/pdf', generatePDF);

export default router;

