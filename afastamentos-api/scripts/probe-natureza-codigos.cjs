require('dotenv/config');
const { parseIntegraSspConfig } = require('../dist/orion-qualidade/integra-ssp-config');
const { buildIntegraSspMssqlPoolConfig } = require('../dist/orion-qualidade/integra-ssp-mssql.util');
const sql = require('mssql');

async function main() {
  const cfg = parseIntegraSspConfig(process.env);
  const pool = await sql.connect(buildIntegraSspMssqlPoolConfig(cfg));

  // Códigos distintos
  const codes = await pool.request().query(`
    SELECT DISTINCT natureza AS codigo
    FROM PRD_STG_HEFESTO.OCORRENCIA
    WHERE natureza LIKE 'NAT-%'
    ORDER BY natureza
  `);
  console.log('Total códigos NAT-* distintos:', codes.recordset.length);

  // Para cada código, tentar achar ocorrência com texto descritivo na narrativa (padrão HEFESTO)
  const sample = await pool.request().query(`
    SELECT TOP 30
      o.natureza AS codigo,
      o.narrativa,
      LEN(o.narrativa) AS len_narr
    FROM PRD_STG_HEFESTO.OCORRENCIA o
    WHERE o.natureza LIKE 'NAT-%'
      AND o.narrativa LIKE '%Natureza:%'
      AND o.narrativa LIKE '%Descrição:%'
    ORDER BY o.Id DESC
  `);

  const map = new Map();
  for (const row of sample.recordset) {
    if (map.has(row.codigo)) continue;
    const nat = String(row.narrativa);
    const descMatch = /Descri[çc][ãa]o:\s*([\s\S]+?)(?:\n\n|\nhttps?:|\nAtendente:|$)/i.exec(nat);
    map.set(row.codigo, descMatch ? descMatch[1].trim().slice(0, 120) : null);
  }
  console.log('\nMapa parcial código -> descrição (da narrativa):');
  for (const [k, v] of map) console.log(`  ${k}: ${v ?? '?'}`);

  // Ver se existe ocorrência com natureza TEXTO que corresponda ao mesmo protocolo/padrão
  const cross = await pool.request().query(`
    SELECT TOP 10 natureza
    FROM PRD_STG_HEFESTO.OCORRENCIA
    WHERE natureza NOT LIKE 'NAT-%'
      AND natureza LIKE '%veículo%'
    ORDER BY Id DESC
  `);
  console.log('\nExemplos natureza texto:', cross.recordset.map((r) => r.natureza));

  // Buscar em outros bancos linkados?
  const dbs = await pool.request().query(`SELECT name FROM sys.databases ORDER BY name`);
  console.log('\nBancos no servidor:', dbs.recordset.map((r) => r.name).join(', '));

  await pool.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
