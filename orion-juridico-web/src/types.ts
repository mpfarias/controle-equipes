export interface Usuario {
  id: number;
  nome: string;
  matricula: string;
  equipe?: string;
  isAdmin?: boolean;
  nivelId?: number | null;
  nivel?: { id: number; nome: string; descricao?: string | null; ativo?: boolean };
  fotoUrl?: string | null;
}

export interface LoginInput {
  matricula: string;
  senha: string;
}

export type OrionJuridicoPublicInfo = {
  sistema: string;
  nome: string;
  versao: string;
  fase: string;
};

export type OrionJuridicoSessao = {
  ok: boolean;
  sistema: string;
  usuario: { id: number; nome: string; matricula: string };
  mensagem: string;
};
