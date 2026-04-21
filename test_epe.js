import { scrapeEpeFacturas } from './backend/src/services/epeScraper.js';

async function run() {
    try {
        const cuotas = await scrapeEpeFacturas(
            'gaspihernandez@gmail.com',
            'CA21484946RP',
            new Date('2026-03-01T00:00:00.000Z'),
            new Date('2026-04-01T00:00:00.000Z'),
            ['1752960']
        );
        console.log('Result:', cuotas);
    } catch (err) {
        console.error('Error:', err);
    }
}

run();
