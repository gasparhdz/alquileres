import express from 'express';
import {
  getCamposByPropiedadCargo,
  saveCamposPropiedadCargo
} from '../controllers/propiedadCargoCampo.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/propiedad-cargo/:propiedadCargoId', requirePermission('propiedad.servicios.ver'), getCamposByPropiedadCargo);
router.post('/propiedad-cargo/:propiedadCargoId', requirePermission('propiedad.servicios.editar'), saveCamposPropiedadCargo);

export default router;

