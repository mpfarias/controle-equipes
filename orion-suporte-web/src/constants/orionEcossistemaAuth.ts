/**
 * Deve ficar alinhado com `afastamentos-web/src/constants/orionEcossistemaAuth.ts`
 * (chaves e nome do parâmetro no hash).
 */

export const ORION_ECOSISTEMA_TOKEN_KEY =
  import.meta.env.VITE_ORION_AUTH_TOKEN_KEY?.trim() || 'orion-ecossistema:jwt';

export const ORION_ECOSISTEMA_ACESSO_ID_KEY =
  import.meta.env.VITE_ORION_AUTH_ACESSO_ID_KEY?.trim() || 'orion-ecossistema:acessoId';

const LEGACY_TOKEN_KEYS = ['orion-suporte-web:token'] as const;
const LEGACY_ACESSO_KEYS = ['orion-suporte-web:acessoId'] as const;

export const ORION_SSO_HASH_PARAM = 'orion_sso';

export function migrarELerTokenSession(): string | null {
  let v = sessionStorage.getItem(ORION_ECOSISTEMA_TOKEN_KEY);
  if (v) {
    return v;
  }
  for (const k of LEGACY_TOKEN_KEYS) {
    v = sessionStorage.getItem(k);
    if (v) {
      sessionStorage.setItem(ORION_ECOSISTEMA_TOKEN_KEY, v);
      sessionStorage.removeItem(k);
      return v;
    }
  }
  return null;
}

export function gravarTokenSession(token: string): void {
  sessionStorage.setItem(ORION_ECOSISTEMA_TOKEN_KEY, token);
  for (const k of LEGACY_TOKEN_KEYS) {
    sessionStorage.removeItem(k);
  }
}

export function removerTokenSession(): void {
  sessionStorage.removeItem(ORION_ECOSISTEMA_TOKEN_KEY);
  for (const k of LEGACY_TOKEN_KEYS) {
    sessionStorage.removeItem(k);
  }
}

export function migrarELerAcessoIdSession(): number | null {
  const raw =
    sessionStorage.getItem(ORION_ECOSISTEMA_ACESSO_ID_KEY) ??
    LEGACY_ACESSO_KEYS.map((k) => sessionStorage.getItem(k)).find(Boolean) ??
    null;
  if (!raw) {
    return null;
  }
  if (!sessionStorage.getItem(ORION_ECOSISTEMA_ACESSO_ID_KEY)) {
    sessionStorage.setItem(ORION_ECOSISTEMA_ACESSO_ID_KEY, raw);
    for (const k of LEGACY_ACESSO_KEYS) {
      sessionStorage.removeItem(k);
    }
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function gravarAcessoIdSession(acessoId: number): void {
  sessionStorage.setItem(ORION_ECOSISTEMA_ACESSO_ID_KEY, acessoId.toString());
  for (const k of LEGACY_ACESSO_KEYS) {
    sessionStorage.removeItem(k);
  }
}

export function removerAcessoIdSession(): void {
  sessionStorage.removeItem(ORION_ECOSISTEMA_ACESSO_ID_KEY);
  for (const k of LEGACY_ACESSO_KEYS) {
    sessionStorage.removeItem(k);
  }
}
