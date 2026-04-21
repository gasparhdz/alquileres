import { mockFichaPropiedadPropietario } from './mockData';

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toYMD(fecha) {
  if (!fecha) return null;
  if (typeof fecha === 'string') return fecha.slice(0, 10);
  try {
    return new Date(fecha).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function nombreCliente(c) {
  if (!c) return '';
  if (c.razonSocial?.trim()) return c.razonSocial.trim();
  const ap = [c.apellido, c.nombre].filter(Boolean).join(', ');
  return ap.trim() || '';
}

function nombreTitularImpuesto(pi) {
  if (!pi) return '';
  if (pi.titularOtroNombre || pi.titularOtroApellido) {
    return [pi.titularOtroApellido, pi.titularOtroNombre].filter(Boolean).join(', ').trim();
  }
  const p = pi.titularPropietario;
  return nombreCliente(p) || '';
}

function esDepositoGasto(gi) {
  const cod = `${gi?.tipoGastoInicial?.codigo || ''}`.toUpperCase();
  const nom = `${gi?.tipoGastoInicial?.nombre || ''}`.toLowerCase();
  return cod.includes('DEPOSITO') || cod.includes('DEPÓSITO') || nom.includes('depósito') || nom.includes('deposito');
}

function responsableLabel(quien) {
  if (!quien) return '—';
  return quien.nombre || quien.codigo || '—';
}

function findRespImpuesto(responsabilidades, tipoImpuestoId) {
  return responsabilidades?.find((r) => r.tipoImpuestoId === tipoImpuestoId) || null;
}

function findRespCargo(responsabilidades, tipoCargoId) {
  return responsabilidades?.find((r) => r.tipoCargoId === tipoCargoId && !r.tipoImpuestoId) || null;
}

/** AmbientePropiedad: codigo MONO, DOS, etc. → número aproximado para el texto "N amb." */
function ambientesDesdeCatalogo(amb) {
  if (!amb?.codigo) return null;
  const map = {
    MONO: 1,
    UNO: 1,
    DOS: 2,
    TRES: 3,
    CUATRO: 4,
    CINCO: 5,
    SEIS: 6,
    SIETE: 7,
    OCHO: 8
  };
  return map[amb.codigo] ?? null;
}

function camposToIdentificador(campos) {
  if (!Array.isArray(campos) || campos.length === 0) return '';
  return campos
    .map((c) => {
      const label = c.tipoCampo?.nombre || c.tipoCampo?.codigo || '';
      const v = c.valor ?? '';
      return label ? `${label}: ${v}` : v;
    })
    .filter(Boolean)
    .join(' · ');
}

export function buildDireccionCompleta(p) {
  if (!p) return '';
  const parts = [];
  const calle = [p.dirCalle, p.dirNro].filter(Boolean).join(' ');
  if (calle.trim()) parts.push(calle.trim());
  if (p.dirPiso || p.dirDepto) {
    const u = [p.dirPiso && `Piso ${p.dirPiso}`, p.dirDepto && `Dto. ${p.dirDepto}`].filter(Boolean).join(', ');
    if (u) parts.push(u);
  }
  const loc = p.localidad?.nombre;
  const prov = p.provincia?.nombre || p.localidad?.provincia?.nombre;
  if (loc || prov) parts.push([loc, prov].filter(Boolean).join(', '));
  return parts.filter(Boolean).join(' · ') || '—';
}

/**
 * @param {object} params
 * @param {object} params.propiedad - GET /propiedades/:id
 * @param {object|null} params.contrato - GET /contratos/:id (vigente) o null
 * @param {{ data?: array }}|null} params.liquidacionesResp - GET /liquidaciones?propiedadId=
 * @param {array|null} params.liquidacionesPropietario - GET /contratos/:id/liquidaciones-propietario (opcional)
 */
export function buildFichaPropiedadData({
  propiedad,
  contrato,
  liquidacionesResp,
  liquidacionesPropietario
}) {
  const emitidoEl = new Date().toISOString().slice(0, 10);
  const hayVigente = !!contrato;

  const titulares = (propiedad?.propietarios || [])
    .map((pp) => {
      const c = pp?.propietario;
      if (!c) return null;
      return {
        nombreCompleto: nombreCliente(c),
        cuit: c.cuit || null
      };
    })
    .filter((t) => t?.nombreCompleto);

  let estadoTexto = propiedad?.estadoPropiedad?.nombre || '';
  if (hayVigente && estadoTexto) estadoTexto = `${estadoTexto} — contrato vigente`;
  else if (hayVigente) estadoTexto = 'Contrato vigente';

  const identificacion = {
    direccionCompleta: buildDireccionCompleta(propiedad),
    tipoPropiedad: propiedad?.tipoPropiedad?.nombre || '',
    destino: propiedad?.destino?.nombre || '',
    ambientes: ambientesDesdeCatalogo(propiedad?.ambientes),
    superficieM2: num(propiedad?.superficieM2),
    estadoPropiedad: estadoTexto || null,
    titulares
  };

  const inquilinoNombre = nombreCliente(contrato?.inquilino);
  const montoInicial = num(contrato?.montoInicial);
  const montoActual = num(contrato?.montoActual);

  const depositoGasto = contrato?.gastosIniciales?.find(esDepositoGasto);
  const montoDepOriginal = depositoGasto != null ? num(depositoGasto.importe ?? depositoGasto.valorCalculo) : null;
  const titularFondos = depositoGasto?.quienPaga ? responsableLabel(depositoGasto.quienPaga) : '';

  const garantias = (contrato?.garantias || [])
    .filter((g) => g && g.deletedAt == null)
    .map((g) => ({
      tipo: g.tipoGarantia?.nombre || 'Garantía',
      detalle: [g.apellido, g.nombre].filter(Boolean).join(', ') || g.cuit || g.dni || ''
    }))
    .filter((g) => g.tipo);

  const contratoBlock =
    contrato && (inquilinoNombre || contrato.fechaInicio || montoInicial != null || garantias.length)
      ? {
          inquilinoNombre,
          fechaInicio: toYMD(contrato.fechaInicio),
          fechaFin: toYMD(contrato.fechaFin),
          duracionMeses: contrato.duracionMeses ?? null,
          montoInicial,
          montoActual,
          deposito:
            montoDepOriginal != null || titularFondos
              ? {
                  montoOriginal: montoDepOriginal,
                  montoActualizado: montoDepOriginal,
                  titularFondos: titularFondos || undefined
                }
              : null,
          garantias
        }
      : null;

  const ajustesOrdenados = [...(contrato?.ajustes || [])].sort(
    (a, b) => new Date(b.fechaAjuste) - new Date(a.fechaAjuste)
  );
  const ultimo = ajustesOrdenados[0];
  const indiceNombre = contrato?.metodoAjuste?.nombre || '';
  const frecuenciaMeses = contrato?.frecuenciaAjusteMeses ?? null;

  let proximoAjuste = null;
  if (ultimo?.fechaAjuste && frecuenciaMeses) {
    const d = new Date(ultimo.fechaAjuste);
    d.setMonth(d.getMonth() + Number(frecuenciaMeses));
    proximoAjuste = {
      fechaEstimada: d.toISOString().slice(0, 10),
      montoEstimado: null,
      notaProyeccion: 'fecha estimada según último ajuste y frecuencia pactada'
    };
  }

  const historial = ajustesOrdenados.map((a) => ({
    fecha: toYMD(a.fechaAjuste),
    montoAnterior: num(a.montoAnterior),
    montoNuevo: num(a.montoNuevo),
    porcentaje: num(a.porcentajeAumento),
    indice: indiceNombre || '—'
  }));

  const ajustesBlock =
    indiceNombre || historial.length || ultimo || proximoAjuste
      ? {
          indicePactado: indiceNombre || null,
          frecuenciaMeses,
          ultimoAjuste: ultimo
            ? {
                fecha: toYMD(ultimo.fechaAjuste),
                porcentajeAplicado: num(ultimo.porcentajeAumento)
              }
            : null,
          proximoAjuste,
          historial
        }
      : null;

  const pctHon = num(contrato?.honorariosPropietario);
  const pctGastosAdm = num(contrato?.gastosAdministrativos);
  const honorariosMonto =
    montoActual != null && pctHon != null ? Math.round((montoActual * pctHon) / 100) : null;
  const gastosCargoMonto =
    montoActual != null && pctGastosAdm != null ? Math.round((montoActual * pctGastosAdm) / 100) : null;
  let netoEstimado = null;
  if (montoActual != null) {
    netoEstimado = montoActual;
    if (honorariosMonto != null) netoEstimado -= honorariosMonto;
    if (gastosCargoMonto != null) netoEstimado -= gastosCargoMonto;
  }

  const liqRows = liquidacionesResp?.data || [];
  const netoByPeriod = new Map(
    (liquidacionesPropietario || []).map((lp) => [lp.periodo, num(lp.netoAPagar)])
  );

  const liquidacionesRecientes = liqRows.slice(0, 12).map((liq) => ({
    periodo: liq.periodo,
    totalBoletaInquilino: num(liq.total),
    netoPropietario: netoByPeriod.has(liq.periodo) ? netoByPeriod.get(liq.periodo) : null,
    estado: liq.estado?.nombre || '—'
  }));

  const resumenFinanciero = {
    alquilerBrutoMensual: montoActual,
    honorarios:
      pctHon != null || honorariosMonto != null
        ? { porcentaje: pctHon, monto: honorariosMonto }
        : null,
    gastosCargoPropietario: gastosCargoMonto,
    netoEstimadoMensual: netoEstimado,
    liquidacionesRecientes,
    pendientesCobro: []
  };

  const resumenTieneTabla = liquidacionesRecientes.length > 0;
  const resumenTieneFormula =
    montoActual != null || honorariosMonto != null || gastosCargoMonto != null || netoEstimado != null;
  if (!resumenTieneTabla && !resumenTieneFormula) {
    resumenFinanciero.alquilerBrutoMensual = null;
    resumenFinanciero.honorarios = null;
    resumenFinanciero.gastosCargoPropietario = null;
    resumenFinanciero.netoEstimadoMensual = null;
  }

  const resps = contrato?.responsabilidades || [];
  const servicios = [];

  for (const pi of propiedad?.impuestos || []) {
    const r = findRespImpuesto(resps, pi.tipoImpuestoId);
    servicios.push({
      servicio: pi.tipoImpuesto?.nombre || 'Impuesto',
      titularFigurante: nombreTitularImpuesto(pi),
      identificador: camposToIdentificador(pi.campos),
      responsablePago: r?.quienSoportaCosto ? responsableLabel(r.quienSoportaCosto) : '—'
    });
  }

  for (const pc of propiedad?.cargos || []) {
    const r = findRespCargo(resps, pc.tipoCargoId);
    servicios.push({
      servicio: pc.tipoCargo?.nombre || 'Cargo',
      titularFigurante: '',
      identificador: camposToIdentificador(pc.campos),
      responsablePago: r?.quienSoportaCosto ? responsableLabel(r.quienSoportaCosto) : '—'
    });
  }

  const segurosList = propiedad?.seguros || [];
  const seguroReciente = segurosList[0];
  const cobertura = {
    seguro: seguroReciente
      ? {
          compania: seguroReciente.compania || '',
          numeroPoliza: seguroReciente.nroPoliza || '',
          vencimiento: toYMD(seguroReciente.fechaFin),
          sumaOCobertura: [
            seguroReciente.tipoCobertura,
            seguroReciente.montoAsegurado != null ? `Suma asegurada ${num(seguroReciente.montoAsegurado)}` : ''
          ]
            .filter(Boolean)
            .join(' — ')
        }
      : null,
    documentacionArchivo: (propiedad?.documentos || []).map((doc) => {
      const tipo = doc.tipoDocumento?.nombre || 'Documento';
      let estado = 'no necesario';
      if (doc.necesario) estado = doc.recibido ? 'en archivo' : 'pendiente';
      return { tipo, estado };
    })
  };

  return {
    emitidoEl,
    logoUrl: '/logo.png',
    administradora: mockFichaPropiedadPropietario.administradora,
    identificacion,
    contrato: contratoBlock,
    ajustes: ajustesBlock,
    resumenFinanciero,
    servicios,
    cobertura
  };
}
