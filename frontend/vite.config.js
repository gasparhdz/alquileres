import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Escuchar en todas las interfaces de red
    port: 5173,
    proxy: {
      '/api': {
        // Cambiar a la IP de tu servidor cuando accedas desde otra máquina
        target: 'http://192.168.100.183:4000',
        changeOrigin: true,
        // Alternativa: usar localhost si accedes desde la misma máquina
        // target: 'http://localhost:4000',
      }
    }
  }
});

