/**
 * Host onde o Next escuta.
 *
 * Windows: predefinição `::` (IPv6 dual-stack) — funciona com http://localhost e http://127.0.0.1.
 * Linux/servidor: predefinição `0.0.0.0` (todas as interfaces IPv4).
 *
 * Sobrescreva com HOST no .env (ex.: HOST=127.0.0.1 só local; Docker em Linux pode usar 0.0.0.0).
 */
function listenHost() {
  const h = process.env.HOST;
  if (typeof h === "string" && h.trim()) {
    const t = h.trim();
    /** No Windows nativo, 0.0.0.0 só IPv4 quebra `localhost` (::1); `::` aceita os dois. */
    if (process.platform === "win32" && t === "0.0.0.0") return "::";
    return t;
  }
  return process.platform === "win32" ? "::" : "0.0.0.0";
}

module.exports = { listenHost };
