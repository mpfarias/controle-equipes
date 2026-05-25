import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { podeVerCentralVitimaMobile } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { listVictimCadastrosForCentral } from "@/server/services/victim-app.service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeVerCentralVitimaMobile(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "80") || 80));
  const rows = await listVictimCadastrosForCentral(prisma, limit);

  return NextResponse.json({
    cadastros: rows.map((c) => ({
      id: c.id,
      createdAt: c.createdAt.toISOString(),
      telefoneDigits: c.telefoneDigits,
      nomeVitima: c.nomeVitima,
      idade: c.idade,
      cpf: c.cpf,
      identidade: c.identidade,
      medidaProtetiva: c.medidaProtetiva,
      enderecoResidencia: c.enderecoResidencia,
      latitude: c.latitude,
      longitude: c.longitude,
      accuracyM: c.accuracyM,
      nomeAgressor: c.nomeAgressor,
      enderecoAgressor: c.enderecoAgressor,
      fotoVitimaNome: c.fotoVitimaNome,
      fotoAgressorNome: c.fotoAgressorNome,
    })),
  });
}
