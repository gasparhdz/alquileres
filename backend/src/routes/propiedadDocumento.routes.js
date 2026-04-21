import express from 'express';
import {
  getDocumentosByPropiedad,
  upsertDocumentosPropiedad,
  deleteDocumento
} from '../controllers/propiedadDocumento.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/propiedad/:propiedadId', requirePermission('propiedad.documentos.ver'), getDocumentosByPropiedad);
router.post('/propiedad/:propiedadId', requirePermission('propiedad.documentos.crear'), upsertDocumentosPropiedad);
router.delete('/:id', requirePermission('propiedad.documentos.eliminar'), deleteDocumento);

export default router;

