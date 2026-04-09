/** Fatia usada para calcular acesso efetivo (usuário completo ou trecho de formulário). */
export type TemAcessoOrionSuporteInput = {
  isAdmin?: boolean;
  acessoOrionSuporte?: boolean | null;
  nivel?: { acessoOrionSuporte?: boolean | null } | null;
};

/**
 * Efetivo: `false` no usuário bloqueia o nível; `true` garante;
 * `null`/omitido herda `nivel.acessoOrionSuporte`.
 */
export function temAcessoOrionSuporteEfetivo(u: TemAcessoOrionSuporteInput): boolean {
  if (u.acessoOrionSuporte === false) return false;
  if (u.acessoOrionSuporte === true) return true;
  return u.nivel?.acessoOrionSuporte === true;
}

/**
 * Valor gravado em `Usuario.acessoOrionSuporte`: `null` = só o nível decide;
 * `false` = nega mesmo com nível habilitado; `true` = garante sem depender do nível.
 */
export function acessoOrionSuporteParaApi(
  desiredCheckbox: boolean,
  nivelConcedeSuporte: boolean,
): boolean | null {
  if (!desiredCheckbox && nivelConcedeSuporte) return false;
  if (desiredCheckbox && !nivelConcedeSuporte) return true;
  return null;
}
