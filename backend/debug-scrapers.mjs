import { chromium } from 'playwright';

async function testEPELogin() {
    console.log('--- TEST EPE LOGIN ---');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('response', async (res) => {
        const url = res.url();
        if (url.includes('api')) {
            if (!url.includes('google') && !url.includes('fonts')) {
                console.log(`[EPE API] ${res.request().method()} ${url}`);
            }
        }
    });

    const usuario = 'gaspihernandez@gmail.com';
    const password = 'CA21484946RP';

    try {
        await page.goto('https://www.epe.santafe.gov.ar/oficina-virtual/login', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(4000); // Darle tiempo a Angular a renderizar

        const inputs = await page.$$('input');
        console.log(`Encontrados ${inputs.length} inputs.`);
        for (const input of inputs) {
            try {
                const type = await input.getAttribute('type');
                const isVisible = await input.isVisible();
                if (!isVisible) continue;

                if (type === 'email' || type === 'text') {
                    const id = (await input.getAttribute('id') || '').toLowerCase();
                    const name = (await input.getAttribute('name') || '').toLowerCase();
                    if (!id.includes('search') && !name.includes('search')) {
                        console.log('Filling username...');
                        await input.fill(usuario);
                    }
                }
                if (type === 'password') {
                    console.log('Filling password...');
                    await input.fill(password);
                }
            } catch (e) { continue; }
        }

        let idUsuario = null;
        const captureIdFromUrl = page.waitForResponse(
            (resp) => /\/api\/ov\/v3\/(suministros|user\/validar-datos)\/(\d+)/.test(resp.url()) && resp.status() === 200,
            { timeout: 15000 }
        ).then(res => {
            const match = res.url().match(/\/api\/ov\/v3\/(suministros|user\/validar-datos)\/(\d+)/);
            return match ? match[2] : null;
        }).catch(() => null);

        console.log('[EPE] Enviando formulario (Enter)...');
        await page.keyboard.press('Enter');

        // Por seguridad, intentar clickear botón de login si Enter no bastó
        setTimeout(async () => {
            const loginBtn = await page.$('button[type="submit"], ion-button');
            if (loginBtn) {
                console.log('Clicking login button...');
                await loginBtn.click().catch(() => null);
            }
        }, 1500);

        idUsuario = await captureIdFromUrl;
        console.log('ID EXTRAIDO URL:', idUsuario);

        if (!idUsuario) {
            await page.waitForTimeout(4000);
            idUsuario = await page.evaluate(() => {
                const m = document.cookie.match(/idOvcUsuario=([^;]+)/);
                return window.sessionStorage?.getItem('idOvcUsuario')
                    || window.localStorage?.getItem('idOvcUsuario')
                    || (m ? m[1] : null) || null;
            });
            console.log('ID EXTRAIDO STORAGE:', idUsuario);
        }

        if (!idUsuario) {
            await page.screenshot({ path: 'epe-login-fail.png', fullPage: true });
            console.log('Failed to login. Screenshot saved.');
        } else {
            console.log('Success! ID:', idUsuario);
        }
    } catch (e) { console.error(e); }
    await browser.close();
}

testEPELogin();
