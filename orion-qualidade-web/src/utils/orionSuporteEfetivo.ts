/** Mesma regra do SAD / afastamentos-web para exibir o link do Órion Suporte. */
export type TemAcessoOrionSuporteInput = {
  isAdmin?: boolean;
  acessoOrionSuporte?: boolean | null;
  nivel?: { acessoOrionSuporte?: boolean | null } | null;
};

export function temAcessoOrionSuporteEfetivo(u: TemAcessoOrionSuporteInput): boolean {
  if (u.acessoOrionSuporte === false) return false;
  if (u.acessoOrionSuporte === true) return true;
  return u.nivel?.acessoOrionSuporte === true;
}
