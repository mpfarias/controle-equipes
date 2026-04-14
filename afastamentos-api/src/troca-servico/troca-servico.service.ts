import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, TrocaServicoTurno } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { EscalasService } from '../escalas/escalas.service';
import { CreateTrocaServicoDto } from './dto/create-troca-servico.dto';
import { UpdateTrocaServicoDto } from './dto/update-troca-servico.dto';
import {
  calcularEquipesOperacionalDia,
  validarPolicialDeServicoNoDiaEmContextoTroca,
  type TrocaServicoEscalaParametros,
} from './troca-servico-escala.helper';

@Injectable()
export class TrocaServicoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly escalas: EscalasService,
  ) {}

  /** Data local (America/Sao_Paulo) no formato YYYY-MM-DD. */
  hojeYmdBrasil(): string {
    const f = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = f.formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    return `${y}-${m}-${d}`;
  }

  /**
   * Instante atual em SP como string comparável (lexicográfica) com `YYYY-MM-DDTHH:mm`.
   */
  private agoraSaoPauloYmdHm(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  }

  /** Soma dias a um YYYY-MM-DD (calendário gregoriano, componentes numéricos). */
  private addDaysYmd(ymd: string, dias: number): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.trim());
    if (!m) return ymd;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d + dias));
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  /**
   * Fim do turno informado na troca (America/Sao_Paulo): diurno até 19:00 do dia civil;
   * noturno até 07:00 do dia seguinte (19h→07h).
   */
  private passouFimJanelaServico(ymdServico: string, turno: TrocaServicoTurno): boolean {
    const limite =
      turno === TrocaServicoTurno.DIURNO
        ? `${ymdServico}T19:00`
        : `${this.addDaysYmd(ymdServico, 1)}T07:00`;
    return this.agoraSaoPauloYmdHm() >= limite;
  }

  private turnoDtoParaEnum(v: 'DIURNO' | 'NOTURNO'): TrocaServicoTurno {
    return v === 'DIURNO' ? TrocaServicoTurno.DIURNO : TrocaServicoTurno.NOTURNO;
  }

  private resolverTurnoUpdate(
    dtoVal: 'DIURNO' | 'NOTURNO' | undefined,
    atual: TrocaServicoTurno,
  ): TrocaServicoTurno {
    if (dtoVal === 'DIURNO') return TrocaServicoTurno.DIURNO;
    if (dtoVal === 'NOTURNO') return TrocaServicoTurno.NOTURNO;
    return atual;
  }

  /**
   * Garante que o turno escolhido corresponde à equipe de origem do parceiro na escala 12×24 naquela data.
   * Motoristas de dia: apenas diurno.
   */
  private assertTurnoServicoCompativel(
    ymd: string,
    turno: TrocaServicoTurno,
    equipeParceiroOrigem: string | null,
    policialQueCumpreServico: { funcao: { nome: string } | null },
    parametros: TrocaServicoEscalaParametros,
  ): void {
    const fn = policialQueCumpreServico.funcao?.nome?.toUpperCase() ?? '';
    if (fn.includes('MOTORISTA DE DIA')) {
      if (turno !== TrocaServicoTurno.DIURNO) {
        throw new BadRequestException(
          'Para motorista de dia, o horário do serviço trocado deve ser diurno (07h–19h).',
        );
      }
      return;
    }

    const ep = (equipeParceiroOrigem ?? '').trim();
    if (!ep || ep === 'SEM_EQUIPE') {
      return;
    }

    const op = calcularEquipesOperacionalDia(ymd, parametros);
    if (!op) {
      throw new BadRequestException(
        `Não foi possível validar o turno na escala 12×24 para ${ymd}. Verifique os parâmetros da escala.`,
      );
    }
    const esperada =
      turno === TrocaServicoTurno.DIURNO ? op.equipeDia : op.equipeNoite;
    if (ep !== esperada) {
      const turnoLabel =
        turno === TrocaServicoTurno.DIURNO ? '07h–19h (diurno)' : '19h–07h (noturno)';
      throw new BadRequestException(
        `Turno informado (${turnoLabel}) não coincide com a escala do dia ${ymd}: nesse turno a equipe de serviço é ${esperada}; a equipe de origem do parceiro da troca é ${ep}. Ajuste a data, o turno ou o cadastro.`,
      );
    }
  }

  private dateToYmd(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private parseDateOnly(iso: string): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!m) {
      throw new BadRequestException('Data inválida. Use o formato AAAA-MM-DD.');
    }
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const day = Number(m[3]);
    return new Date(Date.UTC(y, mo - 1, day, 12, 0, 0, 0));
  }

  /**
   * Se o policial já está em troca ATIVA (lado ainda não restaurado), devolve a equipe de origem gravada
   * na troca mais antiga — para novas trocas não confundirem equipe temporária no cadastro com a permanente.
   */
  private async equipeOrigemRealSeEmTrocaAtiva(policialId: number): Promise<string | null> {
    const t = await this.prisma.trocaServico.findFirst({
      where: {
        status: 'ATIVA',
        OR: [
          { policialAId: policialId, restauradoA: false },
          { policialBId: policialId, restauradoB: false },
        ],
      },
      orderBy: { id: 'asc' },
    });
    if (!t) return null;
    if (t.policialAId === policialId && !t.restauradoA) return t.equipeOrigemA ?? null;
    if (t.policialBId === policialId && !t.restauradoB) return t.equipeOrigemB ?? null;
    return null;
  }

  /** Equipe operacional (não SEM_EQUIPE), motorista de dia, DESIGNADO, PTTC ou COMISSIONADO. */
  private policialElegivelTrocaServico(p: {
    equipe: string | null;
    funcao: { nome: string } | null;
    status: { nome: string } | null;
  }): boolean {
    const fn = p.funcao?.nome?.toUpperCase() ?? '';
    const motorista = fn.includes('MOTORISTA DE DIA');
    const eq = p.equipe?.trim() ?? '';
    const equipeOperacional = Boolean(eq && eq !== 'SEM_EQUIPE');
    const st = p.status?.nome?.toUpperCase() ?? '';
    const statusPermite = st === 'DESIGNADO' || st === 'PTTC' || st === 'COMISSIONADO';
    return equipeOperacional || motorista || statusPermite;
  }

  /**
   * Restaura a equipe de origem após o fim do turno gravado (diurno: 19:00 do dia; noturno: 07:00 do dia seguinte, SP).
   * Idempotente; pode ser chamada a cada carregamento da lista.
   */
  async processarRevertesPendentes(): Promise<{ policiaisRestaurados: number }> {
    const ativas = await this.prisma.trocaServico.findMany({
      where: { status: 'ATIVA' },
    });
    let policiaisRestaurados = 0;

    for (const t of ativas) {
      const ymdA = this.dateToYmd(t.dataServicoA);
      const ymdB = this.dateToYmd(t.dataServicoB);
      let restauradoA = t.restauradoA;
      let restauradoB = t.restauradoB;

      if (!restauradoA && this.passouFimJanelaServico(ymdA, t.turnoServicoA)) {
        await this.prisma.policial.update({
          where: { id: t.policialAId },
          data: { equipe: t.equipeOrigemA },
        });
        restauradoA = true;
        policiaisRestaurados += 1;
      }
      if (!restauradoB && this.passouFimJanelaServico(ymdB, t.turnoServicoB)) {
        await this.prisma.policial.update({
          where: { id: t.policialBId },
          data: { equipe: t.equipeOrigemB },
        });
        restauradoB = true;
        policiaisRestaurados += 1;
      }

      const concluida = restauradoA && restauradoB;
      await this.prisma.trocaServico.update({
        where: { id: t.id },
        data: {
          restauradoA,
          restauradoB,
          status: concluida ? 'CONCLUIDA' : 'ATIVA',
        },
      });
    }

    return { policiaisRestaurados };
  }

  async criar(dto: CreateTrocaServicoDto, actorUserId?: number) {
    await this.processarRevertesPendentes();

    if (dto.policialOrigemId === dto.policialOutroId) {
      throw new BadRequestException('Selecione outro policial para a troca.');
    }

    const [a, b] = await Promise.all([
      this.prisma.policial.findUnique({
        where: { id: dto.policialOrigemId },
        include: { status: true, funcao: true },
      }),
      this.prisma.policial.findUnique({
        where: { id: dto.policialOutroId },
        include: { status: true, funcao: true },
      }),
    ]);

    if (!a || !b) {
      throw new NotFoundException('Policial não encontrado.');
    }

    const nomeStatus = (s: { nome: string } | null) => s?.nome ?? '';
    const sa = nomeStatus(a.status);
    const sb = nomeStatus(b.status);
    const statusPermitido =
      sa === 'ATIVO' || sa === 'DESIGNADO' || sa === 'PTTC' || sa === 'COMISSIONADO';
    if (!statusPermitido) {
      throw new BadRequestException(
        `O policial de origem precisa estar ATIVO, DESIGNADO, PTTC ou COMISSIONADO (status atual: ${sa}).`,
      );
    }
    const statusOutroPermitido =
      sb === 'ATIVO' || sb === 'DESIGNADO' || sb === 'PTTC' || sb === 'COMISSIONADO';
    if (!statusOutroPermitido) {
      throw new BadRequestException(
        `O outro policial precisa estar ATIVO, DESIGNADO, PTTC ou COMISSIONADO (status atual: ${sb}).`,
      );
    }

    if (!this.policialElegivelTrocaServico(a)) {
      throw new BadRequestException(
        'Troca de serviço só é permitida para policiais com equipe operacional, motoristas de dia, DESIGNADO, PTTC ou COMISSIONADO.',
      );
    }
    if (!this.policialElegivelTrocaServico(b)) {
      throw new BadRequestException(
        'O outro policial precisa ter equipe operacional, ser motorista de dia, DESIGNADO, PTTC ou COMISSIONADO.',
      );
    }

    const curA = a.equipe ?? null;
    const curB = b.equipe ?? null;
    if (curA === curB) {
      throw new BadRequestException(
        'Troca de serviço é sempre com policial de outra equipe. Não é permitido trocar com quem é da mesma equipe (inclui ambos sem equipe ou ambos SEM_EQUIPE).',
      );
    }

    const [origA, origB] = await Promise.all([
      this.equipeOrigemRealSeEmTrocaAtiva(a.id),
      this.equipeOrigemRealSeEmTrocaAtiva(b.id),
    ]);
    const equipeOrigemGravarA = origA ?? curA;
    const equipeOrigemGravarB = origB ?? curB;

    const dsOrigem = dto.dataServicoPolicialOrigem.slice(0, 10);
    const dsOutro = dto.dataServicoPolicialOutro.slice(0, 10);

    const dataServicoA = this.parseDateOnly(dsOrigem);
    const dataServicoB = this.parseDateOnly(dsOutro);

    const parametros = await this.escalas.getParametros();
    const vA = validarPolicialDeServicoNoDiaEmContextoTroca(
      { equipe: a.equipe, funcao: a.funcao, status: a.status },
      dsOrigem,
      parametros,
      curB,
    );
    if (!vA.ok) {
      throw new BadRequestException(
        `Data de serviço do policial de origem: ${vA.motivo}`,
      );
    }
    const vB = validarPolicialDeServicoNoDiaEmContextoTroca(
      { equipe: b.equipe, funcao: b.funcao, status: b.status },
      dsOutro,
      parametros,
      curA,
    );
    if (!vB.ok) {
      throw new BadRequestException(
        `Data de serviço do outro policial: ${vB.motivo}`,
      );
    }

    const turnoA = this.turnoDtoParaEnum(dto.turnoServicoPolicialOrigem);
    const turnoB = this.turnoDtoParaEnum(dto.turnoServicoPolicialOutro);
    this.assertTurnoServicoCompativel(dsOrigem, turnoA, equipeOrigemGravarB, a, parametros);
    this.assertTurnoServicoCompativel(dsOutro, turnoB, equipeOrigemGravarA, b, parametros);

    const actor = await this.audit.resolveActor(actorUserId);

    const antesA = { id: a.id, equipe: a.equipe };
    const antesB = { id: b.id, equipe: b.equipe };

    const troca = await this.prisma.$transaction(async (tx) => {
      const created = await tx.trocaServico.create({
        data: {
          policialAId: a.id,
          policialBId: b.id,
          equipeOrigemA: equipeOrigemGravarA,
          equipeOrigemB: equipeOrigemGravarB,
          dataServicoA,
          dataServicoB,
          turnoServicoA: turnoA,
          turnoServicoB: turnoB,
          createdById: actor?.id ?? null,
          createdByName: actor?.nome ?? null,
        },
      });

      await tx.policial.update({
        where: { id: a.id },
        data: { equipe: curB },
      });
      await tx.policial.update({
        where: { id: b.id },
        data: { equipe: curA },
      });

      return created;
    });

    const depoisA = await this.prisma.policial.findUnique({ where: { id: a.id } });
    const depoisB = await this.prisma.policial.findUnique({ where: { id: b.id } });

    await this.audit.record({
      entity: 'Policial',
      entityId: a.id,
      action: AuditAction.UPDATE,
      actor,
      before: antesA,
      after: { id: a.id, equipe: depoisA?.equipe },
    });
    await this.audit.record({
      entity: 'Policial',
      entityId: b.id,
      action: AuditAction.UPDATE,
      actor,
      before: antesB,
      after: { id: b.id, equipe: depoisB?.equipe },
    });
    await this.audit.record({
      entity: 'TrocaServico',
      entityId: troca.id,
      action: AuditAction.CREATE,
      actor,
      after: troca,
    });

    return troca;
  }

  /**
   * Trocas em andamento e concluídas (ex.: cadastro retroativo), para consulta na tela “Ver trocas”.
   * Não inclui canceladas.
   */
  async listarAtivas() {
    await this.processarRevertesPendentes();
    const rows = await this.prisma.trocaServico.findMany({
      where: { status: { in: ['ATIVA', 'CONCLUIDA'] } },
      orderBy: { id: 'desc' },
      include: {
        policialA: { select: { id: true, nome: true, matricula: true, equipe: true } },
        policialB: { select: { id: true, nome: true, matricula: true, equipe: true } },
      },
    });
    return rows.map((t) => ({
      id: t.id,
      status: t.status,
      dataServicoA: this.dateToYmd(t.dataServicoA),
      dataServicoB: this.dateToYmd(t.dataServicoB),
      restauradoA: t.restauradoA,
      restauradoB: t.restauradoB,
      equipeOrigemA: t.equipeOrigemA,
      equipeOrigemB: t.equipeOrigemB,
      turnoServicoA: t.turnoServicoA,
      turnoServicoB: t.turnoServicoB,
      policialA: t.policialA,
      policialB: t.policialB,
    }));
  }

  async atualizarDatas(id: number, dto: UpdateTrocaServicoDto, actorUserId?: number) {
    await this.processarRevertesPendentes();

    const troca = await this.prisma.trocaServico.findUnique({ where: { id } });
    if (!troca) {
      throw new NotFoundException('Troca não encontrada.');
    }
    if (troca.status !== 'ATIVA') {
      throw new BadRequestException('Só é possível alterar uma troca ativa.');
    }
    if (troca.restauradoA || troca.restauradoB) {
      throw new BadRequestException(
        'Não é possível alterar as datas após retorno parcial à equipe de origem. Cancele a troca se necessário.',
      );
    }

    const dsA = dto.dataServicoA.slice(0, 10);
    const dsB = dto.dataServicoB.slice(0, 10);

    const dataServicoA = this.parseDateOnly(dsA);
    const dataServicoB = this.parseDateOnly(dsB);

    const [polA, polB] = await Promise.all([
      this.prisma.policial.findUnique({
        where: { id: troca.policialAId },
        include: { status: true, funcao: true },
      }),
      this.prisma.policial.findUnique({
        where: { id: troca.policialBId },
        include: { status: true, funcao: true },
      }),
    ]);
    if (!polA || !polB) {
      throw new NotFoundException('Policial vinculado à troca não encontrado.');
    }

    const parametrosUpd = await this.escalas.getParametros();
    const equipeOrigemA = troca.equipeOrigemA ?? polA.equipe;
    const equipeOrigemB = troca.equipeOrigemB ?? polB.equipe;
    const vUpdA = validarPolicialDeServicoNoDiaEmContextoTroca(
      {
        equipe: equipeOrigemA,
        funcao: polA.funcao,
        status: polA.status,
      },
      dsA,
      parametrosUpd,
      equipeOrigemB,
    );
    if (!vUpdA.ok) {
      throw new BadRequestException(`Data de serviço do policial A: ${vUpdA.motivo}`);
    }
    const vUpdB = validarPolicialDeServicoNoDiaEmContextoTroca(
      {
        equipe: equipeOrigemB,
        funcao: polB.funcao,
        status: polB.status,
      },
      dsB,
      parametrosUpd,
      equipeOrigemA,
    );
    if (!vUpdB.ok) {
      throw new BadRequestException(`Data de serviço do policial B: ${vUpdB.motivo}`);
    }

    const turnoANovo = this.resolverTurnoUpdate(dto.turnoServicoA, troca.turnoServicoA);
    const turnoBNovo = this.resolverTurnoUpdate(dto.turnoServicoB, troca.turnoServicoB);
    this.assertTurnoServicoCompativel(dsA, turnoANovo, equipeOrigemB, polA, parametrosUpd);
    this.assertTurnoServicoCompativel(dsB, turnoBNovo, equipeOrigemA, polB, parametrosUpd);

    const actor = await this.audit.resolveActor(actorUserId);

    await this.prisma.trocaServico.update({
      where: { id },
      data: {
        dataServicoA,
        dataServicoB,
        turnoServicoA: turnoANovo,
        turnoServicoB: turnoBNovo,
      },
    });

    await this.audit.record({
      entity: 'TrocaServico',
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      before: {
        id: troca.id,
        dataServicoA: this.dateToYmd(troca.dataServicoA),
        dataServicoB: this.dateToYmd(troca.dataServicoB),
        turnoServicoA: troca.turnoServicoA,
        turnoServicoB: troca.turnoServicoB,
      },
      after: {
        id: troca.id,
        dataServicoA: dsA,
        dataServicoB: dsB,
        turnoServicoA: turnoANovo,
        turnoServicoB: turnoBNovo,
      },
    });

    const out = await this.prisma.trocaServico.findUnique({ where: { id } });
    if (!out) {
      throw new NotFoundException('Troca não encontrada após atualização.');
    }
    return out;
  }

  async cancelar(id: number, actorUserId?: number) {
    await this.processarRevertesPendentes();

    const troca = await this.prisma.trocaServico.findUnique({
      where: { id },
      include: {
        policialA: { select: { id: true, equipe: true } },
        policialB: { select: { id: true, equipe: true } },
      },
    });
    if (!troca) {
      throw new NotFoundException('Troca não encontrada.');
    }
    if (troca.status !== 'ATIVA') {
      throw new BadRequestException('Esta troca já não está ativa.');
    }

    const actor = await this.audit.resolveActor(actorUserId);
    const antesA = { id: troca.policialA.id, equipe: troca.policialA.equipe };
    const antesB = { id: troca.policialB.id, equipe: troca.policialB.equipe };

    await this.prisma.$transaction(async (tx) => {
      await tx.policial.update({
        where: { id: troca.policialAId },
        data: { equipe: troca.equipeOrigemA },
      });
      await tx.policial.update({
        where: { id: troca.policialBId },
        data: { equipe: troca.equipeOrigemB },
      });
      await tx.trocaServico.update({
        where: { id },
        data: {
          status: 'CANCELADA',
          restauradoA: true,
          restauradoB: true,
        },
      });
    });

    const depoisA = await this.prisma.policial.findUnique({ where: { id: troca.policialAId } });
    const depoisB = await this.prisma.policial.findUnique({ where: { id: troca.policialBId } });

    await this.audit.record({
      entity: 'Policial',
      entityId: troca.policialAId,
      action: AuditAction.UPDATE,
      actor,
      before: antesA,
      after: { id: troca.policialAId, equipe: depoisA?.equipe },
    });
    await this.audit.record({
      entity: 'Policial',
      entityId: troca.policialBId,
      action: AuditAction.UPDATE,
      actor,
      before: antesB,
      after: { id: troca.policialBId, equipe: depoisB?.equipe },
    });
    await this.audit.record({
      entity: 'TrocaServico',
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      before: { id, status: troca.status },
      after: { id, status: 'CANCELADA', restauradoA: true, restauradoB: true },
    });

    return {
      id,
      status: 'CANCELADA' as const,
      policialAId: troca.policialAId,
      policialBId: troca.policialBId,
    };
  }
}
