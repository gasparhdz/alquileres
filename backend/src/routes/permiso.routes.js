import express from 'express';
import { getPermisos, getPermisoById, createPermiso, updatePermiso, deletePermiso } from '../controllers/permiso.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/', getPermisos);
router.get('/:id', getPermisoById);
router.post('/', createPermiso);
router.put('/:id', updatePermiso);
router.delete('/:id', deletePermiso);

export default router;
