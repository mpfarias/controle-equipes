"use client";

import { useState } from "react";

export default function ImportarExcelClient() {
  const [modo, setModo] = useState<"replace" | "append">("replace");
  const [useEnv, setUseEnv] = useState(false);
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [log, setLog] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aCorrer, setACorrer] = useState(false);

  async function enviar() {
    setErro(null);
    setLog(null);
    setACorrer(true);
    try {
      if (useEnv) {
        const res = await fetch("/api/import/excel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ useEnvPath: true, mode: modo }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErro((data as { error?: string }).error || "Falha na importação.");
          return;
        }
        setLog(JSON.stringify(data, null, 2));
        return;
      }
      if (!ficheiro) {
        setErro("Escolha um ficheiro .xlsx ou .xls, ou marque usar EXCEL_PATH no servidor.");
        return;
      }
      const fd = new FormData();
      fd.set("mode", modo);
      fd.set("file", ficheiro);
      const res = await fetch("/api/import/excel", { method: "POST", credentials: "include", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { error?: string }).error || "Falha na importação.");
        return;
      }
      setLog(JSON.stringify(data, null, 2));
    } finally {
      setACorrer(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Importar Excel (sob pedido)</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          O painel, listagens e cadastro usam <strong>só PostgreSQL</strong>. Aqui lê o ficheiro da planilha uma vez e
          grava na base. Modo <strong>substituir</strong> apaga apenas registos com origem &quot;importação Excel&quot;
          anteriores e importa de novo.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-white/70 bg-white/85 p-5 shadow-lg ring-1 ring-white/50">
        <div>
          <label className="block text-sm font-semibold text-slate-800">Modo</label>
          <select
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={modo}
            onChange={(e) => setModo(e.target.value as "replace" | "append")}
          >
            <option value="replace">Substituir importações Excel anteriores (recomendado)</option>
            <option value="append">Acrescentar (pode duplicar dados)</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={useEnv} onChange={(e) => setUseEnv(e.target.checked)} />
          Usar ficheiro do servidor (<code className="text-xs">EXCEL_PATH</code> ou nome padrão nas pastas do projeto)
        </label>

        {!useEnv ? (
          <div>
            <label className="block text-sm font-semibold text-slate-800">Ficheiro local</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="mt-1 block w-full text-sm text-slate-600"
              onChange={(e) => setFicheiro(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs text-slate-500">
              Ficheiros muito grandes: use na pasta <code className="text-xs">sistema</code> o comando{" "}
              <code className="text-xs">npm run import:excel:refresh</code>.
            </p>
          </div>
        ) : null}

        {erro ? <p className="text-sm font-medium text-rose-600">{erro}</p> : null}
        {log ? (
          <pre className="max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-800">{log}</pre>
        ) : null}

        <button
          type="button"
          disabled={aCorrer}
          onClick={() => void enviar()}
          className="w-full rounded-xl bg-fuchsia-700 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-fuchsia-600 disabled:opacity-50"
        >
          {aCorrer ? "A importar…" : "Executar importação"}
        </button>
      </div>
    </div>
  );
}
