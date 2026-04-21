import express from 'express';
import {
  listConsorcios,
  getConsorcioById,
  createConsorcio,
  updateConsorcio,
  deleteConsorcio,
} from '../controllers/consorcio.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get(
  '/',
  requirePermission(['consorcios.ver', 'propiedades.ver', 'propiedades.editar', 'propiedades.crear']),
  listConsorcios
);
router.get(
  '/:id',
  requirePermission(['consorcios.ver', 'propiedades.ver', 'propiedades.editar', 'propiedades.crear']),
  getConsorcioById
);
router.post('/', requirePermission('consorcios.crear'), createConsorcio);
router.put('/:id', requirePermission('consorcios.editar'), updateConsorcio);
router.delete('/:id', requirePermission('consorcios.eliminar'), deleteConsorcio);

export default router;
