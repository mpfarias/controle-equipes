import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ESCALA_CHAVE, ESCALA_DEFAULTS } from './escalas.constants';
import { UpdateEscalaParametrosDto } from './dto/update-escala-parametros.dto';
import { CreateEscalaInformacaoDto } from './dto/create-escala-informacao.dto';
import { UpdateEscalaInformacaoDto } from './dto/update-escala-informacao.dto';
import { CreateEscalaGeradaDto } from './dto/create-escala-gerada.dto';

/** Letras das cinco equipes no calendário 12×24 (aba Equipes — turnos dia/noite; alinhado ao `CalendarioSection`). */
const EQUIPES_ESCALA_12X24 = new Set(['D', 'E', 'B', 'A', 'C']);
/** Rodízio 24×72 dos motoristas (aba Motoristas do calendário). */
const EQUIPES_MOTORISTAS = new Set(['A', 'B', 'C', 'D']);

function normalizarHorarioEscalaGerada(h: string): string {
  return h.replace(/\s+/g, ' ').trim();
}

/** Assinatura multiset (policial + horário por linha); mesma data + mesmo tipo + mesma assinatura = duplicata. */
function assinaturaLinhasEscalaGerada(linhas: { policialId: number; horarioServico: string }[]): string {
  const partes = linhas.map((l) => `${l.policialId}|${normalizarHorarioEscalaGerada(l.horarioServico)}`);
  partes.sort();
  return partes.join('\u0001');
}

function parseSequencia(raw: string, permitido: Set<string>, label: string): string {
  const partes = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (partes.length === 0) {
    throw new BadRequestException(`${label}: informe ao menos uma equipe.`);
  }
  for (const p of partes) {
    if (!permitido.has(p)) {
      throw new BadRequestException(`${label}: valor inválido "${p}". Use apenas: ${[...permitido].join(', ')}.`);
    }
  }
  return partes.join(',');
}

export type EscalaParametrosResposta = {
  dataInicioEquipes: string;
  dataInicioMotoristas: string;
  sequenciaEquipes: string;
  sequenciaMotoristas: string;
};

@Injectable()
export class EscalasService {
  constructor(private readonly prisma: PrismaService) {}

  private async mapParametrosFromDb(): Promise<EscalaParametrosResposta> {
    const rows = await this.prisma.escalaParametro.findMany();
    const map = new Map(rows.map((r) => [r.chave, r.valor]));
    return {
      dataInicioEquipes: map.get(ESCALA_CHAVE.DATA_INICIO_EQUIPES) ?? ESCALA_DEFAULTS[ESCALA_CHAVE.DATA_INICIO_EQUIPES],
      dataInicioMotoristas:
        map.get(ESCALA_CHAVE.DATA_INICIO_MOTORISTAS) ?? ESCALA_DEFAULTS[ESCALA_CHAVE.DATA_INICIO_MOTORISTAS],
      sequenciaEquipes: map.get(ESCALA_CHAVE.SEQUENCIA_EQUIPES) ?? ESCALA_DEFAULTS[ESCALA_CHAVE.SEQUENCIA_EQUIPES],
      sequenciaMotoristas:
        map.get(ESCALA_CHAVE.SEQUENCIA_MOTORISTAS) ?? ESCALA_DEFAULTS[ESCALA_CHAVE.SEQUENCIA_MOTORISTAS],
    };
  }

  async getParametros(): Promise<EscalaParametrosResposta> {
    return this.mapParametrosFromDb();
  }

  async updateParametros(
    dto: UpdateEscalaParametrosDto,
    actor: { id: number; nome: string },
  ): Promise<EscalaParametrosResposta> {
    const upserts: Array<{ chave: string; valor: string }> = [];

    if (dto.dataInicioEquipes !== undefined) {
      upserts.push({ chave: ESCALA_CHAVE.DATA_INICIO_EQUIPES, valor: dto.dataInicioEquipes.trim() });
    }
    if (dto.dataInicioMotoristas !== undefined) {
      upserts.push({ chave: ESCALA_CHAVE.DATA_INICIO_MOTORISTAS, valor: dto.dataInicioMotoristas.trim() });
    }
    if (dto.sequenciaEquipes !== undefined) {
      upserts.push({
        chave: ESCALA_CHAVE.SEQUENCIA_EQUIPES,
        valor: parseSequencia(dto.sequenciaEquipes, EQUIPES_ESCALA_12X24, 'Sequência das equipes (12×24)'),
      });
    }
    if (dto.sequenciaMotoristas !== undefined) {
      upserts.push({
        chave: ESCALA_CHAVE.SEQUENCIA_MOTORISTAS,
        valor: parseSequencia(
          dto.sequenciaMotoristas,
          EQUIPES_MOTORISTAS,
          'Sequência motoristas (24×72 — motorista de dia)',
        ),
      });
    }

    for (const { chave, valor } of upserts) {
      await this.prisma.escalaParametro.upsert({
        where: { chave },
        create: {
          chave,
          valor,
          updatedById: actor.id,
          updatedByName: actor.nome,
        },
        update: {
          valor,
          updatedById: actor.id,
          updatedByName: actor.nome,
        },
      });
    }

    return this.mapParametrosFromDb();
  }

