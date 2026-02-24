import { PrismaClient } from '@prisma/client';
import { scrapeEpeFacturas } from '../services/epeScraper.js';

const prisma = new PrismaClient();

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

    // 3. Construir mapa nroClienteNormalizado -> liquidacionItem
    const nroClienteToItemMap = new Map();
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

      const nroClienteNormalizado = normalizarNroCliente(nroClienteCampo.valor);
      console.log(`[EPE] N° de cliente encontrado para item ${item.id}: ${nroClienteCampo.valor} -> normalizado: ${nroClienteNormalizado}`);
      nroClienteToItemMap.set(nroClienteNormalizado, item);
    }

    // 4. Preparar lista de números de cliente a filtrar (solo procesar los que están en la BD)
    const nroClientesAFiltrar = Array.from(nroClienteToItemMap.keys());
    console.log(`[EPE] Filtrando suministros: solo procesar ${nroClientesAFiltrar.length} suministros de la base de datos`);
    
    // 5. Ejecutar scraper EPE
    console.log('[EPE] Iniciando scraping...');
    let cuotasEpe = [];
    
    try {
      cuotasEpe = await scrapeEpeFacturas(
        tipoImpuestoLuz.usuario,
        tipoImpuestoLuz.password,
        inicioPeriodo,
        finPeriodo,
        nroClientesAFiltrar
      );
      console.log(`[EPE] Scraping completado. ${cuotasEpe.length} cuotas obtenidas.`);
    } catch (error) {
      console.error('[EPE] Error en scraping:', error);
      return res.status(500).json({
        error: 'Error al obtener datos de EPE: ' + error.message,
        periodo,
        actualizados: 0,
        sinFacturaEnPeriodo: [],
        sinMatchNroCliente: [],
        warnings,
        errores: [error.message]
      });
    }

    // 6. Hacer matching y actualizar items
    const actualizados = [];
    const sinFacturaEnPeriodo = [];
    const sinMatchNroCliente = [];
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

    // Procesar cada cuota obtenida de EPE
    for (const cuota of cuotasEpe) {
      try {
        const nroClienteNormalizado = normalizarNroCliente(cuota.nroCliente);
        const item = nroClienteToItemMap.get(nroClienteNormalizado);
        
        if (!item) {
          sinMatchNroCliente.push(cuota.nroCliente);
          continue;
        }

        // Actualizar LiquidacionItem
        const importeActual = item.importe ? parseFloat(item.importe) : null;
        const importeNuevo = cuota.importe;

        await prisma.liquidacionItem.update({
          where: { id: item.id },
          data: {
            importeAnterior: importeActual && importeActual !== importeNuevo ? importeActual : item.importeAnterior,
            importe: importeNuevo,
            vencimiento: cuota.vencimiento,
            refExterna: cuota.refExterna || item.refExterna,
            estadoItemId: estadoCompletado.id,
            completadoAt: new Date(),
            completadoById: req.user?.id || null
          }
        });

        actualizados.push(item.id);
        console.log(`[EPE] Item ${item.id} actualizado con importe ${importeNuevo} y vencimiento ${cuota.vencimiento}`);

      } catch (error) {
        console.error(`[EPE] Error al procesar cuota para cliente ${cuota.nroCliente}:`, error);
        errores.push(`Error al procesar cliente ${cuota.nroCliente}: ${error.message}`);
      }
    }

    // Identificar items que tienen N° de cliente pero no se encontró cuota en el período
    for (const [nroClienteNormalizado, item] of nroClienteToItemMap.entries()) {
      const tieneCuota = cuotasEpe.some(c => normalizarNroCliente(c.nroCliente) === nroClienteNormalizado);
      if (!tieneCuota && !actualizados.includes(item.id)) {
        sinFacturaEnPeriodo.push(nroClienteNormalizado);
      }
    }

    // 6. Devolver resultado
    res.json({
      periodo,
      actualizados: actualizados.length,
      sinFacturaEnPeriodo,
      sinMatchNroCliente,
      warnings,
      errores
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
