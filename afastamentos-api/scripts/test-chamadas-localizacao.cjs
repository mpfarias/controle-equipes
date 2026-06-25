require('dotenv/config');
const { parseIntegraSspConfig } = require('../dist/orion-qualidade/integra-ssp-config');
const { buildIntegraSspMssqlPoolConfig } = require('../dist/orion-qualidade/integra-ssp-mssql.util');
const { intervaloDiaAtualBrasilia } = require('../dist/orion-qualidade/integra-ssp-brasilia.util');
const { mapChamadaIntegraSspParaApi } = require('../dist/orion-qualidade/integra-ssp-chamadas.mapper');
const sql = require('mssql');

async function main() {
  const { dataInicio, dataFim } = intervaloDiaAtualBrasilia();
  const cfg = parseIntegraSspConfig(process.env);
  const pool = await sql.connect(buildIntegraSspMssqlPoolConfig(cfg));
  const r = await pool
    .request()
    .input('dataInicio', dataInicio)
    .input('dataFim', dataFim)
    .query(`
      SELECT TOP 5 c.id, c.ramal,
             loc.latitude, loc.longitude
      FROM PRD_STG_HEFESTO.CHAMADAS c
      OUTER APPLY (
        SELECT TOP 1 o.latitude, o.longitude
        FROM PRD_STG_HEFESTO.OCORRENCIA o
        WHERE o.chamada_id = c.id
          AND NULLIF(LTRIM(RTRIM(o.latitude)), '') IS NOT NULL
          AND NULLIF(LTRIM(RTRIM(o.longitude)), '') IS NOT NULL
        ORDER BY o.Id DESC
      ) loc
      WHERE c.hora_entra_fila >= @dataInicio AND c.hora_entra_fila <= @dataFim
        AND LTRIM(RTRIM(ISNULL(c.ramal, ''))) LIKE '71%'
        AND loc.latitude IS NOT NULL
      ORDER BY c.hora_entra_fila DESC
    `);
  console.log('com localizacao', r.recordset.map(mapChamadaIntegraSspParaApi));

  const stats = await pool
    .request()
    .input('dataInicio', dataInicio)
    .input('dataFim', dataFim)
    .query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN loc.latitude IS NOT NULL THEN 1 ELSE 0 END) AS com_localizacao
      FROM PRD_STG_HEFESTO.CHAMADAS c
      OUTER APPLY (
        SELECT TOP 1 o.latitude, o.longitude
        FROM PRD_STG_HEFESTO.OCORRENCIA o
        WHERE o.chamada_id = c.id
          AND NULLIF(LTRIM(RTRIM(o.latitude)), '') IS NOT NULL
          AND NULLIF(LTRIM(RTRIM(o.longitude)), '') IS NOT NULL
        ORDER BY o.Id DESC
      ) loc
      WHERE c.hora_entra_fila >= @dataInicio AND c.hora_entra_fila <= @dataFim
        AND LTRIM(RTRIM(ISNULL(c.ramal, ''))) LIKE '71%'
    `);
  console.log('stats hoje', stats.recordset[0]);
  await pool.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
