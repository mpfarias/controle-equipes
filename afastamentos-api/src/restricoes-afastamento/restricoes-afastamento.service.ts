import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateRestricaoAfastamentoDto } from './dto/create-restricao-afastamento.dto';
import { UpdateRestricaoAfastamentoDto } from './dto/update-restricao-afastamento.dto';
import { CreateTipoRestricaoDto } from './dto/create-tipo-restricao.dto';
import { UpdateTipoRestricaoDto } from './dto/update-tipo-restricao.dto';
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

  async createTipoRestricao(
    data: CreateTipoRestricaoDto,
    responsavelId?: number,
  ): Promise<{ id: number; nome: string; descricao: string | null; createdAt: Date; updatedAt: Date }> {
    const actor = await this.audit.resolveActor(responsavelId);

    // Verificar se já existe um tipo com o mesmo nome
    const tipoExistente = await this.prisma.tipoRestricaoAfastamento.findUnique({
      where: { nome: data.nome.trim() },
    });

    if (tipoExistente) {
      throw new BadRequestException(`Já existe um tipo de restrição com o nome "${data.nome.trim()}".`);
    }

    const created = await this.prisma.tipoRestricaoAfastamento.create({
      data: {
        nome: data.nome.trim(),
        descricao: data.descricao?.trim() || null,
      },
    });

    await this.audit.record({
      entity: 'TipoRestricaoAfastamento',
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      after: created,
    });

    return created;
  }

  async updateTipoRestricao(
    id: number,
    data: UpdateTipoRestricaoDto,
    responsavelId?: number,
  ): Promise<{ id: number; nome: string; descricao: string | null; createdAt: Date; updatedAt: Date }> {
    const actor = await this.audit.resolveActor(responsavelId);

    const before = await this.prisma.tipoRestricaoAfastamento.findUnique({
      where: { id },
    });

    if (!before) {
      throw new NotFoundException(`Tipo de restrição ${id} não encontrado.`);
    }

    // Se está alterando o nome, verificar se já existe outro com o mesmo nome
    if (data.nome && data.nome.trim() !== before.nome) {
      const tipoExistente = await this.prisma.tipoRestricaoAfastamento.findUnique({
        where: { nome: data.nome.trim() },
      });

      if (tipoExistente) {
        throw new BadRequestException(`Já existe um tipo de restrição com o nome "${data.nome.trim()}".`);
      }
    }

    const updateData: Prisma.TipoRestricaoAfastamentoUpdateInput = {};

    if (data.nome !== undefined) {
      updateData.nome = data.nome.trim();
    }
    if (data.descricao !== undefined) {
      updateData.descricao = data.descricao?.trim() || null;
    }

    const updated = await this.prisma.tipoRestricaoAfastamento.update({
      where: { id },
      data: updateData,
    });

    await this.audit.record({
      entity: 'TipoRestricaoAfastamento',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actor,
      before,
      after: updated,
    });

    return updated;
  }

  async deleteTipoRestricao(id: number, responsavelId?: number): Promise<void> {
    const actor = await this.audit.resolveActor(responsavelId);

    const before = await this.prisma.tipoRestricaoAfastamento.findUnique({
      where: { id },
      include: {
        restricoes: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!before) {
      throw new NotFoundException(`Tipo de restrição ${id} não encontrado.`);
    }

    // Verificar se há restrições usando este tipo
    if (before.restricoes.length > 0) {
      throw new BadRequestException(
        `Não é possível excluir o tipo de restrição "${before.nome}" pois existem restrições cadastradas com este tipo.`,
      );
    }

    await this.prisma.tipoRestricaoAfastamento.delete({
      where: { id },
    });

    await this.audit.record({
      entity: 'TipoRestricaoAfastamento',
      entityId: id,
      action: AuditAction.DELETE,
      actor,
      before,
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
    // Garantir que as datas sejam interpretadas corretamente sem problemas de timezone
    const dataInicioStr = data.dataInicio.split('T')[0]; // Garantir apenas a data, sem hora
    const dataFimStr = data.dataFim.split('T')[0]; // Garantir apenas a data, sem hora
    
    const [anoInicio, mesInicio, diaInicio] = dataInicioStr.split('-').map(Number);
    const [anoFim, mesFim, diaFim] = dataFimStr.split('-').map(Number);
    
    // Criar datas no timezone local às 00:00:00 para evitar problemas de conversão
    const dataInicio = new Date(anoInicio, mesInicio - 1, diaInicio, 0, 0, 0, 0);
    const dataFim = new Date(anoFim, mesFim - 1, diaFim, 23, 59, 59, 999); // Final do dia

    // Validação especial para "Mês de Dezembro": deve ser obrigatoriamente 01/12 a 31/12
    if (tipoRestricao.nome === 'Mês de Dezembro') {
      if (mesInicio !== 12 || diaInicio !== 1 || mesFim !== 12 || diaFim !== 31 || anoInicio !== data.ano || anoFim !== data.ano) {
        throw new BadRequestException(
          `Para o tipo "Mês de Dezembro", as datas devem ser obrigatoriamente 01/12/${data.ano} a 31/12/${data.ano}.`
        );
      }
    }

    if (dataInicio > dataFim) {
      throw new BadRequestException('A data de início deve ser anterior ou igual à data de término.');
    }

    // Validar que o ano corresponde às datas
    const anoInicioCalculado = dataInicio.getFullYear();
    const anoFimCalculado = dataFim.getFullYear();
    if (anoInicioCalculado !== data.ano || anoFimCalculado !== data.ano) {
      throw new BadRequestException(`O ano informado (${data.ano}) não corresponde às datas selecionadas.`);
    }

    // Buscar automaticamente os IDs dos motivos restritos (Férias, Abono, Dispensa recompensa)
    const motivosRestritosAutomaticos = await this.buscarMotivosRestritosAutomaticos();

    if (motivosRestritosAutomaticos.length === 0) {
      throw new BadRequestException('Não foi possível encontrar os motivos de afastamento para restrição (Férias, Abono, Dispensa recompensa).');
    }

    // Combinar os 3 motivos automáticos com os motivos adicionais (se houver)
    const motivosRestritos = [...motivosRestritosAutomaticos];
    
    if (data.motivosAdicionais && data.motivosAdicionais.length > 0) {
      // Validar que os motivos adicionais existem e não duplicar os automáticos
      const motivosAdicionaisValidos = data.motivosAdicionais.filter(
        (id) => !motivosRestritosAutomaticos.includes(id)
      );
      
      // Verificar se os motivos adicionais existem no banco
      const motivosExistentes = await this.prisma.motivoAfastamento.findMany({
        where: { id: { in: motivosAdicionaisValidos } },
        select: { id: true },
      });
      
      const idsExistentes = motivosExistentes.map((m) => m.id);
      const idsInvalidos = motivosAdicionaisValidos.filter((id) => !idsExistentes.includes(id));
      
      if (idsInvalidos.length > 0) {
        throw new BadRequestException(`Motivos de afastamento inválidos: ${idsInvalidos.join(', ')}`);
      }
      
      motivosRestritos.push(...idsExistentes);
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

    // Buscar tipo de restrição final (novo ou existente)
    const tipoRestricaoIdFinal = data.tipoRestricaoId ?? before.tipoRestricaoId;
    const tipoRestricaoFinal = await this.prisma.tipoRestricaoAfastamento.findUnique({
      where: { id: tipoRestricaoIdFinal },
    });

    // Validar datas se ambas foram fornecidas
    // Garantir que as datas sejam interpretadas corretamente sem problemas de timezone
    let dataInicioFinal: Date;
    let dataFimFinal: Date;
    
    if (data.dataInicio) {
      const dataInicioStr = data.dataInicio.split('T')[0];
      const [ano, mes, dia] = dataInicioStr.split('-').map(Number);
      // Criar data no timezone local às 00:00:00
      dataInicioFinal = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
    } else {
      dataInicioFinal = before.dataInicio;
    }
    
    if (data.dataFim) {
      const dataFimStr = data.dataFim.split('T')[0];
      const [ano, mes, dia] = dataFimStr.split('-').map(Number);
      // Criar data no timezone local no final do dia
      dataFimFinal = new Date(ano, mes - 1, dia, 23, 59, 59, 999);
    } else {
      dataFimFinal = before.dataFim;
    }
    
    const anoFinal = data.ano ?? before.ano;

    // Validação especial para "Mês de Dezembro": deve ser obrigatoriamente 01/12 a 31/12
    if (tipoRestricaoFinal?.nome === 'Mês de Dezembro') {
      if (data.dataInicio || data.dataFim || data.ano !== undefined) {
        // Se está atualizando datas ou ano, validar
        const dataInicioStr = data.dataInicio ? data.dataInicio.split('T')[0] : before.dataInicio.toISOString().split('T')[0];
        const dataFimStr = data.dataFim ? data.dataFim.split('T')[0] : before.dataFim.toISOString().split('T')[0];
        
        const [anoInicio, mesInicio, diaInicio] = dataInicioStr.split('-').map(Number);
        const [anoFim, mesFim, diaFim] = dataFimStr.split('-').map(Number);
        
        if (mesInicio !== 12 || diaInicio !== 1 || mesFim !== 12 || diaFim !== 31 || anoInicio !== anoFinal || anoFim !== anoFinal) {
          throw new BadRequestException(
            `Para o tipo "Mês de Dezembro", as datas devem ser obrigatoriamente 01/12/${anoFinal} a 31/12/${anoFinal}.`
          );
        }
      }
    }

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
    const motivosRestritosAutomaticos = await this.buscarMotivosRestritosAutomaticos();

    if (motivosRestritosAutomaticos.length === 0) {
      throw new BadRequestException('Não foi possível encontrar os motivos de afastamento para restrição (Férias, Abono, Dispensa recompensa).');
    }

    // Combinar os 3 motivos automáticos com os motivos adicionais (se houver)
    let motivosRestritos = [...motivosRestritosAutomaticos];
    
    if (data.motivosAdicionais !== undefined) {
      if (data.motivosAdicionais && data.motivosAdicionais.length > 0) {
        // Validar que os motivos adicionais existem e não duplicar os automáticos
        const motivosAdicionaisValidos = data.motivosAdicionais.filter(
          (id) => !motivosRestritosAutomaticos.includes(id)
        );
        
        // Verificar se os motivos adicionais existem no banco
        const motivosExistentes = await this.prisma.motivoAfastamento.findMany({
          where: { id: { in: motivosAdicionaisValidos } },
          select: { id: true },
        });
        
        const idsExistentes = motivosExistentes.map((m) => m.id);
        const idsInvalidos = motivosAdicionaisValidos.filter((id) => !idsExistentes.includes(id));
        
        if (idsInvalidos.length > 0) {
          throw new BadRequestException(`Motivos de afastamento inválidos: ${idsInvalidos.join(', ')}`);
        }
        
        motivosRestritos = [...motivosRestritosAutomaticos, ...idsExistentes];
      } else {
        // Se motivosAdicionais for array vazio, usar apenas os automáticos
        motivosRestritos = [...motivosRestritosAutomaticos];
      }
    }

    const updateData: Prisma.RestricaoAfastamentoUpdateInput = {};

    if (data.tipoRestricaoId !== undefined) {
      updateData.tipoRestricao = { connect: { id: data.tipoRestricaoId } };
    }
    if (data.ano !== undefined) {
      updateData.ano = data.ano;
    }
    if (data.dataInicio !== undefined) {
      // Criar data no timezone local às 00:00:00
      const dataInicioStr = data.dataInicio.split('T')[0];
      const [ano, mes, dia] = dataInicioStr.split('-').map(Number);
      updateData.dataInicio = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
    }
    if (data.dataFim !== undefined) {
      // Criar data no timezone local no final do dia
      const dataFimStr = data.dataFim.split('T')[0];
      const [ano, mes, dia] = dataFimStr.split('-').map(Number);
      updateData.dataFim = new Date(ano, mes - 1, dia, 23, 59, 59, 999);
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

  async disable(id: number, responsavelId?: number): Promise<RestricaoAfastamentoWithRelations> {
    const actor = await this.audit.resolveActor(responsavelId);

    const before = await this.prisma.restricaoAfastamento.findUnique({
      where: { id },
      include: { tipoRestricao: true },
    });

    if (!before) {
      throw new NotFoundException(`Restrição de afastamento ${id} não encontrada.`);
    }

    if (!before.ativo) {
      throw new BadRequestException(`Restrição de afastamento ${id} já está desativada.`);
    }

    const updated = await this.prisma.restricaoAfastamento.update({
      where: { id },
      data: {
        ativo: false,
        updatedById: actor?.id ?? null,
        updatedByName: actor?.nome ?? null,
      },
      include: {
        tipoRestricao: true,
      },
    });

    await this.audit.record({
      entity: 'RestricaoAfastamento',
      entityId: id,
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

  /**
   * Verifica se o mês inteiro está restrito (do dia 1 ao último dia do mês)
   */
  async verificarMesInteiroRestrito(
    ano: number,
    mes: number,
    motivoId: number,
  ): Promise<{ bloqueado: boolean; restricao?: RestricaoAfastamentoWithRelations }> {
    // Calcular primeiro e último dia do mês
    const primeiroDiaMes = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
    const ultimoDiaMes = new Date(ano, mes, 0, 23, 59, 59, 999);

    // Verificar se existe uma restrição que cobre todo o mês (do dia 1 ao último dia)
    const restricoes = await this.prisma.restricaoAfastamento.findMany({
      where: {
        ativo: true,
        motivosRestritos: { has: motivoId },
        // A restrição deve começar no dia 1 ou antes e terminar no último dia ou depois
        dataInicio: { lte: primeiroDiaMes },
        dataFim: { gte: ultimoDiaMes },
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
}
