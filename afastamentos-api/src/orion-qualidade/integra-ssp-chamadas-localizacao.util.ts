import type { IntegraSspPoolService } from './integra-ssp-pool.service';

export type LocalizacaoChamadaIntegra = {
  chamada_id: number;
  latitude: string;
  longitude: string;
};

const CHUNK_IDS = 500;

function idsUnicosValidos(ids: number[]): number[] {
  const out = new Set<number>();
  for (const raw of ids) {
    const n = Number(raw);
    if (Number.isInteger(n) && n > 0) out.add(n);
  }
  return [...out];
}

/** Busca latitude/longitude em lote (OCORRENCIA) para os IDs informados. */
export async function buscarLocalizacoesPorChamadaIds(
  pool: IntegraSspPoolService,
  ids: number[],
): Promise<Map<number, { latitude: string; longitude: string }>> {
  const map = new Map<number, { latitude: string; longitude: string }>();
  const unicos = idsUnicosValidos(ids);
  if (unicos.length === 0) return map;

  const driver = pool.getDriver();
  for (let i = 0; i < unicos.length; i += CHUNK_IDS) {
    const chunk = unicos.slice(i, i + CHUNK_IDS);
    const rows =
      driver === 'postgres'
        ? await buscarChunkPostgres(pool, chunk)
        : await buscarChunkMssql(pool, chunk);
    for (const row of rows) {
      const lat = String(row.latitude ?? '').trim();
      const lng = String(row.longitude ?? '').trim();
      if (!lat || !lng) continue;
      map.set(row.chamada_id, { latitude: lat, longitude: lng });
    }
  }
  return map;
}

async function buscarChunkMssql(
  pool: IntegraSspPoolService,
  chunk: number[],
): Promise<LocalizacaoChamadaIntegra[]> {
  const params: Record<string, number> = {};
  const placeholders = chunk.map((id, idx) => {
    const key = `id${idx}`;
    params[key] = id;
    return `@${key}`;
  });
  const sql = `
    SELECT chamada_id, latitude, longitude
    FROM (
      SELECT o.chamada_id, o.latitude, o.longitude,
        ROW_NUMBER() OVER (PARTITION BY o.chamada_id ORDER BY o.Id DESC) AS rn
      FROM PRD_STG_HEFESTO.OCORRENCIA o
      WHERE o.chamada_id IN (${placeholders.join(', ')})
        AND NULLIF(LTRIM(RTRIM(o.latitude)), '') IS NOT NULL
        AND NULLIF(LTRIM(RTRIM(o.longitude)), '') IS NOT NULL
    ) x
    WHERE x.rn = 1
  `;
  return pool.queryRows<LocalizacaoChamadaIntegra>(sql, params);
}

async function buscarChunkPostgres(
  pool: IntegraSspPoolService,
  chunk: number[],
): Promise<LocalizacaoChamadaIntegra[]> {
  const params: Record<string, number> = {};
  const placeholders = chunk.map((id, idx) => {
    const key = `id${idx}`;
    params[key] = id;
    return `$${idx + 1}`;
  });
  const sql = `
    SELECT chamada_id, latitude, longitude
    FROM (
      SELECT o.chamada_id, o.latitude, o.longitude,
        ROW_NUMBER() OVER (PARTITION BY o.chamada_id ORDER BY o."Id" DESC) AS rn
      FROM "PRD_STG_HEFESTO"."OCORRENCIA" o
      WHERE o.chamada_id IN (${placeholders.join(', ')})
        AND NULLIF(TRIM(o.latitude), '') IS NOT NULL
        AND NULLIF(TRIM(o.longitude), '') IS NOT NULL
    ) x
    WHERE x.rn = 1
  `;
  return pool.queryRows<LocalizacaoChamadaIntegra>(sql, params);
}
