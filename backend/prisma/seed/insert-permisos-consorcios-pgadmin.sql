-- =============================================================================
-- Permisos de Consorcios — script para pgAdmin 4 (PostgreSQL)
-- Idempotente: se puede ejecutar varias veces (INSERT ... ON CONFLICT).
-- No borra datos existentes.
-- =============================================================================

INSERT INTO permisos (codigo, nombre, descripcion, activo, created_at, updated_at)
VALUES
  ('consorcios.ver', 'Ver consorcios', 'Permite ver el listado de consorcios', true, NOW(), NOW()),
  ('consorcios.crear', 'Crear consorcios', 'Permite crear consorcios', true, NOW(), NOW()),
  ('consorcios.editar', 'Editar consorcios', 'Permite editar consorcios', true, NOW(), NOW()),
  ('consorcios.eliminar', 'Eliminar consorcios', 'Permite eliminar consorcios', true, NOW(), NOW())
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  activo = EXCLUDED.activo,
  updated_at = NOW();

-- -----------------------------------------------------------------------------
-- Opcional: asignar los 4 permisos al rol ADMIN (si existe y aún no están).
-- Descomentá el bloque siguiente si lo necesitás.
-- -----------------------------------------------------------------------------

/*
INSERT INTO rol_permiso (rol_id, permiso_id, created_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permisos p
WHERE r.codigo = 'ADMIN'
  AND (r.deleted_at IS NULL)
  AND p.codigo IN (
    'consorcios.ver',
    'consorcios.crear',
    'consorcios.editar',
    'consorcios.eliminar'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM rol_permiso rp
    WHERE rp.rol_id = r.id AND rp.permiso_id = p.id
  );
*/
