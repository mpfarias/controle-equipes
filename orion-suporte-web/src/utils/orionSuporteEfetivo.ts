import type { Usuario } from '../types';

/**
 * Efetivo: admin sempre; `false` no usuário bloqueia o nível; `true` garante;
 * `null`/omitido herda `nivel.acessoOrionSuporte`.
 */
export function temAcessoOrionSuporteEfetivo(
  u: Pick<Usuario, 'isAdmin' | 'acessoOrionSuporte' | 'nivel'>,
): boolean {
  if (u.isAdmin === true) return true;
  if (u.acessoOrionSuporte === false) return false;
  if (u.acessoOrionSuporte === true) return true;
  return u.nivel?.acessoOrionSuporte === true;
}
