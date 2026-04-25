import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const fromEnv = env.VITE_ORION_OPERACOES_PORT;
  const parsed = fromEnv != null && String(fromEnv).trim() !== '' ? Number(fromEnv) : 5187;
  const port = Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : 5187;

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            mui: ['@mui/material', '@emotion/react', '@emotion/styled'],
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true,
    },
    preview: {
      host: '0.0.0.0',
      port: 4187,
    },
  };
});
