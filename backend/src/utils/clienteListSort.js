import { Prisma } from '@prisma/client';

/**
 * Filtro de búsqueda equivalente al OR de Prisma (tabla clientes alias c).
 */
export function sqlSearchCliente(search) {
  if (!search || !String(search).trim()) return Prisma.empty;
  const p = `%${String(search).trim()}%`;
  return Prisma.sql`AND (
    c.nombre ILIKE ${p}
    OR c.apellido ILIKE ${p}
    OR c.razon_social ILIKE ${p}
    OR c.dni ILIKE ${p}
    OR c.cuit ILIKE ${p}
  )`;
}

/**
 * PF: apellido luego nombre. PJ: razon social (misma columna que muestra la lista).
 */
export function sqlOrderByApellido(order) {
  const dir = order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  return Prisma.sql`ORDER BY LOWER(COALESCE(NULLIF(TRIM(c.razon_social), ''), COALESCE(c.apellido, ''))) ${dir}, LOWER(COALESCE(c.nombre, '')) ${dir}`;
}

export function sqlOrderByCantPropiedades(order) {
  const dir = order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  return Prisma.sql`ORDER BY COALESCE(pp.cnt, 0) ${dir}`;
}

export function sqlFromClientesConConteoPropiedades() {
  return Prisma.sql`FROM clientes c
    LEFT JOIN (
      SELECT propietario_id, COUNT(*)::int AS cnt
      FROM propiedad_propietario
      WHERE deleted_at IS NULL AND activo = true
      GROUP BY propietario_id
    ) pp ON pp.propietario_id = c.id`;
}

export function sqlFromClientes() {
  return Prisma.sql`FROM clientes c`;
}

/** Mantiene el orden de `ids` en el array de clientes cargados por findMany. */
export function ordenarClientesPorIds(clientes, ids) {
  const map = new Map(clientes.map((c) => [c.id, c]));
  return ids.map((id) => map.get(id)).filter(Boolean);
}
