import { Injectable, NotFoundException, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuditAction, Equipe, PolicialStatus, Prisma, UsuarioStatus, Usuario } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePolicialDto } from './dto/create-policial.dto';
import { UpdatePolicialDto } from './dto/update-policial.dto';
import { CreatePoliciaisBulkDto } from './dto/create-policiais-bulk.dto';
import { DeletePolicialDto } from './dto/delete-policial.dto';
import * as bcrypt from 'bcryptjs';

type PolicialWithRelations = Prisma.PolicialGetPayload<{
  include: { afastamentos: true; funcao: true; restricaoMedica: true };
}>;

@Injectable()
export class PoliciaisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private sanitizeNome(nome: string): string {
    return nome.trim().toUpperCase();
  }

  private sanitizeMatricula(matricula: string): string {
    const cleaned = matricula.trim().toUpperCase().replace(/[^0-9X]/g, '');
    // Remover zeros Ã  esquerda, exceto se a matrÃ­cula comeÃ§ar com X ou for apenas zeros
    if (cleaned.startsWith('X')) {
      return cleaned; // MatrÃ­culas que comeÃ§am com X nÃ£o devem ter zeros removidos
    }
    // Remover zeros Ã  esquerda
    const withoutLeadingZeros = cleaned.replace(/^0+/, '');
    // Se ficou vazio, significa que era sÃ³ zeros, retornar '0'
    return withoutLeadingZeros || '0';
  }

  /**
   * Normaliza matrÃ­cula para comparaÃ§Ã£o, removendo zeros Ã  esquerda
   * Usado para buscar matrÃ­culas equivalentes (ex: "00219045" = "219045")
   */
  private normalizeMatriculaForComparison(matricula: string): string {
    const cleaned = matricula.trim().toUpperCase().replace(/[^0-9X]/g, '');
    if (cleaned.startsWith('X')) {
      return cleaned;
    }
    const withoutLeadingZeros = cleaned.replace(/^0+/, '');
    return withoutLeadingZeros || '0';
  }

  async create(
    data: Omit<CreatePolicialDto, 'responsavelId'>,
    responsavelId?: number,
  ): Promise<PolicialWithRelations> {
    const actor = await this.audit.resolveActor(responsavelId);
    const matriculaNormalizada = this.sanitizeMatricula(data.matricula);

    // Validar que nÃ£o pode haver mais de um CMT UPM ou SUBCMT UPM
    if (data.funcaoId) {
      const funcao = await this.prisma.funcao.findUnique({
        where: { id: data.funcaoId },
      });

      if (funcao) {
        const funcaoUpper = funcao.nome.toUpperCase();
        if (funcaoUpper.includes('CMT UPM') || funcaoUpper.includes('SUBCMT UPM')) {
          // Verificar se jÃ¡ existe alguÃ©m com essa funÃ§Ã£o (ativo)
          const jaExiste = await this.prisma.policial.findFirst({
            where: {
              funcaoId: data.funcaoId,
              status: { not: PolicialStatus.DESATIVADO },
            },
          });

          if (jaExiste) {
            throw new BadRequestException(
              `JÃ¡ existe um policial cadastrado com a funÃ§Ã£o "${funcao.nome}". NÃ£o pode haver mais de um.`,
            );
          }
        }
      }
    }

    // Verificar se jÃ¡ existe um Policial (ativo ou desativado) com a mesma matrÃ­cula
    // Buscar usando a matrÃ­cula normalizada exata primeiro
    let policialExistente = await this.prisma.policial.findUnique({
      where: { matricula: matriculaNormalizada },
      include: { afastamentos: true },
    });

    // Se não encontrou com a matrícula exata, buscar por matrículas equivalentes
    // (sem zeros à esquerda) para evitar duplicatas como "00219045" vs "219045"
    if (!policialExistente) {
      const matriculaParaComparacao = this.normalizeMatriculaForComparison(matriculaNormalizada);
      
      // Buscar todos os policiais e comparar matrículas normalizadas
      const todosPoliciais = await this.prisma.policial.findMany({
        include: { afastamentos: true },
      });

      policialExistente = todosPoliciais.find((policial) => {
        const matriculaPolicialNormalizada = this.normalizeMatriculaForComparison(policial.matricula);
        return matriculaPolicialNormalizada === matriculaParaComparacao;
      }) || null;
    }

    if (policialExistente) {
      if (policialExistente.status === PolicialStatus.DESATIVADO) {
        // Policial existe mas está desativado - lançar erro especial para o frontend tratar
        const errorResponse = {
          message: 'POLICIAL_DESATIVADO',
          policial: {
            id: policialExistente.id,
            nome: policialExistente.nome,
            matricula: policialExistente.matricula,
            equipe: policialExistente.equipe,
            status: policialExistente.status,
            createdAt: policialExistente.createdAt,
            updatedAt: policialExistente.updatedAt,
          },
        };
        throw new ConflictException(errorResponse);
      } else {
        // Policial ativo já existe - bloquear cadastro
        throw new ConflictException(`Esta matrícula já está cadastrada no sistema. Não é possível cadastrar um policial com a mesma matrícula.`);
      }
    }

    const created = await this.prisma.policial.create({
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
      include: { afastamentos: true, funcao: true, restricaoMedica: true },
    });

    await this.audit.record({
      entity: 'Policial',
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      after: created,
    });

    return created;
  }

  async findAll(options?: { page?: number; pageSize?: number }): Promise<
    | PolicialWithRelations[]
    | {
        Policiales: PolicialWithRelations[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }
  > {
    const { page, pageSize } = options || {};

    // Se nÃ£o fornecer paginaÃ§Ã£o, retornar todos (incluindo desativados)
    if (page === undefined && pageSize === undefined) {
      return this.prisma.policial.findMany({
        orderBy: { nome: 'asc' },
        include: { afastamentos: true, funcao: true, restricaoMedica: true },
      });
    }

    // Implementar paginaÃ§Ã£o
    const currentPage = page || 1;
    const currentPageSize = pageSize || 10;
    const skip = (currentPage - 1) * currentPageSize;
    const take = currentPageSize;

    const where = {}; // Removido filtro de desativados para mostrar todos

    const [Policiales, total] = await this.prisma.$transaction([
      this.prisma.policial.findMany({
        where,
        orderBy: { nome: 'asc' },
        include: { afastamentos: true, funcao: true, restricaoMedica: true },
        skip,
        take,
      }),
      this.prisma.policial.count({ where }),
    ]);

    return {
      Policiales,
      total,
      page: currentPage,
      pageSize: currentPageSize,
      totalPages: Math.ceil(total / currentPageSize),
    };
  }

  async findOne(id: number): Promise<PolicialWithRelations> {
    const policial = await this.prisma.policial.findUnique({
      where: { id },
      include: { afastamentos: true, funcao: true, restricaoMedica: true },
    });

    if (!policial) {
      throw new NotFoundException(`Policial ${id} não encontrado.`);
    }

    return policial;
  }

  async update(
    id: number,
    data: UpdatePolicialDto,
    responsavelId?: number,
  ): Promise<PolicialWithRelations> {
    // Validar que nÃ£o pode haver mais de um CMT UPM ou SUBCMT UPM (apenas se a funÃ§Ã£o estiver sendo alterada)
    if (data.funcaoId !== undefined && data.funcaoId !== null) {
      const funcao = await this.prisma.funcao.findUnique({
        where: { id: data.funcaoId },
      });

      if (funcao) {
        const funcaoUpper = funcao.nome.toUpperCase();
        if (funcaoUpper.includes('CMT UPM') || funcaoUpper.includes('SUBCMT UPM')) {
          // Verificar se jÃ¡ existe alguÃ©m com essa funÃ§Ã£o (ativo), excluindo o prÃ³prio registro sendo atualizado
          const jaExiste = await this.prisma.policial.findFirst({
            where: {
              funcaoId: data.funcaoId,
              status: { not: PolicialStatus.DESATIVADO },
              id: { not: id },
            },
          });

          if (jaExiste) {
            throw new BadRequestException(
              `JÃ¡ existe um policial cadastrado com a funÃ§Ã£o "${funcao.nome}". NÃ£o pode haver mais de um.`,
            );
          }
        }
      }
    }
    const before = await this.prisma.policial.findUnique({
      where: { id },
      include: { afastamentos: true },
    });

    if (!before) {
        throw new NotFoundException(`Policial ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);

    // Validar matrÃ­cula se estiver sendo alterada
    if (data.matricula !== undefined) {
      const matriculaNormalizada = this.sanitizeMatricula(data.matricula);
      const matriculaAtualNormalizada = this.normalizeMatriculaForComparison(before.matricula);
      const novaMatriculaNormalizada = this.normalizeMatriculaForComparison(matriculaNormalizada);
      
      // Verificar se a nova matrÃ­cula jÃ¡ existe em outro Policial (diferente do atual)
      // Comparar usando normalizaÃ§Ã£o sem zeros Ã  esquerda
      if (novaMatriculaNormalizada !== matriculaAtualNormalizada) {
        // Buscar usando a matrÃ­cula normalizada exata primeiro
        let policialComMatricula = await this.prisma.policial.findUnique({
          where: { matricula: matriculaNormalizada },
        });

        // Se nÃ£o encontrou com a matrÃ­cula exata, buscar por matrÃ­culas equivalentes
        if (!policialComMatricula || policialComMatricula.id === id) {
          const todosPoliciais = await this.prisma.policial.findMany();

          policialComMatricula = todosPoliciais.find((policial) => {
            if (policial.id === id) return false; // Ignorar o próprio policial
            const matriculaPolicialNormalizada = this.normalizeMatriculaForComparison(policial.matricula);
            return matriculaPolicialNormalizada === novaMatriculaNormalizada;
          }) || null;
        }

        if (policialComMatricula && policialComMatricula.id !== id) {
          if (policialComMatricula.status === PolicialStatus.DESATIVADO) {
            // Policial existe mas estÃ¡ desativado - lanÃ§ar erro especial para o frontend tratar
            const errorResponse = {
              message: 'POLICIAL_DESATIVADO',
              policial: {
                id: policialComMatricula.id,
                nome: policialComMatricula.nome,
                matricula: policialComMatricula.matricula,
                equipe: policialComMatricula.equipe,
                status: policialComMatricula.status,
                createdAt: policialComMatricula.createdAt,
                updatedAt: policialComMatricula.updatedAt,
              },
            };
            throw new ConflictException(errorResponse);
          } else {
            // Policial ativo jÃ¡ existe - bloquear atualizaÃ§Ã£o
            throw new ConflictException(
              `Esta matrÃ­cula jÃ¡ estÃ¡ cadastrada no sistema. NÃ£o Ã© possÃ­vel alterar a matrÃ­cula para uma que jÃ¡ existe.`,
            );
          }
        }
      }
    }

    const updateData: Prisma.PolicialUpdateInput = {
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

    const updated = await this.prisma.policial.update({
      where: { id },
      data: updateData,
      include: { afastamentos: true, funcao: true, restricaoMedica: true },
    });

    await this.audit.record({
      entity: 'Policial',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    return updated;
  }

  async remove(id: number, responsavelId?: number): Promise<void> {
    const before = await this.prisma.policial.findUnique({
      where: { id },
      include: { afastamentos: true, funcao: true },
    });

    if (!before) {
        throw new NotFoundException(`Policial ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);

    const updated = await this.prisma.policial.update({
      where: { id },
      data: {
        status: PolicialStatus.DESATIVADO,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      include: { afastamentos: true, funcao: true, restricaoMedica: true },
    });

    await this.audit.record({
      entity: 'Policial',
      entityId: id,
      action: AuditAction.DELETE,
      actor,
      before,
      after: updated,
    });
  }

  async activate(id: number, responsavelId?: number): Promise<PolicialWithRelations> {
    const before = await this.prisma.policial.findUnique({
      where: { id },
      include: { afastamentos: true, funcao: true },
    });

    if (!before) {
        throw new NotFoundException(`Policial ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);

    const updated = await this.prisma.policial.update({
      where: { id },
      data: {
        status: PolicialStatus.ATIVO,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      include: { afastamentos: true, funcao: true, restricaoMedica: true },
    });

    await this.audit.record({
      entity: 'Policial',
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    return updated;
  }

  async createBulk(
    data: CreatePoliciaisBulkDto,
    responsavelId?: number,
  ): Promise<{ criados: number; erros: Array<{ matricula: string; erro: string }> }> {
    const actor = await this.audit.resolveActor(responsavelId);
    const erros: Array<{ matricula: string; erro: string }> = [];
    let criados = 0;

    for (const policialData of data.policiais) {
      try {
        const matriculaNormalizada = this.sanitizeMatricula(policialData.matricula);
        
        // Verificar se jÃ¡ existe usando a matrÃ­cula normalizada exata
        let existe = await this.prisma.policial.findUnique({
          where: { matricula: matriculaNormalizada },
        });

        // Se nÃ£o encontrou com a matrÃ­cula exata, buscar por matrÃ­culas equivalentes
        // (sem zeros Ã  esquerda) para evitar duplicatas como "00219045" vs "219045"
        if (!existe) {
          const matriculaParaComparacao = this.normalizeMatriculaForComparison(matriculaNormalizada);
          
          // Buscar todos os Policiales e comparar matrÃ­culas normalizadas
          const todosPoliciais = await this.prisma.policial.findMany();

          existe = todosPoliciais.find((policial) => {
            const matriculaPolicialNormalizada = this.normalizeMatriculaForComparison(policial.matricula);
            return matriculaPolicialNormalizada === matriculaParaComparacao;
          }) || null;
        }

        if (existe) {
          erros.push({
            matricula: policialData.matricula,
            erro: 'Matrícula já existe no banco de dados',
          });
          continue;
        }

        const createData: Prisma.PolicialCreateInput = {
          nome: this.sanitizeNome(policialData.nome),
          matricula: matriculaNormalizada,
          status: policialData.status,
          equipe: policialData.equipe !== undefined ? policialData.equipe : (actor?.equipe ?? null),
          createdById: actor?.id ?? null,
          createdByName: actor?.nome ?? null,
          updatedById: actor?.id ?? null,
          updatedByName: actor?.nome ?? null,
        };

        if (policialData.funcaoId) {
          createData.funcao = { connect: { id: policialData.funcaoId } };
        }

        await this.prisma.policial.create({
          data: createData,
        });

        criados++;
      } catch (error) {
        erros.push({
          matricula: policialData.matricula,
          erro: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    return { criados, erros };
  }

  async delete(id: number, data: DeletePolicialDto, responsavelUsuario?: Usuario): Promise<void> {
    const before = await this.prisma.policial.findUnique({
      where: { id },
      include: { afastamentos: true, funcao: true },
    });

    if (!before) {
        throw new NotFoundException(`Policial ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(data.responsavelId);

    if (!actor) {
      throw new UnauthorizedException('UsuÃ¡rio responsÃ¡vel nÃ£o encontrado.');
    }

    // Verificar se o usuÃ¡rio responsÃ¡vel Ã© ADMINISTRADOR
    if (responsavelUsuario) {
      const usuarioAtor = await this.prisma.usuario.findUnique({
        where: { id: responsavelUsuario.id },
        select: { isAdmin: true, nivel: { select: { nome: true } } },
      });

      if (!usuarioAtor || (!usuarioAtor.isAdmin && usuarioAtor.nivel?.nome !== 'ADMINISTRADOR')) {
        throw new UnauthorizedException('Apenas administradores podem excluir permanentemente policiais.');
      }
    } else {
      // Se nÃ£o foi fornecido o usuÃ¡rio, buscar pelo actor
      const usuarioAtor = await this.prisma.usuario.findUnique({
        where: { id: actor.id },
        select: { isAdmin: true, nivel: { select: { nome: true } } },
      });

      if (!usuarioAtor || (!usuarioAtor.isAdmin && usuarioAtor.nivel?.nome !== 'ADMINISTRADOR')) {
        throw new UnauthorizedException('Apenas administradores podem excluir permanentemente policiais.');
      }
    }

    // Buscar um usuÃ¡rio administrador para validar a senha
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
        entity: 'Policial',
        entityId: id,
        action: AuditAction.DELETE,
        actor,
        before,
        after: { erro: 'Senha de administrador invÃ¡lida para exclusÃ£o' },
      });
      throw new UnauthorizedException('Senha de administrador invÃ¡lida.');
    }

    // Verificar se hÃ¡ afastamentos associados
    if (before.afastamentos && before.afastamentos.length > 0) {
      throw new BadRequestException(
        `Não é possível excluir permanentemente o policial. Existem ${before.afastamentos.length} afastamento(s) associado(s). Primeiro, remova ou transfira os afastamentos.`,
      );
    }

    // Deletar permanentemente do banco de dados
    await this.prisma.policial.delete({
      where: { id },
    });

    await this.audit.record({
      entity: 'Policial',
      entityId: id,
      action: AuditAction.DELETE,
      actor,
      before,
      after: { deletado: true, confirmadoPorSenha: true },
    });
  }

  async listRestricoesMedicas() {
    return this.prisma.restricaoMedica.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async updateRestricaoMedica(
    id: number,
    restricaoMedicaId: number | null,
    responsavelId?: number,
  ): Promise<PolicialWithRelations> {
    const actor = await this.audit.resolveActor(responsavelId);

    // Verificar se o policial existe
    const before = await this.prisma.policial.findUnique({
      where: { id },
      include: { afastamentos: true, funcao: true, restricaoMedica: true },
    });

    if (!before) {
      throw new NotFoundException(`Policial ${id} não encontrado.`);
    }

    // Se restricaoMedicaId foi fornecido, verificar se existe
    if (restricaoMedicaId !== null) {
      const restricao = await this.prisma.restricaoMedica.findUnique({
        where: { id: restricaoMedicaId },
      });

      if (!restricao) {
        throw new NotFoundException(`Restrição médica ${restricaoMedicaId} não encontrada.`);
      }
    }

    const updated = await this.prisma.policial.update({
      where: { id },
      data: {
        restricaoMedicaId: restricaoMedicaId,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      include: { afastamentos: true, funcao: true, restricaoMedica: true },
    });

    await this.audit.record({
      entity: 'Policial',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    return updated;
  }
}

