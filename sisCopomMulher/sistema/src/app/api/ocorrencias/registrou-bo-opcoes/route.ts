import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { podeListarOcorrencias } from "@/lib/roles";
import { listDistinctRegistrouBoDp } from "@/server/services/occurrence-field-options.service";

export const runtime = "nodejs";

/** GET: opções distintas de "Registrou BO na DP?" presentes no banco. */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeListarOcorrencias(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  try {
    const options = await listDistinctRegistrouBoDp();
    return NextResponse.json({ options });
  } catch (e) {
    console.error("registrou-bo-opcoes", e);
    return NextResponse.json(
      { error: "Falha ao listar opções do banco.", options: [] as string[] },
      { status: 500 },
    );
  }
}
