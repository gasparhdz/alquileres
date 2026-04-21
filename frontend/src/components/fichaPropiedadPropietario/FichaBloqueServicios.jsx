import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

export default function FichaBloqueServicios({ filas }) {
  const datos = Array.isArray(filas) ? filas.filter((r) => r?.servicio) : [];
  if (datos.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
        Servicios e impuestos
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Servicio</TableCell>
              <TableCell>Titular figurante</TableCell>
              <TableCell>Identificador</TableCell>
              <TableCell>Responsable del pago</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {datos.map((row, i) => (
              <TableRow key={i}>
                <TableCell>{row.servicio}</TableCell>
                <TableCell>{row.titularFigurante || ''}</TableCell>
                <TableCell>{row.identificador || ''}</TableCell>
                <TableCell>{row.responsablePago || ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
