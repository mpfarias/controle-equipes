import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuditAction, Prisma, UsuarioStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { DeleteUsuarioDto } from './dto/delete-usuario.dto';

type UsuarioEntity = Prisma.UsuarioGetPayload<{
  select: typeof usuarioSelect;
}>;

const usuarioSelect = {
  id: true,
  nome: true,
  matricula: true,
  perguntaSeguranca: true,
  equipe: true,
  status: true,
  isAdmin: true,
  nivelId: true,
  nivel: {
    select: {
      id: true,
      nome: true,
      descricao: true,
    },
  },
  funcaoId: true,
  funcao: {
    select: {
      id: true,
      nome: true,
      descricao: true,
    },
  },
  createdById: true,
  createdByName: true,
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

    // Fazer hash da senha antes de salvar
    const senhaHash = await bcrypt.hash(data.senha, 10);

    // Fazer hash da resposta de segurança se fornecida
    const respostaSegurancaHash = data.respostaSeguranca
      ? await bcrypt.hash(data.respostaSeguranca.trim().toLowerCase(), 10)
      : null;

    const created = await this.prisma.usuario.create({
      data: {
        nome: this.sanitizeNome(data.nome),
        matricula: this.sanitizeMatricula(data.matricula),
        senhaHash,
        perguntaSeguranca: data.perguntaSeguranca?.trim() || null,
        respostaSegurancaHash,
        equipe: data.equipe ?? 'A',
        nivel: { connect: { id: data.nivelId } },
        funcao: data.funcaoId ? { connect: { id: data.funcaoId } } : undefined,
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

  async findAll(
    currentUserId?: number,
    options?: { page?: number; pageSize?: number },
  ): Promise<
    | UsuarioEntity[]
    | {
        usuarios: UsuarioEntity[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }
  > {
    // Buscar o nível ADMINISTRADOR
    const nivelAdmin = await this.prisma.usuarioNivel.findUnique({
      where: { nome: 'ADMINISTRADOR' },
    });

    // Se um currentUserId foi fornecido, verificar se é admin
    let includeAdmins: boolean = false;
    if (currentUserId) {
      const currentUser = await this.prisma.usuario.findUnique({
        where: { id: currentUserId },
        include: { nivel: true },
      });
      // Verificar se o usuário tem nível ADMINISTRADOR ou isAdmin: true
      includeAdmins =
        ((currentUser as any)?.isAdmin === true) ||
        (nivelAdmin ? (currentUser as any)?.nivelId === nivelAdmin.id : false);
    }

    const whereClause = includeAdmins
      ? {} // Se for admin, mostrar todos os usuários
      : nivelAdmin
        ? {
            NOT: {
              OR: [{ isAdmin: true }, { nivelId: nivelAdmin.id }],
            },
          } // Se não for admin, ocultar administradores (tanto por isAdmin quanto por nivelId)
        : { isAdmin: false }; // Fallback se não encontrar o nível

    const { page, pageSize } = options || {};

    // Se não fornecer paginação, retornar todos (compatibilidade com código existente)
    if (page === undefined && pageSize === undefined) {
      return this.prisma.usuario.findMany({
        where: whereClause,
        orderBy: { nome: 'asc' },
        select: usuarioSelect,
      });
    }

    // Implementar paginação
    const currentPage = page || 1;
    const currentPageSize = pageSize || 10;
    const skip = (currentPage - 1) * currentPageSize;
    const take = currentPageSize;

    const [usuarios, total] = await this.prisma.$transaction([
      this.prisma.usuario.findMany({
        where: whereClause,
        orderBy: { nome: 'asc' },
        select: usuarioSelect,
        skip,
        take,
      }),
      this.prisma.usuario.count({ where: whereClause }),
    ]);

    return {
      usuarios,
      total,
      page: currentPage,
      pageSize: currentPageSize,
      totalPages: Math.ceil(total / currentPageSize),
    };
  }

  async findNiveis() {
    return this.prisma.usuarioNivel.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async listFuncoes(): Promise<{ id: number; nome: string; descricao: string | null }[]> {
    return this.prisma.funcao.findMany({
      select: {
        id: true,
        nome: true,
        descricao: true,
      },
      orderBy: { id: 'asc' },
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

    if (data.perguntaSeguranca !== undefined) {
      updateData.perguntaSeguranca = data.perguntaSeguranca.trim() || null;
    }

    if (data.respostaSeguranca) {
      // Fazer hash da nova resposta de segurança
      updateData.respostaSegurancaHash = await bcrypt.hash(
        data.respostaSeguranca.trim().toLowerCase(),
        10,
      );
    }

    if (data.equipe !== undefined) {
      updateData.equipe = data.equipe;
    }

    if (data.nivelId !== undefined && data.nivelId !== null && data.nivelId > 0) {
      // nivelId é obrigatório, então sempre conecta quando fornecido
      updateData.nivel = { connect: { id: data.nivelId } };
    }

    if (data.funcaoId !== undefined) {
      if (data.funcaoId === null || data.funcaoId === 0) {
        updateData.funcao = { disconnect: true };
      } else {
        updateData.funcao = { connect: { id: data.funcaoId } };
      }
    }

    if (data.senha) {
      // Fazer hash da nova senha antes de salvar
      updateData.senhaHash = await bcrypt.hash(data.senha, 10);
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

  async activate(id: number, responsavelId?: number): Promise<UsuarioEntity> {
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
        status: UsuarioStatus.ATIVO,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      select: usuarioSelect,
    });

    await this.audit.record({
      entity: 'Usuario',
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    return updated;
  }

  async delete(id: number, data: DeleteUsuarioDto): Promise<void> {
    const before = await this.prisma.usuario.findUnique({
      where: { id },
      select: usuarioSelect,
    });

    if (!before) {
      throw new NotFoundException(`Usuário ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(data.responsavelId);

    if (!actor) {
      throw new UnauthorizedException('Usuário responsável não encontrado.');
    }

    // Buscar um usuário administrador para validar a senha
    const admin = await this.prisma.usuario.findFirst({
      where: {
        isAdmin: true,
        status: UsuarioStatus.ATIVO,
      },
      select: { id: true, nome: true, matricula: true, senhaHash: true },
    });

    if (!admin) {
      throw new UnauthorizedException('Nenhum administrador encontrado no sistema.');
    }

    // Validar senha do administrador
    const senhaCorreta = await bcrypt.compare(data.senha, admin.senhaHash);
    if (!senhaCorreta) {
      await this.audit.record({
        entity: 'Usuario',
        entityId: id,
        action: AuditAction.DELETE,
        actor,
        before,
        after: { erro: 'Senha de administrador inválida para exclusão' },
      });
      throw new UnauthorizedException('Senha de administrador inválida.');
    }

    // Deletar permanentemente do banco de dados
    await this.prisma.usuario.delete({
      where: { id },
    });

    await this.audit.record({
      entity: 'Usuario',
      entityId: id,
      action: AuditAction.DELETE,
      actor,
      before,
      after: { deletado: true, confirmadoPorSenha: true },
    });
  }
}

