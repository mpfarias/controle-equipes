/**
 * Libera a porta do Vite antes de `npm run dev` (evita EADDRINUSE ao reiniciar).
 * Padrão 6185 — alinhar com `server.port` em `vite.config.ts` e `.env.development`.
 * Override: `MULHER_DEV_PORT=6185 npm run dev`
 */
const killPort = require('kill-port');

const raw = process.env.MULHER_DEV_PORT ?? process.env.VITE_ORION_MULHER_PORT;
const parsed = raw != null && String(raw).trim() !== '' ? Number(raw) : 6185;
const port = Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : 6185;

killPort(port)
  .catch(() => {
    /* porta livre ou falha benigna */
  })
  .finally(() => {
    process.exit(0);
  });
