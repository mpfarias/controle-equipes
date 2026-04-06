/**
 * URL do aplicativo Órion Suporte.
 * - Produção / rede: defina `VITE_ORION_SUPORTE_URL` (ex.: http://10.95.91.53:5180 ou https://suporte.exemplo.gov.br).
 * - Dev local sem .env: usa o mesmo host da página atual e a porta **5180** (vite do Suporte; não use 5174 — o SAD pode ocupá-la).
 */
export function getUrlOrionSuporte(): string {
  const raw = import.meta.env.VITE_ORION_SUPORTE_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, '');
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  const portSuporteDev = import.meta.env.VITE_ORION_SUPORTE_PORT?.trim() || '5180';
  return `${protocol}//${host}:${portSuporteDev}`;
}
