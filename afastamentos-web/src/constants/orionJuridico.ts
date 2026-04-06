/**
 * URL do aplicativo Órion Jurídico.
 * - Produção / rede: `VITE_ORION_JURIDICO_URL`.
 * - Dev sem .env: mesmo host da página, porta **5183** (Vite do `orion-juridico-web`).
 */
export function getUrlOrionJuridico(): string {
  const raw = import.meta.env.VITE_ORION_JURIDICO_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, '');
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  const port = import.meta.env.VITE_ORION_JURIDICO_PORT?.trim() || '5183';
  return `${protocol}//${host}:${port}`;
}
