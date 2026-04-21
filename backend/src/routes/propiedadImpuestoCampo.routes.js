import express from 'express';
import {
  getCamposByPropiedadImpuesto,
  saveCamposPropiedadImpuesto
} from '../controllers/propiedadImpuestoCampo.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/propiedad-impuesto/:propiedadImpuestoId', requirePermission('propiedad.servicios.ver'), getCamposByPropiedadImpuesto);
router.post('/propiedad-impuesto/:propiedadImpuestoId', requirePermission('propiedad.servicios.editar'), saveCamposPropiedadImpuesto);

export default router;

