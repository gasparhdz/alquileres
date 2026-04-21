import { nombrePaisDesdeCodigo } from './paisesIntl';

/**
 * Texto de localización para perfil / listados (cliente con relaciones opcionales).
 */
export function buildDireccionLegalResumen(cliente) {
  if (!cliente) return 'Sin dirección';

  const calle = [
    cliente.dirCalle,
    cliente.dirNro,
    cliente.dirPiso && `Piso ${cliente.dirPiso}`,
    cliente.dirDepto && `Dto ${cliente.dirDepto}`
  ]
    .filter(Boolean)
    .join(' ');

  if (cliente.paisCodigo) {
    const pais = nombrePaisDesdeCodigo(cliente.paisCodigo);
    const partes = [
      calle || null,
      [cliente.localidadExtranjera, cliente.provinciaExtranjera].filter(Boolean).join(', ') || null,
      pais
    ].filter(Boolean);
    return partes.join(', ') || 'Sin dirección';
  }

  const loc = [cliente.localidad?.nombre, cliente.provincia?.nombre].filter(Boolean).join(', ');
  const partes = [calle || null, loc || null].filter(Boolean);
  return partes.join(', ') || 'Sin dirección';
}
