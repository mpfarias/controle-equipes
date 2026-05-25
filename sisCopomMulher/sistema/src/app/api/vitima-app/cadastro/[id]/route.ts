import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mobileCorsOptionsResponse, withMobileCors } from "@/lib/mobile-cors";
import { victimAppCadastroBodySchema } from "@/lib/victim-app-body";
import { deleteVictimMobileCadastro, updateVictimMobileCadastro } from "@/server/services/victim-app.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS() {
  return mobileCorsOptionsResponse();
}

/** Atualiza cadastro: o telefone no corpo tem de coincidir com o registo (proteção mínima no canal público). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
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
    const row = await updateVictimMobileCadastro(prisma, {
      id,
      telefoneDigitsVerify: b.telefone,
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
    if (!row) {
      return withMobileCors(NextResponse.json({ error: "Cadastro não encontrado ou telefone não confere." }, { status: 404 }));
    }
    return withMobileCors(
      NextResponse.json({ ok: true, id: row.id, message: "Alteração guardada com sucesso. O cadastro na central foi atualizado." }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gravar.";
    return withMobileCors(NextResponse.json({ error: "Falha ao atualizar na base de dados.", detail: msg }, { status: 503 }));
  }
}

/** Exclui cadastro: telefone no corpo JSON tem de coincidir. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return withMobileCors(NextResponse.json({ error: "Envie JSON com { \"telefone\": \"...\" } (só dígitos)." }, { status: 400 }));
  }

  const parsed = victimAppCadastroBodySchema.pick({ telefone: true }).safeParse(body);
  if (!parsed.success) {
    return withMobileCors(NextResponse.json({ error: "Telefone inválido.", details: parsed.error.flatten() }, { status: 400 }));
  }

  try {
    const result = await deleteVictimMobileCadastro(prisma, {
      id,
      telefoneDigitsVerify: parsed.data.telefone,
    });
    if (!result) {
      return withMobileCors(NextResponse.json({ error: "Cadastro não encontrado ou telefone não confere." }, { status: 404 }));
    }
    return withMobileCors(
      NextResponse.json({
        ok: true,
        message: "Cadastro excluído com sucesso. Os alertas de pânico deste telefone também foram removidos da central.",
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao excluir.";
    return withMobileCors(NextResponse.json({ error: "Falha ao excluir na base de dados.", detail: msg }, { status: 503 }));
  }
}
