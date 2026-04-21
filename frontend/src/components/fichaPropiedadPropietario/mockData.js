/**
 * Datos de demostración — Argentina, contrato tipo CABA.
 * En producción reemplazar por respuesta de API.
 */

export const mockFichaPropiedadPropietario = {
  emitidoEl: '2026-04-10',

  administradora: {
    razonSocial: 'Martínez & Asociados Negocios Inmobiliarios S.R.L.',
    direccion: 'Av. Santa Fe 2847, Piso 2, C1425BGJ CABA',
    telefono: '+54 11 4821-7700',
    email: 'administracion@martinez-inmobiliaria.com.ar',
    matriculaCorredor: 'CUCICBA 12345 / CM 67890'
  },

  identificacion: {
    direccionCompleta: 'Av. Corrientes 4523, Piso 4 Depto. B, Almagro, CABA',
    tipoPropiedad: 'Departamento',
    destino: 'Vivienda',
    ambientes: 3,
    superficieM2: 72,
    estadoPropiedad: 'Ocupado — contrato vigente',
    titulares: [
      { nombreCompleto: 'Roberto Daniel Fernández', cuit: '20-28456789-3' },
      { nombreCompleto: 'Laura Beatriz Fernández', cuit: '27-31567890-4' }
    ]
  },

  contrato: {
    inquilinoNombre: 'María Alejandra González',
    fechaInicio: '2024-03-01',
    fechaFin: '2029-02-28',
    duracionMeses: 60,
    montoInicial: 420000,
    montoActual: 485000,
    deposito: {
      montoOriginal: 420000,
      montoActualizado: 485000,
      titularFondos: 'Administración (cuenta recaudadora)'
    },
    garantias: [
      { tipo: 'Seguro de Caución', detalle: 'Fianzas y Crédito S.A. — Pól. caución' },
      { tipo: 'Garante solidario', detalle: 'Sr. Carlos M. Pérez' }
    ]
  },

  ajustes: {
    indicePactado: 'ICL (Índice de Contratos de Locación)',
    frecuenciaMeses: 4,
    ultimoAjuste: {
      fecha: '2026-01-05',
      porcentajeAplicado: 15.48
    },
    proximoAjuste: {
      fechaEstimada: '2026-05-05',
      montoEstimado: 558000,
      notaProyeccion: 'aprox. según variación ICL publicada al cierre del período'
    },
    historial: [
      { fecha: '2026-01-05', montoAnterior: 420000, montoNuevo: 485000, porcentaje: 15.48, indice: 'ICL' },
      { fecha: '2025-09-02', montoAnterior: 380000, montoNuevo: 420000, porcentaje: 10.53, indice: 'ICL' },
      { fecha: '2025-05-04', montoAnterior: 350000, montoNuevo: 380000, porcentaje: 8.57, indice: 'ICL' }
    ]
  },

  resumenFinanciero: {
    alquilerBrutoMensual: 485000,
    honorarios: { porcentaje: 5, monto: 24250 },
    gastosCargoPropietario: 18500,
    netoEstimadoMensual: 442250,
    liquidacionesRecientes: [
      { periodo: '2026-03', totalBoletaInquilino: 512800, netoPropietario: 467200, estado: 'Cobrado' },
      { periodo: '2026-02', totalBoletaInquilino: 508100, netoPropietario: 463400, estado: 'Cobrado' },
      { periodo: '2026-01', totalBoletaInquilino: 505000, netoPropietario: 460800, estado: 'Cobrado' },
      { periodo: '2025-12', totalBoletaInquilino: 501200, netoPropietario: 457900, estado: 'Cobrado' }
    ],
    pendientesCobro: [
      { periodo: '2026-04', monto: 471500 }
    ]
  },

  servicios: [
    {
      servicio: 'Electricidad (Distribuidora)',
      titularFigurante: 'Roberto D. Fernández',
      identificador: 'NIS 0123456789',
      responsablePago: 'Inquilino'
    },
    {
      servicio: 'Gas natural',
      titularFigurante: 'Roberto D. Fernández',
      identificador: 'Cuenta 987654',
      responsablePago: 'Inquilino'
    },
    {
      servicio: 'ABL / Tasas',
      titularFigurante: 'Fernández Roberto',
      identificador: 'Partida 12-345678-9',
      responsablePago: 'Propietario'
    },
    {
      servicio: 'Expensas ordinarias',
      titularFigurante: 'Consorcio Av. Corrientes 4523',
      identificador: 'UF 4B',
      responsablePago: 'Inquilino'
    }
  ],

  cobertura: {
    seguro: {
      compania: 'Rivadavia Seguros S.A.',
      numeroPoliza: 'RS-HOG-2025-884421',
      vencimiento: '2026-08-15',
      sumaOCobertura: 'Cobertura integral — suma asegurada movilera USD 45.000 equivalente'
    },
    documentacionArchivo: [
      { tipo: 'Escritura traslativa', estado: 'en archivo' },
      { tipo: 'Planos municipales aprobados', estado: 'en archivo' },
      { tipo: 'Reglamento de copropiedad', estado: 'en archivo' },
      { tipo: 'Certificado de inhibición', estado: 'no necesario' },
      { tipo: 'Acta de última asamblea', estado: 'en archivo' }
    ]
  }
};
