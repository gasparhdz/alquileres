import express from 'express';
import { listIndices, createIndice, syncIPC } from '../controllers/indiceAjuste.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', listIndices);
router.post('/', createIndice);
router.post('/sync/ipc', syncIPC);

export default router;

