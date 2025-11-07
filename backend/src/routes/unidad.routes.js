import express from 'express';
import {
  getAllUnidades,
  getUnidadById,
  createUnidad,
  updateUnidad,
  deleteUnidad
} from '../controllers/unidad.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAllUnidades);
router.get('/:id', getUnidadById);
router.post('/', createUnidad);
router.put('/:id', updateUnidad);
router.delete('/:id', deleteUnidad);

export default router;

