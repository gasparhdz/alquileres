-- Truncar y cargar permisos (ejecutar en pgAdmin 4)
-- 1) Truncar rol_permiso y permisos (orden: primero la tabla que referencia)
-- 2) Insertar permisos

TRUNCATE TABLE rol_permiso, permisos RESTART IDENTITY;

INSERT INTO permisos (codigo, nombre, descripcion, activo, created_at, updated_at)
VALUES
  ('inquilinos.ver', 'Ver inquilinos', 'Permite ver el listado de inquilinos', true, NOW(), NOW()),
  ('inquilinos.crear', 'Crear inquilinos', 'Permite crear nuevos inquilinos', true, NOW(), NOW()),
  ('inquilinos.editar', 'Editar inquilinos', 'Permite editar inquilinos existentes', true, NOW(), NOW()),
  ('inquilinos.eliminar', 'Eliminar inquilinos', 'Permite eliminar inquilinos', true, NOW(), NOW()),

  ('propietarios.ver', 'Ver propietarios', 'Permite ver el listado de propietarios', true, NOW(), NOW()),
  ('propietarios.crear', 'Crear propietarios', 'Permite crear nuevos propietarios', true, NOW(), NOW()),
  ('propietarios.editar', 'Editar propietarios', 'Permite editar propietarios existentes', true, NOW(), NOW()),
  ('propietarios.eliminar', 'Eliminar propietarios', 'Permite eliminar propietarios', true, NOW(), NOW()),

  ('propiedades.ver', 'Ver propiedades', 'Permite ver el listado de propiedades', true, NOW(), NOW()),
  ('propiedades.crear', 'Crear propiedades', 'Permite crear nuevas propiedades', true, NOW(), NOW()),
  ('propiedades.editar', 'Editar propiedades', 'Permite editar propiedades existentes', true, NOW(), NOW()),
  ('propiedades.eliminar', 'Eliminar propiedades', 'Permite eliminar propiedades', true, NOW(), NOW()),

  ('consorcios.ver', 'Ver consorcios', 'Permite ver el listado de consorcios', true, NOW(), NOW()),
  ('consorcios.crear', 'Crear consorcios', 'Permite crear consorcios', true, NOW(), NOW()),
  ('consorcios.editar', 'Editar consorcios', 'Permite editar consorcios', true, NOW(), NOW()),
  ('consorcios.eliminar', 'Eliminar consorcios', 'Permite eliminar consorcios', true, NOW(), NOW()),

  ('propiedad.servicios.ver', 'Ver impuestos y cargos', 'Permite ver los impuestos y cargos asociados a propiedades', true, NOW(), NOW()),
  ('propiedad.servicios.crear', 'Crear impuestos y cargos', 'Permite crear impuestos y cargos para propiedades', true, NOW(), NOW()),
  ('propiedad.servicios.editar', 'Editar impuestos y cargos', 'Permite editar impuestos y cargos de propiedades', true, NOW(), NOW()),
  ('propiedad.servicios.eliminar', 'Eliminar impuestos y cargos', 'Permite eliminar impuestos y cargos de propiedades', true, NOW(), NOW()),

  ('propiedad.documentos.ver', 'Ver documentos de propiedad', 'Permite ver los documentos asociados a propiedades', true, NOW(), NOW()),
  ('propiedad.documentos.crear', 'Crear documentos de propiedad', 'Permite crear documentos para propiedades', true, NOW(), NOW()),
  ('propiedad.documentos.editar', 'Editar documentos de propiedad', 'Permite editar documentos de propiedades', true, NOW(), NOW()),
  ('propiedad.documentos.eliminar', 'Eliminar documentos de propiedad', 'Permite eliminar documentos de propiedades', true, NOW(), NOW()),

  ('contratos.ver', 'Ver contratos', 'Permite ver el listado de contratos', true, NOW(), NOW()),
  ('contratos.crear', 'Crear contratos', 'Permite crear nuevos contratos', true, NOW(), NOW()),
  ('contratos.editar', 'Editar contratos', 'Permite editar contratos existentes', true, NOW(), NOW()),
  ('contratos.eliminar', 'Eliminar contratos', 'Permite eliminar contratos', true, NOW(), NOW()),

  ('contrato.ajustes.ver', 'Ver ajustes', 'Permite ver los ajustes de contratos', true, NOW(), NOW()),
  ('contrato.ajustes.crear', 'Crear ajustes', 'Permite crear nuevos ajustes de contratos', true, NOW(), NOW()),
  ('contrato.ajustes.editar', 'Editar ajustes', 'Permite editar ajustes de contratos existentes', true, NOW(), NOW()),
  ('contrato.ajustes.eliminar', 'Eliminar ajustes', 'Permite eliminar ajustes de contratos', true, NOW(), NOW()),

  ('impuestos.ver', 'Ver impuestos', 'Permite ver la grilla de impuestos e incidencias', true, NOW(), NOW()),
  ('impuestos.crear', 'Crear impuestos', 'Permite generar impuestos automáticos y crear incidencias', true, NOW(), NOW()),
  ('impuestos.editar', 'Editar impuestos', 'Permite completar y modificar importes de impuestos e incidencias', true, NOW(), NOW()),

  ('liquidaciones.ver', 'Ver liquidaciones', 'Permite ver el listado de liquidaciones', true, NOW(), NOW()),
  ('liquidaciones.crear', 'Crear liquidaciones', 'Permite crear nuevas liquidaciones', true, NOW(), NOW()),
  ('liquidaciones.editar', 'Editar liquidaciones', 'Permite editar liquidaciones existentes', true, NOW(), NOW()),
  ('liquidaciones.eliminar', 'Eliminar liquidaciones', 'Permite eliminar liquidaciones', true, NOW(), NOW()),

  ('movimiento.propietarios.ver', 'Ver movimientos propietarios', 'Permite ver movimientos de propietarios', true, NOW(), NOW()),
  ('movimiento.propietarios.crear', 'Crear movimientos propietarios', 'Permite crear movimientos de propietarios', true, NOW(), NOW()),
  ('movimiento.propietarios.editar', 'Editar movimientos propietarios', 'Permite editar movimientos de propietarios', true, NOW(), NOW()),
  ('movimiento.propietarios.exportar', 'Exportar movimientos propietarios', 'Permite exportar movimientos de propietarios', true, NOW(), NOW()),

  ('movimiento.inquilinos.ver', 'Ver movimientos inquilinos', 'Permite ver movimientos de inquilinos', true, NOW(), NOW()),
  ('movimiento.inquilinos.crear', 'Crear movimientos inquilinos', 'Permite crear movimientos de inquilinos', true, NOW(), NOW()),
  ('movimiento.inquilinos.editar', 'Editar movimientos inquilinos', 'Permite editar movimientos de inquilinos', true, NOW(), NOW()),
  ('movimiento.inquilinos.exportar', 'Exportar movimientos inquilinos', 'Permite exportar movimientos de inquilinos', true, NOW(), NOW()),

  ('parametros.ver', 'Ver parámetros', 'Permite ver parámetros', true, NOW(), NOW()),
  ('parametros.crear', 'Crear parámetros', 'Permite crear parámetros', true, NOW(), NOW()),
  ('parametros.editar', 'Editar parámetros', 'Permite editar parámetros', true, NOW(), NOW()),
  ('parametros.eliminar', 'Eliminar parámetros', 'Permite eliminar parámetros', true, NOW(), NOW()),

  ('usuarios.ver', 'Ver usuarios', 'Permite ver el listado de usuarios', true, NOW(), NOW()),
  ('usuarios.crear', 'Crear usuarios', 'Permite crear nuevos usuarios', true, NOW(), NOW()),
  ('usuarios.editar', 'Editar usuarios', 'Permite editar usuarios existentes', true, NOW(), NOW()),
  ('usuarios.eliminar', 'Eliminar usuarios', 'Permite eliminar usuarios', true, NOW(), NOW()),
  ('roles.ver', 'Ver roles', 'Permite ver el listado de roles', true, NOW(), NOW()),
  ('roles.crear', 'Crear roles', 'Permite crear nuevos roles', true, NOW(), NOW()),
  ('roles.editar', 'Editar roles', 'Permite editar roles existentes', true, NOW(), NOW()),
  ('roles.eliminar', 'Eliminar roles', 'Permite eliminar roles', true, NOW(), NOW())
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  activo = EXCLUDED.activo,
  updated_at = NOW();
