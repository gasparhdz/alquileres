import express from 'express';
import rateLimit from 'express-rate-limit';
import { login, register, getCurrentUser, refresh, logout } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

const isProduction = process.env.NODE_ENV === 'production';

// Producción: anti fuerza bruta. Desarrollo: límite alto para no bloquear pruebas / reintentos.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 5 : 200,
  message: { error: 'Demasiados intentos de inicio de sesión. Por favor, inténtelo de nuevo después de 15 minutos.' },
  validate: { xForwardedForHeader: false }
});

router.post('/login', loginLimiter, login);
router.post('/register', register);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticateToken, getCurrentUser);

export default router;

