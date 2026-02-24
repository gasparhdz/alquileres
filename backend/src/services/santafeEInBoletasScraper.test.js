import assert from 'node:assert';
import { parseImporte, parseFechaVto, parseCuotasFromResultHtml } from './santafeEInBoletasScraper.js';

// --- parseImporte
assert.strictEqual(parseImporte('4.400,00'), 4400);
assert.strictEqual(parseImporte('$ 4.400,00'), 4400);
assert.strictEqual(parseImporte('123'), 123);
assert.strictEqual(parseImporte('1.234,56'), 1234.56);
assert.strictEqual(parseImporte(''), null);
assert.strictEqual(parseImporte(null), null);

// --- parseFechaVto
assert.strictEqual(parseFechaVto('24/02/2026'), '2026-02-24');
assert.strictEqual(parseFechaVto('1/1/2026'), '2026-01-01');
assert.strictEqual(parseFechaVto(' 24/02/2026 '), '2026-02-24');
assert.strictEqual(parseFechaVto('invalid'), null);
assert.strictEqual(parseFechaVto(''), null);
assert.strictEqual(parseFechaVto(null), null);

// --- parseCuotasFromResultHtml
const sampleHtml = `
<div>
  <table>
    <thead><tr><th colspan="4">Cuotas seleccionadas a descargar</th></tr></thead>
    <tbody>
      <tr><td>2026/1</td><td>24/02/2026</td><td>4.400,00</td><td></td></tr>
      <tr><td>2026/2</td><td>24/04/2026</td><td>4.400,00</td><td></td></tr>
      <tr><td>2026/3</td><td>24/06/2026</td><td>4.400,00</td><td></td></tr>
    </tbody>
  </table>
</div>
`;
const parsed = parseCuotasFromResultHtml(sampleHtml);
assert.ok(Array.isArray(parsed.cuotas));
assert.strictEqual(parsed.cuotas.length, 3);
assert.deepStrictEqual(parsed.cuotas[0], { periodo: '2026/1', fechaVto: '2026-02-24', importe: 4400 });
assert.deepStrictEqual(parsed.cuotas[1], { periodo: '2026/2', fechaVto: '2026-04-24', importe: 4400 });
assert.deepStrictEqual(parsed.cuotas[2], { periodo: '2026/3', fechaVto: '2026-06-24', importe: 4400 });

const empty = parseCuotasFromResultHtml('<html><body>sin tabla</body></html>');
assert.strictEqual(empty.cuotas.length, 0);
assert.ok(empty.error);

console.log('Todos los tests del parser Santa Fe e-in-boletas pasaron.');
// run: node src/services/santafeEInBoletasScraper.test.js
