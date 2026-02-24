// prisma/seed/seedUsuarioAdmin.js
import bcrypt from 'bcrypt'

export default async function seedUsuarioAdmin(prisma) {
  console.log("→ Seed usuario administrador...")

  // 1) Rol ADMIN
  const rolAdmin = await prisma.rol.upsert({
    where: { codigo: "ADMIN" },
    update: {},
    create: {
      codigo: "ADMIN",
      descripcion: "Administrador",
      activo: true,
    },
  })

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

  // 4) Crear Permisos
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
    
    // Unidades
    { codigo: "unidades.ver", nombre: "Ver unidades", descripcion: "Permite ver el listado de unidades" },
    { codigo: "unidades.crear", nombre: "Crear unidades", descripcion: "Permite crear nuevas unidades" },
    { codigo: "unidades.editar", nombre: "Editar unidades", descripcion: "Permite editar unidades existentes" },
    { codigo: "unidades.eliminar", nombre: "Eliminar unidades", descripcion: "Permite eliminar unidades" },
    
    // Contratos
    { codigo: "contratos.ver", nombre: "Ver contratos", descripcion: "Permite ver el listado de contratos" },
    { codigo: "contratos.crear", nombre: "Crear contratos", descripcion: "Permite crear nuevos contratos" },
    { codigo: "contratos.editar", nombre: "Editar contratos", descripcion: "Permite editar contratos existentes" },
    { codigo: "contratos.eliminar", nombre: "Eliminar contratos", descripcion: "Permite eliminar contratos" },
    
    // Liquidaciones
    { codigo: "liquidaciones.ver", nombre: "Ver liquidaciones", descripcion: "Permite ver el listado de liquidaciones" },
    { codigo: "liquidaciones.crear", nombre: "Crear liquidaciones", descripcion: "Permite crear nuevas liquidaciones" },
    { codigo: "liquidaciones.editar", nombre: "Editar liquidaciones", descripcion: "Permite editar liquidaciones existentes" },
    { codigo: "liquidaciones.eliminar", nombre: "Eliminar liquidaciones", descripcion: "Permite eliminar liquidaciones" },
    { codigo: "liquidaciones.generar", nombre: "Generar liquidaciones", descripcion: "Permite generar liquidaciones automáticamente" },
    { codigo: "liquidaciones.emitir", nombre: "Emitir liquidaciones", descripcion: "Permite emitir liquidaciones" },
    
    // Cuentas Tributarias
    { codigo: "cuentas.ver", nombre: "Ver cuentas tributarias", descripcion: "Permite ver el listado de cuentas tributarias" },
    { codigo: "cuentas.crear", nombre: "Crear cuentas tributarias", descripcion: "Permite crear nuevas cuentas tributarias" },
    { codigo: "cuentas.editar", nombre: "Editar cuentas tributarias", descripcion: "Permite editar cuentas tributarias existentes" },
    { codigo: "cuentas.eliminar", nombre: "Eliminar cuentas tributarias", descripcion: "Permite eliminar cuentas tributarias" },
    
    // Parámetros/Configuración
    { codigo: "parametros.ver", nombre: "Ver parámetros", descripcion: "Permite ver los parámetros del sistema" },
    { codigo: "parametros.editar", nombre: "Editar parámetros", descripcion: "Permite editar los parámetros del sistema" },
    
    // Catalogos
    { codigo: "catalogos.ver", nombre: "Ver catálogos", descripcion: "Permite ver los catálogos del sistema" },
    { codigo: "catalogos.editar", nombre: "Editar catálogos", descripcion: "Permite editar los catálogos del sistema" },
    
    // Índices de Ajuste
    { codigo: "indices.ver", nombre: "Ver índices", descripcion: "Permite ver los índices de ajuste" },
    { codigo: "indices.crear", nombre: "Crear índices", descripcion: "Permite crear nuevos índices de ajuste" },
    { codigo: "indices.editar", nombre: "Editar índices", descripcion: "Permite editar índices de ajuste existentes" },
    { codigo: "indices.eliminar", nombre: "Eliminar índices", descripcion: "Permite eliminar índices de ajuste" },
    
    // Ajustes de Contrato
    { codigo: "ajustes.ver", nombre: "Ver ajustes", descripcion: "Permite ver los ajustes de contratos" },
    { codigo: "ajustes.crear", nombre: "Crear ajustes", descripcion: "Permite crear nuevos ajustes de contratos" },
    { codigo: "ajustes.editar", nombre: "Editar ajustes", descripcion: "Permite editar ajustes de contratos existentes" },
    { codigo: "ajustes.eliminar", nombre: "Eliminar ajustes", descripcion: "Permite eliminar ajustes de contratos" },
    
    // Propiedad Impuestos
    { codigo: "propiedad.impuestos.ver", nombre: "Ver impuestos de propiedad", descripcion: "Permite ver los impuestos asociados a propiedades" },
    { codigo: "propiedad.impuestos.crear", nombre: "Crear impuestos de propiedad", descripcion: "Permite crear impuestos para propiedades" },
    { codigo: "propiedad.impuestos.editar", nombre: "Editar impuestos de propiedad", descripcion: "Permite editar impuestos de propiedades" },
    { codigo: "propiedad.impuestos.eliminar", nombre: "Eliminar impuestos de propiedad", descripcion: "Permite eliminar impuestos de propiedades" },
    
    // Propiedad Cargos
    { codigo: "propiedad.cargos.ver", nombre: "Ver cargos de propiedad", descripcion: "Permite ver los cargos asociados a propiedades" },
    { codigo: "propiedad.cargos.crear", nombre: "Crear cargos de propiedad", descripcion: "Permite crear cargos para propiedades" },
    { codigo: "propiedad.cargos.editar", nombre: "Editar cargos de propiedad", descripcion: "Permite editar cargos de propiedades" },
    { codigo: "propiedad.cargos.eliminar", nombre: "Eliminar cargos de propiedad", descripcion: "Permite eliminar cargos de propiedades" },
    
    // Propiedad Documentos
    { codigo: "propiedad.documentos.ver", nombre: "Ver documentos de propiedad", descripcion: "Permite ver los documentos asociados a propiedades" },
    { codigo: "propiedad.documentos.crear", nombre: "Crear documentos de propiedad", descripcion: "Permite crear documentos para propiedades" },
    { codigo: "propiedad.documentos.editar", nombre: "Editar documentos de propiedad", descripcion: "Permite editar documentos de propiedades" },
    { codigo: "propiedad.documentos.eliminar", nombre: "Eliminar documentos de propiedad", descripcion: "Permite eliminar documentos de propiedades" },
    
    // Usuarios y Roles
    { codigo: "usuarios.ver", nombre: "Ver usuarios", descripcion: "Permite ver el listado de usuarios" },
    { codigo: "usuarios.crear", nombre: "Crear usuarios", descripcion: "Permite crear nuevos usuarios" },
    { codigo: "usuarios.editar", nombre: "Editar usuarios", descripcion: "Permite editar usuarios existentes" },
    { codigo: "usuarios.eliminar", nombre: "Eliminar usuarios", descripcion: "Permite eliminar usuarios" },
    { codigo: "roles.ver", nombre: "Ver roles", descripcion: "Permite ver el listado de roles" },
    { codigo: "roles.crear", nombre: "Crear roles", descripcion: "Permite crear nuevos roles" },
    { codigo: "roles.editar", nombre: "Editar roles", descripcion: "Permite editar roles existentes" },
    { codigo: "roles.eliminar", nombre: "Eliminar roles", descripcion: "Permite eliminar roles" },
    { codigo: "permisos.ver", nombre: "Ver permisos", descripcion: "Permite ver el listado de permisos" },
    { codigo: "permisos.asignar", nombre: "Asignar permisos", descripcion: "Permite asignar permisos a roles" },
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
