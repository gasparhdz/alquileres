import prisma from './src/db/prisma.js';
import { scrapeAguasFacturas } from './src/services/aguasScraper.js';

function parsePeriodo(periodo) {
  if (!/^\d{2}-\d{4}$/.test(periodo)) {
    throw new Error('El período debe tener formato MM-YYYY. Ejemplo: 06-2026');
  }

  const [mes, anio] = periodo.split('-').map(Number);
  return {
    inicioPeriodo: new Date(anio, mes - 1, 1, 0, 0, 0, 0),
    finPeriodo: new Date(anio, mes, 1, 0, 0, 0, 0),
  };
}

async function obtenerCredencialesAgua() {
  const tipoImpuestoAgua = await prisma.tipoImpuestoPropiedad.findFirst({
    where: {
      codigo: 'AGUA',
      activo: true,
      deletedAt: null,
    },
    select: {
      usuario: true,
      password: true,
    },
  });

  if (!tipoImpuestoAgua?.usuario || !tipoImpuestoAgua?.password) {
    throw new Error('No hay credenciales configuradas para AGUA en tipos_impuesto_propiedad');
  }

  return tipoImpuestoAgua;
}

async function obtenerPuntosSistema() {
  const impuestos = await prisma.propiedadImpuesto.findMany({
    where: {
      tipoImpuesto: { codigo: 'AGUA' },
      activo: true,
      deletedAt: null,
      campos: {
        some: {
          tipoCampo: { codigo: 'P_SUM' },
          deletedAt: null,
        },
      },
    },
    select: {
      id: true,
      campos: {
        where: {
          tipoCampo: { codigo: 'P_SUM' },
          deletedAt: null,
        },
        select: {
          valor: true,
        },
      },
    },
  });

  return [...new Set(
    impuestos
      .map((impuesto) => impuesto.campos?.[0]?.valor?.trim())
      .filter(Boolean),
  )];
}

async function main() {
  const args = process.argv.slice(2);
  const manualChallenge = args.includes('--manual');
  const manualTimeoutArg = args.find((arg) => arg.startsWith('--timeout='));
  const manualTimeoutMs = manualTimeoutArg ? Number(manualTimeoutArg.split('=')[1]) : 180000;
  const positional = args.filter((arg) => !arg.startsWith('--'));

  const periodo = positional[0] || '06-2026';
  const puntoManual = positional[1] || null;

  const { inicioPeriodo, finPeriodo } = parsePeriodo(periodo);
  const { usuario, password } = await obtenerCredencialesAgua();

  const puntosFiltrar = puntoManual ? [puntoManual] : await obtenerPuntosSistema();

  console.log('\n=== TEST SCRAPER AGUAS ===');
  console.log(`Período: ${periodo}`);
  console.log(`Inicio:  ${inicioPeriodo.toISOString()}`);
  console.log(`Fin:     ${finPeriodo.toISOString()}`);
  console.log(`Usuario: ${usuario}`);
  console.log(`Puntos a filtrar: ${puntosFiltrar.length ? puntosFiltrar.join(', ') : '(sin filtro)'}`);
  console.log(`Modo manual Cloudflare: ${manualChallenge ? 'SI' : 'NO'}`);
  console.log('');

  const facturas = await scrapeAguasFacturas(
    usuario,
    password,
    inicioPeriodo,
    finPeriodo,
    puntosFiltrar.length ? puntosFiltrar : null,
    { manualChallenge, manualTimeoutMs },
  );

  console.log('\n=== RESULTADO ===');
  console.log(`Facturas encontradas: ${facturas.length}`);

  if (facturas.length === 0) {
    console.log('No se recuperaron facturas para ese período/filtro.');
    return;
  }

  for (const factura of facturas) {
    console.log('------------------------------');
    console.log(`Punto:       ${factura.punto || '-'}`);
    console.log(`Importe:     ${factura.importe}`);
    console.log(`Vencimiento: ${factura.vencimiento ? factura.vencimiento.toISOString() : '-'}`);
    console.log(`Referencia:  ${factura.referencia || '-'}`);
  }
}

main()
  .catch((error) => {
    console.error('\n[TEST AGUAS] Error:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
