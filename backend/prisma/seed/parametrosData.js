/**
 * Única fuente de verdad para parámetros y datos de cuenta corriente.
 * Refleja el estado actual de la base y preserva ids para restauraciones consistentes.
 */

export const tipoPersona = [
  { id: 1, codigo: 'FISICA', nombre: 'Persona física', activo: true },
  { id: 2, codigo: 'JURIDICA', nombre: 'Persona jurídica', activo: true },
];

export const provincia = [
  { id: 1, codigo: 'SF', nombre: 'Santa Fe', activo: true },
];

export const localidad = [
  { id: 1, nombre: 'Rosario', provinciaCodigo: 'SF', activo: true },
  { id: 2, nombre: 'Carrizales', provinciaCodigo: 'SF', activo: true },
  { id: 3, nombre: 'Serodino', provinciaCodigo: 'SF', activo: true },
  { id: 4, nombre: 'Totoras', provinciaCodigo: 'SF', activo: true },
  { id: 5, nombre: 'Tortugas', provinciaCodigo: 'SF', activo: true },
];

export const condicionIva = [
  { id: 1, codigo: 'RI', nombre: 'Responsable Inscripto', activo: true },
  { id: 2, codigo: 'MT', nombre: 'Monotributista', activo: true },
  { id: 3, codigo: 'EX', nombre: 'Exento', activo: true },
  { id: 4, codigo: 'CF', nombre: 'Consumidor Final', activo: true },
];

export const ambientePropiedad = [
  { id: 1, codigo: 'MONO', nombre: 'Monoambiente', activo: true },
  { id: 2, codigo: 'UNO', nombre: 'Un dormitorio', activo: true },
  { id: 3, codigo: 'DOS', nombre: 'Dos dormitorios', activo: true },
  { id: 4, codigo: 'TRES', nombre: 'Tres dormitorios', activo: true },
  { id: 5, codigo: 'CUATRO', nombre: 'Cuatro dormitorios', activo: true },
];

export const tipoPropiedad = [
  { id: 1, codigo: 'CASA', nombre: 'Casa', activo: true },
  { id: 2, codigo: 'DEPTO', nombre: 'Departamento', activo: true },
  { id: 3, codigo: 'LOCAL', nombre: 'Local Comercial', activo: true },
  { id: 4, codigo: 'OFICINA', nombre: 'Oficina', activo: true },
];

export const estadoPropiedad = [
  { id: 1, codigo: 'DISP', nombre: 'Disponible', activo: true },
  { id: 2, codigo: 'ALQ', nombre: 'Alquilada', activo: true },
  { id: 3, codigo: 'RESERV', nombre: 'Reservada', activo: true },
  { id: 4, codigo: 'DESOC', nombre: 'Desocupada', activo: true },
  { id: 5, codigo: 'NO_DISP', nombre: 'No disponible', activo: true },
];

export const destinoPropiedad = [
  { id: 1, codigo: 'VIV', nombre: 'Vivienda familiar', activo: true },
  { id: 2, codigo: 'PROF', nombre: 'Uso profesional', activo: true },
  { id: 3, codigo: 'COM', nombre: 'Comercial', activo: true },
];

export const periodicidadImpuesto = [
  { id: 1, codigo: '1_MENSUAL', nombre: 'Mensual', activo: true },
  { id: 2, codigo: '2_BIMESTRAL', nombre: 'Bimestral', activo: true },
  { id: 3, codigo: '3_TRIMESTRAL', nombre: 'Trimestral', activo: true },
  { id: 4, codigo: '4_CUATRIMESTRAL', nombre: 'Cuatrimestral', activo: true },
  { id: 5, codigo: '6_SEMESTRAL', nombre: 'Semestral', activo: true },
  { id: 6, codigo: '12_ANUAL', nombre: 'Anual', activo: true },
];

