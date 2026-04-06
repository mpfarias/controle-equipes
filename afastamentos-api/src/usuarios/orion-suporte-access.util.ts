/** Fatia mínima para calcular acesso efetivo ao Órion Suporte. */
export type OrionSuporteUserSlice = {
  isAdmin: boolean;
  acessoOrionSuporte: boolean | null;
  nivel?: { acessoOrionSuporte?: boolean | null } | null;
};

/**
 * Efetivo: admin sempre; `false` no usuário bloqueia o nível; `true` garante;
 * `null`/omitido herda `nivel.acessoOrionSuporte`.
 */
export function usuarioTemAcessoOrionSuporteEfetivo(u: OrionSuporteUserSlice): boolean {
  if (u.isAdmin) return true;
  if (u.acessoOrionSuporte === false) return false;
  if (u.acessoOrionSuporte === true) return true;
  return u.nivel?.acessoOrionSuporte === true;
}
