import { Prisma } from '@prisma/client';
import prisma from '../db/prisma.js';

function parseDateOnly(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDecimalOpt(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return new Prisma.Decimal(n.toFixed(2));
}

/** @returns {{ ok: string | null } | { error: string }} */
function optStr150(val, label) {
  if (val == null || val === '') return { ok: null };
  const s = String(val).trim();
  if (s.length > 150) return { error: `${label} admite como máximo 150 caracteres` };
  return { ok: s || null };
}

function optStr150Update(body, key, fallback, label) {
  if (body[key] === undefined) return { ok: fallback };
  return optStr150(body[key], label);
}

async function assertPropiedadExiste(propiedadId) {
  const p = await prisma.propiedad.findFirst({
    where: { id: propiedadId, deletedAt: null, activo: true },
    select: { id: true },
  });
  return p;
}

/** GET /propiedades/:id/seguros */
export const listSegurosPropiedad = async (req, res) => {
  try {
    const propiedadId = parseInt(req.params.id, 10);
    if (isNaN(propiedadId)) {
      return res.status(400).json({ error: 'ID de propiedad inválido' });
    }
    const prop = await assertPropiedadExiste(propiedadId);
    if (!prop) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }
    const seguros = await prisma.propiedadSeguro.findMany({
      where: { propiedadId, activo: true, deletedAt: null },
      orderBy: { fechaFin: 'desc' },
    });
    res.json(seguros);
  } catch (e) {
    console.error('listSegurosPropiedad:', e);
    res.status(500).json({ error: 'Error al listar seguros' });
  }
};

/** POST /propiedades/:id/seguros */
export const createSeguroPropiedad = async (req, res) => {
  try {
    const propiedadId = parseInt(req.params.id, 10);
    if (isNaN(propiedadId)) {
      return res.status(400).json({ error: 'ID de propiedad inválido' });
    }
    const prop = await assertPropiedadExiste(propiedadId);
    if (!prop) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    const b = req.body || {};
    const compania = (b.compania ?? '').trim();
    const nroPoliza = (b.nroPoliza ?? '').trim();
    const fechaInicio = parseDateOnly(b.fechaInicio);
    const fechaFin = parseDateOnly(b.fechaFin);

    if (!compania || compania.length > 100) {
      return res.status(400).json({ error: 'Compañía es obligatoria (máx. 100 caracteres)' });
    }
    if (!nroPoliza || nroPoliza.length > 100) {
      return res.status(400).json({ error: 'Nº de póliza es obligatorio (máx. 100 caracteres)' });
    }
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'Fecha inicio y fecha fin son obligatorias' });
    }
    if (fechaFin < fechaInicio) {
      return res.status(400).json({ error: 'La fecha fin debe ser posterior o igual a la fecha inicio' });
    }

    const titularPoliza = optStr150(b.titularPoliza, 'Titular de la póliza');
    const productorSeguro = optStr150(b.productorSeguro, 'Productor de seguro');
    const contactoProductor = optStr150(b.contactoProductor, 'Contacto del productor');
    const tipoCobertura = optStr150(b.tipoCobertura, 'Tipo de cobertura');
    for (const r of [titularPoliza, productorSeguro, contactoProductor, tipoCobertura]) {
      if (r.error) return res.status(400).json({ error: r.error });
    }

    const created = await prisma.propiedadSeguro.create({
      data: {
        propiedadId,
        compania,
        nroPoliza,
        fechaInicio,
        fechaFin,
        montoAsegurado: parseDecimalOpt(b.montoAsegurado),
        costoPoliza: parseDecimalOpt(b.costoPoliza),
        notas: b.notas != null && String(b.notas).trim() !== '' ? String(b.notas).trim() : null,
        titularPoliza: titularPoliza.ok,
        productorSeguro: productorSeguro.ok,
        contactoProductor: contactoProductor.ok,
        tipoCobertura: tipoCobertura.ok,
        activo: true,
      },
    });
    res.status(201).json(created);
  } catch (e) {
    console.error('createSeguroPropiedad:', e);
    res.status(500).json({ error: 'Error al crear póliza' });
  }
};

