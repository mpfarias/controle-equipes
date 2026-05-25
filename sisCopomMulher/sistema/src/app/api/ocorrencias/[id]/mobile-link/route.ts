import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { podeAdministrarOcorrencia, podeListarOcorrencias } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { clientIp, clientUa } from "@/lib/request-meta";
import { createOccurrenceMobileLink } from "@/server/services/mobile-vitima.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Gera token de ativação do app móvel da vítima (mostrar/copiar uma vez).
 * Apenas administrador ou atendente com permissão de alterar ocorrências.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeListarOcorrencias(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  if (!podeAdministrarOcorrencia(session.role)) {
    return NextResponse.json({ error: "Sem permissão para gerar link móvel." }, { status: 403 });
  }

  const { id: occurrenceId } = await ctx.params;
  const occ = await prisma.occurrence.findUnique({ where: { id: occurrenceId }, select: { id: true } });
  if (!occ) return NextResponse.json({ error: "Ocorrência não encontrada." }, { status: 404 });

  let label: string | undefined;
  let expiresInDays = 30;
  try {
    const b = await req.json().catch(() => ({}));
    if (typeof b?.label === "string") label = b.label;
    if (typeof b?.expiresInDays === "number" && Number.isFinite(b.expiresInDays)) {
      expiresInDays = Math.floor(b.expiresInDays);
    }
  } catch {
    /* corpo vazio */
  }

  const { link, plainToken, expiresAt } = await createOccurrenceMobileLink(prisma, {
    occurrenceId,
    createdById: session.sub,
    label: label ?? null,
    expiresInDays,
  });

  await registrarAuditoria({
    userId: session.sub,
    acao: "CRIAR_LINK_APP_VITIMA",
    entidade: "OccurrenceMobileLink",
    entidadeId: link.id,
    detalhes: JSON.stringify({ occurrenceId }),
    ip: clientIp(req),
    userAgent: clientUa(req),
  });

  return NextResponse.json({
    linkId: link.id,
    /** Mostrar só neste momento — não fica guardado na base em claro. */
    activationToken: plainToken,
    expiresAt: expiresAt.toISOString(),
    instrucoes:
      "No app da vítima: Configurar URL da API (se ainda não estiver) e colar este código de ativação. Guarde em local seguro; não será exibido de novo.",
  });
}
