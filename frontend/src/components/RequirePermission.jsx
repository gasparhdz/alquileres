import { usePermissions } from '../contexts/AuthContext';

/**
 * Componente que renderiza sus hijos SOLO si el usuario tiene el permiso indicado.
 * Si no tiene permiso, renderiza el fallback (por defecto null = no muestra nada).
 *
 * Uso: <RequirePermission codigo="inquilinos.eliminar"><IconButton>🗑️</IconButton></RequirePermission>
 */
export default function RequirePermission({ codigo, children, fallback = null }) {
  const { hasPermission } = usePermissions();
  if (!hasPermission(codigo)) {
    return fallback;
  }
  return children;
}
