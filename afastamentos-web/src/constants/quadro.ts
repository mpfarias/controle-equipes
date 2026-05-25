import type { QuadroGrupo, QuadroOption, PostoGraduacaoOption } from '../types';

/** Primeira graduação de oficial (ASP) na ordem do catálogo de postos. */
export const POSTO_ORDEM_INICIO_OFICIAL = 8;

export function grupoQuadroPorOrdemPosto(ordem: number): QuadroGrupo {
  return ordem >= POSTO_ORDEM_INICIO_OFICIAL ? 'OFICIAL' : 'PRACA';
}

export function quadrosParaPosto(
  quadros: QuadroOption[],
  posto: PostoGraduacaoOption | undefined,
): QuadroOption[] {
  if (!posto) return [];
  const grupo = grupoQuadroPorOrdemPosto(posto.ordem);
  return quadros.filter((q) => q.grupo === grupo);
}
