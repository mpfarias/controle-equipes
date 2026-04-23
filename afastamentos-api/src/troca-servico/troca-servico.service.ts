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

  /** Resolve automaticamente o turno do serviço trocado para a data/equipe parceira. */
  private inferirTurnoServicoAutomatico(
    ymd: string,
    equipeParceiroOrigem: string | null,
    policialQueCumpreServico: { funcao: { nome: string } | null },
    parametros: TrocaServicoEscalaParametros,
  ): TrocaServicoTurno {
    const fn = policialQueCumpreServico.funcao?.nome?.toUpperCase() ?? '';
    if (fn.includes('MOTORISTA DE DIA')) {
      return TrocaServicoTurno.DIURNO;
    }

    const ep = (equipeParceiroOrigem ?? '').trim();
    if (!ep || ep === 'SEM_EQUIPE') {
      // Quando não há equipe operacional parceira fixa, mantém padrão diurno.
      return TrocaServicoTurno.DIURNO;
    }

    const op = calcularEquipesOperacionalDia(ymd, parametros);
    if (!op) {
      throw new BadRequestException(
        `Não foi possível validar o turno na escala 12×24 para ${ymd}. Verifique os parâmetros da escala.`,
      );
    }
    if (ep === op.equipeDia) return TrocaServicoTurno.DIURNO;
    if (ep === op.equipeNoite) return TrocaServicoTurno.NOTURNO;
    throw new BadRequestException(
      `Não foi possível inferir turno para ${ymd}: na escala 12×24 o serviço é ${op.equipeDia} (dia) e ${op.equipeNoite} (noite), mas a equipe de origem do parceiro da troca é ${ep}. Ajuste as datas para um dia em que a equipe parceira esteja de serviço.`,
    );
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
   * na troca mais antiga — útil quando houver encadeamento de trocas antes do encerramento dos turnos.
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

  private policialEhMotoristaDeDia(p: { funcao: { nome: string } | null }): boolean {
    const fn = p.funcao?.nome?.toUpperCase() ?? '';
    return fn.includes('MOTORISTA DE DIA');
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
   * Marca cada lado da troca como encerrado após o fim do turno gravado (diurno: 19:00 do dia; noturno: 07:00 do dia seguinte, SP).
   * Não altera `Policial.equipe` (a troca é só operacional/registro). Idempotente; pode ser chamada a cada carregamento da lista.
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
        restauradoA = true;
        policiaisRestaurados += 1;
      }
      if (!restauradoB && this.passouFimJanelaServico(ymdB, t.turnoServicoB)) {
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
    const trocaLivreEntreMotoristas =
      this.policialEhMotoristaDeDia(a) && this.policialEhMotoristaDeDia(b);
    if (!trocaLivreEntreMotoristas && curA === curB) {
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
    if (!trocaLivreEntreMotoristas) {
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
    }

    const turnoA = this.inferirTurnoServicoAutomatico(dsOrigem, equipeOrigemGravarB, a, parametros);
    const turnoB = this.inferirTurnoServicoAutomatico(dsOutro, equipeOrigemGravarA, b, parametros);

    const actor = await this.audit.resolveActor(actorUserId);

    const troca = await this.prisma.$transaction(async (tx) => {
      return tx.trocaServico.create({
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
   * Trocas em andamento e concluídas, para consulta na tela “Ver trocas”.
   * Não inclui canceladas.
   */
  async listarAtivas() {
    await this.processarRevertesPendentes();
    const rows = await this.prisma.trocaServico.findMany({
      where: { status: { in: ['ATIVA', 'CONCLUIDA'] } },
      orderBy: { id: 'desc' },
      include: {
        policialA: {
          select: {
            id: true,
            nome: true,
            matricula: true,
            equipe: true,
            funcao: { select: { nome: true } },
          },
        },
        policialB: {
          select: {
            id: true,
            nome: true,
            matricula: true,
            equipe: true,
            funcao: { select: { nome: true } },
          },
        },
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
      policialA: {
        id: t.policialA.id,
        nome: t.policialA.nome,
        matricula: t.policialA.matricula,
        equipe: t.policialA.equipe,
        funcaoNome: t.policialA.funcao?.nome ?? null,
      },
      policialB: {
        id: t.policialB.id,
        nome: t.policialB.nome,
        matricula: t.policialB.matricula,
        equipe: t.policialB.equipe,
        funcaoNome: t.policialB.funcao?.nome ?? null,
      },
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
        'Não é possível alterar as datas após encerramento parcial de um lado da troca (fim do turno). Cancele a troca se necessário.',
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

    const trocaLivreEntreMotoristas =
      this.policialEhMotoristaDeDia(polA) && this.policialEhMotoristaDeDia(polB);

    const equipeOrigemA = troca.equipeOrigemA ?? polA.equipe;
    const equipeOrigemB = troca.equipeOrigemB ?? polB.equipe;

    const parametrosUpd = await this.escalas.getParametros();
    if (!trocaLivreEntreMotoristas) {
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
    }

    const turnoANovo = this.inferirTurnoServicoAutomatico(dsA, equipeOrigemB, polA, parametrosUpd);
    const turnoBNovo = this.inferirTurnoServicoAutomatico(dsB, equipeOrigemA, polB, parametrosUpd);

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
    });
    if (!troca) {
      throw new NotFoundException('Troca não encontrada.');
    }
    if (troca.status !== 'ATIVA') {
      throw new BadRequestException('Esta troca já não está ativa.');
    }

    const actor = await this.audit.resolveActor(actorUserId);

    await this.prisma.$transaction(async (tx) => {
      await tx.trocaServico.update({
        where: { id },
        data: {
          status: 'CANCELADA',
          restauradoA: true,
          restauradoB: true,
        },
      });
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
