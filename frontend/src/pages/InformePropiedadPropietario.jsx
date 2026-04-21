import { Typography, Box, GlobalStyles, Button, Stack, CircularProgress, Alert } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { FichaPropiedadPropietario, mockFichaPropiedadPropietario } from '../components/fichaPropiedadPropietario';
import { useInformePropiedad } from '../hooks/useInformePropiedad';

/**
 * Informe para propietario. Con `?propiedadId=` en la URL (desde detalle de propiedad).
 */
export default function InformePropiedadPropietarioPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const propiedadId = searchParams.get('propiedadId');
  const returnTo = location.state?.returnTo;

  const { fichaData, isLoading, isError, error } = useInformePropiedad(propiedadId);
  const usarApi = !!propiedadId;
  const data = usarApi ? fichaData : mockFichaPropiedadPropietario;

  return (
    <Box className="informe-propietario-root">
      <GlobalStyles
        styles={{
          '@media print': {
            body: {
              printColorAdjust: 'exact',
              WebkitPrintColorAdjust: 'exact'
            },
            '@page': {
              size: 'A4',
              margin: '10mm'
            },
            'header.MuiAppBar-root, nav': {
              display: 'none !important'
            },
            '.no-print': {
              display: 'none !important'
            },
            'main.MuiBox-root': {
              margin: '0 !important',
              marginLeft: '0 !important',
              marginTop: '0 !important',
              width: '100% !important',
              maxWidth: '100% !important',
              padding: '0 !important',
              background: '#ffffff !important',
              minHeight: 'auto !important',
              overflow: 'visible !important'
            },
            '.ficha-propiedad-pdf-target': {
              boxShadow: 'none !important',
              border: 'none !important',
              borderRadius: '0 !important'
            }
          }
        }}
      />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1}
        className="no-print"
        sx={{ mb: 2, maxWidth: '210mm', mx: 'auto', px: { xs: 2, sm: 0 } }}
      >
        {returnTo && (
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(returnTo)}
            sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
          >
            Volver
          </Button>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {usarApi
            ? `Informe de la propiedad #${propiedadId} (datos del sistema).`
            : 'Vista previa del informe (datos de demostración). Abrilo desde el detalle de una propiedad para asociar el inmueble.'}
        </Typography>
      </Stack>

      {usarApi && isError && (
        <Alert severity="error" sx={{ maxWidth: '210mm', mx: 'auto', mb: 2 }} className="no-print">
          {error?.response?.data?.error || error?.message || 'No se pudo cargar la propiedad.'}
        </Alert>
      )}

      {usarApi && isLoading && (
        <Box
          className="no-print"
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 240,
            maxWidth: '210mm',
            mx: 'auto'
          }}
        >
          <CircularProgress size={40} />
        </Box>
      )}

      {usarApi && !isLoading && !isError && data && <FichaPropiedadPropietario data={data} />}
      {!usarApi && <FichaPropiedadPropietario data={data} />}
    </Box>
  );
}
