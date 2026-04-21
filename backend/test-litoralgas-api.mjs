import { chromium } from 'playwright';

async function testLitoralgas() {
    console.log('Lanzando Chromium para atrapar la red de LitoralGas...');
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('response', async (res) => {
        const url = res.url();
        const type = res.headers()['content-type'] || '';
        if (url.includes('api') || type.includes('json') || type.includes('xml')) {
            try {
                const bodyText = await res.text();
                if (bodyText.length > 20 && (bodyText.includes('{') || bodyText.includes('['))) {
                    if (!url.includes('.css') && !url.includes('.js')) {
                        console.log(`\n--- [DISCOVERED DATA ENDPOINT] ---`);
                        console.log(`URL: ${url}`);
                        console.log(`Type: ${type}`);
                        console.log(`Data snippet:`, bodyText.substring(0, 300));
                    }
                }
            } catch (e) { }
        }
    });

    try {
        console.log('Navegando a LitoralGas Login...');
        await page.goto('https://www.litoralgas.com.ar/ov/login', { waitUntil: 'domcontentloaded' });

        console.log('Esperando a que el DOM cargue (10s)...');
        await page.waitForTimeout(10000);

        const userField = await page.$('input[type="email"], input[type="text"]');
        if (userField) await userField.fill('gaspihernandez@gmail.com');

        const passField = await page.$('input[type="password"]');
        if (passField) await passField.fill('CA21484946RP');

        if (userField && passField) {
            console.log('Credenciales ingresadas. Ejecutando Enter...');
            await page.keyboard.press('Enter');

            console.log('Esperando APIs post-login... (15s)');
            await page.waitForTimeout(15000);

            console.log('Intentando clickear en cualquier cosa de "Facturas" o "Suministros"');
            const posiblesLinks = await page.$$('a, button, div, span');
            for (const link of posiblesLinks) {
                const text = await link.textContent();
                if (text && (text.toLowerCase().includes('factura') || text.toLowerCase().includes('suministro') || text.toLowerCase().includes('deuda'))) {
                    try {
                        await link.click();
                        await page.waitForTimeout(3000); // Darle tiempo a la API que dispare
                    } catch (e) { }
                }
            }

            console.log('Esperando respuestas tardías...');
            await page.waitForTimeout(15000);
        } else {
            console.log('No se encotnraron los campos de Login.');
        }

    } catch (e) {
        console.error('Error durante la prueba:', e);
    } finally {
        await browser.close();
    }
}

testLitoralgas();
