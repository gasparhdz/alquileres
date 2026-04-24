import { PrismaClient } from '@prisma/client';
import seedDatosReales from './seedDatosReales.js';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('\n🌱 Ejecutando seed de datos reales...\n');
    await seedDatosReales(prisma);
    console.log('\n✅ Seed de datos reales finalizado exitosamente!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error en seed de datos reales:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
