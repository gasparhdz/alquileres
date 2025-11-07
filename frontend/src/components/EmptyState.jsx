import { Box, Typography, Button, Paper } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

export default function EmptyState({ title, message, actionLabel, onAction }) {
  return (
    <Paper
      sx={{
        p: 4,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        bgcolor: 'background.paper'
      }}
    >
      <AddCircleOutlineIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {message}
      </Typography>
      {onAction && (
        <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Paper>
  );
}

