import express from 'express';
import {
  getAllCatalogos,
  getCatalogoById,
  createCatalogo,
  updateCatalogo,
  deleteCatalogo
} from '../controllers/catalogoABM.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

// Rutas genéricas para todos los catálogos
router.get('/:tipo', getAllCatalogos);
router.get('/:tipo/:id', getCatalogoById);
router.post('/:tipo', createCatalogo);
router.put('/:tipo/:id', updateCatalogo);
router.delete('/:tipo/:id', deleteCatalogo);

export default router;

