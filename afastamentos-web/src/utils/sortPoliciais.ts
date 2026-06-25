/**
 * Ordenação de policiais por patente, nome e status.
 * Ordem das patentes (1 = primeiro na lista):
 * 1-CEL, 2-TC, 3-MAJ, 4-CAP, 5-2ºTEN, 6-1ºTEN, 7-ASP, 8-ST,
 * 9-1ºSGT, 10-2ºSGT, 11-3ºSGT, 12-CB, 13-SD, 14-CIVIL
 *
 * Ordem dos status (2º critério): 1-ATIVO, 2-DESIGNADO, 3-PTTC, 4-COMISSIONADO, 99-DESATIVADO/outros
 *
 * As patentes podem estar no início ou em qualquer posição do nome (ex.: "2º SGT M. FARIAS" ou "M. FARIAS 2º SGT").
 * Aceita variações: º, °, ª, ., o (ex.: 2º, 2°, 2ª, 2., 2 SGT).
 */

const STATUS_ORDER: Record<string, number> = {
  ATIVO: 1,
  DESIGNADO: 2,
  PTTC: 3,
  COMISSIONADO: 4,
  DESATIVADO: 99,
};

function getStatusOrder(status: string | { nome?: string } | undefined | null): number {
  if (status == null) return 99;
  const nome = typeof status === 'string' ? status : status?.nome;
  if (!nome) return 99;
  return STATUS_ORDER[String(nome).toUpperCase()] ?? 99;
}

const PATENTE_ORDER: { pattern: RegExp; order: number }[] = [
  { pattern: /\bCEL\b/i, order: 1 },
  { pattern: /\bTC\b/i, order: 2 },
  { pattern: /\bMAJ\b/i, order: 3 },
  { pattern: /\bCAP\b/i, order: 4 },
  { pattern: /\b2[º°ªo.]?\s*TEN\b/i, order: 5 },
  { pattern: /\b1[º°ªo.]?\s*TEN\b/i, order: 6 },
  { pattern: /\bASP\b/i, order: 7 },
  { pattern: /\bSUB\s*TEN\b/i, order: 8 },
  { pattern: /\bSUBTEN\b/i, order: 8 },
  { pattern: /\bST\b/i, order: 8 },
  { pattern: /\b1[º°ªo.]?\s*SGT\b/i, order: 9 },
  { pattern: /\b2[º°ªo.]?\s*SGT\b/i, order: 10 },
  { pattern: /\b3[º°ªo.]?\s*SGT\b/i, order: 11 },
  { pattern: /\bCB\b/i, order: 12 },
  { pattern: /\bSD\b/i, order: 13 },
  { pattern: /\bCIVIL\b/i, order: 14 },
];

const ORDEM_DESCONHECIDA = 99;

/** Ordem 1-7 = Oficiais, 8-13 = Praças, 14 = Civis, 99 = Outros */
export function getPostoFromNome(nome: string): 'oficial' | 'praca' | 'civil' | 'outros' {
  const order = getPatenteOrder(nome);
  if (order >= 1 && order <= 7) return 'oficial';
  if (order >= 8 && order <= 13) return 'praca';
  if (order === 14) return 'civil';
  return 'outros';
}

function getPatenteOrder(nome: string): number {
  const n = String(nome ?? '').trim();
  for (const { pattern, order } of PATENTE_ORDER) {
    if (pattern.test(n)) return order;
  }
  return ORDEM_DESCONHECIDA;
}

/**
 * Compara dois itens por patente (1º critério), status (2º critério) e nome (3º critério).
 * Retorna valor negativo se a < b, positivo se a > b, 0 se iguais.
 */
export function comparePorPatenteENome<T extends { nome: string; status?: string | { nome?: string } | null }>(a: T, b: T): number {
  const ordA = getPatenteOrder(a.nome);
  const ordB = getPatenteOrder(b.nome);
  if (ordA !== ordB) return ordA - ordB;
  const statusA = getStatusOrder(a.status);
  const statusB = getStatusOrder(b.status);
  if (statusA !== statusB) return statusA - statusB;
  return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' });
}

/**
 * Ordenação pela coluna “Status” na lista (ATIVO → DESIGNADO → PTTC → COMISSIONADO → DESATIVADO).
 * Status desconhecidos ficam entre COMISSIONADO e DESATIVADO; empate desempata pelo nome do status.
 */
export function compareColunaStatusPolicial(
  statusA: string | null | undefined,
  statusB: string | null | undefined,
  dir: 'asc' | 'desc',
): number {
  const na = (statusA ?? '').toUpperCase();
  const nb = (statusB ?? '').toUpperCase();
  const ord = (s: string) => STATUS_ORDER[s] ?? 50;
  const diff = dir === 'asc' ? ord(na) - ord(nb) : ord(nb) - ord(na);
  if (diff !== 0) return diff;
  return na.localeCompare(nb, 'pt-BR', { sensitivity: 'base' });
}

