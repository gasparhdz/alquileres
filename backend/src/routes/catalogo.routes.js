import express from 'express';
import {
  getTiposPersona,
  getProvincias,
  getLocalidades,
  getLocalidadesByProvincia,
  getCondicionesIva,
  getTiposPropiedad,
  getEstadosPropiedad,
  getDestinosPropiedad,
  getAmbientesPropiedad
} from '../controllers/catalogo.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/tipos-persona', getTiposPersona);
router.get('/provincias', getProvincias);
router.get('/localidades', getLocalidades);
router.get('/provincias/:provinciaId/localidades', getLocalidadesByProvincia);
router.get('/condiciones-iva', getCondicionesIva);
router.get('/tipos-propiedad', getTiposPropiedad);
router.get('/estados-propiedad', getEstadosPropiedad);
router.get('/destinos-propiedad', getDestinosPropiedad);
router.get('/ambientes-propiedad', getAmbientesPropiedad);

export default router;

