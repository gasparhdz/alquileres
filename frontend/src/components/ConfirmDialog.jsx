import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography
} from '@mui/material';

/**
 * Diálogo de confirmación con el mismo estilo en toda la app.
 * Reemplaza window.confirm para mantener UI consistente.
 */
export default function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  onConfirm,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmColor = 'primary',
  loading = false,
}) {
  return (
    <Dialog open={!!open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography component="div">{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button type="button" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          color={confirmColor}
          variant="contained"
          disabled={loading}
          onClick={() => onConfirm?.()}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
