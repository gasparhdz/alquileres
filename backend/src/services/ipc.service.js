import prisma from '../db/prisma.js';

// Serie mensual del IPC nivel general nacional (base dic-2016=100)
// Fuente: API Series de Tiempo (dataseries: https://apis.datos.gob.ar/series/api/datasets/?id=148.3_INIVELNAL_DICI_M_26)
const IPC_SERIES_ID = '148.3_INIVELNAL_DICI_M_26';
const IPC_CODIGO = 'ipc';
const IPC_FUENTE = 'API Series de Tiempo (datos.gob.ar)';

const formatDateToPeriod = (dateString) => {
  if (!dateString) return null;
  return dateString.slice(0, 7); // YYYY-MM
};

const getNextPeriod = (periodo) => {
  if (!periodo) return null;
  const [yearStr, monthStr] = periodo.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (Number.isNaN(year) || Number.isNaN(month)) return null;

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return `${nextYear.toString().padStart(4, '0')}-${nextMonth.toString().padStart(2, '0')}`;
};

const calculateVariacion = (valorActual, valorAnterior) => {
  if (valorAnterior === null || valorAnterior === undefined || Number(valorAnterior) === 0) {
    return null;
  }

  const actual = Number(valorActual);
  const anterior = Number(valorAnterior);

  if (Number.isNaN(actual) || Number.isNaN(anterior)) {
    return null;
  }

  const variacion = ((actual / anterior) - 1) * 100;
  return Number.isFinite(variacion) ? variacion : null;
};

export async function syncIPCSeries(userId = null) {
  const latest = await prisma.indiceAjuste.findFirst({
    where: { codigo: IPC_CODIGO },
    orderBy: { periodo: 'desc' }
  });

  const url = new URL('https://apis.datos.gob.ar/series/api/series/');
  url.searchParams.set('ids', IPC_SERIES_ID);
  url.searchParams.set('format', 'json');
  url.searchParams.set('metadata', 'none');

  if (latest?.periodo) {
    url.searchParams.set('start_date', `${latest.periodo}-01`);
    url.searchParams.set('limit', '24');
  } else {
    url.searchParams.set('limit', '120');
  }

  const requestUrl = url.toString();

  console.log(`[IPC] Consultando serie en ${requestUrl}`);

  const response = await fetch(requestUrl, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Error al consultar API de IPC: ${response.status} ${response.statusText} ${errorText}`
    );
  }

  const json = await response.json();
  const data = json?.data || [];

  if (!Array.isArray(data) || data.length === 0) {
    return {
      message: 'No hay datos nuevos de IPC para sincronizar',
      inserted: 0
    };
  }

  const registrosOrdenados = data
    .map((entry) => {
      const [fecha, valor] = entry;
      if (!fecha || valor === null || valor === undefined) return null;
      return {
        periodo: formatDateToPeriod(fecha),
        fecha,
        valor: Number(valor)
      };
    })
    .filter((entry) => entry && entry.periodo);

  if (registrosOrdenados.length === 0) {
    return {
      message: 'No se encontraron registros válidos en la respuesta del IPC',
      inserted: 0
    };
  }

  registrosOrdenados.sort((a, b) => (a.periodo < b.periodo ? -1 : a.periodo > b.periodo ? 1 : 0));

  let previousValor = latest ? Number(latest.valor) : null;
  let inserted = 0;

  for (const registro of registrosOrdenados) {
    if (latest && registro.periodo <= latest.periodo) {
      previousValor = Number(latest.valor);
      continue;
    }

    const variacion = calculateVariacion(registro.valor, previousValor);

    await prisma.indiceAjuste.create({
      data: {
        codigo: IPC_CODIGO,
        descripcion: '',
        periodo: registro.periodo,
        valor: registro.valor.toString(),
        variacion: variacion !== null ? variacion.toFixed(4) : null,
        fuente: IPC_FUENTE,
        fechaPublicacion: new Date(registro.fecha),
        activo: true,
        createdBy: userId,
        updatedBy: userId
      }
    });

    previousValor = registro.valor;
    inserted += 1;
  }

  return {
    message:
      inserted > 0
        ? `Sincronización completada. Se agregaron ${inserted} registros de IPC.`
        : 'Sincronización completada. No había datos nuevos para agregar.',
    inserted
  };
}

