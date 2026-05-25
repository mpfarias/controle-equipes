import type { Usuario } from '../types';

const SISTEMA_ID_SAD = 'SAD';
const SISTEMA_ID_MULHER = 'ORION_MULHER';

export function sistemasPermitidosDoUsuario(usuario: Usuario | null): string[] {
  if (!usuario) return [];
  const raw = usuario.sistemasPermitidos;
  if (Array.isArray(raw) && raw.length > 0) {
    return [...new Set(raw)];
  }
  return [SISTEMA_ID_SAD];
}

export function usuarioPodeAcessarOrionSAD(usuario: Usuario | null): boolean {
  if (!usuario) return false;
  if (usuario.isAdmin === true) return true;
  return sistemasPermitidosDoUsuario(usuario).includes(SISTEMA_ID_SAD);
}

/** Alinhado à API (`OrionMulherService.podeAcessarOrionMulher`). */
export function usuarioPodeAcessarOrionMulher(usuario: Usuario | null): boolean {
  if (!usuario) return false;
  if (usuario.isAdmin === true) return true;
  const nomeNivel = usuario.nivel?.nome?.trim().toUpperCase();
  if (nomeNivel === 'ADMINISTRADOR') return true;
  return (usuario.sistemasPermitidos ?? []).some(
    (s) => String(s).trim().toUpperCase() === SISTEMA_ID_MULHER,
  );
}
