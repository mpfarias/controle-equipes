import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mobileCorsOptionsResponse, withMobileCors } from "@/lib/mobile-cors";
import { victimAppCadastroBodySchema } from "@/lib/victim-app-body";
import { createVictimMobileCadastro } from "@/server/services/victim-app.service";

export const runtime = "nodejs";

export async function OPTIONS() {
  return mobileCorsOptionsResponse();
}

/** Cadastro básico + localização enviado pelo aplicativo da vítima (telefone como chave). */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return withMobileCors(NextResponse.json({ error: "JSON inválido." }, { status: 400 }));
  }

  const parsed = victimAppCadastroBodySchema.safeParse(body);
  if (!parsed.success) {
    return withMobileCors(
      NextResponse.json({ error: "Dados inválidos.", details: parsed.error.flatten() }, { status: 400 }),
    );
  }

  const b = parsed.data;
  try {
    const row = await createVictimMobileCadastro(prisma, {
      telefoneDigits: b.telefone,
      nomeVitima: b.nomeVitima,
      idade: b.idade ?? null,
      cpf: b.cpf ?? null,
      identidade: b.identidade ?? null,
      medidaProtetiva: b.medidaProtetiva ?? null,
      enderecoResidencia: b.enderecoResidencia,
      latitude: b.latitude ?? null,
      longitude: b.longitude ?? null,
      accuracyM: b.accuracyM ?? null,
      nomeAgressor: b.nomeAgressor,
      enderecoAgressor: b.enderecoAgressor,
      fotoVitimaNome: b.fotoVitimaNome ?? null,
      fotoAgressorNome: b.fotoAgressorNome ?? null,
    });
    return withMobileCors(NextResponse.json({ ok: true, id: row.id, message: "Cadastro realizado com sucesso." }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gravar.";
    return withMobileCors(NextResponse.json({ error: "Falha ao gravar na base de dados.", detail: msg }, { status: 503 }));
  }
}
