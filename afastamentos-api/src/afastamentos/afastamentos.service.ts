import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, AfastamentoStatus, PolicialStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAfastamentoDto } from './dto/create-afastamento.dto';
import { UpdateAfastamentoDto } from './dto/update-afastamento.dto';

type AfastamentoWithColaborador = Prisma.AfastamentoGetPayload<{
  include: { colaborador: true; motivo: true };
}>;

@Injectable()
export class AfastamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private sanitizeTexto(value: string): string {
    return value.trim();
  }

  /**
   * Calcula o número de dias entre duas datas (inclusive)
   */
  private calcularDiasEntreDatas(dataInicio: Date, dataFim: Date | null): number {
    if (!dataFim) {
      return 0;
    }
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    inicio.setHours(0, 0, 0, 0);
    fim.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(fim.getTime() - inicio.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir o dia inicial
    return diffDays;
  }

  /**
   * Verifica se dois períodos se sobrepõem
   */
  private periodosSobrepostos(
    inicio1: Date,
    fim1: Date | null,
    inicio2: Date,
    fim2: Date | null,
  ): boolean {
    const dataInicio1 = new Date(inicio1);
    const dataFim1 = fim1 ? new Date(fim1) : null;
    const dataInicio2 = new Date(inicio2);
    const dataFim2 = fim2 ? new Date(fim2) : null;

    // Normalizar para comparar apenas a data (sem hora)
    dataInicio1.setHours(0, 0, 0, 0);
    if (dataFim1) dataFim1.setHours(0, 0, 0, 0);
    dataInicio2.setHours(0, 0, 0, 0);
    if (dataFim2) dataFim2.setHours(0, 0, 0, 0);

    // Verificar sobreposição: períodos se sobrepõem se há pelo menos um dia em comum
    // Período 1: [inicio1, fim1] - o policial está de férias até o dia fim1 (inclusive)
    // Período 2: [inicio2, fim2] - o policial estaria de férias a partir do dia inicio2 (inclusive)
    // Dois intervalos [a, b] e [c, d] se sobrepõem se: a <= d && c <= b
    // Mas períodos adjacentes (um termina em X, outro começa em X+1) NÃO se sobrepõem
    if (dataFim1 && dataFim2) {
      // Ambos têm data fim
      // Função auxiliar para obter apenas a data (YYYY-MM-DD)
      const getDateOnly = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const inicio1Str = getDateOnly(dataInicio1);
      const fim1Str = getDateOnly(dataFim1);
      const inicio2Str = getDateOnly(dataInicio2);
      const fim2Str = getDateOnly(dataFim2);

      // Verificar se são adjacentes (um termina em X, outro começa em X+1)
      // Períodos adjacentes NÃO se sobrepõem
      const dataFim1Obj = new Date(fim1Str);
      dataFim1Obj.setDate(dataFim1Obj.getDate() + 1); // Adicionar 1 dia
      const fim1MaisUmDia = getDateOnly(dataFim1Obj);
      
      const dataFim2Obj = new Date(fim2Str);
      dataFim2Obj.setDate(dataFim2Obj.getDate() + 1); // Adicionar 1 dia
      const fim2MaisUmDia = getDateOnly(dataFim2Obj);

      if (inicio2Str === fim1MaisUmDia || inicio1Str === fim2MaisUmDia) {
        return false; // Períodos adjacentes não se sobrepõem
      }
      
      // Verificar sobreposição: dois intervalos [a, b] e [c, d] se sobrepõem se: a <= d && c <= b
      // Usando comparação de strings de data (YYYY-MM-DD) que é mais confiável
      // Mas primeiro verificar se os períodos não se sobrepõem claramente (um termina antes do outro começar)
      if (fim1Str < inicio2Str || fim2Str < inicio1Str) {
        return false; // Períodos não se sobrepõem - um termina antes do outro começar
      }
      
      // Se chegou aqui, verificar a condição padrão de sobreposição
      const condicao1 = inicio1Str <= fim2Str;
      const condicao2 = inicio2Str <= fim1Str;
      
      return condicao1 && condicao2;
    } else if (dataFim1 && !dataFim2) {
      // Período 1 tem fim, período 2 não tem fim
      return dataInicio2.getTime() <= dataFim1.getTime();
    } else if (!dataFim1 && dataFim2) {
      // Período 1 não tem fim, período 2 tem fim
      return dataInicio1.getTime() <= dataFim2.getTime();
    } else {
      // Ambos não têm fim - sempre há sobreposição
      return true;
    }
  }

  /**
   * Calcula o total de dias usados no ano para um motivo específico
   */
  private async calcularDiasUsadosNoAno(
    colaboradorId: number,
    motivoId: number,
    ano: number,
    excluirAfastamentoId?: number,
  ): Promise<number> {
    const inicioAno = new Date(ano, 0, 1);
    const fimAno = new Date(ano, 11, 31, 23, 59, 59);

    const afastamentosDoAno = await this.prisma.afastamento.findMany({
      where: {
        colaboradorId,
        motivoId,
        dataInicio: {
          gte: inicioAno,
          lte: fimAno,
        },
        status: AfastamentoStatus.ATIVO,
        ...(excluirAfastamentoId && { id: { not: excluirAfastamentoId } }),
      },
    });

    let totalDias = 0;
    for (const afastamento of afastamentosDoAno) {
      const dias = this.calcularDiasEntreDatas(
        afastamento.dataInicio,
        afastamento.dataFim,
      );
      totalDias += dias;
    }

    return totalDias;
  }

  /**
   * Calcula o total de dias de afastamento de um colaborador (todos os tipos)
   */
  private async calcularTotalDiasAfastamento(
    colaboradorId: number,
    excluirAfastamentoId?: number,
  ): Promise<number> {
    const afastamentos = await this.prisma.afastamento.findMany({
      where: {
        colaboradorId,
        status: AfastamentoStatus.ATIVO,
        ...(excluirAfastamentoId && { id: { not: excluirAfastamentoId } }),
      },
    });

    let totalDias = 0;
    for (const afastamento of afastamentos) {
      if (afastamento.dataFim) {
        const dias = this.calcularDiasEntreDatas(
          afastamento.dataInicio,
          afastamento.dataFim,
        );
        totalDias += dias;
      }
    }

    return totalDias;
  }

  /**
   * Valida se policial PTTC não ultrapassa 45 dias de afastamento
   */
  private async validarLimitePTTC(
    colaboradorId: number,
    dataInicio: Date,
    dataFim: Date | null,
    excluirAfastamentoId?: number,
  ): Promise<void> {
    // Buscar o colaborador para verificar o status
    const colaborador = await this.prisma.colaborador.findUnique({
      where: { id: colaboradorId },
      select: { status: true },
    });

    if (!colaborador) {
      throw new NotFoundException(`Colaborador ${colaboradorId} não encontrado.`);
    }

    // Só validar se o colaborador for PTTC
    if (colaborador.status !== PolicialStatus.PTTC) {
      return;
    }

    // Para PTTC, data fim é obrigatória
    if (!dataFim) {
      throw new BadRequestException(
        'Para policiais PTTC, é necessário informar a data de término do afastamento.',
      );
    }

    // Calcular total de dias já usados
    const diasUsados = await this.calcularTotalDiasAfastamento(
      colaboradorId,
      excluirAfastamentoId,
    );

    // Calcular dias solicitados
    const diasSolicitados = this.calcularDiasEntreDatas(dataInicio, dataFim);

    // Verificar se ultrapassa 45 dias
    const totalAposCadastro = diasUsados + diasSolicitados;
    const limiteDias = 45;

    if (totalAposCadastro > limiteDias) {
      const diasRestantes = limiteDias - diasUsados;
      throw new BadRequestException(
        `Policial PTTC já possui ${diasUsados} dias de afastamento cadastrados, restando apenas ${diasRestantes} dias. O período solicitado de ${diasSolicitados} dias ultrapassa o limite de ${limiteDias} dias por ano.`,
      );
    }
  }

  /**
   * Valida regras específicas para férias
   */
  private async validarRegrasFerias(
    colaboradorId: number,
    dataInicio: Date,
    dataFim: Date | null,
    excluirAfastamentoId?: number,
  ): Promise<void> {
    // Validar se férias não pode ser antes da data atual
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataInicioNormalizada = new Date(dataInicio);
    dataInicioNormalizada.setHours(0, 0, 0, 0);

    if (dataInicioNormalizada < hoje) {
      throw new BadRequestException(
        'A data de início das férias não pode ser anterior à data atual.',
      );
    }

    // Para férias, data fim é obrigatória
    if (!dataFim) {
      throw new BadRequestException(
        'Para férias, é necessário informar a data de término.',
      );
    }

    // Regra 3: Mínimo de 5 dias por período
    const diasSolicitados = this.calcularDiasEntreDatas(dataInicio, dataFim);
    if (diasSolicitados < 5) {
      throw new BadRequestException(
        `O período de férias deve ter no mínimo 5 dias. Período informado: ${diasSolicitados} dias.`,
      );
    }

    // Buscar o ID do motivo "Férias"
    const motivoFerias = await this.prisma.motivoAfastamento.findUnique({
      where: { nome: 'Férias' },
      select: { id: true },
    });

    if (!motivoFerias) {
      return; // Se não encontrar o motivo, não valida
    }

    const ano = dataInicio.getFullYear();
    const inicioAno = new Date(ano, 0, 1);
    const fimAno = new Date(ano, 11, 31, 23, 59, 59);

    // Buscar todas as férias ativas do colaborador (não apenas do ano, mas que possam se sobrepor)
    // Buscar férias que começam no ano OU que terminam no ano OU que se sobrepõem ao período solicitado
    const feriasExistentes = await this.prisma.afastamento.findMany({
      where: {
        colaboradorId,
        motivoId: motivoFerias.id,
        status: AfastamentoStatus.ATIVO,
        OR: [
          // Férias que começam no ano
          {
            dataInicio: {
              gte: inicioAno,
              lte: fimAno,
            },
          },
          // Férias que terminam no ano
          {
            dataFim: {
              gte: inicioAno,
              lte: fimAno,
            },
          },
          // Férias que começam antes do ano mas terminam depois (cobrem o ano inteiro)
          {
            dataInicio: {
              lt: inicioAno,
            },
            dataFim: {
              gt: fimAno,
            },
          },
        ],
        ...(excluirAfastamentoId && { id: { not: excluirAfastamentoId } }),
      },
      orderBy: { dataInicio: 'asc' },
    });

    // Função auxiliar para converter Date para string YYYY-MM-DD
    const dateToString = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Verificar sobreposição de períodos ANTES de outras validações
    // Normalizar as datas para evitar problemas de timezone
    const novoInicio = new Date(dataInicio);
    novoInicio.setHours(0, 0, 0, 0);
    const novoFim = new Date(dataFim!);
    novoFim.setHours(0, 0, 0, 0);
    
    const novoInicioStr = dateToString(novoInicio);
    const novoFimStr = dateToString(novoFim);

    for (const feriasExistente of feriasExistentes) {
      if (!feriasExistente.dataFim) continue; // Pular se não tiver data fim
      
      // Normalizar as datas existentes também
      const existenteInicio = new Date(feriasExistente.dataInicio);
      existenteInicio.setHours(0, 0, 0, 0);
      const existenteFim = new Date(feriasExistente.dataFim);
      existenteFim.setHours(0, 0, 0, 0);
      
      const existenteInicioStr = dateToString(existenteInicio);
      const existenteFimStr = dateToString(existenteFim);

      // Verificação simples: períodos se sobrepõem se há pelo menos um dia em comum
      // Período existente: [existenteInicioStr, existenteFimStr] (inclusive)
      // Período novo: [novoInicioStr, novoFimStr] (inclusive)
      // Sobreposição se: existenteInicioStr <= novoFimStr && novoInicioStr <= existenteFimStr
      // Mas períodos adjacentes (um termina em X, outro começa em X+1) NÃO se sobrepõem
      
      // Primeiro, verificar se claramente não se sobrepõem (um termina antes do outro começar)
      // Comparação de strings YYYY-MM-DD funciona perfeitamente
      if (existenteFimStr < novoInicioStr || novoFimStr < existenteInicioStr) {
        continue; // Não se sobrepõem, pular para o próximo
      }

      // Verificar se são adjacentes (um termina em X, outro começa em X+1)
      // Se existente termina em 20/02, o próximo dia é 21/02
      // Se novo começa em 21/02, são adjacentes (não se sobrepõem)
      const existenteFimDate = new Date(existenteFim);
      existenteFimDate.setDate(existenteFimDate.getDate() + 1);
      const existenteFimMaisUmStr = dateToString(existenteFimDate);
      
      const novoFimDate = new Date(novoFim);
      novoFimDate.setDate(novoFimDate.getDate() + 1);
      const novoFimMaisUmStr = dateToString(novoFimDate);

      // Se são adjacentes, não se sobrepõem
      if (novoInicioStr === existenteFimMaisUmStr || existenteInicioStr === novoFimMaisUmStr) {
        continue; // São adjacentes, não se sobrepõem
      }

      // Se chegou aqui, há sobreposição
      throw new BadRequestException(
        'Policial já em usufruto de férias no período selecionado. Alterar a data.',
      );
    }

    // Regra 1: Não pode ultrapassar 30 dias por ano
    let totalDias = 0;
    for (const feriasExistente of feriasExistentes) {
      if (feriasExistente.dataFim) {
        const dias = this.calcularDiasEntreDatas(
          feriasExistente.dataInicio,
          feriasExistente.dataFim,
        );
        totalDias += dias;
      }
    }

    const totalAposCadastro = totalDias + diasSolicitados;
    if (totalAposCadastro > 30) {
      const diasRestantes = 30 - totalDias;
      throw new BadRequestException(
        `O colaborador já usufruiu ${totalDias} dias de férias no ano, restando apenas ${diasRestantes} dias. O período solicitado de ${diasSolicitados} dias ultrapassa o limite anual de 30 dias.`,
      );
    }

    // Regra 2: Máximo de 3 períodos por ano e intervalo mínimo de 30 dias entre períodos
    const totalPeriodos = feriasExistentes.length;
    if (totalPeriodos >= 3) {
      throw new BadRequestException(
        'O colaborador já possui 3 períodos de férias cadastrados no ano. Não é possível cadastrar mais períodos.',
      );
    }

    // Regra adicional: Se já existem 2 períodos, o terceiro deve completar exatamente 30 dias
    if (totalPeriodos === 2) {
      // Calcular total de dias já usados nos 2 períodos existentes
      let diasUsados = 0;
      for (const feriasExistente of feriasExistentes) {
        if (feriasExistente.dataFim) {
          const dias = this.calcularDiasEntreDatas(
            feriasExistente.dataInicio,
            feriasExistente.dataFim,
          );
          diasUsados += dias;
        }
      }

      // Calcular quantos dias restam para completar 30 dias
      const diasRestantes = 30 - diasUsados;

      // O terceiro período deve ter exatamente a quantidade de dias restantes
      if (diasSolicitados !== diasRestantes) {
        throw new BadRequestException(
          `O colaborador já possui 2 períodos de férias cadastrados, totalizando ${diasUsados} dias. O terceiro período deve ter exatamente ${diasRestantes} dias para completar o total de 30 dias de férias.`,
        );
      }
    }

    // Função auxiliar para calcular dias entre duas datas (sem incluir os dias finais)
    const calcularDiasEntre = (data1: Date, data2: Date): number => {
      const d1 = new Date(data1);
      const d2 = new Date(data2);
      d1.setHours(0, 0, 0, 0);
      d2.setHours(0, 0, 0, 0);
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    };

    // Verificar intervalo mínimo de 30 dias entre períodos
    for (const feriasExistente of feriasExistentes) {
      if (!feriasExistente.dataFim) continue;

      // Calcular dias entre o fim do período existente e o início do novo período
      const dataFimExistente = new Date(feriasExistente.dataFim);
      const dataInicioNovo = new Date(dataInicio);
      dataFimExistente.setHours(0, 0, 0, 0);
      dataInicioNovo.setHours(0, 0, 0, 0);

      // Se o novo período começa depois do existente
      if (dataInicioNovo > dataFimExistente) {
        const diasEntrePeriodos = calcularDiasEntre(dataFimExistente, dataInicioNovo);
        if (diasEntrePeriodos < 30) {
          throw new BadRequestException(
            `O intervalo entre períodos de férias deve ser de no mínimo 30 dias. O período atual está a ${diasEntrePeriodos} dias do período anterior.`,
          );
        }
      }

      // Se o novo período começa antes do existente
      const dataFimNovo = new Date(dataFim);
      dataFimNovo.setHours(0, 0, 0, 0);
      const dataInicioExistente = new Date(feriasExistente.dataInicio);
      dataInicioExistente.setHours(0, 0, 0, 0);

      if (dataFimNovo < dataInicioExistente) {
        const diasEntrePeriodos = calcularDiasEntre(dataFimNovo, dataInicioExistente);
        if (diasEntrePeriodos < 30) {
          throw new BadRequestException(
            `O intervalo entre períodos de férias deve ser de no mínimo 30 dias. O período atual está a ${diasEntrePeriodos} dias do período posterior.`,
          );
        }
      }
    }
  }

  /**
   * Valida limites de dias para férias e abono
   */
  private async validarLimitesDias(
    colaboradorId: number,
    motivoId: number,
    dataInicio: Date,
    dataFim: Date | null,
    excluirAfastamentoId?: number,
  ): Promise<void> {
    // Buscar o motivo para obter o nome
    const motivo = await this.prisma.motivoAfastamento.findUnique({
      where: { id: motivoId },
      select: { nome: true },
    });

    if (!motivo) {
      throw new NotFoundException(`Motivo ${motivoId} não encontrado.`);
    }

    const motivoNome = motivo.nome;

    // Apenas validar para Férias e Abono
    if (motivoNome !== 'Férias' && motivoNome !== 'Abono') {
      return;
    }

    // Para férias, usar validação específica
    if (motivoNome === 'Férias') {
      await this.validarRegrasFerias(
        colaboradorId,
        dataInicio,
        dataFim,
        excluirAfastamentoId,
      );
      return;
    }

    // Para abono, validar normalmente
    // Validar se abono não pode ser antes da data atual (se necessário)
    
    // Para abono, data fim é obrigatória
    if (!dataFim) {
      throw new BadRequestException(
        'Para abono, é necessário informar a data de término.',
      );
    }

    const ano = dataInicio.getFullYear();
    const diasSolicitados = this.calcularDiasEntreDatas(dataInicio, dataFim);
    const limiteDias = 5;
    const diasUsados = await this.calcularDiasUsadosNoAno(
      colaboradorId,
      motivoId,
      ano,
      excluirAfastamentoId,
    );
    const totalAposCadastro = diasUsados + diasSolicitados;

    // Validar se o período solicitado ultrapassa o limite individual
    if (diasSolicitados > limiteDias) {
      throw new BadRequestException(
        `O período de abono não pode ser superior a ${limiteDias} dias. Período informado: ${diasSolicitados} dias.`,
      );
    }

    // Validar se a soma ultrapassa o limite anual
    if (totalAposCadastro > limiteDias) {
      const diasRestantes = limiteDias - diasUsados;
      throw new BadRequestException(
        `O colaborador já usufruiu ${diasUsados} dias de abono no ano, restando apenas ${diasRestantes} dias. O período solicitado de ${diasSolicitados} dias ultrapassa o limite anual de ${limiteDias} dias.`,
      );
    }
  }

  async create(
    data: Omit<CreateAfastamentoDto, 'responsavelId'>,
    responsavelId?: number,
  ): Promise<AfastamentoWithColaborador> {
    const actor = await this.audit.resolveActor(responsavelId);

    // Verificar se o colaborador existe
    await this.ensureColaboradorExists(data.colaboradorId);

    const dataInicio = new Date(data.dataInicio);
    const dataFim = data.dataFim ? new Date(data.dataFim) : null;

    // Validar limite de 45 dias para policiais PTTC
    await this.validarLimitePTTC(
      data.colaboradorId,
      dataInicio,
      dataFim,
    );

    // Validar limites de dias para férias e abono
    await this.validarLimitesDias(
      data.colaboradorId,
      data.motivoId,
      dataInicio,
      dataFim,
    );

    const created = await this.prisma.afastamento.create({
      data: {
        colaborador: { connect: { id: data.colaboradorId } },
        motivo: { connect: { id: data.motivoId } },
        descricao: data.descricao ? data.descricao.trim() : null,
        dataInicio,
        dataFim,
        status: AfastamentoStatus.ATIVO,
        createdById: actor?.id ?? null,
        createdByName: actor?.nome ?? null,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      include: { colaborador: true, motivo: true },
    });

    await this.audit.record({
      entity: 'Afastamento',
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      after: created,
    });

    return created;
  }

  async findAll(options?: { page?: number; pageSize?: number }): Promise<
    | AfastamentoWithColaborador[]
    | {
        afastamentos: AfastamentoWithColaborador[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }
  > {
    await this.markExpiredAfastamentos();

    const { page, pageSize } = options || {};

    // Se não fornecer paginação, retornar todos (compatibilidade com código existente)
    if (page === undefined && pageSize === undefined) {
      return this.prisma.afastamento.findMany({
        where: { status: AfastamentoStatus.ATIVO },
        include: { colaborador: true, motivo: true },
        orderBy: { dataInicio: 'desc' },
      });
    }

    // Implementar paginação
    const currentPage = page || 1;
    const currentPageSize = pageSize || 10;
    const skip = (currentPage - 1) * currentPageSize;
    const take = currentPageSize;

    const where = { status: AfastamentoStatus.ATIVO };

    const [afastamentos, total] = await this.prisma.$transaction([
      this.prisma.afastamento.findMany({
        where,
        include: { colaborador: true, motivo: true },
        orderBy: { dataInicio: 'desc' },
        skip,
        take,
      }),
      this.prisma.afastamento.count({ where }),
    ]);

    return {
      afastamentos,
      total,
      page: currentPage,
      pageSize: currentPageSize,
      totalPages: Math.ceil(total / currentPageSize),
    };
  }

  async findOne(id: number): Promise<AfastamentoWithColaborador> {
    await this.markExpiredAfastamentos();

    const afastamento = await this.prisma.afastamento.findUnique({
      where: { id },
      include: { colaborador: true, motivo: true },
    });

    if (!afastamento) {
      throw new NotFoundException(`Afastamento ${id} não encontrado.`);
    }

    return afastamento;
  }

  async findByColaborador(
    colaboradorId: number,
  ): Promise<AfastamentoWithColaborador[]> {
    await this.ensureColaboradorExists(colaboradorId);

    await this.markExpiredAfastamentos();

    return this.prisma.afastamento.findMany({
      where: { colaboradorId, status: AfastamentoStatus.ATIVO },
      include: { colaborador: true, motivo: true },
      orderBy: { dataInicio: 'desc' },
    });
  }

  async update(
    id: number,
    data: UpdateAfastamentoDto,
    responsavelId?: number,
  ): Promise<AfastamentoWithColaborador> {
    const before = await this.prisma.afastamento.findUnique({
      where: { id },
      include: { colaborador: true, motivo: true },
    });

    if (!before) {
      throw new NotFoundException(`Afastamento ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);

    // Determinar os valores finais após a atualização
    const motivoIdFinal = data.motivoId !== undefined ? data.motivoId : before.motivoId;
    const dataInicioFinal = data.dataInicio !== undefined 
      ? new Date(data.dataInicio) 
      : before.dataInicio;
    const dataFimFinal = data.dataFim !== undefined
      ? (data.dataFim ? new Date(data.dataFim) : null)
      : before.dataFim;
    const colaboradorIdFinal = data.colaboradorId !== undefined 
      ? data.colaboradorId 
      : before.colaboradorId;

    // Validar limite de 45 dias para policiais PTTC (excluindo o próprio afastamento)
    await this.validarLimitePTTC(
      colaboradorIdFinal,
      dataInicioFinal,
      dataFimFinal,
      id, // Excluir este afastamento do cálculo
    );

    // Validar limites de dias para férias e abono (excluindo o próprio afastamento)
    await this.validarLimitesDias(
      colaboradorIdFinal,
      motivoIdFinal,
      dataInicioFinal,
      dataFimFinal,
      id, // Excluir este afastamento do cálculo
    );

    const updateData: Prisma.AfastamentoUpdateInput = {
      updatedById: actor?.id ?? null,
      updatedByName: actor?.nome ?? null,
    };

    if (data.motivoId !== undefined) {
      updateData.motivo = { connect: { id: data.motivoId } };
    }

    if (data.descricao !== undefined) {
      updateData.descricao = data.descricao?.trim() || null;
    }

    if (data.dataInicio !== undefined) {
      updateData.dataInicio = new Date(data.dataInicio);
    }

    if (data.dataFim !== undefined) {
      updateData.dataFim = data.dataFim ? new Date(data.dataFim) : null;
    }

    if (data.colaboradorId !== undefined) {
      updateData.colaborador = { connect: { id: data.colaboradorId } };
    }

    const updated = await this.prisma.afastamento.update({
      where: { id },
      data: updateData,
      include: { colaborador: true, motivo: true },
    });

    await this.markExpiredAfastamentos();

    await this.audit.record({
      entity: 'Afastamento',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    return updated;
  }

  async remove(id: number, responsavelId?: number): Promise<void> {
    const before = await this.prisma.afastamento.findUnique({
      where: { id },
      include: { colaborador: true, motivo: true },
    });

    if (!before) {
      throw new NotFoundException(`Afastamento ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);

    await this.prisma.afastamento.delete({ where: { id } });

    await this.audit.record({
      entity: 'Afastamento',
      entityId: id,
      action: AuditAction.DELETE,
      actor,
      before,
    });
  }

  private async markExpiredAfastamentos(): Promise<void> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 1);

    const result = await this.prisma.afastamento.updateMany({
      where: {
        status: AfastamentoStatus.ATIVO,
        dataFim: {
          not: null,
          lte: threshold,
        },
      },
      data: {
        status: AfastamentoStatus.ENCERRADO,
        updatedById: null,
        updatedByName: 'Sistema',
      },
    });

    if (result.count > 0) {
      await this.audit.record({
        entity: 'Afastamento',
        action: AuditAction.UPDATE,
        actor: null,
        after: {
          encerrados: result.count,
          executadoEm: new Date().toISOString(),
        },
      });
    }
  }

  private async ensureColaboradorExists(id: number): Promise<void> {
    const exists = await this.prisma.colaborador.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException(`Colaborador ${id} não encontrado.`);
    }
  }

  async listMotivos(): Promise<{ id: number; nome: string; descricao: string | null }[]> {
    return this.prisma.motivoAfastamento.findMany({
      select: {
        id: true,
        nome: true,
        descricao: true,
      },
      orderBy: { id: 'asc' },
    });
  }
}

