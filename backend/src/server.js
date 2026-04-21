import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import prisma from './db/prisma.js';
import logger from './utils/logger.js';

const isProduction = process.env.NODE_ENV === 'production';

// Limitador global para /api (en desarrollo mucho más alto para evitar 429 con HMR, pruebas, etc.)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 1000 : 50000,
  message: { error: 'Demasiadas peticiones. Intente de nuevo más tarde.' }
});

// Importar rutas
import authRoutes from './routes/auth.routes.js';
import inquilinoRoutes from './routes/inquilino.routes.js';
import propietarioRoutes from './routes/propietario.routes.js';
import unidadRoutes from './routes/unidad.routes.js';
import propiedadRoutes from './routes/propiedad.routes.js';
import cuentaTributariaRoutes from './routes/cuentaTributaria.routes.js';
import contratoRoutes from './routes/contrato.routes.js';
import liquidacionRoutes from './routes/liquidacion.routes.js';
import parametroRoutes from './routes/parametro.routes.js';
import indiceRoutes from './routes/indice.routes.js';
import ajusteRoutes from './routes/ajuste.routes.js';
import propiedadDocumentoRoutes from './routes/propiedadDocumento.routes.js';
import catalogoRoutes from './routes/catalogo.routes.js';
import catalogoABMRoutes from './routes/catalogoABM.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import propiedadImpuestoRoutes from './routes/propiedadImpuesto.routes.js';
import propiedadCargoRoutes from './routes/propiedadCargo.routes.js';
import tipoImpuestoPropiedadCampoRoutes from './routes/tipoImpuestoPropiedadCampo.routes.js';
import propiedadImpuestoCampoRoutes from './routes/propiedadImpuestoCampo.routes.js';
import tipoCargoCampoRoutes from './routes/tipoCargoCampo.routes.js';
import propiedadCargoCampoRoutes from './routes/propiedadCargoCampo.routes.js';
import cuentaCorrienteRoutes from './routes/cuentaCorriente.routes.js';
import searchRoutes from './routes/search.routes.js';
import clienteRoutes from './routes/cliente.routes.js';
import usuarioRoutes from './routes/usuario.routes.js';
import rolRoutes from './routes/rol.routes.js';
import permisoRoutes from './routes/permiso.routes.js';
import consorcioRoutes from './routes/consorcio.routes.js';

dotenv.config();

const app = express();

// Middlewares
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Permitir localhost y cualquier IP de la red local
    const allowedOrigins = [
      'http://localhost:5173',
      /^http:\/\/192\.168\.\d+\.\d+:5173$/,
      /^http:\/\/10\.\d+\.\d+\.\d+:5173$/,
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:5173$/
    ];
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      }
      return allowed.test(origin);
    });
    
    if (isAllowed || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Necesario para cookies HttpOnly
}));
app.use(cookieParser()); // Parsear cookies HttpOnly
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/', generalLimiter);

// Ruta de salud (antes de rutas que montan en /api para no ser capturada por cuentaCorriente)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Sistema de Alquileres API' });
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/inquilinos', inquilinoRoutes);
app.use('/api/propietarios', propietarioRoutes);
app.use('/api/unidades', unidadRoutes);
app.use('/api/propiedades', propiedadRoutes);
app.use('/api/cuentas', cuentaTributariaRoutes);
app.use('/api/contratos', contratoRoutes);
app.use('/api/liquidaciones', liquidacionRoutes);
app.use('/api/parametros', parametroRoutes);
app.use('/api/indices', indiceRoutes);
app.use('/api/ajustes', ajusteRoutes);
app.use('/api/documentos-propiedad', propiedadDocumentoRoutes);
app.use('/api/catalogos', catalogoRoutes);
app.use('/api/catalogos-abm', catalogoABMRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/propiedad-impuestos', propiedadImpuestoRoutes);
app.use('/api/propiedad-cargos', propiedadCargoRoutes);
app.use('/api/tipos-impuesto-propiedad-campos', tipoImpuestoPropiedadCampoRoutes);
app.use('/api/propiedad-impuesto-campos', propiedadImpuestoCampoRoutes);
app.use('/api/tipos-cargo-campos', tipoCargoCampoRoutes);
app.use('/api/propiedad-cargo-campos', propiedadCargoCampoRoutes);
app.use('/api', cuentaCorrienteRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/roles', rolRoutes);
app.use('/api/permisos', permisoRoutes);
app.use('/api/consorcios', consorcioRoutes);

// Global Error Handler (último app.use: persiste excepciones y responde genérico)
app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: 'Ocurrió un error interno en el servidor.'
    });
  }
});

// Iniciar servidor (no arrancar en test para que supertest use solo la app)
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

// Manejo de cierre graceful
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default app;

