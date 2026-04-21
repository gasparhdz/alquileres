import { chromium } from 'playwright';

async function testEpe() {
    console.log('Lanzando Chromium...');
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Interceptar TODAS las respuestas de red
    page.on('response', async (res) => {
        const url = res.url();
        if (url.includes('api') && res.headers()['content-type']?.includes('json')) {
            try {
                const body = await res.json();
                console.log(`\n--- [JSON ENDPOINT] ---`);
                console.log(`URL: ${url}`);
                console.log(`Data:`, JSON.stringify(body).substring(0, 300));
            } catch (e) { }
        }
    });

    try {
        console.log('Navegando al login...');
        await page.goto('https://www.epe.santafe.gov.ar/oficina-virtual/login#openModal');

        console.log('Esperando estabilización de red (networkidle)...');
        await page.waitForLoadState('networkidle', { timeout: 30000 });

        // Buscar cualquier input de email o texto
        console.log('Buscando inputs de sesión...');
        const inputs = await page.$$('input');
        let emailInput = null;
        let passInput = null;

        for (const input of inputs) {
            const type = await input.getAttribute('type');
            if (type === 'email' || type === 'text') emailInput = input;
            if (type === 'password') passInput = input;
        }

        if (emailInput && passInput) {
            console.log('Enviando credenciales...');
            await emailInput.fill('gaspihernandez@gmail.com');
            await passInput.fill('CA21484946RP');

            await page.keyboard.press('Enter');
            console.log('Login enter presionado. Esperando 15s para capturar peticiones de inicio...');
            await page.waitForTimeout(15000);

            console.log('Intentando navegar a facturacion por URL directa (Reimpresión)...');
            await page.goto('https://www.epe.santafe.gov.ar/oficina-virtual/reimpresion-facturas');
            await page.waitForLoadState('networkidle', { timeout: 20000 });

            console.log('Esperando 10 segundos más post-navegación directa...');
            await page.waitForTimeout(10000);
        } else {
            console.log('No se encontraron inputs de login convencionales. Tomando screenshot.');
            await page.screenshot({ path: 'epe-error.png' });
        }

    } catch (e) {
        console.error('Error durante la prueba:', e);
    } finally {
        await browser.close();
    }
}

testEpe();
