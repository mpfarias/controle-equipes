import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, UsuarioStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

type UsuarioEntity = Prisma.UsuarioGetPayload<{
  select: {
    id: true;
    nome: true;
    matricula: true;
    status: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

const usuarioSelect = {
  id: true,
  nome: true,
  matricula: true,
  equipe: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UsuarioSelect;

@Injectable()
export class UsuariosService {
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
    data: Omit<CreateUsuarioDto, 'responsavelId'>,
    responsavelId?: number,
  ): Promise<UsuarioEntity> {
    const actor = await this.audit.resolveActor(responsavelId);

    const created = await this.prisma.usuario.create({
      data: {
        nome: this.sanitizeNome(data.nome),
        matricula: this.sanitizeMatricula(data.matricula),
        senhaHash: data.senhaHash,
        equipe: data.equipe ?? 'A',
        status: UsuarioStatus.ATIVO,
        createdById: actor?.id ?? null,
        createdByName: actor?.nome ?? null,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      select: usuarioSelect,
    });

    await this.audit.record({
      entity: 'Usuario',
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      after: created,
    });

    return created;
  }

  async findAll(): Promise<UsuarioEntity[]> {
    return this.prisma.usuario.findMany({
      where: { status: UsuarioStatus.ATIVO },
      orderBy: { nome: 'asc' },
      select: usuarioSelect,
    });
  }

  async findOne(id: number): Promise<UsuarioEntity> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: usuarioSelect,
    });

    if (!usuario) {
      throw new NotFoundException(`Usuário ${id} não encontrado.`);
    }

    return usuario;
  }

  async update(
    id: number,
    data: UpdateUsuarioDto,
    responsavelId?: number,
  ): Promise<UsuarioEntity> {
    const before = await this.prisma.usuario.findUnique({
      where: { id },
      select: usuarioSelect,
    });

    if (!before) {
      throw new NotFoundException(`Usuário ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);

    const updateData: Prisma.UsuarioUpdateInput = {
      updatedById: actor?.id ?? null,
      updatedByName: actor?.nome ?? null,
    };

    if (data.nome !== undefined) {
      updateData.nome = this.sanitizeNome(data.nome);
    }

    if (data.matricula !== undefined) {
      updateData.matricula = this.sanitizeMatricula(data.matricula);
    }

    if (data.equipe !== undefined) {
      updateData.equipe = data.equipe;
    }

    if (data.senhaHash) {
      updateData.senhaHash = data.senhaHash;
    }

    const updated = await this.prisma.usuario.update({
      where: { id },
      data: updateData,
      select: usuarioSelect,
    });

    await this.audit.record({
      entity: 'Usuario',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    return updated;
  }

  async remove(id: number, responsavelId?: number): Promise<void> {
    const before = await this.prisma.usuario.findUnique({
      where: { id },
      select: usuarioSelect,
    });

    if (!before) {
      throw new NotFoundException(`Usuário ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);

    const updated = await this.prisma.usuario.update({
      where: { id },
      data: {
        status: UsuarioStatus.DESATIVADO,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      select: usuarioSelect,
    });

    await this.audit.record({
      entity: 'Usuario',
      entityId: id,
      action: AuditAction.DELETE,
      actor,
      before,
      after: updated,
    });
  }
}

