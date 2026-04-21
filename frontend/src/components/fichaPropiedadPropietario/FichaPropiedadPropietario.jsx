import { useRef, useState } from 'react';
import { Box, Button, Stack, CircularProgress } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import FichaHeader from './FichaHeader';
import FichaBloqueIdentificacion from './FichaBloqueIdentificacion';
import FichaBloqueContrato from './FichaBloqueContrato';
import FichaBloqueFinanciero from './FichaBloqueFinanciero';
import FichaBloqueServicios from './FichaBloqueServicios';
import FichaBloqueCobertura from './FichaBloqueCobertura';
import FichaPieAdministradora from './FichaPieAdministradora';
import { a4PageSx, screenOnlyToolbarSx } from './fichaPrintStyles';
import { downloadFichaPropiedadPdf } from './generateFichaPdf';

/**
 * Informe ejecutivo para propietario — datos vía prop `data` (mock o API).
 * El PDF se genera solo del bloque blanco (`ficha-propiedad-pdf-target`), sin toolbar.
 */
export default function FichaPropiedadPropietario({ data }) {
  const pdfRef = useRef(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  if (!data) return null;

  const handleDownloadPdf = async () => {
    const safeDate = (data.emitidoEl || 'sin-fecha').replace(/[^\d]/g, '');
    const filename = `informe-propiedad-${safeDate}.pdf`;
    setPdfLoading(true);
    try {
      await downloadFichaPropiedadPdf(pdfRef.current, filename);
    } catch (err) {
      console.error('Error al generar PDF:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <Box
      sx={{
        py: { xs: 1, md: 3 },
        px: { xs: 0, sm: 2 },
        bgcolor: { xs: 'background.default', md: 'grey.100' },
        '@media print': { bgcolor: '#fff', py: 0 }
      }}
    >
      <Stack
        direction="row"
        justifyContent="flex-end"
        className="no-print"
        sx={{ maxWidth: '210mm', mx: 'auto', mb: 1, ...screenOnlyToolbarSx }}
      >
        <Button
          variant="contained"
          size="small"
          startIcon={pdfLoading ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
        >
          {pdfLoading ? 'Generando PDF…' : 'Descargar PDF'}
        </Button>
      </Stack>

      <Box
        ref={pdfRef}
        className="ficha-propiedad-pdf-target ficha-propiedad-a4"
        sx={{ ...a4PageSx, p: { xs: 2, sm: 3, md: 4 } }}
      >
        <FichaHeader fechaEmision={data.emitidoEl} logoSrc={data.logoUrl} />

        <FichaBloqueIdentificacion data={data.identificacion} />

        <FichaBloqueContrato contrato={data.contrato} ajustes={data.ajustes} />

        <FichaBloqueFinanciero data={data.resumenFinanciero} />

        <FichaBloqueServicios filas={data.servicios} />

        <FichaBloqueCobertura
          seguro={data.cobertura?.seguro}
          documentacionArchivo={data.cobertura?.documentacionArchivo}
        />

        <FichaPieAdministradora administradora={data.administradora} />
      </Box>
    </Box>
  );
}
