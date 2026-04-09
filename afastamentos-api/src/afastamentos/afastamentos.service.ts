import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { AuditAction, AfastamentoStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAfastamentoDto } from './dto/create-afastamento.dto';
import { UpdateAfastamentoDto } from './dto/update-afastamento.dto';
import { CreateMotivoDto } from './dto/create-motivo.dto';
import { UpdateMotivoDto } from './dto/update-motivo.dto';
import { RestricoesAfastamentoService } from '../restricoes-afastamento/restricoes-afastamento.service';

type AfastamentoWithPolicial = Prisma.AfastamentoGetPayload<{
  include: { policial: { include: { funcao: true; status: true } }; motivo: true };
}>;

type AfastamentoWithPolicialResponse = Omit<AfastamentoWithPolicial, 'policial'> & {
  policial: Omit<AfastamentoWithPolicial['policial'], 'status'> & { status: string };
};

@Injectable()
export class AfastamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(forwardRef(() => RestricoesAfastamentoService))
    private readonly restricoesAfastamentoService: RestricoesAfastamentoService,
  ) {}

  private sanitizeTexto(value: string): string {
    return value.trim();
  }

  /**
   * Converte string YYYY-MM-DD ou ISO (ex.: 2026-04-21T00:00:00.000Z) em Date ao meio-dia UTC,
   * evitando que meia-noite UTC mude o dia em fusos como o do Brasil (UTC−3).
   */
  private parseDateOnly(value: string | Date): Date {
    let str: string;
    if (value instanceof Date) {
      str = value.toISOString().slice(0, 10);
    } else {
      str = String(value).trim();
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (!match) {
      return new Date(value as string);
    }
    const [, y, m, d] = match;
    const year = parseInt(y!, 10);
    const month = parseInt(m!, 10) - 1;
    const day = parseInt(d!, 10);
    return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
  }

  private mapAfastamentoStatus(afastamento: AfastamentoWithPolicial): AfastamentoWithPolicialResponse {
    const statusNome = afastamento.policial.status?.nome ?? 'ATIVO';
    const { status, ...policialRest } = afastamento.policial;
    return {
      ...afastamento,
      policial: {
        ...policialRest,
        status: statusNome,
      },
    };
  }

  /**
   * Regra de negócio (COPOM): restrições de férias NÃO devem bloquear policiais que
   * têm mês de férias programado/confirmado para o mesmo mês da restrição.
   *
   * Critério: existir registro em FeriasPolicial (policialId+ano) cujo dataInicio esteja no mesmo mês/ano
   * da data de início solicitada (a data de início está dentro da restrição).
   */
  private async policialTemFeriasProgramadasNoMes(policialId: number, dataInicio: Date): Promise<boolean> {
    const ano = dataInicio.getFullYear();
    const mes = dataInicio.getMonth() + 1;
    const ferias = await this.prisma.feriasPolicial.findUnique({
      where: { policialId_ano: { policialId, ano } },
      select: { dataInicio: true },
    });
    if (!ferias?.dataInicio) {
      return false;
    }
    const mesProgramado = ferias.dataInicio.getMonth() + 1;
    return mesProgramado === mes;
  }

  private async deveIgnorarRestricaoParaFerias(
    policialId: number,
    dataInicio: Date,
    anoExercicioFerias?: number | null,
  ): Promise<boolean> {
    if (await this.policialTemFeriasProgramadasNoMes(policialId, dataInicio)) {
      return true;
    }
    const anoGozo = dataInicio.getFullYear();
    const anoCota = anoExercicioFerias ?? anoGozo;
    if (anoExercicioFerias != null && anoCota < anoGozo) {
      const reg = await this.prisma.feriasPolicial.findUnique({
        where: { policialId_ano: { policialId, ano: anoCota } },
        select: { id: true },
      });
      if (reg) return true;
    }
    return false;
  }

  private async assertPodeGerenciarAfastamentos(userId?: number): Promise<void> {
    if (!userId) {
      throw new ForbiddenException('Usuário inválido.');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      include: { nivel: true },
    });

    if (!usuario) {
      throw new ForbiddenException('Usuário não encontrado.');
    }

    const nivelNome = usuario.nivel?.nome;
    if (nivelNome === 'COMANDO' || nivelNome === 'OPERAÇÕES') {
      throw new ForbiddenException('Seu nível não tem permissão para gerenciar afastamentos.');
    }
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
   * Impede cadastro/edição que sobreponha outro afastamento do mesmo policial (qualquer motivo).
   * Considera só ATIVO e ENCERRADO. DESATIVADO (manual) não entra: permite novo lançamento no mesmo
   * motivo/período/SEI, como se o registro desativado não existisse para efeito de bloqueio.
   */
  private async assertPolicialSemAfastamentoSobreposto(
    policialId: number,
    dataInicio: Date,
    dataFim: Date | null,
    excluirAfastamentoId: number | undefined,
    seiNumeroNovo: string,
  ): Promise<void> {
    const existentes = await this.prisma.afastamento.findMany({
      where: {
        policialId,
        status: { in: [AfastamentoStatus.ATIVO, AfastamentoStatus.ENCERRADO] },
        ...(excluirAfastamentoId != null ? { id: { not: excluirAfastamentoId } } : {}),
      },
      select: {
        dataInicio: true,
        dataFim: true,
        seiNumero: true,
      },
    });

    const seiNorm = seiNumeroNovo.trim();

    for (const ex of existentes) {
      if (
        this.periodosSobrepostos(dataInicio, dataFim, ex.dataInicio, ex.dataFim)
      ) {
        const mesmoSei =
          seiNorm.length > 0 && ex.seiNumero.trim() === seiNorm;
        throw new BadRequestException(
          mesmoSei
            ? 'Já existe um registro de afastamento para este policial no mesmo período e com o mesmo número de processo (SEI). Não é permitido lançar em duplicidade.'
            : 'Já existe um registro de afastamento para este policial que cobre parte ou a totalidade deste período (ativos e encerrados pelo fim do período; desativações manuais não bloqueiam). Ajuste as datas ou exclua o registro anterior antes de lançar outro.',
        );
      }
    }
  }

  /**
   * Calcula o total de dias usados no ano para um motivo específico
   */
  private async calcularDiasUsadosNoAno(
    policialId: number,
    motivoId: number,
    ano: number,
    excluirAfastamentoId?: number,
  ): Promise<number> {
    const inicioAno = new Date(ano, 0, 1);
    const fimAno = new Date(ano, 11, 31, 23, 59, 59);

    const afastamentosDoAno = await this.prisma.afastamento.findMany({
      where: {
        policialId,
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
   * Total de dias de afastamentos ATIVOS do policial para o limite PTTC (45 dias),
   * excluindo o motivo Férias — abono, dispensa médica etc. entram na conta.
   */
  private async calcularTotalDiasAfastamentoParaLimitePTTC(
    policialId: number,
    excluirAfastamentoId?: number,
  ): Promise<number> {
    const motivoFerias = await this.prisma.motivoAfastamento.findUnique({
      where: { nome: 'Férias' },
      select: { id: true },
    });

    const afastamentos = await this.prisma.afastamento.findMany({
      where: {
        policialId,
        status: AfastamentoStatus.ATIVO,
        ...(motivoFerias ? { motivoId: { not: motivoFerias.id } } : {}),
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
   * Valida se policial PTTC não ultrapassa 45 dias de afastamento (sem contar Férias).
   */
  private async validarLimitePTTC(
    policialId: number,
    dataInicio: Date,
    dataFim: Date | null,
    excluirAfastamentoId?: number,
    motivoId?: number,
  ): Promise<void> {
    // Buscar o policial para verificar o status
    const policial = await this.prisma.policial.findUnique({
      where: { id: policialId },
      select: { status: { select: { nome: true } } },
    });

    if (!policial) {
      throw new NotFoundException(`Policial ${policialId} não encontrado.`);
    }

    // Só validar se o policial for PTTC
    if (policial.status?.nome !== 'PTTC') {
      return;
    }

    if (motivoId != null) {
      const motivo = await this.prisma.motivoAfastamento.findUnique({
        where: { id: motivoId },
        select: { nome: true },
      });
      if ((motivo?.nome ?? '').toLowerCase() === 'férias') {
        return;
      }
    }

    // Para PTTC (demais motivos), data fim é obrigatória
    if (!dataFim) {
      throw new BadRequestException(
        'Para policiais PTTC, é necessário informar a data de término do afastamento.',
      );
    }

    const diasUsados = await this.calcularTotalDiasAfastamentoParaLimitePTTC(
      policialId,
      excluirAfastamentoId,
    );

    const diasSolicitados = this.calcularDiasEntreDatas(dataInicio, dataFim);

    const totalAposCadastro = diasUsados + diasSolicitados;
    const limiteDias = 45;

    if (totalAposCadastro > limiteDias) {
      const diasRestantes = limiteDias - diasUsados;
      throw new BadRequestException(
        `Policial PTTC já possui ${diasUsados} dias de afastamento cadastrados (exceto férias), restando apenas ${diasRestantes} dias. O período solicitado de ${diasSolicitados} dias ultrapassa o limite de ${limiteDias} dias por ano para afastamentos que não sejam férias.`,
      );
    }
  }

  private anoExercicioEfetivoFerias(af: { anoExercicioFerias: number | null; dataInicio: Date }): number {
    return af.anoExercicioFerias ?? af.dataInicio.getFullYear();
  }

  /**
   * Valida regras específicas para férias baseado no status do policial.
   * @param anoExercicioFerias Ano da cota (exercício). Nulo = ano civil da data de início do gozo.
   */
  private async validarRegrasFerias(
    policialId: number,
    dataInicio: Date,
    dataFim: Date | null,
    excluirAfastamentoId?: number,
    anoExercicioFerias?: number | null,
  ): Promise<void> {
    // Para férias, data fim é obrigatória
    if (!dataFim) {
      throw new BadRequestException(
        'Para férias, é necessário informar a data de término.',
      );
    }

    const anoGozo = dataInicio.getFullYear();
    const anoCota = anoExercicioFerias ?? anoGozo;
    if (anoCota > anoGozo) {
      throw new BadRequestException(
        'O ano de exercício das férias não pode ser posterior ao ano da data de início do gozo.',
      );
    }
    const ehAcumulado = anoCota < anoGozo;

    // Previsão e regras de mês referem-se ao exercício (cota) consumida
    const policial = await this.prisma.policial.findUnique({
      where: { id: policialId },
      select: {
        status: { select: { nome: true } },
        ferias: { where: { ano: anoCota }, orderBy: { id: 'desc' }, take: 1 },
      },
    });

    if (!policial) {
      throw new NotFoundException(`Policial ${policialId} não encontrado.`);
    }

    const feriasAtual = policial.ferias?.[0];

    // REGRA: O policial deve ter mês de previsão de férias cadastrado para o exercício
    if (!feriasAtual || !feriasAtual.dataInicio) {
      throw new BadRequestException(
        ehAcumulado
          ? `Não é possível lançar férias acumuladas do exercício de ${anoCota} sem previsão de férias cadastrada para esse ano. Cadastre a previsão em "Previsão de férias" para ${anoCota} antes de registrar o gozo (com data de início e data de término).`
          : 'Não é possível cadastrar férias sem previsão de férias para o exercício. Cadastre a previsão em "Previsão de férias" antes de registrar o afastamento (com data de início e data de término).',
      );
    }

    const feriasRow = feriasAtual as typeof feriasAtual & { semMesDefinido?: boolean };

    // Prazo “até o fim do mês previsto” só quando há mês real na previsão (sem placeholder “só ano”); não se aplica no acúmulo (gozo em ano posterior ao exercício)
    if (
      !ehAcumulado &&
      feriasRow.semMesDefinido !== true &&
      feriasAtual.dataInicio &&
      feriasAtual.ano
    ) {
      const mesPrevisto = feriasAtual.dataInicio.getMonth() + 1;
      const anoPrevisto = feriasAtual.ano;
      const ultimoDiaMesPrevisto = new Date(anoPrevisto, mesPrevisto, 0, 23, 59, 59, 999);
      const dataInicioNormalizada = new Date(dataInicio);
      dataInicioNormalizada.setHours(0, 0, 0, 0);

      if (dataInicioNormalizada > ultimoDiaMesPrevisto) {
        const meses = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
        ];
        const nomeMesPrevisto = meses[mesPrevisto - 1];

        throw new BadRequestException(
          `Não é possível cadastrar férias após ${nomeMesPrevisto}/${anoPrevisto}. As férias devem ser totalmente usufruídas até o último dia do mês previsto (${nomeMesPrevisto}/${anoPrevisto}).`,
        );
      }
    }

    const diasSolicitados = this.calcularDiasEntreDatas(dataInicio, dataFim);
    
    // Aplicar regras diferentes baseado no status
    const statusNome = policial.status?.nome;
    const isComissionado = statusNome === 'COMISSIONADO';
    const isAtivoPTTCouDesignado = 
      statusNome === 'ATIVO' ||
      statusNome === 'PTTC' ||
      statusNome === 'DESIGNADO';

    if (!isComissionado && !isAtivoPTTCouDesignado) {
      throw new BadRequestException(
        `Policiais com status ${statusNome ?? 'INDEFINIDO'} não podem tirar férias.`,
      );
    }

    // Regra 1: Mínimo de dias por período
    const minimoDiasPorPeriodo = isComissionado ? 10 : 5;
    if (diasSolicitados < minimoDiasPorPeriodo) {
      throw new BadRequestException(
        `O período de férias deve ter no mínimo ${minimoDiasPorPeriodo} dias para policiais ${isComissionado ? 'comissionados' : 'ativos, PTTC ou designados'}. Período informado: ${diasSolicitados} dias.`,
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

    const todasFeriasAtivas = await this.prisma.afastamento.findMany({
      where: {
        policialId,
        motivoId: motivoFerias.id,
        status: AfastamentoStatus.ATIVO,
        ...(excluirAfastamentoId && { id: { not: excluirAfastamentoId } }),
      },
      orderBy: { dataInicio: 'asc' },
    });

    const feriasDoExercicio = todasFeriasAtivas.filter(
      (f) => this.anoExercicioEfetivoFerias(f) === anoCota,
    );

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

    for (const feriasExistente of todasFeriasAtivas) {
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

    // Total de dias já usados na mesma cota (exercício)
    let totalDias = 0;
    for (const feriasExistente of feriasDoExercicio) {
      if (feriasExistente.dataFim) {
        const dias = this.calcularDiasEntreDatas(
          feriasExistente.dataInicio,
          feriasExistente.dataFim,
        );
        totalDias += dias;
      }
    }

    // Regra: Não pode ultrapassar 30 dias por exercício (válido para todos)
    const totalAposCadastro = totalDias + diasSolicitados;
    if (totalAposCadastro > 30) {
      const diasRestantes = 30 - totalDias;
      throw new BadRequestException(
        `O policial já usufruiu ${totalDias} dias de férias no exercício de ${anoCota}, restando apenas ${diasRestantes} dias. O período solicitado de ${diasSolicitados} dias ultrapassa o limite de 30 dias por exercício.`,
      );
    }

    const totalPeriodos = feriasDoExercicio.length;
    const totalPeriodosAposCadastro = totalPeriodos + 1; // Incluir o período sendo cadastrado

    // Função auxiliar para calcular dias entre duas datas (sem incluir os dias finais)
    const calcularDiasEntre = (data1: Date, data2: Date): number => {
      const d1 = new Date(data1);
      const d2 = new Date(data2);
      d1.setHours(0, 0, 0, 0);
      d2.setHours(0, 0, 0, 0);
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    };

    // REGRA 1: Máximo de 3 períodos por ano (válido para todos os status)
    if (totalPeriodosAposCadastro > 3) {
      throw new BadRequestException(
        `As férias podem ser parceladas em até 3 períodos por exercício (${anoCota}). Não é possível cadastrar mais períodos.`,
      );
    }

    // REGRAS PARA POLICIAIS ATIVOS, PTTC OU DESIGNADOS
    if (isAtivoPTTCouDesignado) {
      // Validação de máximo de períodos já feita acima

      // Para ATIVO/PTTC/DESIGNADO: sem intervalo mínimo entre períodos
      // Não precisa validar intervalo entre períodos
    }

    // REGRAS PARA POLICIAIS COMISSIONADOS
    if (isComissionado) {
      // Validação de máximo de períodos já feita acima

      // Verificar intervalo mínimo de 30 dias entre períodos (mesmo exercício)
      for (const feriasExistente of feriasDoExercicio) {
        if (!feriasExistente.dataFim) continue;

        const dataFimExistente = new Date(feriasExistente.dataFim);
        const dataInicioNovo = new Date(dataInicio);
        dataFimExistente.setHours(0, 0, 0, 0);
        dataInicioNovo.setHours(0, 0, 0, 0);

        // Se o novo período começa depois do existente
        if (dataInicioNovo > dataFimExistente) {
          const diasEntrePeriodos = calcularDiasEntre(dataFimExistente, dataInicioNovo);
          if (diasEntrePeriodos < 30) {
            throw new BadRequestException(
              `Para policiais comissionados, o intervalo entre períodos de férias deve ser de no mínimo 30 dias. O período atual está a ${diasEntrePeriodos} dias do período anterior.`,
            );
          }
        }

        // Se o novo período começa antes do existente
        const dataFimNovo = new Date(dataFim!);
        dataFimNovo.setHours(0, 0, 0, 0);
        const dataInicioExistente = new Date(feriasExistente.dataInicio);
        dataInicioExistente.setHours(0, 0, 0, 0);

        if (dataFimNovo < dataInicioExistente) {
          const diasEntrePeriodos = calcularDiasEntre(dataFimNovo, dataInicioExistente);
          if (diasEntrePeriodos < 30) {
            throw new BadRequestException(
              `Para policiais comissionados, o intervalo entre períodos de férias deve ser de no mínimo 30 dias. O período atual está a ${diasEntrePeriodos} dias do período posterior.`,
            );
          }
        }
      }

      // Validar se os dias restantes permitem pelo menos um período válido (mínimo 10 dias)
      // Regra: permite toda e qualquer combinação válida em 2 ou 3 períodos, desde que:
      // - total não ultrapasse 30 dias/ano
      // - cada período tenha no mínimo 10 dias
      // Ex.: 10+20, 11+19, 12+18, 13+17, 14+16, 15+15, 10+10+10, etc.
      const totalDiasAposCadastro = totalDias + diasSolicitados;
      const diasRestantes = 30 - totalDiasAposCadastro;
      const periodosRestantes = 3 - totalPeriodosAposCadastro;
      
      if (periodosRestantes > 0 && diasRestantes > 0) {
        // Os dias restantes devem permitir pelo menos um período de 10 dias (podem ser usados em um único período)
        const minimoParaUmPeriodo = 10;
        
        if (diasRestantes < minimoParaUmPeriodo) {
          throw new BadRequestException(
            `Para policiais comissionados, não é possível dividir as férias em períodos válidos. Com ${totalDiasAposCadastro} dias já utilizados (${totalPeriodosAposCadastro} período(s)), restam ${diasRestantes} dias, mas cada período precisa ter no mínimo 10 dias. É necessário ajustar o período atual.`,
          );
        }
      }
    }

    // Validar que o último período (cronologicamente) do exercício inicie no mês previsto — não exige isso para gozo acumulado em ano posterior
    if (!ehAcumulado && feriasAtual?.dataInicio && feriasAtual.ano) {
      const mesPrevisto = feriasAtual.dataInicio.getMonth() + 1;
      const anoPrevisto = feriasAtual.ano;

      const totalDiasAposCadastro = totalDias + diasSolicitados;
      const totalPeriodosAposCadastroUltimo = feriasDoExercicio.length + 1;

      const primeiroDiaMesPrevisto = new Date(anoPrevisto, mesPrevisto - 1, 1, 0, 0, 0, 0);
      const ultimoDiaMesPrevisto = new Date(anoPrevisto, mesPrevisto, 0, 23, 59, 59, 999);

      const todosPeriodos: Date[] = [
        ...feriasDoExercicio
          .filter((f) => f.dataFim)
          .map((f) => new Date(f.dataInicio)),
        new Date(dataInicio),
      ].map((d) => {
        const copy = new Date(d);
        copy.setHours(0, 0, 0, 0);
        return copy;
      });
      todosPeriodos.sort((a, b) => a.getTime() - b.getTime());

      // O último período cronologicamente (o que inicia mais tarde)
      const ultimoPeriodoInicio = todosPeriodos[todosPeriodos.length - 1];
      const ultimoPeriodoEstaNoMesPrevisto =
        ultimoPeriodoInicio >= primeiroDiaMesPrevisto &&
        ultimoPeriodoInicio <= ultimoDiaMesPrevisto;

      const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      const nomeMesPrevisto = meses[mesPrevisto - 1];

      // Aplicar validação apenas quando o conjunto completo exige o último período no mês previsto:
      // - completa/ultrapassa 30 dias, OU
      // - é o 3º período (último possível)
      if (totalDiasAposCadastro >= 30 || totalPeriodosAposCadastroUltimo === 3) {
        if (!ultimoPeriodoEstaNoMesPrevisto) {
          throw new BadRequestException(
            `O último período de férias (cronologicamente) deve iniciar obrigatoriamente no mês previsto (${nomeMesPrevisto}/${anoPrevisto}), podendo ser até o último dia do mês. Verifique se já existe um período no mês previsto ou se o período que completa os 30 dias está correto.`,
          );
        }
      }
    }
  }

  /**
   * Valida limites de dias para férias e abono
   */
  private async validarLimitesDias(
    policialId: number,
    motivoId: number,
    dataInicio: Date,
    dataFim: Date | null,
    excluirAfastamentoId?: number,
    anoExercicioFerias?: number | null,
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
        policialId,
        dataInicio,
        dataFim,
        excluirAfastamentoId,
        anoExercicioFerias,
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
      policialId,
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
        `O policial já usufruiu ${diasUsados} dias de abono no ano, restando apenas ${diasRestantes} dias. O período solicitado de ${diasSolicitados} dias ultrapassa o limite anual de ${limiteDias} dias.`,
      );
    }
  }

  async create(
    data: Omit<CreateAfastamentoDto, 'responsavelId'>,
    responsavelId?: number,
  ): Promise<AfastamentoWithPolicialResponse> {
    await this.assertPodeGerenciarAfastamentos(responsavelId);
    const actor = await this.audit.resolveActor(responsavelId);

    // Verificar se o policial existe
    await this.ensurePolicialExists(data.policialId);

    const dataInicio = this.parseDateOnly(data.dataInicio);
    const dataFim = data.dataFim ? this.parseDateOnly(data.dataFim) : null;

    await this.assertPolicialSemAfastamentoSobreposto(
      data.policialId,
      dataInicio,
      dataFim,
      undefined,
      data.seiNumero,
    );

    // Validar limite de 45 dias para policiais PTTC (férias fora deste limite)
    await this.validarLimitePTTC(
      data.policialId,
      dataInicio,
      dataFim,
      undefined,
      data.motivoId,
    );

    const motivo = await this.prisma.motivoAfastamento.findUnique({
      where: { id: data.motivoId },
    });
    const motivoEhFerias = (motivo?.nome ?? '').toLowerCase() === 'férias';
    if (data.anoExercicioFerias != null && !motivoEhFerias) {
      throw new BadRequestException(
        'O ano de exercício das férias só pode ser informado quando o motivo for Férias.',
      );
    }
    const anoExercicioParaFerias = motivoEhFerias ? (data.anoExercicioFerias ?? null) : null;

    // Validar limites de dias para férias e abono
    await this.validarLimitesDias(
      data.policialId,
      data.motivoId,
      dataInicio,
      dataFim,
      undefined,
      anoExercicioParaFerias,
    );

    // Validar restrições de afastamento
    // Verificar apenas se o início está dentro de uma restrição
    // (Para Férias, a restrição deve bloquear apenas o início, não qualquer sobreposição)
    const restricao = await this.restricoesAfastamentoService.verificarRestricao(
      dataInicio,
      data.motivoId,
    );

    if (restricao.bloqueado && restricao.restricao) {
      // Exceção: se for Férias e o policial tiver férias programadas/confirmadas para este mês,
      // a restrição não deve bloquear.
      if (motivoEhFerias) {
        const ignoraRestricao = await this.deveIgnorarRestricaoParaFerias(
          data.policialId,
          dataInicio,
          anoExercicioParaFerias,
        );
        if (ignoraRestricao) {
          // segue o fluxo normalmente (não bloqueia)
        } else {
          const motivoNome = motivo?.nome || 'este tipo de afastamento';
          const restricaoNome = restricao.restricao.tipoRestricao?.nome || 'restrição';
          throw new BadRequestException(
            `Não é possível cadastrar ${motivoNome} com início em ${new Date(dataInicio).toLocaleDateString('pt-BR')}. Esta data está dentro do período de restrição "${restricaoNome}" (${new Date(restricao.restricao.dataInicio).toLocaleDateString('pt-BR')} a ${new Date(restricao.restricao.dataFim).toLocaleDateString('pt-BR')}).`,
          );
        }
      } else {
        const motivoNome = motivo?.nome || 'este tipo de afastamento';
        const restricaoNome = restricao.restricao.tipoRestricao?.nome || 'restrição';
        throw new BadRequestException(
          `Não é possível cadastrar ${motivoNome} com início em ${new Date(dataInicio).toLocaleDateString('pt-BR')}. Esta data está dentro do período de restrição "${restricaoNome}" (${new Date(restricao.restricao.dataInicio).toLocaleDateString('pt-BR')} a ${new Date(restricao.restricao.dataFim).toLocaleDateString('pt-BR')}).`,
        );
      }
    }

    const created = await this.prisma.afastamento.create({
      data: {
        policial: { connect: { id: data.policialId } },
        motivo: { connect: { id: data.motivoId } },
        seiNumero: data.seiNumero.trim(),
        descricao: data.descricao ? data.descricao.trim() : null,
        anoExercicioFerias: anoExercicioParaFerias,
        dataInicio,
        dataFim,
        status: AfastamentoStatus.ATIVO,
        createdById: actor?.id ?? null,
        createdByName: actor?.nome ?? null,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      include: { policial: { include: { funcao: true, status: true } }, motivo: true },
    });

    await this.audit.record({
      entity: 'Afastamento',
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      after: created,
    });

    return this.mapAfastamentoStatus(created);
  }

  async findAll(options?: {
    page?: number;
    pageSize?: number;
    equipe?: string;
    motivoId?: number;
    status?: string;
    dataInicio?: string;
    dataFim?: string;
    includePolicialFuncao?: boolean;
  }): Promise<
    | AfastamentoWithPolicialResponse[]
    | {
        afastamentos: AfastamentoWithPolicialResponse[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }
  > {
    await this.markExpiredAfastamentos();

    const {
      page,
      pageSize,
      equipe,
      motivoId,
      status,
      dataInicio,
      dataFim,
      includePolicialFuncao,
    } = options || {};

    // Se não fornecer paginação, retornar todos (compatibilidade com código existente)
    // Se status não for fornecido, mostrar ATIVO, ENCERRADO e DESATIVADO
    const baseWhere: Prisma.AfastamentoWhereInput = {
      ...(status ? { status: status as AfastamentoStatus } : {}), // Se status for fornecido, filtrar por ele, senão mostrar todos
      ...(motivoId ? { motivoId } : {}),
      ...(equipe ? { policial: { equipe: equipe as any } } : {}),
    };

    const hasDataInicio = Boolean(dataInicio);
    const hasDataFim = Boolean(dataFim);
    if (hasDataInicio || hasDataFim) {
      const inicio = hasDataInicio ? this.parseDateOnly(dataInicio as string) : undefined;
      const fim = hasDataFim ? this.parseDateOnly(dataFim as string) : undefined;
      
      // Normalizar datas para início e fim do dia
      if (inicio) {
        inicio.setHours(0, 0, 0, 0);
      }
      if (fim) {
        fim.setHours(23, 59, 59, 999);
      }
      
      baseWhere.AND = [
        // Afastamento começa antes ou durante o período filtrado
        ...(inicio ? [{ dataInicio: { lte: fim ?? new Date('9999-12-31') } }] : []),
        // E (afastamento não tem fim OU termina depois ou durante o período filtrado)
        ...(fim && inicio
          ? [
              {
                OR: [
                  { dataFim: null },
                  { dataFim: { gte: inicio } },
                ],
              },
            ]
          : fim
          ? [
              {
                OR: [
                  { dataFim: null },
                  { dataFim: { gte: new Date('1970-01-01') } },
                ],
              },
            ]
          : []),
      ];
    }

    const include: {
      policial: { include: { funcao: true; status: true } };
      motivo: true;
    } = {
      policial: { include: { funcao: true, status: true } },
      motivo: true,
    };

    if (page === undefined && pageSize === undefined) {
      const itens = await this.prisma.afastamento.findMany({
        where: baseWhere,
        include,
        orderBy: { dataInicio: 'desc' },
      });
      return itens.map((item) => this.mapAfastamentoStatus(item));
    }

    // Implementar paginação
    const currentPage = page || 1;
    const currentPageSize = pageSize || 10;
    const skip = (currentPage - 1) * currentPageSize;
    const take = currentPageSize;

    const where = baseWhere;

    const [afastamentos, total] = await this.prisma.$transaction([
      this.prisma.afastamento.findMany({
        where,
        include,
        orderBy: { dataInicio: 'desc' },
        skip,
        take,
      }),
      this.prisma.afastamento.count({ where }),
    ]);

    return {
      afastamentos: afastamentos.map((item) => this.mapAfastamentoStatus(item)),
      total,
      page: currentPage,
      pageSize: currentPageSize,
      totalPages: Math.ceil(total / currentPageSize),
    };
  }

  async findOne(id: number): Promise<AfastamentoWithPolicialResponse> {
    await this.markExpiredAfastamentos();

    const afastamento = await this.prisma.afastamento.findUnique({
      where: { id },
      include: { policial: { include: { funcao: true, status: true } }, motivo: true },
    });

    if (!afastamento) {
      throw new NotFoundException(`Afastamento ${id} não encontrado.`);
    }

    return this.mapAfastamentoStatus(afastamento);
  }

  async findByPolicial(
    policialId: number,
    options?: { includePolicialFuncao?: boolean },
  ): Promise<AfastamentoWithPolicialResponse[]> {
    await this.ensurePolicialExists(policialId);

    await this.markExpiredAfastamentos();

    const include: {
      policial: { include: { funcao: true; status: true } };
      motivo: true;
    } = {
      policial: { include: { funcao: true, status: true } },
      motivo: true,
    };

    const itens = await this.prisma.afastamento.findMany({
      where: { policialId, status: AfastamentoStatus.ATIVO },
      include,
      orderBy: { dataInicio: 'desc' },
    });
    return itens.map((item) => this.mapAfastamentoStatus(item));
  }

  async update(
    id: number,
    data: UpdateAfastamentoDto,
    responsavelId?: number,
  ): Promise<AfastamentoWithPolicialResponse> {
    await this.assertPodeGerenciarAfastamentos(responsavelId);
    const before = await this.prisma.afastamento.findUnique({
      where: { id },
      include: { policial: { include: { funcao: true, status: true } }, motivo: true },
    });

    if (!before) {
      throw new NotFoundException(`Afastamento ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);

    // Determinar os valores finais após a atualização
    const motivoIdFinal = data.motivoId !== undefined ? data.motivoId : before.motivoId;
    const dataInicioFinal = data.dataInicio !== undefined 
      ? this.parseDateOnly(data.dataInicio) 
      : before.dataInicio;
    const dataFimFinal = data.dataFim !== undefined
      ? (data.dataFim ? this.parseDateOnly(data.dataFim) : null)
      : before.dataFim;
    const policialIdFinal = data.policialId !== undefined 
      ? data.policialId 
      : before.policialId;

    const seiNumeroFinal =
      data.seiNumero !== undefined ? data.seiNumero.trim() : before.seiNumero.trim();

    const motivoFinal = await this.prisma.motivoAfastamento.findUnique({
      where: { id: motivoIdFinal },
      select: { nome: true },
    });
    const motivoFinalEhFerias = (motivoFinal?.nome ?? '').toLowerCase() === 'férias';

    const anoExercicioFeriasFinal =
      data.anoExercicioFerias !== undefined
        ? data.anoExercicioFerias
        : before.anoExercicioFerias ?? null;

    if (data.anoExercicioFerias != null && !motivoFinalEhFerias) {
      throw new BadRequestException(
        'O ano de exercício das férias só pode ser informado quando o motivo for Férias.',
      );
    }
    if (
      motivoFinalEhFerias &&
      anoExercicioFeriasFinal != null &&
      anoExercicioFeriasFinal > dataInicioFinal.getFullYear()
    ) {
      throw new BadRequestException(
        'O ano de exercício não pode ser posterior ao ano da data de início do gozo.',
      );
    }

    await this.assertPolicialSemAfastamentoSobreposto(
      policialIdFinal,
      dataInicioFinal,
      dataFimFinal,
      id,
      seiNumeroFinal,
    );

    // Validar limite de 45 dias para policiais PTTC (férias fora; exclui o próprio registro)
    await this.validarLimitePTTC(
      policialIdFinal,
      dataInicioFinal,
      dataFimFinal,
      id,
      motivoIdFinal,
    );

    // Validar limites de dias para férias e abono (excluindo o próprio afastamento)
    await this.validarLimitesDias(
      policialIdFinal,
      motivoIdFinal,
      dataInicioFinal,
      dataFimFinal,
      id, // Excluir este afastamento do cálculo
      motivoFinalEhFerias ? anoExercicioFeriasFinal : null,
    );

    // Validar restrições de afastamento
    // Para Férias: validar somente pela data de início (não por sobreposição de período)

    const restricao = motivoFinalEhFerias
      ? await this.restricoesAfastamentoService.verificarRestricao(dataInicioFinal, motivoIdFinal)
      : await this.restricoesAfastamentoService.verificarRestricaoPeriodo(dataInicioFinal, dataFimFinal, motivoIdFinal);

    if (restricao.bloqueado && restricao.restricao) {
      // Exceção: se for Férias e o policial tiver férias programadas/confirmadas para este mês,
      // a restrição não deve bloquear.
      if (motivoFinalEhFerias) {
        const ignoraRestricao = await this.deveIgnorarRestricaoParaFerias(
          policialIdFinal,
          dataInicioFinal,
          anoExercicioFeriasFinal,
        );
        if (!ignoraRestricao) {
          const motivoNome = motivoFinal?.nome || 'este tipo de afastamento';
          const restricaoNome = restricao.restricao.tipoRestricao?.nome || 'restrição';
          throw new BadRequestException(
            `Não é possível atualizar o afastamento (${motivoNome}) para o período de ${new Date(restricao.restricao.dataInicio).toLocaleDateString('pt-BR')} a ${new Date(restricao.restricao.dataFim).toLocaleDateString('pt-BR')} devido à restrição "${restricaoNome}".`,
          );
        }
      } else {
        const motivoNome = motivoFinal?.nome || 'este tipo de afastamento';
        const restricaoNome = restricao.restricao.tipoRestricao?.nome || 'restrição';
        throw new BadRequestException(
          `Não é possível atualizar o afastamento (${motivoNome}) para o período de ${new Date(restricao.restricao.dataInicio).toLocaleDateString('pt-BR')} a ${new Date(restricao.restricao.dataFim).toLocaleDateString('pt-BR')} devido à restrição "${restricaoNome}".`,
        );
      }
    }

    const updateData: Prisma.AfastamentoUpdateInput = {
      updatedById: actor?.id ?? null,
      updatedByName: actor?.nome ?? null,
    };

    if (data.motivoId !== undefined) {
      updateData.motivo = { connect: { id: data.motivoId } };
    }

    if (data.seiNumero !== undefined) {
      updateData.seiNumero = data.seiNumero.trim();
    }

    if (data.descricao !== undefined) {
      updateData.descricao = data.descricao?.trim() || null;
    }

    if (data.dataInicio !== undefined) {
      updateData.dataInicio = this.parseDateOnly(data.dataInicio);
    }

    if (data.dataFim !== undefined) {
      updateData.dataFim = data.dataFim ? this.parseDateOnly(data.dataFim) : null;
    }

    if (data.policialId !== undefined) {
      updateData.policial = { connect: { id: data.policialId } };
    }

    if (!motivoFinalEhFerias) {
      updateData.anoExercicioFerias = null;
    } else if (data.anoExercicioFerias !== undefined) {
      updateData.anoExercicioFerias = data.anoExercicioFerias;
    }

    const updated = await this.prisma.afastamento.update({
      where: { id },
      data: updateData,
      include: { policial: { include: { funcao: true, status: true } }, motivo: true },
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

    return this.mapAfastamentoStatus(updated);
  }

  async desativar(id: number, responsavelId?: number): Promise<AfastamentoWithPolicialResponse> {
    await this.assertPodeGerenciarAfastamentos(responsavelId);
    const before = await this.prisma.afastamento.findUnique({
      where: { id },
      include: { policial: { include: { funcao: true, status: true } }, motivo: true },
    });

    if (!before) {
      throw new NotFoundException(`Afastamento ${id} não encontrado.`);
    }

    if (before.status === AfastamentoStatus.DESATIVADO) {
      throw new BadRequestException('Este afastamento já foi desativado manualmente.');
    }
    if (before.status === AfastamentoStatus.ENCERRADO) {
      throw new BadRequestException(
        'Este afastamento já foi encerrado automaticamente ao fim do período cadastrado.',
      );
    }

    const actor = await this.audit.resolveActor(responsavelId);

    const agora = new Date();
    const updated = await this.prisma.afastamento.update({
      where: { id },
      data: {
        status: AfastamentoStatus.DESATIVADO,
        desativadoPorId: actor?.id ?? null,
        desativadoPorNome: actor?.nome ?? null,
        desativadoEm: agora,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      include: { policial: { include: { funcao: true, status: true } }, motivo: true },
    });

    await this.audit.record({
      entity: 'Afastamento',
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    return this.mapAfastamentoStatus(updated);
  }

  async remove(id: number, responsavelId?: number): Promise<void> {
    await this.assertPodeGerenciarAfastamentos(responsavelId);
    const before = await this.prisma.afastamento.findUnique({
      where: { id },
      include: { policial: { include: { funcao: true } }, motivo: true },
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
        desativadoPorId: null,
        desativadoPorNome: null,
        desativadoEm: null,
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

  private async ensurePolicialExists(id: number): Promise<void> {
    const exists = await this.prisma.policial.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException(`Policial ${id} não encontrado.`);
    }
  }

  async listMotivos(): Promise<{ id: number; nome: string; descricao: string | null }[]> {
    return this.prisma.motivoAfastamento.findMany({
      select: {
        id: true,
        nome: true,
        descricao: true,
      },
      orderBy: { nome: 'asc' },
    });
  }

  async createMotivo(data: CreateMotivoDto, responsavelId?: number): Promise<{ id: number; nome: string; descricao: string | null }> {
    const actor = await this.audit.resolveActor(responsavelId);

    // Verificar se já existe um motivo com o mesmo nome
    const motivoExistente = await this.prisma.motivoAfastamento.findUnique({
      where: { nome: data.nome.trim() },
    });

    if (motivoExistente) {
      throw new BadRequestException(`Já existe um motivo com o nome "${data.nome.trim()}".`);
    }

    const created = await this.prisma.motivoAfastamento.create({
      data: {
        nome: data.nome.trim(),
        descricao: data.descricao?.trim() || null,
      },
      select: {
        id: true,
        nome: true,
        descricao: true,
      },
    });

    await this.audit.record({
      entity: 'MotivoAfastamento',
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      after: created,
    });

    return created;
  }

  async updateMotivo(
    id: number,
    data: UpdateMotivoDto,
    responsavelId?: number,
  ): Promise<{ id: number; nome: string; descricao: string | null }> {
    const actor = await this.audit.resolveActor(responsavelId);

    const before = await this.prisma.motivoAfastamento.findUnique({
      where: { id },
    });

    if (!before) {
      throw new NotFoundException(`Motivo ${id} não encontrado.`);
    }

    // Se está alterando o nome, verificar se já existe outro com o mesmo nome
    if (data.nome && data.nome.trim() !== before.nome) {
      const motivoExistente = await this.prisma.motivoAfastamento.findUnique({
        where: { nome: data.nome.trim() },
      });

      if (motivoExistente) {
        throw new BadRequestException(`Já existe um motivo com o nome "${data.nome.trim()}".`);
      }
    }

    const updateData: Prisma.MotivoAfastamentoUpdateInput = {};

    if (data.nome !== undefined) {
      updateData.nome = data.nome.trim();
    }
    if (data.descricao !== undefined) {
      updateData.descricao = data.descricao?.trim() || null;
    }

    const updated = await this.prisma.motivoAfastamento.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nome: true,
        descricao: true,
      },
    });

    await this.audit.record({
      entity: 'MotivoAfastamento',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    return updated;
  }

  async deleteMotivo(id: number, responsavelId?: number): Promise<void> {
    const actor = await this.audit.resolveActor(responsavelId);

    const before = await this.prisma.motivoAfastamento.findUnique({
      where: { id },
      include: {
        afastamentos: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!before) {
      throw new NotFoundException(`Motivo ${id} não encontrado.`);
    }

    // Verificar se há afastamentos usando este motivo
    if (before.afastamentos.length > 0) {
      throw new BadRequestException(
        `Não é possível excluir o motivo "${before.nome}" pois existem afastamentos cadastrados com este motivo.`,
      );
    }

    await this.prisma.motivoAfastamento.delete({
      where: { id },
    });

    await this.audit.record({
      entity: 'MotivoAfastamento',
      entityId: id,
      action: AuditAction.DELETE,
      actor,
      before,
    });
  }
}

