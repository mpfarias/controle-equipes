/** Ramais exibidos no Órion Qualidade: somente os que começam com este prefixo (ex.: 7110, 7112). */
export const RAMAL_PREFIXO_QUALIDADE = '71';

export function ramalAtendeFiltroQualidade(ramal: unknown): boolean {
  const t = String(ramal ?? '').trim();
  return t.length > 0 && t.startsWith(RAMAL_PREFIXO_QUALIDADE);
}

/** Cláusula SQL (MSSQL) para filtrar ramal no Integra SSP. */
export const SQL_WHERE_RAMAL_PREFIXO_MSSQL = `
  AND LTRIM(RTRIM(ISNULL(c.ramal, ''))) LIKE '${RAMAL_PREFIXO_QUALIDADE}%'
`.trim();

/** Cláusula SQL (PostgreSQL) para filtrar ramal no Integra SSP. */
export const SQL_WHERE_RAMAL_PREFIXO_POSTGRES = `
  AND TRIM(COALESCE(c.ramal, '')) LIKE '${RAMAL_PREFIXO_QUALIDADE}%'
`.trim();
