import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readMustChangePasswordSafe } from "@/lib/must-change-password";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      role: true,
      ativo: true,
      cargo: true,
      lotacao: true,
    },
  });
  if (!user?.ativo) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const mustChangePassword = await readMustChangePasswordSafe(user.id);
  return NextResponse.json({ user: { ...user, mustChangePassword } });
}
