import { Box, Grid, Typography } from '@mui/material';

/**
 * Omite filas sin dato (no muestra "Sin datos").
 */
export default function FichaBloqueIdentificacion({ data }) {
  if (!data) return null;

  const filas = [
    data.direccionCompleta && { label: 'Dirección', value: data.direccionCompleta },
    (data.tipoPropiedad || data.destino) && {
      label: 'Tipo y destino',
      value: [data.tipoPropiedad, data.destino].filter(Boolean).join(' · ')
    },
    (data.ambientes != null || data.superficieM2 != null) && {
      label: 'Ambientes y superficie',
      value: [
        data.ambientes != null ? `${data.ambientes} amb.` : null,
        data.superficieM2 != null ? `${data.superficieM2} m²` : null
      ]
        .filter(Boolean)
        .join(' · ')
    },
    data.estadoPropiedad && { label: 'Estado', value: data.estadoPropiedad }
  ].filter((f) => f && f.value);

  const titulares = Array.isArray(data.titulares) ? data.titulares.filter((t) => t?.nombreCompleto) : [];

  return (
    <Box
      sx={{
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        borderRadius: 1,
        p: { xs: 2, sm: 2.5 },
        mb: 3
      }}
    >
      <Typography variant="overline" sx={{ opacity: 0.9, letterSpacing: 0.08, display: 'block', mb: 1.5 }}>
        Identificación del activo
      </Typography>
      <Grid container spacing={1.5}>
        {filas.map((fila, i) => (
          <Grid item xs={12} key={i}>
            <Typography variant="caption" sx={{ opacity: 0.85, display: 'block' }}>
              {fila.label}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
              {fila.value}
            </Typography>
          </Grid>
        ))}
      </Grid>

      {titulares.length > 0 && (
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.25)' }}>
          <Typography variant="caption" sx={{ opacity: 0.85, display: 'block', mb: 1 }}>
            Titular{titulares.length > 1 ? 'es' : ''}
          </Typography>
          {titulares.map((t, idx) => (
            <Typography key={idx} variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
              {t.nombreCompleto}
              {t.cuit ? ` · CUIT ${t.cuit}` : ''}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}
