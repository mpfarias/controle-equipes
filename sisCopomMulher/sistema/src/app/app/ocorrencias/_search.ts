export type OcorrenciasSearch = {
  page: number;
  q?: string;
  id?: string;
  cad?: string;
};

/** Menu inicial (dois atalhos). */
export const OCORRENCIAS_MENU_PATH = "/app/ocorrencias";

/** Listagem + filtros + paginação. */
export const OCORRENCIAS_PESQUISAR_PATH = "/app/ocorrencias/pesquisar";

function first(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export function parseOcorrenciasSearch(sp: Record<string, string | string[] | undefined>): OcorrenciasSearch {
  const pageRaw = first(sp.page);
  const n = Number(pageRaw);
  const page = Math.max(1, Number.isFinite(n) && n > 0 ? Math.floor(n) : 1);
  const q = first(sp.q)?.trim() || undefined;
  const id = first(sp.id)?.trim() || undefined;
  const cad = first(sp.cad)?.trim() || undefined;
  return { page, q, id, cad };
}

/** URL completa da página de pesquisa (query string). */
export function ocorrenciasPesquisarUrl(next: OcorrenciasSearch): string {
  const p = new URLSearchParams();
  if (next.q) p.set("q", next.q);
  if (next.id) p.set("id", next.id);
  if (next.cad) p.set("cad", next.cad);
  if (next.page > 1) p.set("page", String(next.page));
  const s = p.toString();
  return s ? `${OCORRENCIAS_PESQUISAR_PATH}?${s}` : OCORRENCIAS_PESQUISAR_PATH;
}

export type OcorrenciasExportFormat = "csv" | "xlsx" | "pdf";

/** Download exportado (todos os registos que coincidem com os filtros, até ao limite do servidor). */
export function ocorrenciasExportUrl(sp: OcorrenciasSearch, format: OcorrenciasExportFormat): string {
  const p = new URLSearchParams();
  p.set("format", format);
  if (sp.q) p.set("q", sp.q);
  if (sp.id) p.set("id", sp.id);
  if (sp.cad) p.set("cad", sp.cad);
  return `/api/ocorrencias/export?${p.toString()}`;
}
