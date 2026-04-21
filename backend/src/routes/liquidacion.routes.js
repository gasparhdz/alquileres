import express from 'express';
import {
  getAllLiquidaciones,
  getLiquidacionById,
  getUltimasLiquidacionesPorCliente,
  createLiquidacion,
  updateLiquidacion,
  deleteLiquidacion,
  generateLiquidacion,
  emitirLiquidacion,
  cobrarLiquidacion,
  generatePDF,
  generarLiquidacionesAutomaticas,
  generarLiquidacionesPeriodo,
  getPendientesItems,
  completarItem,
  reabrirItem,
  generarImpuestos,
  getImpuestosPendientes,
  completarImporteItem,
  completarImportesBatch,
  getBoletaInquilino,
  crearIncidencia
} from '../controllers/liquidacion.controller.js';
import { autocompletarAssa } from '../controllers/assa.controller.js';
import { autocompletarEpe } from '../controllers/epe.controller.js';
import { autocompletarLitoralgas } from '../controllers/litoralgas.controller.js';
import { autocompletarSiat } from '../controllers/siat.controller.js';
import { autocompletarSantafeEInBoletas, parseTestSantafeEInBoletas } from '../controllers/santafe.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = express.Router();

router.use(authenticateToken);

// Impuestos e Incidencias (rutas estáticas — DEBEN ir antes de /:id)
router.get('/pendientes-items', requirePermission('impuestos.ver'), getPendientesItems);
router.get('/impuestos-pendientes', requirePermission('impuestos.ver'), getImpuestosPendientes);
router.post('/impuestos/generar', requirePermission('impuestos.crear'), generarImpuestos);
router.post('/incidencias', requirePermission('impuestos.crear'), crearIncidencia);
router.patch('/liquidacion-items/:id', requirePermission('impuestos.editar'), completarImporteItem);
router.post('/items/batch-completar', requirePermission('impuestos.editar'), completarImportesBatch);
router.post('/items/:id/completar', requirePermission('impuestos.editar'), completarItem);
router.post('/items/:id/reabrir', requirePermission('impuestos.editar'), reabrirItem);

// Scrapers / Autocompletado
router.post('/impuestos/assa/autocompletar', requirePermission('impuestos.editar'), autocompletarAssa);
router.post('/impuestos/epe/autocompletar', requirePermission('impuestos.editar'), autocompletarEpe);
router.post('/impuestos/litoralgas/autocompletar', requirePermission('impuestos.editar'), autocompletarLitoralgas);
router.post('/impuestos/siat/autocompletar', requirePermission('impuestos.editar'), autocompletarSiat);
router.post('/impuestos/santafe-ein-boletas/autocompletar', requirePermission('impuestos.editar'), autocompletarSantafeEInBoletas);
router.post('/impuestos/santafe-ein-boletas/parse-test', requirePermission('impuestos.editar'), parseTestSantafeEInBoletas);

// Liquidaciones CRUD (rutas estáticas primero, luego dinámicas con /:id)
router.get('/', requirePermission('liquidaciones.ver'), getAllLiquidaciones);
router.get('/cliente/:id', requirePermission('liquidaciones.ver'), getUltimasLiquidacionesPorCliente);
router.get('/boleta-inquilino', requirePermission('liquidaciones.ver'), getBoletaInquilino);
router.post('/', requirePermission('liquidaciones.crear'), createLiquidacion);
router.post('/generar', requirePermission('liquidaciones.crear'), generateLiquidacion);
router.post('/cron/generar', requirePermission('liquidaciones.crear'), generarLiquidacionesAutomaticas);
router.post('/generar-periodo', requirePermission('liquidaciones.crear'), generarLiquidacionesPeriodo);

// Rutas dinámicas con /:id (DEBEN ir al final)
router.get('/:id', requirePermission('liquidaciones.ver'), getLiquidacionById);
router.get('/:id/pdf', requirePermission('liquidaciones.ver'), generatePDF);
router.put('/:id', requirePermission('liquidaciones.editar'), updateLiquidacion);
router.put('/:id/emitir', requirePermission('liquidaciones.editar'), emitirLiquidacion);
router.post('/:id/cobrar', requirePermission('liquidaciones.editar'), cobrarLiquidacion);
router.delete('/:id', requirePermission('liquidaciones.eliminar'), deleteLiquidacion);

export default router;

