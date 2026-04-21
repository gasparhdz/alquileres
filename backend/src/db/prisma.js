import { PrismaClient } from '@prisma/client';

/**
 * Una única instancia global de PrismaClient compartida en toda la aplicación.
 * Evita agotamiento de conexiones (connection leak) por múltiples pools a PostgreSQL.
 * En desarrollo se guarda en globalThis para sobrevivir hot-reloads (ej. nodemon).
 */
const globalForPrisma = { prisma: undefined };

export const prismaInstance = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaInstance;
}

export default prismaInstance;
