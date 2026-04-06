import { ORION_SSO_HASH_PARAM, gravarTokenSession } from '../constants/orionEcossistemaAuth';

/**
 * Lê `#orion_sso=<jwt>` gravado pelo SAD ao redirecionar, persiste o token e remove o hash da URL.
 * O fragmento não é enviado ao servidor ao carregar a página.
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
