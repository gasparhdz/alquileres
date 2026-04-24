import {
  clientes,
  clienteRoles,
  consorcios,
  propiedades,
  propiedadSeguros,
  propiedadPropietarios,
  propiedadImpuestos,
  propiedadImpuestoCampos,
  propiedadCargos,
  propiedadCargoCampos,
  propiedadDocumentos,
  contratos,
  contratoResponsabilidades,
  contratoGarantias,
  contratoGastosIniciales,
  contratoAjustes,
} from './datosReales.js';

async function upsertById(model, records) {
  for (const record of records) {
    await model.upsert({
      where: { id: record.id },
      update: {},
      create: record,
    });
  }
}

async function upsertByCompound(model, records, buildWhere) {
  for (const record of records) {
    await model.upsert({
      where: buildWhere(record),
      update: {},
      create: record,
    });
  }
}

async function resetSequence(prisma, tableName, columnName = 'id') {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('"${tableName}"', '${columnName}'),
      COALESCE(MAX("${columnName}"), 1),
      MAX("${columnName}") IS NOT NULL
    )
    FROM "${tableName}";
  `);
}

export default async function seedDatosReales(prisma) {
  console.log('→ Seed datos reales (clientes, propiedades, contratos y relaciones)...');

  await upsertById(prisma.cliente, clientes);
  await resetSequence(prisma, 'clientes');

  await upsertByCompound(prisma.clienteRol, clienteRoles, (record) => ({
    clienteId_rolId: {
      clienteId: record.clienteId,
      rolId: record.rolId,
    },
  }));

  await upsertById(prisma.consorcio, consorcios);
  await resetSequence(prisma, 'consorcios');

  await upsertById(prisma.propiedad, propiedades);
  await resetSequence(prisma, 'propiedades');

  await upsertByCompound(prisma.propiedadPropietario, propiedadPropietarios, (record) => ({
    propiedadId_propietarioId: {
      propiedadId: record.propiedadId,
      propietarioId: record.propietarioId,
    },
  }));

  await upsertById(prisma.propiedadSeguro, propiedadSeguros);
  await resetSequence(prisma, 'propiedad_seguros');

  await upsertById(prisma.propiedadImpuesto, propiedadImpuestos);
  await resetSequence(prisma, 'propiedad_impuestos');

  await upsertById(prisma.propiedadImpuestoCampo, propiedadImpuestoCampos);
  await resetSequence(prisma, 'propiedad_impuesto_campos');

  await upsertById(prisma.propiedadCargo, propiedadCargos);
  await resetSequence(prisma, 'propiedad_cargos');

  await upsertById(prisma.propiedadCargoCampo, propiedadCargoCampos);
  await resetSequence(prisma, 'propiedad_cargo_campos');

  await upsertById(prisma.propiedadDocumento, propiedadDocumentos);
  await resetSequence(prisma, 'propiedad_documento');

  await upsertById(prisma.contrato, contratos);
  await resetSequence(prisma, 'contratos');

  await upsertById(prisma.contratoResponsabilidad, contratoResponsabilidades);
  await resetSequence(prisma, 'contrato_responsabilidades');

  await upsertById(prisma.contratoGarantia, contratoGarantias);
  await resetSequence(prisma, 'contrato_garantias');

  await upsertById(prisma.contratoGastoInicial, contratoGastosIniciales);
  await resetSequence(prisma, 'contrato_gastos_iniciales');

  await upsertById(prisma.contratoAjuste, contratoAjustes);
  await resetSequence(prisma, 'contrato_ajuste');

  console.log('✔ Datos reales seed listos.');
}
