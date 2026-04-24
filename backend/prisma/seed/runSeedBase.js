import { PrismaClient } from '@prisma/client';
import seedUsuarioAdmin from './seedUsuarioAdmin.js';
import seedParametros from './seedParametros.js';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('\n🌱 Ejecutando seed base (admin + parámetros)...\n');
    await seedUsuarioAdmin(prisma);
    await seedParametros(prisma);
    console.log('\n✅ Seed base finalizado exitosamente!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error en seed base:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
