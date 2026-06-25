require('dotenv/config');
const { parseIntegraSspConfig } = require('../dist/orion-qualidade/integra-ssp-config');
const { buildIntegraSspMssqlPoolConfig } = require('../dist/orion-qualidade/integra-ssp-mssql.util');
const sql = require('mssql');

async function main() {
  const cfg = parseIntegraSspConfig(process.env);
  const pool = await sql.connect(buildIntegraSspMssqlPoolConfig(cfg));

  const tables = await pool.request().query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'PRD_STG_HEFESTO'
      AND (
        TABLE_NAME LIKE '%NATUREZA%'
        OR TABLE_NAME LIKE '%NAT_%'
        OR TABLE_NAME LIKE '%TIPO%OCOR%'
      )
    ORDER BY TABLE_NAME
  `);
  console.log('Tabelas candidatas (nome):');
  for (const r of tables.recordset) console.log(' ', r.TABLE_NAME);

  const cols = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'PRD_STG_HEFESTO'
      AND (
        COLUMN_NAME LIKE '%natureza%'
        OR COLUMN_NAME LIKE '%NAT%'
        OR COLUMN_NAME LIKE '%descricao%'
        OR COLUMN_NAME LIKE '%desc%'
      )
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);
  console.log('\nColunas candidatas:');
  for (const c of cols.recordset) {
    console.log(`  ${c.TABLE_NAME}.${c.COLUMN_NAME} (${c.DATA_TYPE})`);
  }

  const fk = await pool.request().query(`
    SELECT
      fk.name AS fk_name,
      tp.name AS parent_table,
      cp.name AS parent_column,
      tr.name AS ref_table,
      cr.name AS ref_column
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
    INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
    INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
    INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
    INNER JOIN sys.schemas ps ON tp.schema_id = ps.schema_id
    WHERE ps.name = 'PRD_STG_HEFESTO'
      AND tp.name = 'OCORRENCIA'
  `);
  console.log('\nFKs de OCORRENCIA:');
  for (const r of fk.recordset) {
    console.log(`  ${r.parent_column} -> ${r.ref_table}.${r.ref_column}`);
  }

  const sampleNat = await pool.request().query(`
    SELECT DISTINCT TOP 10 natureza
    FROM PRD_STG_HEFESTO.OCORRENCIA
    WHERE natureza IS NOT NULL AND LTRIM(RTRIM(natureza)) <> ''
    ORDER BY natureza
  `);
  console.log('\nSample códigos natureza em OCORRENCIA:', sampleNat.recordset.map((r) => r.natureza));

  const allTables = await pool.request().query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'PRD_STG_HEFESTO'
    ORDER BY TABLE_NAME
  `);
  console.log('\nTodas as tabelas PRD_STG_HEFESTO (' + allTables.recordset.length + '):');
  for (const r of allTables.recordset) console.log(' ', r.TABLE_NAME);

  // Busca valor NAT-0007 em colunas varchar do schema
  const natSample = 'NAT-0007';
  const varcharCols = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'PRD_STG_HEFESTO'
      AND DATA_TYPE IN ('varchar', 'nvarchar', 'char', 'nchar')
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);
  console.log('\nProcurando', natSample, 'em colunas varchar...');
  let hits = 0;
  for (const c of varcharCols.recordset) {
    if (hits >= 15) break;
    try {
      const q = `
        SELECT TOP 1 *
        FROM PRD_STG_HEFESTO.[${c.TABLE_NAME}]
        WHERE [${c.COLUMN_NAME}] = @val
      `;
      const r = await pool.request().input('val', natSample).query(q);
      if (r.recordset.length > 0) {
        hits++;
        console.log(`\nHIT: ${c.TABLE_NAME}.${c.COLUMN_NAME}`);
        console.log(JSON.stringify(r.recordset[0], null, 2));
      }
    } catch {
      /* ignore */
    }
  }

  await pool.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
