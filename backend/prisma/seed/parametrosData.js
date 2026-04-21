/**
 * Única fuente de verdad para parámetros y datos de cuenta corriente.
 * Usado por: seedParametros.js y scripts/compare-seed-with-db.js
 * Si modificás algo aquí, tanto el seed como la comparación BD usan el mismo valor.
 */

export const tipoPersona = [
  { codigo: 'FISICA', nombre: 'Persona física', activo: true },
  { codigo: 'JURIDICA', nombre: 'Persona jurídica', activo: true },
]

export const provincia = [
  { codigo: 'SF', nombre: 'Santa Fe', activo: true },
]

export const localidad = [
  { id: 1, nombre: 'Rosario', provinciaCodigo: 'SF' },
  { id: 2, nombre: 'Carrizales', provinciaCodigo: 'SF' },
  { id: 3, nombre: 'Serodino', provinciaCodigo: 'SF' },
]

export const condicionIva = [
  { codigo: 'RI', nombre: 'Responsable Inscripto', activo: true },
  { codigo: 'MT', nombre: 'Monotributista', activo: true },
  { codigo: 'EX', nombre: 'Exento', activo: true },
  { codigo: 'CF', nombre: 'Consumidor Final', activo: true },
]

export const ambientePropiedad = [
  { id: 1, codigo: 'MONO', nombre: 'Monoambiente', activo: true },
  { id: 2, codigo: 'UNO', nombre: 'Un dormitorio', activo: true },
  { id: 3, codigo: 'DOS', nombre: 'Dos dormitorios', activo: true },
  { id: 4, codigo: 'TRES', nombre: 'Tres dormitorios', activo: true },
  { id: 5, codigo: 'CUATRO', nombre: 'Cuatro dormitorios', activo: true },
]

export const tipoPropiedad = [
  { codigo: 'CASA', nombre: 'Casa', activo: true },
  { codigo: 'DEPTO', nombre: 'Departamento', activo: true },
  { codigo: 'LOCAL', nombre: 'Local Comercial', activo: true },
  { codigo: 'OFICINA', nombre: 'Oficina', activo: true },
]

export const estadoPropiedad = [
  { codigo: 'DISP', nombre: 'Disponible', activo: true },
  { codigo: 'NO_DISP', nombre: 'No disponible', activo: true },
  { codigo: 'ALQ', nombre: 'Alquilada', activo: true },
  { codigo: 'RESERV', nombre: 'Reservada', activo: true },
  { codigo: 'DESOC', nombre: 'Desocupada', activo: true },
]

export const destinoPropiedad = [
  { codigo: 'VIV', nombre: 'Vivienda familiar', activo: true },
  { codigo: 'PROF', nombre: 'Uso profesional', activo: true },
  { codigo: 'COM', nombre: 'Comercial', activo: true },
]

