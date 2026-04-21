import { Dialog, DialogTitle, DialogContent } from '@mui/material';

/**
 * Modal presentacional: edición de una liquidación.
 * Recibe el formulario de edición por children (ej. LiquidacionEditForm).
 */
export function LiquidacionEditDialog({ open, onClose, children }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Editar Liquidación</DialogTitle>
      <DialogContent>
        {children}
      </DialogContent>
    </Dialog>
  );
}
