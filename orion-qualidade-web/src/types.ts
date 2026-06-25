import type { ChamadaXlsxRow } from './types/chamadasXlsx';

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

/** GET /orion-qualidade/v1/integra-ssp/status */
export type IntegraSspStatus = {
  configurado: boolean;
  conectado: boolean;
  driver?: 'mssql' | 'postgres';
  bancoAtual?: string;
  mensagem?: string;
  gravacaoDownloadConfigurada?: boolean;
};

/** GET /orion-qualidade/v1/chamadas */
export type CoberturaIntegraChamadas = {
  schema: 'PRD_STG_HEFESTO';
  horaMaisRecente: string | null;
  horaMaisRecenteBrasilia: string;
  dataFimSolicitadaBrasilia: string;
  dadosIncompletos: boolean;
  mensagem: string | null;
};

export type ListChamadasIntegraSspResponse = {
  fonte: 'integra_ssp';
  rotuloDia: string;
  dataInicio: string;
  dataFim: string;
  total: number;
  coberturaIntegra?: CoberturaIntegraChamadas;
  rows: ChamadaXlsxRow[];
};

/** Item de PRD_STG_HEFESTO.OCORRENCIA (Integra SSP). */
export type OcorrenciaIntegraItem = {
  id: string;
  chamadaId: string;
  protocolo: string;
  cpfSolicitante: string;
  nomeSolicitante: string;
  natureza: string;
  latitude: string;
  longitude: string;
  narrativa: string;
  uf: string;
  municipio: string;
  bairro: string;
  logradouro: string;
  numero: string;
  complemento: string;
  pontoReferencia: string;
  quartelId: string;
  flagManual: boolean;
  dataHoraRegistro: string;
  origemCoordenada: string;
  atendente: string;
  cpfAtendente: string;
  origem: string;
  agencia: string;
  videoChamada: boolean;
  telefoneDigitado: string;
  operacao: string;
  ramal: string;
};

/** GET /orion-qualidade/v1/ocorrencias */
export type ListOcorrenciasIntegraSspResponse = {
  fonte: 'integra_ssp';
  tabela: string;
  rotuloDia: string;
  dataInicio: string;
  dataFim: string;
  items: OcorrenciaIntegraItem[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
};

/** GET /orion-qualidade/v1/chamadas/listagem */
export type ListChamadasIntegraTabelaResponse = {
  fonte: 'integra_ssp';
  tabela: string;
  rotuloDia: string;
  dataInicio: string;
  dataFim: string;
  items: ChamadaXlsxRow[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  coberturaIntegra?: CoberturaIntegraChamadas;
};

export type NaturezaCatalogoItem = {
  codigo: string;
  descricao: string | null;
  confianca: 'alta' | 'media' | 'baixa';
  totalOcorrencias: number;
  amostrasAnalisadas: number;
};

/** GET /orion-qualidade/v1/ocorrencias/naturezas */
export type CatalogoNaturezasIntegraSspResponse = {
  fonte: 'integra_ssp';
  metodo: 'narrativa';
  tabelaDominio: string | null;
  aviso: string;
  totalCodigos: number;
  totalComDescricao: number;
  items: NaturezaCatalogoItem[];
};
