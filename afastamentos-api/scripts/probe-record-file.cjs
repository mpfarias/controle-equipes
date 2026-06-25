require('dotenv/config');
const { parseIntegraSspConfig } = require('../dist/orion-qualidade/integra-ssp-config');
const { buildIntegraSspMssqlPoolConfig } = require('../dist/orion-qualidade/integra-ssp-mssql.util');
const sql = require('mssql');

async function tryQuery(pool, label, q) {
  try {
    const r = await pool.request().query(q);
    console.log('\n===', label, '===');
    console.log(JSON.stringify(r.recordset.slice(0, 5), null, 2));
  } catch (e) {
    console.log('\n===', label, 'ERRO ===', e.message);
  }
}

async function main() {
  const pool = await sql.connect(buildIntegraSspMssqlPoolConfig(parseIntegraSspConfig(process.env)));

  await tryQuery(
    pool,
    'prefixos record_file',
    `SELECT DISTINCT LEFT(record_file, 45) AS prefix, COUNT(*) AS c
     FROM PRD_STG_HEFESTO.CHAMADAS WHERE record_file IS NOT NULL
     GROUP BY LEFT(record_file, 45) ORDER BY c DESC`,
  );

  await tryQuery(
    pool,
    'record_file com http',
    `SELECT TOP 5 record_file FROM PRD_STG_HEFESTO.CHAMADAS
     WHERE record_file LIKE 'http%'`,
  );

  await tryQuery(
    pool,
    'tabelas com grav/record',
    `SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_NAME LIKE '%GRAV%' OR TABLE_NAME LIKE '%RECORD%' OR TABLE_NAME LIKE '%AUDIO%'`,
  );

  await pool.close();
}

main().catch(console.error);
