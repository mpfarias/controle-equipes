import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { podeVerCentralVitimaMobile } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { centralVitimaPanicPatchSchema } from "@/lib/victim-app-body";
import { updateVictimPanicDisposition } from "@/server/services/victim-app.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ panicId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeVerCentralVitimaMobile(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { panicId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = centralVitimaPanicPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos.", details: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await updateVictimPanicDisposition(prisma, {
    panicId,
    encaminhamento: parsed.data.encaminhamento,
    finalizacao: parsed.data.finalizacao,
    acknowledged: parsed.data.acknowledged ?? false,
    operatorId: session.sub,
  });

  if (!updated) {
    return NextResponse.json({ error: "Pânico não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    panic: {
      id: updated.id,
      createdAt: updated.createdAt.toISOString(),
      telefoneDigits: updated.telefoneDigits,
      latitude: updated.latitude,
      longitude: updated.longitude,
      accuracyM: updated.accuracyM,
      encaminhamento: updated.encaminhamento,
      finalizacao: updated.finalizacao,
      acknowledgedAt: updated.acknowledgedAt?.toISOString() ?? null,
      cadastro: updated.cadastro,
    },
  });
}
