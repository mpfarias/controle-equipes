/**
 * Libera a porta da API antes de `nest start --watch` (evita EADDRINUSE ao reiniciar).
 * Respeita PORT no ambiente; padrão 3002 (ver `src/main.ts`).
 * Pequena pausa após matar o processo ajuda o Windows a liberar o socket.
 */
const killPort = require('kill-port');

const raw = process.env.PORT;
const port = Number(raw != null && String(raw).trim() !== '' ? raw : 3002);

if (!Number.isFinite(port) || port < 1 || port > 65535) {
  console.warn(`[free-api-port] PORT inválido (${String(raw)}), usando 3002.`);
}

const p = Number.isFinite(port) && port >= 1 && port <= 65535 ? port : 3002;

(async () => {
  try {
    await killPort(p);
  } catch {
    /* porta livre ou falha benigna */
  }
  await new Promise((r) => setTimeout(r, 300));
  process.exit(0);
})();
