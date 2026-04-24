// prisma/seed/seedParametros.js
// Parámetros + Cuenta Corriente (Tipos de Movimiento, Medios de Pago). Datos en parametrosData.js

import {
  tipoPersona,
  provincia,
  localidad,
  condicionIva,
  ambientePropiedad,
  tipoPropiedad,
  estadoPropiedad,
  destinoPropiedad,
  tipoImpuestoPropiedad,
  tipoImpuestoPropiedadCampo,
  tipoCargo,
  tipoCargoCampo,
  tipoExpensa,
  periodicidadImpuesto,
  tipoDocumentoPropiedad,
  actorResponsableContrato,
  estadoGarantiaContrato,
  estadoContrato,
  tipoGarantiaContrato,
  metodoAjusteContrato,
  tipoGastoInicialContrato,
  rolCliente,
  estadoLiquidacion,
  estadoItemLiquidacion,
  moneda,
  tipoMovimiento,
  medioPago,
} from './parametrosData.js'

async function resetSequence(prisma, tableName, columnName = 'id') {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('public."${tableName}"', '${columnName}'),
      COALESCE((SELECT MAX("${columnName}") FROM "${tableName}"), 1),
      EXISTS (SELECT 1 FROM "${tableName}")
    );
  `)
}

export default async function seedParametros(prisma) {
  console.log("→ Seed parámetros y cuenta corriente...")

  for (const item of tipoPersona) {
    await prisma.tipoPersona.upsert({
      where: { id: item.id },
      update: { codigo: item.codigo, nombre: item.nombre, activo: item.activo },
      create: { id: item.id, codigo: item.codigo, nombre: item.nombre, activo: item.activo },
    })
  }

  const provinciaSantaFe = await prisma.provincia.upsert({
    where: { id: provincia[0].id },
    update: { codigo: provincia[0].codigo, nombre: provincia[0].nombre, activo: provincia[0].activo },
    create: { id: provincia[0].id, codigo: provincia[0].codigo, nombre: provincia[0].nombre, activo: provincia[0].activo },
  })

  for (const loc of localidad) {
    await prisma.localidad.upsert({
      where: { id: loc.id },
      update: {},
      create: {
        id: loc.id,
        nombre: loc.nombre,
        provinciaId: provinciaSantaFe.id,
        activo: loc.activo ?? true,
      },
    })
  }

  for (const item of condicionIva) {
    await prisma.condicionIva.upsert({
      where: { id: item.id },
      update: { codigo: item.codigo, nombre: item.nombre, activo: item.activo },
      create: { id: item.id, codigo: item.codigo, nombre: item.nombre, activo: item.activo },
    })
  }

  for (const item of ambientePropiedad) {
    await prisma.ambientePropiedad.upsert({
      where: { id: item.id },
      update: { codigo: item.codigo, nombre: item.nombre, activo: item.activo },
      create: {
        id: item.id,
        codigo: item.codigo,
        nombre: item.nombre,
        activo: item.activo,
      },
    })
  }

  for (const item of tipoPropiedad) {
    await prisma.tipoPropiedad.upsert({
      where: { id: item.id },
      update: { codigo: item.codigo, nombre: item.nombre, activo: item.activo },
      create: { id: item.id, codigo: item.codigo, nombre: item.nombre, activo: item.activo },
    })
  }

  for (const item of estadoPropiedad) {
    await prisma.estadoPropiedad.upsert({
      where: { id: item.id },
      update: { codigo: item.codigo, nombre: item.nombre, activo: item.activo },
      create: { id: item.id, codigo: item.codigo, nombre: item.nombre, activo: item.activo },
    })
  }

  for (const item of destinoPropiedad) {
    await prisma.destinoPropiedad.upsert({
      where: { id: item.id },
      update: { codigo: item.codigo, nombre: item.nombre, activo: item.activo },
      create: { id: item.id, codigo: item.codigo, nombre: item.nombre, activo: item.activo },
    })
  }

  // Seed periodicidades antes de tipos_impuesto_propiedad y tipo_cargo (para periodicidad_id)
  const periodicidadIdsByCodigo = {}
  for (const per of periodicidadImpuesto) {
    const row = await prisma.periodicidadImpuesto.upsert({
      where: { id: per.id },
      update: { codigo: per.codigo, nombre: per.nombre, activo: per.activo },
      create: { id: per.id, codigo: per.codigo, nombre: per.nombre, activo: per.activo },
    })
    periodicidadIdsByCodigo[row.codigo] = row.id
  }

  const tiposImpuestoCreados = {}
  for (const imp of tipoImpuestoPropiedad) {
    const periodicidadId = imp.periodicidadCodigo ? periodicidadIdsByCodigo[imp.periodicidadCodigo] ?? null : null
    const tipoImpuesto = await prisma.tipoImpuestoPropiedad.upsert({
      where: { id: imp.id },
      update: { codigo: imp.codigo, nombre: imp.nombre, activo: imp.activo, periodicidadId },
      create: {
        id: imp.id,
        codigo: imp.codigo,
        nombre: imp.nombre,
        activo: imp.activo,
        periodicidadId,
      },
    })
    tiposImpuestoCreados[imp.codigo] = tipoImpuesto
  }

  for (const campo of tipoImpuestoPropiedadCampo) {
    const tipoImpuesto = tiposImpuestoCreados[campo.tipoImpuestoCodigo]
    if (tipoImpuesto) {
      await prisma.tipoImpuestoPropiedadCampo.upsert({
        where: { id: campo.id },
        update: {
          tipoImpuestoId: tipoImpuesto.id,
          codigo: campo.codigo,
          nombre: campo.nombre,
          orden: campo.orden,
          activo: campo.activo,
        },
        create: {
          id: campo.id,
          tipoImpuestoId: tipoImpuesto.id,
          codigo: campo.codigo,
          nombre: campo.nombre,
          orden: campo.orden,
          activo: campo.activo,
        },
      })
    }
  }

  const tiposCargoCreados = {}
  for (const tc of tipoCargo) {
    const periodicidadId = tc.periodicidadCodigo ? periodicidadIdsByCodigo[tc.periodicidadCodigo] ?? null : null
    const tipoCargoRow = await prisma.tipoCargo.upsert({
      where: { id: tc.id },
      update: { codigo: tc.codigo, nombre: tc.nombre, activo: tc.activo, periodicidadId },
      create: {
        id: tc.id,
        codigo: tc.codigo,
        nombre: tc.nombre,
        activo: tc.activo,
        periodicidadId,
      },
    })
    tiposCargoCreados[tc.codigo] = tipoCargoRow
  }

  for (const campo of tipoCargoCampo) {
    const tipoCargo = tiposCargoCreados[campo.tipoCargoCodigo]
    if (tipoCargo) {
      await prisma.tipoCargoCampo.upsert({
        where: { id: campo.id },
        update: {
          tipoCargoId: tipoCargo.id,
          codigo: campo.codigo,
          nombre: campo.nombre,
          orden: campo.orden,
          activo: campo.activo,
        },
        create: {
          id: campo.id,
          tipoCargoId: tipoCargo.id,
          codigo: campo.codigo,
          nombre: campo.nombre,
          orden: campo.orden,
          activo: campo.activo,
        },
      })
    }
  }

  for (const item of tipoExpensa) {
    await prisma.tipoExpensa.upsert({
      where: { id: item.id },
      update: { codigo: item.codigo, nombre: item.nombre, activo: item.activo },
      create: { id: item.id, codigo: item.codigo, nombre: item.nombre, activo: item.activo },
    })
  }

  for (const doc of tipoDocumentoPropiedad) {
    await prisma.tipoDocumentoPropiedad.upsert({
      where: { id: doc.id },
      update: { codigo: doc.codigo, nombre: doc.nombre, activo: doc.activo },
      create: { id: doc.id, codigo: doc.codigo, nombre: doc.nombre, activo: doc.activo },
    })
  }

  for (const actor of actorResponsableContrato) {
    await prisma.actorResponsableContrato.upsert({
      where: { id: actor.id },
      update: { codigo: actor.codigo, nombre: actor.nombre, activo: actor.activo },
      create: { id: actor.id, codigo: actor.codigo, nombre: actor.nombre, activo: actor.activo },
    })
  }

  for (const est of estadoGarantiaContrato) {
    await prisma.estadoGarantiaContrato.upsert({
      where: { id: est.id },
      update: { codigo: est.codigo, nombre: est.nombre, activo: est.activo },
      create: { id: est.id, codigo: est.codigo, nombre: est.nombre, activo: est.activo },
    })
  }

  for (const est of estadoContrato) {
    await prisma.estadoContrato.upsert({
      where: { id: est.id },
      update: { codigo: est.codigo, nombre: est.nombre, esFinal: est.esFinal, activo: est.activo },
      create: { id: est.id, codigo: est.codigo, nombre: est.nombre, esFinal: est.esFinal, activo: est.activo },
    })
  }

  for (const tg of tipoGarantiaContrato) {
    await prisma.tipoGarantiaContrato.upsert({
      where: { id: tg.id },
      update: { codigo: tg.codigo, nombre: tg.nombre, activo: tg.activo },
      create: { id: tg.id, codigo: tg.codigo, nombre: tg.nombre, activo: tg.activo },
    })
  }

  for (const met of metodoAjusteContrato) {
    await prisma.metodoAjusteContrato.upsert({
      where: { id: met.id },
      update: { codigo: met.codigo, nombre: met.nombre, activo: met.activo },
      create: { id: met.id, codigo: met.codigo, nombre: met.nombre, activo: met.activo },
    })
  }

  for (const tg of tipoGastoInicialContrato) {
    await prisma.tipoGastoInicialContrato.upsert({
      where: { id: tg.id },
      update: {
        codigo: tg.codigo,
        nombre: tg.nombre,
        valorDefault: tg.valorDefault,
        esPorcentaje: tg.esPorcentaje,
        activo: tg.activo,
      },
      create: {
        id: tg.id,
        codigo: tg.codigo,
        nombre: tg.nombre,
        valorDefault: tg.valorDefault,
        esPorcentaje: tg.esPorcentaje,
        activo: tg.activo,
      },
    })
  }

  for (const rol of rolCliente) {
    await prisma.rolCliente.upsert({
      where: { id: rol.id },
      update: { codigo: rol.codigo, nombre: rol.nombre, activo: rol.activo ?? true },
      create: {
        id: rol.id,
        codigo: rol.codigo,
        nombre: rol.nombre,
        activo: rol.activo ?? true,
      },
    })
  }

  for (const est of estadoLiquidacion) {
    await prisma.estadoLiquidacion.upsert({
      where: { id: est.id },
      update: { codigo: est.codigo, nombre: est.nombre, esFinal: est.esFinal, activo: est.activo },
      create: {
        id: est.id,
        codigo: est.codigo,
        nombre: est.nombre,
        esFinal: est.esFinal,
        activo: est.activo,
      },
    })
  }

  for (const est of estadoItemLiquidacion) {
    await prisma.estadoItemLiquidacion.upsert({
      where: { id: est.id },
      update: { codigo: est.codigo, nombre: est.nombre, activo: est.activo },
      create: { id: est.id, codigo: est.codigo, nombre: est.nombre, activo: est.activo },
    })
  }

  for (const m of moneda) {
    await prisma.moneda.upsert({
      where: { id: m.id },
      update: { codigo: m.codigo, nombre: m.nombre, simbolo: m.simbolo, activo: m.activo },
      create: { id: m.id, codigo: m.codigo, nombre: m.nombre, simbolo: m.simbolo, activo: m.activo },
    })
  }

  for (const tipo of tipoMovimiento) {
    await prisma.tipoMovimiento.upsert({
      where: { id: tipo.id },
      update: { codigo: tipo.codigo, nombre: tipo.nombre, activo: tipo.activo },
      create: { id: tipo.id, codigo: tipo.codigo, nombre: tipo.nombre, activo: tipo.activo },
    })
  }

  for (const medio of medioPago) {
    await prisma.medioPago.upsert({
      where: { id: medio.id },
      update: { codigo: medio.codigo, nombre: medio.nombre, activo: medio.activo },
      create: { id: medio.id, codigo: medio.codigo, nombre: medio.nombre, activo: medio.activo },
    })
  }

  const tablasConSecuencia = [
    'tipos_persona',
    'provincias',
    'localidades',
    'condiciones_iva',
    'ambientes_propiedad',
    'tipos_propiedad',
    'estados_propiedad',
    'destinos_propiedad',
    'periodicidades_impuesto',
    'tipos_impuesto_propiedad',
    'tipos_impuesto_propiedad_campos',
    'tipos_cargo',
    'tipos_cargo_campos',
    'tipos_expensa',
    'tipos_documento_propiedad',
    'actores_responsable_contrato',
    'estados_garantia_contrato',
    'estados_contrato',
    'tipos_garantia_contrato',
    'metodos_ajuste_contrato',
    'tipos_gasto_inicial_contrato',
    'roles_cliente',
    'estados_liquidacion',
    'estados_item_liquidacion',
    'monedas',
    'tipos_movimiento',
    'medios_pago',
  ]

  for (const tabla of tablasConSecuencia) {
    await resetSequence(prisma, tabla)
  }

  console.log("✔ Parámetros y cuenta corriente creados/actualizados.")
}
