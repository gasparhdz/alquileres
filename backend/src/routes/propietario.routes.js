import express from 'express';
import {
  getAllPropietarios,
  getPropietarioById,
  createPropietario,
  updatePropietario,
  deletePropietario
} from '../controllers/propietario.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAllPropietarios);
router.get('/:id', getPropietarioById);
router.post('/', createPropietario);
router.put('/:id', updatePropietario);
router.delete('/:id', deletePropietario);

export default router;

