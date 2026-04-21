// prisma/seed/seedUsuarioAdmin.js
import bcrypt from 'bcrypt'

export default async function seedUsuarioAdmin(prisma) {
  console.log("→ Seed usuario administrador...")

  // 1) Rol ADMIN (y opcionalmente USUARIO para registro público / dev)
  const rolAdmin = await prisma.rol.upsert({
    where: { codigo: "ADMIN" },
    update: {},
    create: {
      codigo: "ADMIN",
      descripcion: "Administrador",
      activo: true,
    },
  })

  // Rol USUARIO: descomentar si necesitás un rol sin privilegios (ej. registro público)
  // await prisma.rol.upsert({
  //   where: { codigo: "USUARIO" },
  //   update: {},
  //   create: {
  //     codigo: "USUARIO",
  //     descripcion: "Usuario estándar (sin privilegios de administración)",
  //     activo: true,
  //   },
  // })

  // 2) Usuario Gaspar
  const passwordHash = await bcrypt.hash("123456", 10)

  const usuario = await prisma.usuario.upsert({
    where: { email: "gaspihernandez@gmail.com" },
    update: {},
    create: {
      apellido: "Hernandez",
      nombre: "Gaspar",
      nombreUsuario: "admin",
      email: "gaspihernandez@gmail.com",
      telefono: "3476655720",
      passwordHash,
      activo: true,
    },
  })

  // 3) Relación UsuarioRol
  await prisma.usuarioRol.upsert({
    where: {
      usuarioId_rolId: {
        usuarioId: usuario.id,
        rolId: rolAdmin.id,
      },
    },
    update: {},
    create: {
      usuarioId: usuario.id,
      rolId: rolAdmin.id,
    },
  })

  // 4) Crear Permisos (codigo = modulo.accion; alineados con menú y grilla de roles)
  console.log("→ Creando permisos...")
  const permisos = [
    // Inquilinos
    { codigo: "inquilinos.ver", nombre: "Ver inquilinos", descripcion: "Permite ver el listado de inquilinos" },
    { codigo: "inquilinos.crear", nombre: "Crear inquilinos", descripcion: "Permite crear nuevos inquilinos" },
    { codigo: "inquilinos.editar", nombre: "Editar inquilinos", descripcion: "Permite editar inquilinos existentes" },
    { codigo: "inquilinos.eliminar", nombre: "Eliminar inquilinos", descripcion: "Permite eliminar inquilinos" },

    // Propietarios
    { codigo: "propietarios.ver", nombre: "Ver propietarios", descripcion: "Permite ver el listado de propietarios" },
    { codigo: "propietarios.crear", nombre: "Crear propietarios", descripcion: "Permite crear nuevos propietarios" },
    { codigo: "propietarios.editar", nombre: "Editar propietarios", descripcion: "Permite editar propietarios existentes" },
    { codigo: "propietarios.eliminar", nombre: "Eliminar propietarios", descripcion: "Permite eliminar propietarios" },

    // Propiedades
    { codigo: "propiedades.ver", nombre: "Ver propiedades", descripcion: "Permite ver el listado de propiedades" },
    { codigo: "propiedades.crear", nombre: "Crear propiedades", descripcion: "Permite crear nuevas propiedades" },
    { codigo: "propiedades.editar", nombre: "Editar propiedades", descripcion: "Permite editar propiedades existentes" },
    { codigo: "propiedades.eliminar", nombre: "Eliminar propiedades", descripcion: "Permite eliminar propiedades" },

    // Propiedad: Impuestos y Cargos / Cuentas tributarias (solapa unificada)
    { codigo: "propiedad.servicios.ver", nombre: "Ver impuestos y cargos", descripcion: "Permite ver los impuestos y cargos asociados a propiedades" },
    { codigo: "propiedad.servicios.crear", nombre: "Crear impuestos y cargos", descripcion: "Permite crear impuestos y cargos para propiedades" },
    { codigo: "propiedad.servicios.editar", nombre: "Editar impuestos y cargos", descripcion: "Permite editar impuestos y cargos de propiedades" },
    { codigo: "propiedad.servicios.eliminar", nombre: "Eliminar impuestos y cargos", descripcion: "Permite eliminar impuestos y cargos de propiedades" },

    // Propiedad Documentos
    { codigo: "propiedad.documentos.ver", nombre: "Ver documentos de propiedad", descripcion: "Permite ver los documentos asociados a propiedades" },
    { codigo: "propiedad.documentos.crear", nombre: "Crear documentos de propiedad", descripcion: "Permite crear documentos para propiedades" },
    { codigo: "propiedad.documentos.editar", nombre: "Editar documentos de propiedad", descripcion: "Permite editar documentos de propiedades" },
    { codigo: "propiedad.documentos.eliminar", nombre: "Eliminar documentos de propiedad", descripcion: "Permite eliminar documentos de propiedades" },

    // Contratos
    { codigo: "contratos.ver", nombre: "Ver contratos", descripcion: "Permite ver el listado de contratos" },
    { codigo: "contratos.crear", nombre: "Crear contratos", descripcion: "Permite crear nuevos contratos" },
    { codigo: "contratos.editar", nombre: "Editar contratos", descripcion: "Permite editar contratos existentes" },
    { codigo: "contratos.eliminar", nombre: "Eliminar contratos", descripcion: "Permite eliminar contratos" },

    // Ajustes de Contrato
    { codigo: "contrato.ajustes.ver", nombre: "Ver ajustes", descripcion: "Permite ver los ajustes de contratos" },
    { codigo: "contrato.ajustes.crear", nombre: "Crear ajustes", descripcion: "Permite crear nuevos ajustes de contratos" },
    { codigo: "contrato.ajustes.editar", nombre: "Editar ajustes", descripcion: "Permite editar ajustes de contratos existentes" },
    { codigo: "contrato.ajustes.eliminar", nombre: "Eliminar ajustes", descripcion: "Permite eliminar ajustes de contratos" },

    // Garantías de Contrato
    { codigo: "contrato.garantias.ver", nombre: "Ver garantías", descripcion: "Permite ver las garantías de contratos" },
    { codigo: "contrato.garantias.crear", nombre: "Crear garantías", descripcion: "Permite crear nuevas garantías de contratos" },
    { codigo: "contrato.garantias.editar", nombre: "Editar garantías", descripcion: "Permite editar garantías de contratos existentes" },
    { codigo: "contrato.garantias.eliminar", nombre: "Eliminar garantías", descripcion: "Permite eliminar garantías de contratos" },

    // Responsabilidades de Contrato
    { codigo: "contrato.responsabilidades.ver", nombre: "Ver responsabilidades", descripcion: "Permite ver las responsabilidades de contratos" },
    { codigo: "contrato.responsabilidades.crear", nombre: "Crear responsabilidades", descripcion: "Permite crear nuevas responsabilidades de contratos" },
    { codigo: "contrato.responsabilidades.editar", nombre: "Editar responsabilidades", descripcion: "Permite editar responsabilidades de contratos existentes" },
    { codigo: "contrato.responsabilidades.eliminar", nombre: "Eliminar responsabilidades", descripcion: "Permite eliminar responsabilidades de contratos" },

    // Gastos Iniciales de Contrato
    { codigo: "contrato.gastos_iniciales.ver", nombre: "Ver gastos iniciales", descripcion: "Permite ver los gastos iniciales de contratos" },
    { codigo: "contrato.gastos_iniciales.crear", nombre: "Crear gastos iniciales", descripcion: "Permite crear nuevos gastos iniciales de contratos" },
    { codigo: "contrato.gastos_iniciales.editar", nombre: "Editar gastos iniciales", descripcion: "Permite editar gastos iniciales de contratos existentes" },
    { codigo: "contrato.gastos_iniciales.eliminar", nombre: "Eliminar gastos iniciales", descripcion: "Permite eliminar gastos iniciales de contratos" },

    // Impuestos e Incidencias (Pendientes)
    { codigo: "impuestos.ver", nombre: "Ver impuestos", descripcion: "Permite ver la grilla de impuestos e incidencias" },
    { codigo: "impuestos.crear", nombre: "Crear impuestos", descripcion: "Permite generar impuestos automáticos y crear incidencias" },
    { codigo: "impuestos.editar", nombre: "Editar impuestos", descripcion: "Permite completar y modificar importes de impuestos e incidencias" },

    // Liquidaciones (crear incluye generar/emitir)
    { codigo: "liquidaciones.ver", nombre: "Ver liquidaciones", descripcion: "Permite ver el listado de liquidaciones" },
    { codigo: "liquidaciones.crear", nombre: "Crear liquidaciones", descripcion: "Permite crear nuevas liquidaciones" },
    { codigo: "liquidaciones.editar", nombre: "Editar liquidaciones", descripcion: "Permite editar liquidaciones existentes" },
    { codigo: "liquidaciones.eliminar", nombre: "Eliminar liquidaciones", descripcion: "Permite eliminar liquidaciones" },

    // Cuentas Propietarios
    { codigo: "movimiento.propietarios.ver", nombre: "Ver movimientos propietarios", descripcion: "Permite ver movimientos de propietarios" },
    { codigo: "movimiento.propietarios.crear", nombre: "Crear movimientos propietarios", descripcion: "Permite crear movimientos de propietarios" },
    { codigo: "movimiento.propietarios.editar", nombre: "Editar movimientos propietarios", descripcion: "Permite editar movimientos de propietarios" },
    { codigo: "movimiento.propietarios.exportar", nombre: "Exportar movimientos propietarios", descripcion: "Permite exportar movimientos de propietarios" },

    // Cuentas Inquilinos
    { codigo: "movimiento.inquilinos.ver", nombre: "Ver movimientos inquilinos", descripcion: "Permite ver movimientos de inquilinos" },
    { codigo: "movimiento.inquilinos.crear", nombre: "Crear movimientos inquilinos", descripcion: "Permite crear movimientos de inquilinos" },
    { codigo: "movimiento.inquilinos.editar", nombre: "Editar movimientos inquilinos", descripcion: "Permite editar movimientos de inquilinos" },
    { codigo: "movimiento.inquilinos.exportar", nombre: "Exportar movimientos inquilinos", descripcion: "Permite exportar movimientos de inquilinos" },

    // Parámetros (ABM de parámetros / Configuración)
    { codigo: "parametros.ver", nombre: "Ver parámetros", descripcion: "Permite ver parámetros" },
    { codigo: "parametros.crear", nombre: "Crear parámetros", descripcion: "Permite crear parámetros" },
    { codigo: "parametros.editar", nombre: "Editar parámetros", descripcion: "Permite editar parámetros" },
    { codigo: "parametros.eliminar", nombre: "Eliminar parámetros", descripcion: "Permite eliminar parámetros" },

    // Usuarios y Roles
    { codigo: "usuarios.ver", nombre: "Ver usuarios", descripcion: "Permite ver el listado de usuarios" },
    { codigo: "usuarios.crear", nombre: "Crear usuarios", descripcion: "Permite crear nuevos usuarios" },
    { codigo: "usuarios.editar", nombre: "Editar usuarios", descripcion: "Permite editar usuarios existentes" },
    { codigo: "usuarios.eliminar", nombre: "Eliminar usuarios", descripcion: "Permite eliminar usuarios" },
    { codigo: "roles.ver", nombre: "Ver roles", descripcion: "Permite ver el listado de roles" },
    { codigo: "roles.crear", nombre: "Crear roles", descripcion: "Permite crear nuevos roles" },
    { codigo: "roles.editar", nombre: "Editar roles", descripcion: "Permite editar roles existentes" },
    { codigo: "roles.eliminar", nombre: "Eliminar roles", descripcion: "Permite eliminar roles" },
  ]

  const permisosCreados = {}
  for (const permiso of permisos) {
    const permisoCreado = await prisma.permiso.upsert({
      where: { codigo: permiso.codigo },
      update: {
        nombre: permiso.nombre,
        descripcion: permiso.descripcion,
        activo: true,
      },
      create: {
        codigo: permiso.codigo,
        nombre: permiso.nombre,
        descripcion: permiso.descripcion,
        activo: true,
      },
    })
    permisosCreados[permiso.codigo] = permisoCreado
  }

  // 5) Asignar todos los permisos al rol ADMIN
  console.log("→ Asignando permisos al rol ADMIN...")
  for (const permiso of Object.values(permisosCreados)) {
    const rolPermisoExistente = await prisma.rolPermiso.findFirst({
      where: {
        rolId: rolAdmin.id,
        permisoId: permiso.id,
      },
    })

    if (!rolPermisoExistente) {
      await prisma.rolPermiso.create({
        data: {
          rolId: rolAdmin.id,
          permisoId: permiso.id,
        },
      })
    }
  }

  console.log("✔ Usuario administrador creado/asignado.")
  console.log(`✔ ${Object.keys(permisosCreados).length} permisos creados y asignados al rol ADMIN.`)
}
