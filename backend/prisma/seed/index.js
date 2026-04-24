// prisma/seed/index.js
import { PrismaClient } from '@prisma/client'
import seedUsuarioAdmin from './seedUsuarioAdmin.js'
import seedParametros from './seedParametros.js'
import seedDatosReales from './seedDatosReales.js'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('\n🌱 Ejecutando seeds...\n')
    
    await seedUsuarioAdmin(prisma)
    await seedParametros(prisma)
    await seedDatosReales(prisma)
    
    console.log('\n✅ Seeds finalizados exitosamente!')
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
