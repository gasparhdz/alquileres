import { Box, CircularProgress, Typography } from '@mui/material';

export default function Loading({ message = 'Cargando datos...' }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: 'text.secondary'
      }}
    >
      <CircularProgress sx={{ mb: 2 }} color="primary" />
      <Typography variant="h6">{message}</Typography>
    </Box>
  );
}

