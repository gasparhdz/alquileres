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

export default async function seedParametros(prisma) {
  console.log("→ Seed parámetros y cuenta corriente...")

  for (const item of tipoPersona) {
    await prisma.tipoPersona.upsert({
      where: { codigo: item.codigo },
      update: {},
      create: { codigo: item.codigo, nombre: item.nombre, activo: item.activo },
    })
  }

  const provinciaSantaFe = await prisma.provincia.upsert({
    where: { codigo: provincia[0].codigo },
    update: {},
    create: { codigo: provincia[0].codigo, nombre: provincia[0].nombre, activo: provincia[0].activo },
  })

  for (const loc of localidad) {
    await prisma.localidad.upsert({
      where: { id: loc.id },
      update: {},
      create: {
        id: loc.id,
        nombre: loc.nombre,
        provinciaId: provinciaSantaFe.id,
        activo: true,
      },
    })
  }

  for (const item of condicionIva) {
    await prisma.condicionIva.upsert({
      where: { codigo: item.codigo },
      update: {},
      create: { codigo: item.codigo, nombre: item.nombre, activo: item.activo },
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
      where: { codigo: item.codigo },
      update: {},
      create: { codigo: item.codigo, nombre: item.nombre, activo: item.activo },
    })
  }

  for (const item of estadoPropiedad) {
    await prisma.estadoPropiedad.upsert({
      where: { codigo: item.codigo },
      update: { nombre: item.nombre, activo: item.activo },
      create: { codigo: item.codigo, nombre: item.nombre, activo: item.activo },
    })
  }

  for (const item of destinoPropiedad) {
    await prisma.destinoPropiedad.upsert({
      where: { codigo: item.codigo },
      update: {},
      create: { codigo: item.codigo, nombre: item.nombre, activo: item.activo },
    })
  }

  // Seed periodicidades antes de tipos_impuesto_propiedad y tipo_cargo (para periodicidad_id)
  const periodicidadIdsByCodigo = {}
  for (const per of periodicidadImpuesto) {
    const row = await prisma.periodicidadImpuesto.upsert({
      where: { codigo: per.codigo },
      update: {},
      create: { codigo: per.codigo, nombre: per.nombre, activo: true },
    })
    periodicidadIdsByCodigo[row.codigo] = row.id
  }

  const tiposImpuestoCreados = {}
  for (const imp of tipoImpuestoPropiedad) {
    const periodicidadId = imp.periodicidadCodigo ? periodicidadIdsByCodigo[imp.periodicidadCodigo] ?? null : null
    const tipoImpuesto = await prisma.tipoImpuestoPropiedad.upsert({
      where: { codigo: imp.codigo },
      update: { periodicidadId },
      create: {
        codigo: imp.codigo,
        nombre: imp.nombre,
        activo: true,
        periodicidadId,
      },
    })
    tiposImpuestoCreados[imp.codigo] = tipoImpuesto
  }

  for (const campo of tipoImpuestoPropiedadCampo) {
    const tipoImpuesto = tiposImpuestoCreados[campo.tipoImpuestoCodigo]
    if (tipoImpuesto) {
      const campoExistente = await prisma.tipoImpuestoPropiedadCampo.findFirst({
        where: {
          tipoImpuestoId: tipoImpuesto.id,
          codigo: campo.codigo,
        },
      })

      if (campoExistente) {
        await prisma.tipoImpuestoPropiedadCampo.update({
          where: { id: campoExistente.id },
          data: {
            nombre: campo.nombre,
            orden: campo.orden,
            activo: campo.activo,
          },
        })
      } else {
        await prisma.tipoImpuestoPropiedadCampo.create({
          data: {
            tipoImpuestoId: tipoImpuesto.id,
            codigo: campo.codigo,
            nombre: campo.nombre,
            orden: campo.orden,
            activo: campo.activo,
          },
        })
      }
    }
  }

  const tiposCargoCreados = {}
  for (const tc of tipoCargo) {
    const periodicidadId = tc.periodicidadCodigo ? periodicidadIdsByCodigo[tc.periodicidadCodigo] ?? null : null
    const tipoCargoRow = await prisma.tipoCargo.upsert({
      where: { codigo: tc.codigo },
      update: { periodicidadId },
      create: {
        codigo: tc.codigo,
        nombre: tc.nombre,
        activo: true,
        periodicidadId,
      },
    })
    tiposCargoCreados[tc.codigo] = tipoCargoRow
  }

  for (const campo of tipoCargoCampo) {
    const tipoCargo = tiposCargoCreados[campo.tipoCargoCodigo]
    if (tipoCargo) {
      const campoExistente = await prisma.tipoCargoCampo.findFirst({
        where: {
          tipoCargoId: tipoCargo.id,
          codigo: campo.codigo,
        },
      })

      if (campoExistente) {
        await prisma.tipoCargoCampo.update({
          where: { id: campoExistente.id },
          data: {
            nombre: campo.nombre,
            orden: campo.orden,
            activo: true,
          },
        })
      } else {
        await prisma.tipoCargoCampo.create({
          data: {
            tipoCargoId: tipoCargo.id,
            codigo: campo.codigo,
            nombre: campo.nombre,
            orden: campo.orden,
            activo: true,
          },
        })
      }
    }
  }

  for (const item of tipoExpensa) {
    await prisma.tipoExpensa.upsert({
      where: { codigo: item.codigo },
      update: {},
      create: { codigo: item.codigo, nombre: item.nombre, activo: item.activo },
    })
  }

  for (const doc of tipoDocumentoPropiedad) {
    await prisma.tipoDocumentoPropiedad.upsert({
      where: { codigo: doc.codigo },
      update: {},
      create: { codigo: doc.codigo, nombre: doc.nombre, activo: true },
    })
  }

  for (const actor of actorResponsableContrato) {
    await prisma.actorResponsableContrato.upsert({
      where: { codigo: actor.codigo },
      update: {},
      create: { codigo: actor.codigo, nombre: actor.nombre, activo: true },
    })
  }

  for (const est of estadoGarantiaContrato) {
    await prisma.estadoGarantiaContrato.upsert({
      where: { codigo: est.codigo },
      update: {},
      create: { codigo: est.codigo, nombre: est.nombre, activo: true },
    })
  }

  for (const est of estadoContrato) {
    await prisma.estadoContrato.upsert({
      where: { codigo: est.codigo },
      update: {},
      create: { codigo: est.codigo, nombre: est.nombre, activo: true },
    })
  }

  for (const tg of tipoGarantiaContrato) {
    await prisma.tipoGarantiaContrato.upsert({
      where: { codigo: tg.codigo },
      update: {},
      create: { codigo: tg.codigo, nombre: tg.nombre, activo: true },
    })
  }

  for (const met of metodoAjusteContrato) {
    await prisma.metodoAjusteContrato.upsert({
      where: { codigo: met.codigo },
      update: {},
      create: { codigo: met.codigo, nombre: met.nombre, activo: true },
    })
  }

  for (const tg of tipoGastoInicialContrato) {
    await prisma.tipoGastoInicialContrato.upsert({
      where: { codigo: tg.codigo },
      update: {
        nombre: tg.nombre,
        valorDefault: tg.valorDefault,
        esPorcentaje: tg.esPorcentaje,
        activo: true,
      },
      create: {
        codigo: tg.codigo,
        nombre: tg.nombre,
        valorDefault: tg.valorDefault,
        esPorcentaje: tg.esPorcentaje,
        activo: true,
      },
    })
  }

  for (const rol of rolCliente) {
    await prisma.rolCliente.upsert({
      where: { codigo: rol.codigo },
      update: { nombre: rol.nombre, activo: rol.activo ?? true },
      create: {
        codigo: rol.codigo,
        nombre: rol.nombre,
        activo: rol.activo ?? true,
      },
    })
  }

  for (const est of estadoLiquidacion) {
    await prisma.estadoLiquidacion.upsert({
      where: { codigo: est.codigo },
      update: { nombre: est.nombre, esFinal: est.esFinal, activo: true },
      create: {
        codigo: est.codigo,
        nombre: est.nombre,
        esFinal: est.esFinal,
        activo: true,
      },
    })
  }

  for (const est of estadoItemLiquidacion) {
    await prisma.estadoItemLiquidacion.upsert({
      where: { codigo: est.codigo },
      update: { nombre: est.nombre, activo: true },
      create: { codigo: est.codigo, nombre: est.nombre, activo: true },
    })
  }

  for (const m of moneda) {
    await prisma.moneda.upsert({
      where: { codigo: m.codigo },
      update: { nombre: m.nombre, simbolo: m.simbolo, activo: true },
      create: { codigo: m.codigo, nombre: m.nombre, simbolo: m.simbolo, activo: true },
    })
  }

  for (const tipo of tipoMovimiento) {
    await prisma.tipoMovimiento.upsert({
      where: { codigo: tipo.codigo },
      update: { nombre: tipo.nombre, activo: true },
      create: { codigo: tipo.codigo, nombre: tipo.nombre, activo: true },
    })
  }

  for (const medio of medioPago) {
    await prisma.medioPago.upsert({
      where: { codigo: medio.codigo },
      update: { nombre: medio.nombre, activo: true },
      create: { codigo: medio.codigo, nombre: medio.nombre, activo: true },
    })
  }

  console.log("✔ Parámetros y cuenta corriente creados/actualizados.")
}
