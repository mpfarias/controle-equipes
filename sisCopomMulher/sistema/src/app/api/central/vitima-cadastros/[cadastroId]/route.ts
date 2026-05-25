import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { podeVerCentralVitimaMobile } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { centralVitimaCadastroPatchSchema } from "@/lib/victim-app-body";
import {
  deleteVictimMobileCadastroByCentral,
  updateVictimMobileCadastroByCentral,
} from "@/server/services/victim-app.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ cadastroId: string }> };

function mapCadastro(c: {
  id: string;
  createdAt: Date;
  telefoneDigits: string;
  nomeVitima: string | null;
  idade: string | null;
  cpf: string | null;
  identidade: string | null;
  medidaProtetiva: string | null;
  enderecoResidencia: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  nomeAgressor: string | null;
  enderecoAgressor: string | null;
  fotoVitimaNome: string | null;
  fotoAgressorNome: string | null;
}) {
  return {
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
  };
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeVerCentralVitimaMobile(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { cadastroId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = centralVitimaCadastroPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos.", details: parsed.error.flatten() }, { status: 400 });
  }

  const b = parsed.data;
  const updated = await updateVictimMobileCadastroByCentral(prisma, {
    id: cadastroId,
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

  if (!updated) {
    return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, cadastro: mapCadastro(updated) });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeVerCentralVitimaMobile(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { cadastroId } = await ctx.params;
  const result = await deleteVictimMobileCadastroByCentral(prisma, cadastroId);
  if (!result) {
    return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    message: "Cadastro excluído. Os alertas de pânico deste telefone também foram removidos.",
  });
}
