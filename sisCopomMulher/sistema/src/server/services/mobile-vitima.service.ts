import type { MobileTelemetryKind, PrismaClient } from "@prisma/client";
import { hashMobileActivationToken, generateMobileActivationToken } from "@/lib/mobile-vitima-token";

export async function findMobileLinkByPlainToken(prisma: PrismaClient, plainToken: string) {
  const tokenHash = hashMobileActivationToken(plainToken.trim());
  const link = await prisma.occurrenceMobileLink.findUnique({
    where: { tokenHash },
    include: {
      occurrence: true,
    },
  });
  if (!link) return null;
  if (link.revokedAt) return null;
  if (link.expiresAt && link.expiresAt < new Date()) return null;
  return link;
}

export async function createOccurrenceMobileLink(
  prisma: PrismaClient,
  params: { occurrenceId: string; createdById: string | null; label?: string | null; expiresInDays?: number },
) {
  const plain = generateMobileActivationToken();
  const tokenHash = hashMobileActivationToken(plain);
  const days = Math.min(365, Math.max(1, params.expiresInDays ?? 30));
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const link = await prisma.occurrenceMobileLink.create({
    data: {
      occurrenceId: params.occurrenceId,
      tokenHash,
      label: params.label?.trim() || null,
      expiresAt,
      createdById: params.createdById,
    },
  });

  return { link, plainToken: plain, expiresAt };
}

export function occurrencePayloadForMobileApp(o: {
  nomeVitima: string | null;
  telefoneVitima: string | null;
  enderecoVitima: string | null;
  nomeAgressor: string | null;
  parentescoAgressorVitima: string | null;
  tipoAmeacaAgressao: string | null;
  regiaoAdministrativa: string | null;
  numeroOcorrenciaCad: string | null;
}) {
  return {
    vitima: {
      nome: o.nomeVitima ?? "",
      telefone: o.telefoneVitima ?? "",
      endereco: o.enderecoVitima ?? "",
    },
    agressor: {
      nome: o.nomeAgressor ?? "",
      parentesco: o.parentescoAgressorVitima ?? "",
      tipoAmeaca: o.tipoAmeacaAgressao ?? "",
    },
    ocorrencia: {
      regiao: o.regiaoAdministrativa ?? "",
      cad: o.numeroOcorrenciaCad ?? "",
    },
  };
}

export async function recordMobileTelemetry(
  prisma: PrismaClient,
  params: {
    linkId: string;
    kind: MobileTelemetryKind;
    latitude: number;
    longitude: number;
    accuracyM?: number | null;
    altitude?: number | null;
    speed?: number | null;
    heading?: number | null;
    deviceInfo?: string | null;
  },
) {
  await prisma.$transaction([
    prisma.mobileTelemetryEvent.create({
      data: {
        linkId: params.linkId,
        kind: params.kind,
        latitude: params.latitude,
        longitude: params.longitude,
        accuracyM: params.accuracyM ?? undefined,
        altitude: params.altitude ?? undefined,
        speed: params.speed ?? undefined,
        heading: params.heading ?? undefined,
        deviceInfo: params.deviceInfo?.slice(0, 500) ?? undefined,
      },
    }),
    prisma.occurrenceMobileLink.update({
      where: { id: params.linkId },
      data: { lastSeenAt: new Date() },
    }),
  ]);
}

export async function listCentralMobileEvents(
  prisma: PrismaClient,
  opts: { limit: number; panicOnly?: boolean },
) {
  const take = Math.min(200, Math.max(1, opts.limit));
  const where = opts.panicOnly ? { kind: "PANIC" as const } : {};
  return prisma.mobileTelemetryEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      link: {
        select: {
          id: true,
          label: true,
          occurrence: {
            select: {
              id: true,
              nomeVitima: true,
              nomeAgressor: true,
              numeroOcorrenciaCad: true,
              telefoneVitima: true,
            },
          },
        },
      },
    },
  });
}
