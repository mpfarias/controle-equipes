/**
 * Intervalo do painel (query `from` / `to` em YYYY-MM-DD), partilhado entre
 * a página servidor e a rota API — uma única definição evita divergências.
 */

export function firstSearchParam(v: string | string[] | null | undefined): string {
  if (v == null) return "";
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** Início do dia no calendário local (evita `new Date("YYYY-MM-DD")` em UTC). */
export function parseLocalDateStart(value: string | null | undefined): Date | undefined {
  if (!value?.trim()) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

/** Fim do dia no calendário local. */
export function parseLocalDateEnd(value: string | null | undefined): Date | undefined {
  if (!value?.trim()) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d, 23, 59, 59, 999);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

export type DashboardRangeResult =
  | { ok: true; range: { from?: Date; to?: Date } | undefined; fromStr: string; toStr: string }
  | { ok: false; error: string; fromStr: string; toStr: string };

/** Converte strings da query em intervalo para `computeDashboardStats`. */
export function resolveDashboardRange(fromStr: string, toStr: string): DashboardRangeResult {
  const from = parseLocalDateStart(fromStr || null);
  const toEnd = parseLocalDateEnd(toStr || null);
  if (fromStr && !from) {
    return { ok: false, error: "Data inicial inválida.", fromStr, toStr };
  }
  if (toStr && !toEnd) {
    return { ok: false, error: "Data final inválida.", fromStr, toStr };
  }
  if (from && toEnd && from.getTime() > toEnd.getTime()) {
    return { ok: false, error: "A data inicial não pode ser posterior à data final.", fromStr, toStr };
  }
  const range = from || toEnd ? { from, to: toEnd } : undefined;
  return { ok: true, range, fromStr, toStr };
}
