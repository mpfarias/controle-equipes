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
          pdf: ['jspdf'],
          crop: ['react-image-crop'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    /** Impede que o SAD “roube” 5174/5175 quando 5173 estiver ocupada — o link do Órion Suporte não pode apontar para o front errado. */
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});

