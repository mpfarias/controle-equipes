import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { podeAdministrarOcorrencia, podeListarOcorrencias, podeRegistrarOcorrencias } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { pickOccurrenceInput } from "@/lib/occurrence-body";
import { registrarAuditoria } from "@/lib/audit";
import { clientIp, clientUa } from "@/lib/request-meta";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeListarOcorrencias(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const occurrence = await prisma.occurrence.findUnique({
    where: { id },
    include: {
      createdBy: { select: { nomeCompleto: true, email: true } },
      updatedBy: { select: { nomeCompleto: true, email: true } },
    },
  });
  if (!occurrence) return NextResponse.json({ error: "Não encontrada." }, { status: 404 });
  return NextResponse.json({ occurrence });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeRegistrarOcorrencias(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  if (!podeAdministrarOcorrencia(session.role)) {
    return NextResponse.json({ error: "Sem permissão para alterar ocorrências." }, { status: 403 });
  }
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const picked = pickOccurrenceInput(body);
  const updated = await prisma.occurrence.update({
    where: { id },
    data: {
      ...picked,
      updatedById: session.sub,
    },
  });

  await registrarAuditoria({
    userId: session.sub,
    acao: "ATUALIZAR_OCORRENCIA",
    entidade: "Occurrence",
    entidadeId: id,
    detalhes: { faseAtual: updated.faseAtual, concluida: updated.concluida },
    ip: clientIp(req),
    userAgent: clientUa(req),
  });

  return NextResponse.json({ occurrence: updated });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeAdministrarOcorrencia(session.role)) {
    return NextResponse.json({ error: "Sem permissão para excluir ocorrências." }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    await prisma.occurrence.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Não foi possível excluir." }, { status: 400 });
  }

  await registrarAuditoria({
    userId: session.sub,
    acao: "EXCLUIR_OCORRENCIA",
    entidade: "Occurrence",
    entidadeId: id,
    ip: clientIp(req),
    userAgent: clientUa(req),
  });

  return NextResponse.json({ ok: true });
}
