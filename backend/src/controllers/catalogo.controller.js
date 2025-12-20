import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Obtener todos los tipos de persona
export const getTiposPersona = async (req, res) => {
  try {
    const tipos = await prisma.tipoPersona.findMany({
      where: { activo: true },
      orderBy: { codigo: 'asc' }
    });
    res.json(tipos);
  } catch (error) {
    console.error('Error al obtener tipos de persona:', error);
    res.status(500).json({ error: 'Error al obtener tipos de persona' });
  }
};

// Obtener todas las provincias
export const getProvincias = async (req, res) => {
  try {
    const provincias = await prisma.provincia.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    });
    res.json(provincias);
  } catch (error) {
    console.error('Error al obtener provincias:', error);
    res.status(500).json({ error: 'Error al obtener provincias' });
  }
};

// Obtener localidades por provincia
export const getLocalidadesByProvincia = async (req, res) => {
  try {
    const { provinciaId } = req.params;
    const localidades = await prisma.localidad.findMany({
      where: {
        provinciaId: parseInt(provinciaId),
        activo: true
      },
      orderBy: { nombre: 'asc' }
    });
    res.json(localidades);
  } catch (error) {
    console.error('Error al obtener localidades:', error);
    res.status(500).json({ error: 'Error al obtener localidades' });
  }
};

// Obtener todas las localidades
export const getLocalidades = async (req, res) => {
  try {
    const { provinciaId } = req.query;
    const where = {
      activo: true,
      ...(provinciaId && { provinciaId: parseInt(provinciaId) })
    };
    const localidades = await prisma.localidad.findMany({
      where,
      include: {
        provincia: true
      },
      orderBy: [
        { provincia: { nombre: 'asc' } },
        { nombre: 'asc' }
      ]
    });
    res.json(localidades);
  } catch (error) {
    console.error('Error al obtener localidades:', error);
    res.status(500).json({ error: 'Error al obtener localidades' });
  }
};

// Obtener todas las condiciones de IVA
export const getCondicionesIva = async (req, res) => {
  try {
    const condiciones = await prisma.condicionIva.findMany({
      where: { activo: true },
      orderBy: { codigo: 'asc' }
    });
    res.json(condiciones);
  } catch (error) {
    console.error('Error al obtener condiciones de IVA:', error);
    res.status(500).json({ error: 'Error al obtener condiciones de IVA' });
  }
};

// Obtener todos los tipos de propiedad
export const getTiposPropiedad = async (req, res) => {
  try {
    const tipos = await prisma.tipoPropiedad.findMany({
      where: { 
        activo: true,
        deletedAt: null
      },
      orderBy: { nombre: 'asc' }
    });
    res.json(tipos);
  } catch (error) {
    console.error('Error al obtener tipos de propiedad:', error);
    res.status(500).json({ error: 'Error al obtener tipos de propiedad' });
  }
};

// Obtener todos los estados de propiedad
export const getEstadosPropiedad = async (req, res) => {
  try {
    const estados = await prisma.estadoPropiedad.findMany({
      where: { 
        activo: true,
        deletedAt: null
      },
      orderBy: { nombre: 'asc' }
    });
    res.json(estados);
  } catch (error) {
    console.error('Error al obtener estados de propiedad:', error);
    res.status(500).json({ error: 'Error al obtener estados de propiedad' });
  }
};

// Obtener todos los destinos de propiedad
export const getDestinosPropiedad = async (req, res) => {
  try {
    const destinos = await prisma.destinoPropiedad.findMany({
      where: { 
        activo: true,
        deletedAt: null
      },
      orderBy: { nombre: 'asc' }
    });
    res.json(destinos);
  } catch (error) {
    console.error('Error al obtener destinos de propiedad:', error);
    res.status(500).json({ error: 'Error al obtener destinos de propiedad' });
  }
};

// Obtener todos los ambientes de propiedad
export const getAmbientesPropiedad = async (req, res) => {
  try {
    const ambientes = await prisma.ambientePropiedad.findMany({
      where: { 
        activo: true,
        deletedAt: null
      },
      orderBy: { nombre: 'asc' }
    });
    res.json(ambientes);
  } catch (error) {
    console.error('Error al obtener ambientes de propiedad:', error);
    res.status(500).json({ error: 'Error al obtener ambientes de propiedad' });
  }
};

