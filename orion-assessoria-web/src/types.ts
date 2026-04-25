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

export type OrionAssessoriaPublicInfo = {
  sistema: string;
  nome: string;
  versao: string;
  fase: string;
};

export type OrionAssessoriaSessao = {
  ok: boolean;
  sistema: string;
  usuario: { id: number; nome: string; matricula: string };
  mensagem: string;
};
