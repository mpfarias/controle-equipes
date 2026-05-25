import Link from "next/link";
import type { UserRole } from "@prisma/client";
import { indicadoresFasesCadastro, tituloTooltipFase } from "@/lib/ocorrencia-fases-status";
import {
  OCORRENCIAS_EXPORT_MAX,
  OCORRENCIAS_PAGE_SIZE,
  type OcorrenciasListPayload,
} from "@/lib/ocorrencias-list-service";
import { podeAdministrarOcorrencia } from "@/lib/roles";
import { ExcluirOcorrenciaButton } from "./excluir-ocorrencia-button";
import type { OcorrenciasSearch } from "./_search";
import {
  OCORRENCIAS_MENU_PATH,
  OCORRENCIAS_PESQUISAR_PATH,
  ocorrenciasExportUrl,
  ocorrenciasPesquisarUrl,
} from "./_search";

type Data = OcorrenciasListPayload;

/** Data/hora curta numa só linha. */
function dataExibicaoCurta(o: Data["items"][number]) {
  const raw = o.dataHoraOcorrencia ?? o.carimboDataHora ?? o.createdAt;
  if (!raw) return "—";
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CelulaFasesCadastro({ o }: { o: Data["items"][number] }) {
  const inds = indicadoresFasesCadastro(o);
  return (
    <div className="flex max-w-[10.5rem] flex-wrap items-center justify-center gap-0.5 py-0.5">
      {inds.map((ind) => (
        <span
          key={ind.fase}
          title={tituloTooltipFase(ind)}
          className={`inline-flex min-w-[1.35rem] items-center justify-center rounded border px-1 py-px font-mono text-[10px] font-bold tabular-nums ${
            ind.completa
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-amber-400 bg-amber-50 text-amber-900"
          }`}
        >
          {ind.fase}
          {!ind.completa ? "!" : null}
        </span>
      ))}
    </div>
  );
}

function btnNav(active: boolean) {
  if (active) {
    return "inline-flex items-center justify-center rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50";
  }
  return "inline-flex items-center justify-center rounded border border-slate-100 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-400";
}

function BarraExportacao({ sp }: { sp: OcorrenciasSearch }) {
  const pill =
    "inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition";
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Exportar listagem</span>
      <div className="flex flex-wrap gap-2">
        <a
          href={ocorrenciasExportUrl(sp, "csv")}
          className={`${pill} border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100`}
        >
          CSV
        </a>
        <a
          href={ocorrenciasExportUrl(sp, "xlsx")}
          className={`${pill} border-green-600/40 bg-green-50 text-green-900 hover:bg-green-100`}
        >
          Excel
        </a>
        <a
          href={ocorrenciasExportUrl(sp, "pdf")}
          className={`${pill} border-red-400/50 bg-red-50 text-red-900 hover:bg-red-100`}
        >
          PDF
        </a>
      </div>
      <p className="text-[10px] leading-snug text-slate-500 sm:ml-auto sm:max-w-md sm:text-right">
        Usa os mesmos filtros da pesquisa · até{" "}
        <span className="font-semibold text-slate-700">{OCORRENCIAS_EXPORT_MAX.toLocaleString("pt-BR")}</span>{" "}
        linhas por arquivo (por ordem de atualização).
      </p>
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  sp,
  total,
}: {
  page: number;
  totalPages: number;
  sp: OcorrenciasSearch;
  total: number;
}) {
  const mk = (p: number) => ocorrenciasPesquisarUrl({ ...sp, page: p });
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-600">
        <span className="font-semibold text-slate-900">{total.toLocaleString("pt-BR")}</span> registro(s) no banco
        {total > 0 ? (
          <>
            {" "}
            · página <span className="font-mono text-slate-900">{page}</span> de{" "}
            <span className="font-mono text-slate-900">{totalPages}</span>
            <span className="text-slate-400"> · {OCORRENCIAS_PAGE_SIZE} por página</span>
          </>
        ) : null}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {page > 1 ? (
          <Link href={mk(1)} className={btnNav(true)}>
            Primeira
          </Link>
        ) : (
          <span className={btnNav(false)}>Primeira</span>
        )}
        {page > 1 ? (
          <Link href={mk(page - 1)} className={btnNav(true)}>
            Anterior
          </Link>
        ) : (
          <span className={btnNav(false)}>Anterior</span>
        )}
        {page < totalPages ? (
          <Link href={mk(page + 1)} className={btnNav(true)}>
            Próxima
          </Link>
        ) : (
          <span className={btnNav(false)}>Próxima</span>
        )}
        {page < totalPages ? (
          <Link href={mk(totalPages)} className={btnNav(true)}>
            Última
          </Link>
        ) : (
          <span className={btnNav(false)}>Última</span>
        )}
      </div>
    </div>
  );
}

