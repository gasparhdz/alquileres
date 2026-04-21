import { useState, useMemo } from 'react';
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
  Alert,
  Grid,
  Card,
  CardContent,
  Divider,
  Snackbar,
  InputAdornment,
  TablePagination,
  Chip,
  Autocomplete,
  FormControlLabel,
  Switch
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../api';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useDebounce } from '../../hooks/useDebounce';

export default function Usuarios() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    nombreUsuario: '',
    email: '',
    telefono: '',
    password: '',
    activo: true,
    rolIds: []
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [usuarioAEliminar, setUsuarioAEliminar] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const searchDebounced = useDebounce(searchTerm, 400);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.get('/usuarios').then((r) => r.data)
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((r) => r.data)
  });

  const filtered = useMemo(() => {
    if (!searchDebounced.trim()) return usuarios;
    const q = searchDebounced.trim().toLowerCase();
    return usuarios.filter(
      (u) =>
        (u.nombreUsuario && u.nombreUsuario.toLowerCase().includes(q)) ||
        (u.nombre && u.nombre.toLowerCase().includes(q)) ||
        (u.apellido && u.apellido.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q))
    );
  }, [usuarios, searchDebounced]);

  const listaPagina = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);
  const totalRegistros = filtered.length;

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/usuarios', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setOpen(false);
      resetForm();
      setErrorMessage('');
      setSnackbarMessage('Usuario creado correctamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (err) => {
      setErrorMessage(err.response?.data?.error || 'Error al crear el usuario');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/usuarios/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setOpen(false);
      setEditing(null);
      resetForm();
      setErrorMessage('');
      setSnackbarMessage('Usuario actualizado correctamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (err) => {
      setErrorMessage(err.response?.data?.error || 'Error al actualizar el usuario');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/usuarios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setUsuarioAEliminar(null);
      setSnackbarMessage('Usuario desactivado');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (err) => {
      setSnackbarMessage(err.response?.data?.error || 'Error al desactivar');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const resetForm = () => {
    setFormData({
      nombre: '',
      apellido: '',
      nombreUsuario: '',
      email: '',
      telefono: '',
      password: '',
      activo: true,
      rolIds: []
    });
    setErrorMessage('');
  };

  const handleOpen = () => {
    resetForm();
    setEditing(null);
    setOpen(true);
  };

  const handleEdit = (usuario) => {
    setEditing(usuario);
    setFormData({
      nombre: usuario.nombre || '',
      apellido: usuario.apellido || '',
      nombreUsuario: usuario.nombreUsuario || '',
      email: usuario.email || '',
      telefono: usuario.telefono || '',
      password: '',
      activo: usuario.activo !== false,
      rolIds: (usuario.roles || []).map((r) => r.id)
    });
    setErrorMessage('');
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!formData.nombreUsuario?.trim() || !formData.email?.trim()) {
      setErrorMessage('Usuario y email son obligatorios');
      return;
    }
    if (!editing && !formData.password?.trim()) {
      setErrorMessage('La contraseña es obligatoria al crear');
      return;
    }
    if (editing) {
      const body = { ...formData };
      if (!body.password?.trim()) delete body.password;
      updateMutation.mutate({ id: editing.id, data: body });
    } else {
      createMutation.mutate(formData);
    }
  };

  const nombreApellido = (u) => [u.nombre, u.apellido].filter(Boolean).join(' ') || '-';
  const rolesChips = (u) => (u.roles && u.roles.length ? u.roles : []);

  return (
    <Box sx={{ maxWidth: '100%', overflowX: 'hidden' }}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
        Usuarios
      </Typography>

      <ConfirmDialog
        open={!!usuarioAEliminar}
        onClose={() => setUsuarioAEliminar(null)}
        title="Desactivar usuario"
        message="¿Está seguro de desactivar este usuario? No podrá iniciar sesión."
        confirmLabel="Desactivar"
        confirmColor="error"
        loading={deleteMutation.isPending}
        onConfirm={() => usuarioAEliminar && deleteMutation.mutate(usuarioAEliminar.id)}
      />

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          mb: 2,
          gap: 2
        }}
      >
        <TextField
          size="small"
          placeholder="Buscar por usuario, nombre, apellido o email..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(0);
          }}
          sx={{ width: { xs: '100%', sm: 320 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpen}
          sx={{
            height: 36,
            py: 0,
            px: 1.5,
            fontSize: '0.875rem',
            '& .MuiButton-startIcon': { marginRight: 0.5 },
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          Nuevo
        </Button>
      </Box>

      {/* Vista de tabla para desktop */}
      <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table
          size="small"
          sx={{
            '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.875rem' },
            '& .MuiTableCell-head': { py: 0.5, px: 1 },
            '& .MuiTableSortLabel-root': { fontSize: '0.875rem' }
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell>Usuario</TableCell>
              <TableCell>Nombre y Apellido</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Cargando...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : listaPagina.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {searchDebounced.trim() ? 'No se encontraron usuarios con ese criterio.' : 'No hay usuarios cargados.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              listaPagina.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell>{usuario.nombreUsuario}</TableCell>
                  <TableCell>{nombreApellido(usuario)}</TableCell>
                  <TableCell>{usuario.email || '-'}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {rolesChips(usuario).map((r) => (
                        <Chip key={r.id} label={r.codigo} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                      ))}
                      {rolesChips(usuario).length === 0 && '-'}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={usuario.activo ? 'Activo' : 'Inactivo'}
                      size="small"
                      color={usuario.activo ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleEdit(usuario)} sx={{ padding: '4px' }} title="Editar">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setUsuarioAEliminar(usuario)}
                      sx={{ padding: '4px' }}
                      title="Desactivar"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={totalRegistros}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Filas:"
          sx={{
            '& .MuiTablePagination-toolbar': { minHeight: 36 },
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: '0.875rem' },
            '& .MuiTablePagination-select': { fontSize: '0.875rem', py: 0.25 }
          }}
        />
      </TableContainer>

      {/* Vista de cards para mobile */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {isLoading ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
            Cargando...
          </Typography>
        ) : listaPagina.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
            {searchDebounced.trim() ? 'No se encontraron usuarios con ese criterio.' : 'No hay usuarios cargados.'}
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {listaPagina.map((usuario) => (
              <Grid item xs={12} key={usuario.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {usuario.nombreUsuario}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {nombreApellido(usuario)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {usuario.email || '-'}
                        </Typography>
                      </Box>
                      <Box>
                        <IconButton size="small" onClick={() => handleEdit(usuario)} sx={{ mr: 0.5 }} title="Editar">
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setUsuarioAEliminar(usuario)}
                          title="Desactivar"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                      {rolesChips(usuario).map((r) => (
                        <Chip key={r.id} label={r.codigo} size="small" variant="outlined" />
                      ))}
                      <Chip
                        label={usuario.activo ? 'Activo' : 'Inactivo'}
                        size="small"
                        color={usuario.activo ? 'success' : 'default'}
                        sx={{ ml: 'auto' }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
        <TablePagination
          component="div"
          count={totalRegistros}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Filas:"
          sx={{
            '& .MuiTablePagination-toolbar': { minHeight: 36 },
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: '0.875rem' },
            '& .MuiTablePagination-select': { fontSize: '0.875rem', py: 0.25 }
          }}
        />
      </Box>

      <Dialog open={open} onClose={() => { setOpen(false); resetForm(); setEditing(null); }} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit} noValidate>
          <DialogTitle>{editing ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          <DialogContent>
            {(createMutation.isError || updateMutation.isError || errorMessage) && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage('')}>
                {errorMessage ||
                  createMutation.error?.response?.data?.error ||
                  updateMutation.error?.response?.data?.error ||
                  'Error al guardar'}
              </Alert>
            )}
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Nombre"
                    fullWidth
                    size="small"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Apellido"
                    fullWidth
                    size="small"
                    value={formData.apellido}
                    onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Usuario (login) *"
                    fullWidth
                    size="small"
                    value={formData.nombreUsuario}
                    onChange={(e) => setFormData({ ...formData, nombreUsuario: e.target.value })}
                    required
                    disabled={!!editing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Email *"
                    type="email"
                    fullWidth
                    size="small"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={editing ? 'Nueva contraseña (dejar en blanco para no cambiar)' : 'Contraseña *'}
                    type="password"
                    fullWidth
                    size="small"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Teléfono"
                    fullWidth
                    size="small"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    multiple
                    options={roles}
                    getOptionLabel={(r) => (r.descripcion ? `${r.codigo} - ${r.descripcion}` : r.codigo)}
                    value={roles.filter((r) => formData.rolIds.includes(r.id))}
                    onChange={(_, selected) => setFormData((f) => ({ ...f, rolIds: selected.map((s) => s.id) }))}
                    renderInput={(params) => <TextField {...params} label="Roles" size="small" />}
                  />
                </Grid>
                {editing && (
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.activo}
                          onChange={(e) => setFormData((f) => ({ ...f, activo: e.target.checked }))}
                        />
                      }
                      label="Activo"
                    />
                  </Grid>
                )}
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => { setOpen(false); resetForm(); setEditing(null); }}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
