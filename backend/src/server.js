import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

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
import propiedadImpuestoRoutes from './routes/propiedadImpuesto.routes.js';
import propiedadCargoRoutes from './routes/propiedadCargo.routes.js';
import tipoImpuestoPropiedadCampoRoutes from './routes/tipoImpuestoPropiedadCampo.routes.js';
import propiedadImpuestoCampoRoutes from './routes/propiedadImpuestoCampo.routes.js';
import tipoCargoCampoRoutes from './routes/tipoCargoCampo.routes.js';
import propiedadCargoCampoRoutes from './routes/propiedadCargoCampo.routes.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

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
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/propiedad-impuestos', propiedadImpuestoRoutes);
app.use('/api/propiedad-cargos', propiedadCargoRoutes);
app.use('/api/tipos-impuesto-propiedad-campos', tipoImpuestoPropiedadCampoRoutes);
app.use('/api/propiedad-impuesto-campos', propiedadImpuestoCampoRoutes);
app.use('/api/tipos-cargo-campos', tipoCargoCampoRoutes);
app.use('/api/propiedad-cargo-campos', propiedadCargoCampoRoutes);

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Sistema de Alquileres API' });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🌐 Accesible desde la red en: http://[TU_IP_LOCAL]:${PORT}`);
  console.log(`   Ejecuta 'ipconfig' (Windows) o 'ifconfig' (Linux/Mac) para ver tu IP local`);
});

// Manejo de cierre graceful
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default app;

