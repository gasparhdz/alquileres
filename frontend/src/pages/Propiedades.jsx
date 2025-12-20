import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  InputLabel,
  Grid,
  Card,
  CardContent,
  Divider,
  Chip,
  Snackbar,
  Tabs,
  Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HomeIcon from '@mui/icons-material/Home';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import PersonIcon from '@mui/icons-material/Person';
import Checkbox from '@mui/material/Checkbox';
import api from '../api';

export default function Propiedades() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  
  // Abrir diálogo automáticamente si viene el parámetro openDialog
  useEffect(() => {
    if (searchParams.get('openDialog') === 'true') {
      setOpen(true);
      // Si hay una propiedad en edición guardada, restaurarla PRIMERO
      const propiedadEnEdicionStr = sessionStorage.getItem('propiedadEnEdicion');
      if (propiedadEnEdicionStr) {
        try {
          const propiedadEnEdicion = JSON.parse(propiedadEnEdicionStr);
          // Cargar la propiedad completa desde el backend para tener todos los datos actualizados
          const cargarPropiedadCompleta = async () => {
            try {
              const response = await api.get(`/propiedades/${propiedadEnEdicion.id}`);
              const propiedadCompleta = response.data;
              // Usar handleEdit para cargar todos los datos relacionados correctamente
              await handleEdit(propiedadCompleta);
              
              // Leer el estado completo ANTES de preseleccionar el propietario
              const estadoCompletoStr = sessionStorage.getItem('propiedadEstadoCompleto');
              let estadoCompleto = null;
              if (estadoCompletoStr) {
                try {
                  estadoCompleto = JSON.parse(estadoCompletoStr);
                } catch (error) {
                  console.error('Error al parsear estado completo:', error);
                }
              }
              
              // Después de cargar la propiedad, preseleccionar el propietario si viene de Propietarios
              const propietarioIdParaAsociar = sessionStorage.getItem('propietarioIdParaAsociar');
              if (propietarioIdParaAsociar) {
                setTabValue(0); // Cambiar al tab de Propietarios
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
              
              // Restaurar el estado completo del formulario (impuestos, cargos, documentación, tab)
              // Esto sobrescribe lo que handleEdit cargó desde el backend con lo que el usuario tenía antes
              if (estadoCompleto) {
                // Restaurar impuestos y cargos seleccionados
                if (estadoCompleto.impuestosSeleccionados && Array.isArray(estadoCompleto.impuestosSeleccionados)) {
                  setImpuestosSeleccionados(estadoCompleto.impuestosSeleccionados);
                }
                if (estadoCompleto.cargosSeleccionados && Array.isArray(estadoCompleto.cargosSeleccionados)) {
                  setCargosSeleccionados(estadoCompleto.cargosSeleccionados);
                }
                // Restaurar documentación
                if (estadoCompleto.documentacion && Array.isArray(estadoCompleto.documentacion)) {
                  setDocumentacion(estadoCompleto.documentacion);
                }
                // Restaurar datos del formulario (puede incluir cambios que el usuario hizo antes de ir a Propietarios)
                if (estadoCompleto.formData) {
                  setFormData(prev => ({
                    ...prev,
                    ...estadoCompleto.formData
                  }));
                }
                // Restaurar tab si estaba en otro tab
                if (estadoCompleto.tabValue !== undefined && !propietarioIdParaAsociar) {
                  setTabValue(estadoCompleto.tabValue);
                }
                sessionStorage.removeItem('propiedadEstadoCompleto');
              }
              
              // Solo eliminar después de restaurar exitosamente
              sessionStorage.removeItem('propiedadEnEdicion');
              sessionStorage.removeItem('propiedadFormData');
            } catch (error) {
              console.error('Error al cargar propiedad completa:', error);
              // Si falla, intentar restaurar desde sessionStorage
              const estadoCompletoStr = sessionStorage.getItem('propiedadEstadoCompleto');
              if (estadoCompletoStr) {
                try {
                  const estadoCompleto = JSON.parse(estadoCompletoStr);
                  setFormData(estadoCompleto.formData || {});
                  setEditing(propiedadEnEdicion);
                  // Restaurar impuestos, cargos y documentación
                  if (estadoCompleto.impuestosSeleccionados) {
                    setImpuestosSeleccionados(estadoCompleto.impuestosSeleccionados);
                  }
                  if (estadoCompleto.cargosSeleccionados) {
                    setCargosSeleccionados(estadoCompleto.cargosSeleccionados);
                  }
                  if (estadoCompleto.documentacion) {
                    setDocumentacion(estadoCompleto.documentacion);
                  }
                  if (estadoCompleto.tabValue !== undefined) {
                    setTabValue(estadoCompleto.tabValue);
                  }
                  sessionStorage.removeItem('propiedadEstadoCompleto');
                } catch (parseError) {
                  console.error('Error al parsear estado completo:', parseError);
                  // Si falla el parseo, al menos establecer editing para que se vea algo
                  setEditing(propiedadEnEdicion);
                }
              } else {
                // Si no hay estado completo guardado, intentar usar handleEdit con los datos guardados
                // aunque no sean completos, es mejor que nada
                try {
                  await handleEdit(propiedadEnEdicion);
                } catch (handleEditError) {
                  console.error('Error al usar handleEdit con datos guardados:', handleEditError);
                  // Último recurso: solo establecer editing
                  setEditing(propiedadEnEdicion);
                }
              }
              sessionStorage.removeItem('propiedadEnEdicion');
            }
          };
          cargarPropiedadCompleta();
        } catch (error) {
          console.error('Error al parsear propiedad en edición:', error);
          sessionStorage.removeItem('propiedadEnEdicion');
          sessionStorage.removeItem('propiedadFormData');
          sessionStorage.removeItem('propiedadEstadoCompleto');
        }
      } else {
        // Si NO hay propiedad en edición pero sí viene de Propietarios, preseleccionar el propietario
        const propietarioIdParaAsociar = sessionStorage.getItem('propietarioIdParaAsociar');
        if (propietarioIdParaAsociar) {
          setTabValue(0); // Cambiar al tab de Propietarios
          const propietarioId = parseInt(propietarioIdParaAsociar);
          setFormData(prev => ({
            ...prev,
            propietarioIds: prev.propietarioIds.includes(propietarioId) 
              ? prev.propietarioIds 
              : [...prev.propietarioIds, propietarioId]
          }));
          // Limpiar sessionStorage después de preseleccionar
          sessionStorage.removeItem('propietarioIdParaAsociar');
          sessionStorage.removeItem('propietarioEnEdicion');
        }
      }
      
      // Limpiar el parámetro de la URL
      searchParams.delete('openDialog');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [tabValue, setTabValue] = useState(0);
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
    descripcion: ''
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const queryClient = useQueryClient();

  const { data: propiedades, isLoading } = useQuery({
    queryKey: ['propiedades'],
    queryFn: async () => {
      const response = await api.get('/propiedades');
      return response.data;
    }
  });

  const { data: propietariosData } = useQuery({
    queryKey: ['propietarios'],
    queryFn: async () => {
      const response = await api.get('/propietarios?limit=1000');
      return response.data?.data || [];
    }
  });
  const propietarios = propietariosData || [];

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
      descripcion: ''
    });
    setErrors({});
    setEditing(null);
    setImpuestosSeleccionados([]);
    setCargosSeleccionados([]);
    setTabValue(0);
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
    if (formData.provinciaId && formData.localidadId) {
      // Si cambió la provincia, limpiar localidad si no pertenece a la nueva provincia
      if (localidades) {
        const localidadActual = localidades.find(l => l.id === parseInt(formData.localidadId));
        if (!localidadActual || localidadActual.provinciaId !== parseInt(formData.provinciaId)) {
          setFormData(prev => ({ ...prev, localidadId: '' }));
        }
      } else {
        // Si aún no hay localidades cargadas, limpiar localidad
        setFormData(prev => ({ ...prev, localidadId: '' }));
      }
    } else if (!formData.provinciaId && formData.localidadId) {
      // Si se quita la provincia, limpiar localidad
      setFormData(prev => ({ ...prev, localidadId: '' }));
    }
  }, [formData.provinciaId, localidades]);

  const handleEdit = async (propiedad) => {
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
      descripcion: propiedad.descripcion || ''
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
            campos: valoresCampos
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
          
          // Obtener el tipo de cargo para usar su periodicidad por defecto
          const tipoCargo = tiposCargo?.find(tc => tc.id === cargo.tipoCargoId);
          const periodicidadPorDefecto = tipoCargo?.periodicidadId || tipoCargo?.periodicidad?.id || null;
          
          return {
            tipoCargoId: cargo.tipoCargoId,
            periodicidadId: periodicidadPorDefecto,
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
    
    // Preparar datos para enviar, excluyendo campos vacíos opcionales
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
      descripcion: formData.descripcion?.trim() || null
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

      // Guardar impuestos y cargos
      let impuestosGuardados = [];
      try {
        const impuestosResponse = await api.post(`/propiedad-impuestos/propiedad/${propiedadId}`, {
          impuestos: impuestosSeleccionados.map(imp => ({
            tipoImpuestoId: imp.tipoImpuestoId,
            periodicidadId: imp.periodicidadId
          }))
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
          cargos: cargosSeleccionados.map(cargo => ({ tipoCargoId: cargo.tipoCargoId }))
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

      // Guardar documentos de la propiedad (guardar todos, incluso los que están en false)
      let errorDocumentos = null;
      
      if (documentacion && Array.isArray(documentacion) && documentacion.length > 0) {
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
      
      // Si hubo error solo en documentos, mostrar advertencia pero cerrar el diálogo
      if (errorDocumentos) {
        setErrorMessage(`La propiedad se guardó correctamente, pero hubo un error al guardar los documentos: ${errorDocumentos}`);
        setSnackbarSeverity('warning');
        setSnackbarOpen(true);
      } else {
        const vieneDePropietarios = sessionStorage.getItem('propietarioIdParaAsociar');
        
        // Si viene de Propietarios, navegar ANTES de cerrar el diálogo
        if (vieneDePropietarios && !editing) {
          // Guardar un flag para indicar que se creó exitosamente
          sessionStorage.setItem('propiedadCreadaExitosamente', 'true');
          // No eliminar propietarioIdParaAsociar todavía, se eliminará cuando se cierre el diálogo de Propietarios
          setOpen(false);
          resetForm();
          navigate('/clientes?tab=0');
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Propiedades</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}>
          Nueva Propiedad
        </Button>
      </Box>

      {/* Vista de tabla para desktop */}
      <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Dirección</TableCell>
              <TableCell>Localidad</TableCell>
              <TableCell>Propietario</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {propiedades?.data?.map((propiedad) => {
              const direccionCompleta = `${propiedad.dirCalle} ${propiedad.dirNro}${propiedad.dirPiso ? `, Piso ${propiedad.dirPiso}` : ''}${propiedad.dirDepto ? `, Depto ${propiedad.dirDepto}` : ''}`;
              const localidadNombre = propiedad.localidad?.nombre || propiedad.provincia?.nombre || '';
              const propietariosNombres = propiedad.propietarios?.map(p => 
                p.propietario.razonSocial || 
                `${p.propietario.nombre || ''} ${p.propietario.apellido || ''}`.trim()
              ).filter(Boolean).join(', ') || '';
              
              return (
              <TableRow key={propiedad.id}>
                <TableCell>{direccionCompleta}</TableCell>
                <TableCell>{localidadNombre}</TableCell>
                <TableCell>
                  {propietariosNombres || <em style={{ color: '#999' }}>Sin propietarios</em>}
                </TableCell>
                <TableCell>{propiedad.tipoPropiedad?.nombre || '-'}</TableCell>
                <TableCell>{propiedad.estadoPropiedad?.nombre || '-'}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleEdit(propiedad)} title="Editar">
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (window.confirm('¿Está seguro de eliminar esta propiedad?')) {
                        deleteMutation.mutate(propiedad.id);
                      }
                    }}
                    title="Eliminar"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Vista de cards para mobile */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <Grid container spacing={2}>
          {propiedades?.data?.map((propiedad) => (
            <Grid item xs={12} key={propiedad.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        {`${propiedad.dirCalle} ${propiedad.dirNro}${propiedad.dirPiso ? `, Piso ${propiedad.dirPiso}` : ''}${propiedad.dirDepto ? `, Depto ${propiedad.dirDepto}` : ''}`}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={() => handleEdit(propiedad)} sx={{ mr: 0.5 }} title="Editar">
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (window.confirm('¿Está seguro de eliminar esta propiedad?')) {
                            deleteMutation.mutate(propiedad.id);
                          }
                        }}
                        title="Eliminar"
                      >
                        <DeleteIcon />
                      </IconButton>
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
                          {propiedad.propietarios.map(p => 
                            p.propietario.razonSocial || 
                            `${p.propietario.nombre || ''} ${p.propietario.apellido || ''}`.trim()
                          ).filter(Boolean).join(', ')}
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
                        <HomeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          <strong>Tipo:</strong> {propiedad.tipoPropiedad.nombre}
                        </Typography>
                      </Box>
                    )}
                    {propiedad.estadoPropiedad && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={propiedad.estadoPropiedad.nombre} size="small" color="primary" />
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
      </Box>

      <Dialog 
        open={open} 
        onClose={() => {
          const vieneDePropietarios = sessionStorage.getItem('propietarioIdParaAsociar');
          setOpen(false);
          resetForm();
          // Limpiar sessionStorage de propiedades cuando se cierra normalmente
          sessionStorage.removeItem('propiedadEnEdicion');
          sessionStorage.removeItem('propiedadFormData');
          sessionStorage.removeItem('propiedadEstadoCompleto');
          sessionStorage.removeItem('propiedadIdParaAsociar');
          sessionStorage.removeItem('propiedadNuevaParaAsociar');
          // Si viene de Propietarios, volver allí
          if (vieneDePropietarios && !editing) {
            // NO eliminar propietarioIdParaAsociar ni propietarioEnEdicion cuando se cancela
            // Se eliminarán cuando se cierre el diálogo de Propietarios normalmente
            navigate('/clientes?tab=0');
          }
        }} 
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
                {/* Dirección - Todos en la misma línea */}
                <Grid item xs={12} sm={6} md={3}>
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
                <Grid item xs={12} sm={6} md={1}>
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
                <Grid item xs={12} sm={6} md={1}>
                  <TextField
                    label="Piso"
                    fullWidth
                    size="small"
                    value={formData.dirPiso}
                    onChange={(e) => setFormData({ ...formData, dirPiso: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={1}>
                  <TextField
                    label="Depto"
                    fullWidth
                    size="small"
                    value={formData.dirDepto}
                    onChange={(e) => setFormData({ ...formData, dirDepto: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
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
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Localidad</InputLabel>
                    <Select
                      value={formData.localidadId || ''}
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
                        <MenuItem key={loc.id} value={loc.id}>
                          {loc.nombre}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>        
                {/* Tipo, Estado, Destino, Ambientes, Código Interno */}
                <Grid item xs={12} sm={6} md={2}>
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
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Estado</InputLabel>
                    <Select
                      value={formData.estadoPropiedadId || ''}
                      onChange={(e) => setFormData({ ...formData, estadoPropiedadId: e.target.value || '' })}
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
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
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
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
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
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Código Interno"
                    fullWidth
                    size="small"
                    value={formData.codigoInterno}
                    onChange={(e) => setFormData({ ...formData, codigoInterno: e.target.value })}
                  />
                </Grid>
              </Grid>

              {/* Campo Descripción */}
              <Box sx={{ mt: 3 }}>
                <TextField
                  label="Descripción"
                  fullWidth
                  multiline 
                  rows={4}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Ingrese una descripción de la propiedad..."
                  sx={{
                    '& .MuiInputBase-root': {
                      alignItems: 'flex-start',
                      minHeight: '80px'
                    },
                    '& .MuiInputBase-input': {
                      padding: '16.5px 14px',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      boxSizing: 'border-box'
                    },
                    '& .MuiOutlinedInput-root': {
                      '& textarea': {
                        overflowY: 'auto !important',
                        overflowX: 'hidden !important',
                        resize: 'vertical',
                        padding: 0,
                        margin: 0,
                        boxSizing: 'border-box'
                      },
                      '& fieldset': {
                        borderWidth: '1px'
                      }
                    }
                  }}
                />
              </Box>

              {/* Sección de Tabs: Propietarios, Impuestos y Cargos, Documentación */}
              <Box sx={{ mt: 3 }}>
                <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Tab label="Propietarios" />
                  <Tab label="Impuestos y Cargos" />
                  <Tab label="Documentación" />
                </Tabs>

                {/* Tab Panel: Propietarios */}
                {tabValue === 0 && (
                  <Box>
                    {/* Selector de propietarios existentes */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                      <FormControl fullWidth size="small" sx={{ flex: 1 }}>
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
                                // Construir nombre completo
                                const nombreCompleto = propietario.tipoPersona?.codigo === 'FISICA'
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
                        sx={{ minWidth: 'auto', height: '40px', px: 1.5 }}
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
                        variant="outlined"
                        size="small"
                        sx={{ minWidth: 'auto', height: '40px', px: 1.5 }}
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
                              tabValue: tabValue
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
                              tabValue: tabValue
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
                          
                          // Construir nombre completo
                          const nombreCompleto = propietario.tipoPersona?.codigo === 'FISICA'
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
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          );
                        })}
                      </Box>
                    ) : (
                      <Alert severity="info" sx={{ py: 0.5 }}>
                        No hay propietarios asociados
                      </Alert>
                    )}
                  </Box>
                )}

                {/* Tab Panel: Impuestos y Cargos */}
                {tabValue === 1 && (
                  <Box>
                      {tiposImpuestoPropiedad && tiposImpuestoPropiedad.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {tiposImpuestoPropiedad.map((tipoImpuesto) => {
                            const impuestoSeleccionado = impuestosSeleccionados.find(
                              imp => imp.tipoImpuestoId === tipoImpuesto.id
                            );
                            const estaSeleccionado = !!impuestoSeleccionado;

                            return (
                              <Box
                                key={tipoImpuesto.id}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  py: 0.5,
                                  px: 1,
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  borderRadius: 0.5,
                                  bgcolor: estaSeleccionado ? 'action.selected' : 'transparent',
                                  '&:hover': { bgcolor: 'action.hover' }
                                }}
                              >
                                <Checkbox
                                  checked={estaSeleccionado}
                                  onChange={async (e) => {
                                    if (e.target.checked) {
                                      // Cargar campos del tipo de impuesto
                                      const campos = await cargarCamposTipoImpuesto(tipoImpuesto.id);
                                      const camposIniciales = {};
                                      campos.forEach(campo => {
                                        camposIniciales[campo.id] = '';
                                      });
                                      // Si ya existe (edición), mantener los valores existentes
                                      const impuestoExistente = impuestosSeleccionados.find(
                                        imp => imp.tipoImpuestoId === tipoImpuesto.id
                                      );
                                      // Usar la periodicidad por defecto del tipo de impuesto si no hay una existente
                                      const periodicidadPorDefecto = impuestoExistente?.periodicidadId || 
                                                                     tipoImpuesto.periodicidadId || 
                                                                     tipoImpuesto.periodicidad?.id || 
                                                                     null;
                                      setImpuestosSeleccionados([
                                        ...impuestosSeleccionados.filter(imp => imp.tipoImpuestoId !== tipoImpuesto.id),
                                        { 
                                          tipoImpuestoId: tipoImpuesto.id, 
                                          periodicidadId: periodicidadPorDefecto,
                                          propiedadImpuestoId: impuestoExistente?.propiedadImpuestoId,
                                          campos: impuestoExistente?.campos || camposIniciales
                                        }
                                      ]);
                                    } else {
                                      setImpuestosSeleccionados(
                                        impuestosSeleccionados.filter(imp => imp.tipoImpuestoId !== tipoImpuesto.id)
                                      );
                                    }
                                  }}
                                  size="small"
                                  sx={{ py: 0 }}
                                />
                                <Box sx={{ minWidth: 120 }}>
                                  <Typography variant="caption" fontWeight={estaSeleccionado ? 600 : 400}>
                                    {tipoImpuesto.nombre}
                                  </Typography>
                                </Box>
                                {estaSeleccionado && (
                                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                                    {periodicidadesImpuesto && periodicidadesImpuesto.length > 0 && (
                                      <FormControl size="small" sx={{ minWidth: 150 }}>
                                        <InputLabel>Periodicidad</InputLabel>
                                        <Select
                                          value={impuestoSeleccionado.periodicidadId || ''}
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
                                    {/* Campos del impuesto */}
                                    {(() => {
                                      const campos = camposPorTipoImpuesto[impuestoSeleccionado.tipoImpuestoId] || [];
                                      if (campos.length === 0) return null;
                                      
                                      return campos.map((campo) => (
                                        <TextField
                                          key={campo.id}
                                          size="small"
                                          label={campo.nombre}
                                          value={impuestoSeleccionado.campos?.[campo.id] || ''}
                                          onChange={(e) => {
                                            setImpuestosSeleccionados(
                                              impuestosSeleccionados.map(imp =>
                                                imp.tipoImpuestoId === tipoImpuesto.id
                                                  ? {
                                                      ...imp,
                                                      campos: {
                                                        ...imp.campos,
                                                        [campo.id]: e.target.value
                                                      }
                                                    }
                                                  : imp
                                              )
                                            );
                                          }}
                                          placeholder={campo.nombre}
                                          sx={{ 
                                            minWidth: 130,
                                            maxWidth: 150,
                                            '& .MuiInputBase-root': {
                                              height: '32px'
                                            },
                                            '& .MuiInputLabel-root': {
                                              fontSize: '0.75rem'
                                            }
                                          }}
                                        />
                                      ));
                                    })()}
                                  </Box>
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      ) : (
                        <Alert severity="info" sx={{ py: 1 }}>No hay tipos de impuesto disponibles.</Alert>
                      )}
                   
                      {tiposCargo && tiposCargo.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                          {tiposCargo.map((tipoCargo) => {
                            const cargoSeleccionado = cargosSeleccionados.find(
                              cargo => cargo.tipoCargoId === tipoCargo.id
                            );
                            const estaSeleccionado = !!cargoSeleccionado;

                            return (
                              <Box
                                key={tipoCargo.id}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  py: 0.5,
                                  px: 1,
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  borderRadius: 0.5,
                                  bgcolor: estaSeleccionado ? 'action.selected' : 'transparent',
                                  '&:hover': { bgcolor: 'action.hover' }
                                }}
                              >
                                <Checkbox
                                  checked={estaSeleccionado}
                                  onChange={async (e) => {
                                    if (e.target.checked) {
                                      // Cargar campos del tipo de cargo
                                      const campos = await cargarCamposTipoCargo(tipoCargo.id);
                                      const camposIniciales = {};
                                      campos.forEach(campo => {
                                        camposIniciales[campo.id] = '';
                                      });
                                      // Si ya existe (edición), mantener los valores existentes
                                      const cargoExistente = cargosSeleccionados.find(
                                        cargo => cargo.tipoCargoId === tipoCargo.id
                                      );
                                      // Usar la periodicidad por defecto del tipo de cargo si no hay una existente
                                      const periodicidadPorDefecto = cargoExistente?.periodicidadId || 
                                                                     tipoCargo.periodicidadId || 
                                                                     tipoCargo.periodicidad?.id || 
                                                                     null;
                                      setCargosSeleccionados([
                                        ...cargosSeleccionados.filter(cargo => cargo.tipoCargoId !== tipoCargo.id),
                                        { 
                                          tipoCargoId: tipoCargo.id, 
                                          periodicidadId: periodicidadPorDefecto,
                                          propiedadCargoId: cargoExistente?.propiedadCargoId,
                                          campos: cargoExistente?.campos || camposIniciales
                                        }
                                      ]);
                                    } else {
                                      setCargosSeleccionados(
                                        cargosSeleccionados.filter(cargo => cargo.tipoCargoId !== tipoCargo.id)
                                      );
                                    }
                                  }}
                                  size="small"
                                  sx={{ py: 0 }}
                                />
                                <Box sx={{ minWidth: 120 }}>
                                  <Typography variant="caption" fontWeight={estaSeleccionado ? 600 : 400}>
                                    {tipoCargo.nombre}
                                  </Typography>
                                </Box>
                                {estaSeleccionado && (
                                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                                    {periodicidadesImpuesto && periodicidadesImpuesto.length > 0 && (
                                      <FormControl size="small" sx={{ minWidth: 150 }}>
                                        <InputLabel>Periodicidad</InputLabel>
                                        <Select
                                          value={cargoSeleccionado.periodicidadId || ''}
                                          onChange={(e) => {
                                            setCargosSeleccionados(
                                              cargosSeleccionados.map(cargo =>
                                                cargo.tipoCargoId === tipoCargo.id
                                                  ? { ...cargo, periodicidadId: e.target.value || null }
                                                  : cargo
                                              )
                                            );
                                          }}
                                          label="Periodicidad"
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
                                    {/* Campos del cargo */}
                                    {(() => {
                                      const campos = camposPorTipoCargo[cargoSeleccionado.tipoCargoId] || [];
                                      if (campos.length === 0) return null;
                                      
                                      return campos.map((campo) => (
                                        <TextField
                                          key={campo.id}
                                          size="small"
                                          label={campo.nombre}
                                          value={cargoSeleccionado.campos?.[campo.id] || ''}
                                          onChange={(e) => {
                                            setCargosSeleccionados(
                                              cargosSeleccionados.map(cargo =>
                                                cargo.tipoCargoId === tipoCargo.id
                                                  ? {
                                                      ...cargo,
                                                      campos: {
                                                        ...cargo.campos,
                                                        [campo.id]: e.target.value
                                                      }
                                                    }
                                                  : cargo
                                              )
                                            );
                                          }}
                                          placeholder={campo.nombre}
                                          sx={{ 
                                            minWidth: 130,
                                            maxWidth: 150,
                                            '& .MuiInputBase-root': {
                                              height: '32px'
                                            },
                                            '& .MuiInputLabel-root': {
                                              fontSize: '0.75rem'
                                            }
                                          }}
                                        />
                                      ));
                                    })()}
                                  </Box>
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      ) : (
                        <Alert severity="info" sx={{ py: 1 }}>No hay tipos de cargo disponibles.</Alert>
                      )}
                    
                  </Box>
                )}

                {/* Tab Panel: Documentación */}
                {tabValue === 2 && (
                  <Box>
                    {documentacion.length === 0 ? (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        No hay tipos de documentación configurados. Configurá los tipos de documentación en la sección de Configuración.
                      </Alert>
                    ) : (
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
                                  disabled={documentacion.filter(doc => doc.necesario).length === 0}
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
                            <TableRow key={doc.tipoDocumentoPropiedadId || `doc-${index}`} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontSize: '0.8125rem', lineHeight: 1.2 }}>{doc.nombre}</Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Checkbox
                                  checked={doc.necesario || false}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const nuevoValor = e.target.checked;
                                    setDocumentacion(prev => 
                                      prev.map(d =>
                                        d.tipoDocumentoPropiedadId === doc.tipoDocumentoPropiedadId 
                                          ? { ...d, necesario: nuevoValor, recibido: nuevoValor ? d.recibido : false } 
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
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const nuevoValor = e.target.checked;
                                    setDocumentacion(prev => 
                                      prev.map(d =>
                                        d.tipoDocumentoPropiedadId === doc.tipoDocumentoPropiedadId 
                                          ? { ...d, recibido: nuevoValor } 
                                          : d
                                      )
                                    );
                                  }}
                                  size="small"
                                  sx={{ py: 0 }}
                                  disabled={!doc.necesario}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              const vieneDePropietarios = sessionStorage.getItem('propietarioIdParaAsociar');
              setOpen(false);
              resetForm();
              // Limpiar sessionStorage de propiedades cuando se cancela
              sessionStorage.removeItem('propiedadEnEdicion');
              sessionStorage.removeItem('propiedadFormData');
              sessionStorage.removeItem('propiedadEstadoCompleto');
              sessionStorage.removeItem('propiedadIdParaAsociar');
              sessionStorage.removeItem('propiedadNuevaParaAsociar');
              // Si viene de Propietarios, volver allí
              if (vieneDePropietarios && !editing) {
                // NO eliminar propietarioIdParaAsociar ni propietarioEnEdicion cuando se cancela
                // Se eliminarán cuando se cierre el diálogo de Propietarios normalmente
                navigate('/clientes?tab=0');
              }
            }}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained">
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

