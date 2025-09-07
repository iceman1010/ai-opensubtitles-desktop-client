import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: './renderer',
  base: './', // CRITICAL: Relative paths required for Windows Electron builds
  build: {
    outDir: '../dist/renderer'
  },
  server: {
    port: 5173
  }
});