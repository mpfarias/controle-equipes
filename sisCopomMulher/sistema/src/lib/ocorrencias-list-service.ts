import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Menos linhas por página = menor payload e render mais fluida. */
export const OCORRENCIAS_PAGE_SIZE = 25;

/** Limite de linhas por ficheiro exportado (CSV / Excel / PDF). */
export const OCORRENCIAS_EXPORT_MAX = 20_000;

/** Campos da listagem; histórico vem completo na mesma query (sem truncar na UI). */
export const occurrenceListSelect = {
  id: true,
  faseAtual: true,
  concluida: true,
  nomeVitima: true,
  genitoraVitima: true,
  nomeAgressor: true,
  regiaoAdministrativa: true,
  dataHoraOcorrencia: true,
  carimboDataHora: true,
  numeroOcorrenciaCad: true,
  updatedAt: true,
  createdAt: true,
  historicoOcorrencia: true,
  /** Campos para indicador de preenchimento por fase (ver ocorrencia-fases-status). */
  cpfVitima: true,
  dataNascimentoVitima: true,
  enderecoVitima: true,
  telefoneVitima: true,
  pontoReferencia: true,
  enderecoAgressor: true,
  parentescoAgressorVitima: true,
  tipoAmeacaAgressao: true,
  agressorEnvolvimento: true,
  idadeAgressor: true,
  comandanteViatura: true,
  responsavelAtendimento: true,
  encaminhamentoDetalhes: true,
  desfecho: true,
  registrouBoDp: true,
} as const;

export type OcorrenciaListaRow = Omit<
  Prisma.OccurrenceGetPayload<{ select: typeof occurrenceListSelect }>,
  "historicoOcorrencia"
> & {
  historicoOcorrencia: string | null;
};

type CountCacheEntry = { at: number; total: number };
const COUNT_TTL_MS = 120_000;
const countCache = new Map<string, CountCacheEntry>();

type ListPayload = {
  items: OcorrenciaListaRow[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  skip: number;
};
type ListCacheEntry = { at: number; data: ListPayload };
const LIST_TTL_MS = 45_000;
const listCache = new Map<string, ListCacheEntry>();

function stableWhereKey(where: Prisma.OccurrenceWhereInput | undefined) {
  if (!where) return "__all__";
  return JSON.stringify(where);
}

export function buildOccurrenceWhere(
  q?: string | null,
  porId?: string | null,
  porCad?: string | null,
): Prisma.OccurrenceWhereInput | undefined {
  const id = porId?.trim();
  const cad = porCad?.trim();
  const term = q?.trim();
  if (id) return { id };
  if (cad) return { numeroOcorrenciaCad: { contains: cad } };
  if (term) {
    const ic = { contains: term, mode: "insensitive" as const };
    // "historicoOcorrencia" com contains em texto longo é caro; usa só em termos maiores.
    const useHistorico = term.length >= 6;
    return {
      OR: [
        { nomeVitima: ic },
        { genitoraVitima: ic },
        { nomeAgressor: ic },
        { numeroOcorrenciaCad: ic },
        { regiaoAdministrativa: ic },
        { tipoAmeacaAgressao: ic },
        { desfecho: ic },
        ...(useHistorico ? [{ historicoOcorrencia: ic }] : []),
      ],
    };
  }
  return undefined;
}

export async function listOccurrencesForApp(params: {
  page: number;
  q?: string;
  porId?: string;
  porCad?: string;
}) {
  const listKey = JSON.stringify({
    page: Math.max(1, Math.floor(params.page) || 1),
    q: params.q?.trim() ?? "",
    porId: params.porId?.trim() ?? "",
    porCad: params.porCad?.trim() ?? "",
  });
  const listHit = listCache.get(listKey);
  if (listHit && Date.now() - listHit.at < LIST_TTL_MS) {
    return listHit.data;
  }

  const where = buildOccurrenceWhere(params.q, params.porId, params.porCad);
  const whereKey = stableWhereKey(where);
  const cached = countCache.get(whereKey);
  let total: number;
  if (cached && Date.now() - cached.at < COUNT_TTL_MS) {
    total = cached.total;
  } else {
    total = await prisma.occurrence.count({ where });
    countCache.set(whereKey, { at: Date.now(), total });
  }
  const totalPages = Math.max(1, Math.ceil(total / OCORRENCIAS_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(params.page) || 1), totalPages);
  const skip = (page - 1) * OCORRENCIAS_PAGE_SIZE;

  const items: OcorrenciaListaRow[] = await prisma.occurrence.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: OCORRENCIAS_PAGE_SIZE,
    skip,
    select: occurrenceListSelect,
  });

  const data = {
    items,
    total,
    page,
    totalPages,
    pageSize: OCORRENCIAS_PAGE_SIZE,
    skip,
  };
  listCache.set(listKey, { at: Date.now(), data });
  return data;
}

export type OcorrenciasListPayload = Awaited<ReturnType<typeof listOccurrencesForApp>>;

export async function listOccurrencesForExport(params: {
  q?: string;
  porId?: string;
  porCad?: string;
}) {
  const where = buildOccurrenceWhere(params.q, params.porId, params.porCad);
  const totalMatching = await prisma.occurrence.count({ where });
  const rows: OcorrenciaListaRow[] = await prisma.occurrence.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: OCORRENCIAS_EXPORT_MAX,
    select: occurrenceListSelect,
  });
  return {
    rows,
    totalMatching,
    truncated: totalMatching > OCORRENCIAS_EXPORT_MAX,
  };
}
