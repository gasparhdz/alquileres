import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer';

const prisma = new PrismaClient();

export const getAllLiquidaciones = async (req, res) => {
  try {
    const { contratoId, unidadId, periodo, estado, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(contratoId && { contratoId }),
      ...(unidadId && { unidadId }),
      ...(periodo && { periodo }),
      ...(estado && { estado })
    };

    const [liquidaciones, total] = await Promise.all([
      prisma.liquidacion.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { periodo: 'desc' },
        include: {
          contrato: {
            include: {
              inquilino: true,
              unidad: {
                include: {
                  propietario: true
                }
              }
            }
          },
          items: {
            orderBy: { orden: 'asc' }
          }
        }
      }),
      prisma.liquidacion.count({ where })
    ]);

    res.json({
      data: liquidaciones,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error al obtener liquidaciones:', error);
    res.status(500).json({ error: 'Error al obtener liquidaciones' });
  }
};

export const getLiquidacionById = async (req, res) => {
  try {
    const { id } = req.params;

    const liquidacion = await prisma.liquidacion.findUnique({
      where: { id },
      include: {
        contrato: {
          include: {
            inquilino: true,
            unidad: {
              include: {
                propietario: true,
                cuentas: {
                  where: { isDeleted: false }
                }
              }
            },
            responsabilidades: true
          }
        },
        items: {
          orderBy: { orden: 'asc' },
          include: {
            cuentaTributaria: true
          }
        }
      }
    });

    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    res.json(liquidacion);
  } catch (error) {
    console.error('Error al obtener liquidación:', error);
    res.status(500).json({ error: 'Error al obtener liquidación' });
  }
};

