import { useState, useEffect } from 'react';

/**
 * Devuelve un valor debounced del valor pasado.
 * @param {*} value - Valor a debouncear
 * @param {number} delay - Retraso en ms
 * @returns Valor actualizado después de dejar de cambiar durante `delay` ms
 */
export function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
