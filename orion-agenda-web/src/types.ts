export interface Usuario {
  id: number;
  nome: string;
  matricula: string;
  equipe?: string;
  isAdmin?: boolean;
  nivelId?: number | null;
  nivel?: {
    id: number;
    nome: string;
    descricao?: string | null;
    ativo?: boolean;
    acessoOrionSuporte?: boolean | null;
  };
  fotoUrl?: string | null;
  acessoOrionSuporte?: boolean | null;
  sistemasPermitidos?: string[];
}

export interface LoginInput {
  matricula: string;
  senha: string;
}

export type OrionAgendaPublicInfo = {
  sistema: string;
  nome: string;
  versao: string;
  fase: string;
};

export type OrionAgendaSessao = {
  ok: boolean;
  sistema: string;
  podeAcessarModulo: boolean;
  usuario: { id: number; nome: string; matricula: string };
  mensagem: string;
};

export type OrionAgendaTipo = 'REUNIAO' | 'PALESTRA' | 'PRAZO' | 'AUDIENCIA' | 'OUTRO';
export type OrionAgendaStatus = 'AGENDADO' | 'CONCLUIDO' | 'CANCELADO';

export type OrionAgendaParticipante = {
  id: number;
  compromissoId: number;
  policialId: number;
  policialNome: string;
  ordem: number;
};

export type OrionAgendaCompromisso = {
  id: number;
  titulo: string;
  descricao: string | null;
  dataInicio: string;
  dataFim: string | null;
  diaInteiro: boolean;
  local: string | null;
  tipo: OrionAgendaTipo;
  status: OrionAgendaStatus;
  policialId: number | null;
  responsavelNome: string | null;
  participantes?: OrionAgendaParticipante[];
  criadoPorId: number;
  criadoPorNome: string;
  atualizadoPorId: number | null;
  atualizadoPorNome: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrionAgendaCompromissoInput = {
  titulo?: string;
  descricao?: string;
  dataInicio: string;
  dataFim?: string | null;
  diaInteiro?: boolean;
  local?: string;
  tipo?: OrionAgendaTipo;
  status?: OrionAgendaStatus;
  policialId?: number;
  policialIds?: number[];
};

export type AgendaPolicialEfetivo = {
  id: number;
  nome: string;
  matricula: string;
  equipe: string | null;
};
