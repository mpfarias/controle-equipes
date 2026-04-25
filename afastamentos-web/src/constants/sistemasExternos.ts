/** IDs alinhados à API (`sistemasPermitidos`). */
export const SISTEMAS_EXTERNOS_OPTIONS = [
  { id: 'SAD', label: 'Órion SAD' },
  { id: 'ORION_PATRIMONIO', label: 'Órion Patrimônio' },
  { id: 'OPERACOES', label: 'Órion Operações' },
  { id: 'ORION_QUALIDADE', label: 'Órion Qualidade' },
  { id: 'ORION_JURIDICO', label: 'Órion Jurídico' },
  { id: 'ORION_MULHER', label: 'Órion Mulher' },
  { id: 'ORION_ASSESSORIA', label: 'Órion Assessoria' },
] as const;

export type SistemaExternoId = (typeof SISTEMAS_EXTERNOS_OPTIONS)[number]['id'];
