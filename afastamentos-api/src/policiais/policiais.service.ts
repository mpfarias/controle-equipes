import { Injectable, NotFoundException, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuditAction, Prisma, UsuarioStatus, Usuario } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { RestricoesAfastamentoService } from '../restricoes-afastamento/restricoes-afastamento.service';
import { CreatePolicialDto } from './dto/create-policial.dto';
import { UpdatePolicialDto } from './dto/update-policial.dto';
import { CreatePoliciaisBulkDto } from './dto/create-policiais-bulk.dto.js';
import { DeletePolicialDto } from './dto/delete-policial.dto';
import { DesativarPolicialDto } from './dto/desativar-policial.dto';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import * as bcrypt from 'bcryptjs';

type PolicialBase = Prisma.PolicialGetPayload<{
  include: { 
    afastamentos?: true; 
    funcao?: true; 
    restricaoMedica?: true;
    status?: true;
  };
}>;

type PolicialWithHistorico = PolicialBase & {
  restricoesMedicasHistorico?: Array<{
    id: number;
    policialId: number;
    restricaoMedicaId: number;
    restricaoMedica: {
      id: number;
      nome: string;
      descricao: string | null;
    };
    dataInicio: Date;
    dataFim: Date;
    removidoPorId: number | null;
    removidoPorNome: string | null;
    createdAt: Date;
  }>;
};

type FeriasPolicialEntity = Prisma.FeriasPolicialGetPayload<{}>;

const POLICIAL_STATUS_VALUES = [
  'ATIVO',
  'DESIGNADO',
  'COMISSIONADO',
  'PTTC',
  'DESATIVADO',
] as const;

type PolicialStatusValue = typeof POLICIAL_STATUS_VALUES[number];

type PolicialWithRelations = PolicialBase | PolicialWithHistorico;

type PolicialResponse = Omit<PolicialWithRelations, 'ferias' | 'status'> & {
  mesPrevisaoFerias?: number | null;
  anoPrevisaoFerias?: number | null;
  mesPrevisaoFeriasOriginal?: number | null;
  anoPrevisaoFeriasOriginal?: number | null;
  feriasConfirmadas?: boolean;
  feriasReprogramadas?: boolean;
  status: PolicialStatusValue;
};

