"use client";

import { useEffect, useState } from "react";

const PORT = 3001;

/** Duas janelas com hosts diferentes no mesmo PC: isolamento de sessão (operador) vs vítima. */
export function TesteChromeClient() {
  const [thisOrigin, setThisOrigin] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setThisOrigin(window.location.origin);
  }, []);

  const loopback = `http://127.0.0.1:${PORT}`;
  const local = `http://localhost:${PORT}`;

  return (
    <div className="min-h-dvh bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-white">Teste em duas janelas (Chrome)</h1>
        <p className="mt-2 text-sm text-slate-400">
          O Next corre num único processo. <strong>Abra duas janelas</strong> (ou anónima + normal) e use
          <strong> hosts diferentes</strong> para o operador e outro separador (página pública), para não misturar
          cookies. A vítima em operação usa a <strong>app Android</strong> (não o browser).
        </p>
        {thisOrigin ? (
          <p className="mt-1 font-mono text-xs text-amber-200/90">Está a ver esta página em: {thisOrigin}</p>
        ) : null}
        {thisOrigin ? (
          <p className="mt-2 text-sm text-slate-500">
            Simulador (moldura de telemóvel + iframe):{" "}
            <a
              className="text-fuchsia-300 underline-offset-2 hover:underline"
              href={`${thisOrigin}/simulador-celular`}
            >
              {thisOrigin}/simulador-celular
            </a>
          </p>
        ) : null}

        <section className="mt-8 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-violet-300">1 — Recomendado (mesmo PC, dois &quot;hosts&quot;)</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
            <li>
              <strong className="text-white">Janela servidor (operador / COPOM):</strong> abra num separador
            </li>
            <li>
              <strong className="text-white">Janela cliente (vítima / browser):</strong> abra noutro
            </li>
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <a
              className="flex flex-col rounded-2xl border border-violet-500/40 bg-violet-950/50 p-4 transition hover:border-violet-400"
              href={`${loopback}/login`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="text-xs font-bold uppercase text-violet-300">Servidor / operador</span>
              <code className="mt-2 break-all text-sm text-violet-100">{loopback}/login</code>
              <span className="mt-2 text-xs text-slate-400">Login → ocorrências → central em /app/central-vitima</span>
            </a>
            <a
              className="flex flex-col rounded-2xl border border-fuchsia-500/40 bg-fuchsia-950/30 p-4 transition hover:border-fuchsia-400"
              href={`${local}/mobile-vitima`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="text-xs font-bold uppercase text-fuchsia-300">Página pública (informativo)</span>
              <code className="mt-2 break-all text-sm text-fuchsia-100">{local}/mobile-vitima</code>
              <span className="mt-2 text-xs text-slate-400">
                Só texto institucional; fluxo vítima = app <code className="text-fuchsia-200/90">mobile-vitima</code> com
                API em :3001
              </span>
            </a>
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-slate-700/80 bg-slate-900/60 p-4 text-sm text-slate-300">
          <h3 className="text-xs font-bold uppercase text-slate-500">Cópia rápida</h3>
          <p className="mt-2 font-mono text-xs break-all">Servidor: {loopback}/login</p>
          <p className="mt-1 font-mono text-xs break-all">Público: {local}/mobile-vitima</p>
        </section>

        <section className="mt-8 text-xs text-slate-500">
          <p>
            <strong>Telemóvel na mesma Wi-Fi:</strong> operador:{" "}
            <code className="text-slate-400">http://SEU_IP:3001/login</code>. Na <strong>app</strong> vítima, &quot;URL da
            API&quot; = <code className="text-slate-400">http://SEU_IP:3001</code> (substitua SEU_IP — ipconfig). A rota{" "}
            <code className="text-slate-400">/mobile-vitima</code> no browser não substitui o app.
          </p>
        </section>
      </div>
    </div>
  );
}
