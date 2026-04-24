import { chromium } from 'playwright';

function parseImporteSiat(texto) {
  if (!texto) return null;
  const normalizado = String(texto)
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const numero = parseFloat(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function parseFechaSiat(texto) {
  if (!texto) return null;
  const match = String(texto).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, dia, mes, anio] = match;
  return new Date(Number(anio), Number(mes) - 1, Number(dia));
}

async function buscarPrimerCampoVisible(page, selectors) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout: 1500 });
      if (await locator.isVisible()) {
        return { locator, selector };
      }
    } catch {
      // Probar siguiente selector
    }
  }
  return null;
}

async function parsearLiquidacionesDesdeDom(page) {
  const liquidacionesRaw = await page.evaluate(() => {
    const extraerTexto = (node) => (node?.textContent || '').replace(/\u00a0/g, ' ').trim();
    const filasPrincipales = Array.from(document.querySelectorAll('tbody#bloqueAdmin > tr'));
    const resultado = [];

    for (const fila of filasPrincipales) {
      const celdasPrincipales = Array.from(fila.querySelectorAll(':scope > td'));
      if (celdasPrincipales.length < 2) continue;

      const periodoTexto = extraerTexto(celdasPrincipales[1]);
      const periodoMatch = periodoTexto.match(/(\d{4})-(\d{2})/);
      if (!periodoMatch) continue;

      const [, anioPeriodo, mesPeriodo] = periodoMatch;
      const filasDeuda = Array.from(fila.querySelectorAll('table tbody tr'));

      for (const filaDeuda of filasDeuda) {
        const celdas = Array.from(filaDeuda.querySelectorAll('td'));
        if (celdas.length < 4) continue;

        const importeTexto = extraerTexto(celdas[2]);
        const vencimientoTexto = extraerTexto(celdas[3]);
        const enlaceDetalle = filaDeuda.querySelector('a[href*="verDetalleDeuda"]');
        const href = enlaceDetalle?.getAttribute('href') || '';
        const selectedIdMatch = href.match(/selectedId=(\d+)/);

        resultado.push({
          periodo: `${anioPeriodo}-${mesPeriodo}`,
          importeTexto,
          vencimientoTexto,
          refExterna: selectedIdMatch ? `Liq ${selectedIdMatch[1]}` : `Liq ${anioPeriodo}-${mesPeriodo}`,
        });
      }
    }

    return resultado;
  });

  return liquidacionesRaw
    .map((liq) => {
      const importe = parseImporteSiat(liq.importeTexto);
      const vencimiento = parseFechaSiat(liq.vencimientoTexto);

      if (importe == null || !vencimiento) {
        return null;
      }

      return {
        periodo: liq.periodo,
        importe,
        vencimiento,
        refExterna: liq.refExterna,
      };
    })
    .filter(Boolean);
}

function parsearLiquidacionesDesdeHtml(html) {
  if (!html) return [];

  const filas = [];
  const rowRegex = /<td>\s*(\d{4}-\d{2})&nbsp;<\/td>[\s\S]*?<td[^>]*align="right">\$ ?([\d\.\,]+)&nbsp;<\/td>[\s\S]*?<td[^>]*align="center">(\d{2}\/\d{2}\/\d{4})&nbsp;<\/td>[\s\S]*?selectedId=(\d+)/gi;

  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const [, periodo, importeTexto, vencimientoTexto, selectedId] = match;
    const importe = parseImporteSiat(importeTexto);
    const vencimiento = parseFechaSiat(vencimientoTexto);

    if (importe == null || !vencimiento) {
      continue;
    }

    filas.push({
      periodo,
      importe,
      vencimiento,
      refExterna: `Liq ${selectedId}`,
    });
  }

  return filas;
}

/**
 * Scraper para obtener liquidaciones/deudas de TGI desde SIAT Rosario.
 *
 * @param {Array<{propiedadImpuestoId: number, CTA: string, COD_GES: string}>} propiedades
 * @param {Date} inicioPeriodo
 * @param {Date} finPeriodo
 * @returns {Promise<Array<{propiedadImpuestoId: number, CTA: string, COD_GES: string, importe: number, vencimiento: Date, refExterna: string}>>}
 */