export const tipoImpuestoPropiedad = [
  { id: 1, codigo: 'AGUA', nombre: 'Agua', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { id: 2, codigo: 'LUZ', nombre: 'Luz', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { id: 3, codigo: 'GAS', nombre: 'Gas', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { id: 4, codigo: 'TGI', nombre: 'TGI', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { id: 5, codigo: 'API', nombre: 'API', activo: true, periodicidadCodigo: '2_BIMESTRAL' },
];

export const tipoImpuestoPropiedadCampo = [
  { id: 1, tipoImpuestoCodigo: 'AGUA', codigo: 'P_SUM', nombre: 'Punto de Suministro', orden: 1, activo: true },
  { id: 2, tipoImpuestoCodigo: 'AGUA', codigo: 'NRO_IDE', nombre: 'N° de identificacion', orden: 2, activo: false },
  { id: 3, tipoImpuestoCodigo: 'LUZ', codigo: 'NRO_CLI', nombre: 'N° de cliente', orden: 1, activo: true },
  { id: 7, tipoImpuestoCodigo: 'GAS', codigo: 'NRO_CLI', nombre: 'N° de cliente', orden: 1, activo: true },
  { id: 8, tipoImpuestoCodigo: 'GAS', codigo: 'NRO_PRS', nombre: 'N° de persona', orden: 2, activo: true },
  { id: 9, tipoImpuestoCodigo: 'TGI', codigo: 'CTA', nombre: 'Cuenta', orden: 1, activo: true },
  { id: 10, tipoImpuestoCodigo: 'TGI', codigo: 'COD_GES', nombre: 'Cod. Gest. Personal', orden: 2, activo: true },
  { id: 11, tipoImpuestoCodigo: 'API', codigo: 'NRO_PART', nombre: 'N° de partida', orden: 1, activo: true },
  { id: 12, tipoImpuestoCodigo: 'LUZ', codigo: 'PLAN', nombre: 'Plan', orden: 2, activo: true },
  { id: 13, tipoImpuestoCodigo: 'LUZ', codigo: 'RUTA', nombre: 'Ruta', orden: 3, activo: true },
  { id: 14, tipoImpuestoCodigo: 'LUZ', codigo: 'FOLIO', nombre: 'Folio', orden: 4, activo: true },
  { id: 15, tipoImpuestoCodigo: 'LUZ', codigo: 'DS', nombre: 'D.S.', orden: 5, activo: true },
];

export const tipoCargo = [
  { id: 1, codigo: 'ALQUILER', nombre: 'Alquiler', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { id: 2, codigo: 'EXPENSAS', nombre: 'Expensas', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { id: 3, codigo: 'SEGURO', nombre: 'Seguro', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { id: 4, codigo: 'GASTO_EXTRA', nombre: 'Gasto extra', activo: true },
  { id: 5, codigo: 'GASTOS_ADMINISTRATIVOS', nombre: 'Gastos Administrativos', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { id: 6, codigo: 'HONORARIOS', nombre: 'Honorarios', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { id: 7, codigo: 'INCIDENCIA', nombre: 'Incidencia', activo: true },
];

export const tipoCargoCampo = [
  { id: 1, tipoCargoCodigo: 'EXPENSAS', codigo: 'ADM_CON', nombre: 'Administrador consorcio', orden: 1, activo: true },
  { id: 2, tipoCargoCodigo: 'EXPENSAS', codigo: 'DIR', nombre: 'Dirección', orden: 2, activo: true },
  { id: 3, tipoCargoCodigo: 'EXPENSAS', codigo: 'TEL', nombre: 'Teléfono', orden: 3, activo: true },
  { id: 4, tipoCargoCodigo: 'EXPENSAS', codigo: 'MAIL', nombre: 'Email', orden: 4, activo: true },
  { id: 5, tipoCargoCodigo: 'SEGURO', codigo: 'NRO_POLIZA', nombre: 'N° de Poliza', orden: 1, activo: true },
  { id: 6, tipoCargoCodigo: 'SEGURO', codigo: 'ASEG', nombre: 'Aseguradora', orden: 2, activo: true },
];

export const tipoExpensa = [
  { id: 1, codigo: 'ORD', nombre: 'Ordinarias', activo: true },
  { id: 2, codigo: 'EXT', nombre: 'Extraordinarias', activo: true },
];

export const tipoDocumentoPropiedad = [
  { id: 1, codigo: 'ESCR', nombre: 'Escritura', activo: true },
  { id: 2, codigo: 'REGL_COP', nombre: 'Reglamento Copropiedad', activo: true },
  { id: 3, codigo: 'API', nombre: 'Api', activo: true },
  { id: 4, codigo: 'TGI', nombre: 'Tgi', activo: true },
  { id: 5, codigo: 'AGUA', nombre: 'Agua', activo: true },
  { id: 6, codigo: 'LUZ', nombre: 'Luz', activo: true },
  { id: 7, codigo: 'GAS', nombre: 'Gas', activo: true },
  { id: 8, codigo: 'EXPENSAS', nombre: 'Expensas', activo: true },
  { id: 9, codigo: 'DNI_TIT_CONY', nombre: 'Dni titular/es y cónyuge ambos lados', activo: true },
  { id: 10, codigo: 'PODER_ESP', nombre: 'Poder especial en caso de ser necesario', activo: true },
];

export const actorResponsableContrato = [
  { id: 1, codigo: 'INM', nombre: 'Inmobiliaria', activo: true },
  { id: 2, codigo: 'INQ', nombre: 'Inquilino', activo: true },
  { id: 3, codigo: 'PROP', nombre: 'Propietario', activo: true },
];

export const estadoGarantiaContrato = [
  { id: 1, codigo: 'REVISION', nombre: 'En revisión', activo: true },
  { id: 2, codigo: 'RECHAZADA', nombre: 'Rechazada', activo: true },
  { id: 3, codigo: 'APROBADA', nombre: 'Aprobada', activo: true },
];

export const estadoContrato = [
  { id: 1, codigo: 'BORRADOR', nombre: 'Borrador', esFinal: false, activo: true },
  { id: 2, codigo: 'PENDIENTE_FIRMA', nombre: 'Pendiente de Firma', esFinal: false, activo: true },
  { id: 3, codigo: 'VIGENTE', nombre: 'Vigente', esFinal: false, activo: true },
  { id: 4, codigo: 'VENCIDO', nombre: 'Vencido', esFinal: false, activo: true },
  { id: 5, codigo: 'PRORROGADO', nombre: 'Prorrogado', esFinal: false, activo: true },
  { id: 6, codigo: 'RENOVADO', nombre: 'Renovado', esFinal: false, activo: true },
  { id: 7, codigo: 'RESCINDIDO', nombre: 'Rescindido', esFinal: false, activo: true },
  { id: 8, codigo: 'ANULADO', nombre: 'Anulado', esFinal: false, activo: true },
  { id: 9, codigo: 'FINALIZADO', nombre: 'Finalizado', esFinal: false, activo: true },
];

export const tipoGarantiaContrato = [
  { id: 1, codigo: 'LAB', nombre: 'Laboral', activo: true },
  { id: 2, codigo: 'PROP', nombre: 'Propietaria', activo: true },
  { id: 3, codigo: 'CAUCION', nombre: 'Seguro de Caución', activo: true },
];

export const metodoAjusteContrato = [
  { id: 1, codigo: 'ICL', nombre: 'Índice de Contratos de Locación', activo: true },
  { id: 2, codigo: 'IPC', nombre: 'Índice de Precios al Consumidor', activo: true },
];

export const tipoGastoInicialContrato = [
  { id: 1, codigo: 'SELLADO', nombre: 'Sellado de Contrato', valorDefault: '0.5', esPorcentaje: true, activo: true },
  { id: 2, codigo: 'DEPOSITO', nombre: 'Depósito en garantía Inicial', valorDefault: '1', esPorcentaje: false, activo: true },
  { id: 3, codigo: 'AVERIGUACION', nombre: 'Averiguación de garantías', valorDefault: null, esPorcentaje: false, activo: true },
  { id: 4, codigo: 'HONORARIOS', nombre: 'Honorarios Inmobiliarios', valorDefault: '3', esPorcentaje: true, activo: true },
  { id: 5, codigo: 'OTRO', nombre: 'Otro', valorDefault: null, esPorcentaje: false, activo: true },
];

export const rolCliente = [
  { id: 1, codigo: 'INQUILINO', nombre: 'Inquilino', activo: true },
  { id: 2, codigo: 'PROPIETARIO', nombre: 'Propietario', activo: true },
  { id: 3, codigo: 'GARANTE', nombre: 'Garante', activo: true },
];

export const estadoLiquidacion = [
  { id: 1, codigo: 'BORRADOR', nombre: 'Borrador', esFinal: false, activo: true },
  { id: 2, codigo: 'LISTA', nombre: 'Lista para Emitir', esFinal: false, activo: true },
  { id: 3, codigo: 'EMITIDA', nombre: 'Emitida', esFinal: false, activo: true },
  { id: 4, codigo: 'SALDADA', nombre: 'Saldada', esFinal: true, activo: true },
  { id: 5, codigo: 'ANULADA', nombre: 'Anulada', esFinal: true, activo: true },
];

export const estadoItemLiquidacion = [
  { id: 1, codigo: 'PENDIENTE', nombre: 'Pendiente', activo: true },
  { id: 2, codigo: 'COMPLETADO', nombre: 'Completado', activo: true },
  { id: 3, codigo: 'NO_APLICA', nombre: 'No aplica', activo: true },
];

export const moneda = [
  { id: 1, codigo: 'ARS', nombre: 'Peso', simbolo: '$', activo: true },
  { id: 2, codigo: 'USD', nombre: 'Dólar', simbolo: 'U$S', activo: true },
];

export const tipoMovimiento = [
  { id: 1, codigo: 'DEBITO', nombre: 'Débito', activo: true },
  { id: 2, codigo: 'CREDITO', nombre: 'Crédito', activo: true },
];

export const medioPago = [
  { id: 1, codigo: 'EFECTIVO', nombre: 'Efectivo', activo: true },
  { id: 2, codigo: 'TRANSFERENCIA', nombre: 'Transferencia Bancaria', activo: true },
  { id: 3, codigo: 'CHEQUE', nombre: 'Cheque', activo: true },
  { id: 4, codigo: 'DEBITO', nombre: 'Tarjeta de Débito', activo: true },
  { id: 5, codigo: 'CREDITO', nombre: 'Tarjeta de Crédito', activo: true },
  { id: 6, codigo: 'MERCADOPAGO', nombre: 'Mercado Pago', activo: true },
];

export const EXPECTED = {
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
};
