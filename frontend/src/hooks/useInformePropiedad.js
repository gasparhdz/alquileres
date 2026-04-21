import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import { buildFichaPropiedadData } from '../components/fichaPropiedadPropietario/buildFichaPropiedadData';

/**
 * Carga propiedad, contrato vigente, liquidaciones y (opcional) liquidaciones al propietario
 * para armar el informe PDF / pantalla.
 */
export function useInformePropiedad(propiedadId) {
  const pid = propiedadId ? parseInt(String(propiedadId), 10) : NaN;
  const enabled = Number.isFinite(pid) && pid > 0;

  const propiedadQuery = useQuery({
    queryKey: ['informe-propiedad', pid],
    queryFn: () => api.get(`/propiedades/${pid}`).then((r) => r.data),
    enabled
  });

  const contratoVigenteId = useMemo(() => {
    const list = propiedadQuery.data?.contratos || [];
    const v = list.find((c) => c.estado?.codigo === 'VIGENTE');
    return v?.id ?? null;
  }, [propiedadQuery.data]);

  const contratoQuery = useQuery({
    queryKey: ['informe-contrato', contratoVigenteId],
    queryFn: () => api.get(`/contratos/${contratoVigenteId}`).then((r) => r.data),
    enabled: enabled && contratoVigenteId != null
  });

  const liquidacionesQuery = useQuery({
    queryKey: ['informe-liquidaciones', pid],
    queryFn: () =>
      api
        .get('/liquidaciones', {
          params: {
            propiedadId: pid,
            limit: 24,
            sortBy: 'periodo',
            sortOrder: 'desc'
          }
        })
        .then((r) => r.data),
    enabled
  });

  const liqPropQuery = useQuery({
    queryKey: ['informe-liquidaciones-propietario', contratoVigenteId],
    queryFn: () =>
      api.get(`/contratos/${contratoVigenteId}/liquidaciones-propietario`).then((r) => r.data),
    enabled: enabled && contratoVigenteId != null,
    retry: false
  });

  const fichaData = useMemo(() => {
    if (!propiedadQuery.data) return null;
    const liquidacionesPropietario =
      liqPropQuery.isSuccess && Array.isArray(liqPropQuery.data) ? liqPropQuery.data : [];
    return buildFichaPropiedadData({
      propiedad: propiedadQuery.data,
      contrato: contratoQuery.data ?? null,
      liquidacionesResp: liquidacionesQuery.data ?? null,
      liquidacionesPropietario
    });
  }, [
    propiedadQuery.data,
    contratoQuery.data,
    liquidacionesQuery.data,
    liqPropQuery.data,
    liqPropQuery.isSuccess
  ]);

  const isLoading =
    propiedadQuery.isPending ||
    liquidacionesQuery.isPending ||
    (contratoVigenteId != null && contratoQuery.isPending);

  return {
    fichaData,
    isLoading,
    isError: propiedadQuery.isError,
    error: propiedadQuery.error,
    contratoVigenteId,
    refetch: () =>
      Promise.all([
        propiedadQuery.refetch(),
        liquidacionesQuery.refetch(),
        contratoQuery.refetch(),
        liqPropQuery.refetch()
      ])
  };
}