export const tipoImpuestoPropiedad = [
  { codigo: 'AGUA', nombre: 'Agua', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { codigo: 'LUZ', nombre: 'Luz', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { codigo: 'GAS', nombre: 'Gas', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { codigo: 'TGI', nombre: 'TGI', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { codigo: 'API', nombre: 'API', activo: true, periodicidadCodigo: '2_BIMESTRAL' },
]

export const tipoImpuestoPropiedadCampo = [
  { tipoImpuestoCodigo: 'AGUA', codigo: 'P_SUM', nombre: 'Punto de Suministro', orden: 1, activo: true },
  { tipoImpuestoCodigo: 'AGUA', codigo: 'NRO_IDE', nombre: 'N° de identificacion', orden: 2, activo: false },
  { tipoImpuestoCodigo: 'LUZ', codigo: 'NRO_CLI', nombre: 'N° de cliente', orden: 1, activo: true },
  { tipoImpuestoCodigo: 'LUZ', codigo: 'PLAN', nombre: 'Plan', orden: 2, activo: true },
  { tipoImpuestoCodigo: 'LUZ', codigo: 'RUTA', nombre: 'Ruta', orden: 3, activo: true },
  { tipoImpuestoCodigo: 'LUZ', codigo: 'FOLIO', nombre: 'Folio', orden: 4, activo: true },
  { tipoImpuestoCodigo: 'LUZ', codigo: 'DS', nombre: 'D.S.', orden: 5, activo: true },
  { tipoImpuestoCodigo: 'GAS', codigo: 'NRO_CLI', nombre: 'N° de cliente', orden: 1, activo: true },
  { tipoImpuestoCodigo: 'GAS', codigo: 'NRO_PRS', nombre: 'N° de persona', orden: 2, activo: true },
  { tipoImpuestoCodigo: 'TGI', codigo: 'CTA', nombre: 'Cuenta', orden: 1, activo: true },
  { tipoImpuestoCodigo: 'TGI', codigo: 'COD_GES', nombre: 'Cod. Gest. Personal', orden: 2, activo: true },
  { tipoImpuestoCodigo: 'API', codigo: 'NRO_PART', nombre: 'N° de partida', orden: 1, activo: true },
]

export const tipoCargo = [
  { codigo: 'ALQUILER', nombre: 'Alquiler', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { codigo: 'EXPENSAS', nombre: 'Expensas', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { codigo: 'SEGURO', nombre: 'Seguro', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { codigo: 'GASTO_EXTRA', nombre: 'Gasto extra', activo: true },
  { codigo: 'GASTOS_ADMINISTRATIVOS', nombre: 'Gastos Administrativos', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { codigo: 'HONORARIOS', nombre: 'Honorarios', activo: true, periodicidadCodigo: '1_MENSUAL' },
  { codigo: 'INCIDENCIA', nombre: 'Incidencia', activo: true },
]

export const tipoCargoCampo = [
  { tipoCargoCodigo: 'EXPENSAS', codigo: 'ADM_CON', nombre: 'Administrador consorcio', orden: 1, activo: false },
  { tipoCargoCodigo: 'EXPENSAS', codigo: 'DIR', nombre: 'Dirección', orden: 2, activo: false },
  { tipoCargoCodigo: 'EXPENSAS', codigo: 'TEL', nombre: 'Teléfono', orden: 3, activo: false },
  { tipoCargoCodigo: 'EXPENSAS', codigo: 'MAIL', nombre: 'Email', orden: 4, activo: false },
  { tipoCargoCodigo: 'SEGURO', codigo: 'NRO_POLIZA', nombre: 'N° de Poliza', orden: 1, activo: false },
  { tipoCargoCodigo: 'SEGURO', codigo: 'ASEG', nombre: 'Aseguradora', orden: 2, activo: false },
]

export const tipoExpensa = [
  { codigo: 'ORD', nombre: 'Ordinarias', activo: true },
  { codigo: 'EXT', nombre: 'Extraordinarias', activo: true },
]

export const periodicidadImpuesto = [
  { codigo: '1_MENSUAL', nombre: 'Mensual', activo: true },
  { codigo: '2_BIMESTRAL', nombre: 'Bimestral', activo: true },
  { codigo: '3_TRIMESTRAL', nombre: 'Trimestral', activo: true },
  { codigo: '4_CUATRIMESTRAL', nombre: 'Cuatrimestral', activo: true },
  { codigo: '6_SEMESTRAL', nombre: 'Semestral', activo: true },
  { codigo: '12_ANUAL', nombre: 'Anual', activo: true },
]

export const tipoDocumentoPropiedad = [
  { codigo: 'ESCR', nombre: 'Escritura', activo: true },
  { codigo: 'REGL_COP', nombre: 'Reglamento Copropiedad', activo: true },
  { codigo: 'API', nombre: 'Api', activo: true },
  { codigo: 'TGI', nombre: 'Tgi', activo: true },
  { codigo: 'AGUA', nombre: 'Agua', activo: true },
  { codigo: 'LUZ', nombre: 'Luz', activo: true },
  { codigo: 'GAS', nombre: 'Gas', activo: true },
  { codigo: 'EXPENSAS', nombre: 'Expensas', activo: true },
  { codigo: 'DNI_TIT_CONY', nombre: 'Dni titular/es y cónyuge ambos lados', activo: true },
  { codigo: 'PODER_ESP', nombre: 'Poder especial en caso de ser necesario', activo: true },
]

export const actorResponsableContrato = [
  { codigo: 'INM', nombre: 'Inmobiliaria', activo: true },
  { codigo: 'INQ', nombre: 'Inquilino', activo: true },
  { codigo: 'PROP', nombre: 'Propietario', activo: true },
]

export const estadoGarantiaContrato = [
  { codigo: 'REVISION', nombre: 'En revisión', activo: true },
  { codigo: 'RECHAZADA', nombre: 'Rechazada', activo: true },
  { codigo: 'APROBADA', nombre: 'Aprobada', activo: true },
]

export const estadoContrato = [
  { codigo: 'BORRADOR', nombre: 'Borrador', activo: true },
  { codigo: 'PENDIENTE_FIRMA', nombre: 'Pendiente de Firma', activo: true },
  { codigo: 'VIGENTE', nombre: 'Vigente', activo: true },
  { codigo: 'VENCIDO', nombre: 'Vencido', activo: true },
  { codigo: 'PRORROGADO', nombre: 'Prorrogado', activo: true },
  { codigo: 'RENOVADO', nombre: 'Renovado', activo: true },
  { codigo: 'RESCINDIDO', nombre: 'Rescindido', activo: true },
  { codigo: 'ANULADO', nombre: 'Anulado', activo: true },
  { codigo: 'FINALIZADO', nombre: 'Finalizado', activo: true },
]

export const tipoGarantiaContrato = [
  { codigo: 'LAB', nombre: 'Laboral', activo: true },
  { codigo: 'PROP', nombre: 'Propietaria', activo: true },
  { codigo: 'CAUCION', nombre: 'Seguro de Caución', activo: true },
]

export const metodoAjusteContrato = [
  { codigo: 'ICL', nombre: 'Índice de Contratos de Locación', activo: true },
  { codigo: 'IPC', nombre: 'Índice de Precios al Consumidor', activo: true },
]

export const tipoGastoInicialContrato = [
  { codigo: 'SELLADO', nombre: 'Sellado de Contrato', valorDefault: 0.5, esPorcentaje: true, activo: true },
  { codigo: 'DEPOSITO', nombre: 'Depósito en garantía Inicial', valorDefault: 1, esPorcentaje: false, activo: true },
  { codigo: 'AVERIGUACION', nombre: 'Averiguación de garantías', valorDefault: null, esPorcentaje: false, activo: true },
  { codigo: 'HONORARIOS', nombre: 'Honorarios Inmobiliarios', valorDefault: 3, esPorcentaje: true, activo: true },
  { codigo: 'OTRO', nombre: 'Otro', valorDefault: null, esPorcentaje: false, activo: true },
]

export const rolCliente = [
  { codigo: 'INQUILINO', nombre: 'Inquilino', activo: true },
  { codigo: 'PROPIETARIO', nombre: 'Propietario', activo: true },
  { codigo: 'GARANTE', nombre: 'Garante', activo: true },
]

export const estadoLiquidacion = [
  { codigo: 'BORRADOR', nombre: 'Borrador', esFinal: false, activo: true },
  { codigo: 'LISTA', nombre: 'Lista para Emitir', esFinal: false, activo: true },
  { codigo: 'EMITIDA', nombre: 'Emitida', esFinal: false, activo: true },
  { codigo: 'SALDADA', nombre: 'Saldada', esFinal: true, activo: true },
  { codigo: 'ANULADA', nombre: 'Anulada', esFinal: true, activo: true },
]

export const estadoItemLiquidacion = [
  { codigo: 'PENDIENTE', nombre: 'Pendiente', activo: true },
  { codigo: 'COMPLETADO', nombre: 'Completado', activo: true },
  { codigo: 'NO_APLICA', nombre: 'No aplica', activo: true },
]

export const moneda = [
  { codigo: 'ARS', nombre: 'Peso', simbolo: '$', activo: true },
  { codigo: 'USD', nombre: 'Dólar', simbolo: 'U$S', activo: true },
]

/** Tipos de Movimiento (Cuenta Corriente) - antes en seedCuentaCorriente */
export const tipoMovimiento = [
  { codigo: 'DEBITO', nombre: 'Débito', activo: true },
  { codigo: 'CREDITO', nombre: 'Crédito', activo: true },
]

/** Medios de Pago (Cuenta Corriente) - antes en seedCuentaCorriente */
export const medioPago = [
  { codigo: 'EFECTIVO', nombre: 'Efectivo', activo: true },
  { codigo: 'TRANSFERENCIA', nombre: 'Transferencia Bancaria', activo: true },
  { codigo: 'CHEQUE', nombre: 'Cheque', activo: true },
  { codigo: 'DEBITO', nombre: 'Tarjeta de Débito', activo: true },
  { codigo: 'CREDITO', nombre: 'Tarjeta de Crédito', activo: true },
  { codigo: 'MERCADOPAGO', nombre: 'Mercado Pago', activo: true },
]

/** Objeto plano para el script de comparación (compare-seed-with-db.js) */
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
}
