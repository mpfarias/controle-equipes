/**
 * URL do Órion Mulher (handoff a partir do Qualidade).
 * - Produção: `VITE_ORION_MULHER_URL`.
 * - Dev: porta padrão **5185** quando o front existir.
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
