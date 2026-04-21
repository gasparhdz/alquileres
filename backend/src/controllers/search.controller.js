import prisma from '../db/prisma.js';

export const globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const searchTerm = q.trim().toLowerCase();
    const results = [];

    // Buscar en paralelo para optimizar velocidad
    const [propiedades, inquilinos, propietarios, contratos] = await Promise.all([
      // Buscar Propiedades
      prisma.propiedad.findMany({
        where: {
          deletedAt: null,
          OR: [
            { dirCalle: { contains: searchTerm, mode: 'insensitive' } },
            { dirNro: { contains: searchTerm, mode: 'insensitive' } },
            { dirDepto: { contains: searchTerm, mode: 'insensitive' } },
            { codigoInterno: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        include: {
          localidad: true,
          estadoPropiedad: true
        },
        take: 5
      }),

      // Buscar Inquilinos (clientes con rol INQUILINO)
      prisma.cliente.findMany({
        where: {
          deletedAt: null,
          activo: true,
          roles: {
            some: {
              rol: { codigo: 'INQUILINO', activo: true },
              deletedAt: null,
              activo: true
            }
          },
          OR: [
            { nombre: { contains: searchTerm, mode: 'insensitive' } },
            { apellido: { contains: searchTerm, mode: 'insensitive' } },
            { razonSocial: { contains: searchTerm, mode: 'insensitive' } },
            { dni: { contains: searchTerm, mode: 'insensitive' } },
            { cuit: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        take: 5
      }),

      // Buscar Propietarios (clientes con rol PROPIETARIO)
      prisma.cliente.findMany({
        where: {
          deletedAt: null,
          activo: true,
          roles: {
            some: {
              rol: { codigo: 'PROPIETARIO', activo: true },
              deletedAt: null,
              activo: true
            }
          },
          OR: [
            { nombre: { contains: searchTerm, mode: 'insensitive' } },
            { apellido: { contains: searchTerm, mode: 'insensitive' } },
            { razonSocial: { contains: searchTerm, mode: 'insensitive' } },
            { dni: { contains: searchTerm, mode: 'insensitive' } },
            { cuit: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        take: 5
      }),

      // Buscar Contratos
      prisma.contrato.findMany({
        where: {
          deletedAt: null,
          OR: [
            { nroContrato: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        include: {
          estado: true,
          inquilino: true,
          propiedad: {
            include: {
              localidad: true
            }
          }
        },
        take: 5
      })
    ]);

    // Formatear resultados de Propiedades
    propiedades.forEach(prop => {
      const direccion = [
        prop.dirCalle,
        prop.dirNro,
        prop.dirPiso ? `${prop.dirPiso}°` : null,
        prop.dirDepto ? `"${prop.dirDepto}"` : null
      ].filter(Boolean).join(' ');

      results.push({
        id: prop.id,
        tipo: 'propiedad',
        titulo: direccion || prop.codigoInterno || 'Sin dirección',
        subtitulo: prop.localidad?.nombre || 'Sin localidad',
        estado: prop.estadoPropiedad?.nombre || null,
        url: `/propiedades?verPerfil=${prop.id}`
      });
    });

    // Formatear resultados de Inquilinos
    inquilinos.forEach(inquilino => {
      const nombre = inquilino.razonSocial || 
        `${inquilino.apellido || ''}, ${inquilino.nombre || ''}`.trim() || 
        'Sin nombre';
      
      const documento = inquilino.cuit || inquilino.dni || null;

      results.push({
        id: inquilino.id,
        tipo: 'inquilino',
        titulo: nombre,
        subtitulo: documento ? `Inquilino - ${documento}` : 'Inquilino',
        url: `/clientes?tipo=inquilino&id=${inquilino.id}`
      });
    });

    // Formatear resultados de Propietarios
    propietarios.forEach(propietario => {
      const nombre = propietario.razonSocial || 
        `${propietario.apellido || ''}, ${propietario.nombre || ''}`.trim() || 
        'Sin nombre';
      
      const documento = propietario.cuit || propietario.dni || null;

      results.push({
        id: propietario.id,
        tipo: 'propietario',
        titulo: nombre,
        subtitulo: documento ? `Propietario - ${documento}` : 'Propietario',
        url: `/clientes?tipo=propietario&id=${propietario.id}`
      });
    });

    // Formatear resultados de Contratos
    contratos.forEach(contrato => {
      const inquilinoNombre = contrato.inquilino?.razonSocial || 
        `${contrato.inquilino?.apellido || ''}, ${contrato.inquilino?.nombre || ''}`.trim() || 
        'Sin inquilino';
      
      const direccion = contrato.propiedad ? [
        contrato.propiedad.dirCalle,
        contrato.propiedad.dirNro
      ].filter(Boolean).join(' ') : '';

      const estadoNombre = contrato.estado?.nombre || contrato.estado?.codigo || '';
      
      results.push({
        id: contrato.id,
        tipo: 'contrato',
        titulo: `Contrato #${contrato.nroContrato || contrato.id}`,
        subtitulo: `${inquilinoNombre}${direccion ? ` - ${direccion}` : ''}`,
        estado: estadoNombre,
        url: `/contratos?id=${contrato.id}`
      });
    });

    // Ordenar por relevancia (coincidencias exactas primero)
    results.sort((a, b) => {
      const aExact = a.titulo.toLowerCase().startsWith(searchTerm) ? 0 : 1;
      const bExact = b.titulo.toLowerCase().startsWith(searchTerm) ? 0 : 1;
      return aExact - bExact;
    });

    // Limitar a 10 resultados totales
    res.json(results.slice(0, 10));

  } catch (error) {
    console.error('Error en búsqueda global:', error);
    res.status(500).json({ error: 'Error al realizar la búsqueda' });
  }
};
