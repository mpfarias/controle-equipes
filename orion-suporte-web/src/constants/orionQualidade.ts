/**
 * URL do aplicativo Órion Qualidade (handoff JWT).
 * - Produção: `VITE_ORION_QUALIDADE_URL`.
 * - Dev sem .env: mesmo host, porta **5182**.
 */
export function getUrlOrionQualidade(): string {
  const raw = import.meta.env.VITE_ORION_QUALIDADE_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, '');
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  const port = import.meta.env.VITE_ORION_QUALIDADE_PORT?.trim() || '5182';
  return `${protocol}//${host}:${port}`;
}