export function OcorrenciasListaServer({
  data,
  role,
  sp,
}: {
  data: Data;
  role: string;
  sp: OcorrenciasSearch;
}) {
  const isAdmin = role === "ADMINISTRADOR";
  const podeCriar = role === "ADMINISTRADOR" || role === "ATENDENTE";
  const podeAdministrar = podeAdministrarOcorrencia(role as UserRole);
  const { items, total, page, totalPages } = data;
  const hasFilters = Boolean(sp.q?.trim() || sp.id?.trim() || sp.cad?.trim());

  const renderEm = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3">
      <div className="rounded-lg border border-violet-600 bg-violet-950 px-3 py-2 text-center text-white shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wide text-violet-200">
          Pesquisa · listagem condensada
        </p>
        <p className="font-mono text-[10px] text-violet-100/80">{renderEm}</p>
      </div>

      <div>
        <Link
          href={OCORRENCIAS_MENU_PATH}
          aria-label="Voltar ao menu"
          title="Voltar ao menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 shadow-sm transition hover:border-fuchsia-300 hover:bg-fuchsia-100 hover:text-fuchsia-950"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 shrink-0"
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      </div>

      <header className="flex shrink-0 flex-col gap-4 border-b border-slate-200/80 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pesquisar ocorrências</h1>
            <span className="rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-fuchsia-900">
              {total.toLocaleString("pt-BR")} total
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          {podeCriar ? (
            <Link
              href="/app/ocorrencias/nova"
              className="inline-flex items-center justify-center rounded-xl bg-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-fuchsia-700"
            >
              Nova ocorrência
            </Link>
          ) : null}
        </div>
      </header>

      <section className="shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form method="get" action={OCORRENCIAS_PESQUISAR_PATH} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label htmlFor="oc-q" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Busca geral
              </label>
              <input
                id="oc-q"
                name="q"
                defaultValue={sp.q ?? ""}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-900 outline-none ring-fuchsia-500/30 focus:border-fuchsia-400 focus:bg-white focus:ring-2"
                placeholder="Vítima, região, CAD, agressor…"
              />
            </div>
            <div className="w-full min-w-[140px] sm:w-44">
              <label htmlFor="oc-cad" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                CAD (contém)
              </label>
              <input
                id="oc-cad"
                name="cad"
                defaultValue={sp.cad ?? ""}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 font-mono text-sm outline-none ring-fuchsia-500/30 focus:border-fuchsia-400 focus:bg-white focus:ring-2"
                placeholder="Trecho do número"
              />
            </div>
            <div className="w-full min-w-[180px] sm:w-56">
              <label htmlFor="oc-id" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                ID (exato)
              </label>
              <input
                id="oc-id"
                name="id"
                defaultValue={sp.id ?? ""}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 font-mono text-xs outline-none ring-fuchsia-500/30 focus:border-fuchsia-400 focus:bg-white focus:ring-2"
                placeholder="cuid completo"
              />
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-fuchsia-700 sm:flex-none"
              >
                Buscar
              </button>
              <Link
                href={OCORRENCIAS_PESQUISAR_PATH}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none"
              >
                Limpar
              </Link>
            </div>
          </div>
          {hasFilters ? (
            <p className="text-xs text-slate-500">
              Filtros ativos —{" "}
              <Link href={OCORRENCIAS_PESQUISAR_PATH} className="font-semibold text-fuchsia-700 hover:underline">
                remover todos
              </Link>
            </p>
          ) : null}
        </form>
      </section>

      {total === 0 && !hasFilters ? (
        <div className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
          <p className="font-medium">Não há ocorrências na base de dados.</p>
          <p className="mt-2 text-amber-900">
            {isAdmin ? (
              <>
                Como administrador, use{" "}
                <Link href="/app/admin/importar-excel" className="font-semibold text-amber-950 underline hover:no-underline">
                  Importar Excel
                </Link>{" "}
                ou <code className="rounded bg-white px-1">npm run import:excel:refresh</code> na pasta{" "}
                <code className="rounded bg-white px-1">sistema</code>, ou{" "}
              </>
            ) : null}
            {podeCriar ? (
              <Link href="/app/ocorrencias/nova" className="font-semibold text-amber-950 underline hover:no-underline">
                registar uma nova ocorrência
              </Link>
            ) : (
              "Peça a um administrador que importe os dados."
            )}
            {podeCriar ? "." : null}
          </p>
        </div>
      ) : null}

      <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2">
        <PaginationBar page={page} totalPages={totalPages} sp={sp} total={total} />
        <BarraExportacao sp={sp} />

        <div className="min-h-0 max-h-[min(68vh,calc(100vh-15rem))] w-full min-w-0 flex-1 overflow-auto rounded-lg border border-slate-400 bg-white shadow-sm">
          <table className="w-max min-w-full border-collapse text-left text-xs leading-tight text-slate-800">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                <th className="whitespace-nowrap border border-slate-300 px-1.5 py-1 pl-2 text-left">Vítima</th>
                <th className="whitespace-nowrap border border-slate-300 px-1.5 py-1 text-center">Região</th>
                <th className="whitespace-nowrap border border-slate-300 px-1.5 py-1 text-center">Data / cadastro</th>
                <th className="whitespace-nowrap border border-slate-300 px-1.5 py-1 text-center">Fases</th>
                <th className="whitespace-nowrap border border-slate-300 px-1.5 py-1 text-center">CAD</th>
                <th className="whitespace-nowrap border border-slate-300 px-1.5 py-1 text-center">Agressor</th>
                <th className="border border-slate-300 px-1.5 py-1 text-left font-semibold normal-case text-slate-700">
                  Descrição da ocorrência
                </th>
                <th className="whitespace-nowrap border border-slate-300 px-1.5 py-1 pr-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o: Data["items"][number]) => {
                const nomeVitimaExibicao =
                  [o.nomeVitima, o.genitoraVitima].find((s) => s && String(s).trim()) ?? null;
                const hist = o.historicoOcorrencia?.trim() || null;
                return (
                  <tr key={o.id} className="group hover:bg-fuchsia-50/40">
                    <td className="whitespace-nowrap border border-slate-300 px-1.5 py-0.5 pl-2 align-middle font-medium text-slate-900">
                      {nomeVitimaExibicao || "—"}
                    </td>
                    <td className="whitespace-nowrap border border-slate-300 px-1.5 py-0.5 text-center align-middle text-slate-700">
                      {o.regiaoAdministrativa || "—"}
                    </td>
                    <td className="whitespace-nowrap border border-slate-300 px-1.5 py-0.5 text-center align-middle font-mono text-[11px] tabular-nums text-slate-600">
                      {dataExibicaoCurta(o)}
                    </td>
                    <td className="border border-slate-300 px-1 py-0.5 text-center align-middle text-slate-800">
                      <div className="flex flex-col items-center gap-0.5">
                        <CelulaFasesCadastro o={o} />
                        <span className="font-mono text-[9px] font-normal tabular-nums text-slate-500" title="Última fase salva no sistema">
                          últ.: {o.faseAtual}
                          {o.concluida ? <span className="text-emerald-600"> ✓</span> : null}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap border border-slate-300 px-1.5 py-0.5 text-center align-middle font-mono text-[11px] text-slate-800">
                      {o.numeroOcorrenciaCad || "—"}
                    </td>
                    <td className="whitespace-nowrap border border-slate-300 px-1.5 py-0.5 text-center align-middle text-slate-700">
                      {o.nomeAgressor || "—"}
                    </td>
                    <td className="min-w-[12rem] max-w-[20rem] border border-slate-300 p-0 align-top">
                      <div className="max-h-20 overflow-y-auto overflow-x-hidden whitespace-normal break-words px-1.5 py-0.5 text-[11px] leading-4 text-slate-700 [scrollbar-gutter:stable]">
                        {hist || "—"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap border border-slate-300 px-1.5 py-0.5 pr-2 align-middle text-right">
                      <div className="flex flex-row flex-nowrap items-center justify-end gap-1">
                        <Link
                          href={`/app/ocorrencias/${o.id}`}
                          className="inline-flex shrink-0 items-center justify-center rounded border border-fuchsia-300 bg-fuchsia-50 px-2 py-1 text-[10px] font-bold text-fuchsia-900 hover:bg-fuchsia-100"
                        >
                          {podeAdministrar ? "Alt." : "Ver"}
                        </Link>
                        {podeAdministrar ? <ExcluirOcorrenciaButton id={o.id} compact /> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 ? (
                <tr>
                  <td className="border border-slate-300 px-2 py-6 text-center text-xs text-slate-600" colSpan={8}>
                    {hasFilters
                      ? "Nenhum registro corresponde aos filtros. Tente outros termos ou limpe a busca."
                      : "Nenhum registro nesta página."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <PaginationBar page={page} totalPages={totalPages} sp={sp} total={total} />
      </section>
    </div>
  );
}
