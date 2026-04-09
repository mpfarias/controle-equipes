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
  acessoOrionSuporte?: boolean | null;
  fotoUrl?: string | null;
  sistemasPermitidos?: string[];
}

export interface LoginInput {
  matricula: string;
  senha: string;
}

export type PatrimonioBemSituacao =
  | 'EM_USO'
  | 'GUARDADO'
  | 'MANUTENCAO'
  | 'EMPRESTADO'
  | 'BAIXADO';

export type PatrimonioBem = {
  id: number;
  tombamento: string;
  descricao: string;
  categoria: string | null;
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  localizacaoSetor: string | null;
  situacao: PatrimonioBemSituacao;
  observacoes: string | null;
  dataAquisicao: string | null;
  valorAquisicao: string | null;
  criadoPorId: number;
  criadoPorNome: string;
  atualizadoPorId: number | null;
  atualizadoPorNome: string | null;
  createdAt: string;
  updatedAt: string;
};
