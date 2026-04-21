import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Tab,
  Tabs,
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
  Switch,
  Checkbox
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import SecurityIcon from '@mui/icons-material/Security';
import api from '../../api';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useDebounce } from '../../hooks/useDebounce';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`usuarios-tabpanel-${index}`} aria-labelledby={`usuarios-tab-${index}`} {...other}>
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

const tableSx = {
  '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.875rem' },
  '& .MuiTableCell-head': { py: 0.5, px: 1 },
  '& .MuiTableSortLabel-root': { fontSize: '0.875rem' }
};
const paginationSx = {
  '& .MuiTablePagination-toolbar': { minHeight: 36 },
  '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: '0.875rem' },
  '& .MuiTablePagination-select': { fontSize: '0.875rem', py: 0.25 }
};
const barSx = {
  display: 'flex',
  flexDirection: { xs: 'column', sm: 'row' },
  justifyContent: 'space-between',
  alignItems: { xs: 'stretch', sm: 'center' },
  mb: 2,
  gap: 2
};
const buttonNuevoSx = {
  height: 36,
  py: 0,
  px: 1.5,
  fontSize: '0.875rem',
  '& .MuiButton-startIcon': { marginRight: 0.5 },
  width: { xs: '100%', sm: 'auto' }
};

// --- Tab Usuarios ---
function TabUsuarios() {
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
    onError: (err) => setErrorMessage(err.response?.data?.error || 'Error al crear el usuario')
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
    onError: (err) => setErrorMessage(err.response?.data?.error || 'Error al actualizar el usuario')
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
  const handleOpen = () => { resetForm(); setEditing(null); setOpen(true); };
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
    <Box>
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
      <Box sx={barSx}>
        <TextField
          size="small"
          placeholder="Buscar por usuario, nombre, apellido o email..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
          sx={{ width: { xs: '100%', sm: 320 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen} sx={buttonNuevoSx}>
          Nuevo Usuario
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table size="small" sx={tableSx}>
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
                  <Typography variant="body2" color="text.secondary">Cargando...</Typography>
                </TableCell>
              </TableRow>
            ) : listaPagina.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {searchDebounced.trim() ? 'No se encontraron usuarios.' : 'No hay usuarios cargados.'}
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
                    <Chip label={usuario.activo ? 'Activo' : 'Inactivo'} size="small" color={usuario.activo ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleEdit(usuario)} sx={{ padding: '4px' }} title="Editar">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => setUsuarioAEliminar(usuario)} sx={{ padding: '4px' }} title="Desactivar">
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
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Filas:"
          sx={paginationSx}
        />
      </TableContainer>

      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {isLoading ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>Cargando...</Typography>
        ) : listaPagina.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
            {searchDebounced.trim() ? 'No se encontraron usuarios.' : 'No hay usuarios cargados.'}
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {listaPagina.map((usuario) => (
              <Grid item xs={12} key={usuario.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>{usuario.nombreUsuario}</Typography>
                        <Typography variant="body2" color="text.secondary">{nombreApellido(usuario)}</Typography>
                        <Typography variant="body2" color="text.secondary">{usuario.email || '-'}</Typography>
                      </Box>
                      <Box>
                        <IconButton size="small" onClick={() => handleEdit(usuario)} sx={{ mr: 0.5 }} title="Editar"><EditIcon /></IconButton>
                        <IconButton size="small" color="error" onClick={() => setUsuarioAEliminar(usuario)} title="Desactivar"><DeleteIcon /></IconButton>
                      </Box>
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                      {rolesChips(usuario).map((r) => (
                        <Chip key={r.id} label={r.codigo} size="small" variant="outlined" />
                      ))}
                      <Chip label={usuario.activo ? 'Activo' : 'Inactivo'} size="small" color={usuario.activo ? 'success' : 'default'} sx={{ ml: 'auto' }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
        <TablePagination component="div" count={totalRegistros} page={page} onPageChange={(_, newPage) => setPage(newPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} rowsPerPageOptions={[5, 10, 25, 50]} labelRowsPerPage="Filas:" sx={paginationSx} />
      </Box>

      <Dialog open={open} onClose={() => { setOpen(false); resetForm(); setEditing(null); }} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit} noValidate>
          <DialogTitle>{editing ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          <DialogContent>
            {(createMutation.isError || updateMutation.isError || errorMessage) && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage('')}>
                {errorMessage || createMutation.error?.response?.data?.error || updateMutation.error?.response?.data?.error || 'Error al guardar'}
              </Alert>
            )}
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField label="Nombre" fullWidth size="small" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Apellido" fullWidth size="small" value={formData.apellido} onChange={(e) => setFormData({ ...formData, apellido: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Usuario (login) *" fullWidth size="small" value={formData.nombreUsuario} onChange={(e) => setFormData({ ...formData, nombreUsuario: e.target.value })} required disabled={!!editing} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Email *" type="email" fullWidth size="small" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label={editing ? 'Nueva contraseña (dejar en blanco para no cambiar)' : 'Contraseña *'} type="password" fullWidth size="small" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required={!editing} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Teléfono" fullWidth size="small" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    options={roles.filter((r) => !formData.rolIds.includes(r.id))}
                    getOptionLabel={(r) => (r.descripcion ? `${r.codigo} - ${r.descripcion}` : r.codigo)}
                    value={null}
                    onChange={(_, option) => {
                      if (option) setFormData((f) => ({ ...f, rolIds: [...f.rolIds, option.id] }));
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="Agregar rol" size="small" placeholder="Seleccionar rol..." />
                    )}
                  />
                  {formData.rolIds.length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Roles asignados</Typography>
                      <Box component="ul" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, listStyle: 'none', m: 0, p: 0 }}>
                        {roles.filter((r) => formData.rolIds.includes(r.id)).map((r) => (
                          <Chip
                            key={r.id}
                            label={r.descripcion ? `${r.codigo} - ${r.descripcion}` : r.codigo}
                            size="small"
                            onDelete={() => setFormData((f) => ({ ...f, rolIds: f.rolIds.filter((id) => id !== r.id) }))}
                            sx={{ mt: 0 }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Grid>
                {editing && (
                  <Grid item xs={12}>
                    <FormControlLabel control={<Switch checked={formData.activo} onChange={(e) => setFormData((f) => ({ ...f, activo: e.target.checked }))} />} label="Activo" />
                  </Grid>
                )}
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => { setOpen(false); resetForm(); setEditing(null); }}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending || updateMutation.isPending}>{editing ? 'Guardar' : 'Crear'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>{snackbarMessage}</Alert>
      </Snackbar>
    </Box>
  );
}

// --- Tab Roles ---
function TabRoles() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ codigo: '', descripcion: '', activo: true, permisoIds: [] });
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [rolAEliminar, setRolAEliminar] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const searchDebounced = useDebounce(searchTerm, 400);

  const { data: rolesList = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((r) => r.data)
  });
  const { data: permisos = [] } = useQuery({
    queryKey: ['permisos'],
    queryFn: () => api.get('/permisos').then((r) => r.data)
  });

  const filtered = useMemo(() => {
    if (!searchDebounced.trim()) return rolesList;
    const q = searchDebounced.trim().toLowerCase();
    return rolesList.filter(
      (r) =>
        (r.codigo && r.codigo.toLowerCase().includes(q)) ||
        (r.descripcion && r.descripcion.toLowerCase().includes(q))
    );
  }, [rolesList, searchDebounced]);
  const listaPagina = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);
  const totalRegistros = filtered.length;

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/roles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setOpen(false);
      resetForm();
      setErrorMessage('');
      setSnackbarMessage('Rol creado correctamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (err) => setErrorMessage(err.response?.data?.error || 'Error al crear rol')
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/roles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setOpen(false);
      setEditing(null);
      resetForm();
      setErrorMessage('');
      setSnackbarMessage('Rol actualizado correctamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (err) => setErrorMessage(err.response?.data?.error || 'Error al actualizar rol')
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setRolAEliminar(null);
      setSnackbarMessage('Rol desactivado');
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
    setFormData({ codigo: '', descripcion: '', activo: true, permisoIds: [] });
    setErrorMessage('');
  };
  const handleOpen = () => { resetForm(); setEditing(null); setOpen(true); };
  const handleEdit = (rol) => {
    setEditing(rol);
    setFormData({
      codigo: rol.codigo || '',
      descripcion: rol.descripcion || '',
      activo: rol.activo !== false,
      permisoIds: (rol.permisos || []).map((p) => p.id)
    });
    setErrorMessage('');
    setOpen(true);
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!formData.codigo?.trim()) {
      setErrorMessage('El código es requerido');
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const ORDEN_ACCIONES = ['ver', 'crear', 'editar', 'eliminar', 'generar', 'emitir', 'asignar'];
  const { modulos, acciones, permisoByKey } = useMemo(() => {
    const byKey = {};
    const modulosSet = new Set();
    const accionesSet = new Set();
    (permisos || []).forEach((p) => {
      if (!p.codigo) return;
      const parts = p.codigo.split('.');
      if (parts.length < 2) return;
      const accion = parts.pop();
      const modulo = parts.join('.');
      byKey[`${modulo}|${accion}`] = p.id;
      modulosSet.add(modulo);
      accionesSet.add(accion);
    });
    const modulos = [...modulosSet].sort();
    const acciones = [...ORDEN_ACCIONES.filter((a) => accionesSet.has(a)), ...[...accionesSet].filter((a) => !ORDEN_ACCIONES.includes(a)).sort()];
    return { modulos, acciones, permisoByKey: byKey };
  }, [permisos]);

  const togglePermiso = (modulo, accion) => {
    const id = permisoByKey[`${modulo}|${accion}`];
    if (!id) return;
    setFormData((f) => ({
      ...f,
      permisoIds: f.permisoIds.includes(id) ? f.permisoIds.filter((i) => i !== id) : [...f.permisoIds, id]
    }));
  };

  return (
    <Box>
      <ConfirmDialog
        open={!!rolAEliminar}
        onClose={() => setRolAEliminar(null)}
        title="Desactivar rol"
        message="¿Está seguro de desactivar este rol?"
        confirmLabel="Desactivar"
        confirmColor="error"
        loading={deleteMutation.isPending}
        onConfirm={() => rolAEliminar && deleteMutation.mutate(rolAEliminar.id)}
      />
      <Box sx={barSx}>
        <TextField
          size="small"
          placeholder="Buscar por código o descripción..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
          sx={{ width: { xs: '100%', sm: 320 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen} sx={buttonNuevoSx}>
          Nuevo Rol
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table size="small" sx={tableSx}>
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Descripción</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">Cargando...</Typography>
                </TableCell>
              </TableRow>
            ) : listaPagina.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {searchDebounced.trim() ? 'No se encontraron roles.' : 'No hay roles cargados.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              listaPagina.map((rol) => (
                <TableRow key={rol.id}>
                  <TableCell>{rol.codigo}</TableCell>
                  <TableCell>{rol.descripcion || '-'}</TableCell>
                  <TableCell>
                    <Chip label={rol.activo ? 'Activo' : 'Inactivo'} size="small" color={rol.activo ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleEdit(rol)} sx={{ padding: '4px' }} title="Editar">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => setRolAEliminar(rol)} sx={{ padding: '4px' }} title="Desactivar">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination component="div" count={totalRegistros} page={page} onPageChange={(_, newPage) => setPage(newPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} rowsPerPageOptions={[5, 10, 25, 50]} labelRowsPerPage="Filas:" sx={paginationSx} />
      </TableContainer>

      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {isLoading ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>Cargando...</Typography>
        ) : listaPagina.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
            {searchDebounced.trim() ? 'No se encontraron roles.' : 'No hay roles cargados.'}
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {listaPagina.map((rol) => (
              <Grid item xs={12} key={rol.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>{rol.codigo}</Typography>
                        <Typography variant="body2" color="text.secondary">{rol.descripcion || '-'}</Typography>
                      </Box>
                      <Box>
                        <IconButton size="small" onClick={() => handleEdit(rol)} sx={{ mr: 0.5 }} title="Editar"><EditIcon /></IconButton>
                        <IconButton size="small" color="error" onClick={() => setRolAEliminar(rol)} title="Desactivar"><DeleteIcon /></IconButton>
                      </Box>
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                    <Chip label={rol.activo ? 'Activo' : 'Inactivo'} size="small" color={rol.activo ? 'success' : 'default'} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
        <TablePagination component="div" count={totalRegistros} page={page} onPageChange={(_, newPage) => setPage(newPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} rowsPerPageOptions={[5, 10, 25, 50]} labelRowsPerPage="Filas:" sx={paginationSx} />
      </Box>

      <Dialog open={open} onClose={() => { setOpen(false); resetForm(); setEditing(null); }} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit} noValidate>
          <DialogTitle>{editing ? 'Editar rol' : 'Nuevo rol'}</DialogTitle>
          <DialogContent>
            {errorMessage && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage('')}>{errorMessage}</Alert>
            )}
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField label="Código *" fullWidth size="small" value={formData.codigo} onChange={(e) => setFormData({ ...formData, codigo: e.target.value })} required disabled={!!editing} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Descripción" fullWidth size="small" value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Permisos</Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320, overflow: 'auto' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, minWidth: 140 }}>Módulo</TableCell>
                          {acciones.map((accion) => (
                            <TableCell key={accion} align="center" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>{accion}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {modulos.map((modulo) => (
                          <TableRow key={modulo}>
                            <TableCell sx={{ textTransform: 'capitalize' }}>{modulo.replace(/\./g, ' · ')}</TableCell>
                            {acciones.map((accion) => {
                              const id = permisoByKey[`${modulo}|${accion}`];
                              const checked = id && formData.permisoIds.includes(id);
                              return (
                                <TableCell key={accion} align="center" padding="checkbox">
                                  {id != null ? (
                                    <Checkbox
                                      checked={!!checked}
                                      onChange={() => togglePermiso(modulo, accion)}
                                      size="small"
                                    />
                                  ) : (
                                    <span style={{ color: 'var(--mui-palette-text-disabled)' }}>—</span>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
                {editing && (
                  <Grid item xs={12}>
                    <FormControlLabel control={<Switch checked={formData.activo} onChange={(e) => setFormData((f) => ({ ...f, activo: e.target.checked }))} />} label="Activo" />
                  </Grid>
                )}
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => { setOpen(false); resetForm(); setEditing(null); }}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending || updateMutation.isPending}>{editing ? 'Guardar' : 'Crear'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>{snackbarMessage}</Alert>
      </Snackbar>
    </Box>
  );
}

// --- Página principal ---
export default function UsuariosRoles() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [tabValue, setTabValue] = useState(() => {
    const v = tabFromUrl ? parseInt(tabFromUrl, 10) : 0;
    return (v === 0 || v === 1) ? v : 0;
  });

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    searchParams.set('tab', String(newValue));
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <Box sx={{ maxWidth: '100%', overflowX: 'hidden' }}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
        Usuarios, Roles y Permisos
      </Typography>

      <Paper sx={{ mb: { xs: 2, md: 3 } }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="tabs usuarios roles permisos" variant="fullWidth">
          <Tab
            label={
              <Box display="flex" alignItems="center" gap={0.5} sx={{ flexWrap: 'nowrap' }}>
                <PersonIcon fontSize="small" />
                <Typography variant="body2" component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Usuarios</Typography>
                <Typography variant="body2" component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Usuarios</Typography>
              </Box>
            }
            id="usuarios-tab-0"
            aria-controls="usuarios-tabpanel-0"
            sx={{ minHeight: { xs: 48, md: 64 }, px: { xs: 1, md: 2 } }}
          />
          <Tab
            label={
              <Box display="flex" alignItems="center" gap={0.5} sx={{ flexWrap: 'nowrap' }}>
                <SecurityIcon fontSize="small" />
                <Typography variant="body2" component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Roles</Typography>
                <Typography variant="body2" component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Roles</Typography>
              </Box>
            }
            id="usuarios-tab-1"
            aria-controls="usuarios-tabpanel-1"
            sx={{ minHeight: { xs: 48, md: 64 }, px: { xs: 1, md: 2 } }}
          />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <TabUsuarios />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <TabRoles />
      </TabPanel>
    </Box>
  );
}
