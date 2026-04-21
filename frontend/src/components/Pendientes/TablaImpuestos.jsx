import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Card,
  TextField,
  Alert,
  FormControl,
  Select,
  MenuItem,
  Chip,
  InputAdornment,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

/** Formatea número para mostrar (miles con punto, decimal con coma). */
const formatNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  return Number.isFinite(n) ? n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
};

/**
 * Tabla de ítems de impuestos pendientes. Solo actualiza estado local vía callbacks (sin guardado en onBlur).
 * @param {object} props
 * @param {Array} props.impuestosData - Grupos de impuestos (con tipoImpuesto e items)
 * @param {string} props.tipoImpuesto - Filtro por tipo (opcional)
 * @param {object} props.expandedAccordions - { [tipo]: boolean }
 * @param {(tipo: string) => (e, expanded) => void} props.onAccordionChange
 * @param {boolean} props.verCompletados
 * @param {(item) => boolean} props.esItemPendiente
 * @param {(value) => number|null} props.parseImporteFormatted
 * @param {object} props.importesEditados - { [itemId]: string }
 * @param {object} props.camposEnFoco - { [itemId]: boolean }
 * @param {object} props.itemsError - { [itemId]: boolean }
 * @param {object} props.itemsSaving - { [itemId]: boolean }
 * @param {object} props.pagadoPorEditado - { [itemId]: id }
 * @param {object} props.quienSoportaCostoEditado - { [itemId]: id }
 * @param {Array} props.actores - Lista de actores
 * @param {number} props.actorInqId
 * @param {number} props.actorPropId
 * @param {(itemId, value) => void} props.onImporteChange
 * @param {(itemId, value) => void} props.onPagadoPorChange
 * @param {(itemId, value) => void} props.onQuienSoportaChange
 * @param {(itemId, item, itemIndex, items, e?) => void} props.onImporteFocus
 * @param {(e, itemId, item, itemIndex, items) => void} props.onImporteBlur
 * @param {React.MutableRefObject<object>} props.importeInputRefs
 */
