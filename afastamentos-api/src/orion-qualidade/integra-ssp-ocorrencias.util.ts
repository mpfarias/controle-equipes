import { formatDateTimeBrasilia } from './integra-ssp-brasilia.util';
import { SQL_WHERE_RAMAL_PREFIXO_MSSQL, SQL_WHERE_RAMAL_PREFIXO_POSTGRES } from './integra-ssp-chamadas.filter';
import type { IntegraSspPoolService } from './integra-ssp-pool.service';

export const OCORRENCIAS_INTEGRA_PAGE_SIZE = 25;

export type OcorrenciaIntegraSspRow = {
  Id?: number | string | null;
  chamada_id?: number | string | null;
  protocolo?: string | null;
  cpf_solicitante?: string | null;
  nome_solicitante?: string | null;
  natureza?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  narrativa?: string | null;
  uf?: string | null;
  municipio?: string | null;
  bairro?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  ponto_referencia?: string | null;
  quartel_id?: number | string | null;
  flag_manual?: boolean | number | null;
  data_hora_registro?: Date | string | null;
  origemCoordenada?: string | null;
  NO_USER_CADASTRO?: string | null;
  NU_CPF_USER_CADASTRO?: string | null;
  origem?: string | null;
  agencia?: string | null;
  VIDEO_CHAMADA?: boolean | number | null;
  telefone_digitado?: string | null;
  operacao?: string | null;
  ramal?: string | null;
};

export type OcorrenciaIntegraApiItem = {
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

function textoCampo(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function textoNumero(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v));
  return textoCampo(v);
}

function boolCampo(v: unknown): boolean {
  if (v === true || v === 1 || v === '1') return true;
  return false;
}

export function mapOcorrenciaIntegraSspParaApi(row: OcorrenciaIntegraSspRow): OcorrenciaIntegraApiItem {
  return {
    id: textoNumero(row.Id),
    chamadaId: textoNumero(row.chamada_id),
    protocolo: textoCampo(row.protocolo),
    cpfSolicitante: textoCampo(row.cpf_solicitante),
    nomeSolicitante: textoCampo(row.nome_solicitante),
    natureza: textoCampo(row.natureza),
    latitude: textoCampo(row.latitude),
    longitude: textoCampo(row.longitude),
    narrativa: textoCampo(row.narrativa),
    uf: textoCampo(row.uf),
    municipio: textoCampo(row.municipio),
    bairro: textoCampo(row.bairro),
    logradouro: textoCampo(row.logradouro),
    numero: textoCampo(row.numero),
    complemento: textoCampo(row.complemento),
    pontoReferencia: textoCampo(row.ponto_referencia),
    quartelId: textoNumero(row.quartel_id),
    flagManual: boolCampo(row.flag_manual),
    dataHoraRegistro: formatDateTimeBrasilia(row.data_hora_registro),
    origemCoordenada: textoCampo(row.origemCoordenada),
    atendente: textoCampo(row.NO_USER_CADASTRO),
    cpfAtendente: textoCampo(row.NU_CPF_USER_CADASTRO),
    origem: textoCampo(row.origem),
    agencia: textoCampo(row.agencia),
    videoChamada: boolCampo(row.VIDEO_CHAMADA),
    telefoneDigitado: textoCampo(row.telefone_digitado),
    operacao: textoCampo(row.operacao),
    ramal: textoCampo(row.ramal),
  };
}

const SELECT_OCORRENCIA_COLS_MSSQL = `
  o.Id, o.chamada_id, o.protocolo, o.cpf_solicitante, o.nome_solicitante, o.natureza,
  o.latitude, o.longitude, o.narrativa, o.uf, o.municipio, o.bairro, o.logradouro,
  o.numero, o.complemento, o.ponto_referencia, o.quartel_id, o.flag_manual,
  o.data_hora_registro, o.origemCoordenada, o.NO_USER_CADASTRO, o.NU_CPF_USER_CADASTRO,
  o.origem, o.agencia, o.VIDEO_CHAMADA, o.telefone_digitado, o.operacao,
  c.ramal
`.trim();

