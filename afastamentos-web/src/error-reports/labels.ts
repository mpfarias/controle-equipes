import type { ErrorReportAcaoTipo, ErrorReportCategoria, ErrorReportStatus } from '../types';

export const ERROR_REPORT_CATEGORIA_LABEL: Record<ErrorReportCategoria, string> = {
  ERRO_SISTEMA: 'Erro no sistema',
  DUVIDA: 'Dúvida',
  MELHORIA: 'Melhoria / sugestão',
  OUTRO: 'Outro',
};

export const ERROR_REPORT_STATUS_LABEL: Record<ErrorReportStatus, string> = {
  ABERTO: 'Aberto',
  EM_ANALISE: 'Em análise',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
  CANCELADO: 'Cancelado pelo usuário',
};

export const ERROR_REPORT_ACAO_LABEL: Record<ErrorReportAcaoTipo, string> = {
  CHAMADO_CRIADO: 'Chamado aberto',
  COMENTARIO: 'Comentário',
  STATUS_ALTERADO: 'Status alterado',
  CHAMADO_CANCELADO: 'Chamado cancelado',
};
