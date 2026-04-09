/**
 * URL do aplicativo Órion Suporte (handoff JWT).
 * - Produção: `VITE_ORION_SUPORTE_URL`.
 * - Dev sem .env: mesmo host, porta **5180** (padrão do Vite do Suporte).
 */
export function getUrlOrionSuporte(): string {
  const raw = import.meta.env.VITE_ORION_SUPORTE_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, '');
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  const port = import.meta.env.VITE_ORION_SUPORTE_PORT?.trim() || '5180';
  return `${protocol}//${host}:${port}`;
}
