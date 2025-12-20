import express from 'express';
import {
  getCamposByPropiedadCargo,
  saveCamposPropiedadCargo
} from '../controllers/propiedadCargoCampo.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/propiedad-cargo/:propiedadCargoId', getCamposByPropiedadCargo);
router.post('/propiedad-cargo/:propiedadCargoId', saveCamposPropiedadCargo);

export default router;