  async listInformacoes(apenasAtivos: boolean) {
    return this.prisma.escalaInformacao.findMany({
      where: apenasAtivos ? { ativo: true } : undefined,
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
    });
  }

  async createInformacao(dto: CreateEscalaInformacaoDto, actor: { id: number; nome: string }) {
    return this.prisma.escalaInformacao.create({
      data: {
        titulo: dto.titulo.trim(),
        conteudo: dto.conteudo.trim(),
        ordem: dto.ordem ?? 0,
        createdById: actor.id,
        createdByName: actor.nome,
        updatedById: actor.id,
        updatedByName: actor.nome,
      },
    });
  }

  async updateInformacao(id: number, dto: UpdateEscalaInformacaoDto, actor: { id: number; nome: string }) {
    const existente = await this.prisma.escalaInformacao.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException(`Informativo ${id} não encontrado.`);
    }
    return this.prisma.escalaInformacao.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo.trim() } : {}),
        ...(dto.conteudo !== undefined ? { conteudo: dto.conteudo.trim() } : {}),
        ...(dto.ordem !== undefined ? { ordem: dto.ordem } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
        updatedById: actor.id,
        updatedByName: actor.nome,
      },
    });
  }

  async deleteInformacao(id: number) {
    const existente = await this.prisma.escalaInformacao.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException(`Informativo ${id} não encontrado.`);
    }
    await this.prisma.escalaInformacao.delete({ where: { id } });
  }

  async createEscalaGerada(dto: CreateEscalaGeradaDto, actor: { id: number; nome: string }) {
    const dataEscala = new Date(`${dto.dataEscala}T12:00:00.000Z`);
    const ordem = ['OPERACIONAL', 'EXPEDIENTE', 'MOTORISTAS', 'EXTRAORDINARIA'] as const;
    const set = new Set(dto.tipoServico.split(',').map((s) => s.trim()).filter(Boolean));
    const tipoServico = ordem.filter((t) => set.has(t)).join(',');
    const incluiExtraordinaria = set.has('EXTRAORDINARIA');
    const assinaturaNova = assinaturaLinhasEscalaGerada(
      dto.linhas.map((l) => ({ policialId: l.policialId, horarioServico: l.horarioServico })),
    );
    return this.prisma.$transaction(async (tx) => {
      const candidatos = await tx.escalaGerada.findMany({
        where: { ativo: true, dataEscala },
        include: { linhas: true },
      });
      for (const c of candidatos) {
        if (c.tipoServico !== tipoServico) continue;
        const assinaturaEx = assinaturaLinhasEscalaGerada(
          c.linhas.map((l) => ({ policialId: l.policialId, horarioServico: l.horarioServico })),
        );
        if (assinaturaEx === assinaturaNova) {
          throw new BadRequestException(
            'Já existe escala salva nesta data, com o mesmo tipo de serviço, os mesmos policiais e os mesmos horários. Desative ou exclua o registro anterior, ou altere policiais/horários, antes de salvar novamente.',
          );
        }
      }

      const created = await tx.escalaGerada.create({
        data: {
          dataEscala,
          tipoServico,
          resumoEquipes: dto.resumoEquipes?.trim() || null,
          impressaoDraft:
            dto.impressaoDraft != null ? (dto.impressaoDraft as Prisma.InputJsonValue) : undefined,
          createdById: actor.id,
          createdByName: actor.nome,
          linhas: {
            create: dto.linhas.map((l) => ({
              lista: l.lista,
              policialId: l.policialId,
              nome: l.nome.trim(),
              matricula: l.matricula.trim(),
              equipe: l.equipe?.trim() || null,
              horarioServico: l.horarioServico.trim(),
              funcaoNome: l.funcaoNome?.trim() || null,
              detalheAfastamento: l.detalheAfastamento?.trim() || null,
            })),
          },
        },
        include: {
          linhas: { orderBy: [{ nome: 'asc' }] },
        },
      });

      if (incluiExtraordinaria) {
        const ids = [...new Set(dto.linhas.map((l) => l.policialId))];
        for (const policialId of ids) {
          await tx.policialContagemEscalaExtra.upsert({
            where: { policialId },
            create: { policialId, vezesEscaladoExtra: 1 },
            update: { vezesEscaladoExtra: { increment: 1 } },
          });
        }
      }

      return created;
    });
  }

  /** Policiais que já entraram em pelo menos uma escala extra salva, do maior para o menor número de gravações. */
  async listQuantitativoExtrasPoliciais() {
    const rows = await this.prisma.policialContagemEscalaExtra.findMany({
      where: { vezesEscaladoExtra: { gt: 0 } },
      orderBy: [{ vezesEscaladoExtra: 'desc' }, { policialId: 'asc' }],
      include: {
        policial: { select: { id: true, nome: true, matricula: true, equipe: true } },
      },
    });
    return rows.map((r) => ({
      policialId: r.policialId,
      nome: r.policial.nome,
      matricula: r.policial.matricula,
      equipe: r.policial.equipe,
      vezesEscaladoExtra: r.vezesEscaladoExtra,
    }));
  }

  /** Remove o registro de contagem do policial (some da lista; novas gravações voltam a contar do zero). */
  async deleteContagemEscalaExtraPolicial(policialId: number) {
    const existente = await this.prisma.policialContagemEscalaExtra.findUnique({
      where: { policialId },
    });
    if (!existente) {
      throw new NotFoundException(`Não há contagem de escala extra para o policial ${policialId}.`);
    }
    await this.prisma.policialContagemEscalaExtra.delete({ where: { policialId } });
  }

  async getEscalaGeradaById(id: number) {
    const row = await this.prisma.escalaGerada.findFirst({
      where: { id, ativo: true },
      include: {
        linhas: { orderBy: [{ nome: 'asc' }] },
      },
    });
    if (!row) {
      throw new NotFoundException(`Escala gerada ${id} não encontrada.`);
    }
    return row;
  }

  async desativarEscalaGerada(id: number) {
    const existente = await this.prisma.escalaGerada.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException(`Escala gerada ${id} não encontrada.`);
    }
    if (!existente.ativo) {
      throw new BadRequestException('Esta escala já está desativada.');
    }
    return this.prisma.escalaGerada.update({
      where: { id },
      data: { ativo: false },
    });
  }

  async deleteEscalaGerada(id: number) {
    await this.prisma.$transaction(async (tx) => {
      const existente = await tx.escalaGerada.findUnique({
        where: { id },
        include: { linhas: true },
      });
      if (!existente) {
        throw new NotFoundException(`Escala gerada ${id} não encontrada.`);
      }
      const incluiExtraordinaria = existente.tipoServico
        .split(',')
        .map((s) => s.trim())
        .includes('EXTRAORDINARIA');
      if (incluiExtraordinaria) {
        const ids = [...new Set(existente.linhas.map((l) => l.policialId))];
        for (const policialId of ids) {
          const cnt = await tx.policialContagemEscalaExtra.findUnique({ where: { policialId } });
          if (!cnt) continue;
          if (cnt.vezesEscaladoExtra <= 1) {
            await tx.policialContagemEscalaExtra.delete({ where: { policialId } });
          } else {
            await tx.policialContagemEscalaExtra.update({
              where: { policialId },
              data: { vezesEscaladoExtra: { decrement: 1 } },
            });
          }
        }
      }
      await tx.escalaGerada.delete({ where: { id } });
    });
  }

  /** Lista metadados das escalas salvas (sem linhas), mais recentes primeiro. */
  async listEscalaGeradas(options?: { take?: number; skip?: number }) {
    const take = Math.min(Math.max(options?.take ?? 150, 1), 300);
    const skip = Math.max(options?.skip ?? 0, 0);
    const rows = await this.prisma.escalaGerada.findMany({
      where: { ativo: true },
      orderBy: { id: 'desc' },
      take,
      skip,
      select: {
        id: true,
        dataEscala: true,
        tipoServico: true,
        resumoEquipes: true,
        createdAt: true,
        createdById: true,
        createdByName: true,
        _count: { select: { linhas: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      dataEscala: r.dataEscala.toISOString().slice(0, 10),
      tipoServico: r.tipoServico,
      resumoEquipes: r.resumoEquipes,
      createdAt: r.createdAt.toISOString(),
      createdById: r.createdById,
      createdByName: r.createdByName,
      linhasCount: r._count.linhas,
    }));
  }
}
