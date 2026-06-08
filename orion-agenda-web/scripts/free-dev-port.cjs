/**
 * Libera a porta do Vite antes de `npm run dev` (evita EADDRINUSE ao reiniciar ou ao subir duas vezes).
 * Padrão 6186 — alinhar com `vite.config.ts` e `.env.development`.
 * Override: `AGENDA_DEV_PORT=6188 npm run dev`
 */
const killPort = require('kill-port');

const raw = process.env.AGENDA_DEV_PORT ?? process.env.VITE_ORION_AGENDA_PORT;
const parsed = raw != null && String(raw).trim() !== '' ? Number(raw) : 6186;
const port = Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : 6186;

killPort(port)
  .catch(() => {
    /* porta livre ou falha benigna */
  })
  .finally(() => {
    process.exit(0);
  });
