require('dotenv/config');
const { parseIntegraSspConfig } = require('../dist/orion-qualidade/integra-ssp-config');
const { buildIntegraSspMssqlPoolConfig } = require('../dist/orion-qualidade/integra-ssp-mssql.util');
const { formatDateTimeBrasilia } = require('../dist/orion-qualidade/integra-ssp-brasilia.util');
const sql = require('mssql');

async function main() {
  const pool = await sql.connect(buildIntegraSspMssqlPoolConfig(parseIntegraSspConfig(process.env)));
  const r = await pool.request().query(`
    SELECT TOP 5 c.hora_entra_fila, c.ramal, c.NO_USER_CADASTRO
    FROM PRD_STG_HEFESTO.CHAMADAS c
    WHERE c.ramal LIKE '71%'
    ORDER BY c.hora_entra_fila DESC
  `);
  console.log('Últimas 5 chamadas 71% no STG:');
  for (const row of r.recordset) {
    console.log(formatDateTimeBrasilia(row.hora_entra_fila), row.ramal, row.NO_USER_CADASTRO);
  }
  const hoje = await pool.request().query(`SELECT MAX(hora_entra_fila) AS mx FROM PRD_STG_HEFESTO.CHAMADAS`);
  console.log('Max geral STG:', formatDateTimeBrasilia(hoje.recordset[0].mx));
  await pool.close();
}

main().catch(console.error);