@Injectable()
export class PoliciaisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly restricoesAfastamentoService: RestricoesAfastamentoService,
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

  private sanitizeEquipeNome(nome: string): string {
    return nome.trim().toUpperCase();
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

  private buildMonthRange(ano: number, mes: number): { dataInicio: Date; dataFim: Date } {
    const dataInicio = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);
    return { dataInicio, dataFim };
  }

  private mapFeriasPrevisao(policial: PolicialWithRelations & { ferias?: FeriasPolicialEntity[] }): PolicialResponse {
    const feriasAtual = policial.ferias?.[0] ?? null;
    const mesPrevisaoFerias = feriasAtual ? feriasAtual.dataInicio.getMonth() + 1 : null;
    const anoPrevisaoFerias = feriasAtual ? feriasAtual.ano : null;
    const mesPrevisaoFeriasOriginal = feriasAtual?.dataInicioOriginal
      ? feriasAtual.dataInicioOriginal.getMonth() + 1
      : null;
    const anoPrevisaoFeriasOriginal = feriasAtual?.dataInicioOriginal
      ? feriasAtual.dataInicioOriginal.getFullYear()
      : null;
    const feriasConfirmadas = feriasAtual?.confirmada ?? false;
    const feriasReprogramadas = feriasAtual?.reprogramada ?? false;
    const statusNome = policial.status?.nome ?? 'ATIVO';

    const { ferias: _ferias, status: _status, ...rest } = policial;
    return {
      ...(rest as PolicialWithRelations),
      status: statusNome as PolicialStatusValue,
      mesPrevisaoFerias,
      anoPrevisaoFerias,
      mesPrevisaoFeriasOriginal,
      anoPrevisaoFeriasOriginal,
      feriasConfirmadas,
      feriasReprogramadas,
    };
  }

  private async resolveStatusId(status: string): Promise<number> {
    if (!status) {
      throw new BadRequestException('Status inválido.');
    }
    const statusRegistro = await this.prisma.statusPolicial.findUnique({
      where: { nome: status },
      select: { id: true },
    });
    if (!statusRegistro) {
      throw new BadRequestException(`Status inválido: ${status}`);
    }
    return statusRegistro.id;
  }

  private async upsertFeriasPrevisao(
    policialId: number,
    data: {
      mesPrevisaoFerias?: number | null;
      anoPrevisaoFerias?: number | null;
      feriasConfirmadas?: boolean;
      feriasReprogramadas?: boolean;
    },
    actor?: { id?: number | null; nome?: string | null },
  ): Promise<void> {
    const hasFeriasPayload =
      data.mesPrevisaoFerias !== undefined ||
      data.anoPrevisaoFerias !== undefined ||
      data.feriasConfirmadas !== undefined ||
      data.feriasReprogramadas !== undefined;

    if (!hasFeriasPayload) {
      return;
    }

    const anoReferencia = data.anoPrevisaoFerias ?? new Date().getFullYear();
    let feriasAtual = await this.prisma.feriasPolicial.findUnique({
      where: { policialId_ano: { policialId, ano: anoReferencia } },
    });

    if (data.mesPrevisaoFerias === null) {
      if (feriasAtual) {
        await this.prisma.feriasPolicial.delete({
          where: { policialId_ano: { policialId, ano: anoReferencia } },
        });
      }
      return;
    }

    if (data.mesPrevisaoFerias !== undefined) {
      const mesNovo = data.mesPrevisaoFerias;
      const { dataInicio, dataFim } = this.buildMonthRange(anoReferencia, mesNovo);

      if (feriasAtual) {
        const mesAnterior = feriasAtual.dataInicio.getMonth() + 1;
        const anoAnterior = feriasAtual.ano;

        if (feriasAtual.confirmada && mesNovo !== mesAnterior) {
          if (feriasAtual.reprogramada) {
            throw new BadRequestException(
              'As férias já foram reprogramadas anteriormente. Não é possível reprogramar novamente.',
            );
          }

          const motivoFerias = await this.prisma.motivoAfastamento.findFirst({
            where: { nome: 'Férias' },
          });

          if (motivoFerias) {
            // Verificar se o mês inteiro está restrito (do dia 1 ao último dia)
            const verificacaoMesInteiro = await this.restricoesAfastamentoService.verificarMesInteiroRestrito(
              anoReferencia,
              mesNovo,
              motivoFerias.id,
            );
            const verificacaoMesInteiroOriginal = await this.restricoesAfastamentoService.verificarMesInteiroRestrito(
              anoAnterior,
              mesAnterior,
              motivoFerias.id,
            );

            // Só bloquear se o mês inteiro estiver restrito e o mês original não estava restrito
            if (verificacaoMesInteiro.bloqueado && !verificacaoMesInteiroOriginal.bloqueado) {
              throw new BadRequestException(
                `Não é possível reprogramar as férias para ${this.obterNomeMes(mesNovo)}. Este mês possui restrição de afastamento que cobre o mês inteiro (${verificacaoMesInteiro.restricao?.tipoRestricao.nome || 'restrição'}).`,
              );
            }
          }
        }

        const dataInicioOriginal = feriasAtual.dataInicioOriginal ?? feriasAtual.dataInicio;
        const dataFimOriginal = feriasAtual.dataFimOriginal ?? feriasAtual.dataFim;

        await this.prisma.feriasPolicial.update({
          where: { policialId_ano: { policialId, ano: anoReferencia } },
          data: {
            dataInicio,
            dataFim,
            dataInicioOriginal: feriasAtual.confirmada && mesNovo !== mesAnterior ? dataInicioOriginal : feriasAtual.dataInicioOriginal,
            dataFimOriginal: feriasAtual.confirmada && mesNovo !== mesAnterior ? dataFimOriginal : feriasAtual.dataFimOriginal,
            reprogramada: feriasAtual.confirmada && mesNovo !== mesAnterior ? true : feriasAtual.reprogramada,
            updatedById: actor?.id ?? null,
            updatedByName: actor?.nome ?? null,
          },
        });
      } else {
        await this.prisma.feriasPolicial.create({
          data: {
            policialId,
            ano: anoReferencia,
            dataInicio,
            dataFim,
            confirmada: data.feriasConfirmadas ?? false,
            reprogramada: data.feriasReprogramadas ?? false,
            createdById: actor?.id ?? null,
            createdByName: actor?.nome ?? null,
            updatedById: actor?.id ?? null,
            updatedByName: actor?.nome ?? null,
          },
        });
      }

      feriasAtual = await this.prisma.feriasPolicial.findUnique({
        where: { policialId_ano: { policialId, ano: anoReferencia } },
      });
    }

    if (data.feriasConfirmadas !== undefined) {
      if (!feriasAtual) {
        throw new BadRequestException('Não existe previsão de férias cadastrada para confirmar.');
      }
      await this.prisma.feriasPolicial.update({
        where: { policialId_ano: { policialId, ano: anoReferencia } },
        data: {
          confirmada: data.feriasConfirmadas,
          updatedById: actor?.id ?? null,
          updatedByName: actor?.nome ?? null,
        },
      });
    }

    if (data.feriasReprogramadas !== undefined && feriasAtual) {
      await this.prisma.feriasPolicial.update({
        where: { policialId_ano: { policialId, ano: anoReferencia } },
        data: {
          reprogramada: data.feriasReprogramadas,
          updatedById: actor?.id ?? null,
          updatedByName: actor?.nome ?? null,
        },
      });
    }
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
  ): Promise<PolicialResponse> {
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
              status: { nome: { not: 'DESATIVADO' } },
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
      include: { afastamentos: true, status: true },
    });

    // Se não encontrou com a matrícula exata, buscar por matrículas equivalentes
    // (sem zeros à esquerda) para evitar duplicatas como "00219045" vs "219045"
    if (!policialExistente) {
      const matriculaParaComparacao = this.normalizeMatriculaForComparison(matriculaNormalizada);
      
      // Buscar todos os policiais e comparar matrículas normalizadas
      const todosPoliciais = await this.prisma.policial.findMany({
        include: { afastamentos: true, status: true },
      });

      policialExistente = todosPoliciais.find((policial) => {
        const matriculaPolicialNormalizada = this.normalizeMatriculaForComparison(policial.matricula);
        return matriculaPolicialNormalizada === matriculaParaComparacao;
      }) || null;
    }

    if (policialExistente) {
      if (policialExistente.status?.nome === 'DESATIVADO') {
        // Policial existe mas está desativado - lançar erro especial para o frontend tratar
        const errorResponse = {
          message: 'POLICIAL_DESATIVADO',
          policial: {
            id: policialExistente.id,
            nome: policialExistente.nome,
            matricula: policialExistente.matricula,
            equipe: policialExistente.equipe,
            status: policialExistente.status?.nome ?? 'ATIVO',
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

    const statusId = await this.resolveStatusId(data.status ?? 'ATIVO');
    const equipeValue = data.equipe !== undefined ? data.equipe : (actor?.equipe ?? null);
    const equipe = equipeValue ? await this.ensureEquipeAtiva(equipeValue) : null;
    const created = await this.prisma.policial.create({
      data: {
        nome: this.sanitizeNome(data.nome),
        matricula: matriculaNormalizada,
        status: { connect: { id: statusId } },
        equipe,
        funcao: data.funcaoId ? { connect: { id: data.funcaoId } } : undefined,
        createdById: actor?.id ?? null,
        createdByName: actor?.nome ?? null,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      include: { afastamentos: true, funcao: true, restricaoMedica: true, status: true },
    });

    await this.audit.record({
      entity: 'Policial',
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      after: created,
    });

    return this.mapFeriasPrevisao(created);
  }

  async findAll(options?: {
    page?: number;
    pageSize?: number;
    includeAfastamentos?: boolean;
    includeRestricoes?: boolean;
    search?: string;
    equipe?: string;
    status?: string;
    funcaoId?: number;
    orderBy?: 'nome' | 'matricula' | 'equipe' | 'status' | 'funcao';
    orderDir?: 'asc' | 'desc';
  }): Promise<
    | PolicialResponse[]
    | {
        Policiales: PolicialResponse[];
        total: number;
        totalDisponiveis: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }
  > {
    const {
      page,
      pageSize,
      includeAfastamentos,
      includeRestricoes,
      search,
      equipe,
      status,
      funcaoId,
      orderBy,
      orderDir,
    } = options || {};
    const anoAtual = new Date().getFullYear();
    const include: {
      afastamentos?: boolean;
      funcao?: boolean;
      restricaoMedica?: boolean;
      status?: boolean;
      ferias?: { where: { ano: number }; orderBy: { id: 'asc' | 'desc' }; take: number };
    } = {
      funcao: true,
      status: true,
      ferias: { where: { ano: anoAtual }, orderBy: { id: 'desc' }, take: 1 },
    };
    if (includeAfastamentos === true) {
      include.afastamentos = true;
    }
    if (includeRestricoes === true) {
      include.restricaoMedica = true;
    }
    const where: Prisma.PolicialWhereInput = {};

    if (equipe) {
      where.equipe = equipe;
    }
    if (status) {
      where.status = { nome: status as string };
    }
    if (funcaoId) {
      where.funcaoId = funcaoId;
    }
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { matricula: { contains: search, mode: 'insensitive' } },
        { funcao: { nome: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const dir = orderDir ?? 'asc';
    const orderByClause: Prisma.PolicialOrderByWithRelationInput = orderBy
      ? orderBy === 'status'
        ? { status: { nome: dir } }
        : orderBy === 'funcao'
          ? { funcao: { nome: dir } }
          : ({ [orderBy]: dir } as Prisma.PolicialOrderByWithRelationInput)
      : { nome: 'asc' };

    // Se nÃ£o fornecer paginaÃ§Ã£o, retornar todos (incluindo desativados)
    if (page === undefined && pageSize === undefined) {
      const policiais = await this.prisma.policial.findMany({
        where,
        orderBy: orderByClause,
        include,
      });
      return policiais.map((policial) => this.mapFeriasPrevisao(policial));
    }

    // Implementar paginação: buscar todos, ordenar (desativados sempre por último) e fatiar a página
    const currentPage = page || 1;
    const currentPageSize = pageSize || 10;
    const skip = (currentPage - 1) * currentPageSize;
    const take = currentPageSize;

    const allPoliciais = await this.prisma.policial.findMany({
      where,
      orderBy: orderByClause,
      include,
    });

    const mapped = allPoliciais.map((policial) => this.mapFeriasPrevisao(policial));

    // Ordenar em memória: desativados sempre por último, depois pelo campo solicitado
    const orderField = orderBy || 'nome';
    mapped.sort((a, b) => {
      const aDesativado = a.status === 'DESATIVADO';
      const bDesativado = b.status === 'DESATIVADO';
      if (aDesativado && !bDesativado) return 1;
      if (!aDesativado && bDesativado) return -1;
      let valorA: string;
      let valorB: string;
      switch (orderField) {
        case 'nome':
          valorA = a.nome.toUpperCase();
          valorB = b.nome.toUpperCase();
          break;
        case 'matricula':
          valorA = a.matricula.toUpperCase();
          valorB = b.matricula.toUpperCase();
          break;
        case 'equipe':
          valorA = a.equipe ?? '';
          valorB = b.equipe ?? '';
          break;
        case 'status':
          valorA = (a.status ?? '').toUpperCase();
          valorB = (b.status ?? '').toUpperCase();
          break;
        case 'funcao':
          valorA = ((a as { funcao?: { nome?: string } }).funcao?.nome ?? '').toUpperCase();
          valorB = ((b as { funcao?: { nome?: string } }).funcao?.nome ?? '').toUpperCase();
          break;
        default:
          valorA = a.nome.toUpperCase();
          valorB = b.nome.toUpperCase();
      }
      const cmp = valorA.localeCompare(valorB);
      return dir === 'asc' ? cmp : -cmp;
    });

    const total = mapped.length;
    const Policiales = mapped.slice(skip, skip + take);

    // Contar policiais disponíveis (status diferente de DESATIVADO) com os mesmos filtros
    const desativadoStatusId = await this.resolveStatusId('DESATIVADO');
    const whereDisponiveis: Prisma.PolicialWhereInput = {
      ...where,
      statusId: { not: desativadoStatusId },
    };
    const totalDisponiveis = await this.prisma.policial.count({ where: whereDisponiveis });

    return {
      Policiales,
      total,
      totalDisponiveis,
      page: currentPage,
      pageSize: currentPageSize,
      totalPages: Math.ceil(total / currentPageSize),
    };
  }

  async findOne(id: number): Promise<PolicialResponse> {
    const anoAtual = new Date().getFullYear();
    const policial = await this.prisma.policial.findUnique({
      where: { id },
      include: { 
        afastamentos: true, 
        funcao: true, 
        restricaoMedica: true,
        status: true,
        ferias: { where: { ano: anoAtual }, orderBy: { id: 'desc' }, take: 1 },
        restricoesMedicasHistorico: {
          include: { restricaoMedica: true },
          orderBy: { dataFim: 'desc' },
        },
      },
    });

    if (!policial) {
      throw new NotFoundException(`Policial ${id} não encontrado.`);
    }

    return this.mapFeriasPrevisao(policial);
  }

  async update(
    id: number,
    data: UpdatePolicialDto,
    responsavelId?: number,
  ): Promise<PolicialResponse> {
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
              status: { nome: { not: 'DESATIVADO' } },
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
      include: { afastamentos: true, status: true },
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
          include: { status: true },
        });

        // Se nÃ£o encontrou com a matrÃ­cula exata, buscar por matrÃ­culas equivalentes
        if (!policialComMatricula || policialComMatricula.id === id) {
          const todosPoliciais = await this.prisma.policial.findMany({
            include: { status: true },
          });

          policialComMatricula = todosPoliciais.find((policial) => {
            if (policial.id === id) return false; // Ignorar o próprio policial
            const matriculaPolicialNormalizada = this.normalizeMatriculaForComparison(policial.matricula);
            return matriculaPolicialNormalizada === novaMatriculaNormalizada;
          }) || null;
        }

        if (policialComMatricula && policialComMatricula.id !== id) {
          if (policialComMatricula.status?.nome === 'DESATIVADO') {
            // Policial existe mas estÃ¡ desativado - lanÃ§ar erro especial para o frontend tratar
            const errorResponse = {
              message: 'POLICIAL_DESATIVADO',
              policial: {
                id: policialComMatricula.id,
                nome: policialComMatricula.nome,
                matricula: policialComMatricula.matricula,
                equipe: policialComMatricula.equipe,
                status: policialComMatricula.status?.nome ?? 'ATIVO',
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
      const statusId = await this.resolveStatusId(data.status);
      updateData.status = { connect: { id: statusId } };
    }

    if (data.equipe !== undefined) {
      updateData.equipe = data.equipe ? await this.ensureEquipeAtiva(data.equipe) : null;
    }

    if (data.fotoUrl !== undefined) {
      updateData.fotoUrl = data.fotoUrl;
    }

    if (data.funcaoId !== undefined) {
      if (data.funcaoId === null || data.funcaoId === 0) {
        updateData.funcao = { disconnect: true };
      } else {
        updateData.funcao = { connect: { id: data.funcaoId } };
        // Regra: todo policial que passa a ter função sem equipe (Expediente adm, CMT UPM, SUBCMT UPM)
        // deve ter o registro de equipe zerado no banco, independentemente da equipe anterior.
        const funcao = await this.prisma.funcao.findUnique({
          where: { id: data.funcaoId },
          select: { nome: true },
        });
        if (funcao) {
          const nomeUpper = funcao.nome.toUpperCase();
          if (
            nomeUpper.includes('EXPEDIENTE ADM') ||
            nomeUpper.includes('CMT UPM') ||
            nomeUpper.includes('SUBCMT UPM')
          ) {
            updateData.equipe = null;
          }
        }
      }
    }

    await this.upsertFeriasPrevisao(
      id,
      {
        mesPrevisaoFerias: data.mesPrevisaoFerias,
        anoPrevisaoFerias: data.anoPrevisaoFerias,
        feriasConfirmadas: data.feriasConfirmadas,
        feriasReprogramadas: data.feriasReprogramadas,
      },
      actor ?? undefined,
    );

    const updated = await this.prisma.policial.update({
      where: { id },
      data: updateData,
      include: { afastamentos: true, funcao: true, restricaoMedica: true, status: true },
    });

    await this.audit.record({
      entity: 'Policial',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    const anoAtual = new Date().getFullYear();
    const updatedWithFerias = await this.prisma.policial.findUnique({
      where: { id: updated.id },
      include: {
        afastamentos: true,
        funcao: true,
        restricaoMedica: true,
        status: true,
        ferias: { where: { ano: anoAtual }, orderBy: { id: 'desc' }, take: 1 },
      },
    });

    return this.mapFeriasPrevisao(updatedWithFerias ?? updated);
  }

  async remove(id: number, responsavelId?: number): Promise<void> {
    const before = await this.prisma.policial.findUnique({
      where: { id },
      include: { afastamentos: true, funcao: true, status: true },
    });

    if (!before) {
        throw new NotFoundException(`Policial ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);

    const statusId = await this.resolveStatusId('DESATIVADO');
    const updated = await this.prisma.policial.update({
      where: { id },
      data: {
        status: { connect: { id: statusId } },
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      include: { afastamentos: true, funcao: true, restricaoMedica: true, status: true },
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

  async desativar(id: number, dto: DesativarPolicialDto, responsavelId?: number): Promise<void> {
    const before = await this.prisma.policial.findUnique({
      where: { id },
      include: { afastamentos: true, funcao: true, status: true },
    });

    if (!before) {
      throw new NotFoundException(`Policial ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);
    const statusId = await this.resolveStatusId('DESATIVADO');

    const dataDesativacaoAPartirDe = dto.dataAPartirDe
      ? new Date(dto.dataAPartirDe)
      : null;

    const updated = await this.prisma.policial.update({
      where: { id },
      data: {
        status: { connect: { id: statusId } },
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
        dataDesativacaoAPartirDe,
        observacoesDesativacao: dto.observacoes?.trim() || null,
        desativadoPorId: actor?.id ?? null,
        desativadoPorNome: actor?.nome ?? null,
        desativadoEm: new Date(),
      },
      include: { afastamentos: true, funcao: true, restricaoMedica: true, status: true },
    });

    await this.audit.record({
      entity: 'Policial',
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });
  }

  async activate(id: number, responsavelId?: number): Promise<PolicialResponse> {
    const before = await this.prisma.policial.findUnique({
      where: { id },
      include: { afastamentos: true, funcao: true, status: true },
    });

    if (!before) {
        throw new NotFoundException(`Policial ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);

    const statusId = await this.resolveStatusId('ATIVO');
    const updated = await this.prisma.policial.update({
      where: { id },
      data: {
        status: { connect: { id: statusId } },
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
        dataDesativacaoAPartirDe: null,
        observacoesDesativacao: null,
        desativadoPorId: null,
        desativadoPorNome: null,
        desativadoEm: null,
      },
      include: { afastamentos: true, funcao: true, restricaoMedica: true, status: true },
    });

    await this.audit.record({
      entity: 'Policial',
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    const anoAtual = new Date().getFullYear();
    const updatedWithFerias = await this.prisma.policial.findUnique({
      where: { id: updated.id },
      include: {
        afastamentos: true,
        funcao: true,
        restricaoMedica: true,
        status: true,
        ferias: { where: { ano: anoAtual }, orderBy: { id: 'desc' }, take: 1 },
      },
    });

    return this.mapFeriasPrevisao(updatedWithFerias ?? updated);
  }

  async createBulk(
    data: CreatePoliciaisBulkDto,
    responsavelId?: number,
  ): Promise<{ criados: number; erros: Array<{ matricula: string; erro: string }> }> {
    const actor = await this.audit.resolveActor(responsavelId);
    const erros: Array<{ matricula: string; erro: string }> = [];
    let criados = 0;
    const statusList = await this.prisma.statusPolicial.findMany({
      select: { id: true, nome: true },
    });
    const statusMap = new Map(statusList.map((status) => [status.nome, status.id]));

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

        const statusId = statusMap.get(policialData.status);
        if (!statusId) {
          erros.push({
            matricula: policialData.matricula,
            erro: `Status inválido: ${policialData.status}`,
          });
          continue;
        }

        const equipeValue =
          policialData.equipe !== undefined ? policialData.equipe : (actor?.equipe ?? null);
        const equipe = equipeValue ? await this.ensureEquipeAtiva(equipeValue) : null;
        const createData: Prisma.PolicialCreateInput = {
          nome: this.sanitizeNome(policialData.nome),
          matricula: matriculaNormalizada,
          status: { connect: { id: statusId } },
          equipe,
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
  ): Promise<PolicialResponse> {
    const actor = await this.audit.resolveActor(responsavelId);

    // Verificar se o policial existe
    const before = await this.prisma.policial.findUnique({
      where: { id },
      include: { afastamentos: true, funcao: true, restricaoMedica: true, status: true },
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
        throw new NotFoundException(`Restrição ${restricaoMedicaId} não encontrada.`);
      }
    }

    const updateData: Prisma.PolicialUpdateInput = {
      restricaoMedica: restricaoMedicaId 
        ? { connect: { id: restricaoMedicaId } }
        : restricaoMedicaId === null 
          ? { disconnect: true }
          : undefined,
      updatedById: actor?.id ?? null,
      updatedByName: actor?.nome ?? null,
    };

    const updated = await this.prisma.policial.update({
      where: { id },
      data: updateData,
      include: { 
        afastamentos: true, 
        funcao: true, 
        restricaoMedica: true,
        status: true,
        restricoesMedicasHistorico: {
          include: { restricaoMedica: true },
          orderBy: { dataFim: 'desc' },
        },
      },
    });

    await this.audit.record({
      entity: 'Policial',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    const anoAtual = new Date().getFullYear();
    const updatedWithFerias = await this.prisma.policial.findUnique({
      where: { id: updated.id },
      include: {
        afastamentos: true,
        funcao: true,
        restricaoMedica: true,
        restricoesMedicasHistorico: {
          include: { restricaoMedica: true },
          orderBy: { dataFim: 'desc' },
        },
        status: true,
        ferias: { where: { ano: anoAtual }, orderBy: { id: 'desc' }, take: 1 },
      },
    });

    return this.mapFeriasPrevisao(updatedWithFerias ?? updated);
  }

  async removeRestricaoMedica(
    id: number,
    senha: string,
    responsavelId?: number,
  ): Promise<PolicialResponse> {
    const actor = await this.audit.resolveActor(responsavelId);

    if (!actor) {
      throw new UnauthorizedException('Usuário responsável não encontrado.');
    }

    // Verificar senha do usuário
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: actor.id },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaValida) {
      throw new UnauthorizedException('Senha incorreta.');
    }

    // Verificar se o policial existe
    const before = await this.prisma.policial.findUnique({
      where: { id },
      include: { afastamentos: true, funcao: true, restricaoMedica: true, status: true },
    });

    if (!before) {
      throw new NotFoundException(`Policial ${id} não encontrado.`);
    }

    if (!before.restricaoMedicaId) {
      throw new BadRequestException('Este policial não possui restrição para remover.');
    }

    // Salvar histórico na tabela antes de remover
    await this.prisma.restricaoMedicaHistorico.create({
      data: {
        policialId: id,
        restricaoMedicaId: before.restricaoMedicaId!,
        dataInicio: before.restricaoMedicaId ? before.updatedAt : new Date(),
        dataFim: new Date(),
        removidoPorId: actor.id,
        removidoPorNome: actor.nome,
      },
    });

    // Remover a restrição do policial
    const updateData: Prisma.PolicialUpdateInput = {
      restricaoMedica: { disconnect: true },
      updatedById: actor.id,
      updatedByName: actor.nome,
    };

    const updated = await this.prisma.policial.update({
      where: { id },
      data: updateData,
      include: { 
        afastamentos: true, 
        funcao: true, 
        restricaoMedica: true,
        status: true,
        restricoesMedicasHistorico: {
          include: { restricaoMedica: true },
          orderBy: { dataFim: 'desc' },
        },
      },
    });

    await this.audit.record({
      entity: 'Policial',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    const anoAtual = new Date().getFullYear();
    const updatedWithFerias = await this.prisma.policial.findUnique({
      where: { id: updated.id },
      include: {
        afastamentos: true,
        funcao: true,
        restricaoMedica: true,
        restricoesMedicasHistorico: {
          include: { restricaoMedica: true },
          orderBy: { dataFim: 'desc' },
        },
        status: true,
        ferias: { where: { ano: anoAtual }, orderBy: { id: 'desc' }, take: 1 },
      },
    });

    return this.mapFeriasPrevisao(updatedWithFerias ?? updated);
  }

  /**
   * Retorna o nome do mês em português
   */
  private obterNomeMes(mes: number): string {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[mes - 1] || `Mês ${mes}`;
  }

  async listStatusPolicial(): Promise<{ id: number; nome: string; descricao: string | null; createdAt: Date; updatedAt: Date }[]> {
    return this.prisma.statusPolicial.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async createStatusPolicial(
    data: CreateStatusDto,
    responsavelId?: number,
  ): Promise<{ id: number; nome: string; descricao: string | null; createdAt: Date; updatedAt: Date }> {
    const actor = await this.audit.resolveActor(responsavelId);

    // Verificar se já existe um status com o mesmo nome
    const statusExistente = await this.prisma.statusPolicial.findUnique({
      where: { nome: data.nome.trim() },
    });

    if (statusExistente) {
      throw new BadRequestException(`Já existe um status com o nome "${data.nome.trim()}".`);
    }

    const created = await this.prisma.statusPolicial.create({
      data: {
        nome: data.nome.trim(),
        descricao: data.descricao?.trim() || null,
      },
    });

    await this.audit.record({
      entity: 'StatusPolicial',
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      after: created,
    });

    return created;
  }

  async updateStatusPolicial(
    id: number,
    data: UpdateStatusDto,
    responsavelId?: number,
  ): Promise<{ id: number; nome: string; descricao: string | null; createdAt: Date; updatedAt: Date }> {
    const actor = await this.audit.resolveActor(responsavelId);

    const before = await this.prisma.statusPolicial.findUnique({
      where: { id },
    });

    if (!before) {
      throw new NotFoundException(`Status ${id} não encontrado.`);
    }

    // Se está alterando o nome, verificar se já existe outro com o mesmo nome
    if (data.nome && data.nome.trim() !== before.nome) {
      const statusExistente = await this.prisma.statusPolicial.findUnique({
        where: { nome: data.nome.trim() },
      });

      if (statusExistente) {
        throw new BadRequestException(`Já existe um status com o nome "${data.nome.trim()}".`);
      }
    }

    const updateData: Prisma.StatusPolicialUpdateInput = {};

    if (data.nome !== undefined) {
      updateData.nome = data.nome.trim();
    }
    if (data.descricao !== undefined) {
      updateData.descricao = data.descricao?.trim() || null;
    }

    const updated = await this.prisma.statusPolicial.update({
      where: { id },
      data: updateData,
    });

    await this.audit.record({
      entity: 'StatusPolicial',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    return updated;
  }

  async deleteStatusPolicial(id: number, responsavelId?: number): Promise<void> {
    const actor = await this.audit.resolveActor(responsavelId);

    const before = await this.prisma.statusPolicial.findUnique({
      where: { id },
      include: {
        policiais: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!before) {
      throw new NotFoundException(`Status ${id} não encontrado.`);
    }

    // Verificar se há policiais usando este status
    if (before.policiais.length > 0) {
      throw new BadRequestException(
        `Não é possível excluir o status "${before.nome}" pois existem policiais cadastrados com este status.`,
      );
    }

    await this.prisma.statusPolicial.delete({
      where: { id },
    });

    await this.audit.record({
      entity: 'StatusPolicial',
      entityId: id,
      action: AuditAction.DELETE,
      actor,
      before,
    });
  }
}

