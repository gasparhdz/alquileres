import { chromium } from 'playwright';

const AGUAS_LOGIN_URL = 'https://ov.aguassantafesinas.com.ar/oficina-virtual/login';
const AGUAS_FACTURAS_URL = 'https://ov.aguassantafesinas.com.ar/oficina-virtual/oficina/facturas';

function esErrorCloudflare(message) {
  return /cloudflare|verify you are human|turnstile|challenge/i.test(message || '');
}

function parseImporte(valor) {
  if (!valor) return 0;
  const normalizado = String(valor)
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const numero = parseFloat(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

function parseFechaArgentina(valor) {
  if (!valor) return null;
  const match = String(valor).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, dia, mes, anio] = match;
  return new Date(Number(anio), Number(mes) - 1, Number(dia));
}

function dentroDePeriodo(fecha, inicioPeriodo, finPeriodo) {
  if (!fecha || !inicioPeriodo || !finPeriodo) return false;
  return fecha >= inicioPeriodo && fecha < finPeriodo;
}

async function clickPrimerVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      await locator.waitFor({ state: 'visible', timeout: 1500 });
      if (await locator.isVisible()) {
        await locator.click();
        return true;
      }
    } catch {
      // Intentar con el siguiente selector
    }
  }
  return false;
}

async function setInputValueReact(page, selector, valor) {
  await page.evaluate(
    ({ inputSelector, value }) => {
      const input = document.querySelector(inputSelector);
      if (!(input instanceof HTMLInputElement)) {
        throw new Error(`No se encontró input para selector ${inputSelector}`);
      }

      const prototype = Object.getPrototypeOf(input);
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
        || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

      descriptor?.set?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    },
    { inputSelector: selector, value: valor },
  );
}

async function completarCampoComoHumano(locator, valor) {
  await locator.click({ clickCount: 3 });
  await locator.press('Control+A').catch(() => {});
  await locator.press('Meta+A').catch(() => {});
  await locator.fill('');
  await locator.type(valor, { delay: 60 });
  await locator.dispatchEvent('input');
  await locator.dispatchEvent('change');
  await locator.blur();
}

async function asegurarValorCampo(page, locator, selector, valor) {
  try {
    await completarCampoComoHumano(locator, valor);
  } catch {
    // Reintentar con setter nativo de DOM/React
  }

  let actual = '';
  try {
    actual = ((await locator.inputValue()) || '').trim();
  } catch {
    actual = '';
  }

  if (actual !== valor) {
    await setInputValueReact(page, selector, valor);
    await page.waitForTimeout(300);
    actual = ((await locator.inputValue()) || '').trim();
  }

  if (actual !== valor) {
    throw new Error(`No se pudo establecer el valor del campo ${selector}`);
  }
}

