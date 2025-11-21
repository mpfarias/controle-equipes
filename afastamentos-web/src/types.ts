export type AfastamentoStatus = 'ATIVO' | 'ENCERRADO';

export type PolicialStatus =
  | 'ATIVO'
  | 'DESIGNADO'
  | 'COMISSIONADO'
  | 'PTTC'
  | 'DESATIVADO';

export type UsuarioStatus = 'ATIVO' | 'DESATIVADO';

export type Equipe = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Usuario {
  id: number;
  nome: string;
  matricula: string;
  equipe: Equipe;
  status: UsuarioStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUsuarioInput {
  nome: string;
  matricula: string;
  senhaHash: string;
  equipe: Equipe;
}

export interface LoginInput {
  matricula: string;
  senha: string;
}

export interface Colaborador {
  id: number;
  nome: string;
  matricula: string;
  equipe: Equipe;
  status: PolicialStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateColaboradorInput {
  nome: string;
  matricula: string;
  status: PolicialStatus;
  equipe?: Equipe;
}

export interface Afastamento {
  id: number;
  colaboradorId: number;
  colaborador: Colaborador;
  motivo: string;
  descricao?: string | null;
  dataInicio: string;
  dataFim?: string | null;
  status: AfastamentoStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAfastamentoInput {
  colaboradorId: number;
  motivo: string;
  descricao?: string;
  dataInicio: string;
  dataFim?: string;
}
