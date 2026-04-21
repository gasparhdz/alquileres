import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Snackbar,
  Alert,
  InputAdornment,
  TablePagination,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import api from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import RequirePermission from '../components/RequirePermission';
import { useDebounce } from '../hooks/useDebounce';

const emptyForm = () => ({
  nombre: '',
  cuitConsorcio: '',
  direccionConsorcio: '',
  nombreAdministracion: '',
  direccionAdministracion: '',
  nombreReferente: '',
  telefonoAdministracion: '',
  mailAdministracion: '',
  notas: '',
});

export default function Consorcios() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [eliminarId, setEliminarId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const searchDebounced = useDebounce(searchTerm, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['consorcios', { page: page + 1, limit: rowsPerPage, search: searchDebounced }],
    queryFn: async () => {
      const r = await api.get('/consorcios', {
        params: {
          page: page + 1,
          limit: rowsPerPage,
          search: searchDebounced.trim() || undefined,
        },
      });
      return r.data;
    },
  });

  const lista = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  const createMut = useMutation({
    mutationFn: (payload) => api.post('/consorcios', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['consorcios']);
      queryClient.invalidateQueries(['propiedades']);
      setOpen(false);
      setEditing(null);
      setForm(emptyForm());
      setSnackbar({ open: true, message: 'Consorcio creado', severity: 'success' });
    },
    onError: (e) => {
      setSnackbar({
        open: true,
        message: e.response?.data?.error || 'Error al crear',
        severity: 'error',
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/consorcios/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['consorcios']);
      queryClient.invalidateQueries(['propiedades']);
      setOpen(false);
      setEditing(null);
      setForm(emptyForm());
      setSnackbar({ open: true, message: 'Consorcio actualizado', severity: 'success' });
    },
    onError: (e) => {
      setSnackbar({
        open: true,
        message: e.response?.data?.error || 'Error al actualizar',
        severity: 'error',
      });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/consorcios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['consorcios']);
      queryClient.invalidateQueries(['propiedades']);
      setEliminarId(null);
      setSnackbar({ open: true, message: 'Consorcio eliminado', severity: 'success' });
    },
    onError: (e) => {
      setSnackbar({
        open: true,
        message: e.response?.data?.error || 'Error al eliminar',
        severity: 'error',
      });
    },
  });

  const handleOpenNuevo = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const handleEdit = (row) => {
    setEditing(row);
    setForm({
      nombre: row.nombre || '',
      cuitConsorcio: row.cuitConsorcio || '',
      direccionConsorcio: row.direccionConsorcio || '',
      nombreAdministracion: row.nombreAdministracion || '',
      direccionAdministracion: row.direccionAdministracion || '',
      nombreReferente: row.nombreReferente || '',
      telefonoAdministracion: row.telefonoAdministracion || '',
      mailAdministracion: row.mailAdministracion || '',
      notas: row.notas || '',
    });
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      nombre: form.nombre.trim(),
      cuitConsorcio: form.cuitConsorcio.trim() || null,
      direccionConsorcio: form.direccionConsorcio.trim() || null,
      nombreAdministracion: form.nombreAdministracion.trim() || null,
      direccionAdministracion: form.direccionAdministracion.trim() || null,
      nombreReferente: form.nombreReferente.trim() || null,
      telefonoAdministracion: form.telefonoAdministracion.trim() || null,
      mailAdministracion: form.mailAdministracion.trim() || null,
      notas: form.notas.trim() || null,
    };
    if (editing?.id) {
      updateMut.mutate({ id: editing.id, payload });
    } else {
      createMut.mutate(payload);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' }, m: 0 }}>
          Consorcios
        </Typography>
        <RequirePermission codigo="consorcios.crear">
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNuevo} size="small">
            Nuevo consorcio
          </Button>
        </RequirePermission>
      </Box>

      <TextField
        size="small"
        placeholder="Buscar por nombre, administración o CUIT…"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setPage(0);
        }}
        sx={{ width: { xs: '100%', sm: 360 }, mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell><strong>Nombre</strong></TableCell>
              <TableCell><strong>Administración</strong></TableCell>
              <TableCell><strong>Dirección edificio</strong></TableCell>
              <TableCell><strong>Teléfono</strong></TableCell>
              <TableCell align="right"><strong>Acciones</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>Cargando…</TableCell>
              </TableRow>
            ) : lista.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>No hay consorcios.</TableCell>
              </TableRow>
            ) : (
              lista.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.nombre}</TableCell>
                  <TableCell>{row.nombreAdministracion || '—'}</TableCell>
                  <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.direccionConsorcio || '—'}
                  </TableCell>
                  <TableCell>{row.telefonoAdministracion || '—'}</TableCell>
                  <TableCell align="right">
                    <RequirePermission codigo="consorcios.editar">
                      <IconButton size="small" title="Editar" onClick={() => handleEdit(row)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </RequirePermission>
                    <RequirePermission codigo="consorcios.eliminar">
                      <IconButton size="small" color="error" title="Eliminar" onClick={() => setEliminarId(row.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </RequirePermission>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[10, 25, 50]}
        labelRowsPerPage="Filas:"
      />

      <Dialog open={open} onClose={() => !createMut.isPending && !updateMut.isPending && setOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editing ? 'Editar consorcio' : 'Nuevo consorcio'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField
                  label="Nombre del edificio / consorcio"
                  required
                  fullWidth
                  size="small"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="CUIT consorcio"
                  fullWidth
                  size="small"
                  value={form.cuitConsorcio}
                  onChange={(e) => setForm((f) => ({ ...f, cuitConsorcio: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Dirección del edificio"
                  fullWidth
                  size="small"
                  value={form.direccionConsorcio}
                  onChange={(e) => setForm((f) => ({ ...f, direccionConsorcio: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Nombre administración"
                  fullWidth
                  size="small"
                  value={form.nombreAdministracion}
                  onChange={(e) => setForm((f) => ({ ...f, nombreAdministracion: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Domicilio administración"
                  fullWidth
                  size="small"
                  value={form.direccionAdministracion}
                  onChange={(e) => setForm((f) => ({ ...f, direccionAdministracion: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Referente (nombre y apellido)"
                  fullWidth
                  size="small"
                  value={form.nombreReferente}
                  onChange={(e) => setForm((f) => ({ ...f, nombreReferente: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Teléfono administración"
                  fullWidth
                  size="small"
                  value={form.telefonoAdministracion}
                  onChange={(e) => setForm((f) => ({ ...f, telefonoAdministracion: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Email administración"
                  fullWidth
                  size="small"
                  type="email"
                  value={form.mailAdministracion}
                  onChange={(e) => setForm((f) => ({ ...f, mailAdministracion: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Notas"
                  fullWidth
                  multiline
                  minRows={2}
                  size="small"
                  value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setOpen(false)} disabled={createMut.isPending || updateMut.isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={createMut.isPending || updateMut.isPending}>
              Guardar
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!eliminarId}
        onClose={() => setEliminarId(null)}
        title="Eliminar consorcio"
        message="¿Eliminar este consorcio? Las propiedades vinculadas quedarán sin consorcio asignado."
        confirmLabel="Eliminar"
        confirmColor="error"
        loading={deleteMut.isPending}
        onConfirm={() => eliminarId && deleteMut.mutate(eliminarId)}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
