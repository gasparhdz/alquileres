import { PrismaClient } from '@prisma/client';
import { scrapeLitoralgasFacturas } from '../services/litoralgasScraper.js';

const prisma = new PrismaClient();

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
      console.log(`[Litoralgas] N° de cliente encontrado para item ${item.id}: ${nroClienteCampo.valor} -> normalizado: ${nroClienteNormalizado}`);
      nroClienteToItemMap.set(nroClienteNormalizado, item);
    }

    // 4. Preparar lista de números de cliente a filtrar (solo procesar los que están en la BD)
    const nroClientesAFiltrar = Array.from(nroClienteToItemMap.keys());
    console.log(`[Litoralgas] Filtrando suministros: solo procesar ${nroClientesAFiltrar.length} suministros de la base de datos`);
    
    // 5. Ejecutar scraper Litoralgas
    console.log('[Litoralgas] Iniciando scraping...');
    let facturasLitoralgas = [];
    
    try {
      facturasLitoralgas = await scrapeLitoralgasFacturas(
        tipoImpuestoGas.usuario,
        tipoImpuestoGas.password,
        inicioPeriodo,
        finPeriodo,
        nroClientesAFiltrar
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

    // 6. Hacer matching y actualizar items
    const actualizados = [];
    const sinFacturaEnPeriodo = [];
    const sinMatchNroCli = [];
    const errores = [];

    // Obtener estado COMPLETADO
    const estadoCompletado = await prisma.estadoItemLiquidacion.findFirst({
      where: {
        codigo: 'COMPLETADO'
      }
    });

    if (!estadoCompletado) {
      return res.status(500).json({
        error: 'No se encontró el estado COMPLETADO en la base de datos'
      });
    }

    // Procesar cada factura obtenida de Litoralgas
    for (const factura of facturasLitoralgas) {
      try {
        const nroClienteNormalizado = normalizarNroCliente(factura.nroCliente);
        const item = nroClienteToItemMap.get(nroClienteNormalizado);
        
        if (!item) {
          sinMatchNroCli.push(factura.nroCliente);
          continue;
        }

        // Actualizar LiquidacionItem
        const importeActual = item.importe ? parseFloat(item.importe) : null;
        const importeNuevo = factura.importe;

        await prisma.liquidacionItem.update({
          where: { id: item.id },
          data: {
            importeAnterior: importeActual && importeActual !== importeNuevo ? importeActual : item.importeAnterior,
            importe: importeNuevo,
            vencimiento: factura.vencimiento,
            refExterna: factura.refExterna || item.refExterna,
            estadoItemId: estadoCompletado.id,
            completadoAt: new Date(),
            completadoById: req.user?.id || null
          }
        });

        actualizados.push(item.id);
        console.log(`[Litoralgas] Item ${item.id} actualizado con importe ${importeNuevo} y vencimiento ${factura.vencimiento}`);

      } catch (error) {
        console.error(`[Litoralgas] Error al procesar factura para cliente ${factura.nroCliente}:`, error);
        errores.push(`Error al procesar cliente ${factura.nroCliente}: ${error.message}`);
      }
    }

    // Identificar items que tienen N° de cliente pero no se encontró factura en el período
    for (const [nroClienteNormalizado, item] of nroClienteToItemMap.entries()) {
      const tieneFactura = facturasLitoralgas.some(f => normalizarNroCliente(f.nroCliente) === nroClienteNormalizado);
      if (!tieneFactura && !actualizados.includes(item.id)) {
        sinFacturaEnPeriodo.push(nroClienteNormalizado);
      }
    }

    // 7. Devolver resultado
    res.json({
      periodo,
      actualizados: actualizados.length,
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
