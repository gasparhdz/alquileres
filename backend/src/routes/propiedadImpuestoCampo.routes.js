import express from 'express';
import {
  getCamposByPropiedadImpuesto,
  saveCamposPropiedadImpuesto
} from '../controllers/propiedadImpuestoCampo.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/propiedad-impuesto/:propiedadImpuestoId', getCamposByPropiedadImpuesto);
router.post('/propiedad-impuesto/:propiedadImpuestoId', saveCamposPropiedadImpuesto);

export default router;

