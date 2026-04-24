-- Limpieza completa de la base operativa antes de resembrar.
-- Incluye:
--   1) tablas cubiertas por seed
--   2) tablas operativas dependientes de esas tablas (liquidaciones/movimientos/índices)
--
-- No usa CASCADE a propósito: si en el futuro aparecen nuevas dependencias no contempladas,
-- el script falla en lugar de borrar de más.

BEGIN;

TRUNCATE TABLE
  public.movimientos_cuenta_propietario,
  public.movimientos_cuenta_inquilino,
  public.liquidacion_items,
  public.liquidaciones_propietario,
  public.liquidaciones,
  public.indice_ajuste,
  public.refresh_tokens,
  public.usuario_rol,
  public.rol_permiso,
  public.permisos,
  public.usuarios,
  public.roles,
  public.propiedad_cargo_campos,
  public.propiedad_impuesto_campos,
  public.propiedad_documento,
  public.propiedad_seguros,
  public.propiedad_cargos,
  public.propiedad_impuestos,
  public.propiedad_propietario,
  public.contrato_ajuste,
  public.contrato_garantias,
  public.contrato_gastos_iniciales,
  public.contrato_responsabilidades,
  public.contratos,
  public.propiedades,
  public.cliente_rol,
  public.clientes,
  public.consorcios,
  public.tipos_cargo_campos,
  public.tipos_impuesto_propiedad_campos,
  public.tipos_documento_propiedad,
  public.tipos_cargo,
  public.tipos_expensa,
  public.tipos_impuesto_propiedad,
  public.periodicidades_impuesto,
  public.actores_responsable_contrato,
  public.estados_garantia_contrato,
  public.estados_contrato,
  public.tipos_garantia_contrato,
  public.metodos_ajuste_contrato,
  public.tipos_gasto_inicial_contrato,
  public.roles_cliente,
  public.estados_liquidacion,
  public.estados_item_liquidacion,
  public.monedas,
  public.tipos_movimiento,
  public.medios_pago,
  public.destinos_propiedad,
  public.estados_propiedad,
  public.tipos_propiedad,
  public.ambientes_propiedad,
  public.condiciones_iva,
  public.localidades,
  public.provincias,
  public.tipos_persona
RESTART IDENTITY;

COMMIT;
