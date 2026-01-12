export type AfastamentoStatus = 'ATIVO' | 'ENCERRADO';

export type PolicialStatus =
  | 'ATIVO'
  | 'DESIGNADO'
  | 'COMISSIONADO'
  | 'PTTC'
  | 'DESATIVADO';

export type UsuarioStatus = 'ATIVO' | 'DESATIVADO';

export type Equipe = 'A' | 'B' | 'C' | 'D' | 'E';

export interface UsuarioNivel {
  id: number;
  nome: string;
  descricao?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Usuario {
  id: number;
  nome: string;
  matricula: string;
  perguntaSeguranca?: string | null;
  equipe: Equipe;
  status: UsuarioStatus;
  isAdmin?: boolean;
  nivelId?: number | null;
  nivel?: { id: number; nome: string; descricao?: string | null };
  funcaoId?: number | null;
  funcao?: { id: number; nome: string; descricao?: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface CreateUsuarioInput {
  nome: string;
  matricula: string;
  senha: string;
  perguntaSeguranca?: string;
  respostaSeguranca?: string;
  equipe: Equipe;
  nivelId: number;
  funcaoId?: number;
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
  motivoId: number;
  motivo: { id: number; nome: string; descricao?: string | null };
  descricao?: string | null;
  dataInicio: string;
  dataFim?: string | null;
  status: AfastamentoStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAfastamentoInput {
  colaboradorId: number;
  motivoId: number;
  descricao?: string;
  dataInicio: string;
  dataFim?: string;
}

export interface MotivoAfastamentoOption {
  id: number;
  nome: string;
  descricao?: string | null;
}

export interface UsuarioNivelOption {
  id: number;
  nome: string;
  descricao?: string | null;
}

export interface FuncaoOption {
  id: number;
  nome: string;
  descricao?: string | null;
}
