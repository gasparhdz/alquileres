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
  InputAdornment,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const formatNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  return Number.isFinite(n) ? n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
};

/**
 * Tabla de expensas (ordinarias/extraordinarias) agrupadas por propiedad. Solo actualiza estado local vía callbacks.
 */
export default function TablaExpensas({
  expensasAgrupadas = {},
  propiedadesExpensas = [],
  expandedAccordions = {},
  onAccordionChange,
  verCompletados,
  parseImporteFormatted,
  importesEditados = {},
  camposEnFoco = {},
  itemsError = {},
  itemsSaving = {},
  actoresEditados = {},
  actores = [],
  actorInqId,
  actorPropId,
  onImporteChange,
  onActorChange,
  onImporteFocus,
  onImporteBlur,
  onClearItemError,
  importeInputRefs
}) {
  const totalPendientes = propiedadesExpensas.reduce((total, propiedad) => {
    const expensasGrupo = expensasAgrupadas[propiedad] || [];
    return total + expensasGrupo.reduce((subtotal, expensa) => {
      let pendientes = 0;
      const ordPendiente = expensa.estadoItemORD ? expensa.estadoItemORD.codigo === 'PENDIENTE' : (expensa.importeORD == null || expensa.importeORD === 0 || expensa.importeORD === '');
      const extPendiente = expensa.estadoItemEXT ? expensa.estadoItemEXT.codigo === 'PENDIENTE' : (expensa.importeEXT == null || expensa.importeEXT === 0 || expensa.importeEXT === '');
      if (expensa.itemIdORD && ordPendiente) pendientes++;
      if (expensa.itemIdEXT && extPendiente) pendientes++;
      return subtotal + pendientes;
    }, 0);
  }, 0);

  return (
    <Paper sx={{ p: 2, borderRadius: 2 }}>
      {totalPendientes > 0 && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ mb: 2, '& .MuiAlert-message': { fontWeight: 500 } }}
        >
          Hay {totalPendientes} item{totalPendientes !== 1 ? 's' : ''} de expensas pendiente{totalPendientes !== 1 ? 's' : ''} de completar
        </Alert>
      )}
      {propiedadesExpensas.map((propiedad) => {
        const expensasGrupo = expensasAgrupadas[propiedad] || [];
        if (expensasGrupo.length === 0) return null;
        const primeraExpensa = expensasGrupo[0];
        const isExpanded = expandedAccordions[propiedad] === true;

        return (
          <Accordion
            key={propiedad}
            expanded={isExpanded}
            onChange={(e, expanded) => onAccordionChange?.(propiedad, expanded)}
            sx={{
              mb: 1,
              '&:before': { display: 'none' },
              borderRadius: '8px',
              overflow: 'hidden',
              '&.Mui-expanded': { borderRadius: '8px' }
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ fontSize: '0.9rem', color: 'white' }} />}
              sx={{
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                color: 'white',
                borderRadius: '8px',
                '&:hover': { background: 'linear-gradient(135deg, #047857 0%, #059669 100%)' },
                minHeight: '28px !important',
                maxHeight: '28px !important',
                '& .MuiAccordionSummary-content': { my: 0, alignItems: 'center', minHeight: '28px !important' },
                '&.Mui-expanded': {
                  minHeight: '28px !important',
                  maxHeight: '28px !important',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  borderRadius: '8px 8px 0 0'
                },
                '& .MuiSvgIcon-root': { color: 'white' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', pr: 1 }}>
                <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1, fontSize: '0.875rem', color: 'white' }}>
                  {propiedad}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0, '&.MuiAccordionDetails-root': { py: 0, borderRadius: '0 0 8px 8px' } }}>
              {/* Vista Desktop */}
              <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', md: 'block' }, borderRadius: '0 0 8px 8px', overflow: 'hidden', border: 'none', boxShadow: 'none', mt: 0 }}>
                <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.15, px: 0.75, fontSize: '0.8rem' } }}>
                  <TableHead>
                    <TableRow sx={{ '& .MuiTableCell-head': { py: 0.25, px: 0.75, fontWeight: 600, fontSize: '0.75rem', backgroundColor: 'rgba(0, 0, 0, 0.04)', borderTop: 'none' } }}>
                      <TableCell>Inquilino</TableCell>
                      <TableCell>Tipo</TableCell>
                      <TableCell>Período</TableCell>
                      <TableCell>Pagado por</TableCell>
                      <TableCell>Cobrar a</TableCell>
                      <TableCell>Importe Anterior</TableCell>
                      <TableCell>Importe</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {expensasGrupo.map((expensa) => {
                      const renderRow = (tipo, itemId, importe, importeAnterior, pagadoPorActorId, quienSoportaCostoId, periodoRef) => {
                        if (!itemId) return null;
                        const valorEditado = importesEditados[itemId];
                        const estaEnFoco = camposEnFoco[itemId] === true;
                        const tieneValorEditado = valorEditado !== undefined && valorEditado !== null;
                        let valorAMostrar = '';
                        if (estaEnFoco) {
                          valorAMostrar = tieneValorEditado ? String(valorEditado) : (importe != null ? String(importe).replace('.', ',') : '0');
                        } else {
                          if (tieneValorEditado && valorEditado !== '') {
                            const valorNum = parseImporteFormatted(valorEditado);
                            valorAMostrar = valorNum !== null ? formatNumber(valorNum) : String(valorEditado);
                          } else if (tieneValorEditado && valorEditado === '') {
                            valorAMostrar = '';
                          } else {
                            const importeNum = importe != null ? (typeof importe === 'string' ? parseFloat(importe) : importe) : null;
                            valorAMostrar = importeNum != null && !isNaN(importeNum) ? formatNumber(importeNum) : '';
                          }
                        }
                        const actoresItem = actoresEditados[itemId] || {};
                        const pagadoPorActorIdActual = actoresItem.pagadoPorActorId !== undefined ? actoresItem.pagadoPorActorId : pagadoPorActorId;
                        const quienSoportaCostoIdActual = actoresItem.quienSoportaCostoId !== undefined ? actoresItem.quienSoportaCostoId : quienSoportaCostoId;
                        const estadoItem = tipo === 'ORD' ? expensa.estadoItemORD : expensa.estadoItemEXT;
                        const estaCompletado = estadoItem ? estadoItem.codigo !== 'PENDIENTE' : (importe != null && importe !== 0 && importe !== '');

                        return (
                          <TableRow
                            key={`${itemId}-${tipo}`}
                            hover
                            sx={{
                              '& .MuiTableCell-body': { py: 0.15 },
                              ...(estaCompletado && verCompletados && { bgcolor: 'rgba(16, 185, 129, 0.08)', opacity: 0.75 })
                            }}
                          >
                            <TableCell sx={{ fontSize: '0.8rem' }}>{primeraExpensa.inquilino || '-'}</TableCell>
                            <TableCell sx={{ fontSize: '0.8rem' }}>{tipo === 'ORD' ? 'Ordinarias' : 'Extraordinarias'}</TableCell>
                            <TableCell sx={{ fontSize: '0.8rem' }}>{periodoRef ? periodoRef.replace(/^(\d{4})-(\d{2})$/, '$2-$1') : '-'}</TableCell>
                            <TableCell sx={{ width: '140px', padding: '1px 4px' }}>
                              <FormControl fullWidth size="small">
                                <Select
                                  value={pagadoPorActorIdActual || ''}
                                  onChange={(e) => { e.stopPropagation(); onActorChange?.(itemId, 'pagadoPorActorId', e.target.value || null); }}
                                  onClick={(e) => e.stopPropagation()}
                                  displayEmpty
                                  sx={{ height: '26px', fontSize: '0.75rem', '& .MuiSelect-select': { padding: '1px 4px', fontSize: '0.75rem' } }}
                                  disabled={itemsSaving[itemId]}
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
                                  value={quienSoportaCostoIdActual || ''}
                                  onChange={(e) => { e.stopPropagation(); onActorChange?.(itemId, 'quienSoportaCostoId', e.target.value || null); }}
                                  onClick={(e) => e.stopPropagation()}
                                  displayEmpty
                                  sx={{ height: '26px', fontSize: '0.75rem', '& .MuiSelect-select': { padding: '1px 4px', fontSize: '0.75rem' } }}
                                  disabled={itemsSaving[itemId]}
                                >
                                  <MenuItem value=""><em>Sin definir</em></MenuItem>
                                  {actores.filter((a) => a.activo && (a.id === actorInqId || a.id === actorPropId)).map((actor) => (
                                    <MenuItem key={actor.id} value={actor.id}>{actor.nombre}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.8rem', textAlign: 'right' }}>
                              {importeAnterior != null ? formatNumber(typeof importeAnterior === 'string' ? parseFloat(importeAnterior) : importeAnterior) : '-'}
                            </TableCell>
                            <TableCell sx={{ width: '120px', padding: '1px 4px' }}>
                              <TextField
                                fullWidth
                                size="small"
                                type="text"
                                value={valorAMostrar}
                                error={itemsError[itemId] === true}
                                inputRef={(el) => { if (el && importeInputRefs?.current) importeInputRefs.current[itemId] = el; }}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  onImporteChange?.(itemId, e.target.value.replace(/[^\d,.-]/g, ''));
                                  if (itemsError[itemId]) onClearItemError?.(itemId);
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.dataset.enterPressed = 'true'; e.target.blur(); } }}
                                onFocus={(e) => {
                                  e.stopPropagation();
                                  onImporteFocus?.(itemId, importe, e);
                                }}
                                onBlur={(e) => onImporteBlur?.(e, itemId, tipo, expensa, expensasGrupo)}
                                onClick={(e) => e.stopPropagation()}
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start" sx={{ mr: 0 }}>
                                      {itemsSaving[itemId] ? <CircularProgress size={12} sx={{ color: 'primary.main' }} /> : <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>$</Typography>}
                                    </InputAdornment>
                                  )
                                }}
                                inputProps={{ style: { textAlign: 'right', fontSize: '0.75rem' } }}
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    height: '26px',
                                    '& fieldset': { borderWidth: '1px', borderColor: itemsError[itemId] ? 'error.main' : (estaCompletado ? 'success.light' : undefined) }
                                  },
                                  '& .MuiInputBase-input': { padding: '2px 4px', height: '26px', fontSize: '0.75rem' }
                                }}
                                disabled={itemsSaving[itemId]}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      };
                      return (
                        <React.Fragment key={`${expensa.propiedad}-${expensa.inquilino || 'sin-inquilino'}`}>
                          {renderRow('ORD', expensa.itemIdORD, expensa.importeORD, expensa.importeAnteriorORD, expensa.pagadoPorActorIdORD, expensa.quienSoportaCostoIdORD, expensa.periodoRef)}
                          {renderRow('EXT', expensa.itemIdEXT, expensa.importeEXT, expensa.importeAnteriorEXT, expensa.pagadoPorActorIdEXT, expensa.quienSoportaCostoIdEXT, expensa.periodoRef)}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Vista Mobile (Cards) */}
              <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 2, p: 1, backgroundColor: 'grey.50' }}>
                {expensasGrupo.map((expensa) => {
                  const renderCard = (tipo, itemId, importe, importeAnterior, pagadoPorActorId, quienSoportaCostoId, periodoRef) => {
                    if (!itemId) return null;
                    const valorEditado = importesEditados[itemId];
                    const estaEnFoco = camposEnFoco[itemId] === true;
                    const tieneValorEditado = valorEditado !== undefined && valorEditado !== null;
                    let valorAMostrar = '';
                    if (estaEnFoco) {
                      valorAMostrar = tieneValorEditado ? String(valorEditado) : (importe != null ? String(importe).replace('.', ',') : '0');
                    } else {
                      if (tieneValorEditado && valorEditado !== '') {
                        const valorNum = parseImporteFormatted(valorEditado);
                        valorAMostrar = valorNum !== null ? formatNumber(valorNum) : String(valorEditado);
                      } else if (tieneValorEditado && valorEditado === '') {
                        valorAMostrar = '';
                      } else {
                        const importeNum = importe != null ? (typeof importe === 'string' ? parseFloat(importe) : importe) : null;
                        valorAMostrar = importeNum != null && !isNaN(importeNum) ? formatNumber(importeNum) : '';
                      }
                    }
                    const actoresItem = actoresEditados[itemId] || {};
                    const pagadoPorActorIdActual = actoresItem.pagadoPorActorId !== undefined ? actoresItem.pagadoPorActorId : pagadoPorActorId;
                    const quienSoportaCostoIdActual = actoresItem.quienSoportaCostoId !== undefined ? actoresItem.quienSoportaCostoId : quienSoportaCostoId;
                    const estadoItem = tipo === 'ORD' ? expensa.estadoItemORD : expensa.estadoItemEXT;
                    const estaCompletado = estadoItem ? estadoItem.codigo !== 'PENDIENTE' : (importe != null && importe !== 0 && importe !== '');

                    return (
                      <Card key={`${itemId}-${tipo}`} variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.25 }}>
                          {primeraExpensa.inquilino || '-'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                          {tipo === 'ORD' ? 'Ordinarias' : 'Extraordinarias'}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1.5 }}>
                          Período: {periodoRef ? periodoRef.replace(/^(\d{4})-(\d{2})$/, '$2-$1') : '-'}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Pagado por</Typography>
                            <FormControl fullWidth size="small" sx={{ width: '100%' }}>
                              <Select
                                value={pagadoPorActorIdActual || ''}
                                onChange={(e) => { e.stopPropagation(); onActorChange?.(itemId, 'pagadoPorActorId', e.target.value || null); }}
                                displayEmpty
                                sx={{ height: '36px', fontSize: '0.875rem' }}
                                disabled={itemsSaving[itemId]}
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
                                value={quienSoportaCostoIdActual || ''}
                                onChange={(e) => { e.stopPropagation(); onActorChange?.(itemId, 'quienSoportaCostoId', e.target.value || null); }}
                                displayEmpty
                                sx={{ height: '36px', fontSize: '0.875rem' }}
                                disabled={itemsSaving[itemId]}
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
                            Importe Anterior: {importeAnterior != null ? formatNumber(typeof importeAnterior === 'string' ? parseFloat(importeAnterior) : importeAnterior) : '-'}
                          </Typography>
                          <TextField
                            fullWidth
                            size="small"
                            type="text"
                            value={valorAMostrar}
                            error={itemsError[itemId] === true}
                            inputRef={(el) => { if (el && importeInputRefs?.current) importeInputRefs.current[itemId] = el; }}
                            onChange={(e) => {
                              e.stopPropagation();
                              onImporteChange?.(itemId, e.target.value.replace(/[^\d,.-]/g, ''));
                              if (itemsError[itemId]) onClearItemError?.(itemId);
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.dataset.enterPressed = 'true'; e.target.blur(); } }}
                            onFocus={(e) => {
                              e.stopPropagation();
                              onImporteFocus?.(itemId, importe, e);
                            }}
                            onBlur={(e) => onImporteBlur?.(e, itemId, tipo, expensa, expensasGrupo)}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start" sx={{ mr: 0 }}>
                                  {itemsSaving[itemId] ? <CircularProgress size={12} sx={{ color: 'primary.main' }} /> : <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>$</Typography>}
                                </InputAdornment>
                              )
                            }}
                            sx={{
                              width: '100%',
                              '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: itemsError[itemId] ? 'error.main' : (estaCompletado ? 'success.light' : undefined) }
                              }
                            }}
                            disabled={itemsSaving[itemId]}
                          />
                        </Box>
                      </Card>
                    );
                  };
                  return (
                    <React.Fragment key={`${expensa.propiedad}-${expensa.inquilino || 'sin-inquilino'}-mobile`}>
                      {renderCard('ORD', expensa.itemIdORD, expensa.importeORD, expensa.importeAnteriorORD, expensa.pagadoPorActorIdORD, expensa.quienSoportaCostoIdORD, expensa.periodoRef)}
                      {renderCard('EXT', expensa.itemIdEXT, expensa.importeEXT, expensa.importeAnteriorEXT, expensa.pagadoPorActorIdEXT, expensa.quienSoportaCostoIdEXT, expensa.periodoRef)}
                    </React.Fragment>
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
