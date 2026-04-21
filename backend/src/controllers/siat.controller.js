import prisma from '../db/prisma.js';
import { scrapeSiatLiquidaciones } from '../services/siatScraper.js';

/**
 * Autocompletar importes y vencimientos desde SIAT Rosario (TGI)
 * POST /api/liquidaciones/impuestos/siat/autocompletar
 */
export const autocompletarSiat = async (req, res) => {
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
    // 1. Obtener TipoImpuestoPropiedad TGI (id = 4 o codigo = "TGI")
    const tipoImpuestoTgi = await prisma.tipoImpuestoPropiedad.findFirst({
      where: {
        OR: [
          { id: 4 },
          { codigo: 'TGI' }
        ],
        activo: true,
        deletedAt: null
      }
    });

    if (!tipoImpuestoTgi) {
      return res.status(404).json({ 
        error: 'No se encontró el tipo de impuesto TGI configurado' 
      });
    }

    // 2. Obtener LiquidacionItem del período que correspondan a TGI
    const items = await prisma.liquidacionItem.findMany({
      where: {
        liquidacion: {
          periodo: periodoDb
        },
        propiedadImpuesto: {
          tipoImpuestoId: tipoImpuestoTgi.id
        },
        activo: true,
        deletedAt: null
      },
      include: {
        propiedadImpuesto: {
          include: {
            tipoImpuesto: true,
            campos: {
              include: {
                tipoCampo: true
              }
            }
          }
        },
        estadoItem: true
      }
    });

    console.log(`[SIAT] Encontrados ${items.length} items de TGI para el período ${periodo}`);

    // 3. Agrupar items por propiedadImpuestoId y obtener credenciales (CTA y COD_GES)
    const propiedadesMap = new Map(); // propiedadImpuestoId -> {CTA, COD_GES, items: []}
    const sinCredencialesPropiedad = [];
    const warnings = [];

    for (const item of items) {
      const propiedadImpuestoId = item.propiedadImpuestoId;
      
      if (!propiedadesMap.has(propiedadImpuestoId)) {
        // Buscar campos CTA (codigo = "CTA", tipoCampoId = 9) y COD_GES (codigo = "COD_GES", tipoCampoId = 10)
        const campos = item.propiedadImpuesto?.campos || [];
        
        const ctaCampo = campos.find(c => 
          c.tipoCampo?.codigo === 'CTA' || c.tipoCampoId === 9
        );
        const codGesCampo = campos.find(c => 
          c.tipoCampo?.codigo === 'COD_GES' || c.tipoCampoId === 10
        );

        const CTA = ctaCampo?.valor?.trim() || null;
        const COD_GES = codGesCampo?.valor?.trim() || null;

        if (!CTA || !COD_GES) {
          sinCredencialesPropiedad.push(propiedadImpuestoId);
          warnings.push(`PropiedadImpuestoId ${propiedadImpuestoId} sin CTA o COD_GES configurado`);
          console.log(`[SIAT] PropiedadImpuestoId ${propiedadImpuestoId} sin credenciales completas - CTA: ${CTA ? 'OK' : 'FALTA'}, COD_GES: ${COD_GES ? 'OK' : 'FALTA'}`);
        } else {
          propiedadesMap.set(propiedadImpuestoId, {
            propiedadImpuestoId,
            CTA,
            COD_GES,
            items: []
          });
        }
      }

      // Agregar item a la propiedad si tiene credenciales
      if (propiedadesMap.has(propiedadImpuestoId)) {
        propiedadesMap.get(propiedadImpuestoId).items.push(item);
      }
    }

    // 4. Preparar array de propiedades para el scraper
    const propiedadesParaScraper = Array.from(propiedadesMap.values());

    console.log(`[SIAT] Total de propiedades a procesar: ${propiedadesParaScraper.length}`);
    console.log(`[SIAT] Propiedades sin credenciales: ${sinCredencialesPropiedad.length}`);

    // 5. Ejecutar scraper
    let liquidacionesSiat = [];
    if (propiedadesParaScraper.length > 0) {
      try {
        liquidacionesSiat = await scrapeSiatLiquidaciones(
          propiedadesParaScraper,
          inicioPeriodo,
          finPeriodo
        );
        console.log(`[SIAT] Scraping completado. ${liquidacionesSiat.length} liquidaciones obtenidas.`);
      } catch (error) {
        console.error(`[SIAT] Error en scraping: ${error.message}`);
        return res.status(500).json({
          error: 'Error al obtener datos de SIAT',
          detalle: error.message
        });
      }
    }

    // 6. Matching y actualización de LiquidacionItem (transacción ACID en bloque)
    const sinLiqEnPeriodo = [];
    const errores = [];

    const liquidacionesMap = new Map();
    for (const liq of liquidacionesSiat) {
      liquidacionesMap.set(liq.propiedadImpuestoId, liq);
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

    for (const [propiedadImpuestoId, propiedad] of propiedadesMap.entries()) {
      const liquidacion = liquidacionesMap.get(propiedadImpuestoId);
      if (!liquidacion) {
        sinLiqEnPeriodo.push(propiedadImpuestoId);
        console.log(`[SIAT] No se encontró liquidación en período para propiedad ${propiedadImpuestoId}`);
        continue;
      }

      for (const item of propiedad.items) {
        transacciones.push(
          prisma.liquidacionItem.update({
            where: { id: item.id },
            data: {
              importe: liquidacion.importe,
              vencimiento: liquidacion.vencimiento,
              refExterna: liquidacion.refExterna,
              estadoItemId: estadoCompletado.id,
              completadoAt,
              completadoById
            }
          })
        );
      }
    }

    let actualizados = 0;
    if (transacciones.length > 0) {
      await prisma.$transaction(transacciones);
      actualizados = transacciones.length;
      console.log(`[SIAT] ${actualizados} items actualizados en transacción.`);
    }

    const respuesta = {
      periodo,
      totalItems: items.length,
      actualizados,
      sinCredencialesPropiedad: sinCredencialesPropiedad,
      sinLiqEnPeriodo: sinLiqEnPeriodo,
      warnings,
      errores
    };

    console.log(`[SIAT] Proceso completado: ${actualizados} items actualizados, ${sinCredencialesPropiedad.length} sin credenciales, ${sinLiqEnPeriodo.length} sin liquidación en período`);

    res.json(respuesta);

  } catch (error) {
    console.error(`[SIAT] Error general: ${error.message}`);
    res.status(500).json({
      error: 'Error al autocompletar TGI desde SIAT',
      detalle: error.message
    });
  }
};
