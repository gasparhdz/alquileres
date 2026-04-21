import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
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
  Select,
  MenuItem,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  FormLabel,
  Divider,
  InputLabel,
  Grid,
  Card,
  CardContent,
  Chip,
  Tooltip,
  Snackbar,
  Tabs,
  Tab,
  InputAdornment,
  TableSortLabel,
  TablePagination,
  Collapse,
  Switch,
  Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HomeIcon from '@mui/icons-material/Home';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ApartmentIcon from '@mui/icons-material/Apartment';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import StoreIcon from '@mui/icons-material/Store';
import Checkbox from '@mui/material/Checkbox';
import api from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import PropiedadDetalleDialog from '../components/PropiedadDetalleDialog';
import RequirePermission from '../components/RequirePermission';
import { buildReturnUrlWithModal } from '../utils/returnPath';
import { useDebounce } from '../hooks/useDebounce';
import { usePermissions } from '../contexts/AuthContext';
import { formatApellidoNombrePF } from '../utils/formatClienteNombre';

/** Etiqueta para selector de propietarios (misma lógica que el alta de propietario en la propiedad). */
function etiquetaPropietario(propietario, tiposPersona) {
  if (!propietario) return '';
  const personaFisicaId = tiposPersona?.find((tp) => tp.codigo === 'FISICA')?.id;
  const esFisica = personaFisicaId != null && propietario.tipoPersona?.id === personaFisicaId;
  if (esFisica) {
    return formatApellidoNombrePF(propietario.nombre, propietario.apellido) || propietario.razonSocial || 'Sin nombre';
  }
  return propietario.razonSocial || formatApellidoNombrePF(propietario.nombre, propietario.apellido) || 'Sin nombre';
}

function titularImpuestoInicial(propietarioIds) {
  const ids = propietarioIds || [];
  if (ids.length === 0) {
    return { titularModo: 'OTRO', titularPropietarioId: '', titularOtroNombre: '', titularOtroApellido: '' };
  }
  return { titularModo: 'PROPIETARIO', titularPropietarioId: ids[0], titularOtroNombre: '', titularOtroApellido: '' };
}

function toInputDate(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

function formatARDateSeguro(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-AR');
  } catch {
    return '—';
  }
}

function polizaVencida(fechaFin) {
  if (!fechaFin) return false;
  const fin = String(fechaFin).slice(0, 10);
  const hoy = new Date().toISOString().slice(0, 10);
  return fin < hoy;
}

