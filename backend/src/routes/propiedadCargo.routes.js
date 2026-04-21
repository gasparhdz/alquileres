import express from 'express';
import {
  getCargosByPropiedad,
  saveCargosPropiedad
} from '../controllers/propiedadCargo.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/propiedad/:propiedadId', requirePermission('propiedad.servicios.ver'), getCargosByPropiedad);
router.post('/propiedad/:propiedadId', requirePermission('propiedad.servicios.editar'), saveCargosPropiedad);

export default router;

