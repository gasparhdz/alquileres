import express from 'express';
import {
  getAllPropiedades,
  getPropiedadById,
  createPropiedad,
  updatePropiedad,
  deletePropiedad
} from '../controllers/propiedad.controller.js';
import {
  listSegurosPropiedad,
  createSeguroPropiedad,
  updateSeguroPropiedad,
  deleteSeguroPropiedad
} from '../controllers/propiedadSeguro.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', requirePermission('propiedades.ver'), getAllPropiedades);
router.get('/:id/seguros', requirePermission('propiedades.ver'), listSegurosPropiedad);
router.post('/:id/seguros', requirePermission('propiedades.editar'), createSeguroPropiedad);
router.put('/:id/seguros/:seguroId', requirePermission('propiedades.editar'), updateSeguroPropiedad);
router.delete('/:id/seguros/:seguroId', requirePermission('propiedades.editar'), deleteSeguroPropiedad);
router.get('/:id', requirePermission('propiedades.ver'), getPropiedadById);
router.post('/', requirePermission('propiedades.crear'), createPropiedad);
router.put('/:id', requirePermission('propiedades.editar'), updatePropiedad);
router.delete('/:id', requirePermission('propiedades.eliminar'), deletePropiedad);

export default router;

