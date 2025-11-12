import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function truncateTables() {
  try {
    console.log('🗑️  Iniciando truncate de tablas...\n');

    // Desactivar temporalmente las restricciones de foreign key
    await prisma.$executeRawUnsafe(`SET session_replication_role = 'replica';`);

    // Truncar tablas en orden (primero las dependientes, luego las principales)
    // Usar CASCADE para truncar también las tablas dependientes automáticamente
    const tables = [
      'liquidacion_items',
      'liquidaciones',
      'contrato_ajuste',
      'contrato_gastos_iniciales',
      'contrato_responsabilidades',
      'garantias',
      'contratos',
      'cuentas_tributarias',
      'inquilinos'
    ];

    for (const table of tables) {
      console.log(`Truncando tabla: ${table}...`);
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${table} CASCADE;`);
      console.log(`✅ Tabla ${table} truncada`);
    }

    // Reactivar las restricciones de foreign key
    await prisma.$executeRawUnsafe(`SET session_replication_role = 'origin';`);

    // Resetear secuencias para tablas con autoincrement
    console.log('\n🔄 Reseteando secuencias...');
    
    // Verificar si las secuencias existen antes de resetearlas
    const sequences = [
      { name: 'contrato_ajuste_id_seq', table: 'contrato_ajuste' },
      { name: 'indice_ajuste_id_seq', table: 'indice_ajuste' }
    ];

    for (const seq of sequences) {
      try {
        // Verificar si la secuencia existe
        const sequenceExists = await prisma.$queryRawUnsafe(`
          SELECT EXISTS (
            SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = '${seq.name}'
          ) as exists;
        `);
        
        if (sequenceExists[0]?.exists) {
          await prisma.$executeRawUnsafe(`ALTER SEQUENCE ${seq.name} RESTART WITH 1;`);
          console.log(`✅ Secuencia ${seq.name} reseteada`);
        } else {
          console.log(`⚠️  Secuencia ${seq.name} no existe (puede que la tabla use UUID)`);
        }
      } catch (error) {
        console.log(`⚠️  No se pudo resetear la secuencia ${seq.name}:`, error.message);
      }
    }

    // Verificar que las tablas estén vacías
    console.log('\n📊 Verificando que las tablas estén vacías...\n');
    
    for (const table of tables) {
      const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${table};`);
      const recordCount = parseInt(count[0]?.count || '0');
      const status = recordCount === 0 ? '✅' : '❌';
      console.log(`${status} ${table}: ${recordCount} registros`);
    }

    console.log('\n✨ Truncate completado exitosamente!');
  } catch (error) {
    console.error('❌ Error al truncar tablas:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
truncateTables()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

