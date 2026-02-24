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

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAllContratos);
router.get('/unidad/:unidadId', getContratosByUnidad);
router.get('/inquilino/:inquilinoId', getContratosByInquilino);
router.get('/:id', getContratoById);
router.get('/:id/ajustes', getContratoAjustes);
router.get('/:id/ajustes/:ajusteId', getAjusteById);
router.post('/:id/ajustes', createAjuste);
router.put('/:id/ajustes/:ajusteId', updateAjuste);
router.delete('/:id/ajustes/:ajusteId', deleteAjuste);
router.post('/:id/ajustes/generar', generarAjusteAutomatico);
router.post('/:id/ajustes/manual', registrarAjusteManual);
router.post('/:id/ajustes/calcular', calcularAjustesProyectados);
router.post('/', createContrato);
router.put('/:id', updateContrato);
router.delete('/:id', deleteContrato);

// Responsabilidades
router.post('/:id/responsabilidades', addResponsabilidad);
router.put('/responsabilidades/:id', updateResponsabilidad);
router.delete('/responsabilidades/:id', deleteResponsabilidad);

// Garantías
router.post('/:id/garantias', addGarantia);
router.put('/garantias/:id', updateGarantia);
router.delete('/garantias/:id', deleteGarantia);

// Gastos iniciales
router.post('/:id/gastos-iniciales', addGastoInicial);
router.put('/gastos-iniciales/:id', updateGastoInicial);
router.delete('/gastos-iniciales/:id', deleteGastoInicial);

export default router;

