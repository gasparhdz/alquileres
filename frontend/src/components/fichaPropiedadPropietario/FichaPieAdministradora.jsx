import { Box, Typography, Divider } from '@mui/material';

export default function FichaPieAdministradora({ administradora }) {
  if (!administradora?.razonSocial) return null;

  return (
    <Box sx={{ mt: 4, pt: 2 }}>
      <Divider sx={{ mb: 2 }} />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        Administración
      </Typography>
      <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
        {administradora.razonSocial}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', lineHeight: 1.6 }}>
        {administradora.direccion && <span>{administradora.direccion}</span>}
        {administradora.telefono && (
          <>
            <br />
            Tel. {administradora.telefono}
          </>
        )}
        {administradora.email && (
          <>
            <br />
            {administradora.email}
          </>
        )}
      </Typography>
      {administradora.matriculaCorredor && (
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ display: 'block', mt: 1.5, fontSize: '0.7rem' }}
        >
          {administradora.matriculaCorredor}
        </Typography>
      )}
    </Box>
  );
}
