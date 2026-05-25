import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { podeListarOcorrencias, podeRegistrarOcorrencias } from "@/lib/roles";
import { OCORRENCIAS_PESQUISAR_PATH } from "./_search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export default async function OcorrenciasHubPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login?next=/app/ocorrencias");
  }
  if (!podeListarOcorrencias(session.role)) {
    redirect("/app/dashboard");
  }

  const podeCadastrar = podeRegistrarOcorrencias(session.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ocorrências — violência doméstica</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {podeCadastrar ? (
          <Link
            href="/app/ocorrencias/nova"
            className="group relative overflow-hidden rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-lg shadow-emerald-900/5 ring-1 ring-emerald-100 transition hover:border-emerald-300 hover:shadow-emerald-900/10"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Fase a fase</div>
            <h2 className="mt-2 text-lg font-bold text-slate-900">Nova ocorrência</h2>
            <p className="mt-2 text-sm text-slate-600">
              Assistente com separadores: atendimento inicial → encaminhamento → desfecho final.
            </p>
            <span className="mt-4 inline-flex text-sm font-semibold text-emerald-700 group-hover:underline">
              Abrir cadastro →
            </span>
          </Link>
        ) : null}

        <Link
          href={OCORRENCIAS_PESQUISAR_PATH}
          className="group relative overflow-hidden rounded-2xl border border-fuchsia-200/90 bg-gradient-to-br from-fuchsia-50 to-white p-6 shadow-lg shadow-fuchsia-900/5 ring-1 ring-fuchsia-100 transition hover:border-fuchsia-300 hover:shadow-fuchsia-900/10"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-fuchsia-800">Consulta</div>
          <h2 className="mt-2 text-lg font-bold text-slate-900">Pesquisar e listar</h2>
          <p className="mt-2 text-sm text-slate-600">
            Filtros, paginação, visualização e alterações conforme o seu perfil (administrador ou atendente).
          </p>
          <span className="mt-4 inline-flex text-sm font-semibold text-fuchsia-800 group-hover:underline">
            Ir para listagem →
          </span>
        </Link>
      </div>

      {!podeCadastrar ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          O seu perfil é <strong>consulta</strong>: pode utilizar a listagem e o painel BI; o cadastro de novas
          ocorrências fica reservado a administradores e atendentes.
        </p>
      ) : null}
    </div>
  );
}
