/**
 * Libera a porta do Vite antes de `npm run dev` (evita EADDRINUSE ao reiniciar).
 * Padrão 5173 — deve coincidir com `server.port` em `vite.config.ts`.
 * Override explícito (evita colidir com PORT=3002 da API): `SAD_DEV_PORT=5174 npm run dev`.
 */
const killPort = require('kill-port');

const raw = process.env.SAD_DEV_PORT;
const parsed = raw != null && String(raw).trim() !== '' ? Number(raw) : 5173;
const port = Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : 5173;

killPort(port)
  .catch(() => {
    /* porta livre ou falha benigna — não bloquear o dev */
  })
  .finally(() => {
    process.exit(0);
  });
