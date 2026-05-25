import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readBearerToken } from "@/lib/mobile-bearer";
import { mobileCorsOptionsResponse, withMobileCors } from "@/lib/mobile-cors";
import { findMobileLinkByPlainToken, occurrencePayloadForMobileApp } from "@/server/services/mobile-vitima.service";

export const runtime = "nodejs";

export async function OPTIONS() {
  return mobileCorsOptionsResponse();
}

/** Dados resumidos da ocorrência para o app da vítima (Bearer = token de ativação). */
export async function GET(req: NextRequest) {
  const plain = readBearerToken(req);
  if (!plain) {
    return withMobileCors(NextResponse.json({ error: "Envie Authorization: Bearer <token>." }, { status: 401 }));
  }
  const link = await findMobileLinkByPlainToken(prisma, plain);
  if (!link) {
    return withMobileCors(NextResponse.json({ error: "Token inválido ou expirado." }, { status: 403 }));
  }
  const payload = occurrencePayloadForMobileApp(link.occurrence);
  return withMobileCors(
    NextResponse.json({
      ok: true,
      linkId: link.id,
      label: link.label,
      ...payload,
    }),
  );
}