export async function scrapeSiatLiquidaciones(propiedades, inicioPeriodo, finPeriodo) {
  if (!propiedades || propiedades.length === 0) {
    return [];
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });

  const page = await context.newPage();
  const resultados = [];
  const siatUrl = 'https://siat.rosario.gob.ar/siat/seg/Login.do?method=anonimo&url=/gde/AdministrarLiqDeuda.do?method=inicializarContr&id=14';

  try {
    for (const propiedad of propiedades) {
      const { propiedadImpuestoId, CTA, COD_GES } = propiedad;

      try {
        console.log(`[TGI] Procesando propiedad ${propiedadImpuestoId} - CTA: ${CTA}, COD_GES: ${COD_GES ? '***' : 'NO CONFIGURADO'}`);

        if (!CTA || !COD_GES) {
          console.log(`[TGI] Propiedad ${propiedadImpuestoId} sin credenciales completas`);
          continue;
        }

        await context.clearCookies();
        await page.goto('about:blank').catch(() => {});
        await page.waitForTimeout(500);

        console.log(`[TGI] Navegando a TGI para propiedad ${propiedadImpuestoId}...`);
        await page.goto(siatUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });

        await page.waitForTimeout(2000);
        const urlInicial = page.url();
        console.log(`[TGI] URL inicial: ${urlInicial}`);

        const ctaFieldInfo = await buscarPrimerCampoVisible(page, [
          'input[name="cuenta.numeroCuenta"]',
          'input[name*="numeroCuenta"]',
          'input[name*="cuenta"]',
          'input[id*="cuenta"]',
        ]);
        const codGesFieldInfo = await buscarPrimerCampoVisible(page, [
          'input[name="cuenta.codGesPer"]',
          'input[name*="codGesPer"]',
          'input[name*="codigo"]',
          'input[name*="gestion"]',
          'input[id*="codigo"]',
          'input[id*="gestion"]',
        ]);

        if (!ctaFieldInfo || !codGesFieldInfo) {
          console.log(`[TGI] No se encontraron los campos de entrada para propiedad ${propiedadImpuestoId}`);
          await page.screenshot({ path: `tgi-debug-${propiedadImpuestoId}.png` }).catch(() => {});
          continue;
        }

        console.log(`[TGI] Campo CTA encontrado: ${ctaFieldInfo.selector}`);
        console.log(`[TGI] Campo COD_GES encontrado: ${codGesFieldInfo.selector}`);
        console.log(`[TGI] Completando credenciales para propiedad ${propiedadImpuestoId}...`);

        await ctaFieldInfo.locator.fill(CTA.trim());
        await page.waitForTimeout(300);
        await codGesFieldInfo.locator.fill(COD_GES.trim());
        await page.waitForTimeout(300);

        const navigationPromise = page.waitForNavigation({
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        }).catch(() => null);

        const boton = page.locator('button[name="btnAceptar"], button.boton, button[type="submit"], input[type="submit"]').first();
        if (await boton.isVisible().catch(() => false)) {
          await boton.click();
          console.log('[TGI] Boton de ingreso clickeado');
        } else {
          await page.evaluate(() => {
            if (typeof submitForm === 'function') {
              submitForm('ingresarLiqDeudaContr', '');
            }
          }).catch(() => {});
          console.log('[TGI] submitForm ejecutado');
        }

        await navigationPromise;
        await page.waitForTimeout(2500);

        const currentUrl = page.url();
        console.log(`[TGI] URL actual despues del login: ${currentUrl}`);

        await page.waitForFunction(
          () => {
            const bodyText = document.body?.innerText || '';
            return !!document.querySelector('form#filter') && /Gesti[oó]n Administrativa|Cuenta Seleccionada/i.test(bodyText);
          },
          { timeout: 15000 }
        ).catch(() => null);

        await page.waitForTimeout(1000);

        const pageTitle = await page.title();
        console.log(`[TGI] Titulo de la pagina: ${pageTitle}`);

        let liquidaciones = await parsearLiquidacionesDesdeDom(page);
        console.log(`[TGI] Liquidaciones via DOM para propiedad ${propiedadImpuestoId}: ${liquidaciones.length}`);

        if (liquidaciones.length === 0) {
          const html = await page.content().catch(() => '');
          console.log(`[TGI] HTML obtenido tras login: ${html.length} caracteres`);
          liquidaciones = parsearLiquidacionesDesdeHtml(html);
          console.log(`[TGI] Liquidaciones via HTML para propiedad ${propiedadImpuestoId}: ${liquidaciones.length}`);
          await page.screenshot({ path: `tgi-after-login-${propiedadImpuestoId}.png` }).catch(() => {});
        }

        console.log(`[TGI] Encontradas ${liquidaciones.length} liquidaciones para propiedad ${propiedadImpuestoId}`);

        const liquidacionesEnPeriodo = liquidaciones.filter((liq) =>
          liq.vencimiento >= inicioPeriodo && liq.vencimiento < finPeriodo
        );

        if (liquidacionesEnPeriodo.length > 0) {
          liquidacionesEnPeriodo.sort((a, b) => a.vencimiento - b.vencimiento);
          const liquidacionSeleccionada = liquidacionesEnPeriodo[0];

          resultados.push({
            propiedadImpuestoId,
            CTA,
            COD_GES,
            importe: liquidacionSeleccionada.importe,
            vencimiento: liquidacionSeleccionada.vencimiento,
            refExterna: liquidacionSeleccionada.refExterna,
          });

          console.log(`[TGI] Liquidacion encontrada para propiedad ${propiedadImpuestoId}: Vencimiento ${liquidacionSeleccionada.vencimiento.toLocaleDateString('es-AR')}, Importe $${liquidacionSeleccionada.importe}`);
        } else {
          console.log(`[TGI] No se encontro liquidacion en el periodo para propiedad ${propiedadImpuestoId}`);
        }
      } catch (error) {
        console.error(`[TGI] Error al procesar propiedad ${propiedadImpuestoId}: ${error.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  return resultados;
}
