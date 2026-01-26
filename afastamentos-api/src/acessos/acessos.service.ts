import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

interface AcessoLogInput {
  userId?: number | null;
  userName?: string | null;
  matricula?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AcessosService {
  constructor(private readonly prisma: PrismaService) {}

  async registrarLogin(data: AcessoLogInput): Promise<number> {
    try {
      const acesso = await this.prisma.acessoLog.create({
        data: {
          userId: data.userId || null,
          userName: data.userName || null,
          matricula: data.matricula || null,
          ip: data.ip || null,
          userAgent: data.userAgent || null,
          dataEntrada: new Date(),
        },
      });
      return acesso.id;
    } catch (error) {
      // Não lançar erro aqui para não bloquear o login
      console.error('Erro ao registrar login:', error);
      return 0;
    }
  }

  async registrarLogout(acessoId: number): Promise<void> {
    try {
      const acesso = await this.prisma.acessoLog.findUnique({
        where: { id: acessoId },
      });

      if (!acesso) {
        return;
      }

      const dataSaida = new Date();
      const dataEntrada = acesso.dataEntrada;
      const tempoSessao = Math.round(
        (dataSaida.getTime() - dataEntrada.getTime()) / 1000,
      ); // Tempo em segundos

      await this.prisma.acessoLog.update({
        where: { id: acessoId },
        data: {
          dataSaida,
          tempoSessao,
        },
      });
    } catch (error) {
      // Não lançar erro aqui para não bloquear o logout
      console.error('Erro ao registrar logout:', error);
    }
  }

  async findAll(options?: {
    page?: number;
    pageSize?: number;
    dataInicio?: Date;
    dataFim?: Date;
    userId?: number;
  }): Promise<
    | Prisma.AcessoLogGetPayload<Record<string, never>>[]
    | {
        acessos: Prisma.AcessoLogGetPayload<Record<string, never>>[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }
  > {
    const { page, pageSize, dataInicio, dataFim, userId } = options || {};

    // Se não fornecer paginação, retornar todos (compatibilidade)
    if (page === undefined && pageSize === undefined) {
      const where: Prisma.AcessoLogWhereInput = {};

      if (dataInicio || dataFim) {
        where.dataEntrada = {};
        if (dataInicio) {
          where.dataEntrada.gte = dataInicio;
        }
        if (dataFim) {
          const fimDoDia = new Date(dataFim);
          fimDoDia.setHours(23, 59, 59, 999);
          where.dataEntrada.lte = fimDoDia;
        }
      }

      if (userId) {
        where.userId = userId;
      }

      return this.prisma.acessoLog.findMany({
        where,
        orderBy: { dataEntrada: 'desc' },
      });
    }

    // Implementar paginação
    const currentPage = page || 1;
    const currentPageSize = pageSize || 10;
    const skip = (currentPage - 1) * currentPageSize;
    const take = currentPageSize;

    const where: Prisma.AcessoLogWhereInput = {};

    if (dataInicio || dataFim) {
      where.dataEntrada = {};
      if (dataInicio) {
        where.dataEntrada.gte = dataInicio;
      }
      if (dataFim) {
        const fimDoDia = new Date(dataFim);
        fimDoDia.setHours(23, 59, 59, 999);
        where.dataEntrada.lte = fimDoDia;
      }
    }

    if (userId) {
      where.userId = userId;
    }

    const [acessos, total] = await this.prisma.$transaction([
      this.prisma.acessoLog.findMany({
        where,
        orderBy: { dataEntrada: 'desc' },
        skip,
        take,
      }),
      this.prisma.acessoLog.count({ where }),
    ]);

    return {
      acessos,
      total,
      page: currentPage,
      pageSize: currentPageSize,
      totalPages: Math.ceil(total / currentPageSize),
    };
  }
}
