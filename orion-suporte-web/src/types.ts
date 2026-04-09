export type Equipe = string;

export interface Usuario {
  id: number;
  nome: string;
  matricula: string;
  equipe: Equipe;
  isAdmin?: boolean;
  nivelId?: number | null;
  nivel?: {
    id: number;
    nome: string;
    descricao?: string | null;
    ativo?: boolean;
    acessoOrionSuporte?: boolean;
  };
  fotoUrl?: string | null;
  /** null = herdar nível; true = garantir; false = bloquear mesmo com nível habilitado. */
  acessoOrionSuporte?: boolean | null;
  /** IDs alinhados à API (ex.: SAD, ORION_PATRIMONIO, OPERACOES). */
  sistemasPermitidos?: string[];
}

export interface LoginInput {
  matricula: string;
  senha: string;
}

export type ErrorReportStatus =
  | 'ABERTO'
  | 'EM_ANALISE'
  | 'RESOLVIDO'
  | 'FECHADO'
  | 'CANCELADO';

export type ErrorReportCategoria = 'ERRO_SISTEMA' | 'DUVIDA' | 'MELHORIA' | 'OUTRO';

export type ErrorReportAcaoTipo =
  | 'CHAMADO_CRIADO'
  | 'COMENTARIO'
  | 'STATUS_ALTERADO'
  | 'CHAMADO_CANCELADO';

export interface ErrorReportAcao {
  tipo: ErrorReportAcaoTipo;
  em: string;
  usuarioId: number;
  usuarioNome: string;
  detalhes?: Record<string, unknown>;
}

export interface ErrorReport {
  id: number;
  usuarioId: number;
  protocolo: string;
  descricao: string;
  categoria: ErrorReportCategoria;
  status: ErrorReportStatus;
  acoes: ErrorReportAcao[];
  anexoDataUrl?: string | null;
  anexoNome?: string | null;
  createdAt: string;
  updatedAt: string;
  usuario?: { id: number; nome: string; matricula: string };
}
