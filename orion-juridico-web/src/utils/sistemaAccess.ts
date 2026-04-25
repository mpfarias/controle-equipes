import type { Usuario } from '../types';

const SISTEMA_ID_SAD = 'SAD';

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

export function usuarioPodeAcessarOrionJuridico(usuario: Usuario | null): boolean {
  if (!usuario) return false;
  return (usuario.sistemasPermitidos ?? []).some((s) => String(s).trim().toUpperCase() === 'ORION_JURIDICO');
}
