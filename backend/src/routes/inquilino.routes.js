import express from 'express';
import {
  getAllInquilinos,
  getInquilinoById,
  createInquilino,
  updateInquilino,
  deleteInquilino
} from '../controllers/inquilino.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', requirePermission('inquilinos.ver'), getAllInquilinos);
router.get('/:id', requirePermission('inquilinos.ver'), getInquilinoById);
router.post('/', requirePermission('inquilinos.crear'), createInquilino);
router.put('/:id', requirePermission('inquilinos.editar'), updateInquilino);
router.delete('/:id', requirePermission('inquilinos.eliminar'), deleteInquilino);

export default router;

