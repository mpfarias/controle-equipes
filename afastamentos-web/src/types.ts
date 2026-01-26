export type AfastamentoStatus = 'ATIVO' | 'ENCERRADO';

export type PolicialStatus =
  | 'ATIVO'
  | 'DESIGNADO'
  | 'COMISSIONADO'
  | 'PTTC'
  | 'DESATIVADO';

export type UsuarioStatus = 'ATIVO' | 'DESATIVADO';

export type Equipe = string;

export interface UsuarioNivel {
  id: number;
  nome: string;
  descricao?: string | null;
  ativo?: boolean;
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
  nivel?: { id: number; nome: string; descricao?: string | null; ativo?: boolean };
  funcaoId?: number | null;
  funcao?: { id: number; nome: string; descricao?: string | null };
  createdById?: number | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUsuarioInput {
  nome: string;
  matricula: string;
  senha: string;
  perguntaSeguranca?: string;
  respostaSeguranca?: string;
  equipe?: Equipe;
  nivelId: number;
  funcaoId?: number;
}

export interface LoginInput {
  matricula: string;
  senha: string;
}

export interface RestricaoMedica {
  id: number;
  nome: string;
  descricao?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RestricaoMedicaHistorico {
  id: number;
  policialId: number;
  restricaoMedicaId: number;
  restricaoMedica: RestricaoMedica;
  dataInicio: string;
  dataFim: string;
  removidoPorId?: number | null;
  removidoPorNome?: string | null;
  createdAt: string;
}

export interface Policial {
  id: number;
  nome: string;
  matricula: string;
  equipe: Equipe | null;
  status: PolicialStatus;
  funcaoId?: number | null;
  funcao?: { id: number; nome: string; descricao?: string | null } | null;
  restricaoMedicaId?: number | null;
  restricaoMedica?: RestricaoMedica | null;
  restricoesMedicasHistorico?: RestricaoMedicaHistorico[];
  fotoUrl?: string | null;
  mesPrevisaoFerias?: number | null;
  anoPrevisaoFerias?: number | null;
  mesPrevisaoFeriasOriginal?: number | null;
  anoPrevisaoFeriasOriginal?: number | null;
  feriasConfirmadas?: boolean;
  feriasReprogramadas?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePolicialInput {
  nome: string;
  matricula: string;
  status: PolicialStatus;
  equipe?: Equipe | null;
  funcaoId?: number;
}

export interface Afastamento {
  id: number;
  policialId: number;
  policial: Policial;
  motivoId: number;
  motivo: { id: number; nome: string; descricao?: string | null };
  seiNumero: string;
  descricao?: string | null;
  dataInicio: string;
  dataFim?: string | null;
  status: AfastamentoStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAfastamentoInput {
  policialId: number;
  motivoId: number;
  seiNumero: string;
  descricao?: string;
  dataInicio: string;
  dataFim?: string;
}

export interface MotivoAfastamentoOption {
  id: number;
  nome: string;
  descricao?: string | null;
}

export interface StatusPolicialOption {
  id: number;
  nome: string;
  descricao?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UsuarioNivelOption {
  id: number;
  nome: string;
  descricao?: string | null;
  ativo?: boolean;
}

export interface EquipeOption {
  id: number;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
}

export interface PerguntaSegurancaOption {
  id: number;
  texto: string;
  ativo: boolean;
}

export interface CreateUsuarioNivelInput {
  nome: string;
  descricao?: string;
}

export interface UpdateUsuarioNivelInput {
  nome?: string;
  descricao?: string | null;
}

export type PermissaoAcao = 'VISUALIZAR' | 'EDITAR' | 'DESATIVAR' | 'EXCLUIR';

export interface UsuarioNivelPermissao {
  telaKey: string;
  acao: PermissaoAcao;
}

export interface FuncaoOption {
  id: number;
  nome: string;
  descricao?: string | null;
  ativo?: boolean;
}

export interface PolicialExtraido {
  matricula: string;
  nome: string;
  funcaoNome: string;
  funcaoId?: number;
}

export interface ProcessFileResponse {
  policiais: PolicialExtraido[];
  funcoesCriadas: string[];
}

export interface PolicialBulkItem {
  matricula: string;
  nome: string;
  status: PolicialStatus;
  funcaoId?: number;
  equipe?: Equipe | null;
}

export interface CreatePoliciaisBulkInput {
  policiais: PolicialBulkItem[];
}

export interface BulkCreateResponse {
  criados: number;
  erros: Array<{ matricula: string; erro: string }>;
}

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditLog {
  id: number;
  entity: string;
  entityId?: number | null;
  action: AuditAction;
  userId?: number | null;
  userName?: string | null;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface RelatorioLog {
  id: number;
  userId?: number | null;
  userName?: string | null;
  matricula?: string | null;
  tipoRelatorio: string;
  createdAt: string;
}

export interface RelatorioLogsResponse {
  logs: RelatorioLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ErroLog {
  id: number;
  mensagem: string;
  stack?: string | null;
  endpoint?: string | null;
  metodo?: string | null;
  userId?: number | null;
  userName?: string | null;
  matricula?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestBody?: unknown;
  statusCode?: number | null;
  erro?: unknown;
  createdAt: string;
}

export interface ErroLogsResponse {
  logs?: ErroLog[];
  erros?: ErroLog[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

export interface AcessoLog {
  id: number;
  userId?: number | null;
  userName?: string | null;
  matricula?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  dataEntrada: string;
  dataSaida?: string | null;
  tempoSessao?: number | null; // Tempo em minutos
  createdAt: string;
  updatedAt: string;
}

export interface AcessoLogsResponse {
  logs?: AcessoLog[];
  acessos?: AcessoLog[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

export interface TipoRestricaoAfastamento {
  id: number;
  nome: string;
  descricao?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RestricaoAfastamento {
  id: number;
  tipoRestricaoId: number;
  tipoRestricao: TipoRestricaoAfastamento;
  ano: number;
  dataInicio: string;
  dataFim: string;
  motivosRestritos: number[];
  ativo: boolean;
  createdById?: number | null;
  createdByName?: string | null;
  updatedById?: number | null;
  updatedByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRestricaoAfastamentoInput {
  tipoRestricaoId: number;
  ano: number;
  dataInicio: string;
  dataFim: string;
  motivosAdicionais?: number[];
}

export interface UpdateRestricaoAfastamentoInput {
  tipoRestricaoId?: number;
  ano?: number;
  dataInicio?: string;
  dataFim?: string;
}
