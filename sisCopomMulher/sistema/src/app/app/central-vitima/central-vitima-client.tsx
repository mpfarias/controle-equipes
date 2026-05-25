"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

export type CentralEventRow = {
  id: string;
  kind: "LOCATION" | "PANIC";
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  createdAt: string;
  acknowledgedAt: string | null;
  deviceInfo: string | null;
  link: {
    id: string;
    label: string | null;
    occurrenceId: string;
    nomeVitima: string | null;
    nomeAgressor: string | null;
    numeroOcorrenciaCad: string | null;
    telefoneVitima: string | null;
  };
};

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function CentralVitimaClient({ initialEvents }: { initialEvents: CentralEventRow[] }) {
  const [events, setEvents] = useState<CentralEventRow[]>(initialEvents);
  const [panicOnly, setPanicOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/central/mobile-events?limit=120`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao carregar.");
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro.");
    } finally {
      setLoading(false);
    }
  }, []);

  const displayed = useMemo(
    () => (panicOnly ? events.filter((e) => e.kind === "PANIC") : events),
    [events, panicOnly],
  );

  async function acknowledge(id: string) {
    setMsg(null);
    try {
      const res = await fetch(`/api/central/mobile-events/${id}`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha.");
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, acknowledgedAt: new Date().toISOString() } : e)),
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={panicOnly} onChange={(e) => setPanicOnly(e.target.checked)} />
            Só pânico
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void refresh()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>
      {msg ? <p className="text-sm text-red-600">{msg}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/90 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Quando</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Vítima / CAD</th>
              <th className="px-3 py-2">Coordenadas</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  {events.length === 0
                    ? "Nenhum evento de telemetria por link registado (fluxo legado)."
                    : "Nenhum evento de pânico nesta lista — desmarque o filtro ou aguarde novos alertas."}
                </td>
              </tr>
            ) : (
              displayed.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 hover:bg-fuchsia-50/40">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-700">
                    {new Date(e.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        e.kind === "PANIC"
                          ? "rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white"
                          : "rounded-full bg-slate-600 px-2 py-0.5 text-xs font-bold text-white"
                      }
                    >
                      {e.kind === "PANIC" ? "PÂNICO" : "Local"}
                    </span>
                  </td>
                  <td className="max-w-[14rem] px-3 py-2 text-slate-800">
                    <div className="font-medium">{e.link.nomeVitima || "—"}</div>
                    <div className="text-xs text-slate-500">CAD: {e.link.numeroOcorrenciaCad || "—"}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    <a
                      href={mapsUrl(e.latitude, e.longitude)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-700 underline"
                    >
                      {e.latitude.toFixed(5)}, {e.longitude.toFixed(5)}
                    </a>
                    {e.accuracyM != null ? <span className="block text-slate-500">±{Math.round(e.accuracyM)} m</span> : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {e.acknowledgedAt ? <span className="text-emerald-700">Visto</span> : <span className="text-amber-700">Novo</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Link
                      href={`/app/ocorrencias/${e.link.occurrenceId}`}
                      className="mr-2 text-xs font-semibold text-brand-700 hover:underline"
                    >
                      Ocorrência
                    </Link>
                    {!e.acknowledgedAt ? (
                      <button
                        type="button"
                        onClick={() => void acknowledge(e.id)}
                        className="text-xs font-semibold text-slate-700 underline"
                      >
                        Marcar visto
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
