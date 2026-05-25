"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { readMustChangePasswordSafe } from "@/lib/must-change-password";
import { signSession, setSessionCookie } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";

export type LoginFormState = { error: string | null };

export async function loginAction(_prev: LoginFormState, formData: FormData): Promise<LoginFormState> {
  let email = String(formData.get("email") ?? "")
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const rawNext = String(formData.get("next") ?? "/app/dashboard");
  const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app/dashboard";

  if (!email || !senha) {
    return { error: "Informe utilizador e senha." };
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
    return { error: "Credenciais inválidas." };
  }
  const ok = await bcrypt.compare(senha, user.senhaHash);
  if (!ok) {
    return { error: "Credenciais inválidas." };
  }

  const mustChangePassword = await readMustChangePasswordSafe(user.id);

  const token = await signSession({
    sub: user.id,
    email: user.email,
    role: user.role,
    nome: user.nomeCompleto,
    mustChangePassword,
  });
  await setSessionCookie(token);

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const ua = h.get("user-agent");
  await registrarAuditoria({
    userId: user.id,
    acao: "LOGIN",
    entidade: "User",
    entidadeId: user.id,
    ip,
    userAgent: ua,
  });

  if (mustChangePassword) {
    redirect("/app/alterar-senha-primeiro-acesso");
  }
  redirect(safeNext);
}
