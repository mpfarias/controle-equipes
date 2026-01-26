import type { PermissaoAcao } from '../types';
import type { TabKey } from '../constants';

export interface PermissoesPorTela {
  [key: TabKey]: {
    [key in PermissaoAcao]: boolean;
  };
}

/**
 * Verifica se o usuário tem uma permissão específica para uma tela
 */
export function hasPermission(
  permissoes: PermissoesPorTela | null | undefined,
  tela: TabKey,
  acao: PermissaoAcao,
): boolean {
  if (!permissoes) {
    return false;
  }
  return permissoes[tela]?.[acao] ?? false;
}

/**
 * Verifica se o usuário pode visualizar uma tela
 */
export function canView(permissoes: PermissoesPorTela | null | undefined, tela: TabKey): boolean {
  return hasPermission(permissoes, tela, 'VISUALIZAR');
}

/**
 * Verifica se o usuário pode editar em uma tela
 */
export function canEdit(permissoes: PermissoesPorTela | null | undefined, tela: TabKey): boolean {
  return hasPermission(permissoes, tela, 'EDITAR');
}

/**
 * Verifica se o usuário pode desativar em uma tela
 */
export function canDesativar(permissoes: PermissoesPorTela | null | undefined, tela: TabKey): boolean {
  return hasPermission(permissoes, tela, 'DESATIVAR');
}

/**
 * Verifica se o usuário pode excluir em uma tela
 */
export function canExcluir(permissoes: PermissoesPorTela | null | undefined, tela: TabKey): boolean {
  return hasPermission(permissoes, tela, 'EXCLUIR');
}
