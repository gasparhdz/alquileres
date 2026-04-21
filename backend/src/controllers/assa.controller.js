import prisma from '../db/prisma.js';
import { scrapeAssaFacturas } from '../services/assaScraper.js';

/**
 * Autocompletar importes y vencimientos desde ASSA
 * POST /api/impuestos/assa/autocompletar
 */
export const autocompletarAssa = async (req, res) => {
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
    // 1. Obtener credenciales de TipoImpuestoPropiedad AGUA
    const tipoImpuestoAgua = await prisma.tipoImpuestoPropiedad.findFirst({
      where: {
        codigo: 'AGUA',
        activo: true,
        deletedAt: null
      }
    });

    if (!tipoImpuestoAgua) {
      return res.status(404).json({ 
        error: 'No se encontró el tipo de impuesto AGUA configurado' 
      });
    }

    if (!tipoImpuestoAgua.usuario || !tipoImpuestoAgua.password) {
      return res.status(400).json({ 
        error: 'Las credenciales de ASSA no están configuradas. Configure usuario y contraseña en Configuración > Tipos de Impuesto > AGUA' 
      });
    }

    // 2. Obtener LiquidacionItem del período que correspondan a AGUA
    const items = await prisma.liquidacionItem.findMany({
      where: {
        liquidacion: {
          periodo: periodoDb
        },
        propiedadImpuesto: {
          tipoImpuesto: {
            codigo: 'AGUA'
          }
        },
        activo: true,
        deletedAt: null
        // Opcional: solo pendientes
        // estadoItem: {
        //   codigo: 'PENDIENTE'
        // }
      },
      include: {
        propiedadImpuesto: {
          include: {
            tipoImpuesto: true,
            campos: {
              where: {
                tipoCampo: {
                  codigo: 'P_SUM' // El código real es P_SUM según el seed
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

    console.log(`[ASSA] Encontrados ${items.length} items de AGUA para el período ${periodo}`);

    // 3. Construir mapa puntoSuministro -> liquidacionItem
    const puntoToItemMap = new Map();
    const warnings = [];
    const itemsSinPunto = [];

    for (const item of items) {
      console.log(`[ASSA] Procesando item ${item.id}, PropiedadImpuestoId: ${item.propiedadImpuestoId}`);
      console.log(`[ASSA] Campos encontrados: ${item.propiedadImpuesto?.campos?.length || 0}`);
      
      // Buscar el campo PUNTO_SUMINISTRO (código: P_SUM)
      const puntoCampo = item.propiedadImpuesto?.campos?.find(c => 
        c.tipoCampo?.codigo === 'P_SUM' ||
        c.tipoCampo?.codigo === 'PUNTO_SUMINISTRO' || 
        c.tipoCampo?.codigo?.toLowerCase() === 'punto_suministro' ||
        c.tipoCampo?.nombre?.toLowerCase().includes('punto') ||
        c.tipoCampo?.nombre?.toLowerCase().includes('suministro')
      );
      
      if (!puntoCampo || !puntoCampo.valor) {
        // Log detallado para debugging
        if (item.propiedadImpuesto?.campos) {
          console.log(`[ASSA] Campos disponibles para item ${item.id}:`, 
            item.propiedadImpuesto.campos.map(c => ({
              codigo: c.tipoCampo?.codigo,
              nombre: c.tipoCampo?.nombre,
              valor: c.valor
            }))
          );
        }
        warnings.push(`PropiedadImpuestoId ${item.propiedadImpuestoId} sin Punto de Suministro (P_SUM) configurado`);
        itemsSinPunto.push(item.id);
        continue;
      }

      const puntoSuministro = puntoCampo.valor.trim();
      console.log(`[ASSA] Punto de suministro encontrado para item ${item.id}: ${puntoSuministro}`);
      puntoToItemMap.set(puntoSuministro, item);
    }

    // 4. Preparar lista de puntos de suministro a filtrar (solo procesar los que están en la BD)
    const puntosAFiltrar = Array.from(puntoToItemMap.keys());
    console.log(`[ASSA] Filtrando puntos: solo procesar ${puntosAFiltrar.length} puntos de la base de datos`);
    
    // 5. Ejecutar scraper ASSA
    console.log('[ASSA] Iniciando scraping...');
    let facturasAssa = [];
    
    try {
      facturasAssa = await scrapeAssaFacturas(
        tipoImpuestoAgua.usuario,
        tipoImpuestoAgua.password,
        inicioPeriodo,
        finPeriodo,
        puntosAFiltrar
      );
      console.log(`[ASSA] Scraping completado. ${facturasAssa.length} facturas obtenidas.`);
    } catch (error) {
      console.error('[ASSA] Error en scraping:', error);
      return res.status(500).json({
        error: 'Error al obtener datos de ASSA: ' + error.message,
        periodo,
        actualizados: 0,
        sinFacturaEnPeriodo: [],
        sinMatchPunto: [],
        warnings,
        errores: [error.message]
      });
    }

    const sinFacturaEnPeriodo = [];
    const sinMatchPunto = [];
    const errores = [];

    const facturasPorPunto = new Map();
    for (const factura of facturasAssa) {
      if (!facturasPorPunto.has(factura.punto)) {
        facturasPorPunto.set(factura.punto, []);
      }
      facturasPorPunto.get(factura.punto).push(factura);
    }

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

    for (const [puntoSuministro, item] of puntoToItemMap.entries()) {
      const facturasPunto = facturasPorPunto.get(puntoSuministro) || [];
      const facturasValidas = facturasPunto.filter(factura => {
        if (!factura.vencimiento) return false;
        const fechaVenc = new Date(factura.vencimiento);
        return fechaVenc >= inicioPeriodo && fechaVenc < finPeriodo;
      });

      if (facturasValidas.length === 0) {
        sinFacturaEnPeriodo.push(puntoSuministro);
        continue;
      }

      facturasValidas.sort((a, b) => {
        const fechaA = new Date(a.vencimiento);
        const fechaB = new Date(b.vencimiento);
        return fechaA - fechaB;
      });
      const facturaSeleccionada = facturasValidas[0];

      transacciones.push(
        prisma.liquidacionItem.update({
          where: { id: item.id },
          data: {
            importe: facturaSeleccionada.importe,
            vencimiento: facturaSeleccionada.vencimiento,
            refExterna: facturaSeleccionada.referencia || item.refExterna,
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
      console.log(`[ASSA] ${actualizados} items actualizados en transacción.`);
    }

    // Puntos en ASSA pero no en sistema
    for (const [punto] of facturasPorPunto.entries()) {
      if (!puntoToItemMap.has(punto)) {
        sinMatchPunto.push(punto);
      }
    }

    res.json({
      periodo,
      actualizados,
      sinFacturaEnPeriodo,
      sinMatchPunto,
      warnings,
      errores
    });

  } catch (error) {
    console.error('[ASSA] Error general:', error);
    res.status(500).json({
      error: 'Error al autocompletar desde ASSA: ' + error.message,
      periodo,
      actualizados: 0,
      sinFacturaEnPeriodo: [],
      sinMatchPunto: [],
      warnings: [],
      errores: [error.message]
    });
  }
};
