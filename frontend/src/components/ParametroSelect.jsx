import { useQuery } from '@tanstack/react-query';
import { FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material';
import api from '../api';

export default function ParametroSelect({ 
  categoriaCodigo, 
  value, 
  onChange, 
  label, 
  required = false,
  fullWidth = true,
  mostrarAbreviatura = false,
  error = false,
  helperText = ''
}) {
  const { data: parametros, isLoading } = useQuery({
    queryKey: ['parametros', categoriaCodigo],
    queryFn: async () => {
      const response = await api.get(`/parametros/categorias/${categoriaCodigo}/parametros`);
      return response.data;
    },
    enabled: !!categoriaCodigo,
    staleTime: 5 * 60 * 1000 // Cache por 5 minutos
  });

  return (
    <FormControl 
      fullWidth={fullWidth} 
      required={required} 
      size="small"
      error={error}
      sx={{
        minWidth: fullWidth ? 'auto' : 150,
        '& .MuiInputLabel-root': {
          transform: 'translate(14px, 9px) scale(1)',
          '&.MuiInputLabel-shrink': {
            transform: 'translate(14px, -9px) scale(0.75)'
          }
        }
      }}
    >
      <InputLabel>{label}</InputLabel>
      <Select
        value={value || ''}
        onChange={onChange}
        label={label}
        disabled={isLoading}
      >
        <MenuItem value="">
          <em>Seleccione...</em>
        </MenuItem>
        {parametros?.map((param) => (
          <MenuItem key={param.id} value={param.id}>
            {mostrarAbreviatura ? (param.abreviatura || param.descripcion) : param.descripcion}
          </MenuItem>
        ))}
      </Select>
      {helperText && (
        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
          {helperText}
        </Typography>
      )}
    </FormControl>
  );
}

