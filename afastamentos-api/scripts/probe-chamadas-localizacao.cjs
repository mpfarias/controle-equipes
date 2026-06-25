require('dotenv/config');
const { parseIntegraSspConfig } = require('../dist/orion-qualidade/integra-ssp-config');
const { buildIntegraSspMssqlPoolConfig } = require('../dist/orion-qualidade/integra-ssp-mssql.util');
const sql = require('mssql');

async function main() {
  const cfg = parseIntegraSspConfig(process.env);
  const pool = await sql.connect(buildIntegraSspMssqlPoolConfig(cfg));

  const tables = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'PRD_STG_HEFESTO'
      AND (COLUMN_NAME LIKE '%lat%' OR COLUMN_NAME LIKE '%long%' OR COLUMN_NAME LIKE '%coord%')
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);
  console.log('Colunas lat/long no schema PRD_STG_HEFESTO:');
  for (const r of tables.recordset) {
    console.log(`  ${r.TABLE_NAME}.${r.COLUMN_NAME} (${r.DATA_TYPE})`);
  }

  const ocorCols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'PRD_STG_HEFESTO' AND TABLE_NAME = 'OCORRENCIA'
    ORDER BY ORDINAL_POSITION
  `);
  console.log('\nColunas OCORRENCIA:');
  for (const c of ocorCols.recordset) console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`);

  const sample = await pool.request().query(`
    SELECT TOP 3 *
    FROM PRD_STG_HEFESTO.OCORRENCIA
    WHERE latitude IS NOT NULL OR longitude IS NOT NULL
  `);
  console.log('\nSample OCORRENCIA com coords:', JSON.stringify(sample.recordset, null, 2));

  const joinTest = await pool.request().query(`
    SELECT TOP 5 c.id, c.ramal, o.latitude, o.longitude
    FROM PRD_STG_HEFESTO.CHAMADAS c
    INNER JOIN PRD_STG_HEFESTO.OCORRENCIA o ON o.chamada_id = c.id
    WHERE c.ramal LIKE '71%'
      AND NULLIF(LTRIM(RTRIM(o.latitude)), '') IS NOT NULL
    ORDER BY c.hora_entra_fila DESC
  `);
  console.log('\nJoin CHAMADAS+OCORRENCIA via chamada_id:', JSON.stringify(joinTest.recordset, null, 2));

  const pct = await pool.request().query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN NULLIF(LTRIM(RTRIM(o.latitude)), '') IS NOT NULL THEN 1 ELSE 0 END) AS com_coords
    FROM PRD_STG_HEFESTO.CHAMADAS c
    LEFT JOIN PRD_STG_HEFESTO.OCORRENCIA o ON o.chamada_id = c.id
    WHERE c.ramal LIKE '71%'
      AND c.hora_entra_fila >= CAST(CAST(GETDATE() AS date) AS datetime)
  `);
  console.log('\nHoje ramal 71:', pct.recordset[0]);

  await pool.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
