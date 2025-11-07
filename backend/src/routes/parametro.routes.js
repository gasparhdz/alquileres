import express from 'express';
import {
  getAllCategorias,
  getCategoriaById,
  getParametrosByCategoria,
  getAllParametros
} from '../controllers/parametro.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/categorias', getAllCategorias);
router.get('/categorias/:id', getCategoriaById);
router.get('/categorias/:codigo/parametros', getParametrosByCategoria);
router.get('/parametros', getAllParametros);

export default router;
