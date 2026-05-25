import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { podeVerCentralVitimaMobile } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ eventId: string }> };

/** Marca evento como visto na central (operador). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeVerCentralVitimaMobile(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { eventId } = await ctx.params;
  const updated = await prisma.mobileTelemetryEvent.updateMany({
    where: { id: eventId, acknowledgedAt: null },
    data: {
      acknowledgedAt: new Date(),
      acknowledgedById: session.sub,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Evento não encontrado ou já reconhecido." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
