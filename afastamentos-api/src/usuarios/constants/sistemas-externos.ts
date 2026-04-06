/** Identificadores dos sistemas integrados (permissão por usuário). */
export const SISTEMAS_EXTERNOS_IDS = [
  'SAD',
  'PATRIMONIO',
  'OPERACOES',
  'ORION_QUALIDADE',
  'ORION_JURIDICO',
] as const;

export type SistemaExternoId = (typeof SISTEMAS_EXTERNOS_IDS)[number];

export function isSistemaExternoId(value: string): value is SistemaExternoId {
  return (SISTEMAS_EXTERNOS_IDS as readonly string[]).includes(value);
}
