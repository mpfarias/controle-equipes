import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readBearerToken } from "@/lib/mobile-bearer";
import { mobileCorsOptionsResponse, withMobileCors } from "@/lib/mobile-cors";
import { mobileTelemetryBodySchema } from "@/lib/mobile-telemetry-body";
import { COPOM_VITIMA_CLIENT_HEADER, COPOM_VITIMA_NATIVE_VALUE } from "@/lib/mobile-native-client";
import { findMobileLinkByPlainToken, recordMobileTelemetry } from "@/server/services/mobile-vitima.service";

export const runtime = "nodejs";

export async function OPTIONS() {
  return mobileCorsOptionsResponse();
}

/** Localização ou pânico enviado pelo celular da vítima. */
export async function POST(req: NextRequest) {
  const plain = readBearerToken(req);
  if (!plain) {
    return withMobileCors(NextResponse.json({ error: "Envie Authorization: Bearer <token>." }, { status: 401 }));
  }
  const link = await findMobileLinkByPlainToken(prisma, plain);
  if (!link) {
    return withMobileCors(NextResponse.json({ error: "Token inválido ou expirado." }, { status: 403 }));
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return withMobileCors(NextResponse.json({ error: "JSON inválido." }, { status: 400 }));
  }
  const parsed = mobileTelemetryBodySchema.safeParse(body);
  if (!parsed.success) {
    return withMobileCors(NextResponse.json({ error: "Dados inválidos.", details: parsed.error.flatten() }, { status: 400 }));
  }

  if (parsed.data.kind === "PANIC") {
    const client = req.headers.get(COPOM_VITIMA_CLIENT_HEADER);
    if (client !== COPOM_VITIMA_NATIVE_VALUE) {
      return withMobileCors(
        NextResponse.json(
          {
            error:
              "O pânico só pode ser acionado pela aplicação COPOM Vítima instalada no telemóvel. A página web não envia pânico.",
          },
          { status: 403 },
        ),
      );
    }
  }

  const ua = req.headers.get("user-agent")?.slice(0, 400) ?? null;

  await recordMobileTelemetry(prisma, {
    linkId: link.id,
    kind: parsed.data.kind,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    accuracyM: parsed.data.accuracyM,
    altitude: parsed.data.altitude,
    speed: parsed.data.speed,
    heading: parsed.data.heading,
    deviceInfo: ua,
  });

  return withMobileCors(NextResponse.json({ ok: true }));
}
