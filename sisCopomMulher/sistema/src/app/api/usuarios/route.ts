import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getSessionFromCookies } from "@/lib/auth";
import { podeGerenciarUsuarios } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { clientIp, clientUa } from "@/lib/request-meta";

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeGerenciarUsuarios(session.role)) {
    return NextResponse.json({ error: "Sem permissão.", callerRole: session.role }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { nomeCompleto: { contains: q } },
            { email: { contains: q } },
            { matricula: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      cpf: true,
      telefone: true,
      matricula: true,
      lotacao: true,
      cargo: true,
      role: true,
      ativo: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ users, callerRole: session.role });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeGerenciarUsuarios(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const senha = String(body.senha ?? "");
  const nomeCompleto = String(body.nomeCompleto ?? "").trim();
  const role = body.role as UserRole;

  if (!email || !senha || !nomeCompleto) {
    return NextResponse.json({ error: "Nome, e-mail e senha são obrigatórios." }, { status: 400 });
  }
  if (!Object.values(UserRole).includes(role)) {
    return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  try {
    const user = await prisma.user.create({
      data: {
        nomeCompleto,
        email,
        senhaHash,
        role,
        ativo: body.ativo === false ? false : true,
        cpf: body.cpf ? String(body.cpf) : null,
        telefone: body.telefone ? String(body.telefone) : null,
        matricula: body.matricula ? String(body.matricula) : null,
        lotacao: body.lotacao ? String(body.lotacao) : null,
        cargo: body.cargo ? String(body.cargo) : null,
      },
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
        createdAt: true,
      },
    });
    await registrarAuditoria({
      userId: session.sub,
      acao: "CRIAR_USUARIO",
      entidade: "User",
      entidadeId: user.id,
      detalhes: { email: user.email, role: user.role },
      ip: clientIp(req),
      userAgent: clientUa(req),
    });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Não foi possível criar (e-mail duplicado?)." }, { status: 400 });
  }
}
