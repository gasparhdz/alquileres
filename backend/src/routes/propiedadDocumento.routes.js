import express from 'express';
import {
  getDocumentosByUnidad,
  upsertDocumentosUnidad,
  deleteDocumento
} from '../controllers/propiedadDocumento.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/unidad/:unidadId', getDocumentosByUnidad);
router.post('/unidad/:unidadId', upsertDocumentosUnidad);
router.delete('/:id', deleteDocumento);

export default router;

