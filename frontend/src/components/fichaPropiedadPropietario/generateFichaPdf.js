/**
 * Genera un PDF A4 a partir del nodo del informe (solo el “papel”, sin toolbar).
 * Import dinámico para no cargar la librería hasta que el usuario pide el PDF.
 */
export async function downloadFichaPropiedadPdf(element, filename = 'informe-propiedad.pdf') {
  if (!element) return;

  const { default: html2pdf } = await import('html2pdf.js');

  const opt = {
    margin: [10, 10, 10, 10],
    filename,
    image: { type: 'jpeg', quality: 0.93 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      letterRendering: true,
      scrollY: -window.scrollY,
      scrollX: 0
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
  };

  await html2pdf().set(opt).from(element).save();
}
