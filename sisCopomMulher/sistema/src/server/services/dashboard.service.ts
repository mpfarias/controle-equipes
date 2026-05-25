/**
 * Modelo de agregações do painel — apenas PostgreSQL (Prisma / SQL).
 * Não lê ficheiros Excel em runtime.
 *
 * Filtro temporal: COALESCE(dataHoraOcorrencia, carimboDataHora, createdAt).
 * Importações Excel não gravam `createdAt` com a data da planilha (fica a data do import);
 * a data operacional está em `dataHoraOcorrencia` / `carimboDataHora`.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DashboardStats = {
  total: number;
  porRegiao: { name: string; value: number }[];
  porTipoAgressao: { name: string; value: number }[];
  porDesfecho: { name: string; value: number }[];
  porMes: { mes: string; total: number }[];
  /** Ocorrências com menção a reversão (texto em desfecho / histórico / encaminhamento), por mês da data de referência. */
  revertidasCopomPorMes: { mes: string; total: number }[];
  revertidasCopomTotal: number;
  porOrigem: { name: string; value: number }[];
  meta: {
    /** Instante usado no filtro de período e nos gráficos mensais. */
    criterioTempo: "dataHora_carimbo_cadastro";
    somaPorMes: number;
    somaPorOrigem: number;
    somaRevertidasPorMes: number;
    total: number;
    coerente: boolean;
  };
  resumo: {
    categoriasRegiao: number;
    categoriasTipo: number;
    categoriasDesfecho: number;
  };
};

function monthBucketsFromSql(rows: { mes: string; total: bigint | number }[]): { mes: string; total: number }[] {
  return rows.map((r) => ({
    mes: r.mes,
    total: typeof r.total === "bigint" ? Number(r.total) : r.total,
  }));
}

/** Sufixo SQL: filtra por instante operacional (planilha ou cadastro). */
function rangeSuffixSql(range?: { from?: Date; to?: Date }): Prisma.Sql {
  if (!range?.from && !range?.to) return Prisma.empty;
  if (range.from && range.to) {
    return Prisma.sql`AND COALESCE("dataHoraOcorrencia", "carimboDataHora", "createdAt") >= ${range.from} AND COALESCE("dataHoraOcorrencia", "carimboDataHora", "createdAt") <= ${range.to}`;
  }
  if (range.from) {
    return Prisma.sql`AND COALESCE("dataHoraOcorrencia", "carimboDataHora", "createdAt") >= ${range.from}`;
  }
  return Prisma.sql`AND COALESCE("dataHoraOcorrencia", "carimboDataHora", "createdAt") <= ${range.to!}`;
}

const REF_MES_SQL = Prisma.sql`to_char(COALESCE("dataHoraOcorrencia", "carimboDataHora", "createdAt"), 'YYYY-MM')`;

/** Identifica reversões tratadas/registadas (planilha ou sistema): texto com "revert" em campos livres. */
const REVERTIDA_TEXTO_SQL = Prisma.sql`(
  LOWER(COALESCE("desfecho", '')) LIKE '%revert%'
  OR LOWER(COALESCE("historicoOcorrencia", '')) LIKE '%revert%'
  OR LOWER(COALESCE("encaminhamentoDetalhes", '')) LIKE '%revert%'
)`;

async function porMesAgregadoSql(range?: { from?: Date; to?: Date }) {
  const suf = rangeSuffixSql(range);
  return prisma.$queryRaw<{ mes: string; total: bigint }[]>`
    SELECT ${REF_MES_SQL} AS mes, COUNT(*)::bigint AS total
    FROM "Occurrence"
    WHERE 1=1 ${suf}
    GROUP BY ${REF_MES_SQL}
    ORDER BY mes
  `;
}

async function revertidasCopomPorMesSql(range?: { from?: Date; to?: Date }) {
  const suf = rangeSuffixSql(range);
  return prisma.$queryRaw<{ mes: string; total: bigint }[]>`
    SELECT ${REF_MES_SQL} AS mes, COUNT(*)::bigint AS total
    FROM "Occurrence"
    WHERE 1=1 ${suf} AND ${REVERTIDA_TEXTO_SQL}
    GROUP BY ${REF_MES_SQL}
    ORDER BY mes
  `;
}

async function countTotal(range?: { from?: Date; to?: Date }): Promise<number> {
  const rows = await prisma.$queryRaw<[{ c: bigint }]>`
    SELECT COUNT(*)::bigint AS c FROM "Occurrence" WHERE 1=1 ${rangeSuffixSql(range)}
  `;
  return Number(rows[0]?.c ?? 0n);
}

type RawGroup = { key: string | null; cnt: bigint };

