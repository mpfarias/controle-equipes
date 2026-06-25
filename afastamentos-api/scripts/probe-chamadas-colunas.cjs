require('dotenv/config');
const { parseIntegraSspConfig } = require('../dist/orion-qualidade/integra-ssp-config');
const { buildIntegraSspMssqlPoolConfig } = require('../dist/orion-qualidade/integra-ssp-mssql.util');
const sql = require('mssql');

async function main() {
  const pool = await sql.connect(buildIntegraSspMssqlPoolConfig(parseIntegraSspConfig(process.env)));
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'PRD_STG_HEFESTO' AND TABLE_NAME = 'CHAMADAS'
    ORDER BY ORDINAL_POSITION
  `);
  console.log('Colunas CHAMADAS:');
  for (const c of cols.recordset) {
    if (/record|file|audio|grav/i.test(c.COLUMN_NAME)) console.log(' *', c.COLUMN_NAME, c.DATA_TYPE);
  }
  for (const c of cols.recordset) console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`);

  const sample = await pool.request().query(`
    SELECT TOP 3 *
    FROM PRD_STG_HEFESTO.CHAMADAS
    WHERE ramal LIKE '71%'
    ORDER BY hora_entra_fila DESC
  `);
  console.log('\nSample keys:', sample.recordset[0] ? Object.keys(sample.recordset[0]) : []);
  await pool.close();
}

main().catch(console.error);
