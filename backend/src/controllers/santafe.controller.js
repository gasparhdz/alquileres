import prisma from '../db/prisma.js';
import { scrapeCuotas, parseCuotasFromResultHtml, PERIODO_TO_CUOTA } from '../services/santafeEInBoletasScraper.js';

/**
 * Normaliza partida para matching (trim, sin espacios extra)
 */
function normalizarPartida(partida) {
  if (!partida) return '';
  return partida.toString().trim().replace(/\s+/g, ' ');
}

/**
 * Autocompletar importes y vencimientos desde Santa Fe e-in-boletas (Impuesto Inmobiliario).
 * Obtiene partidas de los items del período (tipo API con campo NRO_PART), ejecuta el scraper
 * en modo semi-automático (el operador debe completar ALTCHA en la ventana del navegador)
 * y actualiza los LiquidacionItem con importe y vencimiento.
 *
 * POST /api/liquidaciones/impuestos/santafe-ein-boletas/autocompletar
 * Body: { periodo: "02-2026" }  (MM-YYYY)
 */
export const autocompletarSantafeEInBoletas = async (req, res) => {
  const { periodo } = req.body;

  if (!periodo || !/^\d{2}-\d{4}$/.test(periodo)) {
    return res.status(400).json({
      error: 'El período debe tener el formato MM-YYYY (ej: 02-2026)',
    });
  }

  const [mes, anio] = periodo.split('-');
  const periodoDb = `${anio}-${mes}`;

  const cuotaKey = PERIODO_TO_CUOTA[periodoDb];
  if (!cuotaKey) {
    // No devolver 400: en el flujo "Generar" se llama a todos los scrapers; este período simplemente no tiene cuota API
    return res.json({
      periodo,
      actualizados: 0,
      sinPartida: [],
      warnings: [`Período ${periodo} no corresponde a una cuota de Impuesto Inmobiliario (solo 02, 04 y 06 de 2026). Se omite autocompletar API.`],
      errores: [],
    });
  }

  try {
    const tipoImpuestoApi = await prisma.tipoImpuestoPropiedad.findFirst({
      where: {
        codigo: 'API',
        activo: true,
        deletedAt: null,
      },
    });

    if (!tipoImpuestoApi) {
      return res.status(404).json({
        error: 'No se encontró el tipo de impuesto API (Impuesto Inmobiliario) configurado.',
      });
    }

    const items = await prisma.liquidacionItem.findMany({
      where: {
        liquidacion: { periodo: periodoDb },
        propiedadImpuesto: {
          tipoImpuestoId: tipoImpuestoApi.id,
        },
        activo: true,
        deletedAt: null,
      },
      include: {
        propiedadImpuesto: {
          include: {
            campos: {
              where: {
                tipoCampo: {
                  codigo: 'NRO_PART',
                },
              },
              include: { tipoCampo: true },
            },
          },
        },
        estadoItem: true,
      },
    });

    const partidaToItems = new Map();
    const warnings = [];
    const itemsSinPartida = [];

    for (const item of items) {
      const campoPartida = item.propiedadImpuesto?.campos?.find(
        (c) => c.tipoCampo?.codigo === 'NRO_PART'
      );
      if (!campoPartida?.valor) {
        itemsSinPartida.push(item.id);
        continue;
      }
      const partidaNorm = normalizarPartida(campoPartida.valor);
      if (!partidaNorm) {
        itemsSinPartida.push(item.id);
        continue;
      }
      if (!partidaToItems.has(partidaNorm)) {
        partidaToItems.set(partidaNorm, []);
      }
      partidaToItems.get(partidaNorm).push(item);
    }

    const partidasUnicas = Array.from(partidaToItems.keys());
    if (partidasUnicas.length === 0) {
      return res.json({
        periodo,
        actualizados: 0,
        sinPartida: itemsSinPartida,
        warnings: itemsSinPartida.length ? ['Ningún item tiene N° de partida configurado.'] : [],
        errores: [],
      });
    }

    const estadoCompletado = await prisma.estadoItemLiquidacion.findFirst({
      where: { codigo: 'COMPLETADO' },
    });
    if (!estadoCompletado) {
      return res.status(500).json({ error: 'No se encontró el estado COMPLETADO en la base de datos' });
    }

    const transacciones = [];
    const errores = [];
    const headless = false;
    const completadoAt = new Date();
    const completadoById = req.user?.id ?? null;

    for (const partida of partidasUnicas) {
      try {
        const result = await scrapeCuotas(partida, {
          headless,
          waitForAltchaMs: 5 * 60 * 1000,
          timeout: 60000,
          retries: 2,
        });

        if (result.status !== 'OK' || !result.cuotas?.length) {
          errores.push(`Partida ${partida}: ${result.status} - ${result.error || 'sin datos'}`);
          continue;
        }

        const cuota = result.cuotas.find((c) => c.periodo === cuotaKey);
        if (!cuota) {
          errores.push(`Partida ${partida}: no se encontró cuota ${cuotaKey} en la respuesta`);
          continue;
        }

        const itemsToUpdate = partidaToItems.get(partida) || [];
        const vencimientoDate = new Date(cuota.fechaVto);

        for (const item of itemsToUpdate) {
          transacciones.push(
            prisma.liquidacionItem.update({
              where: { id: item.id },
              data: {
                importe: cuota.importe,
                vencimiento: vencimientoDate,
                estadoItemId: estadoCompletado.id,
                completadoAt,
                completadoById,
              },
            })
          );
        }
      } catch (err) {
        errores.push(`Partida ${partida}: ${err.message}`);
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    if (transacciones.length > 0) {
      await prisma.$transaction(transacciones);
      console.log(`[SANTAFE] ${transacciones.length} items actualizados en transacción.`);
    }

    res.json({
      periodo,
      actualizados: transacciones.length,
      sinPartida: itemsSinPartida,
      warnings: itemsSinPartida.length ? ['Algunos items no tienen N° de partida configurado.'] : [],
      errores,
    });
  } catch (error) {
    console.error('[SANTAFE-EIN-BOLETAS] Error:', error);
    res.status(500).json({
      error: 'Error al autocompletar desde Santa Fe e-in-boletas: ' + error.message,
      periodo,
      actualizados: 0,
      sinPartida: [],
      warnings: [],
      errores: [error.message],
    });
  }
};

/**
 * Parser de prueba (sin navegador).
 * POST /api/liquidaciones/impuestos/santafe-ein-boletas/parse-test
 * Body: { html: "<html>..." }
 */
export const parseTestSantafeEInBoletas = async (req, res) => {
  const { html } = req.body;
  if (html == null) {
    return res.status(400).json({ error: 'Se requiere "html" en el body' });
  }
  const result = parseCuotasFromResultHtml(html);
  res.json(result);
};