async function groupByTextColumn(column: string, range?: { from?: Date; to?: Date }): Promise<RawGroup[]> {
  const suf = rangeSuffixSql(range);
  if (column === "regiaoAdministrativa") {
    return prisma.$queryRaw<RawGroup[]>`
      SELECT "regiaoAdministrativa" AS key, COUNT(*)::bigint AS cnt
      FROM "Occurrence"
      WHERE 1=1 ${suf}
      GROUP BY "regiaoAdministrativa"
    `;
  }
  if (column === "tipoAmeacaAgressao") {
    return prisma.$queryRaw<RawGroup[]>`
      SELECT "tipoAmeacaAgressao" AS key, COUNT(*)::bigint AS cnt
      FROM "Occurrence"
      WHERE 1=1 ${suf}
      GROUP BY "tipoAmeacaAgressao"
    `;
  }
  if (column === "desfecho") {
    return prisma.$queryRaw<RawGroup[]>`
      SELECT "desfecho" AS key, COUNT(*)::bigint AS cnt
      FROM "Occurrence"
      WHERE 1=1 ${suf}
      GROUP BY "desfecho"
    `;
  }
  if (column === "origem") {
    return prisma.$queryRaw<RawGroup[]>`
      SELECT "origem"::text AS key, COUNT(*)::bigint AS cnt
      FROM "Occurrence"
      WHERE 1=1 ${suf}
      GROUP BY "origem"
    `;
  }
  return [];
}

async function countRevertidas(range?: { from?: Date; to?: Date }): Promise<number> {
  const rows = await prisma.$queryRaw<[{ c: bigint }]>`
    SELECT COUNT(*)::bigint AS c
    FROM "Occurrence"
    WHERE 1=1 ${rangeSuffixSql(range)} AND ${REVERTIDA_TEXTO_SQL}
  `;
  return Number(rows[0]?.c ?? 0n);
}

const TOP_REGIOES = 12;
const TOP_TIPOS = 5;
const TOP_DESFECHOS = 10;

function sortDescGroups(rows: { name: string; value: number }[]) {
  return [...rows].sort((a, b) => b.value - a.value);
}

type CacheEntry = { at: number; data: DashboardStats };
const DASH_CACHE_MS = 120_000;
const dashCache = new Map<string, CacheEntry>();

function cacheKey(range?: { from?: Date; to?: Date }) {
  const from = range?.from ? range.from.toISOString() : "";
  const to = range?.to ? range.to.toISOString() : "";
  return `${from}|${to}`;
}

export async function computeDashboardStats(range?: { from?: Date; to?: Date }): Promise<DashboardStats> {
  const key = cacheKey(range);
  const hit = dashCache.get(key);
  if (hit && Date.now() - hit.at < DASH_CACHE_MS) {
    return hit.data;
  }

  const [total, regiaoRaw, tipoRaw, desfechoRaw, origemRaw, porMesRaw, revertidasPorMesRaw, revertidasCopomTotal] =
    await Promise.all([
      countTotal(range),
      groupByTextColumn("regiaoAdministrativa", range),
      groupByTextColumn("tipoAmeacaAgressao", range),
      groupByTextColumn("desfecho", range),
      groupByTextColumn("origem", range),
      porMesAgregadoSql(range),
      revertidasCopomPorMesSql(range),
      countRevertidas(range),
    ]);

  const mapGroup = (rows: RawGroup[]) =>
    rows.map((r) => ({
      name: r.key?.trim() || "Não informado",
      value: Number(r.cnt),
    }));

  const porRegiaoAll = sortDescGroups(mapGroup(regiaoRaw));
  const porTipoAll = sortDescGroups(mapGroup(tipoRaw));
  const porDesfechoAll = sortDescGroups(mapGroup(desfechoRaw));
  const porRegiao = porRegiaoAll.slice(0, TOP_REGIOES);
  const porTipoAgressao = porTipoAll.slice(0, TOP_TIPOS);
  const porDesfecho = porDesfechoAll.slice(0, TOP_DESFECHOS);

  const porOrigem = origemRaw.map((r) => ({
    name: r.key === "IMPORTACAO_EXCEL" ? "Importação Excel (histórico)" : "Cadastro no sistema",
    value: Number(r.cnt),
  }));

  const porMes = monthBucketsFromSql(porMesRaw);
  const revertidasCopomPorMes = monthBucketsFromSql(revertidasPorMesRaw);

  const somaPorMes = porMes.reduce((s, r) => s + r.total, 0);
  const somaPorOrigem = porOrigem.reduce((s, r) => s + r.value, 0);
  const somaRevertidasPorMes = revertidasCopomPorMes.reduce((s, r) => s + r.total, 0);
  const coerente = somaPorMes === total && somaPorOrigem === total;

  const data: DashboardStats = {
    total,
    resumo: {
      categoriasRegiao: porRegiaoAll.length,
      categoriasTipo: porTipoAll.length,
      categoriasDesfecho: porDesfechoAll.length,
    },
    porRegiao,
    porTipoAgressao,
    porDesfecho,
    porMes,
    revertidasCopomPorMes,
    revertidasCopomTotal,
    porOrigem,
    meta: {
      criterioTempo: "dataHora_carimbo_cadastro",
      somaPorMes,
      somaPorOrigem,
      somaRevertidasPorMes,
      total,
      coerente,
    },
  };
  dashCache.set(key, { at: Date.now(), data });
  return data;
}
