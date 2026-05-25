import type { Prisma, PrismaClient, VitimaPanicEncaminhamento, VitimaPanicFinalizacao } from "@prisma/client";

export async function createVictimMobileCadastro(
  prisma: PrismaClient,
  data: {
    telefoneDigits: string;
    nomeVitima: string;
    idade?: string | null;
    cpf?: string | null;
    identidade?: string | null;
    medidaProtetiva?: string | null;
    enderecoResidencia: string;
    latitude?: number | null;
    longitude?: number | null;
    accuracyM?: number | null;
    nomeAgressor: string;
    enderecoAgressor: string;
    fotoVitimaNome?: string | null;
    fotoAgressorNome?: string | null;
  },
) {
  return prisma.victimMobileCadastro.create({
    data: {
      telefoneDigits: data.telefoneDigits,
      nomeVitima: data.nomeVitima,
      idade: data.idade ?? undefined,
      cpf: data.cpf ?? undefined,
      identidade: data.identidade ?? undefined,
      medidaProtetiva: data.medidaProtetiva ?? undefined,
      enderecoResidencia: data.enderecoResidencia,
      latitude: data.latitude ?? undefined,
      longitude: data.longitude ?? undefined,
      accuracyM: data.accuracyM ?? undefined,
      nomeAgressor: data.nomeAgressor,
      enderecoAgressor: data.enderecoAgressor,
      fotoVitimaNome: data.fotoVitimaNome ?? undefined,
      fotoAgressorNome: data.fotoAgressorNome ?? undefined,
    },
  });
}

export async function createVictimMobilePanic(
  prisma: PrismaClient,
  params: { telefoneDigits: string; latitude: number; longitude: number; accuracyM?: number | null },
) {
  const latest = await prisma.victimMobileCadastro.findFirst({
    where: { telefoneDigits: params.telefoneDigits },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  return prisma.victimMobilePanic.create({
    data: {
      telefoneDigits: params.telefoneDigits,
      latitude: params.latitude,
      longitude: params.longitude,
      accuracyM: params.accuracyM ?? undefined,
      cadastroId: latest?.id,
    },
  });
}

export async function updateVictimMobileCadastro(
  prisma: PrismaClient,
  params: {
    id: string;
    telefoneDigitsVerify: string;
    nomeVitima: string;
    idade?: string | null;
    cpf?: string | null;
    identidade?: string | null;
    medidaProtetiva?: string | null;
    enderecoResidencia: string;
    latitude?: number | null;
    longitude?: number | null;
    accuracyM?: number | null;
    nomeAgressor: string;
    enderecoAgressor: string;
    fotoVitimaNome?: string | null;
    fotoAgressorNome?: string | null;
  },
) {
  const row = await prisma.victimMobileCadastro.findUnique({ where: { id: params.id } });
  if (!row || row.telefoneDigits !== params.telefoneDigitsVerify) return null;

  return prisma.victimMobileCadastro.update({
    where: { id: params.id },
    data: {
      nomeVitima: params.nomeVitima,
      idade: params.idade ?? undefined,
      cpf: params.cpf ?? undefined,
      identidade: params.identidade ?? undefined,
      medidaProtetiva: params.medidaProtetiva ?? undefined,
      enderecoResidencia: params.enderecoResidencia,
      latitude: params.latitude ?? undefined,
      longitude: params.longitude ?? undefined,
      accuracyM: params.accuracyM ?? undefined,
      nomeAgressor: params.nomeAgressor,
      enderecoAgressor: params.enderecoAgressor,
      fotoVitimaNome: params.fotoVitimaNome ?? undefined,
      fotoAgressorNome: params.fotoAgressorNome ?? undefined,
    },
  });
}

export async function deleteVictimMobileCadastro(
  prisma: PrismaClient,
  params: { id: string; telefoneDigitsVerify: string },
) {
  const row = await prisma.victimMobileCadastro.findUnique({ where: { id: params.id } });
  if (!row || row.telefoneDigits !== params.telefoneDigitsVerify) return null;

  await prisma.$transaction(async (tx) => {
    await tx.victimMobilePanic.deleteMany({
      where: { telefoneDigits: row.telefoneDigits },
    });
    await tx.victimMobileCadastro.delete({ where: { id: params.id } });
  });
  return { ok: true as const };
}

export async function getLatestVictimCadastroByPhone(prisma: PrismaClient, telefoneDigits: string) {
  return prisma.victimMobileCadastro.findFirst({
    where: { telefoneDigits },
    orderBy: { createdAt: "desc" },
  });
}

export async function listVictimCadastrosForCentral(prisma: PrismaClient, limit: number) {
  const take = Math.min(200, Math.max(1, limit));
  return prisma.victimMobileCadastro.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function listVictimPanicsForCentral(prisma: PrismaClient, limit: number) {
  const take = Math.min(200, Math.max(1, limit));
  return prisma.victimMobilePanic.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      cadastro: {
        select: {
          id: true,
          nomeVitima: true,
          telefoneDigits: true,
        },
      },
    },
  });
}

