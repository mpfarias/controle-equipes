/**
 * Libera a porta do Vite antes de `npm run dev` (evita EADDRINUSE ao reiniciar ou ao subir duas vezes).
 * Padrão 5186 — alinhar com `server.port` em `vite.config.ts` e com `VITE_ORION_ASSESSORIA_PORT`.
 * Override: `ASSESSORIA_DEV_PORT=5187 npm run dev`
 */
const killPort = require('kill-port');

const raw = process.env.ASSESSORIA_DEV_PORT ?? process.env.VITE_ORION_ASSESSORIA_PORT;
const parsed = raw != null && String(raw).trim() !== '' ? Number(raw) : 5186;
const port = Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : 5186;

killPort(port)
  .catch(() => {
    /* porta livre ou falha benigna */
  })
  .finally(() => {
    process.exit(0);
  });
