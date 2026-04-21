import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../db/prisma.js';

// Configuración de tokens
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// Configuración de cookies
const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  path: '/'
};

/**
 * Genera un access token JWT de vida corta
 */
function generateAccessToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      nombre: user.nombre
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Genera un refresh token único y lo guarda en la base de datos
 */
async function generateRefreshToken(userId) {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
  
  // Guardar en la base de datos
  await prisma.refreshToken.create({
    data: {
      token,
      usuarioId: userId,
      expiresAt
    }
  });
  
  return { token, expiresAt };
}

/**
 * Configura las cookies de autenticación en la respuesta
 */
function setAuthCookies(res, accessToken, refreshToken, refreshExpiresAt) {
  // Cookie del access token (15 minutos)
  res.cookie('accessToken', accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000 // 15 minutos en ms
  });
  
  // Cookie del refresh token (7 días)
  res.cookie('refreshToken', refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
    path: '/api/auth' // Solo se envía a rutas de auth
  });
}

/**
 * Limpia las cookies de autenticación
 */
function clearAuthCookies(res) {
  res.cookie('accessToken', '', { ...COOKIE_OPTIONS, maxAge: 0 });
  res.cookie('refreshToken', '', { ...COOKIE_OPTIONS, maxAge: 0, path: '/api/auth' });
}

/**
 * POST /api/auth/login
 * Autentica al usuario y establece cookies HttpOnly
 */
export const login = async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('Login: JWT_SECRET no está definido en .env');
      return res.status(500).json({ error: 'Configuración del servidor incompleta. Contacte al administrador.' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            rol: {
              include: {
                permisos: {
                  include: { permiso: true }
                }
              }
            }
          }
        }
      }
    });

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const passwordValid = await bcrypt.compare(password, usuario.passwordHash);

    if (!passwordValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const permisos = [...new Set(
      usuario.roles.flatMap(ur =>
        ur.rol.permisos.map(rp => rp.permiso.codigo)
      )
    )];

    // Generar tokens
    const accessToken = generateAccessToken(usuario);
    const { token: refreshToken, expiresAt } = await generateRefreshToken(usuario.id);
    
    // Establecer cookies HttpOnly
    setAuthCookies(res, accessToken, refreshToken, expiresAt);

    // Respuesta sin tokens en el body (solo datos del usuario)
    res.json({
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        roles: usuario.roles.map(ur => ur.rol.codigo),
        permisos
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    const message = process.env.NODE_ENV === 'development' ? (error.message || 'Error al iniciar sesión') : 'Error al iniciar sesión';
    res.status(500).json({ error: message });
  }
};

/**
 * POST /api/auth/refresh
 * Renueva el access token usando el refresh token
 */
export const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token no proporcionado' });
    }
    
    // Buscar el refresh token en la base de datos
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { usuario: true }
    });
    
    if (!storedToken) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Refresh token inválido' });
    }
    
    // Verificar si el token está expirado
    if (new Date() > storedToken.expiresAt) {
      // Eliminar token expirado
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Refresh token expirado' });
    }
    
    // Verificar si el usuario sigue activo
    if (!storedToken.usuario.activo) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Usuario desactivado' });
    }
    
    // Generar nuevo access token
    const accessToken = generateAccessToken(storedToken.usuario);
    
    // Actualizar cookie del access token
    res.cookie('accessToken', accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000
    });
    
    // Opcional: Rotar el refresh token para mayor seguridad
    // (comentado por simplicidad, se puede habilitar)
    /*
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    const { token: newRefreshToken, expiresAt } = await generateRefreshToken(storedToken.usuario.id);
    res.cookie('refreshToken', newRefreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_EXPIRY_MS,
      path: '/api/auth'
    });
    */
    
    res.json({ message: 'Token renovado exitosamente' });
  } catch (error) {
    console.error('Error en refresh:', error);
    res.status(500).json({ error: 'Error al renovar token' });
  }
};

/**
 * POST /api/auth/logout
 * Cierra la sesión eliminando cookies y el refresh token de la BD
 */
export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (refreshToken) {
      // Eliminar el refresh token de la base de datos
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken }
      });
    }
    
    // Limpiar cookies
    clearAuthCookies(res);
    
    res.json({ message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    console.error('Error en logout:', error);
    // Aún así limpiar las cookies
    clearAuthCookies(res);
    res.json({ message: 'Sesión cerrada' });
  }
};

/**
 * POST /api/auth/register
 * Registro público: en producción está deshabilitado (403).
 * Usuarios nuevos reciben rol USUARIO (sin privilegios), nunca ADMIN.
 */
export const register = async (req, res) => {
  try {
    // En producción, cerrar registro público (usuarios creados por admins o por invitación)
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Registro no disponible' });
    }

    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
    }

    const existingUser = await prisma.usuario.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        passwordHash
      }
    });

    // Asignar rol sin privilegios (nunca ADMIN en registro público)
    const rolUsuario = await prisma.rol.findFirst({
      where: { codigo: 'USUARIO' }
    });

    if (rolUsuario) {
      await prisma.usuarioRol.create({
        data: {
          usuarioId: usuario.id,
          rolId: rolUsuario.id
        }
      });
    }

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email
      }
    });
  } catch (error) {
    console.error('Error en register:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
};

/**
 * GET /api/auth/me
 * Obtiene información del usuario actual (requiere autenticación)
 */
export const getCurrentUser = async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
        roles: {
          include: {
            rol: {
              select: {
                id: true,
                codigo: true,
                descripcion: true,
                permisos: {
                  include: { permiso: true }
                }
              }
            }
          }
        }
      }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const permisos = [...new Set(
      usuario.roles.flatMap(ur =>
        ur.rol.permisos.map(rp => rp.permiso.codigo)
      )
    )];

    res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      activo: usuario.activo,
      roles: usuario.roles.map(ur => ur.rol.codigo),
      permisos
    });
  } catch (error) {
    console.error('Error al obtener usuario actual:', error);
    res.status(500).json({ error: 'Error al obtener información del usuario' });
  }
};
