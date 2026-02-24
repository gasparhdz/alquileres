// prisma/seed/index.js
import { PrismaClient } from '@prisma/client'
import truncateTables from './truncate-tables.js'
import seedUsuarioAdmin from './seedUsuarioAdmin.js'
import seedParametros from './seedParametros.js'

const prisma = new PrismaClient()

async function main() {
  try {
    // 1. Truncar todas las tablas
    await truncateTables(prisma)

    // 2. Ejecutar seeds
    console.log('\n🌱 Ejecutando seeds...\n')
    
    await seedUsuarioAdmin(prisma)
    await seedParametros(prisma)
    
    console.log('\n✅ Proceso completo: Truncate y Seeds finalizados exitosamente!')
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
