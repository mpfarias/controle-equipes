require('dotenv/config');
const { parseIntegraSspConfig } = require('../dist/orion-qualidade/integra-ssp-config');
const { buildIntegraSspMssqlPoolConfig } = require('../dist/orion-qualidade/integra-ssp-mssql.util');
const sql = require('mssql');

async function main() {
  const cfg = parseIntegraSspConfig(process.env);
  const pool = await sql.connect(buildIntegraSspMssqlPoolConfig(cfg));

  const schemas = await pool.request().query(`
    SELECT DISTINCT TABLE_SCHEMA, TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
      AND (
        TABLE_NAME LIKE '%NATUREZA%'
        OR TABLE_NAME LIKE '%NAT_%'
        OR TABLE_NAME LIKE '%TIPO%'
      )
    ORDER BY TABLE_SCHEMA, TABLE_NAME
  `);
  console.log('Tabelas NATUREZA/NAT em todo o banco:');
  for (const r of schemas.recordset) console.log(`  ${r.TABLE_SCHEMA}.${r.TABLE_NAME}`);

  const cols = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME LIKE '%NATUREZA%'
       OR (TABLE_NAME LIKE '%NAT%' AND TABLE_NAME NOT LIKE '%NATIONAL%')
    ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
  `);
  console.log('\nColunas em tabelas natureza:');
  for (const c of cols.recordset) {
    console.log(`  ${c.TABLE_SCHEMA}.${c.TABLE_NAME}.${c.COLUMN_NAME} (${c.DATA_TYPE})`);
  }

  // Sample from each natureza table found
  for (const r of schemas.recordset) {
    try {
      const q = `SELECT TOP 5 * FROM [${r.TABLE_SCHEMA}].[${r.TABLE_NAME}]`;
      const res = await pool.request().query(q);
      console.log(`\n=== ${r.TABLE_SCHEMA}.${r.TABLE_NAME} ===`);
      console.log(JSON.stringify(res.recordset, null, 2));
    } catch (e) {
      console.log(`Erro ${r.TABLE_SCHEMA}.${r.TABLE_NAME}:`, e.message);
    }
  }

  // Extrair descrição da narrativa para códigos NAT-
  const narr = await pool.request().query(`
    SELECT TOP 20 natureza, narrativa
    FROM PRD_STG_HEFESTO.OCORRENCIA
    WHERE natureza LIKE 'NAT-%'
      AND narrativa LIKE '%Descrição:%'
    ORDER BY Id DESC
  `);
  console.log('\nExtração narrativa (NAT-*):');
  for (const row of narr.recordset) {
    const m = /Descri[çc][ãa]o:\s*(.+?)(?:\n|https?:|$)/is.exec(String(row.narrativa ?? ''));
    console.log(`  ${row.natureza} => ${m ? m[1].trim().slice(0, 80) : '(sem match)'}`);
  }

  // Distinct natureza codes vs text
  const mix = await pool.request().query(`
    SELECT
      SUM(CASE WHEN natureza LIKE 'NAT-%' THEN 1 ELSE 0 END) AS codigos,
      SUM(CASE WHEN natureza NOT LIKE 'NAT-%' AND natureza IS NOT NULL AND LTRIM(RTRIM(natureza)) <> '' THEN 1 ELSE 0 END) AS textos
    FROM PRD_STG_HEFESTO.OCORRENCIA
  `);
  console.log('\nMix natureza:', mix.recordset[0]);

  await pool.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
