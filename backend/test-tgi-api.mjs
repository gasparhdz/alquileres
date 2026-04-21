import { chromium } from 'playwright';

async function testTGI() {
    console.log('Lanzando Chromium para atrapar la red de TGI (SIAT)...');
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('response', async (res) => {
        const url = res.url();
        const type = res.headers()['content-type'] || '';
        if (url.includes('api') || type.includes('json') || type.includes('xml') || url.includes('.do')) {
            try {
                const bodyText = await res.text();
                if (bodyText.length > 20 && (bodyText.includes('{') || bodyText.includes('[') || bodyText.includes('xml') || type.includes('text/html'))) {
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
        console.log('Navegando a TGI Login...');
        await page.goto('https://siat.rosario.gob.ar/siat/seg/Login.do?method=anonimo&url=/gde/AdministrarLiqDeuda.do?method=inicializarContr&id=14', { waitUntil: 'domcontentloaded' });

        console.log('Ventana abierta. POR FAVOR, si no se autocompleta, INGRESE LAS CREDENCIALES MANUALMENTE EN LA VENTANA DESPLEGADA.');

        // Auto-fill attempts:
        setTimeout(async () => {
            try {
                const inputsText = await page.$$('input[type="text"], input[name*="cuenta"], input[name*="gestion"]');
                for (const input of inputsText) {
                    const name = await input.getAttribute('name') || '';
                    if (name.toLowerCase().includes('cuenta')) await input.fill('12119992');
                    if (name.toLowerCase().includes('gestion') || name.toLowerCase().includes('cod')) await input.fill('71074557');
                }
                const inputsPass = await page.$$('input[type="password"]');
                if (inputsPass.length > 0) await inputsPass[0].fill('71074557');
            } catch (e) { }
        }, 5000);

        // Give 45 seconds to observe the network
        await page.waitForTimeout(45000);
        console.log('Prueba finalizada despues de 45s.');

    } catch (e) {
        console.error('Error durante la prueba:', e);
    } finally {
        await browser.close();
    }
}

testTGI();
