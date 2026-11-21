import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' para funcionar dentro do Electron (file://) e do Capacitor
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
});