export const generateLiquidacion = async (req, res) => {
  try {
    const { contratoId, periodo } = req.body;

    if (!contratoId || !periodo) {
      return res.status(400).json({ error: 'Contrato y período son requeridos' });
    }

    // Verificar que no exista ya una liquidación para ese contrato y período
    const existing = await prisma.liquidacion.findUnique({
      where: {
        contratoId_periodo: {
          contratoId,
          periodo
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Ya existe una liquidación para este contrato y período' });
    }

    // Obtener contrato con todas sus relaciones
    const contrato = await prisma.contrato.findFirst({
      where: { id: contratoId, isDeleted: false },
      include: {
        unidad: {
          include: {
            cuentas: {
              where: { isDeleted: false }
            }
          }
        },
        responsabilidades: true
      }
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Verificar que el período esté dentro de las fechas del contrato
    const periodoDate = new Date(periodo + '-01');
    if (periodoDate < new Date(contrato.fechaInicio)) {
      return res.status(400).json({ error: 'El período es anterior a la fecha de inicio del contrato' });
    }

    if (contrato.fechaFin && periodoDate > contrato.fechaFin) {
      return res.status(400).json({ error: 'El período es posterior a la fecha de fin del contrato' });
    }

    // Calcular monto del alquiler (con ajustes si corresponde)
    let montoAlquiler = parseFloat(contrato.montoInicial);

    // Generar items basados en responsabilidades
    const items = [];
    let orden = 1;

    // Alquiler base
    const alquilerResp = contrato.responsabilidades.find(r => r.tipoCargo === 'alquiler');
    if (alquilerResp) {
      items.push({
        tipoCargo: 'alquiler',
        importe: montoAlquiler,
        quienPaga: alquilerResp.quienPaga,
        fuente: 'automatico',
        orden: orden++,
        observaciones: 'Alquiler base'
      });
    }

    // Otros conceptos según responsabilidades y cuentas tributarias
    for (const resp of contrato.responsabilidades) {
      if (resp.tipoCargo !== 'alquiler') {
        const cuenta = contrato.unidad.cuentas.find(c => c.tipoImpuesto === resp.tipoCargo);
        if (cuenta) {
          items.push({
            tipoCargo: resp.tipoCargo,
            cuentaTributariaId: cuenta.id,
            importe: 0, // Se debe completar manualmente
            quienPaga: resp.quienPaga,
            fuente: 'automatico',
            orden: orden++,
            observaciones: `Pendiente de carga`
          });
        }
      }
    }

    // Calcular total
    const total = items.reduce((sum, item) => sum + parseFloat(item.importe || 0), 0);

    // Crear liquidación
    const liquidacion = await prisma.liquidacion.create({
      data: {
        contratoId,
        unidadId: contrato.unidadId,
        periodo,
        estado: 'borrador',
        total,
        items: {
          create: items
        }
      },
      include: {
        items: {
          orderBy: { orden: 'asc' }
        }
      }
    });

    res.status(201).json(liquidacion);
  } catch (error) {
    console.error('Error al generar liquidación:', error);
    res.status(500).json({ error: 'Error al generar liquidación' });
  }
};

export const createLiquidacion = async (req, res) => {
  try {
    const { contratoId, unidadId, periodo, items, vencimiento, observaciones, estado } = req.body;

    // Validaciones básicas
    if (!unidadId || !periodo) {
      return res.status(400).json({ error: 'Unidad y período son requeridos' });
    }
    
    // contratoId es opcional, pero si se proporciona, debe ser válido
    if (contratoId) {
      const contrato = await prisma.contrato.findUnique({
        where: { id: contratoId }
      });
      if (!contrato) {
        return res.status(400).json({ error: 'Contrato no encontrado' });
      }
    }

    // Validar formato de período (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      return res.status(400).json({ error: 'El período debe tener el formato YYYY-MM' });
    }

    // Validar items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos un item en la liquidación' });
    }

    // Validar cada item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.tipoCargo) {
        return res.status(400).json({ error: `El item ${i + 1} debe tener un tipo de cargo` });
      }
      if (!item.quienPaga) {
        return res.status(400).json({ error: `El item ${i + 1} debe especificar quién paga` });
      }
      const importe = parseFloat(item.importe);
      if (isNaN(importe) || importe < 0) {
        return res.status(400).json({ error: `El item ${i + 1} debe tener un importe válido` });
      }
    }

    // Calcular total
    const total = items.reduce((sum, item) => {
      const importe = parseFloat(item.importe || 0);
      return sum + (isNaN(importe) ? 0 : importe);
    }, 0);

    // Preparar datos de items
    const itemsData = items.map((item, index) => ({
      tipoCargo: item.tipoCargo,
      cuentaTributariaId: item.cuentaTributariaId || null,
      periodoRef: item.periodoRef || null,
      importe: parseFloat(item.importe),
      quienPaga: item.quienPaga,
      fuente: item.fuente || 'manual',
      refExterna: item.refExterna || null,
      observaciones: item.observaciones || null,
      orden: item.orden !== undefined ? parseInt(item.orden) : index
    }));

    // Crear liquidación
    const liquidacion = await prisma.liquidacion.create({
      data: {
        contratoId,
        unidadId,
        periodo,
        total,
        estado: estado || 'borrador',
        vencimiento: vencimiento ? new Date(vencimiento) : null,
        observaciones: observaciones || null,
        items: {
          create: itemsData
        }
      },
      include: {
        items: {
          orderBy: { orden: 'asc' }
        }
      }
    });

    res.status(201).json(liquidacion);
  } catch (error) {
    console.error('Error al crear liquidación:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una liquidación para este contrato y período' });
    }

    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Referencia inválida: el contrato o unidad no existe' });
    }

    res.status(500).json({ 
      error: 'Error al crear liquidación',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const updateLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { items, ...data } = req.body;

    const liquidacion = await prisma.liquidacion.findUnique({
      where: { id }
    });

    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    // Si viene estado "emitida", no se puede modificar
    if (liquidacion.estado === 'emitida') {
      return res.status(400).json({ error: 'No se puede modificar una liquidación ya emitida' });
    }

    // Actualizar items si vienen
    if (items) {
      // Eliminar items existentes
      await prisma.liquidacionItem.deleteMany({
        where: { liquidacionId: id }
      });

      // Crear nuevos items
      await prisma.liquidacionItem.createMany({
        data: items.map(item => ({
          ...item,
          liquidacionId: id,
          importe: parseFloat(item.importe)
        }))
      });
    }

    // Calcular nuevo total
    const allItems = await prisma.liquidacionItem.findMany({
      where: { liquidacionId: id }
    });

    const total = allItems.reduce((sum, item) => sum + parseFloat(item.importe || 0), 0);

    // Actualizar liquidación
    const updated = await prisma.liquidacion.update({
      where: { id },
      data: {
        ...data,
        total
      },
      include: {
        items: {
          orderBy: { orden: 'asc' }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar liquidación:', error);
    res.status(500).json({ error: 'Error al actualizar liquidación' });
  }
};

export const emitirLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;

    const liquidacion = await prisma.liquidacion.findUnique({
      where: { id },
      include: {
        items: true
      }
    });

    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    if (liquidacion.estado === 'emitida') {
      return res.status(400).json({ error: 'La liquidación ya está emitida' });
    }

    // Validar que la liquidación esté lista para emitir
    if (liquidacion.estado !== 'lista_para_emitir') {
      return res.status(400).json({ 
        error: 'La liquidación no está lista para emitir',
        detalles: `El estado actual es: ${liquidacion.estado}. Todos los items deben estar completados.`
      });
    }

    // Generar numeración si no existe
    let numeracion = liquidacion.numeracion;
    if (!numeracion) {
      const year = liquidacion.periodo.split('-')[0];
      const count = await prisma.liquidacion.count({
        where: {
          periodo: { startsWith: year },
          numeracion: { not: null }
        }
      });
      numeracion = `LIQ-${year}-${String(count + 1).padStart(4, '0')}`;
    }

    const updated = await prisma.liquidacion.update({
      where: { id },
      data: {
        estado: 'emitida',
        numeracion,
        emisionAt: new Date()
      },
      include: {
        items: {
          orderBy: { orden: 'asc' }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error al emitir liquidación:', error);
    res.status(500).json({ error: 'Error al emitir liquidación' });
  }
};

export const deleteLiquidacion = async (req, res) => {
  try {
    const { id } = req.params;

    const liquidacion = await prisma.liquidacion.findUnique({
      where: { id }
    });

    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    if (liquidacion.estado === 'emitida') {
      return res.status(400).json({ error: 'No se puede eliminar una liquidación emitida' });
    }

    // Eliminar items primero
    await prisma.liquidacionItem.deleteMany({
      where: { liquidacionId: id }
    });

    // Eliminar liquidación
    await prisma.liquidacion.delete({
      where: { id }
    });

    res.json({ message: 'Liquidación eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar liquidación:', error);
    res.status(500).json({ error: 'Error al eliminar liquidación' });
  }
};

export const generatePDF = async (req, res) => {
  try {
    const { id } = req.params;

    const liquidacion = await prisma.liquidacion.findUnique({
      where: { id },
      include: {
        contrato: {
          include: {
            inquilino: true,
            unidad: {
              include: {
                propietario: true
              }
            }
          }
        },
        items: {
          orderBy: { orden: 'asc' },
          include: {
            cuentaTributaria: {
              include: {
                unidad: {
                  include: {
                    propietario: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    // Obtener parámetros necesarios
    const tipoImpuestoCat = await prisma.categoria.findUnique({
      where: { codigo: 'tipo_impuesto' },
      include: { parametros: { where: { activo: true } } }
    });

    const quienPagaCat = await prisma.categoria.findUnique({
      where: { codigo: 'quien_paga' },
      include: { parametros: { where: { activo: true } } }
    });

    const condicionIvaCat = await prisma.categoria.findUnique({
      where: { codigo: 'condicion_iva' },
      include: { parametros: { where: { activo: true } } }
    });

    // Crear mapas de parámetros
    const tipoImpuestoMap = {};
    tipoImpuestoCat?.parametros.forEach(p => {
      tipoImpuestoMap[p.id] = p;
      tipoImpuestoMap[p.codigo] = p;
    });

    const quienPagaMap = {};
    quienPagaCat?.parametros.forEach(p => {
      quienPagaMap[p.id] = p;
      quienPagaMap[p.codigo] = p;
    });

    const condicionIvaMap = {};
    condicionIvaCat?.parametros.forEach(p => {
      condicionIvaMap[p.id] = p;
      condicionIvaMap[p.codigo] = p;
    });

    // Generar HTML
    const html = generateHTML(liquidacion, { tipoImpuestoMap, quienPagaMap, condicionIvaMap });

    // Generar PDF con Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    await browser.close();

    // Enviar PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="liquidacion-${liquidacion.periodo}.pdf"`);
    res.send(pdf);
  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).json({ error: 'Error al generar PDF' });
  }
};

function generateHTML(liq, { headerBase64, tipoImpuestoMap = {}, condicionIvaMap = {} }) {
  const { contrato, items } = liq;
  const { inquilino = {}, unidad = {} } = contrato || {};

  // ===== Helpers =====
  const fechaEmision = liq.emisionAt
    ? new Date(liq.emisionAt).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' })
    : new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' });

  const formatNumeracion = () => {
    if (liq.numeracion && liq.numeracion.includes('-')) return liq.numeracion;
    const y = new Date().getFullYear();
    const n = (liq.numeracion || 1).toString().padStart(4, '0');
    return `LIQ-${y}-${n}`;
  };

  const [anioStr, mesStr] = (liq.periodo || '').split('-');
  const mesNumero = parseInt(mesStr || '1', 10);
  const anioNumero = parseInt(anioStr || String(new Date().getFullYear()), 10);

  const fmt = (n) => Math.abs(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = (n) => (Number(n) < 0 ? '-' : '');

  const getParam = (map, k) => (k ? (map[k] || map[String(k)]) : null);
  const getCondicionIva = (id) => getParam(condicionIvaMap, id)?.descripcion || 'Consumidor final';

  const nombreCompleto = inquilino.razonSocial
    ? inquilino.razonSocial
    : [inquilino.apellido, inquilino.nombre].filter(Boolean).join(', ');

  const formatDni = (dni) => {
    if (!dni) return '-';
    const d = String(dni).replace(/\D/g, '');
    return d.length === 8 ? d.replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2.$3') : dni;
  };
  const formatCuit = (cuit) => {
    if (!cuit) return '-';
    const c = String(cuit).replace(/\D/g, '');
    return c.length === 11 ? c.replace(/(\d{2})(\d{8})(\d{1})/, '$1-$2-$3') : cuit;
  };

  const getConcepto = (it) => {
    // Si tenés parametrización, resolvela acá:
    const key = it?.cuentaTributaria?.tipoImpuesto ?? it?.tipoCargo;
    const p = getParam(tipoImpuestoMap, key);
    return p?.abreviatura || p?.descripcion || key || '-';
  };

  const total = (items || []).reduce((acc, it) => acc + (Number(it.importe) || 0), 0);

  // ===== Tabla de ítems =====
  const itemsHTML = (items || []).map((it) => {
    const imp = Number(it.importe) || 0;
    return `
      <tr>
        <td>${getConcepto(it)}</td>
        <td style="text-align:center;">${mesNumero}</td>
        <td style="text-align:center;">${anioNumero}</td>
        <td style="text-align:right;color:#d32f2f;font-weight:600;">${sign(imp)}$ ${fmt(imp)}</td>
      </tr>
    `;
  }).join('');

  // ===== HTML =====
  return `
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; padding: 12mm; }
  .container { width: 186mm; margin: 0 auto; }

  /* Encabezado (imagen + overlay N° / FECHA) */
  .header-wrap { position: relative; margin-bottom: 8px; }
  .header-img { width: 100%; height: auto; display: block; }
  .header-overlay { position: absolute; right: 10px; top: 10px; text-align: right; font-size: 11px; }
  .title { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
           font-weight: 700; font-size: 20px; letter-spacing: 1px; }
  .invalid { text-align: center; font-size: 10px; margin: 4px 0 6px; }
  .divider { height: 1px; background: #000; margin: 8px 0; }

  /* Filas compactas */
  .row { display: flex; justify-content: space-between; gap: 16px; margin: 6px 0; }
  .col { flex: 1; }
  .kv { display: inline-block; margin-right: 16px; }
  .lbl { font-weight: 700; }

  table { width: 100%; border-collapse: collapse; }
  .items th { text-align: left; border-bottom: 1px solid #aaa; padding: 6px 4px; }
  .items th:nth-child(2), .items th:nth-child(3) { text-align: center; }
  .items th:last-child { text-align: right; }
  .items td { padding: 6px 4px; border-bottom: 1px solid #eee; }

  .total-line { text-align: right; margin-top: 6px; font-weight: 700; }
  .pay-total { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 14px; }
  .dots { border-bottom: 1px dotted #000; display: inline-block; min-width: 120px; margin: 0 6px; transform: translateY(-2px); }
  .box { display: flex; align-items: center; gap: 6px; }
  .box .label { border: 1px solid #000; padding: 6px 10px; font-weight: 700; }
  .box .value { border: 1px solid #000; padding: 6px 14px; min-width: 120px; text-align: right; font-weight: 700; color: #d32f2f; }

  .sign { margin-top: 28px; }
  .sign .line { border-bottom: 1px solid #000; height: 14px; margin-top: 6px; }
  .footer { display: flex; justify-content: flex-end; margin-top: 18px; font-size: 10px; }
</style>
</head>
<body>
<div class="container">

  <!-- Encabezado (si pasás headerBase64 se usa la imagen del diseño) -->
  <div class="header-wrap">
    ${headerBase64 ? `<img class="header-img" src="data:image/png;base64,${headerBase64}" alt="Encabezado">` : ''}
    <div class="title">LIQUIDACION</div>
    <div class="header-overlay">
      <div>N°: ${formatNumeracion()}</div>
      <div>FECHA: ${fechaEmision}</div>
    </div>
  </div>

  <div class="invalid"><b>X</b> Documento no válido como factura</div>
  <div class="divider"></div>

  <!-- Cliente -->
  <div class="row">
    <div class="col">
      <span class="kv"><span class="lbl">Cliente:</span> ${nombreCompleto || '-'}</span>
      <span class="kv"><span class="lbl">DNI:</span> ${formatDni(inquilino.dni)}</span>
      <span class="kv"><span class="lbl">CUIT /CUIL:</span> ${formatCuit(inquilino.cuit)}</span>
      <div class="kv" style="margin-right:0"><span class="lbl">Dirección:</span> ${inquilino.direccion || '-'}</div>
    </div>
    <div class="col" style="text-align:right">
      <div class="kv"><span class="lbl">I.V.A.:</span> ${getCondicionIva(inquilino.condicionIva)}</div>
      <div class="kv"><span class="lbl">Localidad:</span> ${inquilino.localidad || '-'}</div>
    </div>
  </div>

  <div class="divider"></div>

  <!-- Contrato / Propiedad -->
  <div class="row">
    <div class="col">
      <span class="kv"><span class="lbl">Contrato N°:</span> ${contrato?.nroContrato || '-'}</span>
      <span class="kv"><span class="lbl">Inicio:</span> ${contrato?.fechaInicio ? new Date(contrato.fechaInicio).toLocaleDateString('es-AR') : '-'}</span>
      <span class="kv"><span class="lbl">Fin:</span> ${contrato?.fechaFin ? new Date(contrato.fechaFin).toLocaleDateString('es-AR') : '-'}</span>
    </div>
    <div class="col" style="text-align:right">
      <div class="kv"><span class="lbl">Propiedad Calle:</span> ${unidad?.direccion || '-'}</div>
      <div class="kv"><span class="lbl">Propiedad Localidad:</span> ${unidad?.localidad || '-'}</div>
    </div>
  </div>

  <!-- Tabla -->
  <table class="items" style="margin-top:8px">
    <thead>
      <tr>
        <th>Concepto</th>
        <th>Periodo</th>
        <th>Año</th>
        <th>Importe</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <!-- Total debajo de tabla -->
  <div class="total-line">${sign(total)}$ ${fmt(total)}</div>

  <!-- Medios de Pago + Total Recibo -->
  <div class="pay-total">
    <div>
      <b>Medios de Pago:</b> <span class="dots"></span> Efectivo <span class="dots"></span>
      <span>${sign(total)}$ ${fmt(total)}</span>
    </div>
    <div class="box">
      <div class="label">Total Recibo:</div>
      <div class="value">${sign(total)}$ ${fmt(total)}</div>
    </div>
  </div>

  <!-- Firma -->
  <div class="sign">
    <div><b>Firma y aclaración:</b></div>
    <div class="line"></div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>
      <div>Tel.: 341-3132231</div>
      <div>Mail: info@odomopropiedades.com</div>
    </div>
  </div>

</div>
</body>
</html>
  `;
}

/**
 * Genera liquidaciones automáticamente para todos los contratos vigentes del período especificado
 * Endpoint: POST /api/liquidaciones/cron/generar?periodo=YYYY-MM
 */
export const generarLiquidacionesAutomaticas = async (req, res) => {
  try {
    const { periodo } = req.query || req.body;
    
    // Si no se proporciona período, usar el mes actual
    let periodoObjetivo = periodo;
    if (!periodoObjetivo) {
      const ahora = new Date();
      periodoObjetivo = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
    }

    // Validar formato YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(periodoObjetivo)) {
      return res.status(400).json({ error: 'El período debe tener el formato YYYY-MM' });
    }

    const periodoDate = new Date(periodoObjetivo + '-01');
    if (isNaN(periodoDate.getTime())) {
      return res.status(400).json({ error: 'Período inválido' });
    }

    console.log(`[CRON] Iniciando generación automática de liquidaciones para período: ${periodoObjetivo}`);

    // Crear fecha de inicio y fin del mes del período
    const inicioMes = new Date(periodoDate.getFullYear(), periodoDate.getMonth(), 1);
    inicioMes.setHours(0, 0, 0, 0);
    const finMes = new Date(periodoDate.getFullYear(), periodoDate.getMonth() + 1, 0);
    finMes.setHours(23, 59, 59, 999);

    // PASO 1: Obtener TODAS las unidades que tengan cuentas tributarias activas
    const unidadesConCuentas = await prisma.unidad.findMany({
      where: {
        isDeleted: false,
        cuentas: {
          some: {
            isDeleted: false,
            activo: true
          }
        }
      },
      include: {
        cuentas: {
          where: {
            isDeleted: false,
            activo: true
          }
        }
      }
    });

    console.log(`[CRON] Encontradas ${unidadesConCuentas.length} unidades con cuentas tributarias activas`);

    let creadas = 0;
    let omitidas = 0;
    let errores = 0;
    let omitidosSinContrato = 0;
    let omitidosPorFecha = 0;
    let omitidosSinItems = 0;
    const erroresDetalle = [];

    // PASO 2: Para cada unidad, buscar el contrato vigente en el período
    for (const unidad of unidadesConCuentas) {
      try {
        // Buscar el contrato vigente o prorrogado que esté activo en el período
        const contratoVigente = await prisma.contrato.findFirst({
          where: {
            unidadId: unidad.id,
            isDeleted: false,
            estado: {
              in: ['vigente', 'prorrogado']
            },
            fechaInicio: {
              lte: finMes // El contrato debe haber comenzado antes o durante el mes
            },
            OR: [
              { fechaFin: null }, // Contrato sin fecha de fin
              { fechaFin: { gte: inicioMes } } // O fecha de fin posterior o igual al inicio del mes
            ]
          },
          include: {
            responsabilidades: true,
            inquilino: true
          },
          orderBy: {
            fechaInicio: 'desc' // Tomar el más reciente si hay múltiples
          }
        });

        // Si no hay contrato vigente, crear liquidación solo con items de cuentas
        // El contrato y las responsabilidades solo se usan para determinar quién paga al emitir
        if (!contratoVigente) {
          console.log(`[CRON] Unidad ${unidad.direccion} no tiene contrato vigente en período ${periodoObjetivo}, creando liquidación solo con items de cuentas`);
        }

        // Verificar idempotencia: si ya existe liquidación para esta unidad y período, omitir
        const existing = await prisma.liquidacion.findFirst({
          where: {
            unidadId: unidad.id,
            periodo: periodoObjetivo
          }
        });

        if (existing) {
          omitidas++;
          console.log(`[CRON] Skip: Ya existe liquidación para unidad ${unidad.direccion} período ${periodoObjetivo}`);
          continue;
        }

        console.log(`[CRON] Procesando unidad ${unidad.direccion}: ${contratoVigente ? `Contrato ${contratoVigente.nroContrato}, Responsabilidades=${contratoVigente.responsabilidades?.length || 0}, ` : ''}Cuentas activas=${unidad.cuentas.length}`);

        const items = [];
        let orden = 1;

        // 1. Item Alquiler (solo si hay contrato vigente y responsabilidad de alquiler)
        if (contratoVigente) {
          const alquilerResp = contratoVigente.responsabilidades.find(r => r.tipoCargo === 'alquiler');
          if (alquilerResp) {
            const montoAlquiler = parseFloat(contratoVigente.montoActual || contratoVigente.montoInicial);
            items.push({
              tipoCargo: 'alquiler',
              importe: montoAlquiler,
              quienPaga: alquilerResp.quienPaga,
              fuente: 'automatico',
              estado: 'completado', // El alquiler ya está calculado
              orden: orden++,
              observaciones: 'Alquiler calculado automáticamente'
            });
          }
        }

        // 2. Items por cada cuenta tributaria activa de la unidad
        // IMPORTANTE: Se crean items para TODAS las cuentas activas, independientemente de las responsabilidades
        // Las responsabilidades solo se usan para determinar quién paga cuando se emite la liquidación
        for (const cuenta of unidad.cuentas) {
          // Buscar el último item completado de esta cuenta/tipo para obtener importeAnterior
          const ultimoItem = await prisma.liquidacionItem.findFirst({
            where: {
              cuentaTributariaId: cuenta.id,
              tipoCargo: cuenta.tipoImpuesto,
              estado: 'completado',
              importe: { not: null }
            },
            orderBy: {
              createdAt: 'desc'
            },
            select: {
              importe: true
            }
          });

          // Buscar responsabilidad en el contrato para este tipo de impuesto (si hay contrato)
          // Si no hay responsabilidad configurada o no hay contrato, usar un valor por defecto
          // Las responsabilidades solo se usan para saber quién paga al emitir
          const resp = contratoVigente?.responsabilidades.find(r => r.tipoCargo === cuenta.tipoImpuesto);
          // Si no hay responsabilidad, usar 'paga_inq' como fallback (paga inquilino por defecto)
          const quienPaga = resp ? resp.quienPaga : 'paga_inq';

          items.push({
            tipoCargo: cuenta.tipoImpuesto,
            cuentaTributariaId: cuenta.id,
            importe: null, // Pendiente de completar
            importeAnterior: ultimoItem ? parseFloat(ultimoItem.importe) : null,
            quienPaga: quienPaga, // Usar responsabilidad del contrato, o fallback
            fuente: 'automatico',
            estado: 'pendiente',
            orden: orden++,
            observaciones: 'Pendiente de carga manual'
          });
        }

        // Si no hay items, no crear liquidación
        if (items.length === 0) {
          omitidosSinItems++;
          console.log(`[CRON] Skip sin items: Unidad ${unidad.direccion} no tiene items para crear`);
          continue;
        }

        // Calcular total inicial (solo items con importe)
        const total = items.reduce((sum, item) => {
          return sum + (item.importe ? parseFloat(item.importe) : 0);
        }, 0);

        // Determinar estado inicial
        // Si todos los items están completados → lista_para_emitir
        // Si hay items pendientes → pendiente_items
        const todosCompletados = items.every(item => item.estado === 'completado');
        const estadoInicial = todosCompletados ? 'lista_para_emitir' : 'pendiente_items';

        // Crear liquidación
        await prisma.liquidacion.create({
          data: {
            contratoId: contratoVigente?.id || null, // Opcional: puede ser null si no hay contrato
            unidadId: unidad.id,
            periodo: periodoObjetivo,
            estado: estadoInicial,
            total,
            autoGenerada: true,
            items: {
              create: items
            }
          }
        });

        creadas++;
        console.log(`[CRON] Creada liquidación para unidad ${unidad.direccion} ${contratoVigente ? `(contrato ${contratoVigente.nroContrato})` : '(sin contrato)'} período ${periodoObjetivo} con ${items.length} items`);

      } catch (error) {
        errores++;
        erroresDetalle.push({
          unidadId: unidad.id,
          direccion: unidad.direccion,
          error: error.message
        });
        console.error(`[CRON] Error al crear liquidación para unidad ${unidad.direccion}:`, error);
        console.error(`[CRON] Error stack:`, error.stack);
      }
    }

    const resultado = {
      periodo: periodoObjetivo,
      resumen: {
        unidadesEncontradas: unidadesConCuentas.length,
        creadas,
        omitidas,
        omitidosSinContrato,
        omitidosPorFecha,
        omitidosSinItems,
        errores
      },
      erroresDetalle: errores > 0 ? erroresDetalle : undefined
    };

    console.log(`[CRON] Finalizada generación automática:`, resultado.resumen);
    console.log(`[CRON] Detalle: ${unidadesConCuentas.length} unidades encontradas, ${creadas} creadas, ${omitidas} omitidas (existentes), ${omitidosSinContrato} omitidas (sin contrato), ${omitidosSinItems} omitidas (sin items), ${errores} errores`);
    res.json(resultado);

  } catch (error) {
    console.error('[CRON] Error en generación automática de liquidaciones:', error);
    res.status(500).json({ 
      error: 'Error al generar liquidaciones automáticas',
      detalles: error.message
    });
  }
};

/**
 * Obtiene items pendientes para la bandeja de completar
 * Endpoint: GET /api/liquidaciones/pendientes-items
 */
export const getPendientesItems = async (req, res) => {
  try {
    const { 
      periodo, 
      tipoImpuesto, 
      search, 
      verCompletados = 'false',
      page = 1, 
      pageSize = 50 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const mostrarCompletados = verCompletados === 'true';

    // Si no se proporciona período, usar el mes actual
    let periodoFiltro = periodo;
    if (!periodoFiltro) {
      const ahora = new Date();
      periodoFiltro = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
    }

    // Construir where clause
    const where = {
      liquidacion: {
        periodo: periodoFiltro
      },
      estado: mostrarCompletados ? 'completado' : 'pendiente',
      ...(tipoImpuesto && { tipoCargo: tipoImpuesto }),
      ...(search && {
        OR: [
          {
            liquidacion: {
              unidad: {
                direccion: { contains: search, mode: 'insensitive' }
              }
            }
          },
          {
            liquidacion: {
              unidad: {
                localidad: { contains: search, mode: 'insensitive' }
              }
            }
          },
          {
            liquidacion: {
              contrato: {
                inquilino: {
                  OR: [
                    { apellido: { contains: search, mode: 'insensitive' } },
                    { nombre: { contains: search, mode: 'insensitive' } },
                    { razonSocial: { contains: search, mode: 'insensitive' } }
                  ]
                }
              }
            }
          }
        ]
      })
    };

    const [items, total] = await Promise.all([
      prisma.liquidacionItem.findMany({
        where,
        skip,
        take: parseInt(pageSize),
        include: {
          liquidacion: {
            include: {
              contrato: {
                include: {
                  inquilino: {
                    select: {
                      id: true,
                      nombre: true,
                      apellido: true,
                      razonSocial: true
                    }
                  }
                }
              },
              unidad: {
                select: {
                  id: true,
                  direccion: true,
                  localidad: true
                }
              }
            }
          },
          cuentaTributaria: {
            select: {
              id: true,
              codigo1: true,
              codigo2: true,
              usuarioEmail: true,
              usuarioPortal: true,
              password: true
            }
          }
        },
        orderBy: [
          { tipoCargo: 'asc' },
          { liquidacion: { unidad: { direccion: 'asc' } } }
        ]
      }),
      prisma.liquidacionItem.count({ where })
    ]);

    // Formatear respuesta
    const data = items.map(item => {
      const inquilino = item.liquidacion.contrato.inquilino;
      const displayInquilino = inquilino.razonSocial || 
        `${inquilino.apellido || ''}, ${inquilino.nombre || ''}`.trim() || 'Sin nombre';

      return {
        itemId: item.id,
        tipoImpuesto: item.tipoCargo,
        periodo: item.liquidacion.periodo,
        unidad: {
          direccion: item.liquidacion.unidad.direccion,
          localidad: item.liquidacion.unidad.localidad
        },
        inquilino: {
          display: displayInquilino
        },
        cuenta: item.cuentaTributaria ? {
          codigo1: item.cuentaTributaria.codigo1,
          codigo2: item.cuentaTributaria.codigo2,
          user: item.cuentaTributaria.usuarioPortal || item.cuentaTributaria.usuarioEmail,
          password: item.cuentaTributaria.password || null // Devolver password real (se oculta en frontend con toggle)
        } : null,
        importeAnterior: item.importeAnterior ? parseFloat(item.importeAnterior) : null,
        importe: item.importe ? parseFloat(item.importe) : null,
        estado: item.estado,
        observaciones: item.observaciones
      };
    });

    res.json({
      data,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });

  } catch (error) {
    console.error('Error al obtener items pendientes:', error);
    res.status(500).json({ error: 'Error al obtener items pendientes' });
  }
};

/**
 * Completa un item de liquidación
 * Endpoint: POST /api/liquidaciones/items/:id/completar
 */
export const completarItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { importe, observaciones } = req.body;

    // Validar importe
    const importeNum = parseFloat(importe);
    if (isNaN(importeNum) || importeNum < 0) {
      return res.status(400).json({ error: 'El importe debe ser un número mayor o igual a 0' });
    }

    // Obtener el item
    const item = await prisma.liquidacionItem.findUnique({
      where: { id },
      include: {
        liquidacion: {
          include: {
            items: true
          }
        }
      }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    // Validar que el item esté pendiente
    if (item.estado !== 'pendiente') {
      return res.status(400).json({ 
        error: 'El item ya está completado o no aplica',
        estadoActual: item.estado
      });
    }

    // Obtener usuario actual (si está disponible en el request)
    const usuarioId = req.user?.id || null;

    // Actualizar el item
    const itemActualizado = await prisma.liquidacionItem.update({
      where: { id },
      data: {
        importe: importeNum,
        estado: 'completado',
        completadoAt: new Date(),
        completadoBy: usuarioId,
        observaciones: observaciones || item.observaciones
      }
    });

    // Recalcular total de la liquidación
    const todosItems = await prisma.liquidacionItem.findMany({
      where: { liquidacionId: item.liquidacionId }
    });

    const nuevoTotal = todosItems.reduce((sum, it) => {
      return sum + (it.importe ? parseFloat(it.importe) : 0);
    }, 0);

    // Verificar si todos los items están completados o no_aplica
    const todosCompletados = todosItems.every(it => 
      it.estado === 'completado' || it.estado === 'no_aplica'
    );

    // Actualizar estado de la liquidación si corresponde
    const nuevoEstado = todosCompletados ? 'lista_para_emitir' : 'pendiente_items';

    await prisma.liquidacion.update({
      where: { id: item.liquidacionId },
      data: {
        total: nuevoTotal,
        estado: nuevoEstado
      }
    });

    res.json({ 
      ok: true,
      item: itemActualizado,
      liquidacionEstado: nuevoEstado
    });

  } catch (error) {
    console.error('Error al completar item:', error);
    res.status(500).json({ error: 'Error al completar item' });
  }
};

/**
 * Reabre un item completado (opcional)
 * Endpoint: POST /api/liquidaciones/items/:id/reabrir
 */
export const reabrirItem = async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener el item
    const item = await prisma.liquidacionItem.findUnique({
      where: { id },
      include: {
        liquidacion: {
          include: {
            items: true
          }
        }
      }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    // Validar que el item esté completado
    if (item.estado !== 'completado') {
      return res.status(400).json({ 
        error: 'Solo se pueden reabrir items completados',
        estadoActual: item.estado
      });
    }

    // Validar que la liquidación no esté emitida
    if (item.liquidacion.estado === 'emitida') {
      return res.status(400).json({ error: 'No se puede reabrir un item de una liquidación ya emitida' });
    }

    // Actualizar el item
    const itemActualizado = await prisma.liquidacionItem.update({
      where: { id },
      data: {
        estado: 'pendiente',
        importe: null,
        completadoAt: null,
        completadoBy: null
      }
    });

    // Recalcular total de la liquidación
    const todosItems = await prisma.liquidacionItem.findMany({
      where: { liquidacionId: item.liquidacionId }
    });

    const nuevoTotal = todosItems.reduce((sum, it) => {
      return sum + (it.importe ? parseFloat(it.importe) : 0);
    }, 0);

    // Actualizar estado de la liquidación a pendiente_items
    await prisma.liquidacion.update({
      where: { id: item.liquidacionId },
      data: {
        total: nuevoTotal,
        estado: 'pendiente_items'
      }
    });

    res.json({ 
      ok: true,
      item: itemActualizado
    });

  } catch (error) {
    console.error('Error al reabrir item:', error);
    res.status(500).json({ error: 'Error al reabrir item' });
  }
};

