import express from 'express';
import {
  getAllInquilinos,
  getInquilinoById,
  createInquilino,
  updateInquilino,
  deleteInquilino
} from '../controllers/inquilino.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAllInquilinos);
router.get('/:id', getInquilinoById);
router.post('/', createInquilino);
router.put('/:id', updateInquilino);
router.delete('/:id', deleteInquilino);

export default router;

