/**
 * URL do aplicativo Órion SAD (afastamentos-web).
 * - Produção / rede: defina `VITE_ORION_SAD_URL` (ex.: http://10.95.91.53:5173).
 * - Dev local sem .env: mesmo host da página atual e porta **5173** (Vite do SAD).
 */
export function getUrlOrionSAD(): string {
  const raw = import.meta.env.VITE_ORION_SAD_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, '');
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  const portSadDev = import.meta.env.VITE_ORION_SAD_PORT?.trim() || '5173';
  return `${protocol}//${host}:${portSadDev}`;
}
