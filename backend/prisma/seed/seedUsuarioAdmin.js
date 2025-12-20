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

  console.log("✔ Usuario administrador creado/asignado.")
}
