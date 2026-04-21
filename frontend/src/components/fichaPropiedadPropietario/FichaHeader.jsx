import { Box, Typography } from '@mui/material';
import { formatFechaISO } from './formatters';

const LOGO_DEFAULT = '/logo.png';

export default function FichaHeader({ titulo = 'Informe de Propiedad', fechaEmision, logoSrc }) {
  const src = logoSrc || LOGO_DEFAULT;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 2,
        pb: 2.5,
        borderBottom: '2px solid',
        borderColor: 'primary.main',
        mb: 2
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: 1 }}>
        <Box
          component="img"
          src={src}
          alt="Logo Inmobiliaria"
          sx={{
            width: 180,
            maxWidth: 'min(180px, 45vw)',
            height: 'auto',
            objectFit: 'contain',
            display: 'block',
            flexShrink: 0
          }}
        />
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'text.primary',
            fontSize: { xs: '1.5rem', sm: '1.75rem' },
            alignSelf: 'center'
          }}
        >
          {titulo}
        </Typography>
      </Box>
      {fechaEmision && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ flexShrink: 0, textAlign: 'right', pt: 0.5 }}
        >
          Emisión: {formatFechaISO(fechaEmision)}
        </Typography>
      )}
    </Box>
  );
}
