import { Injectable, NotFoundException, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AfastamentoStatus, AuditAction, Prisma, UsuarioStatus, Usuario } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { RestricoesAfastamentoService } from '../restricoes-afastamento/restricoes-afastamento.service';
import { CreatePolicialDto } from './dto/create-policial.dto';
import { UpdatePolicialDto } from './dto/update-policial.dto';
import { CreatePoliciaisBulkDto } from './dto/create-policiais-bulk.dto.js';
import { DeletePolicialDto } from './dto/delete-policial.dto';
import { DesativarPolicialDto } from './dto/desativar-policial.dto';
import { CreateRestricaoMedicaDto } from './dto/create-restricao-medica.dto';
import { UpdateRestricaoMedicaDto } from './dto/update-restricao-medica.dto';
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

type PrevisaoFeriasPorExercicioItem = {
  ano: number;
  semMesDefinido: boolean;
  mes: number | null;
  confirmada: boolean;
  reprogramada: boolean;
  mesOriginal: number | null;
  anoOriginal: number | null;
  /** Preenchido em `findOne`: exercício anterior ao civil e sem gozo (afastamento Férias ativo) na cota. */
  podeExcluirPrevisaoAnterior?: boolean;
};

type PolicialResponse = Omit<PolicialWithRelations, 'ferias' | 'status'> & {
  mesPrevisaoFerias?: number | null;
  anoPrevisaoFerias?: number | null;
  mesPrevisaoFeriasOriginal?: number | null;
  anoPrevisaoFeriasOriginal?: number | null;
  feriasConfirmadas?: boolean;
  feriasReprogramadas?: boolean;
  /** Previsão cadastrada só com exercício (sem mês), permitido para anos &lt; ano civil. */
  previsaoFeriasSomenteAno?: boolean;
  /** Todos os exercícios com `FeriasPolicial` (quando a query inclui mais de um). */
  previsoesFeriasPorExercicio?: PrevisaoFeriasPorExercicioItem[];
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

  /** Retorna apenas os 11 dígitos do CPF ou null se inválido. */
  private sanitizeCpf(cpf: string | null | undefined): string | null {
    if (cpf == null || typeof cpf !== 'string') return null;
    const digits = cpf.replace(/\D/g, '');
    return digits.length === 11 ? digits : null;
  }

  /** Retorna apenas os 11 dígitos do telefone ou null se vazio/inválido. */
  private sanitizeTelefone(telefone: string | null | undefined): string | null {
    if (telefone == null || typeof telefone !== 'string') return null;
    const digits = telefone.replace(/\D/g, '');
    return digits.length === 11 ? digits : null;
  }

  /** Valida CPF pelos dígitos verificadores (algoritmo oficial). */
  private validarCpf(cpf: string): boolean {
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf[i], 10) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== parseInt(cpf[9], 10)) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf[i], 10) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== parseInt(cpf[10], 10)) return false;
    return true;
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

  /** Para ordenação por desligamento: prioriza data cadastrada na desativação, depois o instante do registro. */
  private desligamentoTimestampMs(p: PolicialResponse): number {
    const raw = p.dataDesativacaoAPartirDe ?? p.desativadoEm;
    if (raw == null) return 0;
    const t = typeof raw === 'string' ? Date.parse(raw) : (raw as Date).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  private buildMonthRange(ano: number, mes: number): { dataInicio: Date; dataFim: Date } {
    const dataInicio = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);
    return { dataInicio, dataFim };
  }

  private mapLinhaPrevisaoFerias(f: FeriasPolicialEntity): PrevisaoFeriasPorExercicioItem {
    return {
      ano: f.ano,
      semMesDefinido: f.semMesDefinido,
      mes: f.semMesDefinido ? null : f.dataInicio.getMonth() + 1,
      confirmada: f.confirmada,
      reprogramada: f.reprogramada,
      mesOriginal:
        !f.semMesDefinido && f.dataInicioOriginal ? f.dataInicioOriginal.getMonth() + 1 : null,
      anoOriginal:
        !f.semMesDefinido && f.dataInicioOriginal ? f.dataInicioOriginal.getFullYear() : null,
    };
  }

  private mapFeriasPrevisao(policial: PolicialWithRelations & { ferias?: FeriasPolicialEntity[] }): PolicialResponse {
    const lista = [...(policial.ferias ?? [])].sort((a, b) => {
      if (b.ano !== a.ano) return b.ano - a.ano;
      return b.id - a.id;
    });
    const anoCivil = new Date().getFullYear();
    const feriasAtual = lista.find((f) => f.ano === anoCivil) ?? lista[0] ?? null;
    const previsoesFeriasPorExercicio = lista.map((f) => this.mapLinhaPrevisaoFerias(f));
    const previsaoFeriasSomenteAno = feriasAtual?.semMesDefinido ?? false;
    const mesPrevisaoFerias =
      feriasAtual && !feriasAtual.semMesDefinido ? feriasAtual.dataInicio.getMonth() + 1 : null;
    const anoPrevisaoFerias = feriasAtual ? feriasAtual.ano : null;
    const mesPrevisaoFeriasOriginal =
      feriasAtual && !feriasAtual.semMesDefinido && feriasAtual.dataInicioOriginal
        ? feriasAtual.dataInicioOriginal.getMonth() + 1
        : null;
    const anoPrevisaoFeriasOriginal =
      feriasAtual && !feriasAtual.semMesDefinido && feriasAtual.dataInicioOriginal
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
      previsaoFeriasSomenteAno,
      previsoesFeriasPorExercicio,
    };
  }

  /**
   * Ano do `FeriasPolicial` a incluir na resposta após PATCH que mexeu em previsão.
   * Deve coincidir com `anoReferencia` em `upsertFeriasPrevisao` — senão a API devolve o registro do ano civil atual e o front parece “grudar” em um único exercício.
   */
  private anoFeriasParaRespostaAposPayloadPrevisao(data: {
    mesPrevisaoFerias?: number | null;
    anoPrevisaoFerias?: number | null;
    feriasConfirmadas?: boolean;
    feriasReprogramadas?: boolean;
    somenteAnoPrevisaoFerias?: boolean;
  }): number {
    const civil = new Date().getFullYear();
    const mexeuPrevisao =
      data.mesPrevisaoFerias !== undefined ||
      data.anoPrevisaoFerias !== undefined ||
      data.feriasConfirmadas !== undefined ||
      data.feriasReprogramadas !== undefined ||
      data.somenteAnoPrevisaoFerias !== undefined;
    if (!mexeuPrevisao) return civil;
    return data.anoPrevisaoFerias ?? civil;
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
      somenteAnoPrevisaoFerias?: boolean;
    },
    actor?: { id?: number | null; nome?: string | null },
  ): Promise<void> {
    const hasFeriasPayload =
      data.mesPrevisaoFerias !== undefined ||
      data.anoPrevisaoFerias !== undefined ||
      data.feriasConfirmadas !== undefined ||
      data.feriasReprogramadas !== undefined ||
      data.somenteAnoPrevisaoFerias !== undefined;

    if (!hasFeriasPayload) {
      return;
    }

    const civil = new Date().getFullYear();
    const anoReferencia = data.anoPrevisaoFerias ?? civil;
    /** Permite exercícios antigos (direito não usufruído) e um ano à frente para planejamento. */
    const minAnoPrevisaoFerias = 1985;
    const maxAnoPrevisaoFerias = civil + 1;
    if (anoReferencia < minAnoPrevisaoFerias || anoReferencia > maxAnoPrevisaoFerias) {
      throw new BadRequestException(
        `Ano de previsão de férias inválido (${anoReferencia}). Informe um exercício entre ${minAnoPrevisaoFerias} e ${maxAnoPrevisaoFerias}.`,
      );
    }
    let feriasAtual = await this.prisma.feriasPolicial.findUnique({
      where: { policialId_ano: { policialId, ano: anoReferencia } },
    });

    if (data.somenteAnoPrevisaoFerias === true) {
      if (anoReferencia >= civil) {
        throw new BadRequestException(
          'Registrar apenas o exercício (sem mês) é permitido somente para anos anteriores ao ano civil atual.',
        );
      }
      const { dataInicio, dataFim } = this.buildMonthRange(anoReferencia, 1);
      if (feriasAtual) {
        await this.prisma.feriasPolicial.update({
          where: { policialId_ano: { policialId, ano: anoReferencia } },
          data: {
            dataInicio,
            dataFim,
            semMesDefinido: true,
            confirmada: false,
            reprogramada: false,
            dataInicioOriginal: null,
            dataFimOriginal: null,
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
            semMesDefinido: true,
            confirmada: false,
            reprogramada: false,
            createdById: actor?.id ?? null,
            createdByName: actor?.nome ?? null,
            updatedById: actor?.id ?? null,
            updatedByName: actor?.nome ?? null,
          },
        });
      }
      return;
    }

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
            semMesDefinido: false,
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
            semMesDefinido: false,
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
      if (feriasAtual.semMesDefinido && data.feriasConfirmadas === true) {
        throw new BadRequestException(
          'Não é possível confirmar férias sem mês previsto. Informe o mês na previsão antes de confirmar.',
        );
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

  /**
   * CMT UPM / SUBCMT UPM: no máximo um policial com status ATIVO por função.
   * Policiais desativados (ou outros status) não ocupam a vaga.
   */
  private async assertApenasUmAtivoComFuncaoCmtSubcmt(
    funcaoId: number,
    statusNome: string,
    excludePolicialId?: number,
  ): Promise<void> {
    if (statusNome !== 'ATIVO') {
      return;
    }
    const funcao = await this.prisma.funcao.findUnique({
      where: { id: funcaoId },
      select: { nome: true },
    });
    if (!funcao) {
      return;
    }
    const nomeUpper = funcao.nome.toUpperCase();
    if (!nomeUpper.includes('CMT UPM') && !nomeUpper.includes('SUBCMT UPM')) {
      return;
    }
    const jaExiste = await this.prisma.policial.findFirst({
      where: {
        funcaoId,
        status: { nome: 'ATIVO' },
        ...(excludePolicialId != null ? { id: { not: excludePolicialId } } : {}),
      },
    });
    if (jaExiste) {
      throw new BadRequestException(
        `Já existe um policial ativo com a função "${funcao.nome}". Só pode haver um policial ativo nesta função.`,
      );
    }
  }

  async create(
    data: Omit<CreatePolicialDto, 'responsavelId'>,
    responsavelId?: number,
  ): Promise<PolicialResponse> {
    const actor = await this.audit.resolveActor(responsavelId);
    const matriculaNormalizada = this.sanitizeMatricula(data.matricula);

    if (data.funcaoId) {
      await this.assertApenasUmAtivoComFuncaoCmtSubcmt(
        data.funcaoId,
        data.status ?? 'ATIVO',
      );
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
    const funcaoCriacao = await this.prisma.funcao.findUnique({
      where: { id: data.funcaoId },
      select: { equipeReferencia: true, vinculoEquipe: true },
    });
    const equipeValue = data.equipe !== undefined ? data.equipe : (actor?.equipe ?? null);
    let equipe = equipeValue ? await this.ensureEquipeAtiva(equipeValue) : null;
    if (funcaoCriacao?.equipeReferencia) {
      equipe = funcaoCriacao.equipeReferencia;
    } else if (funcaoCriacao?.vinculoEquipe === 'SEM_EQUIPE') {
      equipe = null;
    }

    const cpfDigits = this.sanitizeCpf(data.cpf);
    if (cpfDigits && !this.validarCpf(cpfDigits)) {
      throw new BadRequestException('CPF inválido (dígitos verificadores incorretos).');
    }
    const dataNascimentoDate = data.dataNascimento
      ? new Date(data.dataNascimento)
      : null;
    const emailValue = data.email != null && data.email !== '' ? data.email.trim() : null;
    const telefoneValue = this.sanitizeTelefone(data.telefone);

    const created = await this.prisma.policial.create({
      data: {
        nome: this.sanitizeNome(data.nome),
        matricula: matriculaNormalizada,
        cpf: cpfDigits ?? null,
        telefone: telefoneValue,
        dataNascimento: dataNascimentoDate,
        email: emailValue,
        matriculaComissionadoGdf: data.matriculaComissionadoGdf != null && data.matriculaComissionadoGdf !== '' ? data.matriculaComissionadoGdf.trim() : null,
        dataPosse: data.dataPosse ? new Date(data.dataPosse) : null,
        status: { connect: { id: statusId } },
        equipe,
        funcao: { connect: { id: data.funcaoId } },
        expediente12x36Fase:
          data.expediente12x36Fase === 'PAR' || data.expediente12x36Fase === 'IMPAR'
            ? data.expediente12x36Fase
            : undefined,
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
    equipes?: string[];
    status?: string;
    statuses?: string[];
    funcaoId?: number;
    funcaoIds?: number[];
    orderBy?: 'nome' | 'matricula' | 'equipe' | 'status' | 'funcao' | 'dataDesligamento';
    orderDir?: 'asc' | 'desc';
    /** Filtro para previsão de férias: só retorna policiais com férias programadas neste mês/ano */
    mesPrevisaoFerias?: number;
    anoPrevisaoFerias?: number;
    /** Ano do registro FeriasPolicial incluído na resposta (padrão: ano civil atual) */
    feriasAno?: number;
    /** Exclui COMISSIONADO do efetivo e das contagens (para cálculo do limite 1/12 de férias) */
    excluirComissionadosParaLimiteFerias?: boolean;
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
      equipes,
      status,
      statuses,
      funcaoId,
      funcaoIds,
      orderBy,
      orderDir,
      mesPrevisaoFerias,
      anoPrevisaoFerias,
      feriasAno,
      excluirComissionadosParaLimiteFerias,
    } = options || {};
    const anoFeriasInclude = feriasAno ?? new Date().getFullYear();
    const include: {
      afastamentos?: boolean;
      funcao?: boolean;
      restricaoMedica?: boolean;
      status?: boolean;
      ferias?: { where: { ano: number }; orderBy: { id: 'asc' | 'desc' }; take: number };
    } = {
      funcao: true,
      status: true,
      ferias: { where: { ano: anoFeriasInclude }, orderBy: { id: 'desc' }, take: 1 },
    };
    if (includeAfastamentos === true) {
      include.afastamentos = true;
    }
    if (includeRestricoes === true) {
      include.restricaoMedica = true;
    }
    const where: Prisma.PolicialWhereInput = {};

    if (equipes?.length) {
      where.equipe = { in: equipes };
    } else if (equipe) {
      where.equipe = equipe;
    }
    if (statuses?.length) {
      where.status = { nome: { in: statuses } };
    } else if (status) {
      where.status = { nome: status as string };
    }
    if (funcaoIds?.length) {
      where.funcaoId = { in: funcaoIds };
    } else if (funcaoId) {
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
    const orderByClause: Prisma.PolicialOrderByWithRelationInput | Prisma.PolicialOrderByWithRelationInput[] =
      orderBy === 'dataDesligamento'
        ? [
            { dataDesativacaoAPartirDe: dir },
            { desativadoEm: dir },
            { nome: 'asc' },
          ]
        : orderBy === 'status'
          ? { status: { nome: dir } }
          : orderBy === 'funcao'
            ? { funcao: { nome: dir } }
            : orderBy
              ? ({ [orderBy]: dir } as Prisma.PolicialOrderByWithRelationInput)
              : { nome: 'asc' };

    // Se não fornecer paginação, retornar todos (incluindo desativados)
    if (page === undefined && pageSize === undefined) {
      const policiais = await this.prisma.policial.findMany({
        where,
        orderBy: orderByClause,
        include,
      });
      let result = policiais.map((policial) => this.mapFeriasPrevisao(policial));
      if (mesPrevisaoFerias != null && anoPrevisaoFerias != null) {
        result = result.filter(
          (p) => p.mesPrevisaoFerias === mesPrevisaoFerias && p.anoPrevisaoFerias === anoPrevisaoFerias,
        );
      }
      return result;
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

    let mapped = allPoliciais.map((policial) => this.mapFeriasPrevisao(policial));

    if (mesPrevisaoFerias != null && anoPrevisaoFerias != null) {
      mapped = mapped.filter(
        (p) => p.mesPrevisaoFerias === mesPrevisaoFerias && p.anoPrevisaoFerias === anoPrevisaoFerias,
      );
    }

    // Excluir comissionados do cálculo quando solicitado (limite 1/12 de férias)
    if (excluirComissionadosParaLimiteFerias) {
      mapped = mapped.filter((p) => p.status !== 'COMISSIONADO');
    }

    // Ordenar em memória: desativados sempre por último, depois pelo campo solicitado
    const orderField = orderBy || 'nome';
    mapped.sort((a, b) => {
      if (orderField === 'dataDesligamento') {
        const ta = this.desligamentoTimestampMs(a);
        const tb = this.desligamentoTimestampMs(b);
        if (ta !== tb) {
          return dir === 'desc' ? tb - ta : ta - tb;
        }
        return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
      }
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
    // Para limite 1/12 de férias: excluir também COMISSIONADO
    const desativadoStatusId = await this.resolveStatusId('DESATIVADO');
    const whereDisponiveis: Prisma.PolicialWhereInput = {
      ...where,
      ...(excluirComissionadosParaLimiteFerias
        ? {
            statusId: {
              notIn: [desativadoStatusId, await this.resolveStatusId('COMISSIONADO')],
            },
          }
        : { statusId: { not: desativadoStatusId } }),
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

  /**
   * Maior e menor `ano` em `FeriasPolicial` (global ou de um policial).
   * A tela de previsão precisa dos dois: o máximo sozinho esconde exercícios antigos no filtro.
   */
  async getUltimoAnoCadastradoFeriasOpcional(
    policialId?: number,
  ): Promise<{ ano: number | null; anoMinimo: number | null }> {
    const agg = await this.prisma.feriasPolicial.aggregate({
      _max: { ano: true },
      _min: { ano: true },
      ...(policialId != null ? { where: { policialId } } : {}),
    });
    return { ano: agg._max.ano, anoMinimo: agg._min.ano };
  }

  async findOne(id: number): Promise<PolicialResponse> {
    const policial = await this.prisma.policial.findUnique({
      where: { id },
      include: { 
        afastamentos: true, 
        funcao: true, 
        restricaoMedica: true,
        status: true,
        ferias: { orderBy: [{ ano: 'desc' }, { id: 'desc' }] },
        restricoesMedicasHistorico: {
          include: { restricaoMedica: true },
          orderBy: { dataFim: 'desc' },
        },
      },
    });

    if (!policial) {
      throw new NotFoundException(`Policial ${id} não encontrado.`);
    }

    const base = this.mapFeriasPrevisao(policial);
    const civil = new Date().getFullYear();
    const anosComGozoFerias = await this.getAnosExercicioComAfastamentoFeriasAtivo(id);
    if (base.previsoesFeriasPorExercicio?.length) {
      base.previsoesFeriasPorExercicio = base.previsoesFeriasPorExercicio.map((p) => ({
        ...p,
        podeExcluirPrevisaoAnterior: p.ano < civil && !anosComGozoFerias.has(p.ano),
      }));
    }
    return base;
  }

  /** Anos de cota (exercício) com gozo de Férias ainda válido para regra (ativo ou encerrado; desativado manual não conta). */
  private async getAnosExercicioComAfastamentoFeriasAtivo(policialId: number): Promise<Set<number>> {
    const motivoFerias = await this.prisma.motivoAfastamento.findUnique({
      where: { nome: 'Férias' },
      select: { id: true },
    });
    if (!motivoFerias) return new Set();
    const rows = await this.prisma.afastamento.findMany({
      where: {
        policialId,
        motivoId: motivoFerias.id,
        status: { in: [AfastamentoStatus.ATIVO, AfastamentoStatus.ENCERRADO] },
      },
      select: { anoExercicioFerias: true, dataInicio: true },
    });
    return new Set(rows.map((a) => a.anoExercicioFerias ?? a.dataInicio.getFullYear()));
  }

  /**
   * Remove `FeriasPolicial` de um exercício **anterior ao ano civil**, se não houver gozo (afastamento Férias ativo) na cota.
   */
  async removePrevisaoFeriasExercicioAnterior(
    policialId: number,
    anoExercicio: number,
    responsavelId?: number,
  ): Promise<PolicialResponse> {
    const civil = new Date().getFullYear();
    if (anoExercicio >= civil) {
      throw new BadRequestException(
        'Só é permitido excluir previsão de exercícios anteriores ao ano civil atual.',
      );
    }

    const policial = await this.prisma.policial.findUnique({
      where: { id: policialId },
      select: { id: true, status: { select: { nome: true } } },
    });
    if (!policial) {
      throw new NotFoundException(`Policial ${policialId} não encontrado.`);
    }
    if (policial.status.nome === 'DESATIVADO') {
      throw new BadRequestException(
        'Policiais desativados não podem ter previsão de férias alterada.',
      );
    }

    const feriasRow = await this.prisma.feriasPolicial.findUnique({
      where: { policialId_ano: { policialId, ano: anoExercicio } },
    });
    if (!feriasRow) {
      throw new NotFoundException(
        `Não há previsão de férias cadastrada para o exercício de ${anoExercicio}.`,
      );
    }

    const anosComGozo = await this.getAnosExercicioComAfastamentoFeriasAtivo(policialId);
    if (anosComGozo.has(anoExercicio)) {
      throw new BadRequestException(
        `Não é possível excluir a previsão do exercício de ${anoExercicio}: já existe afastamento de férias (ativo ou encerrado) vinculado a esse período.`,
      );
    }

    const actor = await this.audit.resolveActor(responsavelId);
    await this.prisma.feriasPolicial.delete({
      where: { policialId_ano: { policialId, ano: anoExercicio } },
    });

    await this.audit.record({
      entity: 'FeriasPolicial',
      entityId: feriasRow.id,
      action: AuditAction.DELETE,
      actor,
      before: feriasRow,
    });

    return this.findOne(policialId);
  }

  /**
   * Retorna policiais que têm férias programadas (FeriasPolicial) no mês atual ou no próximo mês,
   * mas que ainda não possuem afastamento de motivo "Férias" cadastrado que cubra esse(s) mês(es).
   * Usado para alerta no dashboard.
   */
  async findPoliciaisComFeriasProgramadasSemAfastamento(equipe?: string): Promise<PolicialResponse[]> {
    const now = new Date();
    const anoAtual = now.getFullYear();
    const mesAtual = now.getMonth() + 1; // 1-12 (mês atual no fuso do servidor)
    const proximoMes = mesAtual === 12 ? 1 : mesAtual + 1;
    const anoProximo = mesAtual === 12 ? anoAtual + 1 : anoAtual;

    const motivoFerias = await this.prisma.motivoAfastamento.findUnique({
      where: { nome: 'Férias' },
      select: { id: true },
    });
    if (!motivoFerias) return [];

    const feriasPrevisao = await this.prisma.feriasPolicial.findMany({
      where: {
        ano: { in: [anoAtual, anoProximo] },
        /** Placeholder de “só ano” é janeiro; não deve gerar alerta de mês previsto no dashboard. */
        semMesDefinido: false,
      },
      select: {
        policialId: true,
        dataInicio: true,
        ano: true,
      },
    });

    const policialIdsComPrevisaoNoPeriodo = new Set<number>();
    for (const fp of feriasPrevisao) {
      // Usar UTC para evitar que timezone do servidor mude o mês (ex.: 2026-02-01 00:00 UTC em Brasil vira 31/01)
      const mesPrevisao = fp.dataInicio.getUTCMonth() + 1;
      const anoPrevisao = fp.ano;
      const ehMesAtual = anoPrevisao === anoAtual && mesPrevisao === mesAtual;
      const ehProximoMes = anoPrevisao === anoProximo && mesPrevisao === proximoMes;
      if (ehMesAtual || ehProximoMes) policialIdsComPrevisaoNoPeriodo.add(fp.policialId);
    }

    if (policialIdsComPrevisaoNoPeriodo.size === 0) return [];

    const primeiroDiaMesAtual = new Date(anoAtual, mesAtual - 1, 1);
    const ultimoDiaMesAtual = new Date(anoAtual, mesAtual, 0, 23, 59, 59);
    const primeiroDiaProximoMes = new Date(anoProximo, proximoMes - 1, 1);
    const ultimoDiaProximoMes = new Date(anoProximo, proximoMes, 0, 23, 59, 59);

    const afastamentosFerias = await this.prisma.afastamento.findMany({
      where: {
        policialId: { in: Array.from(policialIdsComPrevisaoNoPeriodo) },
        motivoId: motivoFerias.id,
        status: { not: AfastamentoStatus.DESATIVADO },
      },
      select: { policialId: true, dataInicio: true, dataFim: true },
    });

    function sobrepoeMes(
      inicio: Date,
      fim: Date | null,
      primeiroDia: Date,
      ultimoDia: Date,
    ): boolean {
      const inicioOk = inicio.getTime() <= ultimoDia.getTime();
      const fimOk = fim == null || fim.getTime() >= primeiroDia.getTime();
      return inicioOk && fimOk;
    }

    const policialIdsComAfastamentoNoPeriodo = new Set<number>();
    for (const a of afastamentosFerias) {
      const sobrepoeMesAtual = sobrepoeMes(
        a.dataInicio,
        a.dataFim,
        primeiroDiaMesAtual,
        ultimoDiaMesAtual,
      );
      const sobrepoeProximoMes = sobrepoeMes(
        a.dataInicio,
        a.dataFim,
        primeiroDiaProximoMes,
        ultimoDiaProximoMes,
      );
      if (sobrepoeMesAtual || sobrepoeProximoMes) policialIdsComAfastamentoNoPeriodo.add(a.policialId);
    }

    const idsSemAfastamento = Array.from(policialIdsComPrevisaoNoPeriodo).filter(
      (id) => !policialIdsComAfastamentoNoPeriodo.has(id),
    );

    if (idsSemAfastamento.length === 0) return [];

    const where: Prisma.PolicialWhereInput = {
      id: { in: idsSemAfastamento },
      status: { nome: { not: 'DESATIVADO' } },
    };
    if (equipe) where.equipe = equipe;

    const anoAtualFerias = new Date().getFullYear();
    const policiais = await this.prisma.policial.findMany({
      where,
      orderBy: { nome: 'asc' },
      include: {
        funcao: true,
        status: true,
        ferias: { where: { ano: anoAtualFerias }, orderBy: { id: 'desc' }, take: 1 },
      },
    });

    return policiais.map((p) => this.mapFeriasPrevisao(p as PolicialWithRelations & { ferias?: FeriasPolicialEntity[] }));
  }

  /**
   * Retorna policiais que têm férias programadas (FeriasPolicial) nos dois meses ANTERIORES ao atual,
   * mas que ainda não possuem afastamento de motivo "Férias" cadastrado que cubra esse(s) mês(es).
   * Ex.: em março, considera fevereiro e janeiro. Usado para alerta de férias atrasadas no dashboard.
   */
  async findPoliciaisComFeriasAtrasadasSemAfastamento(equipe?: string): Promise<PolicialResponse[]> {
    const now = new Date();
    const anoAtual = now.getFullYear();
    const mesAtual = now.getMonth() + 1; // 1-12
    const mesAnterior1 = mesAtual === 1 ? 12 : mesAtual - 1;
    const anoAnterior1 = mesAtual === 1 ? anoAtual - 1 : anoAtual;
    const mesAnterior2 = mesAnterior1 === 1 ? 12 : mesAnterior1 - 1;
    const anoAnterior2 = mesAnterior1 === 1 ? anoAnterior1 - 1 : anoAnterior1;

    const motivoFerias = await this.prisma.motivoAfastamento.findUnique({
      where: { nome: 'Férias' },
      select: { id: true },
    });
    if (!motivoFerias) return [];

    const feriasPrevisao = await this.prisma.feriasPolicial.findMany({
      where: {
        ano: { in: [anoAnterior1, anoAnterior2] },
        semMesDefinido: false,
      },
      select: {
        policialId: true,
        dataInicio: true,
        ano: true,
      },
    });

    const policialIdsComPrevisaoNoPeriodo = new Set<number>();
    for (const fp of feriasPrevisao) {
      const mesPrevisao = fp.dataInicio.getUTCMonth() + 1;
      const anoPrevisao = fp.ano;
      const ehMesAnterior1 = anoPrevisao === anoAnterior1 && mesPrevisao === mesAnterior1;
      const ehMesAnterior2 = anoPrevisao === anoAnterior2 && mesPrevisao === mesAnterior2;
      if (ehMesAnterior1 || ehMesAnterior2) policialIdsComPrevisaoNoPeriodo.add(fp.policialId);
    }

    if (policialIdsComPrevisaoNoPeriodo.size === 0) return [];

    const primeiroDiaMes1 = new Date(anoAnterior1, mesAnterior1 - 1, 1);
    const ultimoDiaMes1 = new Date(anoAnterior1, mesAnterior1, 0, 23, 59, 59);
    const primeiroDiaMes2 = new Date(anoAnterior2, mesAnterior2 - 1, 1);
    const ultimoDiaMes2 = new Date(anoAnterior2, mesAnterior2, 0, 23, 59, 59);

    const afastamentosFerias = await this.prisma.afastamento.findMany({
      where: {
        policialId: { in: Array.from(policialIdsComPrevisaoNoPeriodo) },
        motivoId: motivoFerias.id,
        status: { not: AfastamentoStatus.DESATIVADO },
      },
      select: { policialId: true, dataInicio: true, dataFim: true },
    });

    function sobrepoeMes(
      inicio: Date,
      fim: Date | null,
      primeiroDia: Date,
      ultimoDia: Date,
    ): boolean {
      const inicioOk = inicio.getTime() <= ultimoDia.getTime();
      const fimOk = fim == null || fim.getTime() >= primeiroDia.getTime();
      return inicioOk && fimOk;
    }

    const policialIdsComAfastamentoNoPeriodo = new Set<number>();
    for (const a of afastamentosFerias) {
      const sobrepoe1 = sobrepoeMes(a.dataInicio, a.dataFim, primeiroDiaMes1, ultimoDiaMes1);
      const sobrepoe2 = sobrepoeMes(a.dataInicio, a.dataFim, primeiroDiaMes2, ultimoDiaMes2);
      if (sobrepoe1 || sobrepoe2) policialIdsComAfastamentoNoPeriodo.add(a.policialId);
    }

    const idsSemAfastamento = Array.from(policialIdsComPrevisaoNoPeriodo).filter(
      (id) => !policialIdsComAfastamentoNoPeriodo.has(id),
    );

    if (idsSemAfastamento.length === 0) return [];

    const where: Prisma.PolicialWhereInput = {
      id: { in: idsSemAfastamento },
      status: { nome: { not: 'DESATIVADO' } },
    };
    if (equipe) where.equipe = equipe;

    const anoAtualFerias = new Date().getFullYear();
    const policiais = await this.prisma.policial.findMany({
      where,
      orderBy: { nome: 'asc' },
      include: {
        funcao: true,
        status: true,
        ferias: { where: { ano: anoAtualFerias }, orderBy: { id: 'desc' }, take: 1 },
      },
    });

    return policiais.map((p) => this.mapFeriasPrevisao(p as PolicialWithRelations & { ferias?: FeriasPolicialEntity[] }));
  }

  async update(
    id: number,
    data: UpdatePolicialDto,
    responsavelId?: number,
  ): Promise<PolicialResponse> {
    const before = await this.prisma.policial.findUnique({
      where: { id },
      include: { afastamentos: true, status: true },
    });

    if (!before) {
        throw new NotFoundException(`Policial ${id} não encontrado.`);
    }

    const finalFuncaoId =
      data.funcaoId !== undefined && data.funcaoId !== null && data.funcaoId > 0
        ? data.funcaoId
        : (before.funcaoId ?? 0);
    if (finalFuncaoId > 0) {
      const finalStatusNome =
        data.status !== undefined ? data.status : before.status?.nome ?? 'ATIVO';
      await this.assertApenasUmAtivoComFuncaoCmtSubcmt(
        finalFuncaoId,
        finalStatusNome,
        id,
      );
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

    if (data.cpf !== undefined) {
      const cpfDigits = this.sanitizeCpf(data.cpf);
      if (cpfDigits && !this.validarCpf(cpfDigits)) {
        throw new BadRequestException('CPF inválido (dígitos verificadores incorretos).');
      }
      updateData.cpf = cpfDigits ?? null;
    }
    if (data.dataNascimento !== undefined) {
      updateData.dataNascimento = data.dataNascimento
        ? new Date(data.dataNascimento)
        : null;
    }
    if (data.email !== undefined) {
      updateData.email = data.email != null && data.email !== '' ? data.email.trim() : null;
    }
    if (data.telefone !== undefined) {
      updateData.telefone = this.sanitizeTelefone(data.telefone);
    }
    if (data.matriculaComissionadoGdf !== undefined) {
      updateData.matriculaComissionadoGdf = data.matriculaComissionadoGdf != null && data.matriculaComissionadoGdf !== '' ? data.matriculaComissionadoGdf.trim() : null;
    }
    if (data.dataPosse !== undefined) {
      updateData.dataPosse = data.dataPosse ? new Date(data.dataPosse) : null;
    }

    if (data.fotoUrl !== undefined) {
      updateData.fotoUrl = data.fotoUrl;
    }

    const payloadFeriasPrevisao =
      data.mesPrevisaoFerias !== undefined ||
      data.anoPrevisaoFerias !== undefined ||
      data.feriasConfirmadas !== undefined ||
      data.feriasReprogramadas !== undefined ||
      data.somenteAnoPrevisaoFerias !== undefined;
    const permaneceDesativado =
      before.status?.nome === 'DESATIVADO' &&
      (data.status === undefined || data.status === 'DESATIVADO');
    if (permaneceDesativado && payloadFeriasPrevisao) {
      throw new BadRequestException(
        'Policiais desativados não podem ter previsão de férias alterada ou confirmada. Reative o policial antes, se aplicável.',
      );
    }

    if (data.expediente12x36Fase !== undefined) {
      updateData.expediente12x36Fase = data.expediente12x36Fase;
    }

    if (data.funcaoId !== undefined) {
      if (data.funcaoId === null || data.funcaoId === 0) {
        throw new BadRequestException('A função é obrigatória. Informe uma função válida.');
      }
      updateData.funcao = { connect: { id: data.funcaoId } };
      // Regra: todo policial que passa a ter função sem equipe (Expediente adm, CMT UPM, SUBCMT UPM)
      // deve ter o registro de equipe zerado no banco, independentemente da equipe anterior.
      const funcao = await this.prisma.funcao.findUnique({
        where: { id: data.funcaoId },
        select: { nome: true, vinculoEquipe: true, equipeReferencia: true },
      });
      if (funcao) {
        if (funcao.equipeReferencia) {
          updateData.equipe = funcao.equipeReferencia;
        }
        const nomeUpper = funcao.nome.toUpperCase();
        const semEquipePorNome =
          nomeUpper.includes('EXPEDIENTE ADM') ||
          nomeUpper.includes('CMT UPM') ||
          nomeUpper.includes('SUBCMT UPM');
        if (funcao.vinculoEquipe === 'SEM_EQUIPE' || semEquipePorNome) {
          updateData.equipe = null;
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
        somenteAnoPrevisaoFerias: data.somenteAnoPrevisaoFerias,
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

    const anoFeriasResposta = this.anoFeriasParaRespostaAposPayloadPrevisao(data);
    const updatedWithFerias = await this.prisma.policial.findUnique({
      where: { id: updated.id },
      include: {
        afastamentos: true,
        funcao: true,
        restricaoMedica: true,
        status: true,
        ferias: { where: { ano: anoFeriasResposta }, orderBy: { id: 'desc' }, take: 1 },
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

        createData.funcao = { connect: { id: policialData.funcaoId } };

        await this.assertApenasUmAtivoComFuncaoCmtSubcmt(
          policialData.funcaoId,
          policialData.status,
        );

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

  async createRestricaoMedica(
    data: CreateRestricaoMedicaDto,
    responsavelId?: number,
  ): Promise<{ id: number; nome: string; descricao: string | null; createdAt: Date; updatedAt: Date }> {
    const actor = await this.audit.resolveActor(responsavelId);

    const nome = data.nome.trim();
    const descricao = data.descricao?.trim() || null;

    const existente = await this.prisma.restricaoMedica.findUnique({
      where: { nome },
    });
    if (existente) {
      throw new BadRequestException(`Já existe uma restrição de serviço com o nome "${nome}".`);
    }

    const created = await this.prisma.restricaoMedica.create({
      data: { nome, descricao },
    });

    await this.audit.record({
      entity: 'RestricaoMedica',
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      after: created,
    });

    return created;
  }

  async updateRestricaoMedicaOption(
    id: number,
    data: UpdateRestricaoMedicaDto,
    responsavelId?: number,
  ): Promise<{ id: number; nome: string; descricao: string | null; createdAt: Date; updatedAt: Date }> {
    const actor = await this.audit.resolveActor(responsavelId);

    const before = await this.prisma.restricaoMedica.findUnique({
      where: { id },
    });
    if (!before) {
      throw new NotFoundException(`Restrição de serviço ${id} não encontrada.`);
    }

    if (data.nome && data.nome.trim() !== before.nome) {
      const existente = await this.prisma.restricaoMedica.findUnique({
        where: { nome: data.nome.trim() },
      });
      if (existente) {
        throw new BadRequestException(`Já existe uma restrição de serviço com o nome "${data.nome.trim()}".`);
      }
    }

    const updateData: Prisma.RestricaoMedicaUpdateInput = {};
    if (data.nome !== undefined) {
      updateData.nome = data.nome.trim();
    }
    if (data.descricao !== undefined) {
      updateData.descricao = data.descricao?.trim() || null;
    }

    const updated = await this.prisma.restricaoMedica.update({
      where: { id },
      data: updateData,
    });

    await this.audit.record({
      entity: 'RestricaoMedica',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    return updated;
  }

  async deleteRestricaoMedicaOption(id: number, responsavelId?: number): Promise<void> {
    const actor = await this.audit.resolveActor(responsavelId);

    const before = await this.prisma.restricaoMedica.findUnique({
      where: { id },
      include: {
        policiais: { select: { id: true }, take: 1 },
        historico: { select: { id: true }, take: 1 },
      },
    });
    if (!before) {
      throw new NotFoundException(`Restrição de serviço ${id} não encontrada.`);
    }

    if (before.policiais.length > 0) {
      throw new BadRequestException(
        `Não é possível excluir a restrição de serviço "${before.nome}" pois existem policiais cadastrados com esta restrição.`,
      );
    }

    if (before.historico.length > 0) {
      throw new BadRequestException(
        `Não é possível excluir a restrição de serviço "${before.nome}" pois existe histórico vinculado.`,
      );
    }

    await this.prisma.restricaoMedica.delete({ where: { id } });

    await this.audit.record({
      entity: 'RestricaoMedica',
      entityId: id,
      action: AuditAction.DELETE,
      actor,
      before,
    });
  }

  async updateRestricaoMedica(
    id: number,
    restricaoMedicaId: number | null,
    responsavelId?: number,
    observacao?: string | null,
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
      restricaoMedicaObservacao:
        restricaoMedicaId === null ? null : (observacao?.trim() ? observacao.trim() : null),
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
        observacao: before.restricaoMedicaObservacao ?? null,
        removidoPorId: actor.id,
        removidoPorNome: actor.nome,
      },
    });

    // Remover a restrição do policial
    const updateData: Prisma.PolicialUpdateInput = {
      restricaoMedica: { disconnect: true },
      restricaoMedicaObservacao: null,
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

  async removeRestricaoMedicaHistorico(
    id: number,
    historicoId: number,
    responsavelId?: number,
  ): Promise<PolicialResponse> {
    const actor = await this.audit.resolveActor(responsavelId);

    const beforePolicial = await this.prisma.policial.findUnique({
      where: { id },
      include: {
        afastamentos: true,
        funcao: true,
        restricaoMedica: true,
        restricoesMedicasHistorico: {
          include: { restricaoMedica: true },
          orderBy: { dataFim: 'desc' },
        },
        status: true,
      },
    });

    if (!beforePolicial) {
      throw new NotFoundException(`Policial ${id} não encontrado.`);
    }

    const historico = await this.prisma.restricaoMedicaHistorico.findUnique({
      where: { id: historicoId },
      include: { restricaoMedica: true },
    });

    if (!historico || historico.policialId !== id) {
      throw new NotFoundException('Registro de histórico não encontrado para este policial.');
    }

    await this.prisma.restricaoMedicaHistorico.delete({
      where: { id: historicoId },
    });

    await this.audit.record({
      entity: 'RestricaoMedicaHistorico',
      entityId: historicoId,
      action: AuditAction.DELETE,
      actor,
      before: historico,
      after: null,
    });

    const anoAtual = new Date().getFullYear();
    const updatedPolicial = await this.prisma.policial.findUnique({
      where: { id },
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

    return this.mapFeriasPrevisao(updatedPolicial ?? beforePolicial);
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

  /**
   * Retorna contagem de efetivo por posto/graduação (Oficiais, Praças, Civis).
   * Oficiais: CEL, TC, MAJ, CAP, 2º TEN, 1º TEN, ASP
   * Praças: ST, 1º SGT, 2º SGT, 3º SGT, CB, SD (inclui SUBTEN)
   * Civis: CIVIL
   */
  async getEfetivoPorPosto(equipe?: string): Promise<{
    oficiais: number;
    pracas: number;
    civis: number;
    outros: number;
    total: number;
  }> {
    const desativadoStatusId = await this.resolveStatusId('DESATIVADO');
    const where: Prisma.PolicialWhereInput = {
      statusId: { not: desativadoStatusId },
    };
    if (equipe) {
      where.equipe = equipe;
    }
    const policiais = await this.prisma.policial.findMany({
      where,
      select: { nome: true },
    });

    const PATENTE_OFICIAIS = [
      /\bCEL\b/i,
      /\bTC\b/i,
      /\bMAJ\b/i,
      /\bCAP\b/i,
      /\b2[º°ªo.]?\s*TEN\b/i,
      /\b1[º°ªo.]?\s*TEN\b/i,
      /\bASP\b/i,
    ];
    const PATENTE_PRACAS = [
      /\bST\b/i,
      /\bSUB\s*TEN\b/i,
      /\bSUBTEN\b/i,
      /\b1[º°ªo.]?\s*SGT\b/i,
      /\b2[º°ªo.]?\s*SGT\b/i,
      /\b3[º°ªo.]?\s*SGT\b/i,
      /\bCB\b/i,
      /\bSD\b/i,
    ];

    const postos = { oficiais: 0, pracas: 0, civis: 0, outros: 0 };
    for (const p of policiais) {
      const n = String(p.nome ?? '').trim();
      if (/\bCIVIL\b/i.test(n)) {
        postos.civis++;
      } else if (PATENTE_OFICIAIS.some((re) => re.test(n))) {
        postos.oficiais++;
      } else if (PATENTE_PRACAS.some((re) => re.test(n))) {
        postos.pracas++;
      } else {
        postos.outros++;
      }
    }

    return {
      ...postos,
      total: policiais.length,
    };
  }

  /**
   * Retorna lista de policiais filtrados por posto/graduação.
   * posto: 'oficial' | 'praca' | 'civil' | 'outros'
   */
  async findPoliciaisPorPosto(
    posto: 'oficial' | 'praca' | 'civil' | 'outros',
    equipe?: string,
  ): Promise<PolicialResponse[]> {
    const desativadoStatusId = await this.resolveStatusId('DESATIVADO');
    const where: Prisma.PolicialWhereInput = {
      statusId: { not: desativadoStatusId },
    };
    if (equipe) {
      where.equipe = equipe;
    }
    const anoAtual = new Date().getFullYear();
    const policiais = await this.prisma.policial.findMany({
      where,
      include: {
        funcao: true,
        status: true,
        ferias: { where: { ano: anoAtual }, orderBy: { id: 'desc' }, take: 1 },
      },
    });

    const PATENTE_OFICIAIS = [
      /\bCEL\b/i,
      /\bTC\b/i,
      /\bMAJ\b/i,
      /\bCAP\b/i,
      /\b2[º°ªo.]?\s*TEN\b/i,
      /\b1[º°ªo.]?\s*TEN\b/i,
      /\bASP\b/i,
    ];
    const PATENTE_PRACAS = [
      /\bST\b/i,
      /\bSUB\s*TEN\b/i,
      /\bSUBTEN\b/i,
      /\b1[º°ªo.]?\s*SGT\b/i,
      /\b2[º°ªo.]?\s*SGT\b/i,
      /\b3[º°ªo.]?\s*SGT\b/i,
      /\bCB\b/i,
      /\bSD\b/i,
    ];

    const filtrarPorPosto = (p: { nome: string }) => {
      const n = String(p.nome ?? '').trim();
      if (posto === 'civil') return /\bCIVIL\b/i.test(n);
      if (posto === 'oficial') return PATENTE_OFICIAIS.some((re) => re.test(n));
      if (posto === 'praca') return PATENTE_PRACAS.some((re) => re.test(n));
      if (posto === 'outros') {
        return (
          !/\bCIVIL\b/i.test(n) &&
          !PATENTE_OFICIAIS.some((re) => re.test(n)) &&
          !PATENTE_PRACAS.some((re) => re.test(n))
        );
      }
      return false;
    };

    const filtrados = policiais.filter(filtrarPorPosto);
    return filtrados.map((p) => this.mapFeriasPrevisao(p as PolicialWithRelations & { ferias?: FeriasPolicialEntity[] }));
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

