import { ORION_SSO_HASH_PARAM, gravarTokenSession } from '../constants/orionEcossistemaAuth';

/**
 * Lê `#orion_sso=<jwt>` (handoff a partir do Órion Suporte ou outro app), persiste o token e remove o hash da URL.
 */
export function consumirOrionSsoDoHashDaUrl(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) {
    return false;
  }
  let token: string | null = null;
  try {
    token = new URLSearchParams(raw).get(ORION_SSO_HASH_PARAM);
  } catch {
    return false;
  }
  if (!token?.trim()) {
    return false;
  }
  gravarTokenSession(token.trim());
  const clean = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', clean);
  return true;
}
