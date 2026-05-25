/**
 * Libera a porta do Vite antes de `npm run dev` (evita EADDRINUSE ao reiniciar).
 * Padrão 5185 — alinhar com `server.port` em `vite.config.ts`.
 * Override: `MULHER_DEV_PORT=5185 npm run dev`
 */
const killPort = require('kill-port');

const raw = process.env.MULHER_DEV_PORT ?? process.env.VITE_ORION_MULHER_PORT;
const parsed = raw != null && String(raw).trim() !== '' ? Number(raw) : 5185;
const port = Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : 5185;

killPort(port)
  .catch(() => {
    /* porta livre ou falha benigna */
  })
  .finally(() => {
    process.exit(0);
  });
