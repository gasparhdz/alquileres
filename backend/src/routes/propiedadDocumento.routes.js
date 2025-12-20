import express from 'express';
import {
  getDocumentosByPropiedad,
  upsertDocumentosPropiedad,
  deleteDocumento
} from '../controllers/propiedadDocumento.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/propiedad/:propiedadId', getDocumentosByPropiedad);
router.post('/propiedad/:propiedadId', upsertDocumentosPropiedad);
router.delete('/:id', deleteDocumento);

export default router;

