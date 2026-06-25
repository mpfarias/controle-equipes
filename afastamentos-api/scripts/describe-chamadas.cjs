require('dotenv/config');
const { parseIntegraSspConfig } = require('../dist/orion-qualidade/integra-ssp-config');
const { buildIntegraSspMssqlPoolConfig } = require('../dist/orion-qualidade/integra-ssp-mssql.util');
const sql = require('mssql');

async function main() {
  const cfg = parseIntegraSspConfig(process.env);
  if (!cfg || cfg.driver !== 'mssql') {
    console.error('Integra SSP MSSQL não configurado.');
    process.exit(1);
  }
  const pool = await sql.connect(buildIntegraSspMssqlPoolConfig(cfg));
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'PRD_STG_HEFESTO' AND TABLE_NAME = 'CHAMADAS'
    ORDER BY ORDINAL_POSITION
  `);
  console.log('Colunas PRD_STG_HEFESTO.CHAMADAS:');
  for (const c of cols.recordset) {
    console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`);
  }
  const count = await pool.request().query('SELECT COUNT(*) AS total FROM PRD_STG_HEFESTO.CHAMADAS');
  console.log('\nTotal de registros:', count.recordset[0]?.total);
  await pool.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
