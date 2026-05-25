import type { QuadroGrupo } from '@prisma/client';

/** Última graduação de praça (ST) na ordem do catálogo de postos. */
export const POSTO_ORDEM_LIMITE_PRACA = 7;

/** Primeira graduação de oficial (ASP) na ordem do catálogo de postos. */
export const POSTO_ORDEM_INICIO_OFICIAL = 8;

export function grupoQuadroPorOrdemPosto(ordem: number): QuadroGrupo {
  return ordem >= POSTO_ORDEM_INICIO_OFICIAL ? 'OFICIAL' : 'PRACA';
}
