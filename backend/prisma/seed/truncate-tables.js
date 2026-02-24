// prisma/seed/truncate-tables.js

export default async function truncateTables(prisma) {
  try {
    console.log('🗑️  Iniciando truncate de tablas...\n');

    // Desactivar temporalmente las restricciones de foreign key
    await prisma.$executeRawUnsafe(`SET session_replication_role = 'replica';`);

    // Truncar tablas en orden (primero las dependientes, luego las principales)
    // Usar CASCADE para truncar también las tablas dependientes automáticamente
    const tables = [
      // Tablas de datos transaccionales (dependientes)
      'liquidacion_items',
      'liquidaciones',
      'contrato_ajuste',
      'contrato_gastos_iniciales',
      'contrato_responsabilidades',
      'contrato_garantias',
      'contratos',
      'propiedad_impuesto_campos',
      'propiedad_impuestos',
      'propiedad_cargo_campos',
      'propiedad_cargos',
      'propiedad_documento',
      'propiedad_propietario',
      'propiedades',
      'inquilinos',
      'propietarios',
      
      // Tablas de relaciones usuario/rol/permisos
      'rol_permiso',
      'usuario_rol',
      'permisos',
      'roles',
      'usuarios',
      
      // Tablas de parametría (se pueden truncar todas)
      'tipos_impuesto_propiedad_campos',
      'tipos_cargo_campos',
      'tipos_impuesto_propiedad',
      'tipos_cargo',
      'tipos_expensa',
      'periodicidades_impuesto',
      'tipos_documento_propiedad',
      'monedas',
      'estados_contrato',
      'metodos_ajuste_contrato',
      'indice_ajuste',
      'actores_responsable_contrato',
      'tipos_garantia_contrato',
      'estados_garantia_contrato',
      'tipos_gasto_inicial_contrato',
      'estados_liquidacion',
      'estados_item_liquidacion',
      'localidades',
      'provincias',
      'tipos_persona',
      'condiciones_iva',
      'ambientes_propiedad',
      'tipos_propiedad',
      'estados_propiedad',
      'destinos_propiedad',
    ];

    for (const table of tables) {
      try {
        console.log(`Truncando tabla: ${table}...`);
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${table} CASCADE;`);
        console.log(`✅ Tabla ${table} truncada`);
      } catch (error) {
        // Si la tabla no existe, solo mostrar advertencia y continuar
        if (error.code === 'P2010' || error.meta?.code === '42P01') {
          console.log(`⚠️  Tabla ${table} no existe, omitiendo...`);
        } else {
          throw error; // Re-lanzar otros errores
        }
      }
    }

    // Reactivar las restricciones de foreign key
    await prisma.$executeRawUnsafe(`SET session_replication_role = 'origin';`);

    // Resetear secuencias para tablas con autoincrement
    console.log('\n🔄 Reseteando secuencias...');
    
    // Obtener todas las secuencias de las tablas truncadas
    const sequencesResult = await prisma.$queryRawUnsafe(`
      SELECT 
        schemaname,
        sequencename
      FROM pg_sequences
      WHERE schemaname = 'public'
        AND sequencename LIKE '%_id_seq'
      ORDER BY sequencename;
    `);

    if (sequencesResult && sequencesResult.length > 0) {
      for (const seq of sequencesResult) {
        try {
          await prisma.$executeRawUnsafe(`ALTER SEQUENCE ${seq.sequencename} RESTART WITH 1;`);
          console.log(`✅ Secuencia ${seq.sequencename} reseteada`);
        } catch (error) {
          console.log(`⚠️  No se pudo resetear la secuencia ${seq.sequencename}:`, error.message);
        }
      }
    } else {
      console.log('⚠️  No se encontraron secuencias para resetear');
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
  }
}

