import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionFromCookies, signSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/constants";
import { sessionCookieSecureFromRequest } from "@/lib/session-cookie-secure";
import { registrarAuditoria } from "@/lib/audit";
import { clientIp, clientUa } from "@/lib/request-meta";

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: { senhaAtual?: string; senhaNova?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const senhaAtual = String(body.senhaAtual ?? "");
  const senhaNova = String(body.senhaNova ?? "");
  if (!senhaAtual || !senhaNova) {
    return NextResponse.json({ error: "Informe a senha atual e a nova senha." }, { status: 400 });
  }
  if (senhaNova.length < 6) {
    return NextResponse.json({ error: "A nova senha deve ter pelo menos 6 caracteres." }, { status: 400 });
  }
  if (senhaNova === senhaAtual) {
    return NextResponse.json({ error: "A nova senha deve ser diferente da atual." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, role: true, nomeCompleto: true, senhaHash: true, ativo: true },
  });
  if (!user?.ativo) {
    return NextResponse.json({ error: "Conta inválida." }, { status: 401 });
  }

  const ok = await bcrypt.compare(senhaAtual, user.senhaHash);
  if (!ok) {
    return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });
  }

  const senhaHash = await bcrypt.hash(senhaNova, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { senhaHash, mustChangePassword: false },
  });

  await registrarAuditoria({
    userId: user.id,
    acao: "ALTERAR_SENHA",
    entidade: "User",
    entidadeId: user.id,
    ip: clientIp(req),
    userAgent: clientUa(req),
  });

  const token = await signSession({
    sub: user.id,
    email: user.email,
    role: user.role,
    nome: user.nomeCompleto,
    mustChangePassword: false,
  });

  const res = NextResponse.json({ ok: true });
  const secure = sessionCookieSecureFromRequest(req);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}
