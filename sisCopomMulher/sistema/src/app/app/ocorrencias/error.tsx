"use client";

export default function OcorrenciasError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/95 p-6 text-slate-900 shadow-md">
      <h2 className="text-lg font-bold text-rose-900">Erro ao carregar ocorrências</h2>
      <p className="mt-2 text-sm text-rose-800">
        O banco de dados (PostgreSQL) ou a sessão falhou. Confira se o servidor está a correr, se a base existe e se{" "}
        <code className="rounded bg-slate-100 px-1">DATABASE_URL</code> está correcta.
      </p>
      <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-white/80 p-3 text-xs text-slate-800 ring-1 ring-rose-100">
        {error.message}
      </pre>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
      >
        Tentar novamente
      </button>
    </div>
  );
}
