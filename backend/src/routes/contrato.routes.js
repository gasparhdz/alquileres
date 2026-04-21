import express from 'express';
import {
  getAllContratos,
  getContratoById,
  createContrato,
  updateContrato,
  deleteContrato,
  getContratosByUnidad,
  getContratosByInquilino,
  addResponsabilidad,
  updateResponsabilidad,
  deleteResponsabilidad,
  addGarantia,
  updateGarantia,
  deleteGarantia,
  addGastoInicial,
  updateGastoInicial,
  deleteGastoInicial
} from '../controllers/contrato.controller.js';
import {
  getContratoAjustes,
  getAjusteById,
  createAjuste,
  updateAjuste,
  deleteAjuste,
  generarAjusteAutomatico,
  registrarAjusteManual,
  calcularAjustesProyectados
} from '../controllers/contratoAjuste.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = express.Router();

router.use(authenticateToken);

// CRUD Contratos
router.get('/', requirePermission('contratos.ver'), getAllContratos);
router.get('/unidad/:unidadId', requirePermission('contratos.ver'), getContratosByUnidad);
router.get('/inquilino/:inquilinoId', requirePermission('contratos.ver'), getContratosByInquilino);
router.get('/:id', requirePermission('contratos.ver'), getContratoById);
router.post('/', requirePermission('contratos.crear'), createContrato);
router.put('/:id', requirePermission('contratos.editar'), updateContrato);
router.delete('/:id', requirePermission('contratos.eliminar'), deleteContrato);

// Ajustes de Contrato
router.get('/:id/ajustes', requirePermission('contrato.ajustes.ver'), getContratoAjustes);
router.get('/:id/ajustes/:ajusteId', requirePermission('contrato.ajustes.ver'), getAjusteById);
router.post('/:id/ajustes', requirePermission('contrato.ajustes.crear'), createAjuste);
router.put('/:id/ajustes/:ajusteId', requirePermission('contrato.ajustes.editar'), updateAjuste);
router.delete('/:id/ajustes/:ajusteId', requirePermission('contrato.ajustes.eliminar'), deleteAjuste);
router.post('/:id/ajustes/generar', requirePermission('contrato.ajustes.crear'), generarAjusteAutomatico);
router.post('/:id/ajustes/manual', requirePermission('contrato.ajustes.crear'), registrarAjusteManual);
router.post('/:id/ajustes/calcular', requirePermission('contrato.ajustes.ver'), calcularAjustesProyectados);

// Responsabilidades
router.post('/:id/responsabilidades', requirePermission('contrato.responsabilidades.crear'), addResponsabilidad);
router.put('/responsabilidades/:id', requirePermission('contrato.responsabilidades.editar'), updateResponsabilidad);
router.delete('/responsabilidades/:id', requirePermission('contrato.responsabilidades.eliminar'), deleteResponsabilidad);

// Garantías
router.post('/:id/garantias', requirePermission('contrato.garantias.crear'), addGarantia);
router.put('/garantias/:id', requirePermission('contrato.garantias.editar'), updateGarantia);
router.delete('/garantias/:id', requirePermission('contrato.garantias.eliminar'), deleteGarantia);

// Gastos iniciales
router.post('/:id/gastos-iniciales', requirePermission('contrato.gastos_iniciales.crear'), addGastoInicial);
router.put('/gastos-iniciales/:id', requirePermission('contrato.gastos_iniciales.editar'), updateGastoInicial);
router.delete('/gastos-iniciales/:id', requirePermission('contrato.gastos_iniciales.eliminar'), deleteGastoInicial);

export default router;

