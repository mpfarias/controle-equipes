import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { podeListarOcorrencias } from "@/lib/roles";
import { listOccurrencesForApp } from "@/lib/ocorrencias-list-service";
import { OcorrenciasListaServer } from "../ocorrencias-lista-server";
import { parseOcorrenciasSearch } from "../_search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PesquisarOcorrenciasPage({ searchParams }: PageProps) {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login?next=/app/ocorrencias/pesquisar");
  }
  if (!podeListarOcorrencias(session.role)) {
    redirect("/app/dashboard");
  }

  const raw = await searchParams;
  const sp = parseOcorrenciasSearch(raw ?? {});

  try {
    const data = await listOccurrencesForApp({
      page: sp.page,
      q: sp.q,
      porId: sp.id,
      porCad: sp.cad,
    });
    return <OcorrenciasListaServer data={data} role={session.role} sp={sp} />;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-slate-900 shadow-md">
        <h1 className="text-xl font-bold text-amber-950">Falha ao ligar ao PostgreSQL</h1>
        <p className="mt-2 text-sm text-amber-900">
          Confirme <code className="rounded bg-white px-1">DATABASE_URL</code> no <code className="rounded bg-white px-1">.env</code>, crie a base e rode na pasta{" "}
          <code className="rounded bg-white px-1">sistema</code>: <code className="rounded bg-white px-1">npx prisma db push</code> (ou{" "}
          <code className="rounded bg-white px-1">npx prisma migrate deploy</code>). Depois reinicie o servidor.
        </p>
        <pre className="mt-4 max-h-56 overflow-auto rounded-lg bg-white p-3 text-xs text-slate-800 ring-1 ring-amber-200">
          {msg}
        </pre>
      </div>
    );
  }
}