/** PUT /propiedades/:id/seguros/:seguroId */
export const updateSeguroPropiedad = async (req, res) => {
  try {
    const propiedadId = parseInt(req.params.id, 10);
    const seguroId = parseInt(req.params.seguroId, 10);
    if (isNaN(propiedadId) || isNaN(seguroId)) {
      return res.status(400).json({ error: 'IDs inválidos' });
    }

    const existente = await prisma.propiedadSeguro.findFirst({
      where: {
        id: seguroId,
        propiedadId,
        deletedAt: null,
      },
    });
    if (!existente) {
      return res.status(404).json({ error: 'Póliza no encontrada' });
    }
    if (!existente.activo) {
      return res.status(400).json({ error: 'La póliza está dada de baja' });
    }

    const b = req.body || {};
    const compania = (b.compania ?? existente.compania).trim();
    const nroPoliza = (b.nroPoliza ?? existente.nroPoliza).trim();
    const fechaInicio = b.fechaInicio != null ? parseDateOnly(b.fechaInicio) : existente.fechaInicio;
    const fechaFin = b.fechaFin != null ? parseDateOnly(b.fechaFin) : existente.fechaFin;

    if (!compania || compania.length > 100) {
      return res.status(400).json({ error: 'Compañía es obligatoria (máx. 100 caracteres)' });
    }
    if (!nroPoliza || nroPoliza.length > 100) {
      return res.status(400).json({ error: 'Nº de póliza es obligatorio (máx. 100 caracteres)' });
    }
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'Fecha inicio y fecha fin son obligatorias' });
    }
    if (fechaFin < fechaInicio) {
      return res.status(400).json({ error: 'La fecha fin debe ser posterior o igual a la fecha inicio' });
    }

    const titularPoliza = optStr150Update(b, 'titularPoliza', existente.titularPoliza, 'Titular de la póliza');
    const productorSeguro = optStr150Update(b, 'productorSeguro', existente.productorSeguro, 'Productor de seguro');
    const contactoProductor = optStr150Update(b, 'contactoProductor', existente.contactoProductor, 'Contacto del productor');
    const tipoCobertura = optStr150Update(b, 'tipoCobertura', existente.tipoCobertura, 'Tipo de cobertura');
    for (const r of [titularPoliza, productorSeguro, contactoProductor, tipoCobertura]) {
      if (r.error) return res.status(400).json({ error: r.error });
    }

    const updated = await prisma.propiedadSeguro.update({
      where: { id: seguroId },
      data: {
        compania,
        nroPoliza,
        fechaInicio,
        fechaFin,
        montoAsegurado: b.montoAsegurado !== undefined ? parseDecimalOpt(b.montoAsegurado) : existente.montoAsegurado,
        costoPoliza: b.costoPoliza !== undefined ? parseDecimalOpt(b.costoPoliza) : existente.costoPoliza,
        notas: b.notas !== undefined ? (String(b.notas).trim() || null) : existente.notas,
        titularPoliza: titularPoliza.ok,
        productorSeguro: productorSeguro.ok,
        contactoProductor: contactoProductor.ok,
        tipoCobertura: tipoCobertura.ok,
      },
    });
    res.json(updated);
  } catch (e) {
    console.error('updateSeguroPropiedad:', e);
    res.status(500).json({ error: 'Error al actualizar póliza' });
  }
};

/** DELETE /propiedades/:id/seguros/:seguroId — baja lógica */
export const deleteSeguroPropiedad = async (req, res) => {
  try {
    const propiedadId = parseInt(req.params.id, 10);
    const seguroId = parseInt(req.params.seguroId, 10);
    if (isNaN(propiedadId) || isNaN(seguroId)) {
      return res.status(400).json({ error: 'IDs inválidos' });
    }

    const existente = await prisma.propiedadSeguro.findFirst({
      where: { id: seguroId, propiedadId, deletedAt: null },
    });
    if (!existente) {
      return res.status(404).json({ error: 'Póliza no encontrada' });
    }

    await prisma.propiedadSeguro.update({
      where: { id: seguroId },
      data: {
        activo: false,
        deletedAt: new Date(),
      },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('deleteSeguroPropiedad:', e);
    res.status(500).json({ error: 'Error al eliminar póliza' });
  }
};
