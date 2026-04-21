import prisma from '../db/prisma.js';

/**
 * Middleware fábrica que verifica si el usuario autenticado tiene un permiso específico.
 * Si se pasa un array de códigos, basta con tener al menos uno (OR).
 * Uso: router.post('/', authenticateToken, requirePermission('inquilinos.crear'), controller)
 */
export const requirePermission = (codigoPermiso) => {
  const codigosRequeridos = Array.isArray(codigoPermiso) ? codigoPermiso : [codigoPermiso];
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'No autenticado' });
      }
      // Buscar los permisos del usuario a través de sus roles
      const usuario = await prisma.usuario.findUnique({
        where: { id: req.user.id },
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
      if (!usuario) {
        return res.status(401).json({ error: 'Usuario no encontrado' });
      }
      // Aplanar permisos
      const permisos = usuario.roles.flatMap(ur =>
        ur.rol.permisos.map(rp => rp.permiso.codigo)
      );
      const autorizado = codigosRequeridos.some((c) => permisos.includes(c));
      if (!autorizado) {
        return res.status(403).json({
          error: 'No tienes los permisos necesarios para realizar esta acción',
          permisoRequerido: codigosRequeridos.join(' | '),
        });
      }
      next();
    } catch (error) {
      console.error('Error en requirePermission:', error);
      return res.status(500).json({ error: 'Error al verificar permisos' });
    }
  };
};
