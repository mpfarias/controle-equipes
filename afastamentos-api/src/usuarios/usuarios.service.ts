import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditAction, PermissaoAcao, Prisma, UsuarioStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { DeleteUsuarioDto } from './dto/delete-usuario.dto';
import { CreateUsuarioNivelDto } from './dto/create-usuario-nivel.dto';
import { UpdateUsuarioNivelDto } from './dto/update-usuario-nivel.dto';
import { SetUsuarioNivelPermissoesDto } from './dto/set-usuario-nivel-permissoes.dto';
import { isSistemaExternoId } from './constants/sistemas-externos';
import { usuarioTemAcessoOrionSuporteEfetivo } from './orion-suporte-access.util';

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
      ativo: true,
      acessoOrionSuporte: true,
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
  fotoUrl: true,
  acessoOrionSuporte: true,
  sistemasPermitidos: true,
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

  private sanitizeNivelNome(nome: string): string {
    return nome.trim().toUpperCase();
  }

  private sanitizeEquipeNome(nome: string): string {
    return nome.trim().toUpperCase();
  }

  /** Normaliza lista de sistemas (únicos, só IDs válidos). */
  private normalizeSistemasPermitidos(ids?: string[]): string[] {
    if (!ids?.length) {
      return [];
    }
    const seen = new Set<string>();
    for (const raw of ids) {
      const id = String(raw).trim().toUpperCase();
      // Legado: um único código antigo vira Patrimônio + Operações
      if (id === 'PATRIMONIO_OPERACOES') {
        seen.add('ORION_PATRIMONIO');
        seen.add('OPERACOES');
        continue;
      }
      if (id === 'PATRIMONIO') {
        seen.add('ORION_PATRIMONIO');
        continue;
      }
      if (isSistemaExternoId(id)) {
        seen.add(id);
      }
    }
    return [...seen];
  }

  private async assertActorEhAdministrador(responsavelId?: number): Promise<void> {
    if (!responsavelId) {
      throw new UnauthorizedException('Não autenticado.');
    }
    const nivelAdmin = await this.prisma.usuarioNivel.findUnique({
      where: { nome: 'ADMINISTRADOR' },
      select: { id: true },
    });
    const actor = await this.prisma.usuario.findUnique({
      where: { id: responsavelId },
      select: { isAdmin: true, nivelId: true },
    });
    const ehAdmin =
      actor?.isAdmin === true ||
      (nivelAdmin != null && actor?.nivelId === nivelAdmin.id);
    if (!ehAdmin) {
      throw new ForbiddenException(
        'Apenas administradores podem gerir o acesso ao Órion Suporte no cadastro do usuário.',
      );
    }
  }

  /**
   * Na criação: não-admins só podem deixar herança (`undefined`/`null`);
   * valores explícitos `true`/`false` em `Usuario.acessoOrionSuporte` exigem administrador.
   */
  private async assertAdministradorSeOverrideOrionSuporteExplicitoNaCriacao(
    responsavelId: number | undefined,
    valor: boolean | null | undefined,
  ): Promise<void> {
    if (valor === true || valor === false) {
      await this.assertActorEhAdministrador(responsavelId);
    }
  }

  /** Permite `sistemasPermitidos` vazio quando houver acesso efetivo ao Órion Suporte. */
  private async assertSistemasIntegradosOuSuporte(
    nivelId: number,
    sistemasNorm: string[],
    acessoOrionSuporteUsuario: boolean | null,
    nivelCached?: { acessoOrionSuporte?: boolean | null } | null,
  ): Promise<void> {
    if (sistemasNorm.length > 0) {
      return;
    }
    const nivelRow =
      nivelCached !== undefined
        ? nivelCached
        : await this.prisma.usuarioNivel.findUnique({
            where: { id: nivelId },
            select: { acessoOrionSuporte: true },
          });
    const ok = usuarioTemAcessoOrionSuporteEfetivo({
      isAdmin: false,
      acessoOrionSuporte: acessoOrionSuporteUsuario,
      nivel: nivelRow ?? null,
    });
    if (!ok) {
      throw new BadRequestException(
        'Selecione ao menos um sistema integrado (SAD, Patrimônio, Operações, Órion Qualidade, Órion Jurídico, Órion Patrimônio) ou habilite o Órion Suporte para este perfil.',
      );
    }
  }

  private async ensureEquipeAtiva(nome: string): Promise<string> {
    const normalizado = this.sanitizeEquipeNome(nome);
    const equipe = await this.prisma.equipeOption.findFirst({
      where: { nome: normalizado, ativo: true },
      select: { id: true },
    });
    if (!equipe) {
      throw new BadRequestException('Equipe inválida ou inativa.');
    }
    return normalizado;
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

    const equipe = data.equipe ? await this.ensureEquipeAtiva(data.equipe) : null;
    await this.assertAdministradorSeOverrideOrionSuporteExplicitoNaCriacao(
      responsavelId,
      data.acessoOrionSuporte,
    );
    const acessoOrionSuporteGravar: boolean | null =
      data.acessoOrionSuporte === true
        ? true
        : data.acessoOrionSuporte === false
          ? false
          : null;
    const nivelJoin = await this.prisma.usuarioNivel.findUnique({
      where: { id: data.nivelId },
      select: { nome: true, acessoOrionSuporte: true },
    });
    const sistemasNorm = this.normalizeSistemasPermitidos(data.sistemasPermitidos);
    await this.assertSistemasIntegradosOuSuporte(
      data.nivelId,
      sistemasNorm,
      acessoOrionSuporteGravar,
      nivelJoin,
    );
    const created = await this.prisma.usuario.create({
      data: {
        nome: this.sanitizeNome(data.nome),
        matricula: this.sanitizeMatricula(data.matricula),
        senhaHash,
        perguntaSeguranca: data.perguntaSeguranca?.trim() || null,
        respostaSegurancaHash,
        equipe,
        nivel: { connect: { id: data.nivelId } },
        funcao: data.funcaoId ? { connect: { id: data.funcaoId } } : undefined,
        fotoUrl: data.fotoUrl ?? null,
        acessoOrionSuporte: acessoOrionSuporteGravar,
        sistemasPermitidos: sistemasNorm,
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

  async createNivel(
    data: CreateUsuarioNivelDto,
    responsavelId?: number,
  ) {
    const actor = await this.audit.resolveActor(responsavelId);
    const nome = this.sanitizeNivelNome(data.nome);

    const existente = await this.prisma.usuarioNivel.findUnique({
      where: { nome },
    });

    if (existente) {
      throw new ConflictException('Já existe um nível de acesso com esse nome.');
    }

    const created = await this.prisma.usuarioNivel.create({
      data: {
        nome,
        descricao: data.descricao?.trim() || null,
        ativo: true,
        acessoOrionSuporte: data.acessoOrionSuporte === true,
      },
    });

    await this.audit.record({
      entity: 'UsuarioNivel',
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      after: created,
    });

    return created;
  }

  async updateNivel(
    id: number,
    data: UpdateUsuarioNivelDto,
    responsavelId?: number,
  ) {
    const before = await this.prisma.usuarioNivel.findUnique({
      where: { id },
    });

    if (!before) {
      throw new NotFoundException(`Nível de acesso ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);
    const updateData: Prisma.UsuarioNivelUpdateInput = {};

    if (data.nome !== undefined) {
      const nome = this.sanitizeNivelNome(data.nome);
      if (nome !== before.nome) {
        const existente = await this.prisma.usuarioNivel.findUnique({
          where: { nome },
        });
        if (existente) {
          throw new ConflictException('Já existe um nível de acesso com esse nome.');
        }
      }
      updateData.nome = nome;
    }

    if (data.descricao !== undefined) {
      updateData.descricao = data.descricao?.trim() || null;
    }

    if (data.acessoOrionSuporte !== undefined) {
      updateData.acessoOrionSuporte = data.acessoOrionSuporte;
    }

    const updated = await this.prisma.usuarioNivel.update({
      where: { id },
      data: updateData,
    });

    await this.audit.record({
      entity: 'UsuarioNivel',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    return updated;
  }

  async listNivelPermissoes(nivelId: number) {
    const nivel = await this.prisma.usuarioNivel.findUnique({
      where: { id: nivelId },
      select: { id: true },
    });

    if (!nivel) {
      throw new NotFoundException(`Nível de acesso ${nivelId} não encontrado.`);
    }

    return this.prisma.usuarioNivelPermissao.findMany({
      where: { nivelId },
      select: { telaKey: true, acao: true },
      orderBy: [{ telaKey: 'asc' }, { acao: 'asc' }],
    });
  }

  async setNivelPermissoes(
    nivelId: number,
    data: SetUsuarioNivelPermissoesDto,
    responsavelId?: number,
  ) {
    const nivel = await this.prisma.usuarioNivel.findUnique({
      where: { id: nivelId },
      select: { id: true, nome: true },
    });

    if (!nivel) {
      throw new NotFoundException(`Nível de acesso ${nivelId} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);
    const before = await this.prisma.usuarioNivelPermissao.findMany({
      where: { nivelId },
      select: { telaKey: true, acao: true },
      orderBy: [{ telaKey: 'asc' }, { acao: 'asc' }],
    });

    const itens = data.itens.map((item) => ({
      nivelId,
      telaKey: item.telaKey,
      acao: item.acao as PermissaoAcao,
    }));

    await this.prisma.$transaction([
      this.prisma.usuarioNivelPermissao.deleteMany({ where: { nivelId } }),
      ...(itens.length > 0 ? [this.prisma.usuarioNivelPermissao.createMany({ data: itens })] : []),
    ]);

    const after = await this.prisma.usuarioNivelPermissao.findMany({
      where: { nivelId },
      select: { telaKey: true, acao: true },
      orderBy: [{ telaKey: 'asc' }, { acao: 'asc' }],
    });

    await this.audit.record({
      entity: 'UsuarioNivelPermissao',
      entityId: nivelId,
      action: AuditAction.UPDATE,
      actor,
      before,
      after,
    });

    return after;
  }

  async disableNivel(id: number, responsavelId?: number) {
    const before = await this.prisma.usuarioNivel.findUnique({
      where: { id },
    });

    if (!before) {
      throw new NotFoundException(`Nível de acesso ${id} não encontrado.`);
    }

    if (before.ativo === false) {
      return before;
    }

    const actor = await this.audit.resolveActor(responsavelId);
    const updated = await this.prisma.usuarioNivel.update({
      where: { id },
      data: { ativo: false },
    });

    await this.audit.record({
      entity: 'UsuarioNivel',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    return updated;
  }

  async deleteNivel(id: number, responsavelId?: number) {
    const before = await this.prisma.usuarioNivel.findUnique({
      where: { id },
    });

    if (!before) {
      throw new NotFoundException(`Nível de acesso ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);

    // Desvincular usuários deste nível (eles serão bloqueados no próximo login)
    await this.prisma.usuario.updateMany({
      where: { nivelId: id },
      data: {
        nivelId: null,
        nivelRemovidoEm: new Date(),
      },
    });

    const deleted = await this.prisma.usuarioNivel.delete({
      where: { id },
    });

    await this.audit.record({
      entity: 'UsuarioNivel',
      entityId: id,
      action: AuditAction.DELETE,
      actor,
      before,
      after: deleted,
    });

    return deleted;
  }

  async listFuncoes(): Promise<{ id: number; nome: string; descricao: string | null; ativo: boolean }[]> {
    return this.prisma.funcao.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        descricao: true,
        ativo: true,
      },
      orderBy: { nome: 'asc' },
    });
  }

  async createFuncao(
    data: { nome: string; descricao?: string | null },
    responsavelId?: number,
  ) {
    const nome = data.nome.trim().toUpperCase();
    const existente = await this.prisma.funcao.findUnique({
      where: { nome },
    });
    if (existente) {
      throw new ConflictException('Já existe uma função com esse nome.');
    }
    const actor = await this.audit.resolveActor(responsavelId);
    const created = await this.prisma.funcao.create({
      data: {
        nome,
        descricao: data.descricao?.trim() || null,
      },
    });
    await this.audit.record({
      entity: 'Funcao',
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      after: created,
    });
    return created;
  }

  async updateFuncao(
    id: number,
    data: { nome?: string; descricao?: string | null },
    responsavelId?: number,
  ) {
    const before = await this.prisma.funcao.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException(`Função ${id} não encontrada.`);
    }
    const nome = data.nome ? data.nome.trim().toUpperCase() : before.nome;
    if (nome !== before.nome) {
      const existente = await this.prisma.funcao.findUnique({ where: { nome } });
      if (existente) {
        throw new ConflictException('Já existe uma função com esse nome.');
      }
    }
    const actor = await this.audit.resolveActor(responsavelId);
    const updated = await this.prisma.funcao.update({
      where: { id },
      data: {
        nome,
        descricao:
          data.descricao === undefined ? before.descricao : data.descricao?.trim() || null,
      },
    });
    await this.audit.record({
      entity: 'Funcao',
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });
    return updated;
  }

  async disableFuncao(id: number, responsavelId?: number) {
    const before = await this.prisma.funcao.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException(`Função ${id} não encontrada.`);
    }
    const actor = await this.audit.resolveActor(responsavelId);
    const updated = await this.prisma.funcao.update({
      where: { id },
      data: { ativo: false },
    });
    await this.audit.record({
      entity: 'Funcao',
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });
    return updated;
  }

  async deleteFuncao(id: number, responsavelId?: number) {
    const before = await this.prisma.funcao.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException(`Função ${id} não encontrada.`);
    }
    const usuariosVinculados = await this.prisma.usuario.count({ where: { funcaoId: id } });
    const policiaisVinculados = await this.prisma.policial.count({ where: { funcaoId: id } });
    if (usuariosVinculados > 0 || policiaisVinculados > 0) {
      throw new ConflictException('Não é possível excluir uma função em uso.');
    }
    const actor = await this.audit.resolveActor(responsavelId);
    const deleted = await this.prisma.funcao.delete({ where: { id } });
    await this.audit.record({
      entity: 'Funcao',
      entityId: id,
      action: AuditAction.DELETE,
      actor,
      before,
      after: deleted,
    });
    return deleted;
  }

  async listEquipes() {
    return this.prisma.equipeOption.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async createEquipe(
    data: { nome: string; descricao?: string | null },
    responsavelId?: number,
  ) {
    const nome = this.sanitizeEquipeNome(data.nome);
    const existente = await this.prisma.equipeOption.findUnique({
      where: { nome },
    });
    if (existente) {
      throw new ConflictException('Já existe uma equipe com esse nome.');
    }
    const actor = await this.audit.resolveActor(responsavelId);
    const created = await this.prisma.equipeOption.create({
      data: {
        nome,
        descricao: data.descricao?.trim() || null,
      },
    });
    await this.audit.record({
      entity: 'EquipeOption',
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      after: created,
    });
    return created;
  }

  async updateEquipe(
    id: number,
    data: { nome?: string; descricao?: string | null },
    responsavelId?: number,
  ) {
    const before = await this.prisma.equipeOption.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException(`Equipe ${id} não encontrada.`);
    }
    const nome = data.nome ? this.sanitizeEquipeNome(data.nome) : before.nome;
    if (nome !== before.nome) {
      const existente = await this.prisma.equipeOption.findUnique({ where: { nome } });
      if (existente) {
        throw new ConflictException('Já existe uma equipe com esse nome.');
      }
    }
    const actor = await this.audit.resolveActor(responsavelId);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (nome !== before.nome) {
        await tx.usuario.updateMany({
          where: { equipe: before.nome },
          data: { equipe: nome },
        });
        await tx.policial.updateMany({
          where: { equipe: before.nome },
          data: { equipe: nome },
        });
      }
      return tx.equipeOption.update({
        where: { id },
        data: {
          nome,
          descricao:
            data.descricao === undefined ? before.descricao : data.descricao?.trim() || null,
        },
      });
    });
    await this.audit.record({
      entity: 'EquipeOption',
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });
    return updated;
  }

  async disableEquipe(id: number, responsavelId?: number) {
    const before = await this.prisma.equipeOption.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException(`Equipe ${id} não encontrada.`);
    }
    const actor = await this.audit.resolveActor(responsavelId);
    const updated = await this.prisma.equipeOption.update({
      where: { id },
      data: { ativo: false },
    });
    await this.audit.record({
      entity: 'EquipeOption',
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });
    return updated;
  }

  async deleteEquipe(id: number, responsavelId?: number) {
    const before = await this.prisma.equipeOption.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException(`Equipe ${id} não encontrada.`);
    }
    const usuariosVinculados = await this.prisma.usuario.count({ where: { equipe: before.nome } });
    const policiaisVinculados = await this.prisma.policial.count({ where: { equipe: before.nome } });
    if (usuariosVinculados > 0 || policiaisVinculados > 0) {
      throw new ConflictException('Não é possível excluir uma equipe em uso.');
    }
    const actor = await this.audit.resolveActor(responsavelId);
    const deleted = await this.prisma.equipeOption.delete({ where: { id } });
    await this.audit.record({
      entity: 'EquipeOption',
      entityId: id,
      action: AuditAction.DELETE,
      actor,
      before,
      after: deleted,
    });
    return deleted;
  }

  async listPerguntasSeguranca() {
    return this.prisma.perguntaSeguranca.findMany({
      orderBy: { texto: 'asc' },
    });
  }

  async createPerguntaSeguranca(
    data: { texto: string },
    responsavelId?: number,
  ) {
    const texto = data.texto.trim();
    if (!texto) {
      throw new BadRequestException('Informe a pergunta de segurança.');
    }
    const existente = await this.prisma.perguntaSeguranca.findUnique({
      where: { texto },
    });
    if (existente) {
      throw new ConflictException('Já existe essa pergunta de segurança.');
    }
    const actor = await this.audit.resolveActor(responsavelId);
    const created = await this.prisma.perguntaSeguranca.create({
      data: { texto },
    });
    await this.audit.record({
      entity: 'PerguntaSeguranca',
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      after: created,
    });
    return created;
  }

  async updatePerguntaSeguranca(
    id: number,
    data: { texto?: string },
    responsavelId?: number,
  ) {
    const before = await this.prisma.perguntaSeguranca.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException(`Pergunta ${id} não encontrada.`);
    }
    const texto = data.texto ? data.texto.trim() : before.texto;
    if (!texto) {
      throw new BadRequestException('Informe a pergunta de segurança.');
    }
    if (texto !== before.texto) {
      const existente = await this.prisma.perguntaSeguranca.findUnique({ where: { texto } });
      if (existente) {
        throw new ConflictException('Já existe essa pergunta de segurança.');
      }
    }
    const actor = await this.audit.resolveActor(responsavelId);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (texto !== before.texto) {
        await tx.usuario.updateMany({
          where: { perguntaSeguranca: before.texto },
          data: { perguntaSeguranca: texto },
        });
      }
      return tx.perguntaSeguranca.update({
        where: { id },
        data: { texto },
      });
    });
    await this.audit.record({
      entity: 'PerguntaSeguranca',
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });
    return updated;
  }

  async disablePerguntaSeguranca(id: number, responsavelId?: number) {
    const before = await this.prisma.perguntaSeguranca.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException(`Pergunta ${id} não encontrada.`);
    }
    const actor = await this.audit.resolveActor(responsavelId);
    const updated = await this.prisma.perguntaSeguranca.update({
      where: { id },
      data: { ativo: false },
    });
    await this.audit.record({
      entity: 'PerguntaSeguranca',
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });
    return updated;
  }

  async deletePerguntaSeguranca(id: number, responsavelId?: number) {
    const before = await this.prisma.perguntaSeguranca.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException(`Pergunta ${id} não encontrada.`);
    }
    const usuariosVinculados = await this.prisma.usuario.count({
      where: { perguntaSeguranca: before.texto },
    });
    if (usuariosVinculados > 0) {
      throw new ConflictException('Não é possível excluir uma pergunta em uso.');
    }
    const actor = await this.audit.resolveActor(responsavelId);
    const deleted = await this.prisma.perguntaSeguranca.delete({ where: { id } });
    await this.audit.record({
      entity: 'PerguntaSeguranca',
      entityId: id,
      action: AuditAction.DELETE,
      actor,
      before,
      after: deleted,
    });
    return deleted;
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
      updateData.equipe = data.equipe ? await this.ensureEquipeAtiva(data.equipe) : null;
    }

    if (data.nivelId !== undefined && data.nivelId !== null && data.nivelId > 0) {
      // nivelId é obrigatório, então sempre connecta quando fornecido
      updateData.nivel = { connect: { id: data.nivelId } };
      updateData.nivelRemovidoEm = null; // Limpar flag quando novo nível é atribuído
    }

    if (data.funcaoId !== undefined) {
      if (data.funcaoId === null || data.funcaoId === 0) {
        updateData.funcao = { disconnect: true };
      } else {
        updateData.funcao = { connect: { id: data.funcaoId } };
      }
    }

    if (data.fotoUrl !== undefined) {
      updateData.fotoUrl = data.fotoUrl;
    }

    if (data.sistemasPermitidos !== undefined) {
      updateData.sistemasPermitidos = this.normalizeSistemasPermitidos(data.sistemasPermitidos);
    }

    if (data.acessoOrionSuporte !== undefined) {
      await this.assertActorEhAdministrador(responsavelId);
      updateData.acessoOrionSuporte = data.acessoOrionSuporte;
    }

    if (data.senha) {
      // Fazer hash da nova senha antes de salvar
      updateData.senhaHash = await bcrypt.hash(data.senha, 10);
    }

    const sistemasFinais =
      data.sistemasPermitidos !== undefined
        ? this.normalizeSistemasPermitidos(data.sistemasPermitidos)
        : [...(before.sistemasPermitidos ?? [])];
    const nivelIdFinal =
      data.nivelId !== undefined && data.nivelId !== null && data.nivelId > 0
        ? data.nivelId
        : before.nivelId ?? 0;
    const acessoFinal =
      data.acessoOrionSuporte !== undefined ? data.acessoOrionSuporte : before.acessoOrionSuporte;

    if (
      (data.sistemasPermitidos !== undefined ||
        data.nivelId !== undefined ||
        data.acessoOrionSuporte !== undefined) &&
      nivelIdFinal > 0
    ) {
      const nivelRow = await this.prisma.usuarioNivel.findUnique({
        where: { id: nivelIdFinal },
        select: { nome: true, acessoOrionSuporte: true },
      });
      await this.assertSistemasIntegradosOuSuporte(
        nivelIdFinal,
        sistemasFinais,
        acessoFinal ?? null,
        nivelRow,
      );
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

