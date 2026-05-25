import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrionAgendaStatus, OrionAgendaTipo, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateAgendaCompromissoDto } from './dto/create-agenda-compromisso.dto';
import { UpdateAgendaCompromissoDto } from './dto/update-agenda-compromisso.dto';

const TIPO_TITULO: Record<OrionAgendaTipo, string> = {
  REUNIAO: 'Reunião',
  PALESTRA: 'Palestra',
  PRAZO: 'Prazo',
  AUDIENCIA: 'Audiência',
  OUTRO: 'Outro',
};

export type UsuarioOrionAgendaReq = {
  id: number;
  nome: string;
  matricula: string;
  sistemasPermitidos: string[];
  isAdmin?: boolean;
  nivel?: { nome?: string | null } | null;
};

@Injectable()
export class OrionAgendaService {
  constructor(private readonly prisma: PrismaService) {}

  podeAcessarOrionAgenda(usuario: UsuarioOrionAgendaReq): boolean {
    if (usuario.isAdmin === true) return true;
    const nomeNivel = usuario.nivel?.nome?.trim().toUpperCase();
    if (nomeNivel === 'ADMINISTRADOR') return true;
    const ids = (usuario.sistemasPermitidos ?? []).map((s) =>
      String(s).trim().toUpperCase(),
    );
    return ids.includes('ORION_AGENDA') || ids.includes('ORION_ASSESSORIA');
  }

  private assertAcessoModulo(usuario: UsuarioOrionAgendaReq): void {
    if (!this.podeAcessarOrionAgenda(usuario)) {
      throw new ForbiddenException(
        'Acesso ao Órion Agenda não autorizado. Um administrador deve incluir "Órion Agenda" em sistemas permitidos (SAD → Usuários).',
      );
    }
  }

  getPublicMeta() {
    return {
      sistema: 'orion-agenda',
      nome: 'Órion Agenda',
      versao: '0.2.0',
      fase: 'compromissos',
    };
  }

