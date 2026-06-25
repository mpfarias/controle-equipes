import { SQL_WHERE_RAMAL_PREFIXO_MSSQL, SQL_WHERE_RAMAL_PREFIXO_POSTGRES } from './integra-ssp-chamadas.filter';
import {
  type ChamadaIntegraSspRow,
  type ChamadaQualidadeApiRow,
  mapChamadaIntegraSspParaApi,
} from './integra-ssp-chamadas.mapper';
import type { IntegraSspPoolService } from './integra-ssp-pool.service';

export const CHAMADAS_INTEGRA_PAGE_SIZE = 25;

export async function listarChamadasIntegraPaginado(
  pool: IntegraSspPoolService,
  opts: { dataInicio: Date; dataFim: Date; page: number; pageSize?: number },
): Promise<{
  items: ChamadaQualidadeApiRow[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
}> {
  const pageSize = opts.pageSize ?? CHAMADAS_INTEGRA_PAGE_SIZE;
  const driver = pool.getDriver();

  const countSql =
    driver === 'postgres'
      ? `
        SELECT COUNT(*)::int AS total
        FROM "PRD_STG_HEFESTO"."CHAMADAS" c
        WHERE c.hora_entra_fila >= $1 AND c.hora_entra_fila <= $2
          ${SQL_WHERE_RAMAL_PREFIXO_POSTGRES}
      `
      : `
        SELECT COUNT(*) AS total
        FROM PRD_STG_HEFESTO.CHAMADAS c
        WHERE c.hora_entra_fila >= @dataInicio AND c.hora_entra_fila <= @dataFim
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
        SELECT c.id, c.unique_id, c.chamador, c.fila, c.ramal, c.status,
               c.hora_entra_fila, c.hora_atende, c.hora_desliga,
               c.tempo_espera, c.duracao, c.quem_desliga,
               c."NO_USER_CADASTRO",
               c.record_file,
               m.motivo_encerramento
        FROM "PRD_STG_HEFESTO"."CHAMADAS" c
        LEFT JOIN "PRD_STG_HEFESTO"."MOTIVO_ENCERRAMENTO" m
          ON m.id = c.cod_motivo_encerramento
        WHERE c.hora_entra_fila >= $1 AND c.hora_entra_fila <= $2
          ${SQL_WHERE_RAMAL_PREFIXO_POSTGRES}
        ORDER BY c.hora_entra_fila DESC, c.id DESC
        LIMIT $4 OFFSET $3
      `
      : `
        SELECT c.id, c.unique_id, c.chamador, c.fila, c.ramal, c.status,
               c.hora_entra_fila, c.hora_atende, c.hora_desliga,
               c.tempo_espera, c.duracao, c.quem_desliga,
               c.NO_USER_CADASTRO,
               c.record_file,
               m.motivo_encerramento
        FROM PRD_STG_HEFESTO.CHAMADAS c
        LEFT JOIN PRD_STG_HEFESTO.MOTIVO_ENCERRAMENTO m
          ON m.id = c.cod_motivo_encerramento
        WHERE c.hora_entra_fila >= @dataInicio AND c.hora_entra_fila <= @dataFim
          ${SQL_WHERE_RAMAL_PREFIXO_MSSQL}
        ORDER BY c.hora_entra_fila DESC, c.id DESC
        OFFSET @skip ROWS FETCH NEXT @pageSize ROWS ONLY
      `;

  const listParams =
    driver === 'postgres'
      ? { dataInicio: opts.dataInicio, dataFim: opts.dataFim, skip, pageSize }
      : { dataInicio: opts.dataInicio, dataFim: opts.dataFim, skip, pageSize };

  const rows = await pool.queryRows<ChamadaIntegraSspRow>(listSql, listParams);
  const items = rows.map(mapChamadaIntegraSspParaApi);

  return { items, total, page, totalPages, pageSize };
}
