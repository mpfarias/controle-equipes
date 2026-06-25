/**
 * Testa conexão com integra_ssp e lista tabelas/views (SQL Server ou PostgreSQL).
 * Uso: cd afastamentos-api && node scripts/probe-integra-ssp.cjs
 */
require('dotenv/config');
const { parseIntegraSspConfig } = require('../dist/orion-qualidade/integra-ssp-config');
const { buildIntegraSspMssqlPoolConfig } = require('../dist/orion-qualidade/integra-ssp-mssql.util');

async function main() {
  const cfg = parseIntegraSspConfig(process.env);
  if (!cfg) {
    console.error('Integra SSP não configurado. Defina INTEGRA_SSP_MSSQL_* ou INTEGRA_SSP_DATABASE_URL.');
    process.exit(1);
  }

  console.log('Driver:', cfg.driver);

  if (cfg.driver === 'mssql') {
    const sql = require('mssql');
    const poolCfg = buildIntegraSspMssqlPoolConfig(cfg);
    console.log('TLS serverName:', poolCfg.options.serverName ?? '(hostname TCP)');
    const pool = await sql.connect(poolCfg);
    const db = await pool.request().query('SELECT DB_NAME() AS nome');
    console.log('Conectado ao banco:', db.recordset[0]?.nome);

    const tables = await pool.request().query(`
      SELECT TABLE_SCHEMA AS [schema], TABLE_NAME AS nome, TABLE_TYPE AS tipo
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW')
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    console.log('\nTabelas/views (' + tables.recordset.length + '):');
    for (const row of tables.recordset) {
      const label = `${row.schema}.${row.nome}`;
      if (/chamad|call|fila|atend|telefon|central|ligac/i.test(label)) {
        console.log('  *', label, '(' + row.tipo + ')');
      }
    }
    console.log('\n--- Todas ---');
    for (const row of tables.recordset) {
      console.log(`  ${row.schema}.${row.nome} (${row.tipo})`);
    }
    await pool.close();
    return;
  }

  const { Pool } = require('pg');
  const { buildPgPoolConfig } = require('../dist/pg-pool-config');
  const pool = new Pool(buildPgPoolConfig(cfg.url));
  const db = await pool.query('SELECT current_database() AS nome');
  console.log('Conectado ao banco:', db.rows[0]?.nome);
  const tables = await pool.query(`
    SELECT table_schema AS schema, table_name AS nome, table_type AS tipo
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name
  `);
  console.log('\nTabelas/views (' + tables.rows.length + '):');
  for (const row of tables.rows) {
    console.log(`  ${row.schema}.${row.nome} (${row.tipo})`);
  }
  await pool.end();
}

main().catch((e) => {
  console.error('Falha:', e.message || e);
  process.exit(1);
});
