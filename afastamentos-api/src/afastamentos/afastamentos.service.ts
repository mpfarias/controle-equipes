import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, AfastamentoStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAfastamentoDto } from './dto/create-afastamento.dto';
import { UpdateAfastamentoDto } from './dto/update-afastamento.dto';

type AfastamentoWithColaborador = Prisma.AfastamentoGetPayload<{
  include: { colaborador: true };
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
    // Sobreposição se: inicio1 < fim2 && inicio2 < fim1
    // (usar < em vez de <= porque se um termina em X e outro começa em X, não há sobreposição - são adjacentes)
    if (dataFim1 && dataFim2) {
      // Ambos têm data fim
      const condicao1 = dataInicio1.getTime() < dataFim2.getTime();
      const condicao2 = dataInicio2.getTime() < dataFim1.getTime();
      const haSobreposicaoBasica = condicao1 && condicao2;

      // Se não há sobreposição básica, verificar se são adjacentes (um termina em X, outro começa em X)
      // Adjacentes não são considerados sobrepostos
      if (!haSobreposicaoBasica) {
        const saoAdjacentes1 = dataInicio2.getTime() === dataFim1.getTime(); // Período 2 começa quando período 1 termina
        const saoAdjacentes2 = dataInicio1.getTime() === dataFim2.getTime(); // Período 1 começa quando período 2 termina
        
        // Se são adjacentes, não há sobreposição
        return !(saoAdjacentes1 || saoAdjacentes2);
      }

      // Há sobreposição básica
      return true;
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
    motivo: string,
    ano: number,
    excluirAfastamentoId?: number,
  ): Promise<number> {
    const inicioAno = new Date(ano, 0, 1);
    const fimAno = new Date(ano, 11, 31, 23, 59, 59);

    const afastamentosDoAno = await this.prisma.afastamento.findMany({
      where: {
        colaboradorId,
        motivo,
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
   * Valida limites de dias para férias e abono
   */
  private async validarLimitesDias(
    colaboradorId: number,
    motivo: string,
    dataInicio: Date,
    dataFim: Date | null,
    excluirAfastamentoId?: number,
  ): Promise<void> {
    const motivoNormalizado = motivo.trim();

    // Apenas validar para Férias e Abono
    if (motivoNormalizado !== 'Férias' && motivoNormalizado !== 'Abono') {
      return;
    }

    // Validar se férias não pode ser antes da data atual
    if (motivoNormalizado === 'Férias') {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataInicioNormalizada = new Date(dataInicio);
      dataInicioNormalizada.setHours(0, 0, 0, 0);

      if (dataInicioNormalizada < hoje) {
        throw new BadRequestException(
          'A data de início das férias não pode ser anterior à data atual.',
        );
      }
    }

    // Para férias e abono, data fim é obrigatória
    if (!dataFim) {
      throw new BadRequestException(
        `Para ${motivoNormalizado}, é necessário informar a data de término.`,
      );
    }

    // Validar sobreposição de férias (não pode ter férias sobrepostas)
    if (motivoNormalizado === 'Férias') {
      const feriasExistentes = await this.prisma.afastamento.findMany({
        where: {
          colaboradorId,
          motivo: 'Férias',
          status: AfastamentoStatus.ATIVO,
          ...(excluirAfastamentoId && { id: { not: excluirAfastamentoId } }),
        },
      });

      for (const feriasExistente of feriasExistentes) {
        if (
          this.periodosSobrepostos(
            dataInicio,
            dataFim,
            feriasExistente.dataInicio,
            feriasExistente.dataFim,
          )
        ) {
          throw new BadRequestException(
            'Policial já em usufruto de férias no período selecionado. Alterar a data.',
          );
        }
      }
    }

    const ano = dataInicio.getFullYear();
    const diasSolicitados = this.calcularDiasEntreDatas(dataInicio, dataFim);
    const limiteDias = motivoNormalizado === 'Férias' ? 30 : 5;
    const diasUsados = await this.calcularDiasUsadosNoAno(
      colaboradorId,
      motivoNormalizado,
      ano,
      excluirAfastamentoId,
    );
    const totalAposCadastro = diasUsados + diasSolicitados;

    // Validar se o período solicitado ultrapassa o limite individual
    if (diasSolicitados > limiteDias) {
      throw new BadRequestException(
        `O período de ${motivoNormalizado} não pode ser superior a ${limiteDias} dias. Período informado: ${diasSolicitados} dias.`,
      );
    }

    // Validar se a soma ultrapassa o limite anual
    if (totalAposCadastro > limiteDias) {
      const diasRestantes = limiteDias - diasUsados;
      throw new BadRequestException(
        `O colaborador já usufruiu ${diasUsados} dias de ${motivoNormalizado} no ano, restando apenas ${diasRestantes} dias. O período solicitado de ${diasSolicitados} dias ultrapassa o limite anual de ${limiteDias} dias.`,
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

    // Validar limites de dias para férias e abono
    await this.validarLimitesDias(
      data.colaboradorId,
      data.motivo,
      dataInicio,
      dataFim,
    );

    const created = await this.prisma.afastamento.create({
      data: {
        colaborador: { connect: { id: data.colaboradorId } },
        motivo: this.sanitizeTexto(data.motivo),
        descricao: data.descricao ? data.descricao.trim() : null,
        dataInicio,
        dataFim,
        status: AfastamentoStatus.ATIVO,
        createdById: actor?.id ?? null,
        createdByName: actor?.nome ?? null,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      include: { colaborador: true },
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

  async findAll(): Promise<AfastamentoWithColaborador[]> {
    await this.markExpiredAfastamentos();

    return this.prisma.afastamento.findMany({
      where: { status: AfastamentoStatus.ATIVO },
      include: { colaborador: true },
      orderBy: { dataInicio: 'desc' },
    });
  }

  async findOne(id: number): Promise<AfastamentoWithColaborador> {
    await this.markExpiredAfastamentos();

    const afastamento = await this.prisma.afastamento.findUnique({
      where: { id },
      include: { colaborador: true },
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
      include: { colaborador: true },
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
      include: { colaborador: true },
    });

    if (!before) {
      throw new NotFoundException(`Afastamento ${id} não encontrado.`);
    }

    const actor = await this.audit.resolveActor(responsavelId);

    // Determinar os valores finais após a atualização
    const motivoFinal = data.motivo !== undefined ? data.motivo.trim() : before.motivo;
    const dataInicioFinal = data.dataInicio !== undefined 
      ? new Date(data.dataInicio) 
      : before.dataInicio;
    const dataFimFinal = data.dataFim !== undefined
      ? (data.dataFim ? new Date(data.dataFim) : null)
      : before.dataFim;
    const colaboradorIdFinal = data.colaboradorId !== undefined 
      ? data.colaboradorId 
      : before.colaboradorId;

    // Validar limites de dias para férias e abono (excluindo o próprio afastamento)
    await this.validarLimitesDias(
      colaboradorIdFinal,
      motivoFinal,
      dataInicioFinal,
      dataFimFinal,
      id, // Excluir este afastamento do cálculo
    );

    const updateData: Prisma.AfastamentoUpdateInput = {
      updatedById: actor?.id ?? null,
      updatedByName: actor?.nome ?? null,
    };

    if (data.motivo !== undefined) {
      updateData.motivo = this.sanitizeTexto(data.motivo);
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
      include: { colaborador: true },
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
      include: { colaborador: true },
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
}

