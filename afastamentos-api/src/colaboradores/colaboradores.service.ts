import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { AuditAction, Equipe, PolicialStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateColaboradorDto } from './dto/create-colaborador.dto';
import { UpdateColaboradorDto } from './dto/update-colaborador.dto';
import { CreateColaboradoresBulkDto } from './dto/create-colaboradores-bulk.dto';

type ColaboradorWithRelations = Prisma.ColaboradorGetPayload<{
  include: { afastamentos: true; funcao: true };
}>;

@Injectable()
export class ColaboradoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private sanitizeNome(nome: string): string {
    return nome.trim().toUpperCase();
  }

  private sanitizeMatricula(matricula: string): string {
    return matricula.trim().toUpperCase().replace(/[^0-9X]/g, '');
  }

  async create(
    data: Omit<CreateColaboradorDto, 'responsavelId'>,
    responsavelId?: number,
  ): Promise<ColaboradorWithRelations> {
    const actor = await this.audit.resolveActor(responsavelId);
    const matriculaNormalizada = this.sanitizeMatricula(data.matricula);

    // Validar que não pode haver mais de um CMT UPM ou SUBCMT UPM
    if (data.funcaoId) {
      const funcao = await this.prisma.funcao.findUnique({
        where: { id: data.funcaoId },
      });

      if (funcao) {
        const funcaoUpper = funcao.nome.toUpperCase();
        if (funcaoUpper.includes('CMT UPM') || funcaoUpper.includes('SUBCMT UPM')) {
          // Verificar se já existe alguém com essa função (ativo)
          const jaExiste = await this.prisma.colaborador.findFirst({
            where: {
              funcaoId: data.funcaoId,
              status: { not: PolicialStatus.DESATIVADO },
            },
          });

          if (jaExiste) {
            throw new BadRequestException(
              `Já existe um policial cadastrado com a função "${funcao.nome}". Não pode haver mais de um.`,
            );
          }
        }
      }
    }

    // Verificar se já existe um colaborador (ativo ou desativado) com a mesma matrícula
    const colaboradorExistente = await this.prisma.colaborador.findUnique({
      where: { matricula: matriculaNormalizada },
      include: { afastamentos: true },
    });

    if (colaboradorExistente) {
      if (colaboradorExistente.status === PolicialStatus.DESATIVADO) {
        // Colaborador existe mas está desativado - lançar erro especial para o frontend tratar
        const errorResponse = {
          message: 'COLABORADOR_DESATIVADO',
          colaborador: {
            id: colaboradorExistente.id,
            nome: colaboradorExistente.nome,
            matricula: colaboradorExistente.matricula,
            equipe: colaboradorExistente.equipe,
            status: colaboradorExistente.status,
            createdAt: colaboradorExistente.createdAt,
            updatedAt: colaboradorExistente.updatedAt,
          },
        };
        throw new ConflictException(errorResponse);
      } else {
        // Colaborador ativo já existe - bloquear cadastro
        throw new ConflictException(`Esta matrícula já está cadastrada no sistema. Não é possível cadastrar um colaborador com a mesma matrícula.`);
      }
    }

    const created = await this.prisma.colaborador.create({
      data: {
        nome: this.sanitizeNome(data.nome),
        matricula: matriculaNormalizada,
        status: data.status ?? PolicialStatus.ATIVO,
        equipe: data.equipe !== undefined ? data.equipe : (actor?.equipe ?? null),
        funcao: data.funcaoId ? { connect: { id: data.funcaoId } } : undefined,
        createdById: actor?.id ?? null,
        createdByName: actor?.nome ?? null,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      include: { afastamentos: true, funcao: true },
    });

    await this.audit.record({
      entity: 'Colaborador',
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      after: created,
    });

    return created;
  }

  async findAll(options?: { page?: number; pageSize?: number }): Promise<
    | ColaboradorWithRelations[]
    | {
        colaboradores: ColaboradorWithRelations[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }
  > {
    const { page, pageSize } = options || {};

    // Se não fornecer paginação, retornar todos (compatibilidade com código existente)
    if (page === undefined && pageSize === undefined) {
      return this.prisma.colaborador.findMany({
        where: { status: { not: PolicialStatus.DESATIVADO } },
        orderBy: { nome: 'asc' },
        include: { afastamentos: true, funcao: true },
      });
    }

    // Implementar paginação
    const currentPage = page || 1;
    const currentPageSize = pageSize || 10;
    const skip = (currentPage - 1) * currentPageSize;
    const take = currentPageSize;

    const where = { status: { not: PolicialStatus.DESATIVADO } };

    const [colaboradores, total] = await this.prisma.$transaction([
      this.prisma.colaborador.findMany({
        where,
        orderBy: { nome: 'asc' },
        include: { afastamentos: true, funcao: true },
        skip,
        take,
      }),
      this.prisma.colaborador.count({ where }),
    ]);

    return {
      colaboradores,
      total,
      page: currentPage,
      pageSize: currentPageSize,
      totalPages: Math.ceil(total / currentPageSize),
    };
  }

  async findOne(id: number): Promise<ColaboradorWithRelations> {
    const colaborador = await this.prisma.colaborador.findUnique({
      where: { id },
      include: { afastamentos: true, funcao: true },
    });

    if (!colaborador) {
      throw new NotFoundException(`Colaborador ${id} não encontrado.`);
    }

    return colaborador;
  }

  async update(
    id: number,
    data: UpdateColaboradorDto,
    responsavelId?: number,
  ): Promise<ColaboradorWithRelations> {
    // Validar que não pode haver mais de um CMT UPM ou SUBCMT UPM (apenas se a função estiver sendo alterada)
    if (data.funcaoId !== undefined && data.funcaoId !== null) {
      const funcao = await this.prisma.funcao.findUnique({
        where: { id: data.funcaoId },
      });

      if (funcao) {
        const funcaoUpper = funcao.nome.toUpperCase();
        if (funcaoUpper.includes('CMT UPM') || funcaoUpper.includes('SUBCMT UPM')) {
          // Verificar se já existe alguém com essa função (ativo), excluindo o próprio registro sendo atualizado
          const jaExiste = await this.prisma.colaborador.findFirst({
            where: {
              funcaoId: data.funcaoId,
              status: { not: PolicialStatus.DESATIVADO },
              id: { not: id },
            },
          });

          if (jaExiste) {
            throw new BadRequestException(
              `Já existe um policial cadastrado com a função "${funcao.nome}". Não pode haver mais de um.`,
            );
          }
        }
      }
    }
    const before = await this.prisma.colaborador.findUnique({
      where: { id },
      include: { afastamentos: true },
    });

    if (!before) {
      throw new NotFoundException(`Colaborador ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);

    const updateData: Prisma.ColaboradorUpdateInput = {
      updatedById: actor?.id ?? null,
      updatedByName: actor?.nome ?? null,
    };

    if (data.nome !== undefined) {
      updateData.nome = this.sanitizeNome(data.nome);
    }

    if (data.matricula !== undefined) {
      updateData.matricula = this.sanitizeMatricula(data.matricula);
    }

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    if (data.equipe !== undefined) {
      updateData.equipe = data.equipe;
    }

    if (data.fotoUrl !== undefined) {
      updateData.fotoUrl = data.fotoUrl;
    }

    if (data.funcaoId !== undefined) {
      if (data.funcaoId === null || data.funcaoId === 0) {
        updateData.funcao = { disconnect: true };
      } else {
        updateData.funcao = { connect: { id: data.funcaoId } };
      }
    }

    const updated = await this.prisma.colaborador.update({
      where: { id },
      data: updateData,
      include: { afastamentos: true, funcao: true },
    });

    await this.audit.record({
      entity: 'Colaborador',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    return updated;
  }

  async remove(id: number, responsavelId?: number): Promise<void> {
    const before = await this.prisma.colaborador.findUnique({
      where: { id },
      include: { afastamentos: true, funcao: true },
    });

    if (!before) {
      throw new NotFoundException(`Colaborador ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);

    const updated = await this.prisma.colaborador.update({
      where: { id },
      data: {
        status: PolicialStatus.DESATIVADO,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      include: { afastamentos: true, funcao: true },
    });

    await this.audit.record({
      entity: 'Colaborador',
      entityId: id,
      action: AuditAction.DELETE,
      actor,
      before,
      after: updated,
    });
  }

  async activate(id: number, responsavelId?: number): Promise<ColaboradorWithRelations> {
    const before = await this.prisma.colaborador.findUnique({
      where: { id },
      include: { afastamentos: true, funcao: true },
    });

    if (!before) {
      throw new NotFoundException(`Colaborador ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);

    const updated = await this.prisma.colaborador.update({
      where: { id },
      data: {
        status: PolicialStatus.ATIVO,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      include: { afastamentos: true, funcao: true },
    });

    await this.audit.record({
      entity: 'Colaborador',
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    return updated;
  }

  async createBulk(
    data: CreateColaboradoresBulkDto,
    responsavelId?: number,
  ): Promise<{ criados: number; erros: Array<{ matricula: string; erro: string }> }> {
    const actor = await this.audit.resolveActor(responsavelId);
    const erros: Array<{ matricula: string; erro: string }> = [];
    let criados = 0;

    for (const colaboradorData of data.colaboradores) {
      try {
        const matriculaNormalizada = this.sanitizeMatricula(colaboradorData.matricula);
        
        // Verificar se já existe
        const existe = await this.prisma.colaborador.findUnique({
          where: { matricula: matriculaNormalizada },
        });

        if (existe) {
          erros.push({
            matricula: colaboradorData.matricula,
            erro: 'Matrícula já existe no banco de dados',
          });
          continue;
        }

        const createData: Prisma.ColaboradorCreateInput = {
          nome: this.sanitizeNome(colaboradorData.nome),
          matricula: matriculaNormalizada,
          status: colaboradorData.status,
          equipe: colaboradorData.equipe !== undefined ? colaboradorData.equipe : (actor?.equipe ?? null),
          createdById: actor?.id ?? null,
          createdByName: actor?.nome ?? null,
          updatedById: actor?.id ?? null,
          updatedByName: actor?.nome ?? null,
        };

        if (colaboradorData.funcaoId) {
          createData.funcao = { connect: { id: colaboradorData.funcaoId } };
        }

        await this.prisma.colaborador.create({
          data: createData,
        });

        criados++;
      } catch (error) {
        erros.push({
          matricula: colaboradorData.matricula,
          erro: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    return { criados, erros };
  }
}

