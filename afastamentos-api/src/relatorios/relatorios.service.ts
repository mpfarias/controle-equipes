import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  async registrarGeracaoRelatorio(
    userId: number | undefined,
    userName: string | undefined,
    matricula: string | undefined,
    tipoRelatorio: string,
  ): Promise<void> {
    await this.prisma.relatorioLog.create({
      data: {
        userId: userId ?? null,
        userName: userName ?? null,
        matricula: matricula ?? null,
        tipoRelatorio,
      },
    });
  }

  async findAll(options?: { page?: number; pageSize?: number; dataInicio?: Date; dataFim?: Date }) {
    const { page = 1, pageSize = 10, dataInicio, dataFim } = options || {};
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: any = {};
    
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

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.relatorioLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.relatorioLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
