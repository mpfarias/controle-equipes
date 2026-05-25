"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { DashboardStats } from "@/server/services/dashboard.service";

const DashboardCharts = dynamic(() => import("@/components/DashboardCharts"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-600">Carregando gráficos…</div>
  ),
});

export type DashboardShellProps = {
  fromStr: string;
  toStr: string;
  stats: DashboardStats | null;
  rangeError: string | null;
  /** URL veio com `?periodo=todos` (todo o período explícito). */
  periodoTodos?: boolean;
};

function buildDashboardHref(from: string, to: string) {
  const f = from.trim();
  const t = to.trim();
  if (!f && !t) return "/app/dashboard?periodo=todos";
  const p = new URLSearchParams();
  if (f) p.set("from", f);
  if (t) p.set("to", t);
  return `/app/dashboard?${p.toString()}`;
}

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function DashboardShell({ fromStr, toStr, stats, rangeError, periodoTodos = false }: DashboardShellProps) {
  const filterKey = `${periodoTodos ? "todos" : ""}|${fromStr}|${toStr}`;

  /**
   * Navegação completa: o `router.replace` do App Router pode não voltar a executar o Server
   * Component quando só muda a query string, mantendo totais/gráficos antigos. Um pedido HTTP
   * normal garante que `searchParams` e o `computeDashboardStats` corram de novo.
   */
  const navigateRange = (nextFrom: string, nextTo: string) => {
    const f = nextFrom.trim();
    const t = nextTo.trim();
    window.location.assign(buildDashboardHref(f, t));
  };

  const periodoLabel = useMemo(() => {
    if (periodoTodos) return "Todo o período";
    if (!fromStr && !toStr) return "Todo o período";
    if (fromStr && toStr) return `${fromStr} → ${toStr}`;
    if (fromStr) return `Desde ${fromStr}`;
    return `Até ${toStr}`;
  }, [fromStr, toStr, periodoTodos]);

  const aplicarPreset = (tipo: "7d" | "30d" | "mes" | "ano" | "limpar") => {
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    if (tipo === "limpar") {
      navigateRange("", "");
      return;
    }
    if (tipo === "7d") {
      navigateRange(toYMD(addDays(hoje, -6)), toYMD(hoje));
      return;
    }
    if (tipo === "30d") {
      navigateRange(toYMD(addDays(hoje, -29)), toYMD(hoje));
      return;
    }
    if (tipo === "mes") {
      navigateRange(toYMD(startOfMonth(hoje)), toYMD(hoje));
      return;
    }
    navigateRange(toYMD(startOfYear(hoje)), toYMD(hoje));
  };

  function onChangeFrom(v: string) {
    if (v && toStr && v > toStr) navigateRange(v, v);
    else navigateRange(v, toStr);
  }

  function onChangeTo(v: string) {
    if (fromStr && v && fromStr > v) navigateRange(v, v);
    else navigateRange(fromStr, v);
  }

  const presetBtn =
    "rounded-lg border border-white/60 bg-white/50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-fuchsia-300/70 hover:bg-white/85 hover:text-fuchsia-950";

  const totalDisplay = stats?.total != null ? stats.total.toLocaleString("pt-BR") : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="bg-gradient-to-r from-slate-900 via-fuchsia-900 to-violet-900 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            Painel analítico (BI)
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Indicadores e distribuições conforme o intervalo de datas abaixo.</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/70 p-4 shadow-lg shadow-slate-900/5 ring-1 ring-white/50 backdrop-blur-md sm:p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/45 to-transparent" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Período rápido</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={presetBtn} onClick={() => aplicarPreset("7d")}>
                    Últimos 7 dias
                  </button>
                  <button type="button" className={presetBtn} onClick={() => aplicarPreset("30d")}>
                    Últimos 30 dias
                  </button>
                  <button type="button" className={presetBtn} onClick={() => aplicarPreset("mes")}>
                    Este mês
                  </button>
                  <button type="button" className={presetBtn} onClick={() => aplicarPreset("ano")}>
                    Ano em curso
                  </button>
                  <button
                    type="button"
                    className={`${presetBtn} border-dashed border-slate-300/90 text-slate-500 hover:text-slate-800`}
                    onClick={() => aplicarPreset("limpar")}
                  >
                    Todo o período
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3 sm:gap-4">
                <div className="min-w-[10.5rem]">
                  <label htmlFor="dash-from" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Data inicial
                  </label>
                  <input
                    id="dash-from"
                    type="date"
                    value={fromStr}
                    onChange={(e) => onChangeFrom(e.target.value)}
                    onFocus={(e) => {
                      if ("showPicker" in e.currentTarget) {
                        try {
                          e.currentTarget.showPicker();
                        } catch {
                          /* sem suporte no browser */
                        }
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-white/80 bg-white/85 px-3 py-2 text-sm text-slate-900 shadow-sm backdrop-blur-sm outline-none ring-slate-900/5 transition focus:border-fuchsia-400/70 focus:ring-2 focus:ring-fuchsia-200/80"
                  />
                </div>
                <div className="min-w-[10.5rem]">
                  <label htmlFor="dash-to" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Data final
                  </label>
                  <input
                    id="dash-to"
                    type="date"
                    value={toStr}
                    onChange={(e) => onChangeTo(e.target.value)}
                    onFocus={(e) => {
                      if ("showPicker" in e.currentTarget) {
                        try {
                          e.currentTarget.showPicker();
                        } catch {
                          /* sem suporte no browser */
                        }
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-white/80 bg-white/85 px-3 py-2 text-sm text-slate-900 shadow-sm backdrop-blur-sm outline-none ring-slate-900/5 transition focus:border-fuchsia-400/70 focus:ring-2 focus:ring-fuchsia-200/80"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Período por <span className="font-semibold text-slate-700">data e hora da ocorrência</span> na planilha; se estiver em
                branco, usa-se o carimbo da planilha e, em último caso, a data de cadastro no sistema.
              </p>
            </div>
            <div className="shrink-0 rounded-xl border border-fuchsia-200/60 bg-gradient-to-br from-fuchsia-50/90 to-violet-50/80 px-4 py-3 text-right shadow-inner ring-1 ring-fuchsia-100/80">
              <p className="text-[10px] font-bold uppercase tracking-wide text-fuchsia-800/90">Período ativo</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{periodoLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {rangeError ? <p className="text-sm font-medium text-rose-600">{rangeError}</p> : null}

      <div className="mx-auto max-w-md transition-opacity duration-200">
        <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/75 p-4 text-center shadow-lg shadow-slate-900/5 backdrop-blur-md ring-1 ring-white/50">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total de registros</div>
          <div
            key={`total-${filterKey}-${totalDisplay}`}
            className="mt-2 bg-gradient-to-br from-slate-900 to-fuchsia-900 bg-clip-text text-3xl font-bold tracking-tight text-transparent"
          >
            {totalDisplay}
          </div>
        </div>
      </div>

      {stats ? (
        <div className="transition-opacity duration-200 opacity-100">
          <DashboardCharts key={filterKey} stats={stats} />
        </div>
      ) : null}
    </div>
  );
}
