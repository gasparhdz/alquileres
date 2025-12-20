import express from 'express';
import {
  getAllCategorias,
  getCategoriaById,
  getParametrosByCategoria,
  getAllParametros,
  createParametro,
  updateParametro,
  deleteParametro
} from '../controllers/parametro.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/categorias', getAllCategorias);
router.get('/categorias/:codigo/parametros', getParametrosByCategoria);
router.get('/categorias/:id', getCategoriaById);
router.get('/parametros', getAllParametros);
router.post('/parametros', createParametro);
router.put('/parametros/:id', updateParametro);
router.delete('/parametros/:id', deleteParametro);

export default router;
