require('dotenv/config');
const { parseIntegraSspConfig } = require('../dist/orion-qualidade/integra-ssp-config');
const { buildIntegraSspMssqlPoolConfig } = require('../dist/orion-qualidade/integra-ssp-mssql.util');
const sql = require('mssql');

async function main() {
  const cfg = parseIntegraSspConfig(process.env);
  const pool = await sql.connect(buildIntegraSspMssqlPoolConfig(cfg));

  const schemas = await pool.request().query(`
    SELECT DISTINCT TABLE_SCHEMA
    FROM INFORMATION_SCHEMA.TABLES
    ORDER BY TABLE_SCHEMA
  `);
  console.log('Schemas INTEGRA_SSP:', schemas.recordset.map((r) => r.TABLE_SCHEMA));

  // Textos distintos usados como natureza (não código)
  const textos = await pool.request().query(`
    SELECT TOP 30 natureza, COUNT(*) AS qtd
    FROM PRD_STG_HEFESTO.OCORRENCIA
    WHERE natureza NOT LIKE 'NAT-%'
      AND natureza IS NOT NULL AND LTRIM(RTRIM(natureza)) <> ''
    GROUP BY natureza
    ORDER BY qtd DESC
  `);
  console.log('\nTop naturezas texto:');
  for (const r of textos.recordset) console.log(`  ${r.qtd}x ${r.natureza}`);

  // Tentar extrair nome canônico da narrativa (linha após "Natureza: NAT-XXXX")
  const canon = await pool.request().query(`
    WITH base AS (
      SELECT
        natureza AS codigo,
        narrativa,
        ROW_NUMBER() OVER (PARTITION BY natureza ORDER BY Id DESC) AS rn
      FROM PRD_STG_HEFESTO.OCORRENCIA
      WHERE natureza LIKE 'NAT-%'
        AND narrativa LIKE '%Natureza:%'
    )
    SELECT TOP 15 codigo, narrativa
    FROM base WHERE rn = 1
    ORDER BY codigo
  `);
  console.log('\nNarrativas amostra por código:');
  for (const row of canon.recordset) {
    const n = String(row.narrativa);
    // Padrões comuns HEFESTO
    const m1 = /Natureza:\s*NAT-\d+\s*\n(?:Descrição:\s*)?(.{1,100})/i.exec(n);
    const m2 = /Natureza:\s*(NAT-\d+)\s*\nDescrição:\s*([^\n]+)/i.exec(n);
    console.log(`\n${row.codigo}:`);
    console.log('  m2:', m2 ? m2[2].trim() : null);
    console.log('  snippet:', n.slice(0, 200).replace(/\n/g, ' | '));
  }

  // Verificar se código aparece em narrativa de registros com natureza texto
  const cross = await pool.request().query(`
    SELECT TOP 5 natureza, LEFT(narrativa, 300) AS narr
    FROM PRD_STG_HEFESTO.OCORRENCIA
    WHERE natureza NOT LIKE 'NAT-%'
      AND narrativa LIKE '%NAT-%'
    ORDER BY Id DESC
  `);
  console.log('\nRegistros texto com NAT na narrativa:', cross.recordset.length);
  for (const r of cross.recordset) console.log(r.natureza, '|', String(r.narr).slice(0, 150));

  await pool.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
