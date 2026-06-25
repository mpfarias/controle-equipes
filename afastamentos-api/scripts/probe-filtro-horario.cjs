require('dotenv/config');
const { parseIntegraSspConfig } = require('../dist/orion-qualidade/integra-ssp-config');
const { buildIntegraSspMssqlPoolConfig } = require('../dist/orion-qualidade/integra-ssp-mssql.util');
const { formatDateTimeBrasilia } = require('../dist/orion-qualidade/integra-ssp-brasilia.util');
const { instanteBrasiliaParaUtc } = require('../dist/orion-qualidade/integra-ssp-brasilia.util');
const sql = require('mssql');

async function main() {
  const cfg = parseIntegraSspConfig(process.env);
  const pool = await sql.connect(buildIntegraSspMssqlPoolConfig(cfg));

  const dia = '2026-06-25';
  const dataInicio = instanteBrasiliaParaUtc(dia, '00:01');
  const dataFim = instanteBrasiliaParaUtc(dia, '14:20');

  console.log('Filtro API:');
  console.log('  dataInicio UTC:', dataInicio.toISOString());
  console.log('  dataFim UTC:', dataFim.toISOString());

  const maxHoje = await pool.request().query(`
    SELECT
      MAX(c.hora_entra_fila) AS max_entrada,
      MIN(c.hora_entra_fila) AS min_entrada,
      COUNT(*) AS total
    FROM PRD_STG_HEFESTO.CHAMADAS c
    WHERE c.ramal LIKE '71%'
      AND CAST(c.hora_entra_fila AS date) = '${dia}'
  `);
  console.log('\nCHAMADAS ramal 71% no dia (CAST date):', maxHoje.recordset[0]);

  const comFiltro = await pool.request()
    .input('dataInicio', dataInicio)
    .input('dataFim', dataFim)
    .query(`
      SELECT COUNT(*) AS total,
        MAX(c.hora_entra_fila) AS max_entrada,
        MIN(c.hora_entra_fila) AS min_entrada
      FROM PRD_STG_HEFESTO.CHAMADAS c
      WHERE c.hora_entra_fila >= @dataInicio AND c.hora_entra_fila <= @dataFim
        AND LTRIM(RTRIM(ISNULL(c.ramal, ''))) LIKE '71%'
    `);
  console.log('\nCom filtro 00:01-14:20 BRT (params JS Date):', comFiltro.recordset[0]);

  const adail = await pool.request()
    .input('dataInicio', dataInicio)
    .input('dataFim', dataFim)
    .query(`
      SELECT TOP 20 c.id, c.ramal, c.NO_USER_CADASTRO, c.hora_entra_fila, c.hora_atende, c.status
      FROM PRD_STG_HEFESTO.CHAMADAS c
      WHERE c.hora_entra_fila >= @dataInicio AND c.hora_entra_fila <= @dataFim
        AND c.ramal = '7118'
      ORDER BY c.hora_entra_fila DESC
    `);
  console.log('\nTop 20 chamadas ramal 7118 (mais recentes):');
  for (const r of adail.recordset) {
    const raw = r.hora_entra_fila;
    console.log({
      id: r.id,
      raw: raw instanceof Date ? raw.toISOString() : raw,
      formatBr: formatDateTimeBrasilia(raw),
      atendente: r.NO_USER_CADASTRO,
      status: r.status,
    });
  }

  // Comparar filtro com string SQL direta (horário de parede)
  const filtroString = await pool.request().query(`
    SELECT COUNT(*) AS total, MAX(c.hora_entra_fila) AS max_entrada
    FROM PRD_STG_HEFESTO.CHAMADAS c
    WHERE c.hora_entra_fila >= '${dia} 00:01:00'
      AND c.hora_entra_fila <= '${dia} 14:20:00'
      AND c.ramal = '7118'
  `);
  console.log('\nFiltro string SQL parede 00:01-14:20 ramal 7118:', filtroString.recordset[0]);

  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
