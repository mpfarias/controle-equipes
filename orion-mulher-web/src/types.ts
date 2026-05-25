export interface Usuario {
  id: number;
  nome: string;
  matricula: string;
  fotoUrl?: string | null;
  isAdmin?: boolean;
  sistemasPermitidos?: string[];
  nivel?: { id?: number; nome?: string | null } | null;
}

export interface LoginInput {
  matricula: string;
  senha: string;
}

export type MulherOperadorPerfil = 'ADMINISTRADOR' | 'ATENDENTE' | 'CONSULTA';

export interface OrionMulherSessao {
  ok: boolean;
  sistema: string;
  podeAcessarModulo: boolean;
  perfil: MulherOperadorPerfil | null;
  usuario: { id: number; nome: string; matricula: string };
  mensagem: string;
}

export interface MulherOcorrenciaListaItem {
  id: string;
  faseAtual: number;
  concluida: boolean;
  nomeVitima: string | null;
  nomeAgressor: string | null;
  regiaoAdministrativa: string | null;
  dataHoraOcorrencia: string | null;
  numeroOcorrenciaCad: string | null;
  updatedAt: string;
  desfecho: string | null;
}

export interface MulherOcorrenciasListaResposta {
  items: MulherOcorrenciaListaItem[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
}

export interface MulherDashboardStats {
  total: number;
  porRegiao: { name: string; value: number }[];
  porTipoAgressao: { name: string; value: number }[];
  porDesfecho: { name: string; value: number }[];
  porMes: { mes: string; total: number }[];
  revertidasCopomPorMes: { mes: string; total: number }[];
  revertidasCopomTotal: number;
  porOrigem: { name: string; value: number }[];
  meta: {
    criterioTempo: 'dataHora_carimbo_cadastro';
    somaPorMes: number;
    somaPorOrigem: number;
    somaRevertidasPorMes: number;
    total: number;
    coerente: boolean;
  };
  resumo: {
    categoriasRegiao: number;
    categoriasTipo: number;
    categoriasDesfecho: number;
  };
}

export interface MulherExcelImportResult {
  removedPreviousExcelRows?: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

export interface MulherVitimaCadastroMobile {
  id: string;
  telefoneDigits: string;
  nomeVitima: string | null;
  enderecoResidencia: string | null;
  nomeAgressor: string | null;
  createdAt: string;
}

export interface MulherVitimaPanicoMobile {
  id: string;
  telefoneDigits: string;
  latitude: number;
  longitude: number;
  encaminhamento: string | null;
  finalizacao: string | null;
  createdAt: string;
  cadastro?: { id: string; nomeVitima: string | null; telefoneDigits: string } | null;
}

export type MulherOcorrenciaCompleta = MulherOcorrenciaListaItem & Record<string, unknown>;
