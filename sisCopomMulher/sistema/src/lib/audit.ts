import { prisma } from "./prisma";

export async function registrarAuditoria(input: {
  userId: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  detalhes?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      acao: input.acao,
      entidade: input.entidade,
      entidadeId: input.entidadeId ?? null,
      detalhes:
        input.detalhes === undefined
          ? null
          : typeof input.detalhes === "string"
            ? input.detalhes
            : JSON.stringify(input.detalhes),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
