import express from 'express';
import {
  getAllCampos,
  getCamposByTipoImpuesto,
  getCampoById,
  createCampo,
  updateCampo,
  deleteCampo
} from '../controllers/tipoImpuestoPropiedadCampo.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

// Obtener todos los campos (con filtros opcionales)
router.get('/', getAllCampos);

// Obtener campos por tipo de impuesto
router.get('/tipo-impuesto/:tipoImpuestoId', getCamposByTipoImpuesto);

// Obtener un campo por ID
router.get('/:id', getCampoById);

// Crear un nuevo campo
router.post('/', createCampo);

// Actualizar un campo
router.put('/:id', updateCampo);

// Eliminar un campo
router.delete('/:id', deleteCampo);

export default router;

