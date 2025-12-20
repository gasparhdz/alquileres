// prisma/seed/index.js
import { PrismaClient } from '@prisma/client'
import seedUsuarioAdmin from './seedUsuarioAdmin.js'
import seedParametros from './seedParametros.js'

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Ejecutando seeds...")

  await seedUsuarioAdmin(prisma)
  await seedParametros(prisma)
  
  console.log("🌱 Seeds finalizados.")
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
