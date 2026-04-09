export type AfastamentoStatus = 'ATIVO' | 'ENCERRADO' | 'DESATIVADO';

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
  /** Acesso ao aplicativo Órion Suporte (gestão de chamados). */
  acessoOrionSuporte?: boolean;
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
  nivel?: {
    id: number;
    nome: string;
    descricao?: string | null;
    ativo?: boolean;
    acessoOrionSuporte?: boolean;
  };
  funcaoId?: number | null;
  funcao?: { id: number; nome: string; descricao?: string | null };
  fotoUrl?: string | null;
  /**
   * Órion Suporte: null/omitido = herdar `nivel.acessoOrionSuporte`;
   * true = garantir; false = bloquear mesmo que o nível conceda.
   */
  acessoOrionSuporte?: boolean | null;
  /** Sistemas integrados (IDs: SAD, ORION_PATRIMONIO, OPERACOES, etc.). */
  sistemasPermitidos?: string[];
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
  fotoUrl?: string | null;
  sistemasPermitidos: string[];
  acessoOrionSuporte?: boolean | null;
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
  /** Protocolo numérico de 15 dígitos (ano + categoria + mês + dia + ordem no dia). */
  protocolo: string;
  descricao: string;
  categoria: ErrorReportCategoria;
  status: ErrorReportStatus;
  acoes: ErrorReportAcao[];
  /** Data URL (imagem/PDF) quando o solicitante anexou arquivo. */
  anexoDataUrl?: string | null;
  anexoNome?: string | null;
  createdAt: string;
  updatedAt: string;
  usuario?: { id: number; nome: string; matricula: string };
}

export interface CreateErrorReportInput {
  descricao: string;
  categoria: ErrorReportCategoria;
  anexoDataUrl?: string;
  anexoNome?: string;
}

