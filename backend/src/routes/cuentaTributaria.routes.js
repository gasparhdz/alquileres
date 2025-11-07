import express from 'express';
import {
  getAllCuentasTributarias,
  getCuentaTributariaById,
  createCuentaTributaria,
  updateCuentaTributaria,
  deleteCuentaTributaria,
  getCuentasByUnidad
} from '../controllers/cuentaTributaria.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAllCuentasTributarias);
router.get('/unidad/:unidadId', getCuentasByUnidad);
router.get('/:id', getCuentaTributariaById);
router.post('/', createCuentaTributaria);
router.put('/:id', updateCuentaTributaria);
router.delete('/:id', deleteCuentaTributaria);

export default router;

