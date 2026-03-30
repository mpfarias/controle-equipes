/** IDs alinhados à API (`sistemasPermitidos`). */
export const SISTEMAS_EXTERNOS_OPTIONS = [
  { id: 'SAD', label: 'SAD' },
  { id: 'PATRIMONIO', label: 'Patrimônio' },
  { id: 'OPERACOES', label: 'Operações' },
] as const;

export type SistemaExternoId = (typeof SISTEMAS_EXTERNOS_OPTIONS)[number]['id'];