export interface RestricaoMedica {
  id: number;
  nome: string;
  descricao?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Uma linha de previsão por exercício (ano da cota). */
export interface PrevisaoFeriasPorExercicioItem {
  ano: number;
  semMesDefinido: boolean;
  mes: number | null;
  confirmada: boolean;
  reprogramada: boolean;
  mesOriginal: number | null;
  anoOriginal: number | null;
  /** Em `GET /policiais/:id`: se o exercício é anterior ao civil e pode remover a previsão (sem férias ativas na cota). */
  podeExcluirPrevisaoAnterior?: boolean;
}

export interface RestricaoMedicaHistorico {
  id: number;
  policialId: number;
  restricaoMedicaId: number;
  restricaoMedica: RestricaoMedica;
  dataInicio: string;
  dataFim: string;
  observacao?: string | null;
  removidoPorId?: number | null;
  removidoPorNome?: string | null;
  createdAt: string;
}

export interface Policial {
  id: number;
  nome: string;
  matricula: string;
  cpf?: string | null;
  telefone?: string | null;
  dataNascimento?: string | null;
  email?: string | null;
  matriculaComissionadoGdf?: string | null;
  dataPosse?: string | null;
  equipe: Equipe | null;
  status: PolicialStatus;
  funcaoId?: number | null;
  funcao?: { id: number; nome: string; descricao?: string | null } | null;
  restricaoMedicaId?: number | null;
  restricaoMedica?: RestricaoMedica | null;
  restricaoMedicaObservacao?: string | null;
  restricoesMedicasHistorico?: RestricaoMedicaHistorico[];
  fotoUrl?: string | null;
  mesPrevisaoFerias?: number | null;
  anoPrevisaoFerias?: number | null;
  mesPrevisaoFeriasOriginal?: number | null;
  anoPrevisaoFeriasOriginal?: number | null;
  feriasConfirmadas?: boolean;
  feriasReprogramadas?: boolean;
  /** Exercício anterior: previsão só com ano; mês ainda não definido. */
  previsaoFeriasSomenteAno?: boolean;
  /** Presente em `GET /policiais/:id`: todos os exercícios com previsão cadastrada. */
  previsoesFeriasPorExercicio?: PrevisaoFeriasPorExercicioItem[];
  createdAt: string;
  updatedAt: string;
  dataDesativacaoAPartirDe?: string | null;
  observacoesDesativacao?: string | null;
  desativadoPorId?: number | null;
  desativadoPorNome?: string | null;
  desativadoEm?: string | null;
}

export interface CreatePolicialInput {
  nome: string;
  matricula: string;
  status: PolicialStatus;
  funcaoId: number;
  cpf?: string | null;
  telefone?: string | null;
  dataNascimento?: string | null;
  email?: string | null;
  matriculaComissionadoGdf?: string | null;
  dataPosse?: string | null;
  equipe?: Equipe | null;
}

export interface Afastamento {
  id: number;
  policialId: number;
  policial: Policial;
  motivoId: number;
  motivo: { id: number; nome: string; descricao?: string | null };
  seiNumero: string;
  descricao?: string | null;
  /** Ano da cota (exercício) quando o gozo é em outro ano; omitido/nulo = ano da data de início. */
  anoExercicioFerias?: number | null;
  dataInicio: string;
  dataFim?: string | null;
  status: AfastamentoStatus;
  /** Quem desativou o afastamento (manual ou “Sistema” no encerramento automático). */
  desativadoPorId?: number | null;
  desativadoPorNome?: string | null;
  desativadoEm?: string | null;
  createdById?: number | null;
  createdByName?: string | null;
  updatedById?: number | null;
  updatedByName?: string | null;
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
  /** Só para motivo Férias: ano da cota (ex.: 2024 com gozo em 2026). */
  anoExercicioFerias?: number | null;
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

export interface HorarioSvg {
  id: number;
  horaInicio: string;
  horaFim: string;
}

/** Parâmetros globais da escala (API GET /escalas/parametros). */
export interface EscalaParametros {
  dataInicioEquipes: string;
  dataInicioMotoristas: string;
  sequenciaEquipes: string;
  sequenciaMotoristas: string;
}

export interface EscalaInformacao {
  id: number;
  titulo: string;
  conteudo: string;
  ordem: number;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  createdById?: number | null;
  createdByName?: string | null;
  updatedById?: number | null;
  updatedByName?: string | null;
}

export interface EscalaGeradaLinha {
  id: number;
  escalaGeradaId: number;
  lista: 'DISPONIVEL' | 'AFASTADO';
  policialId: number;
  nome: string;
  matricula: string;
  equipe: string | null;
  horarioServico: string;
  funcaoNome: string | null;
  detalheAfastamento: string | null;
}

export interface EscalaGerada {
  id: number;
  dataEscala: string;
  tipoServico: string;
  resumoEquipes: string | null;
  ativo?: boolean;
  createdAt: string;
  createdById: number | null;
  createdByName: string | null;
  linhas: EscalaGeradaLinha[];
}

/** Resumo de GET /escalas/geradas (sem linhas). */
export interface EscalaGeradaResumo {
  id: number;
  dataEscala: string;
  tipoServico: string;
  resumoEquipes: string | null;
  createdAt: string;
  createdById: number | null;
  createdByName: string | null;
  linhasCount: number;
}

export interface TrocaServico {
  id: number;
  policialAId: number;
  policialBId: number;
  equipeOrigemA: string | null;
  equipeOrigemB: string | null;
  dataServicoA: string;
  dataServicoB: string;
  restauradoA: boolean;
  restauradoB: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** Item de GET /troca-servico/ativas (trocas ATIVA e CONCLUIDA para consulta na UI). */
export interface TrocaServicoAtivaListaItem {
  id: number;
  /** Ausente em respostas antigas do servidor; trate como ATIVA. */
  status?: 'ATIVA' | 'CONCLUIDA';
  dataServicoA: string;
  dataServicoB: string;
  restauradoA: boolean;
  restauradoB: boolean;
  equipeOrigemA: string | null;
  equipeOrigemB: string | null;
  policialA: { id: number; nome: string; matricula: string; equipe: string | null };
  policialB: { id: number; nome: string; matricula: string; equipe: string | null };
}

export interface UsuarioNivelOption {
  id: number;
  nome: string;
  descricao?: string | null;
  ativo?: boolean;
  acessoOrionSuporte?: boolean;
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
  acessoOrionSuporte?: boolean;
}

export interface UpdateUsuarioNivelInput {
  nome?: string;
  descricao?: string | null;
  acessoOrionSuporte?: boolean;
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
  /** Preenchido quando o arquivo tem coluna situação/Status (ex.: PDF com ASSESSOR -> COMISSIONADO). */
  status?: PolicialStatus;
  /** true quando a matrícula já existe no sistema; na modal mostra "Policial já cadastrado". */
  jaCadastrado?: boolean;
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
