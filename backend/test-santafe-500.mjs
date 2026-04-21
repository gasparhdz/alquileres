import { autocompletarSantafeEInBoletas } from './src/controllers/santafe.controller.js';

const req = {
    body: { periodo: '03-2026' },
    user: { id: 1 }
};

const res = {
    status: (code) => {
        console.log('[RES STATUS]', code);
        return res;
    },
    json: (data) => {
        console.log('[RES JSON]', data);
    }
};

async function main() {
    try {
        await autocompletarSantafeEInBoletas(req, res);
    } catch (e) {
        console.error('[UNHANDLED]', e);
    }
}

main();
