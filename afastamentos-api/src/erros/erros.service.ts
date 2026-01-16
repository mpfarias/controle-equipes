import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

interface ErroLogInput {
  mensagem: string;
  stack?: string | null;
  endpoint?: string | null;
  metodo?: string | null;
  userId?: number | null;
  userName?: string | null;
  matricula?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestBody?: unknown;
  statusCode?: number | null;
  erro?: unknown;
}

@Injectable()
export class ErrosService {
  constructor(private readonly prisma: PrismaService) {}

  async registrarErro(data: ErroLogInput): Promise<void> {
    try {
      await this.prisma.erroLog.create({
        data: {
          mensagem: data.mensagem,
          stack: data.stack || null,
          endpoint: data.endpoint || null,
          metodo: data.metodo || null,
          userId: data.userId || null,
          userName: data.userName || null,
          matricula: data.matricula || null,
          ip: data.ip || null,
          userAgent: data.userAgent || null,
          requestBody: data.requestBody ? (data.requestBody as Prisma.InputJsonValue) : undefined,
          statusCode: data.statusCode || null,
          erro: data.erro ? (data.erro as Prisma.InputJsonValue) : undefined,
        },
      });
    } catch (error) {
      // Não lançar erro aqui para evitar loop infinito
      // Apenas logar no console
      console.error('Erro ao registrar erro no banco de dados:', error);
    }
  }

  async findAll(options?: {
    page?: number;
    pageSize?: number;
    dataInicio?: Date;
    dataFim?: Date;
  }): Promise<
    | Prisma.ErroLogGetPayload<Record<string, never>>[]
    | {
        erros: Prisma.ErroLogGetPayload<Record<string, never>>[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }
  > {
    const { page, pageSize, dataInicio, dataFim } = options || {};

    // Se não fornecer paginação, retornar todos (compatibilidade)
    if (page === undefined && pageSize === undefined) {
      const where: Prisma.ErroLogWhereInput = {};
      
      if (dataInicio || dataFim) {
        where.createdAt = {};
        if (dataInicio) {
          where.createdAt.gte = dataInicio;
        }
        if (dataFim) {
          const fimDoDia = new Date(dataFim);
          fimDoDia.setHours(23, 59, 59, 999);
          where.createdAt.lte = fimDoDia;
        }
      }

      return this.prisma.erroLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
    }

    // Implementar paginação
    const currentPage = page || 1;
    const currentPageSize = pageSize || 10;
    const skip = (currentPage - 1) * currentPageSize;
    const take = currentPageSize;

    const where: Prisma.ErroLogWhereInput = {};
    
    if (dataInicio || dataFim) {
      where.createdAt = {};
      if (dataInicio) {
        where.createdAt.gte = dataInicio;
      }
      if (dataFim) {
        const fimDoDia = new Date(dataFim);
        fimDoDia.setHours(23, 59, 59, 999);
        where.createdAt.lte = fimDoDia;
      }
    }

    const [erros, total] = await this.prisma.$transaction([
      this.prisma.erroLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.erroLog.count({ where }),
    ]);

    return {
      erros,
      total,
      page: currentPage,
      pageSize: currentPageSize,
      totalPages: Math.ceil(total / currentPageSize),
    };
  }
}
