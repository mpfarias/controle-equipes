import type { OrionAgendaCompromisso, OrionAgendaTipo } from '../types';

export const TIPO_LABEL: Record<OrionAgendaTipo, string> = {
  REUNIAO: 'Reunião',
  PALESTRA: 'Palestra',
  PRAZO: 'Prazo',
  AUDIENCIA: 'Audiência',
  OUTRO: 'Outro',
};

export const TIPOS_AGENDA: OrionAgendaTipo[] = [
  'REUNIAO',
  'PALESTRA',
  'PRAZO',
  'AUDIENCIA',
  'OUTRO',
];

export function policiaisIdsDoCompromisso(c: OrionAgendaCompromisso): number[] {
  if (c.participantes?.length) {
    return c.participantes.map((p) => p.policialId).sort((a, b) => a - b);
  }
  if (c.policialId != null) return [c.policialId];
  return [];
}

export function nomesParticipantesCompromisso(c: OrionAgendaCompromisso): string[] {
  if (c.participantes?.length) {
    return c.participantes.map((p) => p.policialNome);
  }
  if (c.responsavelNome) return [c.responsavelNome];
  return [];
}

export type CompromissoDuplicadoInput = {
  tipo: OrionAgendaTipo;
  dataInicio: string;
  policialIds: number[];
};

export function ehCompromissoDuplicado(
  existente: OrionAgendaCompromisso,
  novo: CompromissoDuplicadoInput,
  excluirId?: number,
): boolean {
  if (excluirId != null && existente.id === excluirId) return false;
  if (existente.status === 'CANCELADO') return false;
  if (existente.tipo !== novo.tipo) return false;
  if (new Date(existente.dataInicio).getTime() !== new Date(novo.dataInicio).getTime()) {
    return false;
  }
  const idsA = policiaisIdsDoCompromisso(existente);
  const idsB = [...novo.policialIds].sort((a, b) => a - b);
  if (idsA.length !== idsB.length) return false;
  return idsA.every((id, i) => id === idsB[i]);
}

export function mensagemCompromissoDuplicado(): string {
  return 'Já existe um compromisso igual neste dia e horário com as mesmas pessoas.';
}