function fmtMontoSeguro(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const emptySeguroForm = () => ({
  id: null,
  compania: '',
  nroPoliza: '',
  titularPoliza: '',
  productorSeguro: '',
  contactoProductor: '',
  tipoCobertura: '',
  fechaInicio: '',
  fechaFin: '',
  montoAsegurado: '',
  costoPoliza: '',
  notas: '',
});

const emptyConsorcioDraft = () => ({
  nombre: '',
  nombreAdministracion: '',
  direccionAdministracion: '',
  nombreReferente: '',
  telefonoAdministracion: '',
  mailAdministracion: '',
  notas: '',
});

/** Texto del selector: administración + nombre del consorcio (como en la API). */
function etiquetaConsorcioSelector(c) {
  if (!c) return '';
  const admin = (c.nombreAdministracion || '').trim();
  const nom = (c.nombre || '').trim();
  if (admin && nom) return `${admin} — ${nom}`;
  return nom || admin || '';
}

/**
 * Dentro de Dialog a veces el texto del contained no hereda bien el contraste.
 * No tocamos el fondo: lo define el tema (MuiButton contained = mismo verde que el resto).
 */
const PROPIEDAD_DIALOG_CONTAINED_SUBMIT_SX = {
  color: '#ffffff',
  WebkitTextFillColor: '#ffffff',
  '&:hover': {
    color: '#ffffff',
    WebkitTextFillColor: '#ffffff',
  },
  '& .MuiButton-label': {
    color: '#ffffff',
  },
  '&:hover .MuiButton-label': {
    color: '#ffffff',
  },
  /* MUI 6: a veces el texto va en span directo sin esa clase */
  '& > span:not(.MuiButton-startIcon):not(.MuiButton-endIcon)': {
    color: '#ffffff',
  },
};

/** Códigos de tipo de cargo: periodicidad en Impuestos; detalle en pestaña Expensas / Seguros */
const CARGO_COD_EXPENSAS = 'EXPENSAS';
const CARGO_COD_SEGURO = 'SEGURO';

const PROPIEDAD_TAB_KEYS = ['propietarios', 'impuestos', 'documentacion', 'expensas', 'seguros'];

function migratePropiedadTabKey(v) {
  if (typeof v === 'string' && PROPIEDAD_TAB_KEYS.includes(v)) {
    return v;
  }
  if (typeof v === 'number') {
    const map = ['propietarios', 'impuestos', 'documentacion', 'seguros', 'expensas'];
    return map[v] ?? 'propietarios';
  }
  return 'propietarios';
}

export default function Propiedades() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, permisos } = usePermissions();
  const puedeCrearServicios = hasPermission('propiedad.servicios.crear');
  const puedeEditarServicios = hasPermission('propiedad.servicios.editar');
  const puedeCrearDocumentos = hasPermission('propiedad.documentos.crear');
  const puedeEditarDocumentos = hasPermission('propiedad.documentos.editar');
  const readonlyServicios = !puedeCrearServicios && !puedeEditarServicios;
  const readonlyDocumentos = !puedeCrearDocumentos && !puedeEditarDocumentos;
  const puedeEditarSeguros = hasPermission('propiedades.editar');
  const readonlySeguros = !puedeEditarSeguros;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [propiedadTabKey, setPropiedadTabKey] = useState('propietarios');

  // Debug: en consola podés ver qué permisos llegan y si las pestañas quedan en solo lectura
  useEffect(() => {
    if (import.meta.env.DEV && open) {
      const relacionados = permisos.filter(p => typeof p === 'string' && (p.startsWith('propiedad.') || p.startsWith('contrato.')));
      console.debug('[Propiedades RBAC] permisos del usuario (propiedad.*):', relacionados);
      console.debug('[Propiedades RBAC] propiedad.servicios.crear/editar:', puedeCrearServicios, puedeEditarServicios, '→ readonlyServicios:', readonlyServicios);
      console.debug('[Propiedades RBAC] propiedad.documentos.crear/editar:', puedeCrearDocumentos, puedeEditarDocumentos, '→ readonlyDocumentos:', readonlyDocumentos);
    }
  }, [open, permisos, puedeCrearServicios, puedeEditarServicios, puedeCrearDocumentos, puedeEditarDocumentos, readonlyServicios, readonlyDocumentos]);

  // Abrir diálogo automáticamente si viene el parámetro openDialog
  useEffect(() => {
    if (searchParams.get('openDialog') === 'true') {
      setOpen(true);
      // Si hay una propiedad en edición guardada, restaurarla PRIMERO
      const propiedadEnEdicionStr = sessionStorage.getItem('propiedadEnEdicion');
      if (propiedadEnEdicionStr) {
        try {
          const propiedadEnEdicion = JSON.parse(propiedadEnEdicionStr);
          const estadoCompletoStr = sessionStorage.getItem('propiedadEstadoCompleto');

          // Si hay estado completo guardado, restaurar desde ahí sin llamar a la API
          // (esto ocurre cuando volvemos de Propietarios después de cancelar o guardar)
          if (estadoCompletoStr) {
            try {
              const estadoCompleto = JSON.parse(estadoCompletoStr);
              setEditing(propiedadEnEdicion);

              // Restaurar el formulario completo
              if (estadoCompleto.formData) {
                const fd = estadoCompleto.formData;
                setFormData({
                  ...fd,
                  superficieM2: fd.superficieM2 ?? '',
                  administraImpuestosInmobiliaria: fd.administraImpuestosInmobiliaria ?? false,
                  consorcioId: fd.consorcioId ?? '',
                });
              }
              if (estadoCompleto.consorcioDraft) {
                setConsorcioDraft({
                  ...emptyConsorcioDraft(),
                  ...estadoCompleto.consorcioDraft,
                });
              }
              if (estadoCompleto.impuestosSeleccionados && Array.isArray(estadoCompleto.impuestosSeleccionados)) {
                setImpuestosSeleccionados(estadoCompleto.impuestosSeleccionados);
              }
              if (estadoCompleto.cargosSeleccionados && Array.isArray(estadoCompleto.cargosSeleccionados)) {
                setCargosSeleccionados(estadoCompleto.cargosSeleccionados);
              }
              if (estadoCompleto.documentacion && Array.isArray(estadoCompleto.documentacion)) {
                setDocumentacion(estadoCompleto.documentacion);
              }
              setImpuestosExpandidos({});
              setCargosExpandidos({});

              // Si viene de Propietarios con un nuevo propietario, preseleccionarlo
              const propietarioIdParaAsociar = sessionStorage.getItem('propietarioIdParaAsociar');
              if (propietarioIdParaAsociar) {
                setPropiedadTabKey('propietarios'); // Cambiar al tab de Propietarios
                const propietarioId = parseInt(propietarioIdParaAsociar);
                setFormData(prev => ({
                  ...prev,
                  propietarioIds: prev.propietarioIds.includes(propietarioId)
                    ? prev.propietarioIds
                    : [...prev.propietarioIds, propietarioId]
                }));
                sessionStorage.removeItem('propietarioIdParaAsociar');
                sessionStorage.removeItem('propietarioEnEdicion');
              } else if (estadoCompleto.propiedadTabKey !== undefined || estadoCompleto.tabValue !== undefined) {
                setPropiedadTabKey(
                  migratePropiedadTabKey(estadoCompleto.propiedadTabKey ?? estadoCompleto.tabValue)
                );
              }

              // Limpiar sessionStorage
              sessionStorage.removeItem('propiedadEstadoCompleto');
              sessionStorage.removeItem('propiedadEnEdicion');
              sessionStorage.removeItem('propiedadFormData');
            } catch (parseError) {
              // Si falla el parseo, intentar cargar desde la API
              const cargarDesdeAPI = async () => {
                try {
                  const response = await api.get(`/propiedades/${propiedadEnEdicion.id}`);
                  await handleEdit(response.data);
                } catch (apiError) {
                  setEditing(propiedadEnEdicion);
                }
                sessionStorage.removeItem('propiedadEnEdicion');
                sessionStorage.removeItem('propiedadEstadoCompleto');
              };
              cargarDesdeAPI();
            }
          } else {
            // Si no hay estado completo, cargar desde la API
            const cargarPropiedadCompleta = async () => {
              try {
                const response = await api.get(`/propiedades/${propiedadEnEdicion.id}`);
                const propiedadCompleta = response.data;
                await handleEdit(propiedadCompleta);

                // Después de cargar, preseleccionar el propietario si viene de Propietarios
                const propietarioIdParaAsociar = sessionStorage.getItem('propietarioIdParaAsociar');
                if (propietarioIdParaAsociar) {
                  setPropiedadTabKey('propietarios');
                  const propietarioId = parseInt(propietarioIdParaAsociar);
                  setFormData(prev => ({
                    ...prev,
                    propietarioIds: prev.propietarioIds.includes(propietarioId)
                      ? prev.propietarioIds
                      : [...prev.propietarioIds, propietarioId]
                  }));
                  sessionStorage.removeItem('propietarioIdParaAsociar');
                  sessionStorage.removeItem('propietarioEnEdicion');
                }

                sessionStorage.removeItem('propiedadEnEdicion');
                sessionStorage.removeItem('propiedadFormData');
              } catch (error) {
                // Si falla la API, usar los datos guardados
                setEditing(propiedadEnEdicion);
                sessionStorage.removeItem('propiedadEnEdicion');
              }
            };
            cargarPropiedadCompleta();
          }
        } catch (error) {
          sessionStorage.removeItem('propiedadEnEdicion');
          sessionStorage.removeItem('propiedadFormData');
          sessionStorage.removeItem('propiedadEstadoCompleto');
        }
      } else {
        // Si NO hay propiedad en edición pero sí viene de Propietarios, preseleccionar el propietario
        const propietarioIdParaAsociar = sessionStorage.getItem('propietarioIdParaAsociar');
        if (propietarioIdParaAsociar) {
          setPropiedadTabKey('propietarios'); // Cambiar al tab de Propietarios
          const propietarioId = parseInt(propietarioIdParaAsociar);
          setFormData(prev => ({
            ...prev,
            propietarioIds: prev.propietarioIds.includes(propietarioId)
              ? prev.propietarioIds
              : [...prev.propietarioIds, propietarioId]
          }));
          // NO eliminar propietarioIdParaAsociar ni propietarioEnEdicion aquí
          // Se necesitan para volver al modal de Propietarios si el usuario cancela
        }
      }

      // Limpiar el parámetro de la URL
      searchParams.delete('openDialog');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Estado para propietario seleccionado en el selector
  const [propietarioSeleccionado, setPropietarioSeleccionado] = useState('');
  // Estado para impuestos y cargos seleccionados
  const [impuestosSeleccionados, setImpuestosSeleccionados] = useState([]); // Array de { tipoImpuestoId, periodicidadId, campos: { tipoCampoId: valor } }
  const [cargosSeleccionados, setCargosSeleccionados] = useState([]); // Array de { tipoCargoId, periodicidadId, propiedadCargoId, campos: { tipoCampoId: valor } }
  // Cache de campos por tipo de impuesto y cargo
  const [camposPorTipoImpuesto, setCamposPorTipoImpuesto] = useState({});
  const [camposPorTipoCargo, setCamposPorTipoCargo] = useState({});
  // Estado para la documentación
  const [documentacion, setDocumentacion] = useState([]);
  // Estado para controlar qué acordeones de impuestos/cargos están expandidos
  const [impuestosExpandidos, setImpuestosExpandidos] = useState({});
  const [cargosExpandidos, setCargosExpandidos] = useState({});
  const [seguroForm, setSeguroForm] = useState(emptySeguroForm);
  const [consorcioDraft, setConsorcioDraft] = useState(emptyConsorcioDraft);
  const [seguroAEliminar, setSeguroAEliminar] = useState(null);
  const [consorcioModalOpen, setConsorcioModalOpen] = useState(false);
  const [seguroModalOpen, setSeguroModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    propietarioIds: [],
    dirCalle: '',
    dirNro: '',
    dirPiso: '',
    dirDepto: '',
    provinciaId: '',
    localidadId: '',
    tipoPropiedadId: '',
    estadoPropiedadId: '',
    destinoId: '',
    ambientesId: '',
    codigoInterno: '',
    descripcion: '',
    superficieM2: '',
    administraImpuestosInmobiliaria: false,
    consorcioId: '',
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [propiedadAEliminar, setPropiedadAEliminar] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [orderBy, setOrderBy] = useState('direccion');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [perfilPropiedad, setPerfilPropiedad] = useState(null);
  const [initialPerfilTab, setInitialPerfilTab] = useState(0);
  const queryClient = useQueryClient();
  const searchDebounced = useDebounce(searchTerm, 400);

  const handleVerPerfil = (propiedad) => {
    setPerfilPropiedad(propiedad);
    setPerfilOpen(true);
  };

  const getTipoIcon = (tipoNombre) => {
    if (!tipoNombre) return <HomeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />;
    const nombre = tipoNombre.toLowerCase();
    if (nombre.includes('departamento') || nombre.includes('depto')) {
      return <ApartmentIcon sx={{ fontSize: 16, color: 'text.secondary' }} />;
    }
    if (nombre.includes('cochera') || nombre.includes('garage')) {
      return <DirectionsCarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />;
    }
    if (nombre.includes('local') || nombre.includes('comercial')) {
      return <StoreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />;
    }
    return <HomeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />;
  };

  const getEstadoChipProps = (estadoNombre) => {
    if (!estadoNombre) return { color: 'default', label: '-' };
    const label = estadoNombre === 'Vacante' ? 'Disponible' : estadoNombre;
    const nombre = (estadoNombre || '').toLowerCase();
    // Antes que «disponible» (substring): «No disponible» no debe verse como disponible/verde
    if (nombre.includes('no disponible')) {
      return { color: 'default', label };
    }
    if (nombre.includes('disponible') || nombre.includes('vacante') || nombre.includes('libre')) {
      return { color: 'success', label };
    }
    if (nombre.includes('alquilada') || nombre.includes('ocupada')) {
      return { color: 'info', label };
    }
    if (nombre.includes('reservada')) {
      return { color: 'warning', label };
    }
    return { color: 'default', label };
  };

  const { data, isLoading } = useQuery({
    queryKey: ['propiedades', { page: page + 1, limit: rowsPerPage, search: searchDebounced, estado: filtroEstado, orderBy, order }],
    queryFn: async () => {
      const resp = await api.get('/propiedades', {
        params: {
          page: page + 1,
          limit: rowsPerPage,
          search: searchDebounced.trim() || undefined,
          estado: filtroEstado || undefined,
          orderBy,
          order,
        },
      });
      return resp.data;
    },
  });

  const listaPagina = data?.data ?? [];
  const totalRegistros = data?.pagination?.total ?? 0;

  const handleSort = (column) => {
    const isAsc = orderBy === column && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(column);
    setPage(0);
  };

  const { data: propietariosData } = useQuery({
    queryKey: ['propietarios'],
    queryFn: async () => {
      const response = await api.get('/propietarios?limit=1000');
      return response.data?.data || [];
    }
  });
  const propietarios = propietariosData || [];

  const { data: consorciosResp } = useQuery({
    queryKey: ['consorcios', 'autocomplete', open],
    queryFn: async () => {
      const r = await api.get('/consorcios', { params: { limit: 500, page: 1 } });
      return r.data?.data ?? [];
    },
    enabled: open,
  });
  const consorciosLista = consorciosResp || [];

  /** Incluye el consorcio ya vinculado a la propiedad aunque no esté en el listado (p. ej. inactivo o recién cargado). */
  const opcionesConsorcioAutocomplete = useMemo(() => {
    const list = Array.isArray(consorciosLista) ? [...consorciosLista] : [];
    const cid =
      formData.consorcioId !== '' && formData.consorcioId != null
        ? String(formData.consorcioId)
        : '';
    if (!cid) return list;
    if (list.some((c) => String(c.id) === cid)) return list;
    const inc = editing?.consorcio;
    if (inc && String(inc.id) === cid) return [inc, ...list];
    return list;
  }, [consorciosLista, formData.consorcioId, editing?.consorcio]);

  const valorConsorcioAutocomplete = useMemo(() => {
    const cid =
      formData.consorcioId !== '' && formData.consorcioId != null
        ? String(formData.consorcioId)
        : '';
    if (!cid) return null;
    return opcionesConsorcioAutocomplete.find((c) => String(c.id) === cid) ?? null;
  }, [formData.consorcioId, opcionesConsorcioAutocomplete]);

  // Catálogos para propiedades
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

  const { data: tiposPropiedad } = useQuery({
    queryKey: ['tipos-propiedad'],
    queryFn: async () => {
      const response = await api.get('/catalogos/tipos-propiedad');
      return response.data;
    }
  });

  const { data: estadosPropiedad } = useQuery({
    queryKey: ['estados-propiedad'],
    queryFn: async () => {
      const response = await api.get('/catalogos/estados-propiedad');
      return response.data;
    }
  });

  // Aplicar filtro de estado desde URL (ej: ?estado=disponible)
  useEffect(() => {
    const estadoParam = searchParams.get('estado');
    if (estadoParam && estadosPropiedad?.length > 0) {
      const estadoEncontrado = estadosPropiedad.find(
        e => e.codigo?.toLowerCase() === estadoParam.toLowerCase() ||
          e.nombre?.toLowerCase() === estadoParam.toLowerCase()
      );
      if (estadoEncontrado) {
        setFiltroEstado(estadoEncontrado.id.toString());
      }
      // Limpiar el parámetro de la URL para que no se re-aplique
      searchParams.delete('estado');
      setSearchParams(searchParams, { replace: true });
    }
  }, [estadosPropiedad, searchParams, setSearchParams]);

  // Estado para guardar la URL de retorno cuando se abre perfil desde otra página
  const [volverAUrl, setVolverAUrl] = useState(null);

  // Abrir perfil de propiedad desde URL (ej: ?verPerfil=123&from=dashboard&modal=vacantes o desde ClientePerfilDialog con state)
  useEffect(() => {
    const verPerfilId = searchParams.get('verPerfil');
    if (!verPerfilId) return;
    const propiedadId = parseInt(verPerfilId, 10);
    if (isNaN(propiedadId)) return;

    let cancelled = false;
    const tabProp = searchParams.get('tabProp');
    api.get(`/propiedades/${propiedadId}`)
      .then((res) => {
        if (cancelled) return;
        const propiedad = res.data;
        setPerfilPropiedad(propiedad);
        if (tabProp !== null && tabProp !== '') {
          const tabNum = parseInt(tabProp, 10);
          setInitialPerfilTab(Number.isNaN(tabNum) ? 0 : Math.max(0, tabNum));
        } else {
          setInitialPerfilTab(0);
        }
        setPerfilOpen(true);
        const stateReturnUrl = buildReturnUrlWithModal(location.state);
        if (stateReturnUrl) {
          setVolverAUrl(stateReturnUrl);
        } else {
          const from = searchParams.get('from');
          const modal = searchParams.get('modal');
          if (from) {
            const basePath = from === 'dashboard' ? '/' : `/${from}`;
            const returnUrl = modal ? `${basePath}?modal=${modal}` : basePath;
            setVolverAUrl(returnUrl);
          }
        }
        searchParams.delete('verPerfil');
        searchParams.delete('tabProp');
        searchParams.delete('from');
        searchParams.delete('modal');
        setSearchParams(searchParams, { replace: true });
      })
      .catch(() => { if (!cancelled) { searchParams.delete('verPerfil'); setSearchParams(searchParams, { replace: true }); } });
    return () => { cancelled = true; };
  }, [searchParams, setSearchParams, location.state]);

  // Handler para cerrar el perfil (vuelve a la página de origen si corresponde)
  const handleCerrarPerfil = () => {
    setPerfilOpen(false);
    setInitialPerfilTab(0);
    if (volverAUrl) {
      navigate(volverAUrl);
      setVolverAUrl(null);
    }
  };

  // Handler para cerrar el modal de edición (vuelve a la página de origen si corresponde)
  const handleCerrarEdicion = () => {
    const vieneDePropietarios = sessionStorage.getItem('propietarioIdParaAsociar');
    setOpen(false);
    setSeguroForm(emptySeguroForm());
    resetForm();
    // Limpiar sessionStorage de propiedades
    sessionStorage.removeItem('propiedadEnEdicion');
    sessionStorage.removeItem('propiedadFormData');
    sessionStorage.removeItem('propiedadEstadoCompleto');
    sessionStorage.removeItem('propiedadIdParaAsociar');
    sessionStorage.removeItem('propiedadNuevaParaAsociar');

    // Prioridad: Si viene del Dashboard (volverAUrl), volver ahí
    if (volverAUrl) {
      navigate(volverAUrl);
      setVolverAUrl(null);
    } else if (vieneDePropietarios && !editing) {
      // Si viene de Propietarios, volver allí
      navigate(`/clientes?tab=0&returnFromProp=${Date.now()}`);
    }
  };

  const { data: destinosPropiedad } = useQuery({
    queryKey: ['destinos-propiedad'],
    queryFn: async () => {
      const response = await api.get('/catalogos/destinos-propiedad');
      return response.data;
    }
  });

  const { data: ambientesPropiedad } = useQuery({
    queryKey: ['ambientes-propiedad'],
    queryFn: async () => {
      const response = await api.get('/catalogos/ambientes-propiedad');
      return response.data;
    }
  });

  // Catálogos para impuestos y cargos
  const { data: tiposImpuestoPropiedad } = useQuery({
    queryKey: ['tipos-impuesto-propiedad'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-impuesto-propiedad?mostrarInactivos=false');
      return response.data;
    }
  });

  const { data: tiposCargo } = useQuery({
    queryKey: ['tipos-cargo'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-cargo?mostrarInactivos=false');
      return response.data;
    }
  });

  const { data: periodicidadesImpuesto } = useQuery({
    queryKey: ['periodicidades-impuesto'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/periodicidades-impuesto?mostrarInactivos=false');
      return response.data;
    }
  });

  const tieneCargoExpensas = useMemo(() => {
    if (!tiposCargo?.length || !cargosSeleccionados.length) return false;
    return cargosSeleccionados.some((c) => {
      const tc = tiposCargo.find((t) => t.id === c.tipoCargoId);
      return tc?.codigo === CARGO_COD_EXPENSAS;
    });
  }, [cargosSeleccionados, tiposCargo]);

  const tieneCargoSeguro = useMemo(() => {
    if (!tiposCargo?.length || !cargosSeleccionados.length) return false;
    return cargosSeleccionados.some((c) => {
      const tc = tiposCargo.find((t) => t.id === c.tipoCargoId);
      return tc?.codigo === CARGO_COD_SEGURO;
    });
  }, [cargosSeleccionados, tiposCargo]);

  useEffect(() => {
    // Si se eliminó la pestaña original
    if (propiedadTabKey === 'expensas' || propiedadTabKey === 'seguros') {
      setPropiedadTabKey('impuestos');
    }
  }, [propiedadTabKey]);

  // Función para cargar campos de un tipo de impuesto
  const cargarCamposTipoImpuesto = async (tipoImpuestoId) => {
    if (camposPorTipoImpuesto[tipoImpuestoId]) {
      return camposPorTipoImpuesto[tipoImpuestoId];
    }
    try {
      const response = await api.get(`/tipos-impuesto-propiedad-campos/tipo-impuesto/${tipoImpuestoId}`);
      const campos = response.data || [];
      setCamposPorTipoImpuesto(prev => ({ ...prev, [tipoImpuestoId]: campos }));
      return campos;
    } catch (error) {
      console.error('Error al cargar campos:', error);
      return [];
    }
  };

  const cargarCamposTipoCargo = async (tipoCargoId) => {
    if (camposPorTipoCargo[tipoCargoId]) {
      return camposPorTipoCargo[tipoCargoId];
    }
    try {
      const response = await api.get(`/tipos-cargo-campos/tipo-cargo/${tipoCargoId}`);
      const campos = response.data || [];
      setCamposPorTipoCargo(prev => ({ ...prev, [tipoCargoId]: campos }));
      return campos;
    } catch (error) {
      console.error('Error al cargar campos del tipo de cargo:', error);
      return [];
    }
  };

  // Obtener tipos de documento de propiedad
  const { data: tiposPersona } = useQuery({
    queryKey: ['tipos-persona'],
    queryFn: async () => {
      const response = await api.get('/catalogos/tipos-persona');
      return response.data;
    }
  });

  const { data: tiposDocumentoPropiedad } = useQuery({
    queryKey: ['tipos-documento-propiedad'],
    queryFn: async () => {
      const response = await api.get('/catalogos-abm/tipos-documento-propiedad?mostrarInactivos=false');
      return response.data;
    }
  });


  const createMutation = useMutation({
    mutationFn: (data) => api.post('/propiedades', data)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/propiedades/${id}`, data)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/propiedades/${id}`),
    onSuccess: () => {
      setPropiedadAEliminar(null);
      queryClient.invalidateQueries(['propiedades']);
      setSuccessMessage('Propiedad eliminada exitosamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al eliminar la propiedad');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  const { data: segurosLista = [] } = useQuery({
    queryKey: ['propiedad-seguros', editing?.id],
    queryFn: async () => {
      const r = await api.get(`/propiedades/${editing.id}/seguros`);
      return r.data;
    },
    enabled: Boolean(open && editing?.id),
  });

  const deleteSeguroMutation = useMutation({
    mutationFn: ({ propiedadId, seguroId }) =>
      api.delete(`/propiedades/${propiedadId}/seguros/${seguroId}`),
    onSuccess: () => {
      setSeguroAEliminar(null);
      queryClient.invalidateQueries(['propiedad-seguros', editing?.id]);
      queryClient.invalidateQueries(['propiedades']);
      setSuccessMessage('Póliza eliminada');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || 'Error al eliminar la póliza');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    },
  });

  /** Si hay datos parciales de póliza, exige campos obligatorios antes de guardar la propiedad. */
  const validarSeguroFormIncompleto = () => {
    if (readonlySeguros) return null;
    const f = seguroForm;
    const hasAny =
      (f.compania || '').trim() ||
      (f.nroPoliza || '').trim() ||
      f.fechaInicio ||
      f.fechaFin ||
      (f.titularPoliza || '').trim() ||
      (f.productorSeguro || '').trim() ||
      (f.contactoProductor || '').trim() ||
      (f.tipoCobertura || '').trim() ||
      (f.montoAsegurado || '').trim() ||
      (f.costoPoliza || '').trim() ||
      (f.notas || '').trim();
    if (!hasAny) return null;
    const complete =
      (f.compania || '').trim() &&
      (f.nroPoliza || '').trim() &&
      f.fechaInicio &&
      f.fechaFin;
    if (!complete) {
      return 'Si carga datos de seguro, complete compañía, nº de póliza y fechas de vigencia (o vacíe todos los campos de la póliza).';
    }
    return null;
  };

  /** Persiste la póliza en edición/alta junto con el guardado general (misma propiedad). */
  const persistSeguroSiCorresponde = async (propiedadId) => {
    if (readonlySeguros || !propiedadId) return;
    const f = seguroForm;
    const hasAny =
      (f.compania || '').trim() ||
      (f.nroPoliza || '').trim() ||
      f.fechaInicio ||
      f.fechaFin ||
      (f.titularPoliza || '').trim() ||
      (f.productorSeguro || '').trim() ||
      (f.contactoProductor || '').trim() ||
      (f.tipoCobertura || '').trim() ||
      (f.montoAsegurado || '').trim() ||
      (f.costoPoliza || '').trim() ||
      (f.notas || '').trim();
    if (!hasAny) return;
    const payload = {
      compania: f.compania.trim(),
      nroPoliza: f.nroPoliza.trim(),
      titularPoliza: f.titularPoliza.trim() || null,
      productorSeguro: f.productorSeguro.trim() || null,
      contactoProductor: f.contactoProductor.trim() || null,
      tipoCobertura: f.tipoCobertura.trim() || null,
      fechaInicio: f.fechaInicio,
      fechaFin: f.fechaFin,
      montoAsegurado: f.montoAsegurado === '' ? null : f.montoAsegurado,
      costoPoliza: f.costoPoliza === '' ? null : f.costoPoliza,
      notas: f.notas.trim() || null,
    };
    if (f.id) {
      await api.put(`/propiedades/${propiedadId}/seguros/${f.id}`, payload);
    } else {
      await api.post(`/propiedades/${propiedadId}/seguros`, payload);
    }
    queryClient.invalidateQueries(['propiedad-seguros', propiedadId]);
    queryClient.invalidateQueries(['propiedades']);
    setSeguroForm(emptySeguroForm());
  };

  const validateForm = () => {
    const newErrors = {};

    // Validar calle y número obligatorios
    if (!formData.dirCalle || formData.dirCalle.trim() === '') {
      newErrors.dirCalle = 'La calle es obligatoria';
    }

    if (!formData.dirNro || formData.dirNro.trim() === '') {
      newErrors.dirNro = 'El número es obligatorio';
    }

    // Validar que al menos haya provincia o localidad
    if (!formData.provinciaId && !formData.localidadId) {
      newErrors.provinciaId = 'Debe seleccionar al menos provincia o localidad';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      propietarioIds: [],
      dirCalle: '',
      dirNro: '',
      dirPiso: '',
      dirDepto: '',
      provinciaId: '',
      localidadId: '',
      tipoPropiedadId: '',
      estadoPropiedadId: '',
      destinoId: '',
      ambientesId: '',
      codigoInterno: '',
      descripcion: '',
      superficieM2: '',
      administraImpuestosInmobiliaria: false,
      consorcioId: '',
    });
    setErrors({});
    setEditing(null);
    setSeguroForm(emptySeguroForm());
    setConsorcioDraft(emptyConsorcioDraft());
    setImpuestosSeleccionados([]);
    setCargosSeleccionados([]);
    setImpuestosExpandidos({});
    setCargosExpandidos({});
    setPropiedadTabKey('propietarios');
    setCamposPorTipoCargo({});
    // Inicializar documentación desde parámetros
    inicializarDocumentacion([]);
  };

  // Función para inicializar la documentación desde tipos de documento
  const inicializarDocumentacion = (documentosExistentes = []) => {
    if (!tiposDocumentoPropiedad || tiposDocumentoPropiedad.length === 0) {
      setDocumentacion([]);
      return;
    }

    const documentosIniciales = tiposDocumentoPropiedad.map(tipoDoc => {
      // Buscar si existe un documento para este tipo
      const docExistente = documentosExistentes.find(
        doc => doc.tipoDocumentoPropiedadId === tipoDoc.id
      );

      const documento = {
        tipoDocumentoPropiedadId: tipoDoc.id,
        nombre: tipoDoc.nombre,
        necesario: docExistente ? Boolean(docExistente.necesario) : false,
        recibido: docExistente ? Boolean(docExistente.recibido) : false,
        id: docExistente?.id || null // ID si existe en BD
      };

      return documento;
    });

    setDocumentacion(documentosIniciales);
  };

  const handleOpen = () => {
    resetForm();
    setOpen(true);
  };

  // Limpiar localidad cuando cambia la provincia
  useEffect(() => {
    // Solo procesar si hay una provincia seleccionada
    if (formData.provinciaId) {
      // Si hay localidad seleccionada y localidades cargadas, verificar que pertenezca a la provincia
      if (formData.localidadId && localidades && localidades.length > 0) {
        const localidadActual = localidades.find(l => String(l.id) === String(formData.localidadId));
        // Solo limpiar si la localidad existe pero no pertenece a la provincia actual
        // O si la localidad no existe en la lista (puede ser de otra provincia)
        if (localidadActual && String(localidadActual.provinciaId) !== String(formData.provinciaId)) {
          setFormData(prev => ({ ...prev, localidadId: '' }));
        }
        // Si la localidad no se encuentra en la lista, no la limpiamos automáticamente
        // porque puede ser que las localidades aún se estén cargando o haya un problema de timing
      }
    } else if (!formData.provinciaId && formData.localidadId) {
      // Si se quita la provincia, limpiar localidad
      setFormData(prev => ({ ...prev, localidadId: '' }));
    }
  }, [formData.provinciaId, localidades]);

  const handleEdit = async (propiedad) => {
    setSeguroForm(emptySeguroForm());
    setConsorcioDraft(emptyConsorcioDraft());
    setImpuestosExpandidos({});
    setCargosExpandidos({});
    setEditing(propiedad);
    // Limpiar datos para el formulario, excluyendo relaciones y campos read-only
    const propietarioIds = propiedad.propietarios?.map(p => p.propietario.id) || [];
    setFormData({
      propietarioIds: propietarioIds,
      dirCalle: propiedad.dirCalle || '',
      dirNro: propiedad.dirNro || '',
      dirPiso: propiedad.dirPiso || '',
      dirDepto: propiedad.dirDepto || '',
      provinciaId: propiedad.provinciaId?.toString() || propiedad.localidad?.provinciaId?.toString() || '',
      localidadId: propiedad.localidadId?.toString() || '',
      tipoPropiedadId: propiedad.tipoPropiedadId?.toString() || '',
      estadoPropiedadId: propiedad.estadoPropiedadId?.toString() || '',
      destinoId: propiedad.destinoId?.toString() || '',
      ambientesId: propiedad.ambientesId?.toString() || '',
      codigoInterno: propiedad.codigoInterno || '',
      descripcion: propiedad.descripcion || '',
      superficieM2:
        propiedad.superficieM2 != null && propiedad.superficieM2 !== ''
          ? String(propiedad.superficieM2)
          : '',
      administraImpuestosInmobiliaria: Boolean(propiedad.administraImpuestosInmobiliaria),
      consorcioId:
        propiedad.consorcioId != null && propiedad.consorcioId !== ''
          ? String(propiedad.consorcioId)
          : propiedad.consorcio?.id != null
            ? String(propiedad.consorcio.id)
            : '',
    });
    setOpen(true);

    // Cargar impuestos y cargos existentes
    try {
      const [impuestosResponse, cargosResponse] = await Promise.all([
        api.get(`/propiedad-impuestos/propiedad/${propiedad.id}`),
        api.get(`/propiedad-cargos/propiedad/${propiedad.id}`)
      ]);

      const impuestosExistentes = impuestosResponse.data || [];
      const cargosExistentes = cargosResponse.data || [];

      // Cargar campos para cada impuesto y mapear impuestos seleccionados
      const impuestosConCampos = await Promise.all(
        impuestosExistentes.map(async (imp) => {
          const campos = await cargarCamposTipoImpuesto(imp.tipoImpuestoId);
          // Cargar valores de campos existentes
          let valoresCampos = {};
          try {
            const camposResponse = await api.get(`/propiedad-impuesto-campos/propiedad-impuesto/${imp.id}`);
            const camposExistentes = camposResponse.data || [];
            camposExistentes.forEach(campo => {
              valoresCampos[campo.tipoCampoId] = campo.valor || '';
            });
          } catch (error) {
            console.error('Error al cargar valores de campos:', error);
          }
          // Inicializar campos vacíos para los que no tienen valor
          campos.forEach(campo => {
            if (!valoresCampos.hasOwnProperty(campo.id)) {
              valoresCampos[campo.id] = '';
            }
          });
          return {
            tipoImpuestoId: imp.tipoImpuestoId,
            periodicidadId: imp.periodicidadId || null,
            propiedadImpuestoId: imp.id, // Guardar el ID para actualizar campos después
            campos: valoresCampos,
            titularModo: imp.titularModo || 'OTRO',
            titularPropietarioId: imp.titularPropietarioId ?? '',
            titularOtroNombre: imp.titularOtroNombre ?? '',
            titularOtroApellido: imp.titularOtroApellido ?? '',
          };
        })
      );

      setImpuestosSeleccionados(impuestosConCampos);

      // Mapear cargos seleccionados
      // Mapear cargos seleccionados con sus campos
      const cargosConCampos = await Promise.all(
        cargosExistentes.map(async (cargo) => {
          const campos = await cargarCamposTipoCargo(cargo.tipoCargoId);
          // Cargar valores de campos existentes
          let valoresCampos = {};
          try {
            const camposResponse = await api.get(`/propiedad-cargo-campos/propiedad-cargo/${cargo.id}`);
            const camposExistentes = camposResponse.data || [];
            camposExistentes.forEach(campo => {
              valoresCampos[campo.tipoCampoId] = campo.valor || '';
            });
          } catch (error) {
            console.error('Error al cargar campos del cargo:', error);
          }

          const camposIniciales = {};
          campos.forEach(campo => {
            camposIniciales[campo.id] = valoresCampos[campo.id] || '';
          });

          // Usar la periodicidad guardada en el cargo, o la del tipo de cargo como fallback
          const tipoCargo = tiposCargo?.find(tc => tc.id === cargo.tipoCargoId);
          const periodicidadId = cargo.periodicidadId ||
            cargo.periodicidad?.id ||
            tipoCargo?.periodicidadId ||
            tipoCargo?.periodicidad?.id ||
            null;

          return {
            tipoCargoId: cargo.tipoCargoId,
            periodicidadId: periodicidadId,
            propiedadCargoId: cargo.id,
            campos: camposIniciales
          };
        })
      );
      setCargosSeleccionados(cargosConCampos);
    } catch (error) {
      console.error('Error al cargar impuestos y cargos:', error);
      setImpuestosSeleccionados([]);
      setCargosSeleccionados([]);
    }

    // Cargar los documentos existentes
    try {
      const documentosResponse = await api.get(`/documentos-propiedad/propiedad/${propiedad.id}`);
      const documentosExistentes = documentosResponse.data || [];
      // Inicializar documentación con los documentos existentes
      // Esperar a que los parámetros estén cargados
      if (tiposDocumentoPropiedad && tiposDocumentoPropiedad.length > 0) {
        inicializarDocumentacion(documentosExistentes);
      } else {
        // Si los tipos aún no están cargados, esperar un poco más
        setTimeout(() => {
          inicializarDocumentacion(documentosExistentes);
        }, 300);
      }
    } catch (error) {
      console.error('Error al cargar documentos:', error);
      // Si hay error, inicializar sin documentos existentes (todos en false)
      if (tiposDocumentoPropiedad && tiposDocumentoPropiedad.length > 0) {
        inicializarDocumentacion([]);
      } else {
        setTimeout(() => {
          inicializarDocumentacion([]);
        }, 300);
      }
    }
  };

  // Efecto para inicializar documentación cuando se abre el diálogo para nueva propiedad
  useEffect(() => {
    if (open && !editing && tiposDocumentoPropiedad && tiposDocumentoPropiedad.length > 0 && documentacion.length === 0) {
      inicializarDocumentacion([]);
    }
  }, [open, editing, tiposDocumentoPropiedad]);

  // Efecto para cargar campos de cargos seleccionados
  useEffect(() => {
    const cargarCampos = async () => {
      for (const cargo of cargosSeleccionados) {
        if (!camposPorTipoCargo[cargo.tipoCargoId]) {
          await cargarCamposTipoCargo(cargo.tipoCargoId);
        }
      }
    };
    if (cargosSeleccionados.length > 0) {
      cargarCampos();
    }
  }, [cargosSeleccionados]);

  // Efecto para cargar campos de impuestos seleccionados
  useEffect(() => {
    const cargarCampos = async () => {
      for (const impuesto of impuestosSeleccionados) {
        if (!camposPorTipoImpuesto[impuesto.tipoImpuestoId]) {
          await cargarCamposTipoImpuesto(impuesto.tipoImpuestoId);
        }
      }
    };
    if (impuestosSeleccionados.length > 0) {
      cargarCampos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impuestosSeleccionados.map(imp => imp.tipoImpuestoId).join(',')]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar formulario antes de enviar
    if (!validateForm()) {
      return;
    }
    const errSeguroValidacion = validarSeguroFormIncompleto();
    if (errSeguroValidacion) {
      setErrorMessage(errSeguroValidacion);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    const consorcioIdResolved =
      formData.consorcioId === '' || formData.consorcioId == null
        ? null
        : parseInt(formData.consorcioId, 10);

    const dataToSend = {
      propietarioIds: formData.propietarioIds.map(id => parseInt(id)),
      dirCalle: formData.dirCalle.trim(),
      dirNro: formData.dirNro.trim(),
      dirPiso: formData.dirPiso?.trim() || null,
      dirDepto: formData.dirDepto?.trim() || null,
      provinciaId: formData.provinciaId ? parseInt(formData.provinciaId) : null,
      localidadId: formData.localidadId ? parseInt(formData.localidadId) : null,
      tipoPropiedadId: formData.tipoPropiedadId ? parseInt(formData.tipoPropiedadId) : null,
      estadoPropiedadId: formData.estadoPropiedadId ? parseInt(formData.estadoPropiedadId) : null,
      destinoId: formData.destinoId ? parseInt(formData.destinoId) : null,
      ambientesId: formData.ambientesId ? parseInt(formData.ambientesId) : null,
      codigoInterno: formData.codigoInterno?.trim() || null,
      descripcion: formData.descripcion?.trim() || null,
      superficieM2: formData.superficieM2 === '' || formData.superficieM2 == null ? null : formData.superficieM2,
      administraImpuestosInmobiliaria: Boolean(formData.administraImpuestosInmobiliaria),
      consorcioId: consorcioIdResolved,
    };

    try {
      let propiedadId;

      if (editing?.id) {
        // Actualizar propiedad
        const response = await updateMutation.mutateAsync({ id: editing.id, data: dataToSend });
        propiedadId = editing.id;
      } else {
        // Crear propiedad
        const response = await createMutation.mutateAsync(dataToSend);
        propiedadId = response.data.id;
      }

      // Guardar impuestos y cargos solo si el usuario tiene permiso (no en modo readonly)
      if (!readonlyServicios) {
        let impuestosGuardados = [];
        try {
          const impuestosResponse = await api.post(`/propiedad-impuestos/propiedad/${propiedadId}`, {
            impuestos: impuestosSeleccionados.map((imp) => ({
              tipoImpuestoId: imp.tipoImpuestoId,
              periodicidadId: imp.periodicidadId,
              titularModo: imp.titularModo || null,
              titularPropietarioId:
                imp.titularModo === 'PROPIETARIO' && imp.titularPropietarioId !== '' && imp.titularPropietarioId != null
                  ? imp.titularPropietarioId
                  : null,
              titularOtroNombre: imp.titularModo === 'OTRO' ? (imp.titularOtroNombre || '').trim() || null : null,
              titularOtroApellido: imp.titularModo === 'OTRO' ? (imp.titularOtroApellido || '').trim() || null : null,
            })),
          });
          impuestosGuardados = impuestosResponse.data || [];
        } catch (error) {
          console.error('Error al guardar impuestos:', error);
          throw new Error(error.response?.data?.error || 'Error al guardar impuestos');
        }

        // Guardar valores de campos de los impuestos
        try {
          for (const impuestoSeleccionado of impuestosSeleccionados) {
            // Si es edición, usar el ID existente, sino buscar en los impuestos guardados
            const propiedadImpuestoId = impuestoSeleccionado.propiedadImpuestoId ||
              impuestosGuardados.find(imp => imp.tipoImpuestoId === impuestoSeleccionado.tipoImpuestoId)?.id;

            if (propiedadImpuestoId && impuestoSeleccionado.campos) {
              const camposAGuardar = Object.entries(impuestoSeleccionado.campos)
                .filter(([_, valor]) => valor && valor.trim() !== '')
                .map(([tipoCampoId, valor]) => ({
                  tipoCampoId: parseInt(tipoCampoId),
                  valor: valor.trim()
                }));

              // Guardar todos los campos (incluso vacíos para poder limpiarlos)
              await api.post(`/propiedad-impuesto-campos/propiedad-impuesto/${propiedadImpuestoId}`, {
                campos: camposAGuardar
              });
            }
          }
        } catch (error) {
          console.error('Error al guardar valores de campos:', error);
          // No lanzar error, solo loguear, para no bloquear el guardado de la propiedad
        }

        try {
          // Guardar cargos
          const cargosResponse = await api.post(`/propiedad-cargos/propiedad/${propiedadId}`, {
            cargos: cargosSeleccionados.map(cargo => ({
              tipoCargoId: cargo.tipoCargoId,
              periodicidadId: cargo.periodicidadId || null
            }))
          });

          // Guardar campos de cada cargo
          for (const cargoSeleccionado of cargosSeleccionados) {
            // Buscar el ID del PropiedadCargo recién creado/actualizado
            const propiedadCargo = cargosResponse.data.find(
              c => c.tipoCargoId === cargoSeleccionado.tipoCargoId
            );

            if (propiedadCargo && cargoSeleccionado.campos) {
              const propiedadCargoId = cargoSeleccionado.propiedadCargoId || propiedadCargo.id;

              const camposAGuardar = Object.entries(cargoSeleccionado.campos)
                .filter(([_, valor]) => valor && valor.trim() !== '')
                .map(([tipoCampoId, valor]) => ({
                  tipoCampoId: parseInt(tipoCampoId),
                  valor: valor.trim()
                }));

              // Guardar todos los campos (incluso vacíos para poder limpiarlos)
              await api.post(`/propiedad-cargo-campos/propiedad-cargo/${propiedadCargoId}`, {
                campos: camposAGuardar
              });
            }
          }
        } catch (error) {
          console.error('Error al guardar cargos:', error);
          throw new Error(error.response?.data?.error || 'Error al guardar cargos');
        }
      }

      // Guardar documentos de la propiedad solo si el usuario tiene permiso (no en modo readonly)
      let errorDocumentos = null;

      if (!readonlyDocumentos && documentacion && Array.isArray(documentacion) && documentacion.length > 0) {
        try {
          const documentosAGuardar = documentacion
            .filter(doc => doc && doc.tipoDocumentoPropiedadId)
            .map(doc => ({
              tipoDocumentoPropiedadId: doc.tipoDocumentoPropiedadId,
              necesario: Boolean(doc.necesario),
              recibido: Boolean(doc.recibido)
            }));

          if (documentosAGuardar.length > 0) {
            await api.post(`/documentos-propiedad/propiedad/${propiedadId}`, {
              documentos: documentosAGuardar
            });
          }
        } catch (error) {
          console.error('Error al guardar documentos:', error);
          errorDocumentos = error.response?.data?.error || error.message || 'Error al guardar documentos';
        }
      }

      let errorSeguro = null;
      if (!readonlySeguros && propiedadId) {
        try {
          await persistSeguroSiCorresponde(propiedadId);
        } catch (error) {
          console.error('Error al guardar póliza de seguro:', error);
          errorSeguro = error.response?.data?.error || error.message || 'Error al guardar la póliza de seguro';
        }
      }

      queryClient.invalidateQueries(['propiedades']);
      // Invalidar también los documentos de la propiedad para que se recarguen si se consultan
      queryClient.invalidateQueries(['documentos-propiedad']);

      // Si viene de Propietarios, asociar automáticamente
      const propietarioIdParaAsociar = sessionStorage.getItem('propietarioIdParaAsociar');
      if (propietarioIdParaAsociar && !editing) {
        try {
          await api.post(`/propietarios/${propietarioIdParaAsociar}/propiedades`, {
            propiedadIds: [propiedadId]
          });
          // NO eliminar propietarioIdParaAsociar todavía, se eliminará cuando se cierre el diálogo de Propietarios
          queryClient.invalidateQueries(['propietarios']);
        } catch (error) {
          console.error('Error al asociar propiedad al propietario:', error);
        }
      }

      // Si hubo error solo en documentos o seguro, mostrar advertencia pero cerrar el diálogo
      if (errorDocumentos || errorSeguro) {
        const partes = [];
        if (errorDocumentos) partes.push(`documentos: ${errorDocumentos}`);
        if (errorSeguro) partes.push(`seguro: ${errorSeguro}`);
        setErrorMessage(`La propiedad se guardó correctamente, pero hubo un error al guardar ${partes.join(' · ')}`);
        setSnackbarSeverity('warning');
        setSnackbarOpen(true);
      } else {
        const vieneDePropietarios = sessionStorage.getItem('propietarioIdParaAsociar');

        // Prioridad 1: Si viene del Dashboard (volverAUrl), volver ahí
        if (volverAUrl) {
          setOpen(false);
          resetForm();
          navigate(volverAUrl);
          setVolverAUrl(null);
          // Prioridad 2: Si viene de Propietarios, navegar ANTES de cerrar el diálogo
        } else if (vieneDePropietarios && !editing) {
          // Guardar un flag para indicar que se creó exitosamente
          sessionStorage.setItem('propiedadCreadaExitosamente', 'true');
          // No eliminar propietarioIdParaAsociar todavía, se eliminará cuando se cierre el diálogo de Propietarios
          setOpen(false);
          resetForm();
          // Usar timestamp para forzar navegación única
          navigate(`/clientes?tab=0&returnFromProp=${Date.now()}`);
          // El mensaje de éxito se mostrará cuando se reabra el diálogo de Propietarios
        } else {
          setOpen(false);
          resetForm();
          setSuccessMessage(editing?.id ? 'Propiedad actualizada exitosamente' : 'Propiedad creada exitosamente');
          setSnackbarSeverity('success');
          setSnackbarOpen(true);
        }
      }
    } catch (error) {
      console.error('❌ ERROR GENERAL al guardar:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Error al guardar la propiedad y cuentas tributarias';
      setErrorMessage(errorMessage);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  return (
    <Box>
      <ConfirmDialog
        open={!!propiedadAEliminar}
        onClose={() => setPropiedadAEliminar(null)}
        title="Eliminar propiedad"
        message="¿Está seguro de eliminar esta propiedad?"
        confirmLabel="Eliminar"
        confirmColor="error"
        loading={deleteMutation.isPending}
        onConfirm={() => propiedadAEliminar && deleteMutation.mutate(propiedadAEliminar.id)}
      />
      <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 1, columnGap: 1.5, mb: 1 }}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' }, m: 0 }}>
          Propiedades
        </Typography>
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          {isLoading
            ? '…'
            : totalRegistros === 1
              ? '1 propiedad'
              : `${totalRegistros} propiedades`}
        </Typography>
      </Box>
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', md: 'center' },
        mb: 2,
        gap: 2
      }}>
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          alignItems: { xs: 'stretch', sm: 'center' },
          flexWrap: 'wrap',
          flex: 1
        }}>
          <TextField
            size="small"
            placeholder="Buscar por dirección, localidad, propietario..."
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
          <FormControl size="small" sx={{ width: { xs: '100%', sm: 180 } }}>
            <InputLabel>Estado</InputLabel>
            <Select
              value={filtroEstado}
              label="Estado"
              onChange={(e) => { setFiltroEstado(e.target.value); setPage(0); }}
            >
              <MenuItem value="">Todas</MenuItem>
              {estadosPropiedad?.map((estado) => (
                <MenuItem key={estado.id} value={estado.id}>
                  {estado.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <RequirePermission codigo="propiedades.crear">
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen} sx={{ height: 36, py: 0, px: 1.5, fontSize: '0.875rem', '& .MuiButton-startIcon': { marginRight: 0.5 }, width: { xs: '100%', md: 'auto' } }}>
            Nueva Propiedad
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
              <TableCell sortDirection={orderBy === 'direccion' ? order : false}>
                <TableSortLabel active={orderBy === 'direccion'} direction={orderBy === 'direccion' ? order : 'asc'} onClick={() => handleSort('direccion')}>
                  Dirección
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'localidad' ? order : false}>
                <TableSortLabel active={orderBy === 'localidad'} direction={orderBy === 'localidad' ? order : 'asc'} onClick={() => handleSort('localidad')}>
                  Localidad
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'propietarios' ? order : false}>
                <TableSortLabel active={orderBy === 'propietarios'} direction={orderBy === 'propietarios' ? order : 'asc'} onClick={() => handleSort('propietarios')}>
                  Propietarios
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'tipo' ? order : false}>
                <TableSortLabel active={orderBy === 'tipo'} direction={orderBy === 'tipo' ? order : 'asc'} onClick={() => handleSort('tipo')}>
                  Tipo
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'estado' ? order : false}>
                <TableSortLabel active={orderBy === 'estado'} direction={orderBy === 'estado' ? order : 'asc'} onClick={() => handleSort('estado')}>
                  Estado
                </TableSortLabel>
              </TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {listaPagina.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {searchDebounced.trim() ? 'No se encontraron propiedades con ese criterio.' : 'No hay propiedades cargadas.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              listaPagina.map((propiedad) => {
                const direccionCompleta = `${propiedad.dirCalle} ${propiedad.dirNro}${propiedad.dirPiso ? `, Piso ${propiedad.dirPiso}` : ''}${propiedad.dirDepto ? `, Depto ${propiedad.dirDepto}` : ''}`;
                const localidadNombre = propiedad.localidad?.nombre || propiedad.provincia?.nombre || '';

                // Preparar lista de propietarios
                const propietariosList = propiedad.propietarios?.map(p =>
                  p.propietario.razonSocial ||
                  `${p.propietario.nombre || ''} ${p.propietario.apellido || ''}`.trim()
                ).filter(Boolean) || [];

                const propietariosNombres = propietariosList.join(', ');

                // Formatear para mostrar: primer propietario + "y N más" si hay más de uno
                let propietariosDisplay = '';
                let tooltipText = '';

                if (propietariosList.length === 0) {
                  propietariosDisplay = <em style={{ color: '#999' }}>Sin propietarios</em>;
                } else if (propietariosList.length === 1) {
                  propietariosDisplay = propietariosList[0];
                } else {
                  const primero = propietariosList[0];
                  const cantidadRestantes = propietariosList.length - 1;
                  propietariosDisplay = `${primero} y ${cantidadRestantes} más`;
                  tooltipText = propietariosNombres;
                }

                const estadoChipProps = getEstadoChipProps(propiedad.estadoPropiedad?.nombre);

                return (
                  <TableRow key={propiedad.id}>
                    <TableCell>{direccionCompleta}</TableCell>
                    <TableCell>{localidadNombre}</TableCell>
                    <TableCell>
                      {tooltipText ? (
                        <Tooltip title={tooltipText} arrow>
                          <span>{propietariosDisplay}</span>
                        </Tooltip>
                      ) : (
                        propietariosDisplay
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {getTipoIcon(propiedad.tipoPropiedad?.nombre)}
                        <span>{propiedad.tipoPropiedad?.nombre || '-'}</span>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {propiedad.estadoPropiedad?.nombre ? (
                        <Chip
                          label={estadoChipProps.label}
                          color={estadoChipProps.color}
                          size="small"
                          sx={{ fontWeight: 500 }}
                        />
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleVerPerfil(propiedad)} title="Ver perfil" sx={{ padding: '4px' }}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                      <RequirePermission codigo="propiedades.editar">
                        <IconButton size="small" onClick={() => handleEdit(propiedad)} title="Editar" sx={{ padding: '4px' }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </RequirePermission>
                      <RequirePermission codigo="propiedades.eliminar">
                        <IconButton size="small" color="error" onClick={() => setPropiedadAEliminar(propiedad)} title="Eliminar" sx={{ padding: '4px' }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </RequirePermission>
                    </TableCell>
                  </TableRow>
                );
              })
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
            {searchDebounced.trim() ? 'No se encontraron propiedades con ese criterio.' : 'No hay propiedades cargadas.'}
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {listaPagina.map((propiedad) => (
              <Grid item xs={12} key={propiedad.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="h6" fontWeight={600}>
                          {`${propiedad.dirCalle} ${propiedad.dirNro}${propiedad.dirPiso ? `, Piso ${propiedad.dirPiso}` : ''}${propiedad.dirDepto ? `, Depto ${propiedad.dirDepto}` : ''}`}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap' }}>
                        <IconButton size="small" onClick={() => handleVerPerfil(propiedad)} sx={{ mr: 0.5 }} title="Ver perfil">
                          <VisibilityIcon />
                        </IconButton>
                        <RequirePermission codigo="propiedades.editar">
                          <IconButton size="small" onClick={() => handleEdit(propiedad)} sx={{ mr: 0.5 }} title="Editar">
                            <EditIcon />
                          </IconButton>
                        </RequirePermission>
                        <RequirePermission codigo="propiedades.eliminar">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setPropiedadAEliminar(propiedad)}
                            title="Eliminar"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </RequirePermission>
                      </Box>
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {(propiedad.localidad || propiedad.provincia) && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LocationCityIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            <strong>Localidad:</strong> {propiedad.localidad?.nombre || propiedad.provincia?.nombre || ''}
                          </Typography>
                        </Box>
                      )}
                      {propiedad.propietarios && propiedad.propietarios.length > 0 ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            <strong>Propietarios:</strong>{' '}
                            {(() => {
                              const propietariosList = propiedad.propietarios.map(p =>
                                p.propietario.razonSocial ||
                                `${p.propietario.nombre || ''} ${p.propietario.apellido || ''}`.trim()
                              ).filter(Boolean);

                              const propietariosNombres = propietariosList.join(', ');

                              if (propietariosList.length === 1) {
                                return propietariosList[0];
                              } else if (propietariosList.length > 1) {
                                const primero = propietariosList[0];
                                const cantidadRestantes = propietariosList.length - 1;
                                return (
                                  <Tooltip title={propietariosNombres} arrow>
                                    <span>{`${primero} y ${cantidadRestantes} más`}</span>
                                  </Tooltip>
                                );
                              }
                              return '';
                            })()}
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            <strong>Propietarios:</strong> <em style={{ color: '#999' }}>Sin propietarios</em>
                          </Typography>
                        </Box>
                      )}
                      {propiedad.tipoPropiedad && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getTipoIcon(propiedad.tipoPropiedad.nombre)}
                          <Typography variant="body2">
                            <strong>Tipo:</strong> {propiedad.tipoPropiedad.nombre}
                          </Typography>
                        </Box>
                      )}
                      {propiedad.estadoPropiedad && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={getEstadoChipProps(propiedad.estadoPropiedad.nombre).label}
                            size="small"
                            color={getEstadoChipProps(propiedad.estadoPropiedad.nombre).color}
                            sx={{ fontWeight: 500 }}
                          />
                        </Box>
                      )}
                      {propiedad.ambientes && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">
                            <strong>Ambientes:</strong> {propiedad.ambientes.nombre}
                          </Typography>
                        </Box>
                      )}
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
        onClose={handleCerrarEdicion}
        maxWidth="lg"
        fullWidth
      >
        <form onSubmit={handleSubmit} noValidate>
          <DialogTitle>
            {editing ? 'Editar Propiedad' : 'Nueva Propiedad'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                {/* Fila 1: Dirección (suma 12) */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Calle"
                    required
                    fullWidth
                    size="small"
                    value={formData.dirCalle}
                    onChange={(e) => {
                      setFormData({ ...formData, dirCalle: e.target.value });
                      if (errors.dirCalle) {
                        setErrors({ ...errors, dirCalle: '' });
                      }
                    }}
                    error={!!errors.dirCalle}
                    helperText={errors.dirCalle}
                  />
                </Grid>
                <Grid item xs={4} sm={2}>
                  <TextField
                    label="Nro"
                    required
                    fullWidth
                    size="small"
                    value={formData.dirNro}
                    onChange={(e) => {
                      setFormData({ ...formData, dirNro: e.target.value });
                      if (errors.dirNro) {
                        setErrors({ ...errors, dirNro: '' });
                      }
                    }}
                    error={!!errors.dirNro}
                    helperText={errors.dirNro}
                  />
                </Grid>
                <Grid item xs={4} sm={2}>
                  <TextField
                    label="Piso"
                    fullWidth
                    size="small"
                    value={formData.dirPiso}
                    onChange={(e) => setFormData({ ...formData, dirPiso: e.target.value })}
                  />
                </Grid>
                <Grid item xs={4} sm={2}>
                  <TextField
                    label="Depto"
                    fullWidth
                    size="small"
                    value={formData.dirDepto}
                    onChange={(e) => setFormData({ ...formData, dirDepto: e.target.value })}
                  />
                </Grid>

                {/* Fila 2: Ubicación (suma 12) */}
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small" error={!!errors.provinciaId}>
                    <InputLabel>Provincia</InputLabel>
                    <Select
                      value={formData.provinciaId || ''}
                      onChange={(e) => {
                        setFormData({ ...formData, provinciaId: e.target.value || '', localidadId: '' });
                        if (errors.provinciaId) {
                          setErrors({ ...errors, provinciaId: '' });
                        }
                      }}
                      label="Provincia"
                    >
                      <MenuItem value="">
                        <em>Seleccionar provincia</em>
                      </MenuItem>
                      {provincias?.map((prov) => (
                        <MenuItem key={prov.id} value={prov.id}>
                          {prov.nombre}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.provinciaId && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                        {errors.provinciaId}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Localidad</InputLabel>
                    <Select
                      value={formData.localidadId ? String(formData.localidadId) : ''}
                      onChange={(e) => {
                        setFormData({ ...formData, localidadId: e.target.value || '' });
                      }}
                      label="Localidad"
                      disabled={!formData.provinciaId}
                    >
                      <MenuItem value="">
                        <em>Seleccionar localidad</em>
                      </MenuItem>
                      {localidades?.map((loc) => (
                        <MenuItem key={loc.id} value={String(loc.id)}>
                          {loc.nombre}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Fila 3: Tipo, Estado, Destino, Ambientes, Superficie (5 columnas en desktop) */}
                <Grid item xs={12}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, minmax(0, 1fr))',
                        md: 'repeat(5, minmax(0, 1fr))',
                      },
                      gap: 2,
                    }}
                  >
                    <FormControl fullWidth size="small">
                      <InputLabel>Tipo de Propiedad</InputLabel>
                      <Select
                        value={formData.tipoPropiedadId || ''}
                        onChange={(e) => setFormData({ ...formData, tipoPropiedadId: e.target.value || '' })}
                        label="Tipo de Propiedad"
                      >
                        <MenuItem value="">
                          <em>Seleccionar tipo</em>
                        </MenuItem>
                        {tiposPropiedad && tiposPropiedad.length > 0 ? (
                          tiposPropiedad.map((tipo) => (
                            <MenuItem key={tipo.id} value={tipo.id}>
                              {tipo.nombre}
                            </MenuItem>
                          ))
                        ) : (
                          <MenuItem disabled>No hay tipos disponibles</MenuItem>
                        )}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                      <InputLabel>Estado</InputLabel>
                      <Select
                        value={formData.estadoPropiedadId || ''}
                        onChange={async (e) => {
                          const nuevoEstadoId = e.target.value || '';
                          const nuevoEstado = estadosPropiedad?.find(est => est.id === parseInt(nuevoEstadoId));
                          const nuevoEstadoCodigo = nuevoEstado?.codigo;

                          setFormData({ ...formData, estadoPropiedadId: nuevoEstadoId });

                          const tipoCargoAlquiler = tiposCargo?.find(tc => tc.codigo === 'ALQUILER');
                          if (nuevoEstadoCodigo === 'ALQ' && tipoCargoAlquiler) {
                            const periodicidadMensual = periodicidadesImpuesto?.find(p => p.codigo === '1_MENSUAL');
                            const cargoAlquilerExistente = cargosSeleccionados.find(
                              cargo => cargo.tipoCargoId === tipoCargoAlquiler.id
                            );
                            if (!cargoAlquilerExistente) {
                              const campos = await cargarCamposTipoCargo(tipoCargoAlquiler.id);
                              const camposIniciales = {};
                              campos.forEach(campo => { camposIniciales[campo.id] = ''; });
                              setCargosSeleccionados([
                                ...cargosSeleccionados,
                                {
                                  tipoCargoId: tipoCargoAlquiler.id,
                                  periodicidadId: periodicidadMensual?.id || tipoCargoAlquiler.periodicidadId || null,
                                  propiedadCargoId: null,
                                  campos: camposIniciales
                                }
                              ]);
                            } else if (cargoAlquilerExistente && !cargoAlquilerExistente.periodicidadId && periodicidadMensual) {
                              setCargosSeleccionados(
                                cargosSeleccionados.map(cargo =>
                                  cargo.tipoCargoId === tipoCargoAlquiler.id
                                    ? { ...cargo, periodicidadId: periodicidadMensual.id }
                                    : cargo
                                )
                              );
                            }
                          } else if (nuevoEstadoCodigo !== 'ALQ' && tipoCargoAlquiler) {
                            setCargosSeleccionados(
                              cargosSeleccionados.filter(cargo => cargo.tipoCargoId !== tipoCargoAlquiler.id)
                            );
                          }
                        }}
                        label="Estado"
                      >
                        <MenuItem value="">
                          <em>Seleccionar estado</em>
                        </MenuItem>
                        {estadosPropiedad && estadosPropiedad.length > 0 ? (
                          estadosPropiedad.map((estado) => (
                            <MenuItem key={estado.id} value={estado.id}>
                              {estado.nombre}
                            </MenuItem>
                          ))
                        ) : (
                          <MenuItem disabled>No hay estados disponibles</MenuItem>
                        )}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                      <InputLabel>Destino</InputLabel>
                      <Select
                        value={formData.destinoId || ''}
                        onChange={(e) => setFormData({ ...formData, destinoId: e.target.value || '' })}
                        label="Destino"
                      >
                        <MenuItem value="">
                          <em>Seleccionar destino</em>
                        </MenuItem>
                        {destinosPropiedad && destinosPropiedad.length > 0 ? (
                          destinosPropiedad.map((destino) => (
                            <MenuItem key={destino.id} value={destino.id}>
                              {destino.nombre}
                            </MenuItem>
                          ))
                        ) : (
                          <MenuItem disabled>No hay destinos disponibles</MenuItem>
                        )}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                      <InputLabel>Ambientes</InputLabel>
                      <Select
                        value={formData.ambientesId || ''}
                        onChange={(e) => setFormData({ ...formData, ambientesId: e.target.value || '' })}
                        label="Ambientes"
                      >
                        <MenuItem value="">
                          <em>Seleccionar ambientes</em>
                        </MenuItem>
                        {ambientesPropiedad && ambientesPropiedad.length > 0 ? (
                          ambientesPropiedad.map((ambiente) => (
                            <MenuItem key={ambiente.id} value={ambiente.id}>
                              {ambiente.nombre}
                            </MenuItem>
                          ))
                        ) : (
                          <MenuItem disabled>No hay ambientes disponibles</MenuItem>
                        )}
                      </Select>
                    </FormControl>
                    <TextField
                      label="Superficie (m²)"
                      fullWidth
                      size="small"
                      value={formData.superficieM2}
                      onChange={(e) => setFormData({ ...formData, superficieM2: e.target.value })}
                      placeholder="Ej. 45,5"
                      inputProps={{ inputMode: 'decimal' }}
                    />
                  </Box>
                </Grid>

                {/* Fila 4: Código interno + administra impuestos */}
                <Grid item xs={12} sm={5} md={4}>
                  <TextField
                    label="Código Interno"
                    fullWidth
                    size="small"
                    value={formData.codigoInterno}
                    onChange={(e) => setFormData({ ...formData, codigoInterno: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={7} md={8} sx={{ display: 'flex', alignItems: 'center' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(formData.administraImpuestosInmobiliaria)}
                        onChange={(e) =>
                          setFormData({ ...formData, administraImpuestosInmobiliaria: e.target.checked })
                        }
                        color="primary"
                      />
                    }
                    label="La inmobiliaria administra los impuestos de esta propiedad"
                  />
                </Grid>

                {/* Fila 5: Descripción (ancho completo) */}
                <Grid item xs={12}>
                  <TextField
                    label="Descripción"
                    fullWidth
                    multiline
                    minRows={2}
                    maxRows={4}
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    placeholder="Ingrese una descripción de la propiedad..."
                  />
                </Grid>

              </Grid>

              {/* Sección de Tabs: Propietarios, Impuestos y Cargos, Documentación */}
              <Box sx={{ mt: 3 }}>
                <Tabs
                  value={propiedadTabKey}
                  onChange={(e, newValue) => setPropiedadTabKey(newValue)}
                  variant="scrollable"
                  scrollButtons="auto"
                  allowScrollButtonsMobile
                  sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Tab label="Propietarios" value="propietarios" />
                  <Tab label="Impuestos y Cargos" value="impuestos" />
                  <Tab label="Documentación" value="documentacion" />
                </Tabs>

                {/* Tab Panel: Propietarios */}
                {propiedadTabKey === 'propietarios' && (
                  <Box>
                    {/* Selector de propietarios existentes */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: { xs: 'stretch', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' } }}>
                      <FormControl fullWidth size="small" sx={{ flex: { xs: 'none', sm: 1 } }}>
                        <InputLabel>Seleccionar Propietario</InputLabel>
                        <Select
                          value={propietarioSeleccionado || ''}
                          label="Seleccionar Propietario"
                          onChange={(e) => setPropietarioSeleccionado(e.target.value)}
                        >
                          {Array.isArray(propietarios) && propietarios.length > 0 ? (
                            propietarios
                              .filter(p => !formData.propietarioIds.includes(p.id))
                              .map((propietario) => {
                                const personaFisicaId = tiposPersona?.find(tp => tp.codigo === 'FISICA')?.id;
                                const esFisica = personaFisicaId != null && propietario.tipoPersona?.id === personaFisicaId;
                                const nombreCompleto = esFisica
                                  ? `${propietario.nombre || ''} ${propietario.apellido || ''}`.trim() || propietario.razonSocial || 'Sin nombre'
                                  : propietario.razonSocial || `${propietario.nombre || ''} ${propietario.apellido || ''}`.trim() || 'Sin nombre';
                                return (
                                  <MenuItem key={propietario.id} value={propietario.id}>
                                    {nombreCompleto}
                                  </MenuItem>
                                );
                              })
                          ) : (
                            <MenuItem disabled>No hay propietarios disponibles</MenuItem>
                          )}
                        </Select>
                      </FormControl>
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{ minWidth: 'auto', height: '40px', px: 1.5, width: { xs: '100%', sm: 'auto' } }}
                        onClick={() => {
                          if (propietarioSeleccionado) {
                            const propietarioId = parseInt(propietarioSeleccionado);
                            if (!formData.propietarioIds.includes(propietarioId)) {
                              setFormData({
                                ...formData,
                                propietarioIds: [...formData.propietarioIds, propietarioId]
                              });
                              setPropietarioSeleccionado('');
                            }
                          }
                        }}
                        disabled={!propietarioSeleccionado}
                      >
                        Agregar
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        sx={{ minWidth: 'auto', height: '40px', px: 1.5, width: { xs: '100%', sm: 'auto' } }}
                        startIcon={<AddIcon sx={{ fontSize: '1rem' }} />}
                        onClick={() => {
                          // Guardar el ID de la propiedad en sessionStorage para asociar después
                          if (editing?.id) {
                            sessionStorage.setItem('propiedadIdParaAsociar', editing.id.toString());
                            sessionStorage.setItem('propiedadEnEdicion', JSON.stringify(editing));
                            // Guardar el estado completo del formulario (incluyendo impuestos, cargos, documentación, tab)
                            const estadoCompleto = {
                              formData: formData,
                              impuestosSeleccionados: impuestosSeleccionados,
                              cargosSeleccionados: cargosSeleccionados,
                              documentacion: documentacion,
                              consorcioDraft: consorcioDraft,
                              propiedadTabKey: propiedadTabKey
                            };
                            sessionStorage.setItem('propiedadEstadoCompleto', JSON.stringify(estadoCompleto));
                          } else {
                            // Si es nueva propiedad, guardar un flag para asociar después de crear
                            sessionStorage.setItem('propiedadNuevaParaAsociar', 'true');
                            // Guardar el estado completo del formulario para restaurarlos después
                            const estadoCompleto = {
                              formData: formData,
                              impuestosSeleccionados: impuestosSeleccionados,
                              cargosSeleccionados: cargosSeleccionados,
                              documentacion: documentacion,
                              consorcioDraft: consorcioDraft,
                              propiedadTabKey: propiedadTabKey
                            };
                            sessionStorage.setItem('propiedadEstadoCompleto', JSON.stringify(estadoCompleto));
                          }
                          // Navegar a Propietarios y abrir el diálogo
                          navigate('/clientes?tab=0&openDialog=true');
                        }}
                      >
                        Nuevo Propietario
                      </Button>
                    </Box>

                    {/* Lista de propietarios seleccionados */}
                    {formData.propietarioIds.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {formData.propietarioIds.map((propietarioId) => {
                          const propietario = Array.isArray(propietarios) ? propietarios.find(p => p.id === propietarioId) : null;
                          if (!propietario) return null;
                          const personaFisicaId = tiposPersona?.find(tp => tp.codigo === 'FISICA')?.id;
                          const esFisica = personaFisicaId != null && propietario.tipoPersona?.id === personaFisicaId;
                          const nombreCompleto = esFisica
                            ? `${propietario.nombre || ''} ${propietario.apellido || ''}`.trim() || propietario.razonSocial || 'Sin nombre'
                            : propietario.razonSocial || `${propietario.nombre || ''} ${propietario.apellido || ''}`.trim() || 'Sin nombre';
                          return (
                            <Box
                              key={propietarioId}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                py: 0.5,
                                px: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 0.5,
                                bgcolor: 'background.paper'
                              }}
                            >
                              <Typography variant="body2" sx={{ fontSize: '0.875rem', lineHeight: 1.2 }}>
                                {nombreCompleto}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    propietarioIds: formData.propietarioIds.filter(id => id !== propietarioId)
                                  });
                                }}
                                sx={{ py: 0, px: 0.5 }}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          );
                        })}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center', fontStyle: 'italic' }}>
                        Ningún propietario asignado.
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Tab Panel: Impuestos y Cargos */}
                {propiedadTabKey === 'impuestos' && (
                  <Box sx={{ position: 'relative', minHeight: 120 }}>
                    {readonlyServicios && (
                      <Box
                        aria-hidden
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          zIndex: 100,
                          bgcolor: 'rgba(255,255,255,0.9)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 1,
                          pointerEvents: 'auto',
                        }}
                      >
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', px: 2 }}>
                          No tiene permiso para modificar impuestos y cargos.
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ ...(readonlyServicios && { pointerEvents: 'none', userSelect: 'none', opacity: 0.9 }) }}>
                    {tiposImpuestoPropiedad && tiposImpuestoPropiedad.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {tiposImpuestoPropiedad.map((tipoImpuesto) => {
                          const impuestoSeleccionado = impuestosSeleccionados.find(
                            imp => imp.tipoImpuestoId === tipoImpuesto.id
                          );
                          const estaSeleccionado = !!impuestoSeleccionado;
                          const campos = estaSeleccionado ? (camposPorTipoImpuesto[impuestoSeleccionado.tipoImpuestoId] || []) : [];
                          const estaExpandido = impuestosExpandidos[tipoImpuesto.id] || false;

                          return (
                            <Box
                              key={tipoImpuesto.id}
                              sx={{
                                border: '1px solid',
                                borderColor: estaSeleccionado ? 'primary.light' : 'divider',
                                borderRadius: 1,
                                overflow: 'hidden',
                              }}
                            >
                              {/* Fila del checkbox y nombre */}
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  py: 0.75,
                                  px: 1.5,
                                  bgcolor: estaSeleccionado ? 'action.selected' : 'transparent',
                                  cursor: estaSeleccionado ? 'pointer' : 'default',
                                  '&:hover': { bgcolor: 'action.hover' },
                                  borderTopLeftRadius: 1,
                                  borderTopRightRadius: 1,
                                  borderBottomLeftRadius: estaSeleccionado && estaExpandido ? 0 : 1,
                                  borderBottomRightRadius: estaSeleccionado && estaExpandido ? 0 : 1,
                                }}
                                onClick={() => {
                                  if (readonlyServicios) return;
                                  if (estaSeleccionado) {
                                    setImpuestosExpandidos(prev => ({
                                      ...prev,
                                      [tipoImpuesto.id]: !prev[tipoImpuesto.id]
                                    }));
                                  }
                                }}
                              >
                                <Checkbox
                                  checked={estaSeleccionado}
                                  size="small"
                                  sx={{ py: 0 }}
                                  disabled={readonlyServicios}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={async (e) => {
                                    if (e.target.checked) {
                                      const camposData = await cargarCamposTipoImpuesto(tipoImpuesto.id);
                                      const camposIniciales = {};
                                      camposData.forEach(campo => { camposIniciales[campo.id] = ''; });
                                      const impuestoExistente = impuestosSeleccionados.find(imp => imp.tipoImpuestoId === tipoImpuesto.id);
                                      const periodicidadPorDefecto = impuestoExistente?.periodicidadId || tipoImpuesto.periodicidadId || tipoImpuesto.periodicidad?.id || null;
                                      const titularBase =
                                        impuestoExistente?.titularModo != null
                                          ? {
                                              titularModo: impuestoExistente.titularModo,
                                              titularPropietarioId: impuestoExistente.titularPropietarioId ?? '',
                                              titularOtroNombre: impuestoExistente.titularOtroNombre ?? '',
                                              titularOtroApellido: impuestoExistente.titularOtroApellido ?? '',
                                            }
                                          : titularImpuestoInicial(formData.propietarioIds);
                                      setImpuestosSeleccionados([
                                        ...impuestosSeleccionados.filter(imp => imp.tipoImpuestoId !== tipoImpuesto.id),
                                        {
                                          tipoImpuestoId: tipoImpuesto.id,
                                          periodicidadId: periodicidadPorDefecto,
                                          propiedadImpuestoId: impuestoExistente?.propiedadImpuestoId,
                                          campos: impuestoExistente?.campos || camposIniciales,
                                          ...titularBase,
                                        },
                                      ]);
                                      setImpuestosExpandidos(prev => ({ ...prev, [tipoImpuesto.id]: true }));
                                    } else {
                                      setImpuestosSeleccionados(impuestosSeleccionados.filter(imp => imp.tipoImpuestoId !== tipoImpuesto.id));
                                      setImpuestosExpandidos(prev => ({ ...prev, [tipoImpuesto.id]: false }));
                                    }
                                  }}
                                />
                                <Typography variant="body2" fontWeight={estaSeleccionado ? 600 : 400} sx={{ flex: 1 }}>
                                  {tipoImpuesto.nombre}
                                </Typography>
                                {estaSeleccionado && (
                                  <ExpandMoreIcon
                                    sx={{
                                      transition: 'transform 0.2s',
                                      transform: estaExpandido ? 'rotate(180deg)' : 'rotate(0deg)',
                                      color: 'text.secondary'
                                    }}
                                  />
                                )}
                              </Box>

                              {/* Panel de configuración con Collapse */}
                              <Collapse in={estaSeleccionado && estaExpandido}>
                                <Box
                                  sx={{
                                    px: 2,
                                    pb: 2,
                                    pt: 2.75,
                                    bgcolor: '#f8f9fa',
                                    borderTop: '1px solid',
                                    borderColor: 'divider',
                                    borderBottomLeftRadius: 1,
                                    borderBottomRightRadius: 1,
                                  }}
                                >
                                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
                                    {periodicidadesImpuesto && periodicidadesImpuesto.length > 0 && (
                                      <FormControl size="small" sx={{ width: { xs: '100%', sm: 'calc(20% - 6px)' } }} disabled={readonlyServicios}>
                                        <InputLabel>Periodicidad</InputLabel>
                                        <Select
                                          value={impuestoSeleccionado?.periodicidadId || ''}
                                          onChange={(e) => {
                                            setImpuestosSeleccionados(
                                              impuestosSeleccionados.map(imp =>
                                                imp.tipoImpuestoId === tipoImpuesto.id
                                                  ? { ...imp, periodicidadId: e.target.value || null }
                                                  : imp
                                              )
                                            );
                                          }}
                                          label="Periodicidad"
                                          disabled={readonlyServicios}
                                        >
                                          <MenuItem value=""><em>Sin periodicidad</em></MenuItem>
                                          {periodicidadesImpuesto.map((periodicidad) => (
                                            <MenuItem key={periodicidad.id} value={periodicidad.id}>{periodicidad.nombre}</MenuItem>
                                          ))}
                                        </Select>
                                      </FormControl>
                                    )}
                                    {campos.map((campo) => (
                                      <TextField
                                        key={campo.id}
                                        size="small"
                                        label={campo.nombre}
                                        value={impuestoSeleccionado?.campos?.[campo.id] || ''}
                                        onChange={(e) => {
                                          setImpuestosSeleccionados(
                                            impuestosSeleccionados.map(imp =>
                                              imp.tipoImpuestoId === tipoImpuesto.id
                                                ? { ...imp, campos: { ...imp.campos, [campo.id]: e.target.value } }
                                                : imp
                                            )
                                          );
                                        }}
                                        disabled={readonlyServicios}
                                        sx={{ width: { xs: '100%', sm: 'calc(20% - 6px)' } }}
                                      />
                                    ))}
                                  </Box>

                                  <Divider sx={{ my: 2 }} />
                                  <FormLabel component="legend" sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
                                    Titular del servicio
                                  </FormLabel>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      flexDirection: { xs: 'column', md: 'row' },
                                      alignItems: { xs: 'stretch', md: 'flex-start' },
                                      gap: 1.5,
                                    }}
                                  >
                                    <RadioGroup
                                      row
                                      value={impuestoSeleccionado?.titularModo || 'OTRO'}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setImpuestosSeleccionados(
                                          impuestosSeleccionados.map((imp) => {
                                            if (imp.tipoImpuestoId !== tipoImpuesto.id) return imp;
                                            if (v === 'PROPIETARIO') {
                                              const ids = formData.propietarioIds || [];
                                              return {
                                                ...imp,
                                                titularModo: 'PROPIETARIO',
                                                titularPropietarioId: ids[0] ?? '',
                                                titularOtroNombre: '',
                                                titularOtroApellido: '',
                                              };
                                            }
                                            return {
                                              ...imp,
                                              titularModo: 'OTRO',
                                              titularPropietarioId: '',
                                              titularOtroNombre: imp.titularOtroNombre || '',
                                              titularOtroApellido: imp.titularOtroApellido || '',
                                            };
                                          }),
                                        );
                                      }}
                                      sx={{ minWidth: { md: 220 } }}
                                    >
                                      <FormControlLabel
                                        value="PROPIETARIO"
                                        control={<Radio size="small" disabled={readonlyServicios} />}
                                        label="Propietario"
                                        disabled={readonlyServicios}
                                      />
                                      <FormControlLabel
                                        value="OTRO"
                                        control={<Radio size="small" disabled={readonlyServicios} />}
                                        label="Otro"
                                        disabled={readonlyServicios}
                                      />
                                    </RadioGroup>

                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      {impuestoSeleccionado?.titularModo === 'PROPIETARIO' && (
                                        <Box sx={{ maxWidth: { xs: '100%', md: 460 } }}>
                                          {(formData.propietarioIds || []).length === 0 ? (
                                            <Alert severity="warning" sx={{ py: 0.5 }}>
                                              Agregue al menos un propietario en la pestaña Propietarios, o use «Otro».
                                            </Alert>
                                          ) : (
                                            <FormControl fullWidth size="small" disabled={readonlyServicios}>
                                              <InputLabel>Propietario titular</InputLabel>
                                              <Select
                                                value={impuestoSeleccionado.titularPropietarioId || ''}
                                                label="Propietario titular"
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  setImpuestosSeleccionados(
                                                    impuestosSeleccionados.map((imp) =>
                                                      imp.tipoImpuestoId === tipoImpuesto.id
                                                        ? { ...imp, titularPropietarioId: val ? parseInt(val, 10) : '' }
                                                        : imp,
                                                    ),
                                                  );
                                                }}
                                              >
                                                {(formData.propietarioIds || []).map((pid) => {
                                                  const p = propietarios.find((x) => x.id === pid);
                                                  if (!p) return null;
                                                  return (
                                                    <MenuItem key={pid} value={pid}>
                                                      {etiquetaPropietario(p, tiposPersona)}
                                                    </MenuItem>
                                                  );
                                                })}
                                              </Select>
                                            </FormControl>
                                          )}
                                        </Box>
                                      )}
                                      {impuestoSeleccionado?.titularModo === 'OTRO' && (
                                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, flexWrap: 'wrap' }}>
                                          <TextField
                                            size="small"
                                            label="Apellido"
                                            value={impuestoSeleccionado.titularOtroApellido || ''}
                                            onChange={(e) => {
                                              setImpuestosSeleccionados(
                                                impuestosSeleccionados.map((imp) =>
                                                  imp.tipoImpuestoId === tipoImpuesto.id
                                                    ? { ...imp, titularOtroApellido: e.target.value }
                                                    : imp,
                                                ),
                                              );
                                            }}
                                            disabled={readonlyServicios}
                                            sx={{ flex: { xs: '1 1 100%', sm: '1 1 220px' } }}
                                          />
                                          <TextField
                                            size="small"
                                            label="Nombre"
                                            value={impuestoSeleccionado.titularOtroNombre || ''}
                                            onChange={(e) => {
                                              setImpuestosSeleccionados(
                                                impuestosSeleccionados.map((imp) =>
                                                  imp.tipoImpuestoId === tipoImpuesto.id
                                                    ? { ...imp, titularOtroNombre: e.target.value }
                                                    : imp,
                                                ),
                                              );
                                            }}
                                            disabled={readonlyServicios}
                                            sx={{ flex: { xs: '1 1 100%', sm: '1 1 220px' } }}
                                          />
                                        </Box>
                                      )}
                                    </Box>
                                  </Box>
                                </Box>
                              </Collapse>
                            </Box>
                          );
                        })}
                      </Box>
                    ) : (
                      <Alert severity="info" sx={{ py: 1 }}>No hay tipos de impuesto disponibles.</Alert>
                    )}

                    {tiposCargo && tiposCargo.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1.5 }}>
                        {tiposCargo
                          .filter((tc) => !['ALQUILER', 'GASTO_EXTRA', 'GASTOS_ADMINISTRATIVOS', 'HONORARIOS', 'INCIDENCIA'].includes(tc.codigo))
                          .map((tipoCargo) => {
                            const cargoSeleccionado = cargosSeleccionados.find(
                              cargo => cargo.tipoCargoId === tipoCargo.id
                            );
                            const estaSeleccionado = !!cargoSeleccionado;
                            const esCargoSoloPeriodicidad =
                              tipoCargo.codigo === CARGO_COD_EXPENSAS || tipoCargo.codigo === CARGO_COD_SEGURO;
                            const campos =
                              estaSeleccionado && !esCargoSoloPeriodicidad
                                ? (camposPorTipoCargo[cargoSeleccionado.tipoCargoId] || [])
                                : [];
                            const estaExpandido = cargosExpandidos[tipoCargo.id] || false;

                            return (
                              <Box
                                key={tipoCargo.id}
                                sx={{
                                  border: '1px solid',
                                  borderColor: estaSeleccionado ? 'primary.light' : 'divider',
                                  borderRadius: 1,
                                  overflow: 'hidden',
                                }}
                              >
                                {/* Fila del checkbox y nombre */}
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    py: 0.75,
                                    px: 1.5,
                                    bgcolor: estaSeleccionado ? 'action.selected' : 'transparent',
                                    cursor: estaSeleccionado ? 'pointer' : 'default',
                                    '&:hover': { bgcolor: 'action.hover' },
                                    borderTopLeftRadius: 1,
                                    borderTopRightRadius: 1,
                                    borderBottomLeftRadius: estaSeleccionado && estaExpandido ? 0 : 1,
                                    borderBottomRightRadius: estaSeleccionado && estaExpandido ? 0 : 1,
                                  }}
                                  onClick={() => {
                                    if (readonlyServicios) return;
                                    if (estaSeleccionado) {
                                      setCargosExpandidos(prev => ({
                                        ...prev,
                                        [tipoCargo.id]: !prev[tipoCargo.id]
                                      }));
                                    }
                                  }}
                                >
                                  <Checkbox
                                    checked={estaSeleccionado}
                                    size="small"
                                    sx={{ py: 0 }}
                                    disabled={readonlyServicios}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={async (e) => {
                                      if (e.target.checked) {
                                        const soloPer =
                                          tipoCargo.codigo === CARGO_COD_EXPENSAS ||
                                          tipoCargo.codigo === CARGO_COD_SEGURO;
                                        let camposIniciales = {};
                                        if (!soloPer) {
                                          const camposData = await cargarCamposTipoCargo(tipoCargo.id);
                                          camposData.forEach((campo) => {
                                            camposIniciales[campo.id] = '';
                                          });
                                        }
                                        const cargoExistente = cargosSeleccionados.find(
                                          (cargo) => cargo.tipoCargoId === tipoCargo.id
                                        );
                                        const periodicidadPorDefecto =
                                          cargoExistente?.periodicidadId ||
                                          tipoCargo.periodicidadId ||
                                          tipoCargo.periodicidad?.id ||
                                          null;
                                        setCargosSeleccionados([
                                          ...cargosSeleccionados.filter((cargo) => cargo.tipoCargoId !== tipoCargo.id),
                                          {
                                            tipoCargoId: tipoCargo.id,
                                            periodicidadId: periodicidadPorDefecto,
                                            propiedadCargoId: cargoExistente?.propiedadCargoId,
                                            campos: cargoExistente?.campos || camposIniciales,
                                          },
                                        ]);
                                        setCargosExpandidos((prev) => ({ ...prev, [tipoCargo.id]: true }));
                                      } else {
                                        setCargosSeleccionados(cargosSeleccionados.filter(cargo => cargo.tipoCargoId !== tipoCargo.id));
                                        setCargosExpandidos(prev => ({ ...prev, [tipoCargo.id]: false }));
                                      }
                                    }}
                                  />
                                  <Typography variant="body2" fontWeight={estaSeleccionado ? 600 : 400} sx={{ flex: 1 }}>
                                    {tipoCargo.nombre}
                                  </Typography>
                                  {estaSeleccionado && (
                                    <ExpandMoreIcon
                                      sx={{
                                        transition: 'transform 0.2s',
                                        transform: estaExpandido ? 'rotate(180deg)' : 'rotate(0deg)',
                                        color: 'text.secondary'
                                      }}
                                    />
                                  )}
                                </Box>

                                {/* Panel de configuración con Collapse */}
                                <Collapse in={estaSeleccionado && estaExpandido}>
                                  <Box
                                    sx={{
                                      px: 2,
                                      pb: 2,
                                      pt: 2.75,
                                      bgcolor: '#f8f9fa',
                                      borderTop: '1px solid',
                                      borderColor: 'divider',
                                      borderBottomLeftRadius: 1,
                                      borderBottomRightRadius: 1,
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 1.5,
                                      }}
                                    >
                                      {periodicidadesImpuesto &&
                                        periodicidadesImpuesto.length > 0 &&
                                        tipoCargo.codigo !== CARGO_COD_EXPENSAS &&
                                        tipoCargo.codigo !== CARGO_COD_SEGURO && (
                                        <FormControl
                                          size="small"
                                          sx={{
                                            width: { xs: '100%', sm: esCargoSoloPeriodicidad ? 'min(100%, 360px)' : 'calc(20% - 6px)' },
                                          }}
                                          disabled={readonlyServicios}
                                        >
                                          <InputLabel>Periodicidad</InputLabel>
                                          <Select
                                            value={cargoSeleccionado?.periodicidadId || ''}
                                            onChange={(e) => {
                                              setCargosSeleccionados(
                                                cargosSeleccionados.map((cargo) =>
                                                  cargo.tipoCargoId === tipoCargo.id
                                                    ? { ...cargo, periodicidadId: e.target.value || null }
                                                    : cargo
                                                )
                                              );
                                            }}
                                            label="Periodicidad"
                                            disabled={readonlyServicios}
                                          >
                                            <MenuItem value="">
                                              <em>Sin periodicidad</em>
                                            </MenuItem>
                                            {periodicidadesImpuesto.map((periodicidad) => (
                                              <MenuItem key={periodicidad.id} value={periodicidad.id}>
                                                {periodicidad.nombre}
                                              </MenuItem>
                                            ))}
                                          </Select>
                                        </FormControl>
                                      )}
                                      {tipoCargo.codigo === CARGO_COD_EXPENSAS && (
                                        <Box
                                          sx={{
                                            display: 'flex',
                                            flexDirection: 'row',
                                            flexWrap: 'nowrap',
                                            alignItems: 'center',
                                            gap: 0.75,
                                            width: '100%',
                                            minWidth: 0,
                                            pt: 0.25,
                                            pb: 0.25,
                                          }}
                                        >
                                          {periodicidadesImpuesto && periodicidadesImpuesto.length > 0 && (
                                            <FormControl
                                              size="small"
                                              sx={{
                                                flex: '0 0 auto',
                                                width: 132,
                                                minWidth: 132,
                                              }}
                                              disabled={readonlyServicios}
                                            >
                                              <InputLabel id={`per-exp-${tipoCargo.id}`}>Período</InputLabel>
                                              <Select
                                                labelId={`per-exp-${tipoCargo.id}`}
                                                value={cargoSeleccionado?.periodicidadId || ''}
                                                onChange={(e) => {
                                                  setCargosSeleccionados(
                                                    cargosSeleccionados.map((cargo) =>
                                                      cargo.tipoCargoId === tipoCargo.id
                                                        ? { ...cargo, periodicidadId: e.target.value || null }
                                                        : cargo
                                                    )
                                                  );
                                                }}
                                                label="Período"
                                                disabled={readonlyServicios}
                                              >
                                                <MenuItem value="">
                                                  <em>Sin</em>
                                                </MenuItem>
                                                {periodicidadesImpuesto.map((periodicidad) => (
                                                  <MenuItem key={periodicidad.id} value={periodicidad.id}>
                                                    {periodicidad.nombre}
                                                  </MenuItem>
                                                ))}
                                              </Select>
                                            </FormControl>
                                          )}
                                          <Autocomplete
                                            options={opcionesConsorcioAutocomplete}
                                            getOptionLabel={(o) => etiquetaConsorcioSelector(o)}
                                            value={valorConsorcioAutocomplete}
                                            onChange={(_, v) => {
                                              setFormData({ ...formData, consorcioId: v ? String(v.id) : '' });
                                            }}
                                            isOptionEqualToValue={(a, b) =>
                                              a != null && b != null && String(a.id) === String(b.id)
                                            }
                                            disabled={readonlyServicios}
                                            sx={{
                                              flex: '1 1 0',
                                              minWidth: 0,
                                            }}
                                            size="small"
                                            renderInput={(params) => (
                                              <TextField
                                                {...params}
                                                label="Administrador consorcio"
                                                size="small"
                                                placeholder="Buscar administración o consorcio…"
                                              />
                                            )}
                                          />
                                          <Button
                                            variant="contained"
                                            color="primary"
                                            size="small"
                                            startIcon={<AddIcon sx={{ fontSize: '0.95rem' }} />}
                                            disabled={readonlyServicios}
                                            onClick={() => {
                                              setConsorcioDraft(emptyConsorcioDraft());
                                              setConsorcioModalOpen(true);
                                            }}
                                            sx={{
                                              flex: '0 0 auto',
                                              height: 40,
                                              py: 0,
                                              px: 1.25,
                                              fontSize: '0.8125rem',
                                              whiteSpace: 'nowrap',
                                              '& .MuiButton-startIcon': { mr: 0.35, ml: -0.25 },
                                            }}
                                          >
                                            Nuevo
                                          </Button>
                                        </Box>
                                      )}

                                      {tipoCargo.codigo === CARGO_COD_SEGURO && (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
                                          <Box
                                            sx={{
                                              display: 'flex',
                                              flexDirection: 'row',
                                              flexWrap: 'nowrap',
                                              alignItems: 'center',
                                              gap: 0.75,
                                              width: '100%',
                                              minWidth: 0,
                                              pt: 0.25,
                                              pb: 0.25,
                                            }}
                                          >
                                            {periodicidadesImpuesto && periodicidadesImpuesto.length > 0 && (
                                              <FormControl
                                                size="small"
                                                sx={{
                                                  flex: '0 0 auto',
                                                  width: 168,
                                                  minWidth: 168,
                                                }}
                                                disabled={readonlyServicios}
                                              >
                                                <InputLabel id={`per-seg-${tipoCargo.id}`}>Periodicidad</InputLabel>
                                                <Select
                                                  labelId={`per-seg-${tipoCargo.id}`}
                                                  value={cargoSeleccionado?.periodicidadId || ''}
                                                  onChange={(e) => {
                                                    setCargosSeleccionados(
                                                      cargosSeleccionados.map((cargo) =>
                                                        cargo.tipoCargoId === tipoCargo.id
                                                          ? { ...cargo, periodicidadId: e.target.value || null }
                                                          : cargo
                                                      )
                                                    );
                                                  }}
                                                  label="Periodicidad"
                                                  disabled={readonlyServicios}
                                                >
                                                  <MenuItem value="">
                                                    <em>Sin</em>
                                                  </MenuItem>
                                                  {periodicidadesImpuesto.map((periodicidad) => (
                                                    <MenuItem key={periodicidad.id} value={periodicidad.id}>
                                                      {periodicidad.nombre}
                                                    </MenuItem>
                                                  ))}
                                                </Select>
                                              </FormControl>
                                            )}
                                            <Typography
                                              variant="body2"
                                              color="text.secondary"
                                              sx={{
                                                flex: '1 1 0',
                                                minWidth: 0,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                              }}
                                            >
                                              {segurosLista.length === 0
                                                ? (editing?.id ? 'No hay pólizas registradas.' : 'Guarde la propiedad primero para registrar pólizas.')
                                                : `${segurosLista.length} póliza${segurosLista.length > 1 ? 's' : ''} registrada${segurosLista.length > 1 ? 's' : ''}.`}
                                            </Typography>
                                            <Button
                                              variant="contained"
                                              color="primary"
                                              size="small"
                                              startIcon={<AddIcon sx={{ fontSize: '0.95rem' }} />}
                                              disabled={readonlySeguros || !editing?.id}
                                              onClick={() => {
                                                setSeguroForm(emptySeguroForm());
                                                setSeguroModalOpen(true);
                                              }}
                                              sx={{
                                                flex: '0 0 auto',
                                                height: 40,
                                                py: 0,
                                                px: 1.25,
                                                fontSize: '0.8125rem',
                                                whiteSpace: 'nowrap',
                                                '& .MuiButton-startIcon': { mr: 0.35, ml: -0.25 },
                                              }}
                                            >
                                              Nuevo
                                            </Button>
                                          </Box>
                                          {segurosLista.length > 0 && (
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                              {segurosLista.map((s) => {
                                                const vencida = polizaVencida(s.fechaFin);
                                                return (
                                                  <Box
                                                    key={s.id}
                                                    sx={{
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'space-between',
                                                      py: 0.5,
                                                      px: 1,
                                                      border: '1px solid',
                                                      borderColor: 'divider',
                                                      borderRadius: 0.5,
                                                      bgcolor: 'background.paper'
                                                    }}
                                                  >
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                                                      <Typography variant="body2" sx={{ fontSize: '0.875rem', lineHeight: 1.2 }} noWrap>
                                                        {s.compania} · {s.nroPoliza}
                                                      </Typography>
                                                      <Chip
                                                        size="small"
                                                        label={vencida ? 'Vencida' : 'Vigente'}
                                                        color={vencida ? 'error' : 'success'}
                                                        variant="outlined"
                                                        sx={{ flexShrink: 0 }}
                                                      />
                                                    </Box>
                                                    <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                                                      <IconButton
                                                        size="small"
                                                        title="Editar"
                                                        disabled={readonlySeguros}
                                                        onClick={() => {
                                                          setSeguroForm({
                                                            id: s.id,
                                                            compania: s.compania || '',
                                                            nroPoliza: s.nroPoliza || '',
                                                            titularPoliza: s.titularPoliza || '',
                                                            productorSeguro: s.productorSeguro || '',
                                                            contactoProductor: s.contactoProductor || '',
                                                            tipoCobertura: s.tipoCobertura || '',
                                                            fechaInicio: toInputDate(s.fechaInicio),
                                                            fechaFin: toInputDate(s.fechaFin),
                                                            montoAsegurado: s.montoAsegurado != null ? String(s.montoAsegurado) : '',
                                                            costoPoliza: s.costoPoliza != null ? String(s.costoPoliza) : '',
                                                            notas: s.notas || '',
                                                          });
                                                          setSeguroModalOpen(true);
                                                        }}
                                                      >
                                                        <EditIcon fontSize="small" />
                                                      </IconButton>
                                                      <IconButton
                                                        size="small"
                                                        color="error"
                                                        title="Eliminar"
                                                        disabled={readonlySeguros}
                                                        onClick={() => setSeguroAEliminar(s.id)}
                                                      >
                                                        <DeleteIcon fontSize="small" />
                                                      </IconButton>
                                                    </Box>
                                                  </Box>
                                                );
                                              })}
                                            </Box>
                                          )}
                                        </Box>
                                      )}
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          flexDirection: { xs: 'column', sm: 'row' },
                                          gap: 1.5,
                                          alignItems: { xs: 'stretch', sm: 'flex-start' },
                                          flexWrap: 'wrap',
                                        }}
                                      >
                                      {campos.map((campo) => (
                                        <TextField
                                          key={campo.id}
                                          size="small"
                                          label={campo.nombre}
                                          value={cargoSeleccionado?.campos?.[campo.id] || ''}
                                          onChange={(e) => {
                                            setCargosSeleccionados(
                                              cargosSeleccionados.map(cargo =>
                                                cargo.tipoCargoId === tipoCargo.id
                                                  ? { ...cargo, campos: { ...cargo.campos, [campo.id]: e.target.value } }
                                                  : cargo
                                              )
                                            );
                                          }}
                                          disabled={readonlyServicios}
                                          sx={{ width: { xs: '100%', sm: 'calc(20% - 6px)' } }}
                                        />
                                      ))}
                                    </Box>
                                  </Box>
                                </Box>
                                </Collapse>
                              </Box>
                            );
                          })}
                      </Box>
                    ) : (
                      <Alert severity="info" sx={{ py: 1 }}>No hay tipos de cargo disponibles.</Alert>
                    )}
                    </Box>
                  </Box>
                )}

                {/* Tab Panel: Documentación */}
                {propiedadTabKey === 'documentacion' && (
                  <Box sx={{ position: 'relative', minHeight: 120 }}>
                    {readonlyDocumentos && (
                      <Box
                        aria-hidden
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          zIndex: 100,
                          bgcolor: 'rgba(255,255,255,0.9)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 1,
                          pointerEvents: 'auto',
                        }}
                      >
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', px: 2 }}>
                          No tiene permiso para modificar la documentación.
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ ...(readonlyDocumentos && { pointerEvents: 'none', userSelect: 'none', opacity: 0.9 }) }}>
                    {documentacion.length === 0 ? (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        No hay tipos de documentación configurados. Configurá los tipos de documentación en la sección de Configuración.
                      </Alert>
                    ) : (
                      <>
                        {/* Vista desktop: tabla */}
                        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                          <TableContainer
                            component={Paper}
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 0.5
                            }}
                          >
                            <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.25, px: 1 } }}>
                              <TableHead>
                                <TableRow sx={{ bgcolor: 'grey.100' }}>
                                  <TableCell sx={{ width: '50%', fontWeight: 'medium', fontSize: '0.8125rem' }}>Documento</TableCell>
                                  <TableCell align="center" sx={{ width: '25%', fontWeight: 'medium' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                      <Checkbox
                                        size="small"
                                        sx={{ py: 0, px: 0.5 }}
                                        disabled={readonlyDocumentos}
                                        indeterminate={
                                          documentacion.some(doc => doc.necesario) &&
                                          !documentacion.every(doc => doc.necesario)
                                        }
                                        checked={
                                          documentacion.length > 0 &&
                                          documentacion.every(doc => doc.necesario)
                                        }
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const nuevoValor = e.target.checked;
                                          setDocumentacion(prev =>
                                            prev.map(doc => ({
                                              ...doc,
                                              necesario: nuevoValor,
                                              recibido: nuevoValor ? doc.recibido : false
                                            }))
                                          );
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <Typography variant="caption" component="span" sx={{ fontSize: '0.8rem' }}>
                                        Solicitar
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell align="center" sx={{ width: '25%', fontWeight: 'medium' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                      <Checkbox
                                        size="small"
                                        sx={{ py: 0, px: 0.5 }}
                                        disabled={readonlyDocumentos || documentacion.filter(doc => doc.necesario).length === 0}
                                        indeterminate={
                                          documentacion.filter(doc => doc.necesario).length > 0 &&
                                          documentacion.filter(doc => doc.necesario).some(doc => doc.recibido) &&
                                          !documentacion.filter(doc => doc.necesario).every(doc => doc.recibido)
                                        }
                                        checked={
                                          documentacion.filter(doc => doc.necesario).length > 0 &&
                                          documentacion.filter(doc => doc.necesario).every(doc => doc.recibido)
                                        }
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const nuevoValor = e.target.checked;
                                          setDocumentacion(prev =>
                                            prev.map(doc => ({
                                              ...doc,
                                              recibido: doc.necesario ? nuevoValor : false
                                            }))
                                          );
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <Typography variant="caption" component="span" sx={{ fontSize: '0.8rem' }}>
                                        Recibido
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {documentacion.map((doc, index) => (
                                  <TableRow
                                    key={doc.tipoDocumentoPropiedadId || `doc-${index}`}
                                    sx={{
                                      bgcolor: index % 2 === 0 ? 'transparent' : 'grey.50',
                                      '&:hover': { bgcolor: 'action.hover' }
                                    }}
                                  >
                                    <TableCell>
                                      <Typography variant="body2" sx={{ fontSize: '0.8125rem', lineHeight: 1.2 }}>{doc.nombre}</Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                      <Checkbox
                                        checked={doc.necesario || false}
                                        disabled={readonlyDocumentos}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const nuevoValor = e.target.checked;
                                          setDocumentacion(prev =>
                                            prev.map(d =>
                                              d.tipoDocumentoPropiedadId === doc.tipoDocumentoPropiedadId
                                                ? { ...d, necesario: nuevoValor, recibido: false }
                                                : d
                                            )
                                          );
                                        }}
                                        size="small"
                                        sx={{ py: 0 }}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </TableCell>
                                    <TableCell align="center">
                                      <Checkbox
                                        checked={doc.recibido || false}
                                        disabled={readonlyDocumentos || !doc.necesario}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const nuevoValor = e.target.checked;
                                          setDocumentacion(prev =>
                                            prev.map(d =>
                                              d.tipoDocumentoPropiedadId === doc.tipoDocumentoPropiedadId
                                                ? { ...d, recibido: nuevoValor, necesario: nuevoValor ? false : d.necesario }
                                                : d
                                            )
                                          );
                                        }}
                                        size="small"
                                        sx={{ py: 0 }}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                        {/* Vista mobile: cards por documento */}
                        <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 2 }}>
                          {documentacion.map((doc, index) => (
                            <Card key={doc.tipoDocumentoPropiedadId || `doc-${index}`} variant="outlined" sx={{ p: 2 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>{doc.nombre}</Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={doc.necesario || false}
                                      disabled={readonlyDocumentos}
                                      onChange={(e) => {
                                        const nuevoValor = e.target.checked;
                                        setDocumentacion(prev =>
                                          prev.map(d =>
                                            d.tipoDocumentoPropiedadId === doc.tipoDocumentoPropiedadId
                                              ? { ...d, necesario: nuevoValor, recibido: false }
                                              : d
                                          )
                                        );
                                      }}
                                      size="small"
                                    />
                                  }
                                  label="Solicitar"
                                  sx={{ m: 0 }}
                                />
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={doc.recibido || false}
                                      disabled={readonlyDocumentos || !doc.necesario}
                                      onChange={(e) => {
                                        const nuevoValor = e.target.checked;
                                        setDocumentacion(prev =>
                                          prev.map(d =>
                                            d.tipoDocumentoPropiedadId === doc.tipoDocumentoPropiedadId
                                              ? { ...d, recibido: nuevoValor, necesario: nuevoValor ? false : d.necesario }
                                              : d
                                          )
                                        );
                                      }}
                                      size="small"
                                    />
                                  }
                                  label="Recibido"
                                  sx={{ m: 0 }}
                                />
                              </Box>
                            </Card>
                          ))}
                        </Box>
                      </>
                    )}
                    </Box>
                  </Box>
                )}

              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCerrarEdicion}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              sx={PROPIEDAD_DIALOG_CONTAINED_SUBMIT_SX}
            >
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!seguroAEliminar}
        onClose={() => setSeguroAEliminar(null)}
        title="Eliminar póliza"
        message="¿Eliminar esta póliza de seguro?"
        confirmLabel="Eliminar"
        confirmColor="error"
        loading={deleteSeguroMutation.isPending}
        onConfirm={() => {
          if (seguroAEliminar != null && editing?.id) {
            deleteSeguroMutation.mutate({ propiedadId: editing.id, seguroId: seguroAEliminar });
          }
        }}
      />

      {/* Modal: Nuevo Consorcio */}
      <Dialog
        open={consorcioModalOpen}
        onClose={() => setConsorcioModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!String(consorcioDraft.nombre || '').trim()) return;
            try {
              const payload = {
                nombre: String(consorcioDraft.nombre || '').trim(),
                cuitConsorcio: null,
                direccionConsorcio: null,
                nombreAdministracion: String(consorcioDraft.nombreAdministracion || '').trim() || null,
                direccionAdministracion: String(consorcioDraft.direccionAdministracion || '').trim() || null,
                nombreReferente: String(consorcioDraft.nombreReferente || '').trim() || null,
                telefonoAdministracion: String(consorcioDraft.telefonoAdministracion || '').trim() || null,
                mailAdministracion: String(consorcioDraft.mailAdministracion || '').trim() || null,
                notas: String(consorcioDraft.notas || '').trim() || null,
              };
              const res = await api.post('/consorcios', payload);
              const nuevoId = res?.data?.id;
              if (nuevoId) {
                setFormData((prev) => ({ ...prev, consorcioId: String(nuevoId) }));
                queryClient.invalidateQueries(['consorcios']);
                setConsorcioDraft(emptyConsorcioDraft());
                setConsorcioModalOpen(false);
                setSuccessMessage('Consorcio creado');
                setSnackbarSeverity('success');
                setSnackbarOpen(true);
              }
            } catch (error) {
              setErrorMessage(error.response?.data?.error || 'Error al crear el consorcio');
              setSnackbarSeverity('error');
              setSnackbarOpen(true);
            }
          }}
          noValidate
        >
          <DialogTitle>Nuevo Consorcio</DialogTitle>
          <DialogContent>
            <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField
                  label="Nombre del consorcio"
                  fullWidth
                  required
                  size="small"
                  value={consorcioDraft.nombre}
                  onChange={(e) => setConsorcioDraft((p) => ({ ...p, nombre: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Administrador"
                  fullWidth
                  size="small"
                  value={consorcioDraft.nombreAdministracion}
                  onChange={(e) => setConsorcioDraft((p) => ({ ...p, nombreAdministracion: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Domicilio administración"
                  fullWidth
                  size="small"
                  value={consorcioDraft.direccionAdministracion}
                  onChange={(e) => setConsorcioDraft((p) => ({ ...p, direccionAdministracion: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Referente"
                  fullWidth
                  size="small"
                  value={consorcioDraft.nombreReferente}
                  onChange={(e) => setConsorcioDraft((p) => ({ ...p, nombreReferente: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Teléfono"
                  fullWidth
                  size="small"
                  value={consorcioDraft.telefonoAdministracion}
                  onChange={(e) => setConsorcioDraft((p) => ({ ...p, telefonoAdministracion: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Email"
                  fullWidth
                  size="small"
                  value={consorcioDraft.mailAdministracion}
                  onChange={(e) => setConsorcioDraft((p) => ({ ...p, mailAdministracion: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Notas"
                  fullWidth
                  size="small"
                  multiline
                  minRows={2}
                  value={consorcioDraft.notas}
                  onChange={(e) => setConsorcioDraft((p) => ({ ...p, notas: e.target.value }))}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setConsorcioModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={!String(consorcioDraft.nombre || '').trim()}
              sx={PROPIEDAD_DIALOG_CONTAINED_SUBMIT_SX}
            >
              Crear
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Modal: Nueva / Editar Póliza de Seguro */}
      <Dialog
        open={seguroModalOpen}
        onClose={() => setSeguroModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editing?.id) return;
            const f = seguroForm;
            if (!(f.compania || '').trim() || !(f.nroPoliza || '').trim() || !f.fechaInicio || !f.fechaFin) return;
            const eraEdicion = Boolean(f.id);
            try {
              const payload = {
                compania: f.compania.trim(),
                nroPoliza: f.nroPoliza.trim(),
                titularPoliza: f.titularPoliza.trim() || null,
                productorSeguro: f.productorSeguro.trim() || null,
                contactoProductor: f.contactoProductor.trim() || null,
                tipoCobertura: f.tipoCobertura.trim() || null,
                fechaInicio: f.fechaInicio,
                fechaFin: f.fechaFin,
                montoAsegurado: f.montoAsegurado === '' ? null : f.montoAsegurado,
                costoPoliza: f.costoPoliza === '' ? null : f.costoPoliza,
                notas: f.notas.trim() || null,
              };
              if (f.id) {
                await api.put(`/propiedades/${editing.id}/seguros/${f.id}`, payload);
              } else {
                await api.post(`/propiedades/${editing.id}/seguros`, payload);
              }
              queryClient.invalidateQueries(['propiedad-seguros', editing.id]);
              queryClient.invalidateQueries(['propiedades']);
              setSeguroForm(emptySeguroForm());
              setSeguroModalOpen(false);
              setSuccessMessage(eraEdicion ? 'Póliza actualizada' : 'Póliza creada');
              setSnackbarSeverity('success');
              setSnackbarOpen(true);
            } catch (error) {
              setErrorMessage(error.response?.data?.error || 'Error al guardar la póliza');
              setSnackbarSeverity('error');
              setSnackbarOpen(true);
            }
          }}
          noValidate
        >
          <DialogTitle>{seguroForm.id ? 'Editar póliza de seguro' : 'Nueva póliza de seguro'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Compañía"
                  fullWidth
                  required
                  size="small"
                  value={seguroForm.compania}
                  onChange={(e) => setSeguroForm((prev) => ({ ...prev, compania: e.target.value }))}
                  inputProps={{ maxLength: 100 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Nº de póliza"
                  fullWidth
                  required
                  size="small"
                  value={seguroForm.nroPoliza}
                  onChange={(e) => setSeguroForm((prev) => ({ ...prev, nroPoliza: e.target.value }))}
                  inputProps={{ maxLength: 100 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Titular de la póliza"
                  fullWidth
                  size="small"
                  value={seguroForm.titularPoliza}
                  onChange={(e) => setSeguroForm((prev) => ({ ...prev, titularPoliza: e.target.value }))}
                  inputProps={{ maxLength: 150 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Productor de seguro"
                  fullWidth
                  size="small"
                  value={seguroForm.productorSeguro}
                  onChange={(e) => setSeguroForm((prev) => ({ ...prev, productorSeguro: e.target.value }))}
                  inputProps={{ maxLength: 150 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Contacto del productor"
                  fullWidth
                  size="small"
                  value={seguroForm.contactoProductor}
                  onChange={(e) => setSeguroForm((prev) => ({ ...prev, contactoProductor: e.target.value }))}
                  inputProps={{ maxLength: 150 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Tipo de cobertura"
                  fullWidth
                  size="small"
                  value={seguroForm.tipoCobertura}
                  onChange={(e) => setSeguroForm((prev) => ({ ...prev, tipoCobertura: e.target.value }))}
                  inputProps={{ maxLength: 150 }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Fecha inicio"
                  type="date"
                  fullWidth
                  required
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={seguroForm.fechaInicio}
                  onChange={(e) => setSeguroForm((prev) => ({ ...prev, fechaInicio: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Fecha fin"
                  type="date"
                  fullWidth
                  required
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={seguroForm.fechaFin}
                  onChange={(e) => setSeguroForm((prev) => ({ ...prev, fechaFin: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Monto asegurado"
                  fullWidth
                  size="small"
                  value={seguroForm.montoAsegurado}
                  onChange={(e) => setSeguroForm((prev) => ({ ...prev, montoAsegurado: e.target.value }))}
                  placeholder="Informativo"
                  inputProps={{ inputMode: 'decimal' }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Costo de la póliza"
                  fullWidth
                  size="small"
                  value={seguroForm.costoPoliza}
                  onChange={(e) => setSeguroForm((prev) => ({ ...prev, costoPoliza: e.target.value }))}
                  placeholder="Informativo"
                  inputProps={{ inputMode: 'decimal' }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Notas"
                  fullWidth
                  multiline
                  minRows={2}
                  size="small"
                  value={seguroForm.notas}
                  onChange={(e) => setSeguroForm((prev) => ({ ...prev, notas: e.target.value }))}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setSeguroModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={
                !(seguroForm.compania || '').trim() ||
                !(seguroForm.nroPoliza || '').trim() ||
                !seguroForm.fechaInicio ||
                !seguroForm.fechaFin
              }
              sx={PROPIEDAD_DIALOG_CONTAINED_SUBMIT_SX}
            >
              {seguroForm.id ? 'Guardar' : 'Crear'}
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
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarSeverity === 'success' ? successMessage : errorMessage}
        </Alert>
      </Snackbar>

      {/* Vista de detalle / tablero de control de la propiedad */}
      <PropiedadDetalleDialog
        open={perfilOpen}
        onClose={handleCerrarPerfil}
        propiedadId={perfilPropiedad?.id}
        initialTab={initialPerfilTab}
        onEdit={(prop) => handleEdit(prop)}
        onNuevoContrato={(prop) => {
          if (!prop?.id) return;
          navigate('/contratos', {
            state: {
              propiedadId: prop.id,
              returnTo: `/propiedades?verPerfil=${prop.id}`,
              returnModal: 'propiedad',
              returnId: prop.id
            }
          });
        }}
      />
    </Box>
  );
}

