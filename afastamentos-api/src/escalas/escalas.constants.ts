export const ESCALA_CHAVE = {
  DATA_INICIO_EQUIPES: 'data_inicio_equipes',
  DATA_INICIO_MOTORISTAS: 'data_inicio_motoristas',
  SEQUENCIA_EQUIPES: 'sequencia_equipes',
  SEQUENCIA_MOTORISTAS: 'sequencia_motoristas',
} as const;

export const ESCALA_DEFAULTS: Record<string, string> = {
  [ESCALA_CHAVE.DATA_INICIO_EQUIPES]: '2026-01-20',
  [ESCALA_CHAVE.DATA_INICIO_MOTORISTAS]: '2026-01-01',
  [ESCALA_CHAVE.SEQUENCIA_EQUIPES]: 'D,E,B,A,C',
  [ESCALA_CHAVE.SEQUENCIA_MOTORISTAS]: 'A,B,C,D',
};
