import Link from "next/link";
import { OcorrenciaWizard } from "@/components/OcorrenciaWizard";
import { getSessionFromCookies } from "@/lib/auth";
import { OCORRENCIAS_PESQUISAR_PATH } from "../_search";

export default async function EditarOcorrenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromCookies();
  const sessionIsAdmin = session?.role === "ADMINISTRADOR";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Editar ocorrência</h1>
          <p className="mt-1 text-sm text-slate-600">Atualize qualquer fase e salve novamente.</p>
        </div>
        <Link href={OCORRENCIAS_PESQUISAR_PATH} className="text-sm font-semibold text-brand-700 hover:underline">
          Voltar à listagem
        </Link>
      </div>
      <OcorrenciaWizard occurrenceId={id} sessionIsAdmin={sessionIsAdmin} />
    </div>
  );
}
