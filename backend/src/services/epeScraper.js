import { chromium } from 'playwright';

/**
 * Normaliza un número de cliente para matching (quita ceros a la izquierda y espacios)
 * @param {string} nroCliente - Número de cliente a normalizar
 * @returns {string} - Número normalizado
 */
function normalizarNroCliente(nroCliente) {
  if (!nroCliente) return '';
  return nroCliente.toString().trim().replace(/^0+/, '');
}

/**
 * Parsea una fecha que puede venir como string (dd/MM/yyyy o ISO) o número
 * @param {string|Date|number} value - FVTO1 u otro campo de fecha
 * @returns {Date|null}
 */
function parsearFechaEpe(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return new Date(value);
  const s = String(value).trim();
  // Formato dd/MM/yyyy
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, dia, mes, anio] = match;
    const d = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Parsea importe en formato argentino ej. "$ 68.906,45" o "68.906,45" */
function parsearImporteEpe(str) {
  if (str == null || str === '') return 0;
  const s = String(str).trim().replace(/\s/g, '').replace(/^\$/, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Scraper para obtener facturas/cuotas de EPE vía API interna (tras login con Playwright).
 * Usa Playwright solo para iniciar sesión y obtener el token de sesión; luego consulta
 * la API JSON interna por cada número de cliente.
 *
 * @param {string} usuario - Usuario/email de la oficina virtual
 * @param {string} password - Contraseña de la oficina virtual
 * @param {Date} inicioPeriodo - Fecha de inicio del período (día 1 del mes, 00:00)
 * @param {Date} finPeriodo - Fecha de fin del período (día 1 del mes siguiente, 00:00, excluyente)
 * @param {Array<string>} nroClientesFiltrar - Array de números de cliente normalizados a procesar (opcional)
 * @returns {Promise<Array<{nroCliente: string, cuotaNro: number, vencimiento: Date, importe: number, refExterna: string}>>}
 */
export async function scrapeEpeFacturas(usuario, password, inicioPeriodo, finPeriodo, nroClientesFiltrar = null) {
  if (!usuario || !password) {
    throw new Error('Usuario y contraseña son requeridos');
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  const page = await context.newPage();
  let loginFallbackTimeoutId = null;

  try {
    // ——— Paso 1: Ir a login ———
    console.log('[EPE] Navegando a página de login...');
    await page.goto('https://www.epe.santafe.gov.ar/oficina-virtual/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(2000);

    // ——— Paso 2: Completar usuario y contraseña de forma universal ———
    console.log('[EPE] Completando credenciales...');
    await page.waitForTimeout(4000); // Darle tiempo a Angular a renderizar

    const inputs = await page.$$('input');
    for (const input of inputs) {
      try {
        const type = await input.getAttribute('type');
        const isVisible = await input.isVisible();
        if (!isVisible) continue;

        if (type === 'email' || type === 'text') {
          const id = (await input.getAttribute('id') || '').toLowerCase();
          const name = (await input.getAttribute('name') || '').toLowerCase();
          if (!id.includes('search') && !name.includes('search')) {
            await input.fill(usuario);
          }
        }
        if (type === 'password') {
          await input.fill(password);
        }
      } catch (e) {
        continue;
      }
    }

    // ——— Paso 3: Esperar login y capturar ID de usuario ———
    let idUsuario = null;
    const captureIdFromUrl = page.waitForResponse(
      (resp) => /\/api\/ov\/v3\/(suministros|user\/validar-datos)\/(\d+)/.test(resp.url()) && resp.status() === 200,
      { timeout: 20000 }
    ).then((res) => {
      const match = res.url().match(/\/api\/ov\/v3\/(suministros|user\/validar-datos)\/(\d+)/);
      return match ? match[2] : null;
    }).catch(() => null);

    console.log('[EPE] Enviando formulario (Enter)...');
    await page.keyboard.press('Enter');

    // Por seguridad, intentar clickear botón de login si Enter no bastó (timeout cancelable para no usar page tras cerrar browser)
    loginFallbackTimeoutId = null;

    idUsuario = await captureIdFromUrl;

    if (loginFallbackTimeoutId) {
      clearTimeout(loginFallbackTimeoutId);
      loginFallbackTimeoutId = null;
    }

    if (!idUsuario) {
      await page.waitForTimeout(4000);
      idUsuario = await page.evaluate(() => {
        const m = document.cookie.match(/idOvcUsuario=([^;]+)/);
        return window.sessionStorage?.getItem('idOvcUsuario') ||
          window.localStorage?.getItem('idOvcUsuario') ||
          (m ? m[1] : null) || null;
      });
    }

    if (!idUsuario) throw new Error('No se pudo verificar el inicio de sesión ni obtener id de usuario. Verifique las credenciales.');

    console.log('[EPE] Login exitoso. Id usuario:', idUsuario);

    const clientesAConsultar = nroClientesFiltrar && nroClientesFiltrar.length > 0
      ? nroClientesFiltrar.map(n => String(n).trim()).filter(Boolean)
      : [];
    if (clientesAConsultar.length === 0) {
      console.log('[EPE] No hay números de cliente para consultar.');
      await browser.close();
      return [];
    }

    const nroCliente = clientesAConsultar[0];
    console.log('[EPE] Navegando a Reimpresión de facturas para suministro:', nroCliente);

    await page.waitForTimeout(2000);

    // ——— Paso 4: Navegación directa (PWA Angular/Ionic) ———
    const urlReimpresion = 'https://www.epe.santafe.gov.ar/oficina-virtual/oficina/autogestion/reimpresion-de-facturas';
    console.log('[EPE] Navegando a reimpresión de facturas (URL directa)...');
    const navOk = await page.goto(urlReimpresion, { waitUntil: 'domcontentloaded', timeout: 20000 }).then(() => true).catch(() => false);
    if (!navOk) {
      console.log('[EPE] Falló goto directo, intentando click en card .card-reimpresion-facturas...');
      await page.goto('https://www.epe.santafe.gov.ar/oficina-virtual/oficina/autogestion', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(3000);
      await page.click('.card-reimpresion-facturas').catch(() => {});
      await page.waitForTimeout(4000);
    } else {
      await page.waitForTimeout(3000);
    }

    const inicioTs = inicioPeriodo.getTime();
    const finTs = finPeriodo.getTime();
    const cuotas = [];

    // ——— Paso 5: Extracción con selectores Ionic (ion-card) ———
    const filas = await page.evaluate(() => {
      const out = [];
      const cards = document.querySelectorAll('ion-card.ion-color-epe');
      for (const card of cards) {
        const sel = (selector) => {
          const el = card.querySelector(selector);
          return el ? (el.textContent || '').trim() : '';
        };
        const detalle1 = card.querySelector('.detalle-cuota:nth-child(1)');
        const detalle2 = card.querySelector('.detalle-cuota:nth-child(2)');
        out.push({
          factura: sel('.factura .itemData.destacado'),
          periodo: sel('.periodo .itemData.destacado'),
          vto1: detalle1 ? (detalle1.querySelector('.fecha-vto .itemData')?.textContent || '').trim() : '',
          importe1: detalle1 ? (detalle1.querySelector('.importe-vto .itemData')?.textContent || '').trim() : '',
          vto2: detalle2 ? (detalle2.querySelector('.fecha-vto .itemData')?.textContent || '').trim() : '',
          importe2: detalle2 ? (detalle2.querySelector('.importe-vto .itemData')?.textContent || '').trim() : ''
        });
      }
      return out;
    }).catch(() => []);

    if (Array.isArray(filas) && filas.length > 0) {
      for (const row of filas) {
        const factura = row.factura || '';
        const periodo = row.periodo || '';
        const vto1 = row.vto1 || '';
        const vto2 = row.vto2 || '';
        const importe1 = row.importe1 || '';
        const importe2 = row.importe2 || '';
        const refBase = factura ? `Factura ${factura}` : (periodo ? `Período ${periodo}` : 'Cuota');
        if (vto1 && importe1) {
          const v = parsearFechaEpe(vto1);
          if (v && v.getTime() >= inicioTs && v.getTime() < finTs) {
            cuotas.push({
              nroCliente,
              cuotaNro: 1,
              vencimiento: v,
              importe: parsearImporteEpe(importe1),
              refExterna: `${refBase} - Cuota 1`
            });
          }
        }
        if (vto2 && importe2) {
          const v = parsearFechaEpe(vto2);
          if (v && v.getTime() >= inicioTs && v.getTime() < finTs) {
            cuotas.push({
              nroCliente,
              cuotaNro: 2,
              vencimiento: v,
              importe: parsearImporteEpe(importe2),
              refExterna: `${refBase} - Cuota 2`
            });
          }
        }
      }
      console.log(`[EPE] Reimpresión de facturas (Ionic): ${filas.length} tarjetas, ${cuotas.length} cuotas en el período.`);
    } else {
      console.log('[EPE] No se encontraron ion-card.ion-color-epe en la página.');
    }

    await browser.close();
    console.log(`[EPE] Scraping completado. ${cuotas.length} cuotas encontradas.`);
    return cuotas;
  } catch (error) {
    if (loginFallbackTimeoutId) clearTimeout(loginFallbackTimeoutId);
    await browser.close();
    console.error('[EPE] Error en scraping:', error);
    throw error;
  }
}
