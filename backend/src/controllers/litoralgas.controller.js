import prisma from '../db/prisma.js';
import { scrapeLitoralgasFacturas } from '../services/litoralgasScraper.js';

/**
 * Normaliza un número de cliente para matching (solo dígitos)
 */
function normalizarNroCliente(nroCliente) {
  if (!nroCliente) return '';
  return nroCliente.toString().trim().replace(/[^\d]/g, '').replace(/^0+/, '');
}

/**
 * Autocompletar importes y vencimientos desde Litoralgas
 * POST /api/liquidaciones/impuestos/litoralgas/autocompletar
 */
export const autocompletarLitoralgas = async (req, res) => {
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
    // 1. Obtener credenciales de TipoImpuestoPropiedad GAS
    const tipoImpuestoGas = await prisma.tipoImpuestoPropiedad.findFirst({
      where: {
        codigo: 'GAS',
        activo: true,
        deletedAt: null
      }
    });

    if (!tipoImpuestoGas) {
      return res.status(404).json({ 
        error: 'No se encontró el tipo de impuesto GAS configurado' 
      });
    }

    if (!tipoImpuestoGas.usuario || !tipoImpuestoGas.password) {
      return res.status(400).json({ 
        error: 'Las credenciales de Litoralgas no están configuradas. Configure usuario y contraseña en Configuración > Tipos de Impuesto > GAS' 
      });
    }

    // 2. Obtener LiquidacionItem del período que correspondan a GAS
    const items = await prisma.liquidacionItem.findMany({
      where: {
        liquidacion: {
          periodo: periodoDb
        },
        propiedadImpuesto: {
          tipoImpuesto: {
            codigo: 'GAS'
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
                  codigo: 'NRO_CLI'
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

    console.log(`[Litoralgas] Encontrados ${items.length} items de GAS para el período ${periodo}`);

    // 3. Construir mapa nroClienteNormalizado -> liquidacionItem
    const nroClienteToItemMap = new Map();
    const warnings = [];
    const itemsSinNroCliente = [];

    for (const item of items) {
      console.log(`[Litoralgas] Procesando item ${item.id}, PropiedadImpuestoId: ${item.propiedadImpuestoId}`);
      console.log(`[Litoralgas] Campos encontrados: ${item.propiedadImpuesto?.campos?.length || 0}`);
      
      // Buscar el campo NRO_CLI (N° de cliente)
      const nroClienteCampo = item.propiedadImpuesto?.campos?.find(c => 
        c.tipoCampo?.codigo === 'NRO_CLI' ||
        c.tipoCampo?.codigo === 'NRO_CLIENTE' ||
        c.tipoCampo?.nombre?.toLowerCase().includes('cliente')
      );
      
      if (!nroClienteCampo || !nroClienteCampo.valor) {
        if (item.propiedadImpuesto?.campos) {
          console.log(`[Litoralgas] Campos disponibles para item ${item.id}:`, 
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

      const nroClienteNormalizado = normalizarNroCliente(nroClienteCampo.valor);
      const nroClienteRaw = (nroClienteCampo.valor || '').toString().trim();
      console.log(`[Litoralgas] N° de cliente encontrado para item ${item.id}: ${nroClienteRaw} -> normalizado: ${nroClienteNormalizado}`);
      nroClienteToItemMap.set(nroClienteNormalizado, item);
    }

    // 4. Lista de clientes a consultar: { normalizado, raw } para que el scraper pruebe ambos formatos en la API
    const clientesParaScraper = Array.from(nroClienteToItemMap.entries()).map(([normalizado, item]) => {
      const campo = item.propiedadImpuesto?.campos?.find(c =>
        c.tipoCampo?.codigo === 'NRO_CLI' || c.tipoCampo?.codigo === 'NRO_CLIENTE' || c.tipoCampo?.nombre?.toLowerCase().includes('cliente')
      );
      return { normalizado, raw: (campo?.valor || '').toString().trim() || normalizado };
    });
    console.log(`[Litoralgas] Filtrando suministros: solo procesar ${clientesParaScraper.length} suministros de la base de datos`);

    // 5. Ejecutar scraper Litoralgas
    console.log('[Litoralgas] Iniciando scraping...');
    let facturasLitoralgas = [];
    try {
      facturasLitoralgas = await scrapeLitoralgasFacturas(
        tipoImpuestoGas.usuario,
        tipoImpuestoGas.password,
        inicioPeriodo,
        finPeriodo,
        clientesParaScraper
      );
      console.log(`[Litoralgas] Scraping completado. ${facturasLitoralgas.length} facturas obtenidas.`);
    } catch (error) {
      console.error('[Litoralgas] Error en scraping:', error);
      return res.status(500).json({
        error: 'Error al obtener datos de Litoralgas: ' + error.message,
        periodo,
        actualizados: 0,
        sinFacturaEnPeriodo: [],
        sinMatchNroCli: [],
        warnings,
        errores: [error.message]
      });
    }

    // 6. Hacer matching y construir operaciones (guardado atómico)
    const sinFacturaEnPeriodo = [];
    const sinMatchNroCli = [];
    const errores = [];

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
    const transacciones = [];

    for (const factura of facturasLitoralgas) {
      const nroClienteNormalizado = normalizarNroCliente(factura.nroCliente);
      const item = nroClienteToItemMap.get(nroClienteNormalizado);
      if (!item) {
        sinMatchNroCli.push(factura.nroCliente);
        continue;
      }
      transacciones.push(
        prisma.liquidacionItem.update({
          where: { id: item.id },
          data: {
            importe: factura.importe,
            vencimiento: factura.vencimiento,
            refExterna: factura.refExterna || item.refExterna,
            estadoItemId: estadoCompletado.id,
            completadoAt,
            completadoById
          }
        })
      );
    }

    let actualizados = 0;
    if (transacciones.length > 0) {
      await prisma.$transaction(transacciones);
      actualizados = transacciones.length;
      console.log(`[Litoralgas] ${actualizados} items actualizados en transacción.`);
    }

    for (const [nroClienteNormalizado] of nroClienteToItemMap.entries()) {
      const tieneFactura = facturasLitoralgas.some(f => normalizarNroCliente(f.nroCliente) === nroClienteNormalizado);
      if (!tieneFactura) {
        sinFacturaEnPeriodo.push(nroClienteNormalizado);
      }
    }

    res.json({
      periodo,
      actualizados,
      sinFacturaEnPeriodo,
      sinMatchNroCli,
      warnings,
      errores
    });

  } catch (error) {
    console.error('[Litoralgas] Error general:', error);
    res.status(500).json({
      error: 'Error al autocompletar desde Litoralgas: ' + error.message,
      periodo,
      actualizados: 0,
      sinFacturaEnPeriodo: [],
      sinMatchNroCli: [],
      warnings: [],
      errores: [error.message]
    });
  }
};
