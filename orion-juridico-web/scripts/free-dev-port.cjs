/**
 * Libera a porta do Vite antes de `npm run dev` (evita EADDRINUSE ao reiniciar).
 * Padrão 6183 — alinhar com `vite.config.ts` e `.env.development`.
 */
const killPort = require('kill-port');

const raw = process.env.JURIDICO_DEV_PORT ?? process.env.VITE_ORION_JURIDICO_PORT;
const parsed = raw != null && String(raw).trim() !== '' ? Number(raw) : 6183;
const port = Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : 6183;

killPort(port)
  .catch(() => {
    /* porta livre ou falha benigna */
  })
  .finally(() => {
    process.exit(0);
  });
