/**
 * Corrige la secuencia del id de `localidades` cuando los INSERT fallan por PK duplicada.
 * Uso: desde la carpeta backend → node scripts/fix-localidades-sequence.js
 */
import prisma from '../src/db/prisma.js';

async function main() {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('localidades', 'id'),
      COALESCE((SELECT MAX(id) FROM localidades), 1)
    );
  `);
  const maxRow = await prisma.$queryRaw`SELECT MAX(id) AS m FROM localidades`;
  const m = maxRow?.[0]?.m ?? null;
  console.log('Secuencia de localidades actualizada. MAX(id) actual:', m);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
