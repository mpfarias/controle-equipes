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
    port: 6173,
    /** Dev em 6173; prod local (preview) em 5173 — ver `.env.development` / `.env.production`. */
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  },
});

