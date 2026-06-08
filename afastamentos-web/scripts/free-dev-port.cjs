/**
 * Libera a porta do Vite antes de `npm run dev` (evita EADDRINUSE ao reiniciar).
 * Padrão 6173 — deve coincidir com `server.port` em `vite.config.ts` e `.env.development`.
 * Override explícito: `SAD_DEV_PORT=6174 npm run dev`.
 */
const killPort = require('kill-port');

const raw = process.env.SAD_DEV_PORT;
const parsed = raw != null && String(raw).trim() !== '' ? Number(raw) : 6173;
const port = Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : 6173;

killPort(port)
  .catch(() => {
    /* porta livre ou falha benigna — não bloquear o dev */
  })
  .finally(() => {
    process.exit(0);
  });
