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
  /** Override do acesso ao Órion Suporte (null = herda do nível). */
  acessoOrionSuporte?: boolean | null;
  fotoUrl?: string | null;
  sistemasPermitidos?: string[];
}

export interface LoginInput {
  matricula: string;
  senha: string;
}

/** Resposta de POST /orion-qualidade/v1/policiais/equipes-por-nome */
export type EquipeAtendenteSadItem = {
  nome: string;
  equipe: string | null;
  encontrado: boolean;
  nomeCadastro: string | null;
};

export type QualidadeRegistroStatus = 'ABERTO' | 'EM_TRATAMENTO' | 'ENCERRADO';

export type QualidadeRegistro = {
  id: number;
  titulo: string;
  descricao: string | null;
  status: QualidadeRegistroStatus;
  criadoPorId: number;
  criadoPorNome: string;
  atualizadoPorId: number | null;
  atualizadoPorNome: string | null;
  createdAt: string;
  updatedAt: string;
};
