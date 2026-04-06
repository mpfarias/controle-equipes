import type { Usuario } from '../types';

const SISTEMA_ID_SAD = 'SAD';

/** Mesma regra do SAD (`sistemasPermitidosDoUsuario`): lista vazia implica acesso ao SAD. */
export function sistemasPermitidosDoUsuario(usuario: Usuario | null): string[] {
  if (!usuario) return [];
  const raw = usuario.sistemasPermitidos;
  if (Array.isArray(raw) && raw.length > 0) {
    return [...new Set(raw)];
  }
  return [SISTEMA_ID_SAD];
}

/** Exibe atalho para o Órion SAD no menu (espelho de `acessoOrionSuporte` no app SAD). */
export function usuarioPodeAcessarOrionSAD(usuario: Usuario | null): boolean {
  if (!usuario) return false;
  if (usuario.isAdmin === true) return true;
  return sistemasPermitidosDoUsuario(usuario).includes(SISTEMA_ID_SAD);
}