/** Atualização administrativa na central (sem verificação por telefone do app). */
export async function updateVictimMobileCadastroByCentral(
  prisma: PrismaClient,
  params: {
    id: string;
    nomeVitima: string;
    idade?: string | null;
    cpf?: string | null;
    identidade?: string | null;
    medidaProtetiva?: string | null;
    enderecoResidencia: string;
    latitude?: number | null;
    longitude?: number | null;
    accuracyM?: number | null;
    nomeAgressor: string;
    enderecoAgressor: string;
    fotoVitimaNome?: string | null;
    fotoAgressorNome?: string | null;
  },
) {
  const row = await prisma.victimMobileCadastro.findUnique({ where: { id: params.id } });
  if (!row) return null;

  return prisma.victimMobileCadastro.update({
    where: { id: params.id },
    data: {
      nomeVitima: params.nomeVitima,
      idade: params.idade ?? null,
      cpf: params.cpf ?? null,
      identidade: params.identidade ?? null,
      medidaProtetiva: params.medidaProtetiva ?? null,
      enderecoResidencia: params.enderecoResidencia,
      latitude: params.latitude,
      longitude: params.longitude,
      accuracyM: params.accuracyM,
      nomeAgressor: params.nomeAgressor,
      enderecoAgressor: params.enderecoAgressor,
      fotoVitimaNome: params.fotoVitimaNome ?? null,
      fotoAgressorNome: params.fotoAgressorNome ?? null,
    },
  });
}

export async function deleteVictimMobileCadastroByCentral(prisma: PrismaClient, id: string) {
  const row = await prisma.victimMobileCadastro.findUnique({ where: { id } });
  if (!row) return null;
  await prisma.$transaction(async (tx) => {
    await tx.victimMobilePanic.deleteMany({
      where: { telefoneDigits: row.telefoneDigits },
    });
    await tx.victimMobileCadastro.delete({ where: { id } });
  });
  return { ok: true as const };
}

export async function updateVictimPanicDisposition(
  prisma: PrismaClient,
  params: {
    panicId: string;
    encaminhamento?: VitimaPanicEncaminhamento | null;
    finalizacao?: VitimaPanicFinalizacao | null;
    acknowledged: boolean;
    operatorId: string;
  },
) {
  const now = new Date();
  const row = await prisma.victimMobilePanic.findUnique({ where: { id: params.panicId } });
  if (!row) return null;

  const data: Prisma.VictimMobilePanicUpdateInput = {};
  if (params.encaminhamento !== undefined) data.encaminhamento = params.encaminhamento;
  if (params.finalizacao !== undefined) data.finalizacao = params.finalizacao;

  const shouldTouchAck =
    params.acknowledged ||
    params.encaminhamento !== undefined ||
    params.finalizacao !== undefined;
  if (shouldTouchAck) {
    data.acknowledgedBy = { connect: { id: params.operatorId } };
    if (!row.acknowledgedAt) data.acknowledgedAt = now;
  }

  return prisma.victimMobilePanic.update({
    where: { id: params.panicId },
    data,
    include: {
      cadastro: { select: { id: true, nomeVitima: true, telefoneDigits: true } },
    },
  });
}
