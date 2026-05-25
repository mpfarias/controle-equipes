import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { podeVerAuditoria } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeVerAuditoria(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const take = Math.min(Number(searchParams.get("take") ?? "50") || 50, 200);
  const skip = Number(searchParams.get("skip") ?? "0") || 0;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        user: { select: { nomeCompleto: true, email: true, role: true } },
      },
    }),
    prisma.auditLog.count(),
  ]);

  return NextResponse.json({ items, total, take, skip });
}
