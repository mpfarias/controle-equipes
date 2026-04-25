/**
 * URL do aplicativo Órion Operações.
 * - Produção / rede: `VITE_ORION_OPERACOES_URL`.
 * - Dev sem .env: mesmo host da página, porta **5187**.
 */
export function getUrlOrionOperacoes(): string {
  const raw = import.meta.env.VITE_ORION_OPERACOES_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, '');
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  const port = import.meta.env.VITE_ORION_OPERACOES_PORT?.trim() || '5187';
  return `${protocol}//${host}:${port}`;
}
