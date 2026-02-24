import { chromium } from 'playwright';

const EIN_BOLETAS_URL = 'https://www.santafe.gov.ar/e-in-boletas/';

/**
 * Parsea importe en formato argentino: "4.400,00" -> 4400.00
 * Quita puntos (miles), reemplaza coma por punto, parsea como número.
 * @param {string} str - Ej: "4.400,00" o "$ 4.400,00"
 * @returns {number|null} - Número o null si no se puede parsear
 */
export function parseImporte(str) {
  if (str == null || typeof str !== 'string') return null;
  const cleaned = str.replace(/[$\s]/g, '').trim();
  if (!cleaned) return null;
  const sinMiles = cleaned.replace(/\./g, '');
  const conDecimal = sinMiles.replace(',', '.');
  const num = parseFloat(conDecimal);
  return Number.isFinite(num) ? num : null;
}

/**
 * Parsea fecha DD/MM/YYYY a ISO YYYY-MM-DD
 * @param {string} str - Ej: "24/02/2026"
 * @returns {string|null} - "2026-02-24" o null
 */
export function parseFechaVto(str) {
  if (str == null || typeof str !== 'string') return null;
  const trimmed = str.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, dia, mes, anio] = match;
  const d = parseInt(dia, 10);
  const m = parseInt(mes, 10);
  const y = parseInt(anio, 10);
  if (d < 1 || d > 31 || m < 1 || m > 12) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Parser puro: dado HTML de la pantalla de resultado (tabla "Cuotas seleccionadas a descargar"),
 * devuelve array de { periodo, fechaVto, importe }.
 * Útil para tests sin navegador.
 *
 * @param {string} html - HTML de la página de resultado
 * @returns {{ cuotas: Array<{ periodo: string, fechaVto: string, importe: number }>, error?: string }}
 */
export function parseCuotasFromResultHtml(html) {
  const cuotas = [];
  if (!html || typeof html !== 'string') {
    return { cuotas, error: 'HTML vacío o inválido' };
  }

  // Buscar la tabla que contiene el th "Cuotas seleccionadas a descargar"
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tbody = null;
  let tableMatch;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    if (tableMatch[1].includes('Cuotas seleccionadas a descargar')) {
      tbody = tableMatch[1];
      break;
    }
  }
  if (!tbody) {
    return { cuotas, error: 'No se encontró la tabla "Cuotas seleccionadas a descargar"' };
  }
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    const rowHtml = rowMatch[1];
    if (/<th[\s\S]*?>/i.test(rowHtml)) continue; // saltar fila de encabezado si está dentro del tbody
    const cells = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const text = cellMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      cells.push(text);
    }
    if (cells.length < 3) continue;
    const periodo = cells[0]?.trim() || '';
    const fechaVtoStr = cells[1]?.trim() || '';
    const importeStr = cells[2]?.trim() || '';
    const fechaVto = parseFechaVto(fechaVtoStr);
    const importe = parseImporte(importeStr);
    if (periodo && fechaVto != null && importe != null) {
      cuotas.push({ periodo, fechaVto, importe });
    }
  }

  return { cuotas };
}

/**
 * Mapeo período YYYY-MM (liquidación) -> código cuota e-in-boletas (2026/1, 2026/2, 2026/3)
 * 2026/1 vence feb, 2026/2 vence abr, 2026/3 vence jun.
 */
export const PERIODO_TO_CUOTA = {
  '2026-02': '2026/1',
  '2026-04': '2026/2',
  '2026-06': '2026/3',
};

/**
 * Scrape una partida en e-in-boletas (semi-automático: requiere que el operador complete ALTCHA).
 * No se implementa bypass del anti-bot.
 *
 * @param {string} partida - Número de partida (ej: 140300-188754-0013/3)
 * @param {object} options
 * @param {boolean} [options.headless=false] - false para ventana visible (recomendado para ALTCHA)
 * @param {number} [options.waitForAltchaMs=300000] - ms máximos esperando verificación humana (5 min default)
 * @param {number} [options.timeout=60000] - timeout de navegación
 * @param {number} [options.retries=2] - reintentos en error de red
 * @returns {Promise<{ cuotas: Array<{ periodo: string, fechaVto: string, importe: number }>, status: string, error?: string }>}
 */
