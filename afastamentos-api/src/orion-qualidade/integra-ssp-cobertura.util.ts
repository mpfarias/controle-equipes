import { formatDateTimeBrasilia } from './integra-ssp-brasilia.util';
import { SQL_WHERE_RAMAL_PREFIXO_MSSQL, SQL_WHERE_RAMAL_PREFIXO_POSTGRES } from './integra-ssp-chamadas.filter';
import type { IntegraSspPoolService } from './integra-ssp-pool.service';

const LIMIAR_ATRASO_MS = 5 * 60 * 1000;

export type CoberturaIntegraChamadas = {
  schema: 'PRD_STG_HEFESTO';
  horaMaisRecente: string | null;
  horaMaisRecenteBrasilia: string;
  dataFimSolicitadaBrasilia: string;
  dadosIncompletos: boolean;
  mensagem: string | null;
};

type MaxRow = { mx?: Date | string | null };

export async function consultarCoberturaChamadasIntegra(
  pool: IntegraSspPoolService,
  dataInicio: Date,
  dataFim: Date,
): Promise<CoberturaIntegraChamadas> {
  const driver = pool.getDriver();
  const maxSql =
    driver === 'postgres'
      ? `
        SELECT MAX(c.hora_entra_fila) AS mx
        FROM "PRD_STG_HEFESTO"."CHAMADAS" c
        WHERE c.hora_entra_fila >= $1
          ${SQL_WHERE_RAMAL_PREFIXO_POSTGRES}
      `
      : `
        SELECT MAX(c.hora_entra_fila) AS mx
        FROM PRD_STG_HEFESTO.CHAMADAS c
        WHERE c.hora_entra_fila >= @dataInicio
          ${SQL_WHERE_RAMAL_PREFIXO_MSSQL}
      `;

  const rows = await pool.queryRows<MaxRow>(maxSql, { dataInicio });
  const mxRaw = rows[0]?.mx ?? null;
  const horaMaisRecente =
    mxRaw == null
      ? null
      : mxRaw instanceof Date
        ? mxRaw.toISOString()
        : new Date(mxRaw).toISOString();

  const horaMaisRecenteBrasilia = mxRaw != null ? formatDateTimeBrasilia(mxRaw) : '';
  const dataFimSolicitadaBrasilia = formatDateTimeBrasilia(dataFim);

  let dadosIncompletos = false;
  if (horaMaisRecente) {
    const fimMs = dataFim.getTime();
    const mxMs = new Date(horaMaisRecente).getTime();
    dadosIncompletos = fimMs - mxMs > LIMIAR_ATRASO_MS;
  }

  const mensagem = dadosIncompletos
    ? `Os dados disponíveis vão apenas até ${horaMaisRecenteBrasilia}, ` +
      `mas o filtro selecionado vai até ${dataFimSolicitadaBrasilia}. ` +
      'Registros mais recentes podem ainda não estar disponíveis.'
    : null;

  return {
    schema: 'PRD_STG_HEFESTO',
    horaMaisRecente,
    horaMaisRecenteBrasilia,
    dataFimSolicitadaBrasilia,
    dadosIncompletos,
    mensagem,
  };
}
