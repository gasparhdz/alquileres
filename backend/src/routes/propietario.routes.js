import express from 'express';
import {
  getAllPropietarios,
  getPropietarioById,
  createPropietario,
  updatePropietario,
  deletePropietario,
  asociarPropiedades,
  desasociarPropiedad
} from '../controllers/propietario.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', requirePermission('propietarios.ver'), getAllPropietarios);
router.get('/:id', requirePermission('propietarios.ver'), getPropietarioById);
router.post('/', requirePermission('propietarios.crear'), createPropietario);
router.put('/:id', requirePermission('propietarios.editar'), updatePropietario);
router.delete('/:id', requirePermission('propietarios.eliminar'), deletePropietario);
router.post('/:id/propiedades', requirePermission('propietarios.editar'), asociarPropiedades);
router.delete('/:id/propiedades/:propiedadId', requirePermission('propietarios.editar'), desasociarPropiedad);

export default router;