export async function scrapeCuotas(partida, options = {}) {
  const {
    headless = false,
    waitForAltchaMs = 300000,
    timeout = 60000,
    retries = 2,
  } = options;

  if (!partida || typeof partida !== 'string' || !partida.trim()) {
    return { cuotas: [], status: 'ERROR_PARSE', error: 'Partida requerida' };
  }

  const partidaTrim = partida.trim();
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
      await new Promise((r) => setTimeout(r, backoff));
    }

    const browser = await chromium.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });
      const page = await context.newPage();

      await page.goto(EIN_BOLETAS_URL, { waitUntil: 'domcontentloaded', timeout });
      await page.waitForTimeout(2000);

      const form = await page.$('form#entrada');
      if (!form) {
        await browser.close();
        return { cuotas: [], status: 'ERROR_PARSE', error: 'No se encontró el formulario de entrada' };
      }

      const cta1 = await page.$('#cta1');
      if (!cta1) {
        await browser.close();
        return { cuotas: [], status: 'ERROR_PARSE', error: 'No se encontró el campo Número de Partida (#cta1)' };
      }
      await cta1.fill(partidaTrim);
      await page.waitForTimeout(500);

      // Desmarcar explícitamente "Pago Total Anual" (#c9) y "Credencial de Pago" si existen
      await page.uncheck('#c9').catch(() => {});
      await page.uncheck('#credencial').catch(() => {}); // Por si existe
      await page.waitForTimeout(300);

      // Marcar solo las cuotas individuales 1, 2 y 3
      await page.check('#c1').catch(() => {});
      await page.waitForTimeout(200);
      await page.check('#c2').catch(() => {});
      await page.waitForTimeout(200);
      await page.check('#c3').catch(() => {});
      await page.waitForTimeout(500);

      const altchaWidget = await page.$('altcha-widget');
      if (altchaWidget) {
        console.log('[SANTAFE-EIN-BOLETAS] Esperando verificación humana (ALTCHA). Complete el check en la ventana del navegador.');
        try {
          await page.waitForFunction(
            () => {
              const w = document.querySelector('altcha-widget');
              if (!w) return false;
              const input = document.querySelector('input[name="altchaToken"]');
              return input && input.value && input.value.length > 0;
            },
            { timeout: waitForAltchaMs }
          );
        } catch (e) {
          await browser.close();
          return { cuotas: [], status: 'CAPTCHA_REQUIRED', error: 'Verificación humana no completada (ALTCHA)' };
        }
      }

      // Verificar que no haya errores de validación visibles antes de continuar
      await page.waitForTimeout(1000);
      const validationError = await page.$('.alert-danger, .text-danger, [class*="error"]');
      if (validationError) {
        const errorText = await validationError.textContent().catch(() => '');
        console.log('[SANTAFE-EIN-BOLETAS] Advertencia: error de validación visible:', errorText);
      }

      const submitBtn = await page.$('input[type="submit"][value*="Continuar"], input[value="Continuar"], button:has-text("Continuar")');
      if (!submitBtn) {
        await browser.close();
        return { cuotas: [], status: 'ERROR_PARSE', error: 'No se encontró el botón Continuar' };
      }
      
      await submitBtn.click();
      await page.waitForTimeout(5000); // Dar más tiempo para que cargue la respuesta

      const bodyHtml = await page.content();
      const { cuotas, error: parseError } = parseCuotasFromResultHtml(bodyHtml);

      if (parseError && cuotas.length === 0) {
        const screenshotPath = `santafe-ein-boletas-fail-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath }).catch(() => {});
        await browser.close();
        return { cuotas: [], status: 'NOT_FOUND', error: parseError };
      }

      await browser.close();
      return { cuotas, status: 'OK' };
    } catch (err) {
      lastError = err;
      await browser.close().catch(() => {});
      if (attempt === retries) {
        return {
          cuotas: [],
          status: 'HTTP_ERROR',
          error: err.message || 'Error de red o timeout',
        };
      }
    }
  }

  return {
    cuotas: [],
    status: 'HTTP_ERROR',
    error: lastError?.message || 'Error desconocido',
  };
}
