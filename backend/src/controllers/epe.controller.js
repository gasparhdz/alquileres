import prisma from '../db/prisma.js';
import { scrapeEpeFacturas } from '../services/epeScraper.js';

/**
 * Normaliza un número de cliente para matching (quita ceros a la izquierda y espacios)
 */
function normalizarNroCliente(nroCliente) {
  if (!nroCliente) return '';
  return nroCliente.toString().trim().replace(/^0+/, '');
}

/**
 * Autocompletar importes y vencimientos desde EPE
 * POST /api/liquidaciones/impuestos/epe/autocompletar
 */
export const autocompletarEpe = async (req, res) => {
  const { periodo } = req.body;
  
  // Validar período MM-YYYY
  if (!periodo || !/^\d{2}-\d{4}$/.test(periodo)) {
    return res.status(400).json({ 
      error: 'El período debe tener el formato MM-YYYY (ej: 01-2026)' 
    });
  }

  // Convertir MM-YYYY a YYYY-MM para la base de datos
  const [mes, anio] = periodo.split('-');
  const periodoDb = `${anio}-${mes}`;
  
  // Calcular rango del período
  const inicioPeriodo = new Date(parseInt(anio), parseInt(mes) - 1, 1, 0, 0, 0, 0);
  const finPeriodo = new Date(parseInt(anio), parseInt(mes), 1, 0, 0, 0, 0); // Primer día del mes siguiente (no inclusive)

  try {
    // 1. Obtener credenciales de TipoImpuestoPropiedad LUZ
    const tipoImpuestoLuz = await prisma.tipoImpuestoPropiedad.findFirst({
      where: {
        codigo: 'LUZ',
        activo: true,
        deletedAt: null
      }
    });

    if (!tipoImpuestoLuz) {
      return res.status(404).json({ 
        error: 'No se encontró el tipo de impuesto LUZ configurado' 
      });
    }

    if (!tipoImpuestoLuz.usuario || !tipoImpuestoLuz.password) {
      return res.status(400).json({ 
        error: 'Las credenciales de EPE no están configuradas. Configure usuario y contraseña en Configuración > Tipos de Impuesto > LUZ' 
      });
    }

    // 2. Obtener LiquidacionItem del período que correspondan a LUZ
    const items = await prisma.liquidacionItem.findMany({
      where: {
        liquidacion: {
          periodo: periodoDb
        },
        propiedadImpuesto: {
          tipoImpuesto: {
            codigo: 'LUZ'
          }
        },
        activo: true,
        deletedAt: null
      },
      include: {
        propiedadImpuesto: {
          include: {
            tipoImpuesto: true,
            campos: {
              where: {
                tipoCampo: {
                  codigo: 'NRO_CLI' // Código del campo según el seed
                }
              },
              include: {
                tipoCampo: true
              }
            }
          }
        },
        estadoItem: true
      }
    });

    console.log(`[EPE] Encontrados ${items.length} items de LUZ para el período ${periodo}`);

    // 3. Construir mapa nroClienteNormalizado -> liquidacionItem y lista de números CRUDOS para la API (la API puede esperar el formato guardado, ej. 001752960)
    const nroClienteToItemMap = new Map();
    const nroClientesRawParaApi = [];
    const warnings = [];
    const itemsSinNroCliente = [];

    for (const item of items) {
      console.log(`[EPE] Procesando item ${item.id}, PropiedadImpuestoId: ${item.propiedadImpuestoId}`);
      console.log(`[EPE] Campos encontrados: ${item.propiedadImpuesto?.campos?.length || 0}`);
      
      // Buscar el campo NRO_CLI (N° de cliente)
      const nroClienteCampo = item.propiedadImpuesto?.campos?.find(c => 
        c.tipoCampo?.codigo === 'NRO_CLI' ||
        c.tipoCampo?.codigo === 'NRO_CLIENTE' ||
        c.tipoCampo?.nombre?.toLowerCase().includes('cliente')
      );
      
      if (!nroClienteCampo || !nroClienteCampo.valor) {
        if (item.propiedadImpuesto?.campos) {
          console.log(`[EPE] Campos disponibles para item ${item.id}:`, 
            item.propiedadImpuesto.campos.map(c => ({
              codigo: c.tipoCampo?.codigo,
              nombre: c.tipoCampo?.nombre,
              valor: c.valor
            }))
          );
        }
        warnings.push(`PropiedadImpuestoId ${item.propiedadImpuestoId} sin NRO_CLI (N° de cliente) configurado`);
        itemsSinNroCliente.push(item.id);
        continue;
      }

      const valorCrudo = String(nroClienteCampo.valor).trim();
      const nroClienteNormalizado = normalizarNroCliente(valorCrudo);
      console.log(`[EPE] N° de cliente encontrado para item ${item.id}: ${valorCrudo} -> normalizado: ${nroClienteNormalizado}`);
      nroClienteToItemMap.set(nroClienteNormalizado, item);
      nroClientesRawParaApi.push(valorCrudo);
    }

    // 4. Pasar a la API los números tal como están en BD (ej. 001752960), no normalizados; el matching luego usa normalizado
    console.log(`[EPE] Filtrando suministros: solo procesar ${nroClientesRawParaApi.length} suministros de la base de datos`);

    if (nroClientesRawParaApi.length === 0) {
      return res.json({
        periodo,
        actualizados: 0,
        sinFacturaEnPeriodo: [],
        sinMatchNroCliente: [],
        warnings,
        errores: []
      });
    }

    // 5. Ejecutar scraper EPE (pasamos números crudos para que la API reciba el formato esperado, ej. 001752960)
    console.log('[EPE] Iniciando scraping...');
    let cuotasEpe = [];
    try {
      cuotasEpe = await scrapeEpeFacturas(
        tipoImpuestoLuz.usuario,
        tipoImpuestoLuz.password,
        inicioPeriodo,
        finPeriodo,
        nroClientesRawParaApi
      );
      console.log(`[EPE] Scraping completado. ${cuotasEpe.length} cuotas obtenidas.`);
    } catch (error) {
      const errMsg = error?.message || String(error);
      console.error('[EPE] Error en scraping:', errMsg, error?.stack);
      // Devolver 200 con errores para no cortar el flujo de "Generar impuestos"; el frontend puede mostrar aviso
      return res.json({
        periodo,
        actualizados: 0,
        sinFacturaEnPeriodo: [],
        sinMatchNroCliente: [],
        warnings,
        errores: [errMsg]
      });
    }

    // 6. Hacer matching y actualizar items en una sola transacción ACID
    const sinFacturaEnPeriodo = [];
    const sinMatchNroCliente = [];

    const estadoCompletado = await prisma.estadoItemLiquidacion.findFirst({
      where: { codigo: 'COMPLETADO' }
    });

    if (!estadoCompletado) {
      return res.status(500).json({
        error: 'No se encontró el estado COMPLETADO en la base de datos'
      });
    }

    const completadoAt = new Date();
    const completadoById = req.user?.id || null;

    // Reunir solo cuotas que tienen item en BD y armar las operaciones de update
    const operaciones = [];
    const idsActualizados = [];

    const toDate = (v) => (v instanceof Date ? v : v != null ? new Date(v) : null);

    for (const cuota of cuotasEpe) {
      const nroClienteNormalizado = normalizarNroCliente(cuota.nroCliente);
      const item = nroClienteToItemMap.get(nroClienteNormalizado);
      if (!item) {
        sinMatchNroCliente.push(cuota.nroCliente);
        continue;
      }
      const vencimientoDate = toDate(cuota.vencimiento);
      if (!vencimientoDate || isNaN(vencimientoDate.getTime())) {
        console.warn(`[EPE] Cuota con vencimiento inválido omitida:`, cuota);
        continue;
      }
      idsActualizados.push(item.id);
      operaciones.push(
        prisma.liquidacionItem.update({
          where: { id: item.id },
          data: {
            importe: cuota.importe,
            vencimiento: vencimientoDate,
            refExterna: cuota.refExterna || item.refExterna,
            estadoItemId: estadoCompletado.id,
            completadoAt,
            completadoById
          }
        })
      );
    }

    if (operaciones.length > 0) {
      try {
        await prisma.$transaction(operaciones);
        console.log(`[EPE] ${operaciones.length} items actualizados en transacción.`);
      } catch (txError) {
        console.error('[EPE] Error en transacción:', txError?.message || txError, txError?.stack);
        return res.status(500).json({
          error: 'Error al guardar datos de EPE: ' + (txError?.message || String(txError)),
          periodo,
          actualizados: 0,
          sinFacturaEnPeriodo: [],
          sinMatchNroCliente: [],
          warnings,
          errores: [txError?.message || String(txError)]
        });
      }
    }

    const actualizados = idsActualizados;

    // Identificar items que tienen N° de cliente pero no se encontró cuota en el período
    for (const [nroClienteNormalizado, item] of nroClienteToItemMap.entries()) {
      const tieneCuota = cuotasEpe.some(c => normalizarNroCliente(c.nroCliente) === nroClienteNormalizado);
      if (!tieneCuota && !actualizados.includes(item.id)) {
        sinFacturaEnPeriodo.push(nroClienteNormalizado);
      }
    }

    res.json({
      periodo,
      actualizados: actualizados.length,
      sinFacturaEnPeriodo,
      sinMatchNroCliente,
      warnings,
      errores: []
    });

  } catch (error) {
    console.error('[EPE] Error general:', error);
    res.status(500).json({
      error: 'Error al autocompletar desde EPE: ' + error.message,
      periodo,
      actualizados: 0,
      sinFacturaEnPeriodo: [],
      sinMatchNroCliente: [],
      warnings: [],
      errores: [error.message]
    });
  }
};
