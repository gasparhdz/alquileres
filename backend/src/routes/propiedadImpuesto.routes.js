import express from 'express';
import {
  getImpuestosByPropiedad,
  saveImpuestosPropiedad
} from '../controllers/propiedadImpuesto.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/propiedad/:propiedadId', requirePermission('propiedad.servicios.ver'), getImpuestosByPropiedad);
router.post('/propiedad/:propiedadId', requirePermission('propiedad.servicios.editar'), saveImpuestosPropiedad);

export default router;

