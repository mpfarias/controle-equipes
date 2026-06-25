require('dotenv/config');
const { parseIntegraSspConfig } = require('../dist/orion-qualidade/integra-ssp-config');
const { buildIntegraSspMssqlPoolConfig } = require('../dist/orion-qualidade/integra-ssp-mssql.util');
const sql = require('mssql');

async function main() {
  const cfg = parseIntegraSspConfig(process.env);
  const pool = await sql.connect(buildIntegraSspMssqlPoolConfig(cfg));
  const r = await pool.request().query(`
    SELECT TOP 3 id, status, hora_entra_fila, hora_atende, hora_desliga,
           NO_USER_CADASTRO, ramal, cod_motivo_encerramento, tempo_espera, duracao
    FROM PRD_STG_HEFESTO.CHAMADAS
    WHERE hora_entra_fila >= CAST(CAST(GETDATE() AS date) AS datetime)
    ORDER BY hora_entra_fila DESC
  `);
  console.log('sample', JSON.stringify(r.recordset, null, 2));
  const s = await pool.request().query(`
    SELECT DISTINCT TOP 15 status FROM PRD_STG_HEFESTO.CHAMADAS
    WHERE hora_entra_fila >= CAST(CAST(GETDATE() AS date) AS datetime)
  `);
  console.log('status', s.recordset.map((x) => x.status));
  const c = await pool.request().query(`
    SELECT COUNT(*) AS c FROM PRD_STG_HEFESTO.CHAMADAS
    WHERE hora_entra_fila >= CAST(CAST(GETDATE() AS date) AS datetime)
  `);
  console.log('hoje', c.recordset[0]);
  const m = await pool.request().query(`SELECT TOP 5 * FROM PRD_STG_HEFESTO.MOTIVO_ENCERRAMENTO`);
  console.log('motivos', m.recordset);
  await pool.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
