/** Estilos de contenedor tipo A4 + impresión */
export const a4PageSx = {
  width: '100%',
  maxWidth: '210mm',
  minHeight: '297mm',
  mx: 'auto',
  bgcolor: '#ffffff',
  color: '#1a1a1a',
  boxShadow: { xs: 'none', md: '0 2px 24px rgba(0,0,0,0.08)' },
  borderRadius: { xs: 0, md: 1 },
  border: { xs: 'none', md: '1px solid' },
  borderColor: 'divider',
  '@media print': {
    boxShadow: 'none',
    border: 'none',
    borderRadius: 0,
    maxWidth: '100%',
    minHeight: 'auto'
  }
};

export const screenOnlyToolbarSx = {
  '@media print': { display: 'none !important' }
};
