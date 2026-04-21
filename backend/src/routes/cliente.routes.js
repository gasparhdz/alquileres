import express from 'express';
import { checkDocumento } from '../controllers/cliente.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/check-documento', checkDocumento);

export default router;
