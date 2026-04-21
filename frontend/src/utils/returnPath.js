/**
 * Utilidades para el patrón "Return Path": guardar y restaurar la ruta de retorno
 * con estado (p. ej. reabrir modal de perfil de cliente en /clientes).
 *
 * Estado esperado en location.state:
 * - returnUrl: string (ej. '/clientes?tab=0')
 * - reopenModalId: number | string (id del cliente para reabrir el modal)
 * - tipoCliente: 'inquilino' | 'propietario'
 */

/**
 * Construye el estado para enviar al navegar a otra pantalla desde el perfil de cliente.
 * @param {object} options
 * @param {'inquilino'|'propietario'} options.tipo
 * @param {number} options.clienteId
 * @returns {{ returnUrl: string, reopenModalId: number, tipoCliente: string }}
 */
export function getReturnStateFromClientePerfil({ tipo, clienteId }) {
  const tab = tipo === 'propietario' ? 0 : 1;
  return {
    returnUrl: `/clientes?tab=${tab}`,
    reopenModalId: clienteId,
    tipoCliente: tipo,
  };
}

/**
 * Construye la URL completa de retorno (returnUrl + query params para reabrir el modal).
 * @param {object} state - location.state
 * @returns {string | null} URL a la que navegar, o null si no hay returnUrl
 */
export function buildReturnUrlWithModal(state) {
  if (!state?.returnUrl) return null;
  const { returnUrl, reopenModalId, tipoCliente } = state;
  if (!reopenModalId || !tipoCliente) return returnUrl;
  const separator = returnUrl.includes('?') ? '&' : '?';
  return `${returnUrl}${separator}tipo=${encodeURIComponent(tipoCliente)}&id=${encodeURIComponent(reopenModalId)}`;
}

/**
 * Indica si hay un return path guardado en el state (para mostrar botón "Volver").
 * Compatible con estado desde perfil de cliente (returnUrl) o desde detalle de propiedad (returnTo).
 * @param {object} state - location.state
 * @returns {boolean}
 */
export function hasReturnPath(state) {
  return Boolean(state?.returnUrl || state?.returnTo);
}

/**
 * Devuelve la URL a la que navegar al pulsar "Volver".
 * Si el state viene del detalle de propiedad (returnTo + returnId), devuelve returnTo
 * asegurando verPerfil=returnId para que Propiedades reabra el modal.
 * Si viene del perfil de cliente (returnUrl), devuelve buildReturnUrlWithModal(state).
 * @param {object} state - location.state
 * @returns {string | null}
 */
export function getReturnUrl(state) {
  if (!state) return null;
  if (state.returnTo) {
    let base = state.returnTo;
    // Volver al detalle de propiedad: la página Propiedades abre el modal solo si la URL tiene verPerfil=id
    if (state.returnModal === 'propiedad' && state.returnId != null) {
      const sep = base.includes('?') ? '&' : '?';
      if (base.includes('verPerfil=')) {
        base = base.replace(/verPerfil=[^&]+/, `verPerfil=${state.returnId}`);
      } else {
        base = `${base}${sep}verPerfil=${state.returnId}`;
      }
      if (state.returnTab != null && state.returnTab !== '') {
        base += base.includes('?') ? '&' : '?';
        base += `tabProp=${encodeURIComponent(state.returnTab)}`;
      }
      return base;
    }
    return base;
  }
  return buildReturnUrlWithModal(state);
}

/**
 * Construye el estado para enviar al navegar a otra pantalla desde el detalle de propiedad,
 * de forma que al cerrar el modal destino se pueda regresar y reabrir el modal en la misma pestaña.
 * @param {object} currentLocation - location de useLocation()
 * @param {number} propiedadId - id de la propiedad
 * @param {string} [moduleName='propiedades'] - nombre del módulo de origen
 * @param {number} [tabIndex] - índice de la pestaña activa (0=Estado Comercial, 1=Impuestos, 2=Historial, 3=Mantenimiento)
 * @returns {{ returnTo: string, returnModal: string, returnId: number, returnModule: string, returnTab?: number }}
 */
export function getReturnStateFromPropiedad(currentLocation, propiedadId, moduleName = 'propiedades', tabIndex) {
  const state = {
    returnTo: (currentLocation?.pathname || '') + (currentLocation?.search || ''),
    returnModal: 'propiedad',
    returnId: propiedadId,
    returnModule: moduleName,
  };
  if (tabIndex != null) state.returnTab = tabIndex;
  return state;
}
