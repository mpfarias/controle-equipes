export default function PesquisarOcorrenciasLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col gap-5 animate-pulse">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/80 pb-5">
        <div className="h-9 w-64 rounded-lg bg-slate-200" />
        <div className="h-7 w-24 rounded-full bg-slate-200" />
      </div>
      <div className="h-28 rounded-xl border border-slate-200 bg-slate-100" />
      <div className="h-10 w-full max-w-xl rounded-lg bg-slate-200" />
      <div className="min-h-[320px] flex-1 rounded-xl border border-slate-200 bg-slate-100" />
      <p className="text-sm text-slate-500">Carregando pesquisa…</p>
    </div>
  );
}
