import type { PermissaoAcao } from '../types';
import type { TabKey } from '../constants';

export type PermissoesPorTela = Record<
  TabKey,
  Partial<Record<PermissaoAcao, boolean>>
>;

const TODAS_ACOES: PermissaoAcao[] = ['VISUALIZAR', 'EDITAR', 'DESATIVAR', 'EXCLUIR'];

/** Aba principal Escalas: legado `escalas` ou qualquer subárea. */
export function temAcessoEscalas(permissoes: PermissoesPorTela | null | undefined): boolean {
  if (!permissoes) return false;
  return Boolean(
    permissoes['escalas']?.VISUALIZAR ||
      permissoes['escalas-gerar']?.VISUALIZAR ||
      permissoes['escalas-consultar']?.VISUALIZAR,
  );
}

/**
 * Permissões antigas usavam só `escalas`. Após carregar o mapa do backend, copia cada ação liberada
 * para `escalas-gerar` e `escalas-consultar`.
 */
export function expandirPermissoesLegadoEscalas(
  base: Record<TabKey, Record<PermissaoAcao, boolean>>,
): void {
  const legado = base['escalas'];
  if (!legado) return;
  const gran: TabKey[] = ['escalas-gerar', 'escalas-consultar'];
  for (const acao of TODAS_ACOES) {
    if (!legado[acao]) continue;
    for (const k of gran) {
      if (base[k]) base[k][acao] = true;
    }
  }
}

/**
 * A gestão de níveis usa `escalas-gerar` e `escalas-consultar`; a aba principal no menu é `escalas`.
 * Propaga qualquer ação liberada nas sub-telas para a chave legada usada pelo menu e pelo roteamento.
 */
export function propagarPermissoesEscalasSubtelasParaAbaPrincipal(
  base: Record<TabKey, Record<PermissaoAcao, boolean>>,
): void {
  const alvo = base['escalas'];
  if (!alvo) return;
  const gran: TabKey[] = ['escalas-gerar', 'escalas-consultar'];
  for (const acao of TODAS_ACOES) {
    if (gran.some((k) => base[k]?.[acao])) {
      alvo[acao] = true;
    }
  }
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

/** Compatível com regras antigas por nome de nível (além de isAdmin e permissão explícita). */
export function podeGerenciarTrocaServicoElevado(
  permissoes: PermissoesPorTela | null | undefined,
  usuario: { isAdmin?: boolean; nivel?: { nome?: string | null } | null },
): boolean {
  if (usuario.isAdmin === true) return true;
  const n = usuario.nivel?.nome?.toUpperCase() ?? '';
  if (n === 'ADMINISTRADOR' || n === 'SAD' || n === 'COMANDO') return true;
  // Compatibilidade: antes a troca era controlada por permissões do Efetivo.
  return canEdit(permissoes, 'troca-servico') || canEdit(permissoes, 'equipe');
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
