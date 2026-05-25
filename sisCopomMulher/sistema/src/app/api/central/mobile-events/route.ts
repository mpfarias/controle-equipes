import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { podeVerCentralVitimaMobile } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { listCentralMobileEvents } from "@/server/services/mobile-vitima.service";

export const runtime = "nodejs";

/** Lista eventos recentes (localização / pânico) recebidos dos apps das vítimas. */
export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeVerCentralVitimaMobile(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const panicOnly = sp.get("panicOnly") === "1" || sp.get("panicOnly") === "true";
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") ?? "80") || 80));

  const events = await listCentralMobileEvents(prisma, { limit, panicOnly });

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      kind: e.kind,
      latitude: e.latitude,
      longitude: e.longitude,
      accuracyM: e.accuracyM,
      createdAt: e.createdAt.toISOString(),
      acknowledgedAt: e.acknowledgedAt?.toISOString() ?? null,
      deviceInfo: e.deviceInfo,
      link: {
        id: e.link.id,
        label: e.link.label,
        occurrenceId: e.link.occurrence.id,
        nomeVitima: e.link.occurrence.nomeVitima,
        nomeAgressor: e.link.occurrence.nomeAgressor,
        numeroOcorrenciaCad: e.link.occurrence.numeroOcorrenciaCad,
        telefoneVitima: e.link.occurrence.telefoneVitima,
      },
    })),
  });
}