  sessaoResumo(usuario: UsuarioOrionAgendaReq) {
    const pode = this.podeAcessarOrionAgenda(usuario);
    return {
      ok: true,
      sistema: 'orion-agenda',
      podeAcessarModulo: pode,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        matricula: usuario.matricula,
      },
      mensagem: pode
        ? 'Módulo disponível: agenda institucional de compromissos do COPOM.'
        : 'Seu usuário autenticou na API, mas não possui permissão para usar o Órion Agenda.',
    };
  }

  private parseMesReferencia(mes?: string): { inicio: Date; fim: Date } | null {
    if (!mes?.trim()) return null;
    const m = /^(\d{4})-(\d{2})$/.exec(mes.trim());
    if (!m) {
      throw new BadRequestException('Parâmetro "mes" inválido. Use o formato AAAA-MM.');
    }
    const ano = Number(m[1]);
    const mesNum = Number(m[2]);
    if (mesNum < 1 || mesNum > 12) {
      throw new BadRequestException('Mês inválido em "mes".');
    }
    const inicio = new Date(Date.UTC(ano, mesNum - 1, 1, 0, 0, 0, 0));
    const fim = new Date(Date.UTC(ano, mesNum, 0, 23, 59, 59, 999));
    return { inicio, fim };
  }

  private validarDatas(
    dataInicio: Date,
    dataFim: Date | null | undefined,
    diaInteiro: boolean,
  ): void {
    if (dataFim && dataFim.getTime() < dataInicio.getTime()) {
      throw new BadRequestException('A data/hora de término deve ser posterior ao início.');
    }
    if (diaInteiro && dataFim) {
      const ini = dataInicio.toISOString().slice(0, 10);
      const fim = dataFim.toISOString().slice(0, 10);
      if (fim < ini) {
        throw new BadRequestException('A data de término deve ser igual ou posterior à data de início.');
      }
    }
  }

  private async resolverPolicial(policialId: number): Promise<{ id: number; nome: string }> {
    const policial = await this.prisma.policial.findUnique({
      where: { id: policialId },
      include: { status: { select: { nome: true } } },
    });
    if (!policial || policial.status.nome === 'DESATIVADO') {
      throw new BadRequestException('Policial não encontrado ou desativado.');
    }
    return { id: policial.id, nome: policial.nome };
  }

  private formatarNomesParticipantes(nomes: string[]): string {
    if (nomes.length === 0) return '';
    if (nomes.length === 1) return nomes[0]!;
    if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
    return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
  }

  private async resolverPoliciaisIds(ids: number[]): Promise<Array<{ id: number; nome: string }>> {
    const unicos = [...new Set(ids)];
    if (unicos.length !== ids.length) {
      throw new BadRequestException('Não é permitido repetir o mesmo policial.');
    }
    const resolvidos: Array<{ id: number; nome: string }> = [];
    for (const id of unicos) {
      resolvidos.push(await this.resolverPolicial(id));
    }
    return resolvidos;
  }

  private idsPoliciaisDoDto(dto: CreateAgendaCompromissoDto): number[] {
    if (dto.policialIds?.length) return dto.policialIds;
    if (dto.policialId != null) return [dto.policialId];
    return [];
  }

  private idsParticipantesOrdenados(
    participantes: Array<{ policialId: number }>,
    policialId: number | null,
  ): number[] {
    if (participantes.length) {
      return participantes.map((p) => p.policialId).sort((a, b) => a - b);
    }
    return policialId != null ? [policialId] : [];
  }

  private inicioDiaHojeSp(): Date {
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    return new Date(`${hoje}T00:00:00-03:00`);
  }

  /** Compromissos agendados de dias anteriores passam a concluídos ao virar o dia (fuso SP). */
  private async concluirCompromissosVencidos(): Promise<void> {
    const inicioHoje = this.inicioDiaHojeSp();
    await this.prisma.orionAgendaCompromisso.updateMany({
      where: {
        status: 'AGENDADO',
        dataInicio: { lt: inicioHoje },
      },
      data: { status: 'CONCLUIDO' },
    });
  }

  private async assertNaoDuplicado(
    tipo: OrionAgendaTipo,
    dataInicio: Date,
    policialIds: number[],
    excluirId?: number,
  ): Promise<void> {
    if (!policialIds.length) return;

    const existentes = await this.prisma.orionAgendaCompromisso.findMany({
      where: {
        tipo,
        dataInicio,
        status: { not: 'CANCELADO' },
        ...(excluirId != null ? { id: { not: excluirId } } : {}),
      },
      include: {
        participantes: { orderBy: { ordem: 'asc' } },
      },
    });

    const idsNovos = [...new Set(policialIds)].sort((a, b) => a - b);
    for (const row of existentes) {
      const idsExistentes = this.idsParticipantesOrdenados(row.participantes, row.policialId);
      if (
        idsExistentes.length === idsNovos.length &&
        idsExistentes.every((id, i) => id === idsNovos[i])
      ) {
        throw new BadRequestException(
          'Já existe um compromisso igual neste dia e horário com as mesmas pessoas.',
        );
      }
    }
  }

  private montarTituloCompromisso(
    titulo: string | undefined,
    tipo: OrionAgendaTipo,
    responsavelNome: string | null,
  ): string {
    const limpo = titulo?.trim();
    if (limpo) return limpo;
    if (!responsavelNome) {
      throw new BadRequestException('Informe o título ou selecione o policial responsável.');
    }
    return `${TIPO_TITULO[tipo]} — ${responsavelNome}`;
  }

  async listarPoliciaisEfetivo(usuario: UsuarioOrionAgendaReq) {
    this.assertAcessoModulo(usuario);
    return this.prisma.policial.findMany({
      where: { status: { nome: { not: 'DESATIVADO' } } },
      select: {
        id: true,
        nome: true,
        matricula: true,
        equipe: true,
      },
      orderBy: { nome: 'asc' },
    });
  }

  async listarCompromissos(
    usuario: UsuarioOrionAgendaReq,
    opts: { mes?: string; status?: string },
  ) {
    this.assertAcessoModulo(usuario);
    await this.concluirCompromissosVencidos();
    const intervalo = this.parseMesReferencia(opts.mes);
    const where: Prisma.OrionAgendaCompromissoWhereInput = {};
    if (intervalo) {
      where.dataInicio = { gte: intervalo.inicio, lte: intervalo.fim };
    }
    if (opts.status?.trim()) {
      const s = opts.status.trim().toUpperCase();
      if (!Object.values(OrionAgendaStatus).includes(s as OrionAgendaStatus)) {
        throw new BadRequestException('Status inválido.');
      }
      where.status = s as OrionAgendaStatus;
    }
    return this.prisma.orionAgendaCompromisso.findMany({
      where,
      orderBy: [{ dataInicio: 'asc' }, { id: 'asc' }],
      include: {
        participantes: { orderBy: { ordem: 'asc' } },
      },
    });
  }

  async obterCompromisso(usuario: UsuarioOrionAgendaReq, id: number) {
    this.assertAcessoModulo(usuario);
    const row = await this.prisma.orionAgendaCompromisso.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Compromisso não encontrado.');
    }
    return row;
  }

  async criarCompromisso(usuario: UsuarioOrionAgendaReq, dto: CreateAgendaCompromissoDto) {
    this.assertAcessoModulo(usuario);
    const dataInicio = new Date(dto.dataInicio);
    const dataFim = dto.dataFim ? new Date(dto.dataFim) : null;
    const diaInteiro = dto.diaInteiro === true;
    this.validarDatas(dataInicio, dataFim, diaInteiro);

    const tipo = dto.tipo ?? 'REUNIAO';
    const idsPoliciais = this.idsPoliciaisDoDto(dto);
    const participantes = idsPoliciais.length
      ? await this.resolverPoliciaisIds(idsPoliciais)
      : [];
    const nomes = participantes.map((p) => p.nome);
    const policialId = participantes[0]?.id ?? null;
    const responsavelNome = nomes.length ? this.formatarNomesParticipantes(nomes) : null;
    const titulo = this.montarTituloCompromisso(dto.titulo, tipo, responsavelNome);

    await this.assertNaoDuplicado(tipo, dataInicio, idsPoliciais);

    return this.prisma.orionAgendaCompromisso.create({
      data: {
        titulo,
        descricao: dto.descricao?.trim() || null,
        dataInicio,
        dataFim,
        diaInteiro,
        local: dto.local?.trim() || null,
        tipo,
        status: dto.status ?? 'AGENDADO',
        policialId,
        responsavelNome,
        criadoPorId: usuario.id,
        criadoPorNome: usuario.nome,
        participantes: participantes.length
          ? {
              create: participantes.map((p, ordem) => ({
                policialId: p.id,
                policialNome: p.nome,
                ordem,
              })),
            }
          : undefined,
      },
      include: {
        participantes: { orderBy: { ordem: 'asc' } },
      },
    });
  }

  async atualizarCompromisso(
    usuario: UsuarioOrionAgendaReq,
    id: number,
    dto: UpdateAgendaCompromissoDto,
  ) {
    this.assertAcessoModulo(usuario);
    const before = await this.prisma.orionAgendaCompromisso.findUnique({
      where: { id },
      include: { participantes: { orderBy: { ordem: 'asc' } } },
    });
    if (!before) {
      throw new NotFoundException('Compromisso não encontrado.');
    }

    const dataInicio = dto.dataInicio != null ? new Date(dto.dataInicio) : before.dataInicio;
    const dataFim =
      dto.dataFim !== undefined
        ? dto.dataFim
          ? new Date(dto.dataFim)
          : null
        : before.dataFim;
    const diaInteiro = dto.diaInteiro ?? before.diaInteiro;
    this.validarDatas(dataInicio, dataFim, diaInteiro);

    const tipo = dto.tipo ?? before.tipo;
    const idsInformados =
      dto.policialIds !== undefined
        ? dto.policialIds
        : dto.policialId !== undefined
          ? dto.policialId != null
            ? [dto.policialId]
            : []
          : undefined;

    let policialId = before.policialId;
    let responsavelNome = before.responsavelNome;
    let participantesResolvidos: Array<{ id: number; nome: string }> | undefined;

    if (idsInformados !== undefined) {
      participantesResolvidos = idsInformados.length
        ? await this.resolverPoliciaisIds(idsInformados)
        : [];
      const nomes = participantesResolvidos.map((p) => p.nome);
      policialId = participantesResolvidos[0]?.id ?? null;
      responsavelNome = nomes.length ? this.formatarNomesParticipantes(nomes) : null;
    }

    const idsParaDuplicidade =
      idsInformados ??
      this.idsParticipantesOrdenados(before.participantes, before.policialId);
    await this.assertNaoDuplicado(tipo, dataInicio, idsParaDuplicidade, id);

    const titulo = this.montarTituloCompromisso(
      dto.titulo,
      tipo,
      responsavelNome,
    );

    return this.prisma.$transaction(async (tx) => {
      if (participantesResolvidos !== undefined) {
        await tx.orionAgendaCompromissoParticipante.deleteMany({
          where: { compromissoId: id },
        });
        if (participantesResolvidos.length) {
          await tx.orionAgendaCompromissoParticipante.createMany({
            data: participantesResolvidos.map((p, ordem) => ({
              compromissoId: id,
              policialId: p.id,
              policialNome: p.nome,
              ordem,
            })),
          });
        }
      }

      return tx.orionAgendaCompromisso.update({
        where: { id },
        data: {
          titulo,
          ...(dto.descricao !== undefined
            ? { descricao: dto.descricao?.trim() || null }
            : {}),
          ...(dto.dataInicio !== undefined ? { dataInicio } : {}),
          ...(dto.dataFim !== undefined ? { dataFim } : {}),
          ...(dto.diaInteiro !== undefined ? { diaInteiro } : {}),
          ...(dto.local !== undefined ? { local: dto.local?.trim() || null } : {}),
          ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(idsInformados !== undefined ? { policialId, responsavelNome } : {}),
          atualizadoPorId: usuario.id,
          atualizadoPorNome: usuario.nome,
        },
        include: {
          participantes: { orderBy: { ordem: 'asc' } },
        },
      });
    });
  }

  async excluirCompromisso(usuario: UsuarioOrionAgendaReq, id: number) {
    this.assertAcessoModulo(usuario);
    const before = await this.prisma.orionAgendaCompromisso.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException('Compromisso não encontrado.');
    }
    await this.prisma.orionAgendaCompromisso.delete({ where: { id } });
    return { ok: true };
  }
}