/**
 * Ordena array de itens com nome e status (policiais, etc.)
 * por patente, status (Ativo, Designado, PTTC, Comissionado, Desativado) e nome.
 */
export function sortPorPatenteENome<T extends { nome: string; status?: string | { nome?: string } | null }>(itens: T[]): T[] {
  return [...itens].sort(comparePorPatenteENome);
}

/**
 * Ordena array de afastamentos por policial (patente + nome + status do policial).
 */
export function sortAfastamentosPorPatenteENome<T extends { policial: { nome: string; status?: string | { nome?: string } | null } }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => comparePorPatenteENome(a.policial, b.policial));
}

export type PolicialListaOrdenacaoCampo =
  | 'nome'
  | 'postoGraduacao'
  | 'matricula'
  | 'equipe'
  | 'status'
  | 'funcao'
  | 'dataDesligamento';

type PolicialOrdenavelLista = {
  nome: string;
  matricula: string;
  equipe?: string | null;
  status?: string | { nome?: string } | null;
  funcao?: { nome?: string } | null;
  postoGraduacao?: { ordem?: number } | null;
  dataDesativacaoAPartirDe?: string | null;
  desativadoEm?: string | null;
};

function statusEhDesativado(status: string | { nome?: string } | null | undefined): boolean {
  if (status == null) return false;
  const nome = typeof status === 'string' ? status : status?.nome;
  return (nome ?? '').toUpperCase() === 'DESATIVADO';
}

function timestampDataDesligamentoPolicial(p: PolicialOrdenavelLista): number {
  const a = p.dataDesativacaoAPartirDe;
  const b = p.desativadoEm;
  const raw =
    (a != null && String(a).trim() !== '' ? String(a) : null) ??
    (b != null && String(b).trim() !== '' ? String(b) : null);
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

function compareTextoColunaPolicial(a: string, b: string, dir: 'asc' | 'desc', numeric: boolean): number {
  const cmp = a.localeCompare(b, 'pt-BR', { sensitivity: 'base', ...(numeric ? { numeric: true } : {}) });
  return dir === 'asc' ? cmp : -cmp;
}

/** Ordenação de listas de policiais (Efetivo / Livro de Férias): patente no padrão ou coluna escolhida. */
export function sortPoliciaisListaOrdenacao<T extends PolicialOrdenavelLista>(
  itens: T[],
  ordenacao: { campo: PolicialListaOrdenacaoCampo; direcao: 'asc' | 'desc' } | null,
): T[] {
  if (!ordenacao) {
    return [...itens].sort((a, b) => {
      const aDesativado = statusEhDesativado(a.status);
      const bDesativado = statusEhDesativado(b.status);
      if (aDesativado && !bDesativado) return 1;
      if (!aDesativado && bDesativado) return -1;
      return comparePorPatenteENome(a, b);
    });
  }

  return [...itens].sort((a, b) => {
    const dir = ordenacao.direcao;
    if (ordenacao.campo === 'dataDesligamento') {
      const ta = timestampDataDesligamentoPolicial(a);
      const tb = timestampDataDesligamentoPolicial(b);
      if (ta !== tb) {
        return dir === 'desc' ? tb - ta : ta - tb;
      }
      return comparePorPatenteENome(a, b);
    }
    const aDesativado = statusEhDesativado(a.status);
    const bDesativado = statusEhDesativado(b.status);
    if (aDesativado && !bDesativado) return 1;
    if (!aDesativado && bDesativado) return -1;

    if (ordenacao.campo === 'nome') {
      const cmp = comparePorPatenteENome(a, b);
      return dir === 'asc' ? cmp : -cmp;
    }

    let primary = 0;
    if (ordenacao.campo === 'status') {
      const statusA = typeof a.status === 'string' ? a.status : a.status?.nome;
      const statusB = typeof b.status === 'string' ? b.status : b.status?.nome;
      primary = compareColunaStatusPolicial(statusA, statusB, dir);
    } else {
      switch (ordenacao.campo) {
        case 'postoGraduacao': {
          const ordemA = a.postoGraduacao?.ordem ?? 9999;
          const ordemB = b.postoGraduacao?.ordem ?? 9999;
          primary = ordemA - ordemB;
          if (dir === 'desc') primary = -primary;
          break;
        }
        case 'matricula':
          primary = compareTextoColunaPolicial(
            a.matricula.toUpperCase(),
            b.matricula.toUpperCase(),
            dir,
            true,
          );
          break;
        case 'equipe':
          primary = compareTextoColunaPolicial(
            (a.equipe ?? '').toUpperCase(),
            (b.equipe ?? '').toUpperCase(),
            dir,
            false,
          );
          break;
        case 'funcao':
          primary = compareTextoColunaPolicial(
            (a.funcao?.nome ?? '').toUpperCase(),
            (b.funcao?.nome ?? '').toUpperCase(),
            dir,
            false,
          );
          break;
        default:
          return comparePorPatenteENome(a, b);
      }
    }
    if (primary !== 0) return primary;
    return comparePorPatenteENome(a, b);
  });
}
