"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  createdAt: string;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  detalhes: string | null;
  ip: string | null;
  userAgent: string | null;
  user: { nomeCompleto: string; email: string; role: string } | null;
};

export default function AuditoriaPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const take = 50;

  async function load(nextSkip: number) {
    setErro(null);
    const res = await fetch(`/api/auditoria?take=${take}&skip=${nextSkip}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(data.error || "Sem permissão.");
      setItems([]);
      return;
    }
    setItems(data.items as Row[]);
    setTotal(Number(data.total ?? 0));
    setSkip(Number(data.skip ?? 0));
  }

  useEffect(() => {
    void load(0);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Auditoria do sistema</h1>
        <p className="mt-1 text-sm text-slate-600">
          Registo de ações: utilizador, data, tipo de operação, entidade afetada, IP e navegador (quando disponível).
        </p>
      </div>

      {erro ? <p className="text-sm text-red-600">{erro}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-lg shadow-slate-900/5 backdrop-blur-md ring-1 ring-white/45">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Entidade</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Navegador</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((a) => (
              <tr key={a.id} className="align-top hover:bg-slate-50">
                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-700">{new Date(a.createdAt).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{a.user?.nomeCompleto ?? "—"}</div>
                  <div className="text-xs text-slate-600">{a.user?.email ?? ""}</div>
                  <div className="mt-1 font-mono text-[11px] text-slate-500">{a.user?.role ?? ""}</div>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900">{a.acao}</td>
                <td className="px-4 py-3 text-xs text-slate-700">
                  <div>{a.entidade}</div>
                  {a.entidadeId ? <div className="mt-1 font-mono text-[11px]">{a.entidadeId}</div> : null}
                  {a.detalhes ? (
                    <pre className="mt-2 max-w-md whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700">
                      {a.detalhes}
                    </pre>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{a.ip ?? "—"}</td>
                <td className="px-4 py-3 max-w-xs text-xs text-slate-600">
                  <span className="line-clamp-3 break-all" title={a.userAgent ?? undefined}>
                    {a.userAgent ?? "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-600">
          Mostrando {items.length} de {total}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={skip <= 0}
            onClick={() => void load(Math.max(0, skip - take))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={skip + take >= total}
            onClick={() => void load(skip + take)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
