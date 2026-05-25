/** Valores permitidos — manter alinhado ao enum `OrionAgendaTipo` no schema Prisma. */
export const ORION_AGENDA_TIPOS = [
  'REUNIAO',
  'PALESTRA',
  'PRAZO',
  'AUDIENCIA',
  'OUTRO',
] as const;

export type OrionAgendaTipoValor = (typeof ORION_AGENDA_TIPOS)[number];

export const ORION_AGENDA_STATUS = ['AGENDADO', 'CONCLUIDO', 'CANCELADO'] as const;

export type OrionAgendaStatusValor = (typeof ORION_AGENDA_STATUS)[number];
