import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mobileCorsOptionsResponse, withMobileCors } from "@/lib/mobile-cors";
import { victimAppCadastroCarregarSchema } from "@/lib/victim-app-body";
import { getLatestVictimCadastroByPhone } from "@/server/services/victim-app.service";

export const runtime = "nodejs";

export async function OPTIONS() {
  return mobileCorsOptionsResponse();
}

/** Último cadastro gravado na central para o telefone (app / página vítima ao abrir). */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return withMobileCors(NextResponse.json({ error: "JSON inválido." }, { status: 400 }));
  }

  const parsed = victimAppCadastroCarregarSchema.safeParse(body);
  if (!parsed.success) {
    return withMobileCors(
      NextResponse.json({ error: "Telefone inválido.", details: parsed.error.flatten() }, { status: 400 }),
    );
  }

  try {
    const row = await getLatestVictimCadastroByPhone(prisma, parsed.data.telefone);
    if (!row) {
      return withMobileCors(NextResponse.json({ ok: true, cadastro: null }));
    }

    return withMobileCors(
      NextResponse.json({
        ok: true,
        cadastro: {
          id: row.id,
          telefoneDigits: row.telefoneDigits,
          nomeVitima: row.nomeVitima,
          idade: row.idade,
          cpf: row.cpf,
          identidade: row.identidade,
          medidaProtetiva: row.medidaProtetiva,
          enderecoResidencia: row.enderecoResidencia,
          latitude: row.latitude,
          longitude: row.longitude,
          accuracyM: row.accuracyM,
          nomeAgressor: row.nomeAgressor,
          enderecoAgressor: row.enderecoAgressor,
          fotoVitimaNome: row.fotoVitimaNome,
          fotoAgressorNome: row.fotoAgressorNome,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        },
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro.";
    return withMobileCors(NextResponse.json({ error: "Falha ao consultar a base.", detail: msg }, { status: 503 }));
  }
}
