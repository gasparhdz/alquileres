import jwt from 'jsonwebtoken';
import prisma from '../db/prisma.js';

/**
 * Middleware de autenticación que verifica el JWT y que la cuenta y rol sigan activos.
 * Prioridad: 1) Cookie httpOnly, 2) Header Authorization (para compatibilidad)
 */
export const authenticateToken = async (req, res, next) => {
  // Prioridad 1: Leer token de la cookie httpOnly
  let token = req.cookies?.accessToken;

  // Prioridad 2: Fallback al header Authorization (para APIs externas/testing)
  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  }

  if (!token) {
    return res.status(401).json({
      error: 'Token de acceso requerido',
      code: 'TOKEN_MISSING'
    });
  }

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(401).json({
      error: 'Token inválido',
      code: 'TOKEN_INVALID'
    });
  }

  const dbUser = await prisma.usuario.findUnique({
    where: { id: user.id },
    include: { roles: { include: { rol: true } } }
  });

  const hasActiveRol = dbUser?.roles?.some((ur) => ur.rol?.activo);
  if (!dbUser || dbUser.activo === false || !hasActiveRol) {
    return res.status(403).json({
      error: 'La cuenta se encuentra desactivada',
      code: 'ACCOUNT_DISABLED'
    });
  }

  req.user = user;
  next();
};
