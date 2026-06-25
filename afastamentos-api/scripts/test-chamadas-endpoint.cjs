require('dotenv/config');
const { parseIntegraSspConfig } = require('../dist/orion-qualidade/integra-ssp-config');
const { buildIntegraSspMssqlPoolConfig } = require('../dist/orion-qualidade/integra-ssp-mssql.util');
const { intervaloDiaAtualBrasilia } = require('../dist/orion-qualidade/integra-ssp-brasilia.util');
const { mapChamadaIntegraSspParaApi } = require('../dist/orion-qualidade/integra-ssp-chamadas.mapper');
const sql = require('mssql');

async function main() {
  const { dataInicio, dataFim, rotuloDia } = intervaloDiaAtualBrasilia();
  console.log('intervalo', { rotuloDia, dataInicio: dataInicio.toISOString(), dataFim: dataFim.toISOString() });

  const cfg = parseIntegraSspConfig(process.env);
  const pool = await sql.connect(buildIntegraSspMssqlPoolConfig(cfg));
  const r = await pool
    .request()
    .input('dataInicio', dataInicio)
    .input('dataFim', dataFim)
    .query(`
      SELECT TOP 2 c.id, c.unique_id, c.chamador, c.fila, c.ramal, c.status,
             c.hora_entra_fila, c.hora_atende, c.hora_desliga,
             c.tempo_espera, c.duracao, c.quem_desliga,
             c.NO_USER_CADASTRO,
             m.motivo_encerramento
      FROM PRD_STG_HEFESTO.CHAMADAS c
      LEFT JOIN PRD_STG_HEFESTO.MOTIVO_ENCERRAMENTO m
        ON m.id = c.cod_motivo_encerramento
      WHERE c.hora_entra_fila >= @dataInicio AND c.hora_entra_fila <= @dataFim
        AND LTRIM(RTRIM(ISNULL(c.ramal, ''))) LIKE '71%'
      ORDER BY c.hora_entra_fila ASC
    `);
  const count = await pool
    .request()
    .input('dataInicio', dataInicio)
    .input('dataFim', dataFim)
    .query(`
      SELECT COUNT(*) AS c FROM PRD_STG_HEFESTO.CHAMADAS c
      WHERE c.hora_entra_fila >= @dataInicio AND c.hora_entra_fila <= @dataFim
    `);
  console.log('total', count.recordset[0].c);
  console.log('mapped', r.recordset.map(mapChamadaIntegraSspParaApi));
  await pool.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
