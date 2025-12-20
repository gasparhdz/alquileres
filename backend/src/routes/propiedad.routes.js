import express from 'express';
import {
  getAllPropiedades,
  getPropiedadById,
  createPropiedad,
  updatePropiedad,
  deletePropiedad
} from '../controllers/propiedad.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAllPropiedades);
router.get('/:id', getPropiedadById);
router.post('/', createPropiedad);
router.put('/:id', updatePropiedad);
router.delete('/:id', deletePropiedad);

export default router;

