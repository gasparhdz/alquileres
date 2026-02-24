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
  completarImporteItem,
  getBoletaInquilino,
  crearIncidencia
} from '../controllers/liquidacion.controller.js';
import { autocompletarAssa } from '../controllers/assa.controller.js';
import { autocompletarEpe } from '../controllers/epe.controller.js';
import { autocompletarLitoralgas } from '../controllers/litoralgas.controller.js';
import { autocompletarSiat } from '../controllers/siat.controller.js';
import { autocompletarSantafeEInBoletas, parseTestSantafeEInBoletas } from '../controllers/santafe.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAllLiquidaciones);
router.get('/pendientes-items', getPendientesItems);
router.get('/impuestos-pendientes', getImpuestosPendientes);
router.get('/boleta-inquilino', getBoletaInquilino);
router.post('/cron/generar', generarLiquidacionesAutomaticas);
router.post('/impuestos/generar', generarImpuestos);
router.post('/impuestos/assa/autocompletar', autocompletarAssa);
router.post('/impuestos/epe/autocompletar', autocompletarEpe);
router.post('/impuestos/litoralgas/autocompletar', autocompletarLitoralgas);
router.post('/impuestos/siat/autocompletar', autocompletarSiat);
router.post('/impuestos/santafe-ein-boletas/autocompletar', autocompletarSantafeEInBoletas);
router.post('/impuestos/santafe-ein-boletas/parse-test', parseTestSantafeEInBoletas);
router.post('/incidencias', crearIncidencia);
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

