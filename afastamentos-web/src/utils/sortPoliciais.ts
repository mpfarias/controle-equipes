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
