import { chromium } from 'playwright';
import fs from 'fs';

async function testEPELogin() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto('https://www.epe.santafe.gov.ar/oficina-virtual/login', { waitUntil: 'networkidle' });
        await page.waitForTimeout(6000);

        const html = await page.content();
        fs.writeFileSync('epe-login.html', html);
        console.log('HTML saved to epe-login.html');
    } catch (e) { console.error(e); }
    await browser.close();
}

testEPELogin();
