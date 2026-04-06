/** IDs alinhados à API (`sistemasPermitidos`). */
export const SISTEMAS_EXTERNOS_OPTIONS = [
  { id: 'SAD', label: 'Órion SAD' },
  { id: 'PATRIMONIO', label: 'Órion Patrimônio' },
  { id: 'OPERACOES', label: 'Órion Operações' },
  { id: 'ORION_QUALIDADE', label: 'Órion Qualidade' },
  { id: 'ORION_JURIDICO', label: 'Órion Jurídico' },
] as const;

export type SistemaExternoId = (typeof SISTEMAS_EXTERNOS_OPTIONS)[number]['id'];
