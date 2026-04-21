import { chromium } from 'playwright';

async function testAssa() {
    console.log('Lanzando Chromium para atrapar la red de ASSA...');
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Interceptar respuestas tipo GET/POST que puedan ser JSON o XMLData
    page.on('response', async (res) => {
        const url = res.url();
        const type = res.headers()['content-type'] || '';
        if (url.includes('api') || type.includes('json') || type.includes('xml') || type.includes('text') || url.includes('.aspx')) {
            try {
                const bodyText = await res.text();
                if (bodyText.length > 20 && (bodyText.includes('{') || bodyText.includes('[') || bodyText.includes('xml'))) {
                    // Filter some noise
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
        console.log('Navegando a ASSA Login...');
        await page.goto('https://www.aguassantafesinas.com.ar/gestiones/login.aspx');

        // Fill credentials
        // The previous scraper had:
        // await page.fill('input[type="text"], input[name*="usuario"], input[id*="usuario"]', usuario);
        // await page.fill('input[type="password"]', password);
        console.log('Ingresando credenciales...');
        await page.waitForTimeout(3000);

        // We try generic selectors
        let userField = await page.$('input[type="text"]');
        if (!userField) userField = await page.$('input[type="email"]');
        if (userField) await userField.fill('gaspihernandez@gmail.com');

        let passField = await page.$('input[type="password"]');
        if (passField) await passField.fill('CA21484946RP');

        if (userField && passField) {
            console.log('Credenciales ingresadas. Presionando Enter...');
            await page.keyboard.press('Enter');

            console.log('Esperando estabilización post-login (15s)...');
            await page.waitForTimeout(15000);

            // Try to click on some points
            const buttons = await page.$$('button, a, select');
            console.log(`Intentando interactuar con la página (encontrados ${buttons.length} elementos)...`);

            console.log('Prueba finalizada. Dejando 20 segundos para ver respuestas lentas.');
            await page.waitForTimeout(20000);

        } else {
            console.log('No se encontraron campos de login. Prueba interrumpida.');
        }

    } catch (e) {
        console.error('Error durante la prueba:', e);
    } finally {
        await browser.close();
    }
}

testAssa();
