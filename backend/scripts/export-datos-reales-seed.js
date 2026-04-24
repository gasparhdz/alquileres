import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, '../prisma/seed/datosReales.js');

const tables = [
  { exportName: 'clientes', model: prisma.cliente, orderBy: { id: 'asc' } },
  { exportName: 'clienteRoles', model: prisma.clienteRol, orderBy: [{ clienteId: 'asc' }, { rolId: 'asc' }] },
  { exportName: 'consorcios', model: prisma.consorcio, orderBy: { id: 'asc' } },
  { exportName: 'propiedades', model: prisma.propiedad, orderBy: { id: 'asc' } },
  { exportName: 'propiedadSeguros', model: prisma.propiedadSeguro, orderBy: { id: 'asc' } },
  { exportName: 'propiedadPropietarios', model: prisma.propiedadPropietario, orderBy: [{ propiedadId: 'asc' }, { propietarioId: 'asc' }] },
  { exportName: 'propiedadImpuestos', model: prisma.propiedadImpuesto, orderBy: { id: 'asc' } },
  { exportName: 'propiedadImpuestoCampos', model: prisma.propiedadImpuestoCampo, orderBy: { id: 'asc' } },
  { exportName: 'propiedadCargos', model: prisma.propiedadCargo, orderBy: { id: 'asc' } },
  { exportName: 'propiedadCargoCampos', model: prisma.propiedadCargoCampo, orderBy: { id: 'asc' } },
  { exportName: 'propiedadDocumentos', model: prisma.propiedadDocumento, orderBy: { id: 'asc' } },
  { exportName: 'contratos', model: prisma.contrato, orderBy: { id: 'asc' } },
  { exportName: 'contratoResponsabilidades', model: prisma.contratoResponsabilidad, orderBy: { id: 'asc' } },
  { exportName: 'contratoGarantias', model: prisma.contratoGarantia, orderBy: { id: 'asc' } },
  { exportName: 'contratoGastosIniciales', model: prisma.contratoGastoInicial, orderBy: { id: 'asc' } },
  { exportName: 'contratoAjustes', model: prisma.contratoAjuste, orderBy: { id: 'asc' } },
];

function serializeValue(value) {
  if (value === null) return 'null';
  if (value instanceof Date) return `new Date(${JSON.stringify(value.toISOString())})`;
  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeValue(item)).join(', ')}]`;
  }
  if (typeof value === 'object') {
    if (
      Object.prototype.toString.call(value) === '[object Decimal]' ||
      typeof value?.toFixed === 'function'
    ) {
      return JSON.stringify(value.toString());
    }
    const entries = Object.entries(value).map(([key, item]) => `${key}: ${serializeValue(item)}`);
    return `{ ${entries.join(', ')} }`;
  }
  return JSON.stringify(value);
}

async function main() {
  const exported = {};

  for (const table of tables) {
    const rows = await table.model.findMany({ orderBy: table.orderBy });
    exported[table.exportName] = rows;
    console.log(`- ${table.exportName}: ${rows.length} registros`);
  }

  const sections = tables.map((table) => {
    const rows = exported[table.exportName];
    return `export const ${table.exportName} = ${serializeValue(rows)};\n`;
  });

  const defaultExport = `export default {\n${tables.map((table) => `  ${table.exportName},`).join('\n')}\n};\n`;
  const content = [
    '// Archivo autogenerado desde la base actual.',
    '// Ejecutar `node scripts/export-datos-reales-seed.js` para regenerarlo.',
    '',
    ...sections,
    defaultExport,
  ].join('\n');

  await fs.writeFile(outputPath, content, 'utf8');
  console.log(`\nArchivo generado: ${outputPath}`);
}

main()
  .catch((error) => {
    console.error('Error exportando datos reales a seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
