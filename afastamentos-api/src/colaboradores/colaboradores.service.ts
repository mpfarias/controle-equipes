import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { AuditAction, Equipe, PolicialStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateColaboradorDto } from './dto/create-colaborador.dto';
import { UpdateColaboradorDto } from './dto/update-colaborador.dto';

type ColaboradorWithRelations = Prisma.ColaboradorGetPayload<{
  include: { afastamentos: true };
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
        // Colaborador ativo já existe
        throw new ConflictException('Já existe um colaborador ativo com esta matrícula.');
      }
    }

    const created = await this.prisma.colaborador.create({
      data: {
        nome: this.sanitizeNome(data.nome),
        matricula: matriculaNormalizada,
        status: data.status ?? PolicialStatus.ATIVO,
        equipe: data.equipe ?? actor?.equipe ?? Equipe.A,
        createdById: actor?.id ?? null,
        createdByName: actor?.nome ?? null,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      include: { afastamentos: true },
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

  async findAll(): Promise<ColaboradorWithRelations[]> {
    return this.prisma.colaborador.findMany({
      where: { status: { not: PolicialStatus.DESATIVADO } },
      orderBy: { nome: 'asc' },
      include: { afastamentos: true },
    });
  }

  async findOne(id: number): Promise<ColaboradorWithRelations> {
    const colaborador = await this.prisma.colaborador.findUnique({
      where: { id },
      include: { afastamentos: true },
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

    const updated = await this.prisma.colaborador.update({
      where: { id },
      data: updateData,
      include: { afastamentos: true },
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
      include: { afastamentos: true },
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
      include: { afastamentos: true },
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
      include: { afastamentos: true },
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
      include: { afastamentos: true },
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
}

