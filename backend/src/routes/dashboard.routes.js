import express from 'express';
import { getAjustesPendientes } from '../controllers/dashboard.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/ajustes-pendientes', getAjustesPendientes);

export default router;
