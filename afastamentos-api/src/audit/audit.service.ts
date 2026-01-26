import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type Actor = {
  id: number;
  nome: string;
  equipe?: string | null;
};

interface AuditRecordParams {
  entity: string;
  entityId?: number;
  action: AuditAction;
  actor?: Actor | null;
  before?: unknown;
  after?: unknown;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveActor(userId?: number): Promise<Actor | null> {
    if (!userId) {
      return null;
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, nome: true, equipe: true },
    });

    return usuario ?? null;
  }

  async record({
    entity,
    entityId,
    action,
    actor,
    before,
    after,
  }: AuditRecordParams): Promise<void> {
    const data: Prisma.AuditLogCreateInput = {
      entity,
      entityId: entityId ?? null,
      action,
      userId: actor?.id ?? null,
      userName: actor?.nome ?? null,
    };

    if (before !== undefined) {
      data.before = before as Prisma.InputJsonValue;
    }

    if (after !== undefined) {
      data.after = after as Prisma.InputJsonValue;
    }

    await this.prisma.auditLog.create({ data });
  }

  async findAll(options?: { limit?: number; offset?: number; dataInicio?: Date; dataFim?: Date }) {
    const { limit, offset, dataInicio, dataFim } = options || {};
    
    const where: Prisma.AuditLogWhereInput = {};
    
    if (dataInicio || dataFim) {
      where.createdAt = {};
      if (dataInicio) {
        where.createdAt.gte = dataInicio;
      }
      if (dataFim) {
        // Adicionar 23:59:59.999 ao final do dia
        const fimDoDia = new Date(dataFim);
        fimDoDia.setHours(23, 59, 59, 999);
        where.createdAt.lte = fimDoDia;
      }
    }
    
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      limit: limit || total,
      offset: offset || 0,
    };
  }
}
