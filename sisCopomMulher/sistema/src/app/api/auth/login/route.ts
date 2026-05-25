import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { readMustChangePasswordSafe } from "@/lib/must-change-password";
import { signSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/constants";
import { sessionCookieSecureFromRequest } from "@/lib/session-cookie-secure";
import { registrarAuditoria } from "@/lib/audit";
import { clientIp, clientUa } from "@/lib/request-meta";

export async function POST(req: NextRequest) {
  let body: { email?: string; senha?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  let email = String(body.email ?? "")
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase();
  const senha = String(body.senha ?? "");
  if (!email || !senha) {
    return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
  }
  if (!email.includes("@")) {
    email = `${email}@copom-mulher.df`;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      nomeCompleto: true,
      ativo: true,
      senhaHash: true,
    },
  });
  if (!user?.ativo) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }
  const ok = await bcrypt.compare(senha, user.senhaHash);
  if (!ok) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  const mustChangePassword = await readMustChangePasswordSafe(user.id);

  const token = await signSession({
    sub: user.id,
    email: user.email,
    role: user.role,
    nome: user.nomeCompleto,
    mustChangePassword,
  });

  await registrarAuditoria({
    userId: user.id,
    acao: "LOGIN",
    entidade: "User",
    entidadeId: user.id,
    ip: clientIp(req),
    userAgent: clientUa(req),
  });

  const res = NextResponse.json({
    ok: true,
    user: { nome: user.nomeCompleto, email: user.email, role: user.role },
    mustChangePassword,
  });
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