async function obtenerTextoPuntoActual(page) {
  const candidates = [
    page.locator('text=/Punto de Suministro:/i').first(),
    page.locator('text=/Punto de Suministro/i').first(),
  ];

  for (const candidate of candidates) {
    try {
      const texto = await candidate.textContent({ timeout: 1500 });
      if (texto) return texto;
    } catch {
      // Continuar
    }
  }

  try {
    const bodyText = await page.locator('body').textContent();
    const match = bodyText?.match(/Punto de Suministro:\s*([^\n]+)/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function extraerPuntoSuministro(texto) {
  if (!texto) return null;
  const match = String(texto).match(/(\d{6,})/);
  return match?.[1] || null;
}

async function extraerFilasTabla(page) {
  const rows = page.locator('table tbody tr');
  const cantidad = await rows.count();
  const facturas = [];

  for (let i = 0; i < cantidad; i += 1) {
    const row = rows.nth(i);
    const cells = row.locator('td');
    const cellCount = await cells.count();
    if (cellCount < 6) continue;

    const valores = [];
    for (let c = 0; c < cellCount; c += 1) {
      valores.push((await cells.nth(c).innerText()).trim());
    }

    facturas.push({
      tipoFactura: valores[0] || '',
      nroComprobante: valores[1] || '',
      periodoCuota: valores[2] || '',
      vencimientoTexto: valores[3] || '',
      importeTexto: valores[4] || '',
      estadoTexto: valores[5] || '',
    });
  }

  return facturas;
}

async function hayBloqueoCloudflare(page) {
  const texto = (await page.locator('body').textContent().catch(() => '')) || '';
  const iframeTurnstile = page.locator('iframe[src*="challenges.cloudflare"], iframe[title*="Widget containing a Cloudflare security challenge"], iframe[title*="desafío de seguridad de Cloudflare"]');
  const hiddenResponse = page.locator('input[name="cf-turnstile-response"], input[id$="_response"]');

  let responseValue = '';
  try {
    if (await hiddenResponse.count()) {
      responseValue = ((await hiddenResponse.first().inputValue()) || '').trim();
    }
  } catch {
    responseValue = '';
  }

  if (responseValue) {
    return false;
  }

  if (/verify you are human|cloudflare|turnstile/i.test(texto)) {
    return true;
  }

  try {
    return (await iframeTurnstile.count()) > 0;
  } catch {
    return false;
  }
}

async function detectarBloqueoCloudflare(page) {
  if (await hayBloqueoCloudflare(page)) {
    throw new Error(
      'Aguas Santafesinas activó verificación humana de Cloudflare. El scraper no puede continuar automáticamente hasta resolver ese challenge.',
    );
  }
}

async function asegurarSinCloudflare(page, { manualChallenge = false, manualTimeoutMs = 180000 } = {}) {
  if (!(await hayBloqueoCloudflare(page))) {
    return;
  }

  if (!manualChallenge) {
    await detectarBloqueoCloudflare(page);
    return;
  }

  console.log('[AGUAS] Cloudflare detectado. Esperando resolución manual del challenge...');
  console.log('[AGUAS] Resolvé el checkbox/verificación en la ventana de Chromium para continuar.');

  const deadline = Date.now() + manualTimeoutMs;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    if (!(await hayBloqueoCloudflare(page))) {
      console.log('[AGUAS] Challenge resuelto manualmente. Continuando...');
      return;
    }
  }

  throw new Error('No se resolvió el challenge manual de Cloudflare dentro del tiempo esperado.');
}

/**
 * Scraper para obtener facturas vigentes de Aguas Santafesinas.
 *
 * @param {string} usuario
 * @param {string} password
 * @param {Date} inicioPeriodo
 * @param {Date} finPeriodo
 * @param {Array<string>} puntosFiltrar
 * @param {{ manualChallenge?: boolean, manualTimeoutMs?: number, headless?: boolean }} options
 * @returns {Promise<Array<{punto: string, importe: number, vencimiento: Date, referencia: string}>>}
 */
export async function scrapeAguasFacturas(
  usuario,
  password,
  inicioPeriodo,
  finPeriodo,
  puntosFiltrar = null,
  options = {},
) {
  if (!usuario || !password) {
    throw new Error('Usuario y contraseña son requeridos');
  }

  const manualChallenge = options.manualChallenge === true;
  const manualTimeoutMs = Number.isFinite(options.manualTimeoutMs) ? options.manualTimeoutMs : 180000;
  const headless = manualChallenge ? false : options.headless ?? true;

  const browser = await chromium.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });

  const page = await context.newPage();

  try {
    console.log('[AGUAS] Navegando al login...');
    await page.goto(AGUAS_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await asegurarSinCloudflare(page, { manualChallenge, manualTimeoutMs });

    const emailInput = page.locator('#email, input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('#password, input[type="password"]').first();

    await emailInput.waitFor({ timeout: 20000 });
    await passwordInput.waitFor({ timeout: 20000 });

    console.log('[AGUAS] Completando credenciales...');
    await asegurarValorCampo(page, emailInput, '#email', usuario);
    await page.waitForTimeout(600);
    await asegurarValorCampo(page, passwordInput, '#password', password);
    await page.waitForTimeout(2000);
    console.log('[AGUAS] Credenciales cargadas en formulario. Enviando login...');
    await asegurarSinCloudflare(page, { manualChallenge, manualTimeoutMs });

    const hizoClickLogin = await clickPrimerVisible(page, [
      'button:has-text("Ingresar a mi cuenta")',
      'button:has-text("Ingresar")',
      'button[type="submit"]',
    ]);

    if (!hizoClickLogin) {
      await passwordInput.press('Enter');
    }

    try {
      await page.waitForURL(/oficina-virtual\/oficina/i, { timeout: 30000 });
    } catch (error) {
      await asegurarSinCloudflare(page, { manualChallenge, manualTimeoutMs });
      await page.waitForURL(/oficina-virtual\/oficina/i, { timeout: 30000 });
    }
    await page.waitForTimeout(1500);

    console.log('[AGUAS] Navegando a Mis Facturas...');
    await page.goto(AGUAS_FACTURAS_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await asegurarSinCloudflare(page, { manualChallenge, manualTimeoutMs });
    await page.waitForTimeout(1500);

    await clickPrimerVisible(page, [
      'button:has-text("Pendientes de Pago")',
      'button:has-text("Pendientes")',
    ]);

    await Promise.race([
      page.waitForSelector('table tbody tr', { timeout: 20000 }),
      page.waitForSelector('text=/facturas pendientes/i', { timeout: 20000 }),
    ]);
    await page.waitForTimeout(1000);

    const textoPuntoActual = await obtenerTextoPuntoActual(page);
    const puntoActual = extraerPuntoSuministro(textoPuntoActual);

    if (puntosFiltrar?.length && puntoActual && !puntosFiltrar.includes(puntoActual)) {
      console.log(`[AGUAS] El punto visible ${puntoActual} no está entre los solicitados. No se procesan facturas.`);
      return [];
    }

    const filas = await extraerFilasTabla(page);
    console.log(`[AGUAS] Filas pendientes encontradas: ${filas.length}`);

    const facturas = filas
      .filter((fila) => /pendiente/i.test(fila.estadoTexto || ''))
      .map((fila) => {
        const vencimiento = parseFechaArgentina(fila.vencimientoTexto);
        return {
          punto: puntoActual || '',
          importe: parseImporte(fila.importeTexto),
          vencimiento,
          referencia: [fila.nroComprobante, fila.periodoCuota].filter(Boolean).join(' | '),
          periodoCuota: fila.periodoCuota,
        };
      })
      .filter((factura) => dentroDePeriodo(factura.vencimiento, inicioPeriodo, finPeriodo));

    console.log(`[AGUAS] Facturas válidas dentro del período: ${facturas.length}`);
    return facturas;
  } catch (error) {
    try {
      await page.screenshot({ path: 'aguas-error.png', fullPage: true });
      console.log('[AGUAS] Screenshot guardado en aguas-error.png');
    } catch {
      // No bloquear por screenshot
    }
    if (esErrorCloudflare(error?.message)) {
      console.error('[AGUAS] Bloqueo de Cloudflare detectado.');
    }
    console.error('[AGUAS] Error en scraping:', error);
    throw error;
  } finally {
    await browser.close();
  }
}
