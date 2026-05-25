import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { podeListarOcorrencias, podeRegistrarOcorrencias } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { listOccurrencesForApp } from "@/lib/ocorrencias-list-service";
import { pickOccurrenceInput } from "@/lib/occurrence-body";
import { registrarAuditoria } from "@/lib/audit";
import { clientIp, clientUa } from "@/lib/request-meta";

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeListarOcorrencias(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const rawPage = Math.max(1, Math.floor(Number(searchParams.get("page") ?? "1") || 1));
  const q = searchParams.get("q")?.trim();
  const porId = searchParams.get("id")?.trim();
  const porCad = searchParams.get("cad")?.trim();

  const data = await listOccurrencesForApp({
    page: rawPage,
    q,
    porId,
    porCad,
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeRegistrarOcorrencias(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const picked = pickOccurrenceInput(body);
  const faseAtual = typeof picked.faseAtual === "number" ? picked.faseAtual : 1;
  const concluida = Boolean(picked.concluida);

  const created = await prisma.occurrence.create({
    data: {
      ...picked,
      origem: "SISTEMA",
      faseAtual,
      concluida,
      createdById: session.sub,
      updatedById: session.sub,
    },
  });

  await registrarAuditoria({
    userId: session.sub,
    acao: "CRIAR_OCORRENCIA",
    entidade: "Occurrence",
    entidadeId: created.id,
    detalhes: { faseAtual, concluida },
    ip: clientIp(req),
    userAgent: clientUa(req),
  });

  return NextResponse.json({ occurrence: created });
}
