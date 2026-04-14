/**
 * URL do aplicativo Órion Mulher (violência doméstica — relatórios, documentos).
 * - Produção / rede: `VITE_ORION_MULHER_URL`.
 * - Dev sem .env: mesmo host da página, porta **5185** (quando o front existir).
 */
export function getUrlOrionMulher(): string {
  const raw = import.meta.env.VITE_ORION_MULHER_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, '');
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  const port = import.meta.env.VITE_ORION_MULHER_PORT?.trim() || '5185';
  return `${protocol}//${host}:${port}`;
}
