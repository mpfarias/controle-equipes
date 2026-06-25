require('dotenv/config');
const { parseIntegraSspConfig } = require('../dist/orion-qualidade/integra-ssp-config');
const { buildIntegraSspMssqlPoolConfig } = require('../dist/orion-qualidade/integra-ssp-mssql.util');
const sql = require('mssql');

const DBS = ['hefesto_2', 'OCORRENCIA', 'INTEGRA_SSP'];

async function probeDb(pool, dbName) {
  console.log(`\n========== ${dbName} ==========`);
  try {
    const tables = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM [${dbName}].INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND (
          TABLE_NAME LIKE '%NATUREZA%'
          OR TABLE_NAME LIKE '%NAT_%'
          OR TABLE_NAME LIKE '%TIPO%OCOR%'
          OR TABLE_NAME LIKE '%DOMINIO%'
        )
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    if (tables.recordset.length === 0) {
      console.log('  (nenhuma tabela natureza por nome)');
    }
    for (const t of tables.recordset) {
      console.log(`  ${t.TABLE_SCHEMA}.${t.TABLE_NAME}`);
      try {
        const sample = await pool.request().query(`
          SELECT TOP 3 * FROM [${dbName}].[${t.TABLE_SCHEMA}].[${t.TABLE_NAME}]
        `);
        console.log(JSON.stringify(sample.recordset, null, 2));
      } catch (e) {
        console.log('  erro sample:', e.message);
      }
    }

    // Colunas com codigo/sigla NAT
    const cols = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME
      FROM [${dbName}].INFORMATION_SCHEMA.COLUMNS
      WHERE COLUMN_NAME LIKE '%natureza%'
         OR COLUMN_NAME LIKE '%codigo%'
         OR COLUMN_NAME LIKE '%sigla%'
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);
    const seen = new Set();
    for (const c of cols.recordset) {
      const k = `${c.TABLE_SCHEMA}.${c.TABLE_NAME}`;
      if (seen.has(k)) continue;
      if (!c.TABLE_NAME.toUpperCase().includes('NAT') && !c.COLUMN_NAME.toLowerCase().includes('natureza')) continue;
      seen.add(k);
      console.log(`  col: ${k}.${c.COLUMN_NAME}`);
    }

    // Buscar NAT-0007 em qualquer tabela do banco
    const allTables = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM [${dbName}].INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
    `);
    let hits = 0;
    for (const t of allTables.recordset) {
      if (hits >= 5) break;
      const vcols = await pool.request().query(`
        SELECT COLUMN_NAME FROM [${dbName}].INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${t.TABLE_SCHEMA}' AND TABLE_NAME = '${t.TABLE_NAME}'
          AND DATA_TYPE IN ('varchar','nvarchar','char','nchar')
      `);
      for (const vc of vcols.recordset) {
        try {
          const r = await pool.request().input('val', 'NAT-0007').query(`
            SELECT TOP 1 * FROM [${dbName}].[${t.TABLE_SCHEMA}].[${t.TABLE_NAME}]
            WHERE [${vc.COLUMN_NAME}] = @val
          `);
          if (r.recordset.length > 0) {
            hits++;
            console.log(`\n  HIT NAT-0007: ${t.TABLE_SCHEMA}.${t.TABLE_NAME}.${vc.COLUMN_NAME}`);
            console.log(JSON.stringify(r.recordset[0], null, 2));
            break;
          }
        } catch {
          /* ignore */
        }
      }
    }
  } catch (e) {
    console.log('  ERRO:', e.message);
  }
}

async function main() {
  const cfg = parseIntegraSspConfig(process.env);
  const pool = await sql.connect(buildIntegraSspMssqlPoolConfig(cfg));
  for (const db of DBS) await probeDb(pool, db);
  await pool.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
