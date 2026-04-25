/**
 * URL do aplicativo Órion Assessoria (handoff / links entre SPAs).
 * - Produção: `VITE_ORION_ASSESSORIA_URL`.
 * - Dev: host atual + porta **5186** quando a URL não está definida.
 */
export function getUrlOrionAssessoria(): string {
  const raw = import.meta.env.VITE_ORION_ASSESSORIA_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, '');
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  const port = import.meta.env.VITE_ORION_ASSESSORIA_PORT?.trim() || '5186';
  return `${protocol}//${host}:${port}`;
}
