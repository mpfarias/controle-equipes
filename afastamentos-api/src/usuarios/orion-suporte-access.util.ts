/** Fatia mínima para calcular acesso efetivo ao Órion Suporte. */
export type OrionSuporteUserSlice = {
  isAdmin: boolean;
  acessoOrionSuporte: boolean | null;
  nivel?: { acessoOrionSuporte?: boolean | null } | null;
};

/**
 * Efetivo: somente cadastro — `false` no usuário bloqueia o nível; `true` garante;
 * `null`/omitido herda `nivel.acessoOrionSuporte`. Não libera por perfil administrador nem por `isAdmin`.
 */
export function usuarioTemAcessoOrionSuporteEfetivo(u: OrionSuporteUserSlice): boolean {
  if (u.acessoOrionSuporte === false) return false;
  if (u.acessoOrionSuporte === true) return true;
  return u.nivel?.acessoOrionSuporte === true;
}
