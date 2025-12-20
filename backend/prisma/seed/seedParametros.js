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
    where: { codigo: "MONO" },
    update: {},
    create: {
      codigo: "MONO",
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
    where: { codigo: "4MAS" },
    update: {},
    create: {
      codigo: "4MAS",
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
    where: { codigo: "VIV_FAM" },
    update: {},
    create: {
      codigo: "VIV_FAM",
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

  for (const imp of impuestos) {
    await prisma.tipoImpuestoPropiedad.upsert({
      where: { codigo: imp.codigo },
      update: {},
      create: {
        codigo: imp.codigo,
        nombre: imp.nombre,
        activo: true,
      },
    })
  }

  // -------------------------
  // Tipos de Cargo
  // -------------------------
  const tiposCargo = [
    { codigo: "ALQUILER", nombre: "Alquiler" },
    { codigo: "EXPENSAS", nombre: "Expensas" },
    { codigo: "SEGURO", nombre: "Seguro" },
    { codigo: "GASTO_EXTRA", nombre: "Gasto extra" },
  ]

  for (const tc of tiposCargo) {
    await prisma.tipoCargo.upsert({
      where: { codigo: tc.codigo },
      update: {},
      create: {
        codigo: tc.codigo,
        nombre: tc.nombre,
        activo: true,
      },
    })
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
    { codigo: "MENSUAL", nombre: "Mensual" },
    { codigo: "BIMESTRAL", nombre: "Bimestral" },
    { codigo: "TRIMESTRAL", nombre: "Trimestral" },
    { codigo: "CUATRIMESTRAL", nombre: "Cuatrimestral" },
    { codigo: "SEMESTRAL", nombre: "Semestral" },
    { codigo: "ANUAL", nombre: "Anual" },
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

  // ============================================================
  // NUEVO: Parámetros de Contratos
  // ============================================================

  // -------------------------
  // Actores Responsable Contrato
  // -------------------------
  const actoresResponsables = [
    { codigo: "INM", nombre: "Inmobiliaria / Administrador" },
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
    { codigo: "revision", nombre: "En revisión" },
    { codigo: "rechazada", nombre: "Rechazada" },
    { codigo: "aprobada", nombre: "Aprobada" },
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
    { codigo: "borrador", nombre: "Borrador" },
    { codigo: "pendiente_de_firma", nombre: "Pendiente de Firma" },
    { codigo: "vigente", nombre: "Vigente" },
    { codigo: "vencido", nombre: "Vencido" },
    { codigo: "prorrogado", nombre: "Prorrogado" },
    { codigo: "renovado", nombre: "Renovado" },
    { codigo: "rescindido", nombre: "Rescindido" },
    { codigo: "anulado", nombre: "Anulado" },
    { codigo: "finalizado", nombre: "Finalizado" },
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
      nombre: "Índice de Contratos de Locación (ICL)",
    },
    {
      codigo: "IPC",
      nombre: "Índice de Precios al Consumidor (IPC)",
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
      codigo: "CERRADA",
      nombre: "Cerrada",
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

  console.log("✔ Parámetros iniciales creados/actualizados.")
}
