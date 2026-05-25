import Link from "next/link";
import { OcorrenciaWizard } from "@/components/OcorrenciaWizard";
import { getSessionFromCookies } from "@/lib/auth";
import { OCORRENCIAS_MENU_PATH } from "../_search";

export default async function NovaOcorrenciaPage() {
  const session = await getSessionFromCookies();
  const sessionIsAdmin = session?.role === "ADMINISTRADOR";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Nova ocorrência</h1>
          <p className="mt-1 text-sm text-slate-600">Preencha as 3 fases e salve ao final de cada etapa.</p>
        </div>
        <Link href={OCORRENCIAS_MENU_PATH} className="text-sm font-semibold text-brand-700 hover:underline">
          Voltar
        </Link>
      </div>
      <OcorrenciaWizard sessionIsAdmin={sessionIsAdmin} />
    </div>
  );
}
