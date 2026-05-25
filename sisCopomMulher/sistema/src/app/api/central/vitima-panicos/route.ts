import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { podeVerCentralVitimaMobile } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { listVictimPanicsForCentral } from "@/server/services/victim-app.service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeVerCentralVitimaMobile(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "80") || 80));
  const rows = await listVictimPanicsForCentral(prisma, limit);

  return NextResponse.json({
    panics: rows.map((p) => ({
      id: p.id,
      createdAt: p.createdAt.toISOString(),
      telefoneDigits: p.telefoneDigits,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracyM: p.accuracyM,
      encaminhamento: p.encaminhamento,
      finalizacao: p.finalizacao,
      acknowledgedAt: p.acknowledgedAt?.toISOString() ?? null,
      cadastro: p.cadastro
        ? { id: p.cadastro.id, nomeVitima: p.cadastro.nomeVitima, telefoneDigits: p.cadastro.telefoneDigits }
        : null,
    })),
  });
}