const SELECT_OCORRENCIA_COLS_POSTGRES = `
  o."Id", o.chamada_id, o.protocolo, o.cpf_solicitante, o.nome_solicitante, o.natureza,
  o.latitude, o.longitude, o.narrativa, o.uf, o.municipio, o.bairro, o.logradouro,
  o.numero, o.complemento, o.ponto_referencia, o.quartel_id, o.flag_manual,
  o.data_hora_registro, o."origemCoordenada", o."NO_USER_CADASTRO", o."NU_CPF_USER_CADASTRO",
  o.origem, o.agencia, o."VIDEO_CHAMADA", o.telefone_digitado, o.operacao,
  c.ramal
`.trim();

export async function listarOcorrenciasIntegraPaginado(
  pool: IntegraSspPoolService,
  opts: { dataInicio: Date; dataFim: Date; page: number; pageSize?: number },
): Promise<{ items: OcorrenciaIntegraApiItem[]; total: number; page: number; totalPages: number; pageSize: number }> {
  const pageSize = opts.pageSize ?? OCORRENCIAS_INTEGRA_PAGE_SIZE;
  const driver = pool.getDriver();

  const countSql =
    driver === 'postgres'
      ? `
        SELECT COUNT(*)::int AS total
        FROM "PRD_STG_HEFESTO"."OCORRENCIA" o
        INNER JOIN "PRD_STG_HEFESTO"."CHAMADAS" c ON c.id = o.chamada_id
        WHERE o.data_hora_registro >= $1 AND o.data_hora_registro <= $2
          ${SQL_WHERE_RAMAL_PREFIXO_POSTGRES}
      `
      : `
        SELECT COUNT(*) AS total
        FROM PRD_STG_HEFESTO.OCORRENCIA o
        INNER JOIN PRD_STG_HEFESTO.CHAMADAS c ON c.id = o.chamada_id
        WHERE o.data_hora_registro >= @dataInicio AND o.data_hora_registro <= @dataFim
          ${SQL_WHERE_RAMAL_PREFIXO_MSSQL}
      `;

  const countRows = await pool.queryRows<{ total: number | string }>(countSql, {
    dataInicio: opts.dataInicio,
    dataFim: opts.dataFim,
  });
  const totalRaw = countRows[0]?.total ?? 0;
  const total = typeof totalRaw === 'number' ? totalRaw : Number.parseInt(String(totalRaw), 10) || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(opts.page) || 1), totalPages);
  const skip = (page - 1) * pageSize;

  const listSql =
    driver === 'postgres'
      ? `
        SELECT ${SELECT_OCORRENCIA_COLS_POSTGRES}
        FROM "PRD_STG_HEFESTO"."OCORRENCIA" o
        INNER JOIN "PRD_STG_HEFESTO"."CHAMADAS" c ON c.id = o.chamada_id
        WHERE o.data_hora_registro >= $1 AND o.data_hora_registro <= $2
          ${SQL_WHERE_RAMAL_PREFIXO_POSTGRES}
        ORDER BY o.data_hora_registro DESC, o."Id" DESC
        LIMIT $4 OFFSET $3
      `
      : `
        SELECT ${SELECT_OCORRENCIA_COLS_MSSQL}
        FROM PRD_STG_HEFESTO.OCORRENCIA o
        INNER JOIN PRD_STG_HEFESTO.CHAMADAS c ON c.id = o.chamada_id
        WHERE o.data_hora_registro >= @dataInicio AND o.data_hora_registro <= @dataFim
          ${SQL_WHERE_RAMAL_PREFIXO_MSSQL}
        ORDER BY o.data_hora_registro DESC, o.Id DESC
        OFFSET @skip ROWS FETCH NEXT @pageSize ROWS ONLY
      `;

  const listParams =
    driver === 'postgres'
      ? { dataInicio: opts.dataInicio, dataFim: opts.dataFim, skip, pageSize }
      : { dataInicio: opts.dataInicio, dataFim: opts.dataFim, skip, pageSize };

  const rows = await pool.queryRows<OcorrenciaIntegraSspRow>(listSql, listParams);
  const items = rows.map(mapOcorrenciaIntegraSspParaApi);

  return { items, total, page, totalPages, pageSize };
}
