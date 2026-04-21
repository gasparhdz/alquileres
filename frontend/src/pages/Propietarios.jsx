import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormHelperText,
  InputAdornment,
  TableSortLabel,
  TablePagination
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import BadgeIcon from '@mui/icons-material/Badge';
import HomeIcon from '@mui/icons-material/Home';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import api from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import ClientePerfilDialog from '../components/ClientePerfilDialog';
import RequirePermission from '../components/RequirePermission';
import { isValidCuit } from '../utils/cuit';
import { sanitizeTelefonoInput, validateTelefonoCliente, formatWhatsAppNumber } from '../utils/telefono';
import { formatApellidoNombrePF } from '../utils/formatClienteNombre';
import { useDebounce } from '../hooks/useDebounce';
import DomicilioClienteFormSection from '../components/DomicilioClienteFormSection';

export default function Propietarios({ triggerReabrirDialogo, onDialogoReabierto, abrirPerfilId, onPerfilAbierto }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // Abrir diálogo automáticamente si viene el parámetro openDialog
  useEffect(() => {
    if (searchParams.get('openDialog') === 'true') {
      setOpen(true);
    }
  }, [searchParams]);
  const [formData, setFormData] = useState({
    tipoPersonaId: '',
    nombre: '',
    apellido: '',
    razonSocial: '',
    dni: '',
    cuit: '',
    mail: '',
    telefono: '',
    dirCalle: '',
    dirNro: '',
    dirPiso: '',
    dirDepto: '',
    provinciaId: '',
    localidadId: '',
    paisCodigo: 'AR',
    provinciaExtranjera: '',
    localidadExtranjera: '',
    condicionIvaId: ''
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [propietarioAEliminar, setPropietarioAEliminar] = useState(null);
  const [propiedadADesasociar, setPropiedadADesasociar] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderBy, setOrderBy] = useState('nombre');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [perfilCliente, setPerfilCliente] = useState(null);
  const queryClient = useQueryClient();
  const searchDebounced = useDebounce(searchTerm, 400);

  const handleVerPerfil = (propietario) => {
    setPerfilCliente(propietario);
    setPerfilOpen(true);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['propietarios', { page: page + 1, limit: rowsPerPage, search: searchDebounced, orderBy, order }],
    queryFn: async () => {
      const resp = await api.get('/propietarios', {
        params: {
          page: page + 1,
          limit: rowsPerPage,
          search: searchDebounced.trim() || undefined,
          orderBy,
          order,
        },
      });
      return resp.data;
    },
  });

  const listaPagina = data?.data ?? [];
  const totalRegistros = data?.pagination?.total ?? 0;

  // Abrir perfil desde búsqueda global (por ID; el diálogo carga el cliente por id)
  useEffect(() => {
    if (abrirPerfilId) {
      setPerfilCliente({ id: abrirPerfilId });
      setPerfilOpen(true);
      onPerfilAbierto?.();
    }
  }, [abrirPerfilId, onPerfilAbierto]);

  const handleSort = (column) => {
    const isAsc = orderBy === column && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(column);
    setPage(0);
  };
  
  // Estado para propiedades asociadas
  const [propiedadesAsociadas, setPropiedadesAsociadas] = useState([]);
  const [propiedadSeleccionada, setPropiedadSeleccionada] = useState('');

  // Obtener catálogos
  const { data: tiposPersona } = useQuery({
    queryKey: ['tiposPersona'],
    queryFn: async () => {
      const response = await api.get('/catalogos/tipos-persona');
      return response.data;
    }
  });

  const { data: provincias } = useQuery({
    queryKey: ['provincias'],
    queryFn: async () => {
      const response = await api.get('/catalogos/provincias');
      return response.data;
    }
  });

  const { data: localidades } = useQuery({
    queryKey: ['localidades', formData.provinciaId],
    queryFn: async () => {
      if (!formData.provinciaId) return [];
      const response = await api.get(`/catalogos/provincias/${formData.provinciaId}/localidades`);
      return response.data;
    },
    enabled: !!formData.provinciaId
  });

  const { data: condicionesIva } = useQuery({
    queryKey: ['condicionesIva'],
    queryFn: async () => {
      const response = await api.get('/catalogos/condiciones-iva');
      return response.data;
    }
  });

  // Obtener propiedades para el selector
  const { data: propiedadesData } = useQuery({
    queryKey: ['propiedades'],
    queryFn: async () => {
      const response = await api.get('/propiedades?limit=1000');
      return response.data?.data || [];
    }
  });
  const propiedades = propiedadesData || [];


  // Preseleccionar Persona Física por defecto
  useEffect(() => {
    if (tiposPersona && tiposPersona.length > 0 && !formData.tipoPersonaId && !editing) {
      const personaFisica = tiposPersona.find(tp => tp.codigo === 'FISICA');
      if (personaFisica) {
        setFormData(prev => ({ ...prev, tipoPersonaId: personaFisica.id.toString() }));
      }
    }
  }, [tiposPersona]);

  // Ref para trackear el último trigger procesado
  const ultimoTriggerProcesado = useRef(0);

  // Reabrir diálogo cuando el componente padre (Clientes) detecta retorno desde Propiedades
  useEffect(() => {
    if (triggerReabrirDialogo && triggerReabrirDialogo !== ultimoTriggerProcesado.current) {
      ultimoTriggerProcesado.current = triggerReabrirDialogo;
      
      const propietarioEnEdicionStr = sessionStorage.getItem('propietarioEnEdicion');
      const propietarioIdParaAsociar = sessionStorage.getItem('propietarioIdParaAsociar');
      
      if (propietarioEnEdicionStr && propietarioIdParaAsociar) {
        try {
          const propietarioEnEdicion = JSON.parse(propietarioEnEdicionStr);
          // Cargar el propietario completo desde el backend para tener todos los datos actualizados
          const cargarYEditar = async () => {
            try {
              const response = await api.get(`/propietarios/${propietarioEnEdicion.id}`);
              const propietarioCompleto = response.data;
              setEditing(propietarioCompleto);
              setFormData({
                tipoPersonaId: propietarioCompleto.tipoPersonaId || '',
                nombre: propietarioCompleto.nombre || '',
                apellido: propietarioCompleto.apellido || '',
                razonSocial: propietarioCompleto.razonSocial || '',
                dni: propietarioCompleto.dni || '',
                cuit: propietarioCompleto.cuit || '',
                mail: propietarioCompleto.mail || '',
                telefono: propietarioCompleto.telefono || '',
                dirCalle: propietarioCompleto.dirCalle || '',
                dirNro: propietarioCompleto.dirNro || '',
                dirPiso: propietarioCompleto.dirPiso || '',
                dirDepto: propietarioCompleto.dirDepto || '',
                provinciaId: propietarioCompleto.provinciaId || '',
                localidadId: propietarioCompleto.localidadId || '',
                condicionIvaId: propietarioCompleto.condicionIvaId || ''
              });
              
              // Cargar propiedades asociadas
              const propiedadesAsoc = propietarioCompleto.propiedades?.map(p => p.propiedad).filter(Boolean) || [];
              setPropiedadesAsociadas(propiedadesAsoc);
              
              setOpen(true);
              
              // Mostrar mensaje de éxito si se creó una propiedad exitosamente
              const propiedadCreadaExitosamente = sessionStorage.getItem('propiedadCreadaExitosamente');
              if (propiedadCreadaExitosamente === 'true') {
                setSuccessMessage('Propiedad creada y asociada exitosamente');
                setSnackbarSeverity('success');
                setSnackbarOpen(true);
                sessionStorage.removeItem('propiedadCreadaExitosamente');
              }
              
              // Notificar al padre que se procesó
              onDialogoReabierto?.();
            } catch (error) {
              console.error('Error al cargar propietario:', error);
              sessionStorage.removeItem('propietarioEnEdicion');
              sessionStorage.removeItem('propietarioIdParaAsociar');
            }
          };
          cargarYEditar();
        } catch (error) {
          console.error('Error al parsear propietario en edición:', error);
          sessionStorage.removeItem('propietarioEnEdicion');
          sessionStorage.removeItem('propietarioIdParaAsociar');
        }
      }
    }
  }, [triggerReabrirDialogo, onDialogoReabierto]);

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/propietarios', data),
    onSuccess: async (response) => {
      const nuevoPropietario = response.data;
      queryClient.invalidateQueries({ queryKey: ['propietarios'] });
      queryClient.refetchQueries({ queryKey: ['propietarios'] });
      // Cargar el propietario recién creado para poder asociar propiedades
      try {
        const propietarioCompleto = await api.get(`/propietarios/${nuevoPropietario.id}`);
        setEditing(propietarioCompleto.data);
        setFormData({
          tipoPersonaId: propietarioCompleto.data.tipoPersonaId || '',
          nombre: propietarioCompleto.data.nombre || '',
          apellido: propietarioCompleto.data.apellido || '',
          razonSocial: propietarioCompleto.data.razonSocial || '',
          dni: propietarioCompleto.data.dni || '',
          cuit: propietarioCompleto.data.cuit || '',
          mail: propietarioCompleto.data.mail || '',
          telefono: propietarioCompleto.data.telefono || '',
          dirCalle: propietarioCompleto.data.dirCalle || '',
          dirNro: propietarioCompleto.data.dirNro || '',
          dirPiso: propietarioCompleto.data.dirPiso || '',
          dirDepto: propietarioCompleto.data.dirDepto || '',
          provinciaId: propietarioCompleto.data.provinciaId || '',
          localidadId: propietarioCompleto.data.localidadId || '',
          condicionIvaId: propietarioCompleto.data.condicionIvaId || ''
        });
        const propiedadesAsoc = propietarioCompleto.data.propiedades?.map(p => p.propiedad).filter(Boolean) || [];
        setPropiedadesAsociadas(propiedadesAsoc);
        
        // Si viene de Propiedades, volver allí después de crear
        const propiedadIdParaAsociar = sessionStorage.getItem('propiedadIdParaAsociar');
        const propiedadNuevaParaAsociar = sessionStorage.getItem('propiedadNuevaParaAsociar');
        
        if (propiedadIdParaAsociar || propiedadNuevaParaAsociar) {
          // Guardar el propietario recién creado para preseleccionarlo en Propiedades
          sessionStorage.setItem('propietarioIdParaAsociar', nuevoPropietario.id.toString());
          sessionStorage.setItem('propietarioEnEdicion', JSON.stringify(propietarioCompleto.data));
          setOpen(false);
          resetForm();
          navigate('/propiedades?openDialog=true');
        } else {
          // Mantener el diálogo abierto para poder asociar propiedades
          setSuccessMessage('Propietario creado exitosamente. Ahora puede asociar propiedades.');
          setSnackbarSeverity('success');
          setSnackbarOpen(true);
        }
      } catch (error) {
        console.error('Error al cargar propietario recién creado:', error);
        setOpen(false);
        resetForm();
        setSuccessMessage('Propietario creado exitosamente');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
      }
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al crear el propietario');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/propietarios/${id}`, data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['propietarios'] });
      queryClient.refetchQueries({ queryKey: ['propietarios'] });
      
      // Si viene de Propiedades, volver allí después de actualizar
      const propiedadIdParaAsociar = sessionStorage.getItem('propiedadIdParaAsociar');
      if (propiedadIdParaAsociar && editing) {
        // Guardar el propietario actualizado para preseleccionarlo en Propiedades
        sessionStorage.setItem('propietarioIdParaAsociar', editing.id.toString());
        try {
          const propietarioCompleto = await api.get(`/propietarios/${editing.id}`);
          sessionStorage.setItem('propietarioEnEdicion', JSON.stringify(propietarioCompleto.data));
        } catch (error) {
          console.error('Error al cargar propietario actualizado:', error);
        }
        setOpen(false);
        resetForm();
        setPropiedadesAsociadas([]);
        navigate('/propiedades?openDialog=true');
      } else {
        // Cerrar el diálogo normalmente
        setOpen(false);
        resetForm();
        setPropiedadesAsociadas([]);
        setSuccessMessage('Propietario actualizado exitosamente');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
      }
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al actualizar el propietario');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  // Mutation para asociar propiedades
  const asociarPropiedadesMutation = useMutation({
    mutationFn: ({ propietarioId, propiedadIds }) => 
      api.post(`/propietarios/${propietarioId}/propiedades`, { propiedadIds }),
    onSuccess: (response) => {
      const propietario = response.data;
      setPropiedadesAsociadas(propietario.propiedades?.map(p => p.propiedad) || []);
      queryClient.invalidateQueries({ queryKey: ['propietarios'] });
      queryClient.invalidateQueries({ queryKey: ['propiedades'] });
      setPropiedadSeleccionada('');
      setSuccessMessage('Propiedades asociadas exitosamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error?.response?.data?.error || 'Error al asociar propiedades');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  // Mutation para desasociar propiedad
  const desasociarPropiedadMutation = useMutation({
    mutationFn: ({ propietarioId, propiedadId }) => 
      api.delete(`/propietarios/${propietarioId}/propiedades/${propiedadId}`),
    onSuccess: (data, variables) => {
      setPropiedadADesasociar(null);
      setPropiedadesAsociadas(prev => 
        prev.filter(p => p.id !== variables.propiedadId)
      );
      queryClient.invalidateQueries({ queryKey: ['propietarios'] });
      queryClient.invalidateQueries({ queryKey: ['propiedades'] });
      setSuccessMessage('Propiedad desasociada exitosamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error?.response?.data?.error || 'Error al desasociar propiedad');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });


  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/propietarios/${id}`),
    onSuccess: () => {
      setPropietarioAEliminar(null);
      queryClient.invalidateQueries({ queryKey: ['propietarios'] });
      queryClient.refetchQueries({ queryKey: ['propietarios'] });
      setSuccessMessage('Propietario eliminado exitosamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al eliminar el propietario');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const resetForm = () => {
    const personaFisica = tiposPersona?.find(tp => tp.codigo === 'FISICA');
    setFormData({
      tipoPersonaId: personaFisica?.id.toString() || '',
      nombre: '',
      apellido: '',
      razonSocial: '',
      dni: '',
      cuit: '',
      mail: '',
      telefono: '',
      dirCalle: '',
      dirNro: '',
      dirPiso: '',
      dirDepto: '',
      provinciaId: '',
      localidadId: '',
      paisCodigo: 'AR',
      provinciaExtranjera: '',
      localidadExtranjera: '',
      condicionIvaId: ''
    });
    setErrors({});
    setEditing(null);
    setPropiedadesAsociadas([]);
    setPropiedadSeleccionada('');
  };

  const checkDniCuitExists = async (dni, cuit) => {
    try {
      const response = await api.get('/clientes/check-documento', {
        params: {
          dni: dni || undefined,
          cuit: cuit || undefined,
          ignorarId: editing?.id || undefined,
        },
      });
      const { exists, field } = response.data || {};
      if (exists && field) {
        const message =
          field === 'dni'
            ? 'Este DNI ya está registrado en el sistema'
            : 'Este CUIT ya está registrado en el sistema';
        return { field, message };
      }
      return null;
    } catch (error) {
      console.error('Error al verificar DNI/CUIT:', error);
      return null;
    }
  };

  const validateForm = async () => {
    const newErrors = {};

    // Validar tipo de persona
    if (!formData.tipoPersonaId) {
      newErrors.tipoPersonaId = 'El tipo de persona es obligatorio';
    }

    const tipoPersona = tiposPersona?.find(tp => tp.id === parseInt(formData.tipoPersonaId));
    const personaFisicaId = tiposPersona?.find(tp => tp.codigo === 'FISICA')?.id;
    const esFisica = personaFisicaId != null && tipoPersona?.id === personaFisicaId;

    // Validar campos según tipo de persona
    if (esFisica) {
      if (!formData.nombre || formData.nombre.trim() === '') {
        newErrors.nombre = 'El nombre es obligatorio para persona física';
      }
    } else {
      if (!formData.razonSocial || formData.razonSocial.trim() === '') {
        newErrors.razonSocial = 'La razón social es obligatoria para persona jurídica';
      }
    }

    // Validar DNI o CUIT obligatorio (al menos uno)
    const dniSinGuiones = formData.dni?.replace(/\D/g, '') || '';
    const cuitSinGuiones = formData.cuit?.replace(/\D/g, '') || '';

    if (!dniSinGuiones && !cuitSinGuiones) {
      newErrors.dniCuit = 'Debe ingresar DNI o CUIT';
    }

    // Validar formato DNI (si se ingresa, debe tener 7 u 8 dígitos)
    if (dniSinGuiones && (dniSinGuiones.length < 7 || dniSinGuiones.length > 8)) {
      newErrors.dni = 'El DNI debe tener entre 7 y 8 dígitos';
    }

    // Validar formato y dígito verificador CUIT (si se ingresa)
    if (cuitSinGuiones) {
      if (cuitSinGuiones.length !== 11) {
        newErrors.cuit = 'El CUIT debe tener 11 dígitos (formato: XX-XXXXXXXX-X)';
      } else if (!isValidCuit(cuitSinGuiones)) {
        newErrors.cuit = 'CUIT/CUIL inválido';
      }
    }

    // Validar formato email (si se ingresa)
    if (formData.mail && formData.mail.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.mail)) {
        newErrors.mail = 'Formato de email inválido';
      }
    }

    const telefonoErr = validateTelefonoCliente(formData.telefono);
    if (telefonoErr) newErrors.telefono = telefonoErr;

    if (formData.paisCodigo && formData.paisCodigo !== 'AR') {
      const pc = String(formData.paisCodigo).trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(pc)) {
        newErrors.paisCodigo = 'Seleccione un país';
      }
      if (!formData.localidadExtranjera || !formData.localidadExtranjera.trim()) {
        newErrors.localidadExtranjera = 'Indique ciudad o localidad';
      }
    }

    // Si hay errores de formato, mostrar esos primero
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    // Verificar si DNI o CUIT ya existen en el sistema
    const duplicado = await checkDniCuitExists(
      dniSinGuiones || null,
      cuitSinGuiones || null
    );

    if (duplicado) {
      newErrors[duplicado.field] = duplicado.message;
      setErrors(newErrors);
      return false;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleOpen = () => {
    resetForm();
    setOpen(true);
  };

  const handleEdit = async (propietario) => {
    setEditing(propietario);
    setFormData({
      tipoPersonaId: propietario.tipoPersonaId || '',
      nombre: propietario.nombre || '',
      apellido: propietario.apellido || '',
      razonSocial: propietario.razonSocial || '',
      dni: propietario.dni || '',
      cuit: propietario.cuit || '',
      mail: propietario.mail || '',
      telefono: propietario.telefono || '',
      dirCalle: propietario.dirCalle || '',
      dirNro: propietario.dirNro || '',
      dirPiso: propietario.dirPiso || '',
      dirDepto: propietario.dirDepto || '',
      provinciaId: propietario.provinciaId || '',
      localidadId: propietario.localidadId || '',
      paisCodigo: propietario.paisCodigo || 'AR',
      provinciaExtranjera: propietario.provinciaExtranjera || '',
      localidadExtranjera: propietario.localidadExtranjera || '',
      condicionIvaId: propietario.condicionIvaId || ''
    });
    
    // Cargar propiedades asociadas
    try {
      const response = await api.get(`/propietarios/${propietario.id}`);
      const propietarioCompleto = response.data;
      // Las propiedades vienen en propietarioCompleto.propiedades como array de PropiedadPropietario
      // Cada elemento tiene una propiedad 'propiedad' con los datos de la propiedad
      const propiedadesAsoc = propietarioCompleto.propiedades?.map(p => p.propiedad).filter(Boolean) || [];
      setPropiedadesAsociadas(propiedadesAsoc);
    } catch (error) {
      console.error('Error al cargar propiedades asociadas:', error);
      setPropiedadesAsociadas([]);
    }
    
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar formulario antes de enviar
    const isValid = await validateForm();
    if (!isValid) {
      return;
    }

    // Preparar datos para enviar (convertir strings vacíos a null y IDs a números)
    const dataToSend = {
      tipoPersonaId: formData.tipoPersonaId ? parseInt(formData.tipoPersonaId) : null,
      nombre: formData.nombre?.trim() || null,
      apellido: formData.apellido?.trim() || null,
      razonSocial: formData.razonSocial?.trim() || null,
      dni: formData.dni?.trim() || null,
      cuit: formData.cuit?.trim() || null,
      mail: formData.mail?.trim() || null,
      telefono: formData.telefono?.trim() || null,
      dirCalle: formData.dirCalle?.trim() || null,
      dirNro: formData.dirNro?.trim() || null,
      dirPiso: formData.dirPiso?.trim() || null,
      dirDepto: formData.dirDepto?.trim() || null,
      provinciaId: formData.provinciaId ? parseInt(formData.provinciaId) : null,
      localidadId: formData.localidadId ? parseInt(formData.localidadId) : null,
      domicilioExtranjero: !!(formData.paisCodigo && formData.paisCodigo !== 'AR'),
      paisCodigo: formData.paisCodigo?.trim() || null,
      provinciaExtranjera: formData.provinciaExtranjera?.trim() || null,
      localidadExtranjera: formData.localidadExtranjera?.trim() || null,
      condicionIvaId: formData.condicionIvaId ? parseInt(formData.condicionIvaId) : null
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: dataToSend });
    } else {
      createMutation.mutate(dataToSend);
    }
  };

  return (
    <Box>
      <ConfirmDialog
        open={!!propietarioAEliminar}
        onClose={() => setPropietarioAEliminar(null)}
        title="Eliminar propietario"
        message="¿Está seguro de eliminar este propietario?"
        confirmLabel="Eliminar"
        confirmColor="error"
        loading={deleteMutation.isPending}
        onConfirm={() => propietarioAEliminar && deleteMutation.mutate(propietarioAEliminar.id)}
      />
      <ConfirmDialog
        open={!!propiedadADesasociar}
        onClose={() => setPropiedadADesasociar(null)}
        title="Desasociar propiedad"
        message="¿Está seguro de desasociar esta propiedad?"
        confirmLabel="Desasociar"
        confirmColor="error"
        loading={desasociarPropiedadMutation.isPending}
        onConfirm={() => propiedadADesasociar && desasociarPropiedadMutation.mutate(propiedadADesasociar)}
      />
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'stretch', sm: 'center' }, 
        mb: 2, 
        gap: 2 
      }}>
        <TextField
          size="small"
          placeholder="Buscar por nombre, apellido, DNI o CUIT..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
          sx={{ width: { xs: '100%', sm: 280 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <RequirePermission codigo="propietarios.crear">
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen} sx={{ height: 36, py: 0, px: 1.5, fontSize: '0.875rem', '& .MuiButton-startIcon': { marginRight: 0.5 }, width: { xs: '100%', sm: 'auto' } }}>
            Nuevo Propietario
          </Button>
        </RequirePermission>
      </Box>

      {/* Vista de tabla para desktop */}
      <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table size="small" sx={{
          '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.875rem' },
          '& .MuiTableCell-head': { py: 0.5, px: 1 },
          '& .MuiTableSortLabel-root': { fontSize: '0.875rem' }
        }}>
          <TableHead>
            <TableRow>
              <TableCell sortDirection={orderBy === 'nombre' ? order : false}>
                <TableSortLabel active={orderBy === 'nombre'} direction={orderBy === 'nombre' ? order : 'asc'} onClick={() => handleSort('nombre')}>
                  Apellido y nombre
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'dni' ? order : false}>
                <TableSortLabel active={orderBy === 'dni'} direction={orderBy === 'dni' ? order : 'asc'} onClick={() => handleSort('dni')}>
                  DNI
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'cuit' ? order : false}>
                <TableSortLabel active={orderBy === 'cuit'} direction={orderBy === 'cuit' ? order : 'asc'} onClick={() => handleSort('cuit')}>
                  CUIT
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'mail' ? order : false}>
                <TableSortLabel active={orderBy === 'mail'} direction={orderBy === 'mail' ? order : 'asc'} onClick={() => handleSort('mail')}>
                  Email
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'telefono' ? order : false}>
                <TableSortLabel active={orderBy === 'telefono'} direction={orderBy === 'telefono' ? order : 'asc'} onClick={() => handleSort('telefono')}>
                  Teléfono
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'cantPropiedades' ? order : false} align="right">
                <TableSortLabel active={orderBy === 'cantPropiedades'} direction={orderBy === 'cantPropiedades' ? order : 'asc'} onClick={() => handleSort('cantPropiedades')}>
                  Cant. Propiedades
                </TableSortLabel>
              </TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {listaPagina.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {searchDebounced.trim() ? 'No se encontraron propietarios con ese criterio.' : 'No hay propietarios cargados.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              listaPagina.map((propietario) => (
                <TableRow key={propietario.id}>
                  <TableCell>
                    {propietario.razonSocial || formatApellidoNombrePF(propietario.nombre, propietario.apellido) || '-'}
                  </TableCell>
                  <TableCell>{propietario.dni || '-'}</TableCell>
                  <TableCell>{propietario.cuit || '-'}</TableCell>
                  <TableCell>
                    {propietario.mail ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <a 
                          href={`mailto:${propietario.mail}`} 
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'inherit', textDecoration: 'none' }}
                          title="Enviar email"
                        >
                          {propietario.mail}
                        </a>
                        <IconButton 
                          size="small"
                          component="a"
                          href={`mailto:${propietario.mail}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ padding: '2px', color: 'primary.main' }}
                          title="Enviar email"
                        >
                          <EmailIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {propietario.telefono ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <a 
                          href={`https://wa.me/${formatWhatsAppNumber(propietario.telefono)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'inherit', textDecoration: 'none' }}
                          title="Abrir WhatsApp"
                        >
                          {propietario.telefono}
                        </a>
                        <IconButton 
                          size="small" 
                          component="a"
                          href={`https://wa.me/${formatWhatsAppNumber(propietario.telefono)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ padding: '2px', color: '#25D366' }}
                          title="Abrir WhatsApp"
                        >
                          <WhatsAppIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                    ) : '-'}
                  </TableCell>
                  <TableCell align="right">{propietario.propiedades?.length || 0}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleVerPerfil(propietario)} sx={{ padding: '4px' }} title="Ver perfil">
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    <RequirePermission codigo="propietarios.editar">
                      <IconButton size="small" onClick={() => handleEdit(propietario)} sx={{ padding: '4px' }} title="Editar">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </RequirePermission>
                    <RequirePermission codigo="propietarios.eliminar">
                      <IconButton size="small" color="error" onClick={() => setPropietarioAEliminar(propietario)} sx={{ padding: '4px' }} title="Eliminar">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </RequirePermission>
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
          sx={{
            '& .MuiTablePagination-toolbar': { minHeight: 36 },
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: '0.875rem' },
            '& .MuiTablePagination-select': { fontSize: '0.875rem', py: 0.25 }
          }}
        />
      </TableContainer>

      {/* Vista de cards para mobile */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {listaPagina.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
            {searchDebounced.trim() ? 'No se encontraron propietarios con ese criterio.' : 'No hay propietarios cargados.'}
          </Typography>
        ) : (
        <Grid container spacing={2}>
          {listaPagina.map((propietario) => (
            <Grid item xs={12} key={propietario.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        {propietario.razonSocial || formatApellidoNombrePF(propietario.nombre, propietario.apellido) || 'Sin nombre'}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={() => handleVerPerfil(propietario)} sx={{ mr: 0.5 }} title="Ver perfil">
                        <VisibilityIcon />
                      </IconButton>
                      <RequirePermission codigo="propietarios.editar">
                        <IconButton size="small" onClick={() => handleEdit(propietario)} sx={{ mr: 0.5 }} title="Editar">
                          <EditIcon />
                        </IconButton>
                      </RequirePermission>
                      <RequirePermission codigo="propietarios.eliminar">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setPropietarioAEliminar(propietario)}
                          title="Eliminar"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </RequirePermission>
                    </Box>
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {propietario.dni && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BadgeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>DNI:</strong> {propietario.dni}
                        </Typography>
                      </Box>
                    )}
                    {propietario.cuit && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BadgeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>CUIT:</strong> {propietario.cuit}
                        </Typography>
                      </Box>
                    )}
                    {propietario.mail && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton 
                          size="small"
                          component="a"
                          href={`mailto:${propietario.mail}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ padding: 0, minWidth: 0, color: 'primary.main' }}
                        >
                          <EmailIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                        <Typography variant="body2">
                          <a href={`mailto:${propietario.mail}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                            {propietario.mail}
                          </a>
                        </Typography>
                      </Box>
                    )}
                    {propietario.telefono && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton 
                          size="small" 
                          component="a"
                          href={`https://wa.me/${formatWhatsAppNumber(propietario.telefono)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ padding: 0, minWidth: 0, color: '#25D366' }}
                        >
                          <WhatsAppIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                        <Typography 
                          variant="body2" 
                          component="a"
                          href={`https://wa.me/${formatWhatsAppNumber(propietario.telefono)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {propietario.telefono}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <HomeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        <strong>Propiedades:</strong> {propietario.propiedades?.length || 0}
                      </Typography>
                    </Box>
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
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Filas:"
          sx={{
            '& .MuiTablePagination-toolbar': { minHeight: 36 },
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: '0.875rem' },
            '& .MuiTablePagination-select': { fontSize: '0.875rem', py: 0.25 }
          }}
        />
      </Box>

      <Dialog 
        open={open} 
        onClose={() => {
          const propiedadIdParaAsociar = sessionStorage.getItem('propiedadIdParaAsociar');
          const propiedadNuevaParaAsociar = sessionStorage.getItem('propiedadNuevaParaAsociar');
          setOpen(false);
          resetForm();
          setPropiedadesAsociadas([]);
          setEditing(null);
          // Si viene de Propiedades, volver allí
          if (propiedadIdParaAsociar || propiedadNuevaParaAsociar) {
            // NO eliminar propiedadEnEdicion ni propiedadFormData aquí
            // Se eliminarán cuando se cierre el diálogo de Propiedades normalmente
            navigate('/propiedades?openDialog=true');
          } else {
            // Solo limpiar si NO viene de Propiedades
            sessionStorage.removeItem('propietarioEnEdicion');
            sessionStorage.removeItem('propietarioIdParaAsociar');
            sessionStorage.removeItem('propiedadIdParaAsociar');
            sessionStorage.removeItem('propiedadNuevaParaAsociar');
            sessionStorage.removeItem('propiedadEnEdicion');
            sessionStorage.removeItem('propiedadFormData');
            sessionStorage.removeItem('propiedadEstadoCompleto');
          }
        }} 
        maxWidth="md" 
        fullWidth
      >
        <form onSubmit={handleSubmit} noValidate>
          <DialogTitle>
            {editing ? 'Editar Propietario' : 'Nuevo Propietario'}
          </DialogTitle>
          <DialogContent>
            {(createMutation.isError || updateMutation.isError) && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {createMutation.error?.response?.data?.error ||
                  updateMutation.error?.response?.data?.error ||
                  'Error al guardar'}
              </Alert>
            )}
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                {(() => {
                  const tipoPersona = tiposPersona?.find(tp => tp.id === parseInt(formData.tipoPersonaId));
                  const personaFisicaId = tiposPersona?.find(tp => tp.codigo === 'FISICA')?.id;
                  const esFisica = personaFisicaId != null && tipoPersona?.id === personaFisicaId;

                  if (esFisica) {
                    // Persona Física
                    return (
                      <>
                        {/* Línea 1: tipo persona, nombre, apellido */}
                        <Grid item xs={12} sm={4}>
                          <FormControl fullWidth error={!!errors.tipoPersonaId} size="small">
                            <InputLabel>Tipo de Persona *</InputLabel>
                            <Select
                              value={tiposPersona?.some((t) => t.id == formData.tipoPersonaId) ? formData.tipoPersonaId : ''}
                              label="Tipo de Persona *"
                              onChange={(e) => {
                                const nuevoTipoId = e.target.value;
                                
                                // Limpiar TODOS los campos excepto el tipo de persona
                                setFormData({ 
                                  tipoPersonaId: nuevoTipoId,
                                  nombre: '',
                                  apellido: '',
                                  razonSocial: '',
                                  dni: '',
                                  cuit: '',
                                  mail: '',
                                  telefono: '',
                                  dirCalle: '',
                                  dirNro: '',
                                  dirPiso: '',
                                  dirDepto: '',
                                  provinciaId: '',
                                  localidadId: '',
                                  paisCodigo: 'AR',
                                  provinciaExtranjera: '',
                                  localidadExtranjera: '',
                                  condicionIvaId: ''
                                });
                                
                                // Limpiar todos los errores
                                setErrors({});
                              }}
                            >
                              {tiposPersona?.map((tipo) => (
                                <MenuItem key={tipo.id} value={tipo.id}>
                                  {tipo.nombre}
                                </MenuItem>
                              ))}
                            </Select>
                            {errors.tipoPersonaId && <FormHelperText>{errors.tipoPersonaId}</FormHelperText>}
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Nombre *"
                            fullWidth
                            size="small"
                            value={formData.nombre}
                            onChange={(e) => {
                              setFormData({ ...formData, nombre: e.target.value });
                              if (errors.nombre) {
                                setErrors({ ...errors, nombre: '' });
                              }
                            }}
                            error={!!errors.nombre}
                            helperText={errors.nombre}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Apellido"
                            fullWidth
                            size="small"
                            value={formData.apellido}
                            onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                          />
                        </Grid>
                        {/* Línea 2: DNI, CUIT, email, teléfono */}
                        <Grid item xs={12} sm={3}>
                          <TextField
                            label="DNI *"
                            type="text"
                            fullWidth
                            size="small"
                            value={formData.dni ? formData.dni.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').substring(0, 8);
                              setFormData({ ...formData, dni: value });
                              if (errors.dni || errors.dniCuit) {
                                const newErrors = { ...errors };
                                delete newErrors.dni;
                                delete newErrors.dniCuit;
                                setErrors(newErrors);
                              }
                            }}
                            inputProps={{ maxLength: 10 }}
                            error={!!errors.dni || !!errors.dniCuit}
                            helperText={errors.dni || (errors.dniCuit && !formData.cuit ? errors.dniCuit : '')}
                            placeholder="XX.XXX.XXX"
                          />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField
                            label="CUIT *"
                            type="text"
                            fullWidth
                            size="small"
                            value={formData.cuit}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, '');
                              if (value.length > 2) value = value.substring(0, 2) + '-' + value.substring(2);
                              if (value.length > 11) value = value.substring(0, 11) + '-' + value.substring(11);
                              value = value.substring(0, 13);
                              setFormData({ ...formData, cuit: value });
                              if (errors.cuit || errors.dniCuit) {
                                const newErrors = { ...errors };
                                delete newErrors.cuit;
                                delete newErrors.dniCuit;
                                setErrors(newErrors);
                              }
                            }}
                            onBlur={() => {
                              const cuitLimpio = formData.cuit?.replace(/\D/g, '') || '';
                              if (cuitLimpio.length === 11 && !isValidCuit(cuitLimpio)) {
                                setErrors({ ...errors, cuit: 'CUIT/CUIL inválido' });
                              }
                            }}
                            placeholder="XX-XXXXXXXX-X"
                            error={!!errors.cuit || !!errors.dniCuit}
                            helperText={errors.cuit || (errors.dniCuit && !formData.dni ? errors.dniCuit : '')}
                          />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField
                            label="Email"
                            type="email"
                            fullWidth
                            size="small"
                            value={formData.mail}
                            onChange={(e) => {
                              setFormData({ ...formData, mail: e.target.value });
                              if (errors.mail) {
                                setErrors({ ...errors, mail: '' });
                              }
                            }}
                            error={!!errors.mail}
                            helperText={errors.mail || ''}
                            inputProps={{ autoComplete: 'email' }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField
                            label="Teléfono"
                            type="tel"
                            fullWidth
                            size="small"
                            value={formData.telefono}
                            onChange={(e) => {
                              const value = sanitizeTelefonoInput(e.target.value);
                              setFormData({ ...formData, telefono: value });
                              if (errors.telefono) {
                                setErrors({ ...errors, telefono: '' });
                              }
                            }}
                            placeholder="Ej.: +54 9 11 2345-6789"
                            error={!!errors.telefono}
                            helperText={errors.telefono || ''}
                          />
                        </Grid>
                      </>
                    );
                  } else if (formData.tipoPersonaId) {
                    // Persona Jurídica
                    return (
                      <>
                        {/* Línea 1: tipo persona, razón social */}
                        <Grid item xs={12} sm={4}>
                          <FormControl fullWidth error={!!errors.tipoPersonaId} size="small">
                            <InputLabel>Tipo de Persona *</InputLabel>
                            <Select
                              value={tiposPersona?.some((t) => t.id == formData.tipoPersonaId) ? formData.tipoPersonaId : ''}
                              label="Tipo de Persona *"
                              onChange={(e) => {
                                const nuevoTipoId = e.target.value;
                                
                                // Limpiar TODOS los campos excepto el tipo de persona
                                setFormData({ 
                                  tipoPersonaId: nuevoTipoId,
                                  nombre: '',
                                  apellido: '',
                                  razonSocial: '',
                                  dni: '',
                                  cuit: '',
                                  mail: '',
                                  telefono: '',
                                  dirCalle: '',
                                  dirNro: '',
                                  dirPiso: '',
                                  dirDepto: '',
                                  provinciaId: '',
                                  localidadId: '',
                                  paisCodigo: 'AR',
                                  provinciaExtranjera: '',
                                  localidadExtranjera: '',
                                  condicionIvaId: ''
                                });
                                
                                // Limpiar todos los errores
                                setErrors({});
                              }}
                            >
                              {tiposPersona?.map((tipo) => (
                                <MenuItem key={tipo.id} value={tipo.id}>
                                  {tipo.nombre}
                                </MenuItem>
                              ))}
                            </Select>
                            {errors.tipoPersonaId && <FormHelperText>{errors.tipoPersonaId}</FormHelperText>}
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={8}>
                          <TextField
                            label="Razón Social *"
                            fullWidth
                            size="small"
                            value={formData.razonSocial}
                            onChange={(e) => {
                              setFormData({ ...formData, razonSocial: e.target.value });
                              if (errors.razonSocial) {
                                setErrors({ ...errors, razonSocial: '' });
                              }
                            }}
                            error={!!errors.razonSocial}
                            helperText={errors.razonSocial}
                          />
                        </Grid>
                        {/* Línea 2: CUIT, email, teléfono */}
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="CUIT *"
                            type="text"
                            fullWidth
                            size="small"
                            value={formData.cuit}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, '');
                              if (value.length > 2) value = value.substring(0, 2) + '-' + value.substring(2);
                              if (value.length > 11) value = value.substring(0, 11) + '-' + value.substring(11);
                              value = value.substring(0, 13);
                              setFormData({ ...formData, cuit: value });
                              if (errors.cuit || errors.dniCuit) {
                                const newErrors = { ...errors };
                                delete newErrors.cuit;
                                delete newErrors.dniCuit;
                                setErrors(newErrors);
                              }
                            }}
                            onBlur={() => {
                              const cuitLimpio = formData.cuit?.replace(/\D/g, '') || '';
                              if (cuitLimpio.length === 11 && !isValidCuit(cuitLimpio)) {
                                setErrors({ ...errors, cuit: 'CUIT/CUIL inválido' });
                              }
                            }}
                            placeholder="XX-XXXXXXXX-X"
                            error={!!errors.cuit || !!errors.dniCuit}
                            helperText={errors.cuit || errors.dniCuit || ''}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Email"
                            type="email"
                            fullWidth
                            size="small"
                            value={formData.mail}
                            onChange={(e) => {
                              setFormData({ ...formData, mail: e.target.value });
                              if (errors.mail) {
                                setErrors({ ...errors, mail: '' });
                              }
                            }}
                            error={!!errors.mail}
                            helperText={errors.mail || ''}
                            inputProps={{ autoComplete: 'email' }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Teléfono"
                            type="tel"
                            fullWidth
                            size="small"
                            value={formData.telefono}
                            onChange={(e) => {
                              const value = sanitizeTelefonoInput(e.target.value);
                              setFormData({ ...formData, telefono: value });
                              if (errors.telefono) {
                                setErrors({ ...errors, telefono: '' });
                              }
                            }}
                            placeholder="Ej.: +54 9 11 2345-6789"
                            error={!!errors.telefono}
                            helperText={errors.telefono || ''}
                          />
                        </Grid>
                      </>
                    );
                  } else {
                    // Sin tipo de persona seleccionado
                    return (
                      <Grid item xs={12}>
                        <FormControl fullWidth error={!!errors.tipoPersonaId} size="small">
                          <InputLabel>Tipo de Persona *</InputLabel>
                          <Select
                            value={tiposPersona?.some((t) => t.id == formData.tipoPersonaId) ? formData.tipoPersonaId : ''}
                            label="Tipo de Persona *"
                            onChange={(e) => {
                              setFormData({ ...formData, tipoPersonaId: e.target.value, localidadId: '' });
                              if (errors.tipoPersonaId) {
                                setErrors({ ...errors, tipoPersonaId: '' });
                              }
                            }}
                          >
                            {tiposPersona?.map((tipo) => (
                              <MenuItem key={tipo.id} value={tipo.id}>
                                {tipo.nombre}
                              </MenuItem>
                            ))}
                          </Select>
                          {errors.tipoPersonaId && <FormHelperText>{errors.tipoPersonaId}</FormHelperText>}
                        </FormControl>
                      </Grid>
                    );
                  }
                })()}

                {/* Dirección - siempre visible */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Calle"
                    fullWidth
                    size="small"
                    value={formData.dirCalle}
                    onChange={(e) => setFormData({ ...formData, dirCalle: e.target.value })}
                  />
                </Grid>
                <Grid item xs={4} sm={2}>
                  <TextField
                    label="Nro"
                    fullWidth
                    size="small"
                    value={formData.dirNro}
                    onChange={(e) => setFormData({ ...formData, dirNro: e.target.value })}
                    inputProps={{ style: { textAlign: 'center' } }}
                  />
                </Grid>
                <Grid item xs={4} sm={2}>
                  <TextField
                    label="Piso"
                    fullWidth
                    size="small"
                    value={formData.dirPiso}
                    onChange={(e) => setFormData({ ...formData, dirPiso: e.target.value })}
                    inputProps={{ style: { textAlign: 'center' } }}
                  />
                </Grid>
                <Grid item xs={4} sm={2}>
                  <TextField
                    label="Depto"
                    fullWidth
                    size="small"
                    value={formData.dirDepto}
                    onChange={(e) => setFormData({ ...formData, dirDepto: e.target.value })}
                    inputProps={{ style: { textAlign: 'center' } }}
                  />
                </Grid>
                <DomicilioClienteFormSection
                  formData={formData}
                  setFormData={setFormData}
                  errors={errors}
                  setErrors={setErrors}
                  provincias={provincias}
                  localidades={localidades}
                  condicionesIva={condicionesIva}
                />
              </Grid>
            </Box>

            {/* Sección de Propiedades Asociadas */}
            <Box sx={{ mt: 3 }}>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 2 }}>Propiedades Asociadas</Typography>
              
              {!editing && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Guarde el propietario primero para poder asociar propiedades.
                </Alert>
              )}
              
              {editing && (
                <>
                
                {/* Selector de propiedades existentes */}
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, mb: 2, alignItems: { xs: 'stretch', sm: 'center' } }}>
                  <FormControl fullWidth size="small" sx={{ flex: { xs: 'none', sm: 1 } }}>
                    <InputLabel>Seleccionar Propiedad</InputLabel>
                    <Select
                      value={propiedadSeleccionada}
                      label="Seleccionar Propiedad"
                      onChange={(e) => setPropiedadSeleccionada(e.target.value)}
                    >
                      {propiedades
                        .filter(p => !propiedadesAsociadas.find(pa => pa.id === p.id))
                        .map((propiedad) => {
                          const direccion = `${propiedad.dirCalle} ${propiedad.dirNro}${propiedad.dirPiso ? `, Piso ${propiedad.dirPiso}` : ''}${propiedad.dirDepto ? `, Depto ${propiedad.dirDepto}` : ''}`;
                          const localidad = propiedad.localidad?.nombre || propiedad.provincia?.nombre || '';
                          return (
                            <MenuItem key={propiedad.id} value={propiedad.id}>
                              {direccion} {localidad ? `, ${localidad}` : ''}
                            </MenuItem>
                          );
                        })}
                    </Select>
                  </FormControl>
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ minWidth: 'auto', height: '40px', px: 1.5, width: { xs: '100%', sm: 'auto' } }}
                    onClick={() => {
                      if (propiedadSeleccionada) {
                        asociarPropiedadesMutation.mutate({
                          propietarioId: editing.id,
                          propiedadIds: [...propiedadesAsociadas.map(p => p.id), parseInt(propiedadSeleccionada)]
                        });
                      }
                    }}
                    disabled={!propiedadSeleccionada || asociarPropiedadesMutation.isPending}
                  >
                    Agregar
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    sx={{ minWidth: 'auto', height: '40px', px: 1.5, width: { xs: '100%', sm: 'auto' } }}
                    startIcon={<AddIcon sx={{ fontSize: '1rem' }} />}
                    onClick={() => {
                      // Guardar el ID del propietario en sessionStorage para asociar después
                      if (editing?.id) {
                        sessionStorage.setItem('propietarioIdParaAsociar', editing.id.toString());
                        // Guardar también el propietario completo para poder reabrir el diálogo
                        sessionStorage.setItem('propietarioEnEdicion', JSON.stringify(editing));
                      }
                      // Navegar a Propiedades y abrir el diálogo
                      navigate('/propiedades?openDialog=true');
                    }}
                  >
                    Nueva Propiedad
                  </Button>
                </Box>

                {/* Lista de propiedades asociadas */}
                {propiedadesAsociadas && propiedadesAsociadas.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {propiedadesAsociadas.map((propiedad) => {
                      if (!propiedad) return null;
                      const direccion = `${propiedad.dirCalle || ''} ${propiedad.dirNro || ''}${propiedad.dirPiso ? `, Piso ${propiedad.dirPiso}` : ''}${propiedad.dirDepto ? `, Depto ${propiedad.dirDepto}` : ''}`.trim();
                      const localidad = propiedad.localidad?.nombre || propiedad.provincia?.nombre || '';
                      return (
                        <Box
                          key={propiedad.id}
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            py: 0.5,
                            px: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 0.5,
                            bgcolor: 'background.paper'
                          }}
                        >
                          <Typography variant="body2" sx={{ fontSize: '0.875rem', lineHeight: 1.2 }}>
                            {direccion}{localidad ? `, ${localidad}` : ''}
                          </Typography>
                          <IconButton
                            size="small"
                            sx={{ py: 0 }}
                            onClick={() => setPropiedadADesasociar({ propietarioId: editing.id, propiedadId: propiedad.id })}
                            disabled={desasociarPropiedadMutation.isPending}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  <Alert severity="info" sx={{ py: 0.5 }}>
                    {propiedadesAsociadas === null || propiedadesAsociadas === undefined 
                      ? 'Cargando propiedades...' 
                      : 'No hay propiedades asociadas'}
                  </Alert>
                )}
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              const propiedadIdParaAsociar = sessionStorage.getItem('propiedadIdParaAsociar');
              const propiedadNuevaParaAsociar = sessionStorage.getItem('propiedadNuevaParaAsociar');
              setOpen(false);
              resetForm();
              setPropiedadesAsociadas([]);
              setEditing(null);
              // Si viene de Propiedades, volver allí
              if (propiedadIdParaAsociar || propiedadNuevaParaAsociar) {
                // NO eliminar propiedadEnEdicion ni propiedadFormData aquí
                // Se eliminarán cuando se cierre el diálogo de Propiedades normalmente
                navigate('/propiedades?openDialog=true');
              } else {
                // Solo limpiar si NO viene de Propiedades
                sessionStorage.removeItem('propietarioEnEdicion');
                sessionStorage.removeItem('propietarioIdParaAsociar');
                sessionStorage.removeItem('propiedadIdParaAsociar');
                sessionStorage.removeItem('propiedadNuevaParaAsociar');
                sessionStorage.removeItem('propiedadEnEdicion');
                sessionStorage.removeItem('propiedadFormData');
                sessionStorage.removeItem('propiedadEstadoCompleto');
              }
            }}>Cancelar</Button>
            <Button type="submit" variant="contained">
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>


      {/* Dialog Ver Perfil - Usando el nuevo componente */}
      <ClientePerfilDialog
        open={perfilOpen}
        onClose={() => setPerfilOpen(false)}
        clienteId={perfilCliente?.id}
        tipo="propietario"
        onEdit={(cliente) => handleEdit(cliente)}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity} 
          sx={{ width: '100%' }}
        >
          {snackbarSeverity === 'success' ? successMessage : errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