export default function TablaImpuestos({
  impuestosData = [],
  tipoImpuesto = '',
  expandedAccordions = {},
  onAccordionChange,
  verCompletados,
  esItemPendiente,
  parseImporteFormatted,
  importesEditados = {},
  camposEnFoco = {},
  itemsError = {},
  itemsSaving = {},
  pagadoPorEditado = {},
  quienSoportaCostoEditado = {},
  actores = [],
  actorInqId,
  actorPropId,
  onImporteChange,
  onPagadoPorChange,
  onQuienSoportaChange,
  onImporteFocus,
  onImporteBlur,
  importeInputRefs
}) {
  const grupos = (impuestosData || [])
    .filter((grupo) => !tipoImpuesto || grupo.tipoImpuesto?.codigo === tipoImpuesto);

  const totalPendientes = grupos.reduce((total, grupo) => {
    const items = grupo.items || [];
    return total + items.filter(esItemPendiente).length;
  }, 0);

  return (
    <Paper sx={{ p: 2, borderRadius: 2 }}>
      {totalPendientes > 0 && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ mb: 2, '& .MuiAlert-message': { fontWeight: 500 } }}
        >
          Hay {totalPendientes} item{totalPendientes !== 1 ? 's' : ''} pendiente{totalPendientes !== 1 ? 's' : ''} de completar
        </Alert>
      )}
      {grupos.map((grupo) => {
        const tipo = grupo.tipoImpuesto?.codigo || 'SIN_TIPO';
        const items = grupo.items || [];
        const itemsPendientes = items.filter(esItemPendiente);
        const isExpanded = expandedAccordions[tipo] === true;
        const handleChange = onAccordionChange ? onAccordionChange(tipo) : undefined;

        return (
          <Accordion
            key={tipo}
            expanded={isExpanded}
            onChange={handleChange}
            sx={{
              mb: 0.5,
              '&:before': { display: 'none' },
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              borderRadius: '8px',
              overflow: 'hidden',
              '&.Mui-expanded': { borderRadius: '8px' }
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ fontSize: '0.9rem' }} />}
              sx={{
                minHeight: '28px !important',
                maxHeight: '28px !important',
                borderRadius: '8px',
                '& .MuiAccordionSummary-content': { my: 0, alignItems: 'center', minHeight: '28px !important' },
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                color: 'white',
                '&:hover': { background: 'linear-gradient(135deg, #047857 0%, #059669 100%)' },
                '&.Mui-expanded': {
                  minHeight: '28px !important',
                  maxHeight: '28px !important',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  borderRadius: '8px 8px 0 0'
                },
                '& .MuiSvgIcon-root': { color: 'white' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 500, fontSize: '0.875rem', color: 'white' }}>
                  {grupo.tipoImpuesto?.nombre || grupo.tipoImpuesto?.codigo || tipo}
                </Typography>
                <Chip
                  label={`${itemsPendientes.length} item${itemsPendientes.length !== 1 ? 's pendientes' : ' pendiente'}`}
                  size="small"
                  variant="outlined"
                  sx={{
                    height: '16px',
                    fontSize: '0.6rem',
                    '& .MuiChip-label': { px: 0.5, py: 0, color: 'white' },
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                    color: 'white'
                  }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0, '&.MuiAccordionDetails-root': { py: 0, borderRadius: '0 0 8px 8px' } }}>
              {/* Vista Desktop */}
              <TableContainer sx={{ display: { xs: 'none', md: 'block' }, borderRadius: '0 0 8px 8px', overflow: 'hidden', mt: 0 }}>
                <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.1, px: 0.75, fontSize: '0.8rem' } }}>
                  <TableHead>
                    <TableRow
                      sx={{
                        '& .MuiTableCell-head': {
                          py: 0.15,
                          px: 0.75,
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          backgroundColor: 'rgba(0, 0, 0, 0.04)',
                          borderTop: 'none',
                          '&:first-of-type': { borderTopLeftRadius: 0 },
                          '&:last-of-type': { borderTopRightRadius: 0 }
                        }
                      }}
                    >
                      <TableCell>Propiedad</TableCell>
                      <TableCell>Inquilino</TableCell>
                      <TableCell>Período</TableCell>
                      <TableCell>Pagado por</TableCell>
                      <TableCell>Cobrar a</TableCell>
                      <TableCell>Importe Anterior</TableCell>
                      <TableCell>Importe</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item, itemIndex) => {
                      const valorEditado = importesEditados[item.itemId];
                      const estaEnFoco = camposEnFoco[item.itemId] === true;
                      const estaCompletado = !esItemPendiente(item);
                      const tieneValorEditado = valorEditado !== undefined && valorEditado !== null;
                      let valorAMostrar = '';
                      if (estaEnFoco) {
                        valorAMostrar = tieneValorEditado
                          ? String(valorEditado)
                          : (item.importe != null ? item.importe.toString().replace('.', ',') : '0');
                      } else {
                        if (tieneValorEditado && valorEditado !== '') {
                          const valorNum = parseImporteFormatted(valorEditado);
                          valorAMostrar = valorNum !== null ? formatNumber(valorNum) : String(valorEditado);
                        } else if (tieneValorEditado && valorEditado === '') {
                          valorAMostrar = '';
                        } else {
                          const importeNum =
                            item.importe != null
                              ? (typeof item.importe === 'string' ? parseFloat(item.importe) : item.importe)
                              : null;
                          valorAMostrar = importeNum != null && !isNaN(importeNum) ? formatNumber(importeNum) : '';
                        }
                      }

                      return (
                        <TableRow
                          key={item.itemId}
                          hover
                          sx={{
                            '& .MuiTableCell-body': { py: 0.1 },
                            ...(estaCompletado && verCompletados && {
                              bgcolor: 'rgba(16, 185, 129, 0.08)',
                              opacity: 0.75
                            })
                          }}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.8rem', lineHeight: 1.2 }}>
                              {item.propiedad || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>{item.inquilino || '-'}</TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>
                            {item.periodoRef ? item.periodoRef.replace(/^(\d{4})-(\d{2})$/, '$2-$1') : '-'}
                          </TableCell>
                          <TableCell sx={{ width: '140px', padding: '1px 4px' }}>
                            <FormControl fullWidth size="small">
                              <Select
                                value={pagadoPorEditado[item.itemId] !== undefined ? pagadoPorEditado[item.itemId] : (item.pagadoPorActorId || '')}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const v = e.target.value || null;
                                  onPagadoPorChange(item.itemId, v);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                displayEmpty
                                sx={{
                                  height: '22px',
                                  fontSize: '0.75rem',
                                  '& .MuiSelect-select': { padding: '1px 4px', fontSize: '0.75rem' }
                                }}
                                disabled={itemsSaving[item.itemId]}
                              >
                                <MenuItem value=""><em>Sin definir</em></MenuItem>
                                {actores.filter((a) => a.activo).map((actor) => (
                                  <MenuItem key={actor.id} value={actor.id}>{actor.nombre}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell sx={{ width: '140px', padding: '1px 4px' }}>
                            <FormControl fullWidth size="small">
                              <Select
                                value={quienSoportaCostoEditado[item.itemId] !== undefined ? quienSoportaCostoEditado[item.itemId] : (item.quienSoportaCostoId || '')}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const v = e.target.value || null;
                                  onQuienSoportaChange(item.itemId, v);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                displayEmpty
                                sx={{
                                  height: '22px',
                                  fontSize: '0.75rem',
                                  '& .MuiSelect-select': { padding: '1px 4px', fontSize: '0.75rem' }
                                }}
                                disabled={itemsSaving[item.itemId]}
                              >
                                <MenuItem value=""><em>Sin definir</em></MenuItem>
                                {actores.filter((a) => a.activo && (a.id === actorInqId || a.id === actorPropId)).map((actor) => (
                                  <MenuItem key={actor.id} value={actor.id}>{actor.nombre}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.8rem', textAlign: 'right' }}>
                            {item.importeAnterior != null
                              ? formatNumber(typeof item.importeAnterior === 'string' ? parseFloat(item.importeAnterior) : item.importeAnterior)
                              : '-'}
                          </TableCell>
                          <TableCell sx={{ width: '120px', padding: '1px 4px' }}>
                            <TextField
                              fullWidth
                              size="small"
                              variant="outlined"
                              type="text"
                              value={valorAMostrar}
                              error={itemsError[item.itemId] === true}
                              inputRef={(el) => {
                                if (el && importeInputRefs?.current) importeInputRefs.current[item.itemId] = el;
                              }}
                              onChange={(e) => {
                                e.stopPropagation();
                                onImporteChange(item.itemId, e.target.value.replace(/[^\d,.-]/g, ''));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.target.dataset.enterPressed = 'true';
                                  e.target.blur();
                                }
                              }}
                              onFocus={(e) => {
                                e.stopPropagation();
                                onImporteFocus?.(item.itemId, item, itemIndex, items, e);
                              }}
                              onBlur={(e) => {
                                onImporteBlur?.(e, item.itemId, item, itemIndex, items);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              InputProps={{
                                startAdornment: (
                                  <InputAdornment position="start" sx={{ mr: 0 }}>
                                    {itemsSaving[item.itemId] ? (
                                      <CircularProgress size={12} sx={{ color: 'primary.main' }} />
                                    ) : (
                                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>$</Typography>
                                    )}
                                  </InputAdornment>
                                )
                              }}
                              inputProps={{
                                style: { textAlign: 'right', fontSize: '0.75rem', padding: '1px 4px' }
                              }}
                              sx={{
                                width: '100%',
                                '& .MuiOutlinedInput-root': {
                                  height: '22px',
                                  '& fieldset': {
                                    borderWidth: '1px',
                                    borderColor: itemsError[item.itemId] ? 'error.main' : (estaCompletado ? 'success.light' : undefined)
                                  }
                                },
                                '& .MuiInputBase-input': { padding: '1px 4px', height: '22px', fontSize: '0.75rem' }
                              }}
                              disabled={itemsSaving[item.itemId]}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Vista Mobile (Cards) */}
              <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 2, p: 1, backgroundColor: 'grey.50' }}>
                {items.map((item, itemIndex) => {
                  const valorEditado = importesEditados[item.itemId];
                  const estaEnFoco = camposEnFoco[item.itemId] === true;
                  const estaCompletado = !esItemPendiente(item);
                  const tieneValorEditado = valorEditado !== undefined && valorEditado !== null;
                  let valorAMostrar = '';
                  if (estaEnFoco) {
                    valorAMostrar = tieneValorEditado
                      ? String(valorEditado)
                      : (item.importe != null ? item.importe.toString().replace('.', ',') : '0');
                  } else {
                    if (tieneValorEditado && valorEditado !== '') {
                      const valorNum = parseImporteFormatted(valorEditado);
                      valorAMostrar = valorNum !== null ? formatNumber(valorNum) : String(valorEditado);
                    } else if (tieneValorEditado && valorEditado === '') {
                      valorAMostrar = '';
                    } else {
                      const importeNum =
                        item.importe != null
                          ? (typeof item.importe === 'string' ? parseFloat(item.importe) : item.importe)
                          : null;
                      valorAMostrar = importeNum != null && !isNaN(importeNum) ? formatNumber(importeNum) : '';
                    }
                  }
                  return (
                    <Card key={item.itemId} variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.25 }}>
                        {item.propiedad || '-'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {item.inquilino || '-'}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5, alignItems: 'center' }}>
                        <Typography variant="body2">Período: {item.periodoRef ? item.periodoRef.replace(/^(\d{4})-(\d{2})$/, '$2-$1') : '-'}</Typography>
                        {estaCompletado && verCompletados && (
                          <Chip label="Completado" size="small" sx={{ bgcolor: 'rgba(16, 185, 129, 0.2)', color: 'success.dark' }} />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Pagado por</Typography>
                          <FormControl fullWidth size="small" sx={{ width: '100%' }}>
                            <Select
                              value={pagadoPorEditado[item.itemId] !== undefined ? pagadoPorEditado[item.itemId] : (item.pagadoPorActorId || '')}
                              onChange={(e) => {
                                e.stopPropagation();
                                const v = e.target.value || null;
                                onPagadoPorChange(item.itemId, v);
                              }}
                              displayEmpty
                              sx={{ height: '36px', fontSize: '0.875rem' }}
                              disabled={itemsSaving[item.itemId]}
                            >
                              <MenuItem value=""><em>Sin definir</em></MenuItem>
                              {actores.filter((a) => a.activo).map((actor) => (
                                <MenuItem key={actor.id} value={actor.id}>{actor.nombre}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Cobrar a</Typography>
                          <FormControl fullWidth size="small" sx={{ width: '100%' }}>
                            <Select
                              value={quienSoportaCostoEditado[item.itemId] !== undefined ? quienSoportaCostoEditado[item.itemId] : (item.quienSoportaCostoId || '')}
                              onChange={(e) => {
                                e.stopPropagation();
                                const v = e.target.value || null;
                                onQuienSoportaChange(item.itemId, v);
                              }}
                              displayEmpty
                              sx={{ height: '36px', fontSize: '0.875rem' }}
                              disabled={itemsSaving[item.itemId]}
                            >
                              <MenuItem value=""><em>Sin definir</em></MenuItem>
                              {actores.filter((a) => a.activo && (a.id === actorInqId || a.id === actorPropId)).map((actor) => (
                                <MenuItem key={actor.id} value={actor.id}>{actor.nombre}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                      </Box>
                      <Box sx={{ mt: 1.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          Importe Anterior: {item.importeAnterior != null
                            ? formatNumber(typeof item.importeAnterior === 'string' ? parseFloat(item.importeAnterior) : item.importeAnterior)
                            : '-'}
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          variant="outlined"
                          type="text"
                          value={valorAMostrar}
                          error={itemsError[item.itemId] === true}
                          inputRef={(el) => {
                            if (el && importeInputRefs?.current) importeInputRefs.current[item.itemId] = el;
                          }}
                          onChange={(e) => {
                            e.stopPropagation();
                            onImporteChange(item.itemId, e.target.value.replace(/[^\d,.-]/g, ''));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.target.dataset.enterPressed = 'true';
                              e.target.blur();
                            }
                          }}
                          onFocus={(e) => {
                            e.stopPropagation();
                            onImporteFocus?.(item.itemId, item, itemIndex, items, e);
                          }}
                          onBlur={(e) => {
                            onImporteBlur?.(e, item.itemId, item, itemIndex, items);
                          }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start" sx={{ mr: 0 }}>
                                {itemsSaving[item.itemId] ? (
                                  <CircularProgress size={12} sx={{ color: 'primary.main' }} />
                                ) : (
                                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>$</Typography>
                                )}
                              </InputAdornment>
                            )
                          }}
                          sx={{
                            width: '100%',
                            '& .MuiOutlinedInput-root': {
                              '& fieldset': {
                                borderColor: itemsError[item.itemId] ? 'error.main' : (estaCompletado ? 'success.light' : undefined)
                              }
                            }
                          }}
                          disabled={itemsSaving[item.itemId]}
                        />
                      </Box>
                    </Card>
                  );
                })}
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Paper>
  );
}
