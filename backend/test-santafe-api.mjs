import { chromium } from 'playwright';

async function testSantaFe() {
    console.log('Lanzando Chromium para atrapar la red de API Santa Fe...');
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('response', async (res) => {
        const url = res.url();
        const type = res.headers()['content-type'] || '';
        if (url.includes('api') || type.includes('json') || type.includes('xml') || url.includes('.php') || url.includes('.do')) {
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
        console.log('Navegando a API Santa Fe (e-in-boletas)...');
        await page.goto('https://www.santafe.gov.ar/e-in-boletas/', { waitUntil: 'domcontentloaded' });

        console.log('Ventana abierta. POR FAVOR INGRESE EL RECAPTCHA Y EL NUMERO DE PARTIDA MANUALMENTE SI NO FUNCIONA.');

        // Auto-fill attempts:
        setTimeout(async () => {
            try {
                // Usually API Santa fe has inputs like "partida"
                const inputsText = await page.$$('input[type="text"], input[name*="partida"], input[id*="partida"]');
                if (inputsText.length > 0) {
                    await inputsText[0].fill('14030018875400133');
                }
            } catch (e) { }
        }, 5000);

        // Damos tiempo a ver las redes una vez que se haga submit y pase el captcha
        await page.waitForTimeout(45000);
        console.log('Prueba finalizada despues de 45s.');

    } catch (e) {
        console.error('Error durante la prueba:', e);
    } finally {
        await browser.close();
    }
}

testSantaFe();
