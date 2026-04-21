import { Box, Typography, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { formatFechaISO } from './formatters';

export default function FichaBloqueCobertura({ seguro, documentacionArchivo }) {
  const docs =
    Array.isArray(documentacionArchivo) ?
      documentacionArchivo.filter((d) => d?.tipo && d.estado !== 'no necesario')
    : [];

  const tieneSeguro =
    seguro &&
    (seguro.compania ||
      seguro.numeroPoliza ||
      seguro.vencimiento ||
      seguro.sumaOCobertura);

  if (!tieneSeguro && docs.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
        Cobertura y documentación
      </Typography>

      {tieneSeguro && (
        <Box
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'grey.50'
          }}
        >
          <StackedLabel icon={<VerifiedUserOutlinedIcon fontSize="small" color="primary" />} title="Seguro vigente" />
          {seguro.compania && (
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Compañía:</strong> {seguro.compania}
            </Typography>
          )}
          {seguro.numeroPoliza && (
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Nº póliza:</strong> {seguro.numeroPoliza}
            </Typography>
          )}
          {seguro.vencimiento && (
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Vencimiento:</strong> {formatFechaISO(seguro.vencimiento)}
            </Typography>
          )}
          {seguro.sumaOCobertura && (
            <Typography variant="body2">
              <strong>Cobertura / suma:</strong> {seguro.sumaOCobertura}
            </Typography>
          )}
        </Box>
      )}

      {docs.length > 0 && (
        <Box>
          <StackedLabel icon={<DescriptionOutlinedIcon fontSize="small" color="action" />} title="Documentación en archivo" />
          <List dense disablePadding sx={{ pl: 0 }}>
            {docs.map((d, i) => (
              <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <Box
                    component="span"
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: 'text.secondary',
                      mt: 0.75
                    }}
                  />
                </ListItemIcon>
                <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={d.tipo} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}

function StackedLabel({ icon, title }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
      {icon}
      <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
        {title}
      </Typography>
    </Box>
  );
}
