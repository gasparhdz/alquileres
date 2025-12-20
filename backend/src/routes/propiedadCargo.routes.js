import express from 'express';
import {
  getCargosByPropiedad,
  saveCargosPropiedad
} from '../controllers/propiedadCargo.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/propiedad/:propiedadId', getCargosByPropiedad);
router.post('/propiedad/:propiedadId', saveCargosPropiedad);

export default router;

