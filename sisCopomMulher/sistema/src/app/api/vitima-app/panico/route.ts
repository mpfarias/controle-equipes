import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mobileCorsOptionsResponse, withMobileCors } from "@/lib/mobile-cors";
import { victimAppPanicoBodySchema } from "@/lib/victim-app-body";
import { createVictimMobilePanic } from "@/server/services/victim-app.service";

export const runtime = "nodejs";

export async function OPTIONS() {
  return mobileCorsOptionsResponse();
}

/** Pânico enviado pelo aplicativo da vítima (telefone + coordenadas). */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return withMobileCors(NextResponse.json({ error: "JSON inválido." }, { status: 400 }));
  }

  const parsed = victimAppPanicoBodySchema.safeParse(body);
  if (!parsed.success) {
    return withMobileCors(
      NextResponse.json({ error: "Dados inválidos.", details: parsed.error.flatten() }, { status: 400 }),
    );
  }

  const b = parsed.data;
  try {
    const row = await createVictimMobilePanic(prisma, {
      telefoneDigits: b.telefone,
      latitude: b.latitude,
      longitude: b.longitude,
      accuracyM: b.accuracyM ?? null,
    });
    return withMobileCors(NextResponse.json({ ok: true, id: row.id }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gravar.";
    return withMobileCors(NextResponse.json({ error: "Falha ao gravar na base de dados.", detail: msg }, { status: 503 }));
  }
}
