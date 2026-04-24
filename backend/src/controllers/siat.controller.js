import prisma from '../db/prisma.js';
import { scrapeSiatLiquidaciones } from '../services/siatScraper.js';

/**
 * Autocompletar importes y vencimientos de TGI.
 * POST /api/liquidaciones/impuestos/tgi/autocompletar
 */
export const autocompletarTgi = async (req, res) => {
  const { periodo } = req.body;

  if (!periodo || !/^\d{2}-\d{4}$/.test(periodo)) {
    return res.status(400).json({
      error: 'El periodo debe tener el formato MM-YYYY (ej: 01-2026)',
    });
  }

  const [mes, anio] = periodo.split('-');
  const periodoDb = `${anio}-${mes}`;
  const inicioPeriodo = new Date(Number(anio), Number(mes) - 1, 1, 0, 0, 0, 0);
  const finPeriodo = new Date(Number(anio), Number(mes), 1, 0, 0, 0, 0);

  try {
    const tipoImpuestoTgi = await prisma.tipoImpuestoPropiedad.findFirst({
      where: {
        OR: [{ id: 4 }, { codigo: 'TGI' }],
        activo: true,
        deletedAt: null,
      },
    });

    if (!tipoImpuestoTgi) {
      return res.status(404).json({
        error: 'No se encontro el tipo de impuesto TGI configurado',
      });
    }

    const items = await prisma.liquidacionItem.findMany({
      where: {
        liquidacion: { periodo: periodoDb },
        propiedadImpuesto: { tipoImpuestoId: tipoImpuestoTgi.id },
        activo: true,
        deletedAt: null,
      },
      include: {
        propiedadImpuesto: {
          include: {
            tipoImpuesto: true,
            campos: {
              include: {
                tipoCampo: true,
              },
            },
          },
        },
        estadoItem: true,
      },
    });

    console.log(`[TGI] Encontrados ${items.length} items de TGI para el periodo ${periodo}`);

    const propiedadesMap = new Map();
    const sinCredencialesPropiedad = [];
    const warnings = [];

    for (const item of items) {
      const propiedadImpuestoId = item.propiedadImpuestoId;

      if (!propiedadesMap.has(propiedadImpuestoId)) {
        const campos = item.propiedadImpuesto?.campos || [];
        const ctaCampo = campos.find((c) => c.tipoCampo?.codigo === 'CTA' || c.tipoCampoId === 9);
        const codGesCampo = campos.find((c) => c.tipoCampo?.codigo === 'COD_GES' || c.tipoCampoId === 10);

        const CTA = ctaCampo?.valor?.trim() || null;
        const COD_GES = codGesCampo?.valor?.trim() || null;

        if (!CTA || !COD_GES) {
          sinCredencialesPropiedad.push(propiedadImpuestoId);
          warnings.push(`PropiedadImpuestoId ${propiedadImpuestoId} sin CTA o COD_GES configurado`);
          console.log(`[TGI] PropiedadImpuestoId ${propiedadImpuestoId} sin credenciales completas - CTA: ${CTA ? 'OK' : 'FALTA'}, COD_GES: ${COD_GES ? 'OK' : 'FALTA'}`);
        } else {
          propiedadesMap.set(propiedadImpuestoId, {
            propiedadImpuestoId,
            CTA,
            COD_GES,
            items: [],
          });
        }
      }

      if (propiedadesMap.has(propiedadImpuestoId)) {
        propiedadesMap.get(propiedadImpuestoId).items.push(item);
      }
    }

    const propiedadesParaScraper = Array.from(propiedadesMap.values());

    console.log(`[TGI] Total de propiedades a procesar: ${propiedadesParaScraper.length}`);
    console.log(`[TGI] Propiedades sin credenciales: ${sinCredencialesPropiedad.length}`);

    let liquidacionesTgi = [];
    if (propiedadesParaScraper.length > 0) {
      try {
        liquidacionesTgi = await scrapeSiatLiquidaciones(propiedadesParaScraper, inicioPeriodo, finPeriodo);
        console.log(`[TGI] Scraping completado. ${liquidacionesTgi.length} liquidaciones obtenidas.`);
      } catch (error) {
        console.error(`[TGI] Error en scraping: ${error.message}`);
        return res.status(500).json({
          error: 'Error al obtener datos de TGI',
          detalle: error.message,
        });
      }
    }

    const liquidacionesMap = new Map();
    for (const liq of liquidacionesTgi) {
      liquidacionesMap.set(liq.propiedadImpuestoId, liq);
    }

    const estadoCompletado = await prisma.estadoItemLiquidacion.findFirst({
      where: { codigo: 'COMPLETADO' },
    });

    if (!estadoCompletado) {
      return res.status(500).json({
        error: 'No se encontro el estado COMPLETADO en la base de datos',
      });
    }

    const completadoAt = new Date();
    const completadoById = req.user?.id || null;
    const sinLiqEnPeriodo = [];
    const errores = [];
    const transacciones = [];

    for (const [propiedadImpuestoId, propiedad] of propiedadesMap.entries()) {
      const liquidacion = liquidacionesMap.get(propiedadImpuestoId);

      if (!liquidacion) {
        sinLiqEnPeriodo.push(propiedadImpuestoId);
        console.log(`[TGI] No se encontro liquidacion en periodo para propiedad ${propiedadImpuestoId}`);
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
              completadoById,
            },
          }),
        );
      }
    }

    let actualizados = 0;
    if (transacciones.length > 0) {
      await prisma.$transaction(transacciones);
      actualizados = transacciones.length;
      console.log(`[TGI] ${actualizados} items actualizados en transaccion.`);
    }

    console.log(`[TGI] Proceso completado: ${actualizados} items actualizados, ${sinCredencialesPropiedad.length} sin credenciales, ${sinLiqEnPeriodo.length} sin liquidacion en periodo`);

    return res.json({
      periodo,
      totalItems: items.length,
      actualizados,
      sinCredencialesPropiedad,
      sinLiqEnPeriodo,
      warnings,
      errores,
    });
  } catch (error) {
    console.error(`[TGI] Error general: ${error.message}`);
    return res.status(500).json({
      error: 'Error al autocompletar TGI',
      detalle: error.message,
    });
  }
};

// Alias temporal para no romper integraciones viejas mientras migramos de /siat a /tgi.
export const autocompletarSiat = autocompletarTgi;
