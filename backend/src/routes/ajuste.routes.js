import express from 'express';
import { getAjustesProximos } from '../controllers/contratoAjuste.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/proximos', getAjustesProximos);

export default router;

