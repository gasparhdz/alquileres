import { jsPDF } from 'jspdf';
import dayjs from 'dayjs';

const formatoMoneda = (valor) => {
  if (valor == null) return '$ 0,00';
  return `$ ${parseFloat(valor).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const formatoFecha = (fecha) => {
  if (!fecha) return '-';
  return dayjs(fecha).format('DD/MM/YYYY');
};

// Orden predefinido de items de liquidación (mismo que en Liquidaciones.jsx)
const ORDEN_ITEMS_LIQUIDACION = [
  'GASTO_INICIAL_DEPOSITO',
  'GASTO_INICIAL_SELLADO',
  'GASTO_INICIAL_AVERIGUACION',
  'GASTO_INICIAL_HONORARIOS',
  'GASTO_INICIAL_OTRO',
  'ALQUILER',
  'GASTOS_ADMINISTRATIVOS',
  'SEGURO',
  'TGI',
  'AGUA',
  'GAS',
  'API',
  'EXPENSAS',
  'LUZ'
];

// Función para obtener el código de un item para ordenamiento
const getItemCodigoForSort = (item) => {
  if (item.contratoGastoInicial?.tipoGastoInicial?.codigo) {
    return 'GASTO_INICIAL_' + item.contratoGastoInicial.tipoGastoInicial.codigo;
  }
  if (item.propiedadImpuesto?.tipoImpuesto?.codigo) {
    return item.propiedadImpuesto.tipoImpuesto.codigo;
  }
  if (item.tipoCargo?.codigo) {
    return item.tipoCargo.codigo;
  }
  if (item.tipoExpensa?.codigo) {
    return 'EXPENSAS';
  }
  return '';
};

// Función para ordenar items de liquidación
const ordenarItems = (items) => {
  return [...items].sort((a, b) => {
    const codigoA = getItemCodigoForSort(a);
    const codigoB = getItemCodigoForSort(b);
    const indexA = ORDEN_ITEMS_LIQUIDACION.indexOf(codigoA);
    const indexB = ORDEN_ITEMS_LIQUIDACION.indexOf(codigoB);
    const posA = indexA === -1 ? 999 : indexA;
    const posB = indexB === -1 ? 999 : indexB;
    return posA - posB;
  });
};

/**
 * Calcula el importe que debe aparecer en la boleta del inquilino para un item
 * Retorna el importe con el signo correcto (positivo = cargo, negativo = crédito)
 * Retorna null si el item no debe aparecer en la boleta
 * 
 * Lógica:
 * - Si quienSoportaCosto === 'INQ' → cargo al inquilino (positivo)
 * - Si quienSoportaCosto === 'PROP' y pagadoPorActor === 'INQ' → inquilino pagó por propietario, crédito (negativo)
 * - Cualquier otro caso → no aparece en la boleta del inquilino
 */
const importeEnBoleta = (item) => {
  const importe = item.importe ? parseFloat(item.importe) : 0;
  if (isNaN(importe) || importe === 0) return null;

  const soportaCostoCodigo = item.quienSoportaCosto?.codigo;
  const pagadoPorCodigo = item.pagadoPorActor?.codigo;

  // Caso 1: Inquilino soporta el costo → cargo positivo
  if (soportaCostoCodigo === 'INQ') {
    return Math.abs(importe);
  }

  // Caso 2: Propietario soporta pero inquilino pagó → crédito/reintegro negativo
  if (soportaCostoCodigo === 'PROP' && pagadoPorCodigo === 'INQ') {
    return -Math.abs(importe);
  }

  // Cualquier otro caso no aparece en la boleta del inquilino
  return null;
};

export async function generarBoletaPDF(liquidacion) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // ===== ENCABEZADO =====
  
  // COLUMNA IZQUIERDA: Logo + datos empresa + X (imagen completa)
  try {
    const logoImg = await loadImage('/logo-empresa.png');
    doc.addImage(logoImg, 'PNG', margin, 0, 115, 55);
  } catch (e) {
    console.warn('No se pudo cargar el logo:', e);
  }

  // COLUMNA DERECHA: BOLETA, Pág, N°, Fecha
  
  // Pág. 1/1 (arriba derecha)
  doc.setFontSize(8);
  doc.text('Pág. 1/1', pageWidth - margin, 10, { align: 'right' });

  // BOLETA
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('BOLETA', pageWidth - margin, 20, { align: 'right' });

  // N° y FECHA
  const nroBoleta = String(liquidacion.id).padStart(8, '0');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('N°:', pageWidth - margin - 35, 30);
  doc.setFont('helvetica', 'normal');
  doc.text(nroBoleta, pageWidth - margin, 30, { align: 'right' });
  
  doc.setFont('helvetica', 'bold');
  doc.text('FECHA:', pageWidth - margin - 35, 36);
  doc.setFont('helvetica', 'normal');
  doc.text(formatoFecha(new Date()), pageWidth - margin, 36, { align: 'right' });

  // ===== LÍNEA SEPARADORA =====
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(margin, 54, pageWidth - margin, 54);

  // ===== DATOS CLIENTE Y PROPIEDAD =====
  const inquilino = liquidacion.contrato?.inquilino;
  const propiedad = liquidacion.contrato?.propiedad;
  
  const clienteNombre = inquilino?.razonSocial || 
    `${inquilino?.apellido || ''}, ${inquilino?.nombre || ''}`.trim() || 'Sin datos';
  
  const propiedadDir = propiedad ? 
    `${propiedad.dirCalle || ''} ${propiedad.dirNro || ''}${propiedad.dirPiso ? ` ${propiedad.dirPiso}°` : ''}${propiedad.dirDepto ? ` "${propiedad.dirDepto}"` : ''}`.trim() 
    : '-';
  
  const localidadNombre = propiedad?.localidad?.nombre || 'Rosario';
  const provinciaNombre = propiedad?.localidad?.provincia?.nombre || 'Santa Fe';
  const localidadCompleta = `${localidadNombre}, ${provinciaNombre}`;

  doc.setFontSize(9);
  const labelX = margin + 25;
  const dataX = margin + 27;
  
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE:', labelX, 60, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(clienteNombre, dataX, 60);
  
  doc.setFont('helvetica', 'bold');
  doc.text('PROPIEDAD:', labelX, 66, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(propiedadDir, dataX, 66);
  
  const labelLocalidadX = pageWidth / 2 + 35;
  doc.setFont('helvetica', 'bold');
  doc.text('LOCALIDAD:', labelLocalidadX, 66, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(localidadCompleta, labelLocalidadX + 2, 66);

  // ===== LÍNEA SEPARADORA =====
  doc.setLineWidth(0.3);
  doc.line(margin, 70, pageWidth - margin, 70);

  // ===== TABLA DE ITEMS =====
  let y = 77;

  // Encabezados de columnas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Concepto', margin, y);
  // Columna sin nombre para cuota (ej: 19/24)
  doc.text('Período', 120, y, { align: 'center' });
  doc.text('Año', 145, y, { align: 'center' });
  doc.text('Importe', pageWidth - margin, y, { align: 'right' });

  // Línea debajo del header
  y += 2;
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Extraer año y mes del periodo (formato YYYYMM o YYYY-MM)
  const periodo = liquidacion.periodo || '';
  let anio = '';
  let mes = 0;
  
  if (periodo.includes('-')) {
    // Formato YYYY-MM
    const partes = periodo.split('-');
    anio = partes[0];
    mes = parseInt(partes[1], 10);
  } else if (periodo.length >= 6) {
    // Formato YYYYMM
    anio = periodo.substring(0, 4);
    mes = parseInt(periodo.substring(4, 6), 10);
  }

  // Preparar items para la tabla usando la lógica de boleta (incluye items con signo correcto)
  const itemsConImporte = (liquidacion.items || [])
    .map(item => {
      const importeCalculado = importeEnBoleta(item);
      return importeCalculado !== null ? { ...item, importeCalculado } : null;
    })
    .filter(item => item !== null);
  
  // Ordenar items según el orden predefinido
  const itemsInquilino = ordenarItems(itemsConImporte);

  // Items de la tabla
  doc.setFont('helvetica', 'normal');
  let total = 0;
  
  for (const item of itemsInquilino) {
    let concepto = '';
    let periodoDisplay = '';
    
    // Determinar concepto
    if (item.contratoGastoInicial?.tipoGastoInicial) {
      concepto = item.contratoGastoInicial.tipoGastoInicial.nombre || 
                 item.contratoGastoInicial.tipoGastoInicial.codigo || 'Gasto inicial';
    } else if (item.propiedadImpuesto?.tipoImpuesto) {
      concepto = item.propiedadImpuesto.tipoImpuesto.nombre || 
                 item.propiedadImpuesto.tipoImpuesto.codigo || 'Impuesto';
    } else if (item.tipoCargo) {
      concepto = item.tipoCargo.nombre || item.tipoCargo.codigo || 'Cargo';
      // Para alquiler, mostrar cuota
      if (item.tipoCargo.codigo === 'ALQUILER' && liquidacion.contrato) {
        const contrato = liquidacion.contrato;
        const fechaInicio = dayjs(contrato.fechaInicio);
        const periodoDate = dayjs(`${anio}-${String(mes).padStart(2, '0')}-01`);
        const cuotaActual = periodoDate.diff(fechaInicio, 'month') + 1;
        const totalCuotas = contrato.duracionMeses || 36;
        periodoDisplay = `(${cuotaActual}/${totalCuotas})`;
      }
    } else if (item.tipoExpensa) {
      const tipoExp = item.tipoExpensa.codigo === 'ORD' ? 'Ordinarias' : 
                      item.tipoExpensa.codigo === 'EXT' ? 'Extraordinarias' : 
                      item.tipoExpensa.nombre || 'Expensas';
      concepto = `Expensas ${tipoExp}`;
    } else {
      concepto = item.observaciones || 'Item';
    }

    // Usar el importe calculado con signo correcto
    const importe = item.importeCalculado;
    total += importe;

    // Renderizar concepto
    doc.text(concepto, margin, y);
    doc.text(periodoDisplay, 95, y, { align: 'center' });
    doc.text(mes > 0 ? String(mes) : '-', 120, y, { align: 'center' });
    doc.text(anio || '-', 145, y, { align: 'center' });
    
    // Si el importe es negativo, mostrarlo en rojo (descuento/reintegro)
    if (importe < 0) {
      doc.setTextColor(220, 38, 38); // Rojo para descuentos
    }
    doc.text(formatoMoneda(importe), pageWidth - margin, y, { align: 'right' });
    doc.setTextColor(0, 0, 0); // Volver a negro
    
    y += 6;
  }

  // ===== PIE DE PÁGINA - VENCIMIENTOS Y TOTAL =====
  // Calcular totales con intereses
  const interes2 = parseFloat(liquidacion.interes2) || 0;
  const interes3 = parseFloat(liquidacion.interes3) || 0;
  const totalConInteres2 = total * (1 + interes2 / 100);
  const totalConInteres3 = totalConInteres2 * (1 + interes3 / 100);

  // Posición Y fija para el pie de página
  const vencY = pageHeight - 40;

  // Vencimientos (izquierda abajo)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Vencimientos', margin + 5, vencY);
  doc.text('Total', margin + 55, vencY);
  
  doc.setFont('helvetica', 'normal');
  
  // 1er vencimiento
  doc.text('1° venc.', margin + 5, vencY + 6);
  doc.text(formatoFecha(liquidacion.vencimiento), margin + 25, vencY + 6);
  doc.text(formatoMoneda(total), margin + 55, vencY + 6);
  
  // 2do vencimiento
  if (liquidacion.vencimiento2) {
    doc.text('2° venc.', margin + 5, vencY + 12);
    doc.text(formatoFecha(liquidacion.vencimiento2), margin + 25, vencY + 12);
    doc.text(formatoMoneda(totalConInteres2), margin + 55, vencY + 12);
  }
  
  // 3er vencimiento
  if (liquidacion.vencimiento3) {
    doc.text('3° venc.', margin + 5, vencY + 18);
    doc.text(formatoFecha(liquidacion.vencimiento3), margin + 25, vencY + 18);
    doc.text(formatoMoneda(totalConInteres3), margin + 55, vencY + 18);
  }

  // Box TOTAL y VENCIMIENTO (derecha abajo)
  const boxWidth = 60;
  const boxHeight = 16;
  const boxX = pageWidth - margin - boxWidth;
  const boxY = vencY - 5;
  
  // Dibujar recuadro
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(boxX, boxY, boxWidth, boxHeight);
  
  // Línea horizontal separadora en el medio del box
  doc.line(boxX, boxY + boxHeight / 2, boxX + boxWidth, boxY + boxHeight / 2);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  
  // TOTAL (primera fila del box) - etiqueta e importe en negrita
  doc.text('TOTAL:', boxX + 3, boxY + 5);
  doc.text(formatoMoneda(total), boxX + boxWidth - 3, boxY + 5, { align: 'right' });
  
  // VENCIMIENTO (segunda fila del box)
  doc.text('VENCIMIENTO:', boxX + 3, boxY + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(formatoFecha(liquidacion.vencimiento), boxX + boxWidth - 3, boxY + 13, { align: 'right' });

  // Abrir PDF en nueva pestaña
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Genera el PDF de Liquidación al Propietario
 * Similar a la boleta pero con datos del propietario y items que soporta el propietario
 */
export async function generarLiquidacionPropietarioPDF(liquidacion, liquidacionPropietario) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // ===== ENCABEZADO =====
  
  // COLUMNA IZQUIERDA: Logo + datos empresa + X (imagen completa)
  try {
    const logoImg = await loadImage('/logo-empresa.png');
    doc.addImage(logoImg, 'PNG', margin, 0, 115, 55);
  } catch (e) {
    console.warn('No se pudo cargar el logo:', e);
  }

  // COLUMNA DERECHA: LIQUIDACION, Pág, N°, Fecha
  
  // Pág. 1/1 (arriba derecha)
  doc.setFontSize(8);
  doc.text('Pág. 1/1', pageWidth - margin, 10, { align: 'right' });

  // LIQUIDACION (en lugar de BOLETA)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LIQUIDACION', pageWidth - margin, 20, { align: 'right' });

  // N° y FECHA
  const nroLiquidacion = String(liquidacionPropietario?.id || liquidacion.id).padStart(8, '0');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('N°:', pageWidth - margin - 35, 30);
  doc.setFont('helvetica', 'normal');
  doc.text(nroLiquidacion, pageWidth - margin, 30, { align: 'right' });
  
  doc.setFont('helvetica', 'bold');
  doc.text('FECHA:', pageWidth - margin - 35, 36);
  doc.setFont('helvetica', 'normal');
  doc.text(formatoFecha(liquidacionPropietario?.fecha || new Date()), pageWidth - margin, 36, { align: 'right' });

  // ===== LÍNEA SEPARADORA =====
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(margin, 54, pageWidth - margin, 54);

  // ===== DATOS PROPIETARIO (CLIENTE) =====
  const contrato = liquidacion.contrato;
  // Buscar propiedad: primero directamente en liquidacion, luego en contrato
  const propiedad = liquidacion.propiedad || contrato?.propiedad;
  
  // Obtener propietario de la propiedad
  const propietarioData = propiedad?.propietarios?.[0]?.propietario;
  const propietarioNombre = propietarioData?.razonSocial || 
    `${propietarioData?.apellido || ''}, ${propietarioData?.nombre || ''}`.trim() || 'Sin datos';
  const propietarioDni = propietarioData?.dni || '-';
  const propietarioCuit = propietarioData?.cuit || null;
  const propietarioCondicionIva = propietarioData?.condicionIva?.nombre || 'Consumidor final';
  
  // Dirección completa del propietario
  const propietarioLocalidad = propietarioData?.localidad?.nombre || propiedad?.localidad?.nombre || 'Rosario';
  const propietarioProvincia = propietarioData?.localidad?.provincia?.nombre || propiedad?.localidad?.provincia?.nombre || 'Santa Fe';
  const propietarioDir = propietarioData?.dirCalle ? 
    `${propietarioData.dirCalle || ''} ${propietarioData.dirNro || ''}${propietarioData.dirPiso ? `, ${propietarioData.dirPiso}°` : ''}${propietarioData.dirDepto ? ` "${propietarioData.dirDepto}"` : ''}, ${propietarioLocalidad}, ${propietarioProvincia}`.trim() 
    : '-';
  
  // Dirección completa de la propiedad
  const propiedadLocalidad = propiedad?.localidad?.nombre || 'Rosario';
  const propiedadProvincia = propiedad?.localidad?.provincia?.nombre || 'Santa Fe';
  const propiedadDirCompleta = propiedad ? 
    `${propiedad.dirCalle || ''} ${propiedad.dirNro || ''}${propiedad.dirPiso ? `, ${propiedad.dirPiso}°` : ''}${propiedad.dirDepto ? ` "${propiedad.dirDepto}"` : ''}, ${propiedadLocalidad}, ${propiedadProvincia}`.trim() 
    : '-';

  doc.setFontSize(9);
  
  // Definir columnas para alineación consistente
  const col1LabelX = margin + 28;  // Etiquetas columna izquierda (alineadas a la derecha)
  const col1DataX = margin + 30;   // Datos columna izquierda (alineados a la izquierda)
  const col2LabelX = pageWidth - margin - 40;  // Etiquetas columna derecha (alineadas a la derecha)
  const col2DataX = pageWidth - margin - 38;   // Datos columna derecha (alineados a la izquierda)
  
  // === SECCIÓN CLIENTE (Propietario) ===
  // Línea 1: CLIENTE: Nombre                                    CUIT/CUIL o DNI: valor
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE:', col1LabelX, 60, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(propietarioNombre, col1DataX, 60);
  
  // CUIT/CUIL o DNI del propietario (a la derecha)
  if (propietarioCuit) {
    doc.setFont('helvetica', 'bold');
    doc.text('CUIT/CUIL:', col2LabelX, 60, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(propietarioCuit, col2DataX, 60);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.text('DNI:', col2LabelX, 60, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(propietarioDni, col2DataX, 60);
  }
  
  // Línea 2: DIRECCIÓN: dirección completa                      I.V.A.: condición
  doc.setFont('helvetica', 'bold');
  doc.text('DIRECCIÓN:', col1LabelX, 66, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(propietarioDir, col1DataX, 66);
  
  doc.setFont('helvetica', 'bold');
  doc.text('I.V.A.:', col2LabelX, 66, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(propietarioCondicionIva, col2DataX, 66);

  // ===== LÍNEA SEPARADORA =====
  doc.setLineWidth(0.3);
  doc.line(margin, 70, pageWidth - margin, 70);

  // === SECCIÓN CONTRATO ===
  const inquilino = contrato?.inquilino;
  const inquilinoNombre = inquilino?.razonSocial || 
    `${inquilino?.apellido || ''}, ${inquilino?.nombre || ''}`.trim() || '-';
  const inquilinoDni = inquilino?.dni || '-';
  const inquilinoCuit = inquilino?.cuit || null;
  
  const fechaInicio = contrato?.fechaInicio ? formatoFecha(contrato.fechaInicio) : '-';
  const fechaFin = contrato?.fechaFin ? formatoFecha(contrato.fechaFin) : '-';

  // Línea 1: N° CONTRATO: xxx          FECHA INICIO: fecha          FECHA FIN: fecha
  doc.setFont('helvetica', 'bold');
  doc.text('N° CONTRATO:', col1LabelX, 76, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(contrato?.id ? String(contrato.id) : '-', col1DataX, 76);
  
  doc.setFont('helvetica', 'bold');
  doc.text('FECHA INICIO:', margin + 85, 76, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(fechaInicio, margin + 87, 76);
  
  doc.setFont('helvetica', 'bold');
  doc.text('FECHA FIN:', col2LabelX, 76, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(fechaFin, col2DataX, 76);
  
  // Línea 2: DIRECCIÓN PROPIEDAD: dirección completa (etiqueta más larga)
  doc.setFont('helvetica', 'bold');
  doc.text('DIR. PROPIEDAD:', col1LabelX, 82, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(propiedadDirCompleta, col1DataX, 82);
  
  // Línea 3: INQUILINO: nombre                                  CUIT/CUIL o DNI: valor
  doc.setFont('helvetica', 'bold');
  doc.text('INQUILINO:', col1LabelX, 88, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(inquilinoNombre, col1DataX, 88);
  
  // CUIT/CUIL o DNI del inquilino (a la derecha)
  if (inquilinoCuit) {
    doc.setFont('helvetica', 'bold');
    doc.text('CUIT/CUIL:', col2LabelX, 88, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(inquilinoCuit, col2DataX, 88);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.text('DNI:', col2LabelX, 88, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(inquilinoDni, col2DataX, 88);
  }

  // ===== LÍNEA SEPARADORA =====
  doc.setLineWidth(0.3);
  doc.line(margin, 92, pageWidth - margin, 92);

  // ===== TABLA DE ITEMS =====
  let y = 99;

  // Encabezados de columnas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Concepto', margin, y);
  doc.text('Período', 120, y, { align: 'center' });
  doc.text('Año', 145, y, { align: 'center' });
  doc.text('Importe', pageWidth - margin, y, { align: 'right' });

  // Línea debajo del header
  y += 2;
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Extraer año y mes del periodo
  const periodo = liquidacion.periodo || '';
  let anio = '';
  let mes = 0;
  
  if (periodo.includes('-')) {
    const partes = periodo.split('-');
    anio = partes[0];
    mes = parseInt(partes[1], 10);
  } else if (periodo.length >= 6) {
    anio = periodo.substring(0, 4);
    mes = parseInt(periodo.substring(4, 6), 10);
  }

  doc.setFont('helvetica', 'normal');
  
  // ===== 1. ALQUILER (si hay contrato alquilado) =====
  const itemAlquiler = (liquidacion.items || []).find(item => item.tipoCargo?.codigo === 'ALQUILER');
  const alquilerBruto = itemAlquiler ? parseFloat(itemAlquiler.importe || 0) : (liquidacionPropietario?.alquilerBruto || 0);
  
  let total = 0;
  
  if (alquilerBruto > 0) {
    doc.setTextColor(0, 0, 0); // Negro
    doc.text('Alquiler', margin, y);
    doc.text(mes > 0 ? String(mes) : '-', 120, y, { align: 'center' });
    doc.text(anio || '-', 145, y, { align: 'center' });
    doc.text(formatoMoneda(alquilerBruto), pageWidth - margin, y, { align: 'right' });
    total += alquilerBruto;
    y += 6;
  }
  
  // ===== 2. ITEMS QUE SOPORTA EL PROPIETARIO (deducciones) =====
  // Filtrar items del propietario con importe > 0, excluyendo ALQUILER
  const itemsPropietarioFiltrados = (liquidacion.items || []).filter(item => {
    const actorCodigo = item.quienSoportaCosto?.codigo || item.actorFacturado?.codigo;
    const esPropietario = actorCodigo === 'PROP' || actorCodigo === 'PROPIETARIO';
    const tieneImporte = parseFloat(item.importe || 0) > 0;
    const noEsAlquiler = item.tipoCargo?.codigo !== 'ALQUILER';
    return esPropietario && tieneImporte && noEsAlquiler;
  });
  
  // Ordenar items según el orden predefinido
  const itemsPropietario = ordenarItems(itemsPropietarioFiltrados);
  
  for (const item of itemsPropietario) {
    let concepto = '';
    
    if (item.propiedadImpuesto?.tipoImpuesto) {
      concepto = item.propiedadImpuesto.tipoImpuesto.nombre || 
                 item.propiedadImpuesto.tipoImpuesto.codigo || 'Impuesto';
    } else if (item.tipoCargo) {
      concepto = item.tipoCargo.nombre || item.tipoCargo.codigo || 'Cargo';
    } else if (item.tipoExpensa) {
      const tipoExp = item.tipoExpensa.codigo === 'ORD' ? 'Ordinarias' : 
                      item.tipoExpensa.codigo === 'EXT' ? 'Extraordinarias' : 
                      item.tipoExpensa.nombre || 'Expensas';
      concepto = `Expensas ${tipoExp}`;
    } else {
      concepto = item.observaciones || 'Item';
    }

    const importe = parseFloat(item.importe || 0);
    total -= importe; // Restar del total

    // Concepto en negro, importe en rojo con signo negativo
    doc.setTextColor(0, 0, 0); // Negro
    doc.text(concepto, margin, y);
    doc.text(mes > 0 ? String(mes) : '-', 120, y, { align: 'center' });
    doc.text(anio || '-', 145, y, { align: 'center' });
    doc.setTextColor(220, 38, 38); // Rojo solo para el importe
    doc.text(`-${formatoMoneda(importe)}`, pageWidth - margin, y, { align: 'right' });
    doc.setTextColor(0, 0, 0); // Volver a negro
    
    y += 6;
  }

  // ===== PIE DE PÁGINA - MEDIOS DE PAGO Y TOTAL =====
  const footerY = pageHeight - 55;

  // Usar el neto de liquidacionPropietario si está disponible, sino el calculado
  const netoAPagar = liquidacionPropietario?.netoAPagar || total;

  // Medios de Pago (izquierda)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Medios de Pago:', margin, footerY);
  doc.setFont('helvetica', 'normal');
  
  doc.text(`Efectivo......................`, margin, footerY + 8);
  // Si el neto es negativo, mostrarlo en rojo
  if (netoAPagar < 0) {
    doc.setTextColor(220, 38, 38);
  }
  doc.text(formatoMoneda(netoAPagar), margin + 45, footerY + 8);
  doc.setTextColor(0, 0, 0);

  // Box TOTAL RECIBO (derecha, a la altura de Medios de Pago)
  const boxWidth = 70;
  const boxHeight = 10;
  const boxX = pageWidth - margin - boxWidth;
  const boxY = footerY - 3;  // Alineado con "Medios de Pago"
  
  // Dibujar recuadro
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(boxX, boxY, boxWidth, boxHeight);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Total Recibo:', boxX + 3, boxY + 6);
  // Si el neto es negativo, mostrarlo en rojo
  if (netoAPagar < 0) {
    doc.setTextColor(220, 38, 38);
  }
  doc.text(formatoMoneda(netoAPagar), boxX + boxWidth - 3, boxY + 6, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Firma y aclaración (debajo del recuadro Total)
  const firmaY = boxY + boxHeight + 15;
  doc.setFont('helvetica', 'normal');
  doc.text('Firma y aclaración:', boxX, firmaY);
  doc.line(boxX + 35, firmaY, boxX + boxWidth, firmaY);

  // Abrir PDF en nueva pestaña
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
}
