import express from 'express';
import {
  getImpuestosByPropiedad,
  saveImpuestosPropiedad
} from '../controllers/propiedadImpuesto.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/propiedad/:propiedadId', getImpuestosByPropiedad);
router.post('/propiedad/:propiedadId', saveImpuestosPropiedad);

export default router;

