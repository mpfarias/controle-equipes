import { ORION_SSO_HASH_PARAM, gravarTokenSession } from '../constants/orionEcossistemaAuth';

/**
 * Lê `#orion_sso=<jwt>` (handoff a partir do Órion SAD), persiste o token e remove o hash.
 */
export function consumirOrionSsoDoHashDaUrl(): boolean {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  const token = params.get(ORION_SSO_HASH_PARAM);
  if (!token?.trim()) return false;
  gravarTokenSession(token.trim());
  const rest = new URLSearchParams(params);
  rest.delete(ORION_SSO_HASH_PARAM);
  const next = rest.toString();
  window.history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search + (next ? `#${next}` : ''),
  );
  return true;
}
