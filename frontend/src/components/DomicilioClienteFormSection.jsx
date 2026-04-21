import { useMemo, useEffect } from 'react';
import {
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Autocomplete
} from '@mui/material';
import { getOpcionesPais } from '../utils/paisesIntl';

const opcionesPaisMemo = () => getOpcionesPais();

/** Id de provincia Santa Fe en el catálogo (nombre o código SF). */
export function findProvinciaSantaFeId(provincias) {
  if (!provincias?.length) return '';
  const p = provincias.find((x) => x.nombre === 'Santa Fe' || x.codigo === 'SF');
  return p ? String(p.id) : '';
}

/**
 * Argentina: provincia + localidad del catálogo. Exterior: país ISO (lista Intl) + ciudad/región texto libre.
 */
export default function DomicilioClienteFormSection({
  formData,
  setFormData,
  errors,
  setErrors,
  provincias,
  localidades,
  condicionesIva
}) {
  const opcionesPais = useMemo(() => opcionesPaisMemo(), []);
  /** Argentina: catálogo provincia/localidad. Cualquier otro código ISO: texto manual. */
  const esArgentina = !formData.paisCodigo || formData.paisCodigo === 'AR';
  const santaFeId = useMemo(() => findProvinciaSantaFeId(provincias), [provincias]);

  // Argentina + Santa Fe por defecto si aún no hay provincia
  useEffect(() => {
    if (!esArgentina || !santaFeId) return;
    const sinProvincia = formData.provinciaId === '' || formData.provinciaId == null;
    if (!sinProvincia) return;
    setFormData((prev) => ({ ...prev, provinciaId: santaFeId, localidadId: '' }));
  }, [esArgentina, santaFeId, formData.provinciaId, setFormData]);

  const paisSeleccionado = useMemo(() => {
    const cod = formData.paisCodigo || 'AR';
    return opcionesPais.find((p) => p.codigo === cod) || null;
  }, [opcionesPais, formData.paisCodigo]);

  const limpiarErroresUbicacion = () => {
    if (setErrors) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.provinciaId;
        delete next.localidadId;
        delete next.paisCodigo;
        delete next.localidadExtranjera;
        return next;
      });
    }
  };

  const labelPais = (o) => (typeof o === 'string' ? o : o.nombre);

  return (
    <>
      <Grid item xs={12} sm={3}>
        <Autocomplete
          size="small"
          options={opcionesPais}
          getOptionLabel={labelPais}
          isOptionEqualToValue={(a, b) => a.codigo === b.codigo}
          value={paisSeleccionado}
          onChange={(_, v) => {
            const codigo = v?.codigo || 'AR';
            const arg = codigo === 'AR';
            const sf = findProvinciaSantaFeId(provincias);
            const veniaDeExtranjero = formData.paisCodigo && formData.paisCodigo !== 'AR';
            limpiarErroresUbicacion();
            if (arg) {
              setFormData({
                ...formData,
                paisCodigo: codigo,
                provinciaExtranjera: '',
                localidadExtranjera: '',
                provinciaId: veniaDeExtranjero ? (sf || '') : formData.provinciaId || sf || '',
                localidadId: veniaDeExtranjero ? '' : formData.localidadId
              });
            } else {
              setFormData({
                ...formData,
                paisCodigo: codigo,
                provinciaId: '',
                localidadId: '',
                provinciaExtranjera: formData.provinciaExtranjera || '',
                localidadExtranjera: formData.localidadExtranjera || ''
              });
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="País"
              placeholder="Buscar país…"
              error={!!errors?.paisCodigo}
              helperText={errors?.paisCodigo || ''}
            />
          )}
        />
      </Grid>

      {esArgentina ? (
        <>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Provincia</InputLabel>
              <Select
                value={provincias?.some((p) => p.id == formData.provinciaId) ? formData.provinciaId : ''}
                label="Provincia"
                onChange={(e) => {
                  setFormData({ ...formData, provinciaId: e.target.value, localidadId: '' });
                }}
              >
                {provincias?.map((prov) => (
                  <MenuItem key={prov.id} value={prov.id}>
                    {prov.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Localidad</InputLabel>
              <Select
                value={localidades?.some((l) => l.id == formData.localidadId) ? formData.localidadId : ''}
                label="Localidad"
                onChange={(e) => setFormData({ ...formData, localidadId: e.target.value })}
                disabled={!formData.provinciaId}
              >
                {localidades?.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    {loc.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </>
      ) : (
        <>
          <Grid item xs={12} sm={3}>
            <TextField
              label="Ciudad o localidad"
              fullWidth
              size="small"
              value={formData.localidadExtranjera || ''}
              onChange={(e) => setFormData({ ...formData, localidadExtranjera: e.target.value })}
              placeholder="Ej.: Madrid, Miami"
              error={!!errors?.localidadExtranjera}
              helperText={errors?.localidadExtranjera || ''}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="Provincia / estado / región"
              fullWidth
              size="small"
              value={formData.provinciaExtranjera || ''}
              onChange={(e) => setFormData({ ...formData, provinciaExtranjera: e.target.value })}
              placeholder="Opcional"
            />
          </Grid>
        </>
      )}

      <Grid item xs={12} sm={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Condición IVA</InputLabel>
          <Select
            value={condicionesIva?.some((c) => c.id == formData.condicionIvaId) ? formData.condicionIvaId : ''}
            label="Condición IVA"
            onChange={(e) => setFormData({ ...formData, condicionIvaId: e.target.value })}
          >
            {condicionesIva?.map((cond) => (
              <MenuItem key={cond.id} value={cond.id}>
                {cond.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
    </>
  );
}
