/**
 * URL do aplicativo Órion Agenda.
 * - Produção: `VITE_ORION_AGENDA_URL`.
 * - Dev sem .env: mesmo host da página, porta **5186**.
 */
export function getUrlOrionAgenda(): string {
  const raw = import.meta.env.VITE_ORION_AGENDA_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, '');
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  const port = import.meta.env.VITE_ORION_AGENDA_PORT?.trim() || '5186';
  return `${protocol}//${host}:${port}`;
}
