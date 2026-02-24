// prisma/seed/seedParametros.js

export default async function seedParametros(prisma) {
  console.log("→ Seed parámetros iniciales...")

  // -------------------------
  // Tipo de Persona
  // -------------------------
  await prisma.tipoPersona.upsert({
    where: { codigo: "FISICA" },
    update: {},
    create: {
      codigo: "FISICA",
      nombre: "Persona física",
      activo: true,
    },
  })

  await prisma.tipoPersona.upsert({
    where: { codigo: "JURIDICA" },
    update: {},
    create: {
      codigo: "JURIDICA",
      nombre: "Persona jurídica",
      activo: true,
    },
  })

  // -------------------------
  // Provincia (Santa Fe)
  // -------------------------
  const provinciaSantaFe = await prisma.provincia.upsert({
    where: { codigo: "SF" },
    update: {},
    create: {
      codigo: "SF",
      nombre: "Santa Fe",
      activo: true,
    },
  })

  // -------------------------
  // Localidades
  // -------------------------
  // Rosario
  await prisma.localidad.upsert({
    where: { id: 1 }, // usamos ID fijo porque nombre no es unique
    update: {},
    create: {
      id: 1,
      nombre: "Rosario",
      provinciaId: provinciaSantaFe.id,
      activo: true,
    },
  })

  // Carrizales
  await prisma.localidad.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      nombre: "Carrizales",
      provinciaId: provinciaSantaFe.id,
      activo: true,
    },
  })

  // -------------------------
  // Condición IVA
  // -------------------------
  await prisma.condicionIva.upsert({
    where: { codigo: "RI" },
    update: {},
    create: {
      codigo: "RI",
      nombre: "Responsable Inscripto",
      activo: true,
    },
  })

  await prisma.condicionIva.upsert({
    where: { codigo: "MT" },
    update: {},
    create: {
      codigo: "MT",
      nombre: "Monotributista",
      activo: true,
    },
  })

  await prisma.condicionIva.upsert({
    where: { codigo: "EX" },
    update: {},
    create: {
      codigo: "EX",
      nombre: "Exento",
      activo: true,
    },
  })

  // Consumidor Final
  await prisma.condicionIva.upsert({
    where: { codigo: "CF" },
    update: {},
    create: {
      codigo: "CF",
      nombre: "Consumidor Final",
      activo: true,
    },
  })

  // -------------------------
  // Ambientes Propiedad
  // -------------------------
  await prisma.ambientePropiedad.upsert({
    where: { codigo: "1AMB" },
    update: {},
    create: {
      codigo: "1AMB",
      nombre: "Monoambiente",
      activo: true,
    },
  })

  await prisma.ambientePropiedad.upsert({
    where: { codigo: "2AMB" },
    update: {},
    create: {
      codigo: "2AMB",
      nombre: "Dos ambientes",
      activo: true,
    },
  })

  await prisma.ambientePropiedad.upsert({
    where: { codigo: "3AMB" },
    update: {},
    create: {
      codigo: "3AMB",
      nombre: "Tres ambientes",
      activo: true,
    },
  })

  await prisma.ambientePropiedad.upsert({
    where: { codigo: "4AMB" },
    update: {},
    create: {
      codigo: "4AMB",
      nombre: "Cuatro o más ambientes",
      activo: true,
    },
  })

  // -------------------------
  // Tipos de Propiedad
  // -------------------------
  await prisma.tipoPropiedad.upsert({
    where: { codigo: "CASA" },
    update: {},
    create: {
      codigo: "CASA",
      nombre: "Casa",
      activo: true,
    },
  })

  await prisma.tipoPropiedad.upsert({
    where: { codigo: "DEPTO" },
    update: {},
    create: {
      codigo: "DEPTO",
      nombre: "Departamento",
      activo: true,
    },
  })

  await prisma.tipoPropiedad.upsert({
    where: { codigo: "LOCAL" },
    update: {},
    create: {
      codigo: "LOCAL",
      nombre: "Local Comercial",
      activo: true,
    },
  })

  await prisma.tipoPropiedad.upsert({
    where: { codigo: "OFICINA" },
    update: {},
    create: {
      codigo: "OFICINA",
      nombre: "Oficina",
      activo: true,
    },
  })

  // -------------------------
  // Estados de Propiedad
  // -------------------------
  await prisma.estadoPropiedad.upsert({
    where: { codigo: "DISP" },
    update: {},
    create: {
      codigo: "DISP",
      nombre: "Disponible",
      activo: true,
    },
  })

  await prisma.estadoPropiedad.upsert({
    where: { codigo: "ALQ" },
    update: {},
    create: {
      codigo: "ALQ",
      nombre: "Alquilada",
      activo: true,
    },
  })

  await prisma.estadoPropiedad.upsert({
    where: { codigo: "RESERV" },
    update: {},
    create: {
      codigo: "RESERV",
      nombre: "Reservada",
      activo: true,
    },
  })

  // -------------------------
  // Destinos de Propiedad
  // -------------------------
  await prisma.destinoPropiedad.upsert({
    where: { codigo: "VIV" },
    update: {},
    create: {
      codigo: "VIV",
      nombre: "Vivienda familiar",
      activo: true,
    },
  })

  await prisma.destinoPropiedad.upsert({
    where: { codigo: "PROF" },
    update: {},
    create: {
      codigo: "PROF",
      nombre: "Uso profesional",
      activo: true,
    },
  })

  await prisma.destinoPropiedad.upsert({
    where: { codigo: "COM" },
    update: {},
    create: {
      codigo: "COM",
      nombre: "Comercial",
      activo: true,
    },
  })

  // -------------------------
  // Tipo Impuesto Propiedad
  // -------------------------
  const impuestos = [
    { codigo: "AGUA", nombre: "Agua" },
    { codigo: "LUZ", nombre: "Luz" },
    { codigo: "GAS", nombre: "Gas" },
    { codigo: "TGI", nombre: "TGI" },
    { codigo: "API", nombre: "API" },
  ]

  const tiposImpuestoCreados = {}
  for (const imp of impuestos) {
    const tipoImpuesto = await prisma.tipoImpuestoPropiedad.upsert({
      where: { codigo: imp.codigo },
      update: {},
      create: {
        codigo: imp.codigo,
        nombre: imp.nombre,
        activo: true,
      },
    })
    tiposImpuestoCreados[imp.codigo] = tipoImpuesto
  }

  // -------------------------
  // Tipos de Impuesto Propiedad Campos
  // -------------------------
  const tiposImpuestoCampos = [
    // Campos para AGUA
    {
      tipoImpuestoCodigo: "AGUA",
      codigo: "P_SUM",
      nombre: "Punto de Suministro",
      orden: 1,
      activo: true,
    },
    {
      tipoImpuestoCodigo: "AGUA",
      codigo: "NRO_IDE",
      nombre: "N° de identificacion",
      orden: 2,
      activo: false,
    },
    // Campos para LUZ
    {
      tipoImpuestoCodigo: "LUZ",
      codigo: "NRO_CLI",
      nombre: "N° de cliente",
      orden: 1,
      activo: true,
    },
    {
      tipoImpuestoCodigo: "LUZ",
      codigo: "PLAN",
      nombre: "Plan",
      orden: 2,
      activo: true,
    },
    {
      tipoImpuestoCodigo: "LUZ",
      codigo: "RUTA",
      nombre: "Ruta",
      orden: 3,
      activo: true,
    },
    {
      tipoImpuestoCodigo: "LUZ",
      codigo: "DS",
      nombre: "D.S.",
      orden: 4,
      activo: true,
    },
    // Campos para GAS
    {
      tipoImpuestoCodigo: "GAS",
      codigo: "NRO_CLI",
      nombre: "N° de cliente",
      orden: 1,
      activo: true,
    },
    {
      tipoImpuestoCodigo: "GAS",
      codigo: "NRO_PRS",
      nombre: "N° de persona",
      orden: 2,
      activo: true,
    },
    // Campos para TGI
    {
      tipoImpuestoCodigo: "TGI",
      codigo: "CTA",
      nombre: "Cuenta",
      orden: 1,
      activo: true,
    },
    {
      tipoImpuestoCodigo: "TGI",
      codigo: "COD_GES",
      nombre: "Cod. Gest. Personal",
      orden: 2,
      activo: true,
    },
    // Campos para API
    {
      tipoImpuestoCodigo: "API",
      codigo: "NRO_PART",
      nombre: "N° de partida",
      orden: 1,
      activo: true,
    },
  ]

  for (const campo of tiposImpuestoCampos) {
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

  // -------------------------
  // Tipos de Cargo
  // -------------------------
  const tiposCargo = [
    { codigo: "ALQUILER", nombre: "Alquiler" },
    { codigo: "EXPENSAS", nombre: "Expensas" },
    { codigo: "SEGURO", nombre: "Seguro" },
    { codigo: "GASTO_EXTRA", nombre: "Gasto extra" },
    { codigo: "GASTOS_ADMINISTRATIVOS", nombre: "Gastos Administrativos" },
    { codigo: "HONORARIOS", nombre: "Honorarios" },
    { codigo: "INCIDENCIA", nombre: "Incidencia" },
  ]

  const tiposCargoCreados = {}
  for (const tc of tiposCargo) {
    const tipoCargo = await prisma.tipoCargo.upsert({
      where: { codigo: tc.codigo },
      update: {},
      create: {
        codigo: tc.codigo,
        nombre: tc.nombre,
        activo: true,
      },
    })
    tiposCargoCreados[tc.codigo] = tipoCargo
  }

  // -------------------------
  // Tipos de Cargo Campos
  // -------------------------
  const tiposCargoCampos = [
    // Campos para EXPENSAS
    {
      tipoCargoCodigo: "EXPENSAS",
      codigo: "ADM_CON",
      nombre: "Administrador consorcio",
      orden: 1,
    },
    {
      tipoCargoCodigo: "EXPENSAS",
      codigo: "DIR",
      nombre: "Dirección",
      orden: 2,
    },
    {
      tipoCargoCodigo: "EXPENSAS",
      codigo: "TEL",
      nombre: "Teléfono",
      orden: 3,
    },
    {
      tipoCargoCodigo: "EXPENSAS",
      codigo: "MAIL",
      nombre: "Email",
      orden: 4,
    },
    // Campos para SEGURO
    {
      tipoCargoCodigo: "SEGURO",
      codigo: "NRO_POLIZA",
      nombre: "N° de Poliza",
      orden: 1,
    },
    {
      tipoCargoCodigo: "SEGURO",
      codigo: "ASEG",
      nombre: "Aseguradora",
      orden: 2,
    },
  ]

  for (const campo of tiposCargoCampos) {
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

  // -------------------------
  // Tipos de Expensa
  // -------------------------
  await prisma.tipoExpensa.upsert({
    where: { codigo: "ORD" },
    update: {},
    create: {
      codigo: "ORD",
      nombre: "Ordinaria",
      activo: true,
    },
  })

  await prisma.tipoExpensa.upsert({
    where: { codigo: "EXT" },
    update: {},
    create: {
      codigo: "EXT",
      nombre: "Extraordinaria",
      activo: true,
    },
  })

  // -------------------------
  // Periodicidades de Impuesto
  // -------------------------
  const periodicidades = [
    { codigo: "1_MENSUAL", nombre: "Mensual" },
    { codigo: "2_BIMESTRAL", nombre: "Bimestral" },
    { codigo: "3_TRIMESTRAL", nombre: "Trimestral" },
    { codigo: "4_CUATRIMESTRAL", nombre: "Cuatrimestral" },
    { codigo: "6_SEMESTRAL", nombre: "Semestral" },
    { codigo: "12_ANUAL", nombre: "Anual" },
  ]

  for (const per of periodicidades) {
    await prisma.periodicidadImpuesto.upsert({
      where: { codigo: per.codigo },
      update: {},
      create: {
        codigo: per.codigo,
        nombre: per.nombre,
        activo: true,
      },
    })
  }

  // -------------------------
  // Tipos de Documento de Propiedad
  // -------------------------
  const tiposDocumento = [
    { codigo: "ESCR", nombre: "Escritura" },
    { codigo: "REGL_COP", nombre: "Reglamento Copropiedad" },
    { codigo: "API", nombre: "Api" },
    { codigo: "TGI", nombre: "Tgi" },
    { codigo: "AGUA", nombre: "Agua" },
    { codigo: "LUZ", nombre: "Luz" },
    { codigo: "GAS", nombre: "Gas" },
    { codigo: "EXPENSAS", nombre: "Expensas" },
    { codigo: "DNI_TIT_CONY", nombre: "Dni titular/es y cónyuge ambos lados" },
    { codigo: "PODER_ESP", nombre: "Poder especial en caso de ser necesario" },
  ]

  for (const doc of tiposDocumento) {
    await prisma.tipoDocumentoPropiedad.upsert({
      where: { codigo: doc.codigo },
      update: {},
      create: {
        codigo: doc.codigo,
        nombre: doc.nombre,
        activo: true,
      },
    })
  }

  // -------------------------
  // Actores Responsable Contrato
  // -------------------------
  const actoresResponsables = [
    { codigo: "INM", nombre: "Inmobiliaria" },
    { codigo: "INQ", nombre: "Inquilino" },
    { codigo: "PROP", nombre: "Propietario" },
  ]

  for (const actor of actoresResponsables) {
    await prisma.actorResponsableContrato.upsert({
      where: { codigo: actor.codigo },
      update: {},
      create: {
        codigo: actor.codigo,
        nombre: actor.nombre,
        activo: true,
      },
    })
  }

  // -------------------------
  // Estados Garantía Contrato
  // -------------------------
  const estadosGarantia = [
    { codigo: "REVISION", nombre: "En revisión" },
    { codigo: "RECHAZADA", nombre: "Rechazada" },
    { codigo: "APROBADA", nombre: "Aprobada" },
  ]

  for (const est of estadosGarantia) {
    await prisma.estadoGarantiaContrato.upsert({
      where: { codigo: est.codigo },
      update: {},
      create: {
        codigo: est.codigo,
        nombre: est.nombre,
        activo: true,
      },
    })
  }

  // -------------------------
  // Estados de Contrato
  // -------------------------
  const estadosContrato = [
    { codigo: "BORRADOR", nombre: "Borrador" },
    { codigo: "PENDIENTE_FIRMA", nombre: "Pendiente de Firma" },
    { codigo: "VIGENTE", nombre: "Vigente" },
    { codigo: "VENCIDO", nombre: "Vencido" },
    { codigo: "PRORROGADO", nombre: "Prorrogado" },
    { codigo: "RENOVADO", nombre: "Renovado" },
    { codigo: "RESCINDIDO", nombre: "Rescindido" },
    { codigo: "ANULADO", nombre: "Anulado" },
    { codigo: "FINALIZADO", nombre: "Finalizado" },
  ]

  for (const est of estadosContrato) {
    await prisma.estadoContrato.upsert({
      where: { codigo: est.codigo },
      update: {},
      create: {
        codigo: est.codigo,
        nombre: est.nombre,
        activo: true,
      },
    })
  }

  // -------------------------
  // Tipos de Garantía Contrato
  // -------------------------
  const tiposGarantia = [
    { codigo: "LAB", nombre: "Laboral" },
    { codigo: "PROP", nombre: "Propietaria" },
    { codigo: "CAUCION", nombre: "Seguro de Caución" },
  ]

  for (const tg of tiposGarantia) {
    await prisma.tipoGarantiaContrato.upsert({
      where: { codigo: tg.codigo },
      update: {},
      create: {
        codigo: tg.codigo,
        nombre: tg.nombre,
        activo: true,
      },
    })
  }
  
  // -------------------------
  // Métodos de Ajuste de Contrato
  // -------------------------
  const metodosAjuste = [
    {
      codigo: "ICL",
      nombre: "Índice de Contratos de Locación",
    },
    {
      codigo: "IPC",
      nombre: "Índice de Precios al Consumidor",
    },
  ]

  for (const met of metodosAjuste) {
    await prisma.metodoAjusteContrato.upsert({
      where: { codigo: met.codigo },
      update: {},
      create: {
        codigo: met.codigo,
        nombre: met.nombre,
        activo: true,
      },
    })
  }
  
   // -------------------------
  // Tipos de Gasto Inicial
  // -------------------------

  const tiposGastoInicial = [
    {
      codigo: "SELLADO",
      nombre: "Sellado de Contrato",
      valorDefault: 0.5, // 0.5% (ejemplo)
      esPorcentaje: true,
    },
    {
      codigo: "DEPOSITO",
      nombre: "Depósito en garantía Inicial",
      valorDefault: 1, // 1 mes de alquiler (generalmente)
      esPorcentaje: false,
    },
    {
      codigo: "AVERIGUACION",
      nombre: "Averiguación de garantías",
      valorDefault: null,
      esPorcentaje: false,
    },
    {
      codigo: "HONORARIOS",
      nombre: "Honorarios Inmobiliarios",
      valorDefault: 3, // ejemplo: 3% del monto del contrato
      esPorcentaje: true,
    },
    {
      codigo: "OTRO",
      nombre: "Otro",
      valorDefault: null,
      esPorcentaje: false,
    },
  ];

  for (const tg of tiposGastoInicial) {
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

// -------------------------
  // Estados de Liquidación
  // -------------------------
  const estadosLiquidacion = [
    {
      codigo: "BORRADOR",
      nombre: "Borrador",
      esFinal: false,
    },
    {
      codigo: "EMITIDA",
      nombre: "Emitida",
      esFinal: false,
    },
    {
      codigo: "LISTA",
      nombre: "Lista para Emitir",
      esFinal: true,
    },
    {
      codigo: "ANULADA",
      nombre: "Anulada",
      esFinal: true,
    },
  ]

  for (const est of estadosLiquidacion) {
    await prisma.estadoLiquidacion.upsert({
      where: { codigo: est.codigo },
      update: {
        nombre: est.nombre,
        esFinal: est.esFinal,
        activo: true,
      },
      create: {
        codigo: est.codigo,
        nombre: est.nombre,
        esFinal: est.esFinal,
        activo: true,
      },
    })
  }

  // -------------------------
  // Estados de Item de Liquidación
  // -------------------------
  const estadosItemLiquidacion = [
    {
      codigo: "PENDIENTE",
      nombre: "Pendiente",
    },
    {
      codigo: "COMPLETADO",
      nombre: "Completado",
    },
    {
      codigo: "NO_APLICA",
      nombre: "No aplica",
    },
  ]

  for (const est of estadosItemLiquidacion) {
    await prisma.estadoItemLiquidacion.upsert({
      where: { codigo: est.codigo },
      update: {
        nombre: est.nombre,
        activo: true,
      },
      create: {
        codigo: est.codigo,
        nombre: est.nombre,
        activo: true,
      },
    })
  }

  // -------------------------
  // Monedas
  // -------------------------
  const monedas = [
    {
      codigo: "ARS",
      nombre: "Peso",
      simbolo: "$",
    },
    {
      codigo: "USD",
      nombre: "Dólar",
      simbolo: "U$S",
    },
  ]

  for (const moneda of monedas) {
    await prisma.moneda.upsert({
      where: { codigo: moneda.codigo },
      update: {
        nombre: moneda.nombre,
        simbolo: moneda.simbolo,
        activo: true,
      },
      create: {
        codigo: moneda.codigo,
        nombre: moneda.nombre,
        simbolo: moneda.simbolo,
        activo: true,
      },
    })
  }

  console.log("✔ Parámetros iniciales creados/actualizados.")
}
