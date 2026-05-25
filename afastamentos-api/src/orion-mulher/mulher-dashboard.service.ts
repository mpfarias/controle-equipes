import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export type MulherDashboardStats = {
  total: number;
  porRegiao: { name: string; value: number }[];
  porTipoAgressao: { name: string; value: number }[];
  porDesfecho: { name: string; value: number }[];
  porMes: { mes: string; total: number }[];
  revertidasCopomPorMes: { mes: string; total: number }[];
  revertidasCopomTotal: number;
  porOrigem: { name: string; value: number }[];
  meta: {
    criterioTempo: 'dataHora_carimbo_cadastro';
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

const TOP_REGIOES = 12;
const TOP_TIPOS = 5;
const TOP_DESFECHOS = 10;

const REF_MES_SQL = Prisma.sql`to_char(COALESCE("dataHoraOcorrencia", "carimboDataHora", "createdAt"), 'YYYY-MM')`;

const REVERTIDA_TEXTO_SQL = Prisma.sql`(
  LOWER(COALESCE("desfecho", '')) LIKE '%revert%'
  OR LOWER(COALESCE("historicoOcorrencia", '')) LIKE '%revert%'
  OR LOWER(COALESCE("encaminhamentoDetalhes", '')) LIKE '%revert%'
)`;

@Injectable()
export class MulherDashboardService {
  private dashCache = new Map<string, { at: number; data: MulherDashboardStats }>();
  private readonly DASH_CACHE_MS = 120_000;

  constructor(private readonly prisma: PrismaService) {}

  private rangeSuffixSql(range?: { from?: Date; to?: Date }): Prisma.Sql {
    if (!range?.from && !range?.to) return Prisma.empty;
    if (range.from && range.to) {
      return Prisma.sql`AND COALESCE("dataHoraOcorrencia", "carimboDataHora", "createdAt") >= ${range.from} AND COALESCE("dataHoraOcorrencia", "carimboDataHora", "createdAt") <= ${range.to}`;
    }
    if (range.from) {
      return Prisma.sql`AND COALESCE("dataHoraOcorrencia", "carimboDataHora", "createdAt") >= ${range.from}`;
    }
    return Prisma.sql`AND COALESCE("dataHoraOcorrencia", "carimboDataHora", "createdAt") <= ${range.to!}`;
  }

  async computeStats(range?: { from?: Date; to?: Date }): Promise<MulherDashboardStats> {
    const key = `${range?.from?.toISOString() ?? ''}|${range?.to?.toISOString() ?? ''}`;
    const hit = this.dashCache.get(key);
    if (hit && Date.now() - hit.at < this.DASH_CACHE_MS) return hit.data;

    const suf = this.rangeSuffixSql(range);

    const totalRows = await this.prisma.$queryRaw<[{ c: bigint }]>`
      SELECT COUNT(*)::bigint AS c FROM "mulher_ocorrencia" WHERE 1=1 ${suf}
    `;
    const total = Number(totalRows[0]?.c ?? 0n);

    const [regiaoRaw, tipoRaw, desfechoRaw, origemRaw, porMesRaw, revertidasPorMesRaw, revertidasTotalRows] =
      await Promise.all([
        this.prisma.$queryRaw<{ key: string | null; cnt: bigint }[]>`
          SELECT "regiaoAdministrativa" AS key, COUNT(*)::bigint AS cnt
          FROM "mulher_ocorrencia" WHERE 1=1 ${suf}
          GROUP BY "regiaoAdministrativa"
        `,
        this.prisma.$queryRaw<{ key: string | null; cnt: bigint }[]>`
          SELECT "tipoAmeacaAgressao" AS key, COUNT(*)::bigint AS cnt
          FROM "mulher_ocorrencia" WHERE 1=1 ${suf}
          GROUP BY "tipoAmeacaAgressao"
        `,
        this.prisma.$queryRaw<{ key: string | null; cnt: bigint }[]>`
          SELECT "desfecho" AS key, COUNT(*)::bigint AS cnt
          FROM "mulher_ocorrencia" WHERE 1=1 ${suf}
          GROUP BY "desfecho"
        `,
        this.prisma.$queryRaw<{ key: string | null; cnt: bigint }[]>`
          SELECT "origem"::text AS key, COUNT(*)::bigint AS cnt
          FROM "mulher_ocorrencia" WHERE 1=1 ${suf}
          GROUP BY "origem"
        `,
        this.prisma.$queryRaw<{ mes: string; total: bigint }[]>`
          SELECT ${REF_MES_SQL} AS mes, COUNT(*)::bigint AS total
          FROM "mulher_ocorrencia" WHERE 1=1 ${suf}
          GROUP BY ${REF_MES_SQL} ORDER BY mes
        `,
        this.prisma.$queryRaw<{ mes: string; total: bigint }[]>`
          SELECT ${REF_MES_SQL} AS mes, COUNT(*)::bigint AS total
          FROM "mulher_ocorrencia" WHERE 1=1 ${suf} AND ${REVERTIDA_TEXTO_SQL}
          GROUP BY ${REF_MES_SQL} ORDER BY mes
        `,
        this.prisma.$queryRaw<[{ c: bigint }]>`
          SELECT COUNT(*)::bigint AS c FROM "mulher_ocorrencia"
          WHERE 1=1 ${suf} AND ${REVERTIDA_TEXTO_SQL}
        `,
      ]);

    const mapGroup = (rows: { key: string | null; cnt: bigint }[]) =>
      rows
        .map((r) => ({ name: r.key?.trim() || 'Não informado', value: Number(r.cnt) }))
        .sort((a, b) => b.value - a.value);

    const porRegiaoAll = mapGroup(regiaoRaw);
    const porTipoAll = mapGroup(tipoRaw);
    const porDesfechoAll = mapGroup(desfechoRaw);

    const porOrigem = origemRaw.map((r) => ({
      name: r.key === 'IMPORTACAO_EXCEL' ? 'Importação Excel (histórico)' : 'Cadastro no sistema',
      value: Number(r.cnt),
    }));

    const porMes = porMesRaw.map((r) => ({ mes: r.mes, total: Number(r.total) }));
    const revertidasCopomPorMes = revertidasPorMesRaw.map((r) => ({
      mes: r.mes,
      total: Number(r.total),
    }));
    const revertidasCopomTotal = Number(revertidasTotalRows[0]?.c ?? 0n);

    const somaPorMes = porMes.reduce((s, r) => s + r.total, 0);
    const somaPorOrigem = porOrigem.reduce((s, r) => s + r.value, 0);
    const somaRevertidasPorMes = revertidasCopomPorMes.reduce((s, r) => s + r.total, 0);

    const data: MulherDashboardStats = {
      total,
      resumo: {
        categoriasRegiao: porRegiaoAll.length,
        categoriasTipo: porTipoAll.length,
        categoriasDesfecho: porDesfechoAll.length,
      },
      porRegiao: porRegiaoAll.slice(0, TOP_REGIOES),
      porTipoAgressao: porTipoAll.slice(0, TOP_TIPOS),
      porDesfecho: porDesfechoAll.slice(0, TOP_DESFECHOS),
      porMes,
      revertidasCopomPorMes,
      revertidasCopomTotal,
      porOrigem,
      meta: {
        criterioTempo: 'dataHora_carimbo_cadastro',
        somaPorMes,
        somaPorOrigem,
        somaRevertidasPorMes,
        total,
        coerente: somaPorMes === total && somaPorOrigem === total,
      },
    };

    this.dashCache.set(key, { at: Date.now(), data });
    return data;
  }
}
