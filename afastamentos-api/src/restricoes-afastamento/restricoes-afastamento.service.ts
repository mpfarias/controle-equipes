import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateRestricaoAfastamentoDto } from './dto/create-restricao-afastamento.dto';
import { UpdateRestricaoAfastamentoDto } from './dto/update-restricao-afastamento.dto';
import { Prisma, AuditAction } from '@prisma/client';

type RestricaoAfastamentoWithRelations = Prisma.RestricaoAfastamentoGetPayload<{
  include: {
    tipoRestricao: true;
  };
}>;

@Injectable()
export class RestricoesAfastamentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Busca automaticamente os IDs dos 3 motivos de afastamento que sempre são restritos:
   * Férias, Abono e Dispensa recompensa
   */
  private async buscarMotivosRestritosAutomaticos(): Promise<number[]> {
    const nomesMotivos = ['Férias', 'Abono', 'Dispensa recompensa'];
    
    const motivos = await this.prisma.motivoAfastamento.findMany({
      where: {
        nome: { in: nomesMotivos },
      },
      select: { id: true },
    });

    return motivos.map((m) => m.id);
  }

  async listTiposRestricao() {
    return this.prisma.tipoRestricaoAfastamento.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async create(
    data: CreateRestricaoAfastamentoDto,
    responsavelId?: number,
  ): Promise<RestricaoAfastamentoWithRelations> {
    const actor = await this.audit.resolveActor(responsavelId);

    // Validar que o tipo de restrição existe
    const tipoRestricao = await this.prisma.tipoRestricaoAfastamento.findUnique({
      where: { id: data.tipoRestricaoId },
    });

    if (!tipoRestricao) {
      throw new NotFoundException(`Tipo de restrição ${data.tipoRestricaoId} não encontrado.`);
    }

    // Validar que dataInicio <= dataFim
    const dataInicio = new Date(data.dataInicio);
    const dataFim = new Date(data.dataFim);

    if (dataInicio > dataFim) {
      throw new BadRequestException('A data de início deve ser anterior ou igual à data de término.');
    }

    // Validar que o ano corresponde às datas
    const anoInicio = dataInicio.getFullYear();
    const anoFim = dataFim.getFullYear();
    if (anoInicio !== data.ano || anoFim !== data.ano) {
      throw new BadRequestException(`O ano informado (${data.ano}) não corresponde às datas selecionadas.`);
    }

    // Buscar automaticamente os IDs dos motivos restritos (Férias, Abono, Dispensa recompensa)
    const motivosRestritos = await this.buscarMotivosRestritosAutomaticos();

    if (motivosRestritos.length === 0) {
      throw new BadRequestException('Não foi possível encontrar os motivos de afastamento para restrição (Férias, Abono, Dispensa recompensa).');
    }

    const created = await this.prisma.restricaoAfastamento.create({
      data: {
        tipoRestricao: { connect: { id: data.tipoRestricaoId } },
        ano: data.ano,
        dataInicio,
        dataFim,
        motivosRestritos,
        ativo: true, // Sempre ativo
        createdById: actor?.id ?? null,
        createdByName: actor?.nome ?? null,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      include: {
        tipoRestricao: true,
      },
    });

    await this.audit.record({
      entity: 'RestricaoAfastamento',
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      after: created,
    });

    return created;
  }

  async findAll(): Promise<RestricaoAfastamentoWithRelations[]> {
    return this.prisma.restricaoAfastamento.findMany({
      where: {
        ativo: true, // Apenas restrições ativas (não excluídas)
      },
      orderBy: [{ ano: 'desc' }, { dataInicio: 'asc' }],
      include: {
        tipoRestricao: true,
      },
    });
  }

  async findOne(id: number): Promise<RestricaoAfastamentoWithRelations> {
    const restricao = await this.prisma.restricaoAfastamento.findUnique({
      where: { id },
      include: {
        tipoRestricao: true,
      },
    });

    if (!restricao) {
      throw new NotFoundException(`Restrição de afastamento ${id} não encontrada.`);
    }

    return restricao;
  }

  async update(
    id: number,
    data: UpdateRestricaoAfastamentoDto,
    responsavelId?: number,
  ): Promise<RestricaoAfastamentoWithRelations> {
    const actor = await this.audit.resolveActor(responsavelId);

    const before = await this.prisma.restricaoAfastamento.findUnique({
      where: { id },
      include: { tipoRestricao: true },
    });

    if (!before) {
      throw new NotFoundException(`Restrição de afastamento ${id} não encontrada.`);
    }

    // Validar tipo de restrição se fornecido
    if (data.tipoRestricaoId) {
      const tipoRestricao = await this.prisma.tipoRestricaoAfastamento.findUnique({
        where: { id: data.tipoRestricaoId },
      });

      if (!tipoRestricao) {
        throw new NotFoundException(`Tipo de restrição ${data.tipoRestricaoId} não encontrado.`);
      }
    }

    // Validar datas se ambas foram fornecidas
    const dataInicioFinal = data.dataInicio ? new Date(data.dataInicio) : before.dataInicio;
    const dataFimFinal = data.dataFim ? new Date(data.dataFim) : before.dataFim;
    const anoFinal = data.ano ?? before.ano;

    if (dataInicioFinal > dataFimFinal) {
      throw new BadRequestException('A data de início deve ser anterior ou igual à data de término.');
    }

    // Validar que o ano corresponde às datas
    const anoInicio = dataInicioFinal.getFullYear();
    const anoFim = dataFimFinal.getFullYear();
    if (anoInicio !== anoFinal || anoFim !== anoFinal) {
      throw new BadRequestException(`O ano informado (${anoFinal}) não corresponde às datas selecionadas.`);
    }

    // Buscar automaticamente os IDs dos motivos restritos (sempre os mesmos 3: Férias, Abono, Dispensa recompensa)
    const motivosRestritos = await this.buscarMotivosRestritosAutomaticos();

    if (motivosRestritos.length === 0) {
      throw new BadRequestException('Não foi possível encontrar os motivos de afastamento para restrição (Férias, Abono, Dispensa recompensa).');
    }

    const updateData: Prisma.RestricaoAfastamentoUpdateInput = {};

    if (data.tipoRestricaoId !== undefined) {
      updateData.tipoRestricao = { connect: { id: data.tipoRestricaoId } };
    }
    if (data.ano !== undefined) {
      updateData.ano = data.ano;
    }
    if (data.dataInicio !== undefined) {
      updateData.dataInicio = new Date(data.dataInicio);
    }
    if (data.dataFim !== undefined) {
      updateData.dataFim = new Date(data.dataFim);
    }
    // Sempre atualizar os motivos restritos para os 3 automáticos
    updateData.motivosRestritos = motivosRestritos;
    // Sempre manter como ativo
    updateData.ativo = true;

    updateData.updatedById = actor?.id ?? null;
    updateData.updatedByName = actor?.nome ?? null;

    const updated = await this.prisma.restricaoAfastamento.update({
      where: { id },
      data: updateData,
      include: {
        tipoRestricao: true,
      },
    });

    await this.audit.record({
      entity: 'RestricaoAfastamento',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    return updated;
  }

  async remove(id: number, responsavelId?: number): Promise<void> {
    const actor = await this.audit.resolveActor(responsavelId);

    const before = await this.prisma.restricaoAfastamento.findUnique({
      where: { id },
      include: { tipoRestricao: true },
    });

    if (!before) {
      throw new NotFoundException(`Restrição de afastamento ${id} não encontrada.`);
    }

    // Soft delete: apenas desativa a restrição ao invés de apagar
    await this.prisma.restricaoAfastamento.update({
      where: { id },
      data: {
        ativo: false,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
    });

    await this.audit.record({
      entity: 'RestricaoAfastamento',
      entityId: id,
      action: AuditAction.DELETE,
      actor,
      before,
      after: { ...before, ativo: false },
    });
  }

  /**
   * Verifica se uma data está dentro de alguma restrição ativa para um motivo específico
   */
  async verificarRestricao(
    data: Date,
    motivoId: number,
  ): Promise<{ bloqueado: boolean; restricao?: RestricaoAfastamentoWithRelations }> {
    const restricoes = await this.prisma.restricaoAfastamento.findMany({
      where: {
        ativo: true,
        motivosRestritos: { has: motivoId },
        dataInicio: { lte: data },
        dataFim: { gte: data },
      },
      include: {
        tipoRestricao: true,
      },
    });

    if (restricoes.length > 0) {
      return { bloqueado: true, restricao: restricoes[0] };
    }

    return { bloqueado: false };
  }

  /**
   * Verifica se um período de afastamento se sobrepõe com alguma restrição ativa
   */
  async verificarRestricaoPeriodo(
    dataInicio: Date,
    dataFim: Date | null,
    motivoId: number,
  ): Promise<{ bloqueado: boolean; restricao?: RestricaoAfastamentoWithRelations }> {
    const where: Prisma.RestricaoAfastamentoWhereInput = {
      ativo: true,
      motivosRestritos: { has: motivoId },
    };

    // Se dataFim for null, verificar apenas dataInicio
    if (dataFim) {
      where.OR = [
        // Restrição começa dentro do período
        {
          dataInicio: { gte: dataInicio, lte: dataFim },
        },
        // Restrição termina dentro do período
        {
          dataFim: { gte: dataInicio, lte: dataFim },
        },
        // Restrição engloba todo o período
        {
          dataInicio: { lte: dataInicio },
          dataFim: { gte: dataFim },
        },
        // Período engloba toda a restrição
        {
          dataInicio: { gte: dataInicio },
          dataFim: { lte: dataFim },
        },
      ];
    } else {
      // Sem data fim, verificar se dataInicio está dentro de alguma restrição
      where.dataInicio = { lte: dataInicio };
      where.dataFim = { gte: dataInicio };
    }

    const restricoes = await this.prisma.restricaoAfastamento.findMany({
      where,
      include: {
        tipoRestricao: true,
      },
    });

    if (restricoes.length > 0) {
      return { bloqueado: true, restricao: restricoes[0] };
    }

    return { bloqueado: false };
  }
}
