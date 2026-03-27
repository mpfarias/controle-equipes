import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTrocaServicoDto } from './dto/create-troca-servico.dto';
import { UpdateTrocaServicoDto } from './dto/update-troca-servico.dto';

@Injectable()
export class TrocaServicoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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

  /** Equipe operacional (não SEM_EQUIPE) ou motorista de dia. */
  private policialElegivelTrocaServico(p: {
    equipe: string | null;
    funcao: { nome: string } | null;
  }): boolean {
    const fn = p.funcao?.nome?.toUpperCase() ?? '';
    const motorista = fn.includes('MOTORISTA DE DIA');
    const eq = p.equipe?.trim() ?? '';
    const equipeOperacional = Boolean(eq && eq !== 'SEM_EQUIPE');
    return equipeOperacional || motorista;
  }

  /**
   * Após o dia de serviço (calendário SP), restaura a equipe de origem de cada policial.
   * Idempotente; pode ser chamada a cada carregamento da lista.
   */
  async processarRevertesPendentes(): Promise<{ policiaisRestaurados: number }> {
    const hoje = this.hojeYmdBrasil();
    const ativas = await this.prisma.trocaServico.findMany({
      where: { status: 'ATIVA' },
    });
    let policiaisRestaurados = 0;

    for (const t of ativas) {
      const ymdA = this.dateToYmd(t.dataServicoA);
      const ymdB = this.dateToYmd(t.dataServicoB);
      let restauradoA = t.restauradoA;
      let restauradoB = t.restauradoB;

      if (!restauradoA && hoje > ymdA) {
        await this.prisma.policial.update({
          where: { id: t.policialAId },
          data: { equipe: t.equipeOrigemA },
        });
        restauradoA = true;
        policiaisRestaurados += 1;
      }
      if (!restauradoB && hoje > ymdB) {
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
    if (sa !== 'ATIVO' && sa !== 'DESIGNADO') {
      throw new BadRequestException(
        `O policial de origem precisa estar ativo ou designado (status atual: ${sa}).`,
      );
    }
    if (sb !== 'ATIVO' && sb !== 'DESIGNADO') {
      throw new BadRequestException(
        `O outro policial precisa estar ativo ou designado (status atual: ${sb}).`,
      );
    }

    if (!this.policialElegivelTrocaServico(a)) {
      throw new BadRequestException(
        'Troca de serviço só é permitida para policiais com equipe operacional ou motoristas de dia.',
      );
    }
    if (!this.policialElegivelTrocaServico(b)) {
      throw new BadRequestException(
        'O outro policial precisa ter equipe operacional ou ser motorista de dia.',
      );
    }

    const eqA = a.equipe ?? null;
    const eqB = b.equipe ?? null;
    if (eqA === eqB) {
      throw new BadRequestException(
        'Não é permitido trocar com policial da mesma equipe (inclui ambos sem equipe).',
      );
    }

    const conflito = await this.prisma.trocaServico.findFirst({
      where: {
        status: 'ATIVA',
        OR: [
          { policialAId: { in: [a.id, b.id] } },
          { policialBId: { in: [a.id, b.id] } },
        ],
      },
    });
    if (conflito) {
      throw new ConflictException(
        'Um dos policiais já possui troca de serviço ativa. Conclua ou aguarde o retorno à equipe de origem.',
      );
    }

    const hoje = this.hojeYmdBrasil();
    const dsOrigem = dto.dataServicoPolicialOrigem.slice(0, 10);
    const dsOutro = dto.dataServicoPolicialOutro.slice(0, 10);
    if (dsOrigem < hoje || dsOutro < hoje) {
      throw new BadRequestException('As datas de serviço não podem ser anteriores a hoje.');
    }

    const dataServicoA = this.parseDateOnly(dsOrigem);
    const dataServicoB = this.parseDateOnly(dsOutro);

    const actor = await this.audit.resolveActor(actorUserId);

    const antesA = { id: a.id, equipe: a.equipe };
    const antesB = { id: b.id, equipe: b.equipe };

    const troca = await this.prisma.$transaction(async (tx) => {
      const created = await tx.trocaServico.create({
        data: {
          policialAId: a.id,
          policialBId: b.id,
          equipeOrigemA: eqA,
          equipeOrigemB: eqB,
          dataServicoA,
          dataServicoB,
          createdById: actor?.id ?? null,
          createdByName: actor?.nome ?? null,
        },
      });

      await tx.policial.update({
        where: { id: a.id },
        data: { equipe: eqB },
      });
      await tx.policial.update({
        where: { id: b.id },
        data: { equipe: eqA },
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

  async listarAtivas() {
    await this.processarRevertesPendentes();
    const rows = await this.prisma.trocaServico.findMany({
      where: { status: 'ATIVA' },
      orderBy: { id: 'desc' },
      include: {
        policialA: { select: { id: true, nome: true, matricula: true, equipe: true } },
        policialB: { select: { id: true, nome: true, matricula: true, equipe: true } },
      },
    });
    return rows.map((t) => ({
      id: t.id,
      dataServicoA: this.dateToYmd(t.dataServicoA),
      dataServicoB: this.dateToYmd(t.dataServicoB),
      restauradoA: t.restauradoA,
      restauradoB: t.restauradoB,
      equipeOrigemA: t.equipeOrigemA,
      equipeOrigemB: t.equipeOrigemB,
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

    const hoje = this.hojeYmdBrasil();
    const dsA = dto.dataServicoA.slice(0, 10);
    const dsB = dto.dataServicoB.slice(0, 10);
    if (dsA < hoje || dsB < hoje) {
      throw new BadRequestException('As datas de serviço não podem ser anteriores a hoje.');
    }

    const dataServicoA = this.parseDateOnly(dsA);
    const dataServicoB = this.parseDateOnly(dsB);
    const actor = await this.audit.resolveActor(actorUserId);

    await this.prisma.trocaServico.update({
      where: { id },
      data: { dataServicoA, dataServicoB },
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
      },
      after: {
        id: troca.id,
        dataServicoA: dsA,
        dataServicoB: dsB,
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
