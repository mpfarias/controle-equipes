import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getSessionFromCookies } from "@/lib/auth";
import { podeGerenciarUsuarios } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { clientIp, clientUa } from "@/lib/request-meta";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeGerenciarUsuarios(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const data: Prisma.UserUpdateInput = {};
  if (typeof body.nomeCompleto === "string") data.nomeCompleto = body.nomeCompleto.trim();
  if (typeof body.email === "string") data.email = body.email.trim().toLowerCase();
  if (typeof body.cpf === "string" || body.cpf === null) data.cpf = body.cpf as string | null;
  if (typeof body.telefone === "string" || body.telefone === null) {
    data.telefone = body.telefone as string | null;
  }
  if (typeof body.matricula === "string" || body.matricula === null) {
    data.matricula = body.matricula as string | null;
  }
  if (typeof body.lotacao === "string" || body.lotacao === null) {
    data.lotacao = body.lotacao as string | null;
  }
  if (typeof body.cargo === "string" || body.cargo === null) data.cargo = body.cargo as string | null;
  if (typeof body.ativo === "boolean") data.ativo = body.ativo;
  if (body.role && Object.values(UserRole).includes(body.role as UserRole)) {
    data.role = body.role as UserRole;
  }
  if (typeof body.senha === "string" && body.senha.length > 0) {
    data.senhaHash = await bcrypt.hash(String(body.senha), 10);
    data.mustChangePassword = false;
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        role: true,
        ativo: true,
        cpf: true,
        telefone: true,
        matricula: true,
        lotacao: true,
        cargo: true,
        updatedAt: true,
      },
    });
    await registrarAuditoria({
      userId: session.sub,
      acao: "ATUALIZAR_USUARIO",
      entidade: "User",
      entidadeId: id,
      detalhes: { campos: Object.keys(data) },
      ip: clientIp(req),
      userAgent: clientUa(req),
    });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeGerenciarUsuarios(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  if (id === session.sub) {
    return NextResponse.json({ error: "Não é permitido excluir o próprio utilizador." }, { status: 400 });
  }
  try {
    const removed = await prisma.user.delete({
      where: { id },
      select: { id: true, email: true, role: true },
    });
    await registrarAuditoria({
      userId: session.sub,
      acao: "EXCLUIR_USUARIO",
      entidade: "User",
      entidadeId: removed.id,
      detalhes: { email: removed.email, role: removed.role },
      ip: clientIp(req),
      userAgent: clientUa(req),
    });
    return NextResponse.json({ ok: true, id: removed.id });
  } catch {
    return NextResponse.json({ error: "Não foi possível excluir." }, { status: 400 });
  }
}
