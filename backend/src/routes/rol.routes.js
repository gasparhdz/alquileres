import express from 'express';
import { getRoles, getRolById, createRol, updateRol, deleteRol } from '../controllers/rol.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/', getRoles);
router.get('/:id', getRolById);
router.post('/', createRol);
router.put('/:id', updateRol);
router.delete('/:id', deleteRol);

export default router;
