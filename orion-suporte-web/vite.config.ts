import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    /** Porta dedicada (não 5174) para não coincidir com o “próximo livre” do Vite do SAD em 5173 ocupada. */
    port: 5180,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4180,
  },
});
